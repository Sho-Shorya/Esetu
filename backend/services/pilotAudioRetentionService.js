import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import { Order } from "../models/orderModel.js";
import { PHONE_ORDER_CLAIM_TIMEOUT_MS } from "./phoneOrderBridgeService.js";
import { deleteAudioFromCloud } from "./pilotAudioCloud.js";
import {
  cleanupExpiredAudioFiles,
  describeAudioStorage,
  getAudioRetentionDays,
  isCloudAudioConfigured,
  listExpiredAudioFiles,
} from "./pilotAudioStorage.js";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pipeline stages that mean a run is reading the recording right now. A
 * recording at one of these is never deleted, however old it is, because the
 * run that is using it would fail halfway through.
 */
const ACTIVE_PIPELINE_STAGES = [
  "processing_recording",
  "downloading_recording",
  "transcribing",
  "extracting",
];

/**
 * The same idea on the call record, which mirrors the pipeline state and can be
 * ahead of it. "waiting_audio" is included because a call that has not produced
 * its audio yet is still an open recording.
 */
const ACTIVE_PROCESSING_STATUS = ["processing", "waiting_audio"];

const retentionCutoff = (now, retentionDays) =>
  new Date(
    now.getTime() -
      Math.max(1, Number(retentionDays) || 30) * DAY_MS,
  );

/**
 * Anything safe to put in a log line.
 *
 * A failure message is the one piece of this sweep that arrives from outside the
 * process, and an upstream SDK error quotes the request that failed, which can
 * contain a signed url, a credential, and whatever the caller had in it. A phone
 * number is stripped for the same reason: a vendor echoing a request back at us
 * is not a licence to write a customer's number into application logs.
 *
 * Applied to the error text only. The asset id is logged separately because it is
 * opaque random bytes with no call data in it, and without it a failure cannot
 * be diagnosed.
 */
const safeErrorText = (error) =>
  String(error?.message || error || "unknown error")
    // A url of any kind, which is where a signature or a key usually hides.
    .replace(/https?:\/\/\S+/gi, "[url]")
    // A named credential, wherever it appears.
    .replace(
      /\b(api[_-]?key|api[_-]?secret|signature|sig|token|secret|password|authorization)\b\s*[:=]\s*\S+/gi,
      "[redacted]",
    )
    // Any run of eight or more digits, which covers a 10 digit number with or
    // without its country code and separators.
    .replace(/\+?\d[\d\s-]{6,}\d/g, "[redacted]")
    .slice(0, 300);

/**
 * The pilot ids that a real Order depends on. Used by both backends: a recording
 * that an order was built from is kept, because the supplier may need to listen
 * back to the call that produced it.
 */
const findPilotIdsWithOrders = async (pilotIds) => {
  if (!pilotIds.length) return new Set();

  const orders = await Order.find({
    $or: [
      { phoneCallPilotIds: { $in: pilotIds } },
      { phoneCallPilotId: { $in: pilotIds } },
    ],
  })
    .select("phoneCallPilotId phoneCallPilotIds")
    .lean();

  return new Set(
    orders.flatMap((order) =>
      [order.phoneCallPilotId, ...(order.phoneCallPilotIds || [])]
        .filter(Boolean)
        .map((id) => String(id)),
    ),
  );
};

/**
 * A recording older than the retention period.
 *
 * The local policy measures age with the file's mtime. A durable recording has
 * no file, so the same age is measured with `storedAt`, which is when the
 * recording was written. A record that somehow has no `storedAt` falls back to
 * the document's own age, so nothing can become un-expirable by losing a field.
 */
const expiredStorageFilter = (prefix, fallbackField, cutoff) => ({
  $or: [
    { [`${prefix}.storedAt`]: { $lte: cutoff } },
    { [`${prefix}.storedAt`]: null, [fallbackField]: { $lte: cutoff } },
  ],
});

/**
 * An order that is being created right now still needs the call behind it. A
 * claim older than the bridge's own timeout is treated as dead, so a process
 * that died mid-confirm does not pin a recording forever.
 */
const hasLiveOrderClaim = (pilot, now) => {
  if (pilot.review?.confirmed?.orderCreated === true) return false;
  const claimedAt = pilot.review?.confirmed?.orderClaimedAt;
  if (!claimedAt) return false;

  return new Date(claimedAt).getTime() > now.getTime() - PHONE_ORDER_CLAIM_TIMEOUT_MS;
};

/* ------------------------------- local backend ------------------------------ */

/**
 * The original local policy, unchanged: expired files on this server's disk are
 * removed unless an order depends on them, and the file name and digest
 * references are cleared so the upload can be retried.
 */
const cleanupExpiredLocalAudio = async () => {
  const expiredFileNames = await listExpiredAudioFiles();
  if (expiredFileNames.length === 0) return 0;

  const orderedCalls = await PhoneCallPilot.find({
    "audio.fileName": { $in: expiredFileNames },
    "review.confirmed.orderCreated": true,
  })
    .select("_id")
    .lean();
  const orderedCallIds = orderedCalls.map((call) => call._id);
  const preservedCallIds = await findPilotIdsWithOrders(orderedCallIds);
  const preservedFileNames = new Set(
    orderedCalls
      .filter((call) => preservedCallIds.has(String(call._id)))
      .map((call) => call.audio?.fileName)
      .filter(Boolean),
  );
  const fileNames = await cleanupExpiredAudioFiles({
    preserveFileNames: [...preservedFileNames],
  });
  if (fileNames.length === 0) return 0;

  await Promise.all([
    PhoneCall.updateMany(
      { "recording.fileName": { $in: fileNames } },
      {
        $set: {
          "recording.fileName": null,
          "recording.sha256": null,
        },
      },
    ),
    PhoneCallPilot.updateMany(
      { "audio.fileName": { $in: fileNames } },
      {
        $set: {
          "audio.fileName": null,
          "audio.sha256": null,
        },
      },
    ),
  ]);

  return fileNames.length;
};

/* ------------------------------ durable backend ----------------------------- */

/**
 * Expires durable recordings under the same period as the local ones.
 *
 * A recording is deleted only when all of the following hold, and the first
 * check is the same age test the local sweep applies:
 *
 *   1. it is past the retention period,
 *   2. no document still points at the asset being deleted,
 *   3. nothing is using it: no pipeline stage that is reading it, no call
 *      waiting on it, no order being created against it, and no real Order
 *      depends on the call behind it.
 *
 * One asset is normally referenced by both a call and a pilot record, because
 * both were written by the same upload, so the decision is made per asset and
 * the weakest reference wins: if any one document still needs the bytes, the
 * asset stays.
 *
 * Never throws. A single undeletable asset is logged and the sweep continues,
 * and because the references are only cleared after the delete succeeds, the
 * next run simply tries again.
 */
export const cleanupExpiredCloudAudio = async ({
  now = new Date(),
  retentionDays = getAudioRetentionDays(),
} = {}) => {
  const summary = { scanned: 0, deleted: 0, preserved: 0, failed: 0 };

  // Skipped when there are no credentials: there can be no durable recording to
  // expire, and calling out would fail for every asset.
  if (!isCloudAudioConfigured()) return summary;

  const at = now instanceof Date ? now : new Date(now);
  const cutoff = retentionCutoff(at, retentionDays);

  let pilots = [];
  let calls = [];
  try {
    [pilots, calls] = await Promise.all([
      PhoneCallPilot.find({
        "audio.storage": "cloud",
        "audio.publicId": { $exists: true, $ne: null },
        ...expiredStorageFilter("audio", "createdAt", cutoff),
      })
        .select(
          "_id audio.publicId pipeline.stage " +
            "review.status review.confirmed.orderCreated " +
            "review.confirmed.orderClaimedAt",
        )
        .lean(),
      PhoneCall.find({
        "recording.storage": "cloud",
        "recording.publicId": { $exists: true, $ne: null },
        ...expiredStorageFilter("recording", "callAt", cutoff),
      })
        .select("_id pilotCallId processingStatus recording.publicId")
        .lean(),
    ]);
  } catch (error) {
    // An enumeration failure means nothing is known about what is expired, not
    // that nothing is. Reported and abandoned rather than thrown, so a database
    // hiccup cannot stop the local pass or take the whole sweep down with it.
    console.error(
      `Pilot audio retention: could not list expired durable recordings: ${safeErrorText(error)}`,
    );
    return summary;
  }

  const assets = new Map();
  // A reference with no asset id is not something that can be deleted, and is
  // skipped rather than becoming a deletion attempt against an empty id.
  const assetFor = (publicId) => {
    if (!publicId) return null;
    if (!assets.has(publicId)) {
      assets.set(publicId, { publicId, preserved: false, references: 0 });
    }
    return assets.get(publicId);
  };

  for (const pilot of pilots) {
    const asset = assetFor(pilot.audio?.publicId);
    if (!asset) continue;
    asset.references += 1;
    if (
      ACTIVE_PIPELINE_STAGES.includes(pilot.pipeline?.stage) ||
      hasLiveOrderClaim(pilot, at)
    ) {
      asset.preserved = true;
    }
  }

  for (const call of calls) {
    const asset = assetFor(call.recording?.publicId);
    if (!asset) continue;
    asset.references += 1;
    if (ACTIVE_PROCESSING_STATUS.includes(call.processingStatus)) {
      asset.preserved = true;
    }
  }

  summary.scanned = assets.size;
  if (summary.scanned === 0) return summary;

  // The order check is the one the local sweep already applies, run over every
  // pilot that referenced an expired asset, so a recording an Order depends on is
  // kept even when only the call record still points at it.
  const candidatePilotIds = [
    ...pilots.map((pilot) => pilot._id),
    ...calls.map((call) => call.pilotCallId).filter(Boolean),
  ];
  const preservedByOrder = await findPilotIdsWithOrders([
    ...new Map(
      candidatePilotIds.map((id) => [String(id), id]),
    ).values(),
  ]);

  for (const pilot of pilots) {
    if (preservedByOrder.has(String(pilot._id))) {
      const asset = assetFor(pilot.audio?.publicId);
      if (asset) asset.preserved = true;
    }
  }
  for (const call of calls) {
    if (call.pilotCallId && preservedByOrder.has(String(call.pilotCallId))) {
      const asset = assetFor(call.recording?.publicId);
      if (asset) asset.preserved = true;
    }
  }

  for (const asset of assets.values()) {
    if (asset.preserved) {
      summary.preserved += 1;
      continue;
    }

    try {
      const removed = await deleteAudioFromCloud({ publicId: asset.publicId });
      if (!removed) {
        // The asset was not confirmed gone, so the references are deliberately
        // left alone and the next sweep tries again instead of forgetting where
        // the audio lives.
        summary.failed += 1;
        console.error(
          `Pilot audio retention: durable asset ${asset.publicId} was not confirmed deleted; references kept.`,
        );
        continue;
      }

      // Only references to this exact asset are cleared. A recording re-uploaded
      // in the meantime has a different public id and is matched by neither
      // update.
      await Promise.all([
        PhoneCallPilot.updateMany(
          { "audio.storage": "cloud", "audio.publicId": asset.publicId },
          {
            $set: {
              "audio.publicId": null,
              "audio.fileName": null,
              "audio.sha256": null,
              "audio.format": null,
            },
          },
        ),
        PhoneCall.updateMany(
          { "recording.storage": "cloud", "recording.publicId": asset.publicId },
          {
            $set: {
              "recording.publicId": null,
              "recording.fileName": null,
              "recording.sha256": null,
              "recording.format": null,
            },
          },
        ),
      ]);

      summary.deleted += 1;
    } catch (error) {
      summary.failed += 1;
      console.error(
        `Pilot audio retention: could not delete durable asset ${asset.publicId} (${asset.references} reference(s)): ${safeErrorText(error)}`,
      );
    }
  }

  if (summary.deleted > 0 || summary.failed > 0) {
    console.info(
      `Pilot audio retention: ${summary.deleted} durable recording(s) past ${retentionDays} day retention deleted, ` +
        `${summary.preserved} kept, ${summary.failed} failed.`,
    );
  }

  return summary;
};

/**
 * The scheduled sweep, both backends.
 *
 * The durable pass runs first and cannot throw, so a local disk problem can
 * never stop expired audio from being cleaned up elsewhere. The local pass then
 * runs exactly as it always has, including how it reports a failure.
 */
export const cleanupExpiredPilotAudio = async () => {
  const cloud = await cleanupExpiredCloudAudio();
  const local = await cleanupExpiredLocalAudio();

  return cloud.deleted + local;
};

export const startPilotAudioRetention = () => {
  // Said once at boot. Falling back to local disk in production means every
  // recording is lost on redeploy, so it has to be visible in the logs rather
  // than discovered the first time an order cannot be recovered.
  console.info(describeAudioStorage());

  const run = () =>
    cleanupExpiredPilotAudio()
      .then((removed) => {
        if (removed > 0) {
          console.info(
            `Removed ${removed} pilot audio recording(s) past ${getAudioRetentionDays()} day retention.`,
          );
        }
      })
      .catch((error) =>
        console.error("Pilot audio retention cleanup failed:", error.message),
      );

  void run();
  const timer = setInterval(run, CLEANUP_INTERVAL_MS);
  timer.unref?.();
  return timer;
};
