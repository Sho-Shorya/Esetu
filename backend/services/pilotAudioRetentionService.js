import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import { Order } from "../models/orderModel.js";
import {
  cleanupExpiredAudioFiles,
  getAudioRetentionDays,
  listExpiredAudioFiles,
} from "./pilotAudioStorage.js";

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export const cleanupExpiredPilotAudio = async () => {
  const expiredFileNames = await listExpiredAudioFiles();
  if (expiredFileNames.length === 0) return 0;

  const orderedCalls = await PhoneCallPilot.find({
    "audio.fileName": { $in: expiredFileNames },
    "review.confirmed.orderCreated": true,
  })
    .select("_id")
    .lean();
  const orderedCallIds = orderedCalls.map((call) => call._id);
  const preservedOrders = orderedCallIds.length
    ? await Order.find({
        $or: [
          { phoneCallPilotIds: { $in: orderedCallIds } },
          { phoneCallPilotId: { $in: orderedCallIds } },
        ],
      })
        .select("phoneCallPilotId phoneCallPilotIds")
        .lean()
    : [];
  const preservedCallIds = new Set(
    preservedOrders.flatMap((order) =>
      [order.phoneCallPilotId, ...(order.phoneCallPilotIds || [])]
        .filter(Boolean)
        .map((id) => String(id)),
    ),
  );
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

export const startPilotAudioRetention = () => {
  const run = () =>
    cleanupExpiredPilotAudio()
      .then((removed) => {
        if (removed > 0) {
          console.info(
            `Removed ${removed} pilot audio file(s) past ${getAudioRetentionDays()} day retention.`,
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
