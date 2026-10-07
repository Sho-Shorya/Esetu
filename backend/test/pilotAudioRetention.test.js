import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import cloudinary from "../utils/cloudinary.js";
import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import { Order } from "../models/orderModel.js";
import { cleanupExpiredAudioFiles } from "../services/pilotAudioStorage.js";
import {
  cleanupExpiredCloudAudio,
  cleanupExpiredPilotAudio,
} from "../services/pilotAudioRetentionService.js";

test("audio retention deletes only expired regular files", async () => {
  const dir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "esetu-audio-retention-"),
  );
  const nestedDir = path.join(dir, "nested");
  const expiredPath = path.join(dir, "old-call.wav");
  const recentPath = path.join(dir, "recent-call.wav");
  const now = new Date("2026-09-26T00:00:00.000Z");

  try {
    await fsp.mkdir(nestedDir);
    await fsp.writeFile(expiredPath, "expired");
    await fsp.writeFile(recentPath, "recent");
    await fsp.writeFile(path.join(nestedDir, "nested-call.wav"), "nested");
    await fsp.utimes(
      expiredPath,
      new Date("2026-08-01T00:00:00.000Z"),
      new Date("2026-08-01T00:00:00.000Z"),
    );

    const removed = await cleanupExpiredAudioFiles({
      now,
      retentionDays: 30,
      dir,
    });

    assert.deepEqual(removed, ["old-call.wav"]);
    await assert.rejects(fsp.access(expiredPath));
    await fsp.access(recentPath);
    await fsp.access(path.join(nestedDir, "nested-call.wav"));
  } finally {
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

/* ========================================================================== *
 *  Durable recording lifecycle
 *
 *  The same retention period, the same order-backed exemption, applied to
 *  private assets instead of files. Cloudinary is replaced by a fake that keeps
 *  a real asset table, so "was it actually deleted" is answered by the bytes
 *  being gone rather than by a call being made.
 * ========================================================================== */

const NOW = new Date("2026-09-26T00:00:00.000Z");
const PILOT_ID = "pilot-1";
const CALL_ID = "call-1";
const OLD = "2026-01-01T00:00:00.000Z";
const RECENT = "2026-09-20T00:00:00.000Z";

const oldAsset = (name) => `esetu/phone-calls/${name}`;

const cloudPilot = (publicId, overrides = {}) => ({
  _id: PILOT_ID,
  createdAt: new Date(OLD),
  audio: {
    storage: "cloud",
    publicId,
    format: "wav",
    fileName: null,
    sha256: "digest-1",
    storedAt: new Date(OLD),
  },
  pipeline: { stage: "completed" },
  review: { status: "confirmed", confirmed: { orderCreated: false } },
  ...overrides,
});

const cloudCall = (publicId, overrides = {}) => ({
  _id: CALL_ID,
  createdAt: new Date(OLD),
  callAt: new Date(OLD),
  pilotCallId: PILOT_ID,
  processingStatus: "confirmed",
  recording: {
    storage: "cloud",
    publicId,
    format: "wav",
    fileName: null,
    sha256: "digest-1",
    storedAt: new Date(OLD),
  },
  ...overrides,
});

/**
 * The fake asset table plus the model queries the sweep makes. The two finds are
 * told apart by which sub-document they filter on, which is also how the real
 * sweep tells a pilot record from a call record.
 */
const makeCloudinaryFake = () => {
  const assets = new Map();
  const destroyed = [];
  let failWith = null;

  cloudinary.uploader.destroy = async (publicId) => {
    destroyed.push(publicId);
    if (failWith) {
      const error = failWith;
      failWith = null;
      throw error;
    }
    return { result: assets.delete(publicId) ? "ok" : "not found" };
  };

  return {
    assets,
    destroyed,
    failNextWith: (error) => {
      failWith = error;
    },
  };
};

const get = (doc, dotted) =>
  dotted.split(".").reduce((value, key) => (value == null ? value : value[key]), doc);

/**
 * The stand-in for Mongo applying the sweep's own query.
 *
 * It reads the cutoff back out of the query the service sent, so a test can only
 * pass because the service selected the right documents, not because everything
 * was returned. The `$or` is honoured exactly as Mongo would: a document with a
 * `storedAt` is aged by it, and only a document without one falls back to its own
 * age.
 */
const cutoffFrom = (filter, prefix) =>
  new Date(
    filter.$or.find((clause) => clause[`${prefix}.storedAt`]?.$lte)[
      `${prefix}.storedAt`
    ].$lte,
  );

const matchesExpiredCloud = (doc, filter, prefix, fallbackField) => {
  const record = get(doc, prefix) || {};
  if (filter[`${prefix}.storage`] !== undefined) {
    if (record.storage !== filter[`${prefix}.storage`]) return false;
  }
  if (!record.publicId) return false;

  const cutoff = cutoffFrom(filter, prefix);
  if (record.storedAt) return new Date(record.storedAt) <= cutoff;

  const fallback = get(doc, fallbackField);
  return Boolean(fallback) && new Date(fallback) <= cutoff;
};

/** Applies the `$set` the sweep sends, so a second pass sees the cleared state. */
const applySet = (doc, dotted, value) => {
  const keys = dotted.split(".");
  let target = doc;
  for (const key of keys.slice(0, -1)) {
    if (!target[key]) target[key] = {};
    target = target[key];
  }
  target[keys.at(-1)] = value;
};

const makeHarness = ({ pilots = [], calls = [], orders = [] } = {}) => {
  const updates = { pilots: [], calls: [] };

  PhoneCallPilot.find = (filter) => ({
    select() {
      return this;
    },
    lean: async () =>
      filter["audio.fileName"]?.$in
        ? // The local sweep, which looks records up by file name.
          pilots.filter((doc) =>
            filter["audio.fileName"].$in.includes(doc.audio?.fileName),
          )
        : pilots.filter((doc) =>
            matchesExpiredCloud(doc, filter, "audio", "createdAt"),
          ),
  });

  PhoneCall.find = (filter) => ({
    select() {
      return this;
    },
    lean: async () =>
      calls.filter((doc) =>
        matchesExpiredCloud(doc, filter, "recording", "callAt"),
      ),
  });

  Order.find = () => ({
    select() {
      return this;
    },
    lean: async () => orders,
  });

  PhoneCallPilot.updateMany = async (filter, update) => {
    updates.pilots.push({ filter, update });
    for (const doc of pilots) {
      if (matchesCloudRef(doc, filter, "audio")) {
        for (const [path, value] of Object.entries(update.$set)) {
          applySet(doc, path, value);
        }
      }
    }
    return { acknowledged: true, modifiedCount: 1 };
  };
  PhoneCall.updateMany = async (filter, update) => {
    updates.calls.push({ filter, update });
    for (const doc of calls) {
      if (matchesCloudRef(doc, filter, "recording")) {
        for (const [path, value] of Object.entries(update.$set)) {
          applySet(doc, path, value);
        }
      }
    }
    return { acknowledged: true, modifiedCount: 1 };
  };

  return updates;
};

/** The same rule for the two update queries: this document, this exact asset. */
const matchesCloudRef = (doc, filter, prefix) => {
  const record = get(doc, prefix) || {};
  return record.storage === filter[`${prefix}.storage`] &&
    record.publicId === filter[`${prefix}.publicId`];
};

const ENV_KEYS = ["CLOUD_NAME", "API_KEY", "API_SECRET", "PILOT_AUDIO_DIR"];

const withCloudRetention = async (options, run) => {
  const previous = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
  }
  const dir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "esetu-cloud-retention-"),
  );
  process.env.PILOT_AUDIO_DIR = dir;
  for (const key of ENV_KEYS) {
    if (key === "PILOT_AUDIO_DIR") continue;
    process.env[key] = "set-for-test";
  }

  const originals = {
    pilotFind: PhoneCallPilot.find,
    callFind: PhoneCall.find,
    orderFind: Order.find,
    pilotUpdateMany: PhoneCallPilot.updateMany,
    callUpdateMany: PhoneCall.updateMany,
    destroy: cloudinary.uploader.destroy,
  };
  const cloud = makeCloudinaryFake();
  for (const publicId of options.assetIds || []) {
    cloud.assets.set(publicId, Buffer.from("audio"));
  }
  const updates = makeHarness(options);

  try {
    return await run({ cloud, updates });
  } finally {
    PhoneCallPilot.find = originals.pilotFind;
    PhoneCall.find = originals.callFind;
    Order.find = originals.orderFind;
    PhoneCallPilot.updateMany = originals.pilotUpdateMany;
    PhoneCall.updateMany = originals.callUpdateMany;
    cloudinary.uploader.destroy = originals.destroy;
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    await fsp.rm(dir, { recursive: true, force: true });
  }
};

test("an expired durable recording is deleted from storage and from the database", async () => {
  const publicId = oldAsset("rec-1");
  await withCloudRetention(
    {
      assetIds: [publicId],
      pilots: [cloudPilot(publicId)],
      calls: [cloudCall(publicId)],
    },
    async ({ cloud, updates }) => {
      const summary = await cleanupExpiredCloudAudio({ now: NOW });

      assert.equal(summary.deleted, 1);
      assert.equal(summary.failed, 0);
      assert.equal(cloud.assets.has(publicId), false, "asset is gone");
      assert.deepEqual(cloud.destroyed, [publicId]);

      // One upload is referenced by both records, so both are cleared, and each
      // update names the exact asset it removed.
      assert.equal(updates.pilots.length, 1);
      assert.equal(updates.calls.length, 1);
      assert.equal(updates.pilots[0].filter["audio.publicId"], publicId);
      assert.equal(updates.calls[0].filter["recording.publicId"], publicId);
      assert.equal(updates.pilots[0].update.$set["audio.publicId"], null);
      assert.equal(updates.pilots[0].update.$set["audio.sha256"], null);
      assert.equal(updates.calls[0].update.$set["recording.publicId"], null);
    },
  );
});

test("a recording still inside the retention period is left alone", async () => {
  const publicId = oldAsset("rec-recent");
  await withCloudRetention(
    {
      assetIds: [publicId],
      pilots: [
        cloudPilot(publicId, {
          audio: {
            storage: "cloud",
            publicId,
            format: "wav",
            storedAt: new Date(RECENT),
          },
        }),
      ],
      calls: [
        cloudCall(publicId, {
          recording: {
            storage: "cloud",
            publicId,
            format: "wav",
            storedAt: new Date(RECENT),
          },
        }),
      ],
    },
    async ({ cloud, updates }) => {
      const summary = await cleanupExpiredCloudAudio({ now: NOW });

      assert.equal(summary.scanned, 0);
      assert.equal(summary.deleted, 0);
      assert.equal(cloud.assets.has(publicId), true, "asset still there");
      assert.deepEqual(cloud.destroyed, []);
      assert.equal(updates.pilots.length, 0);
      assert.equal(updates.calls.length, 0);
    },
  );
});

test("a failed durable deletion is reported and does not stop the sweep", async () => {
  const first = oldAsset("rec-fails");
  const second = oldAsset("rec-follows");
  await withCloudRetention(
    {
      assetIds: [first, second],
      pilots: [
        cloudPilot(first, { _id: "pilot-a" }),
        cloudPilot(second, { _id: "pilot-b" }),
      ],
      calls: [],
    },
    async ({ cloud, updates }) => {
      const error = new Error("Cloudinary said no");
      cloud.failNextWith(error);
      const logged = [];
      const originalError = console.error;
      console.error = (...args) => logged.push(args.join(" "));
      let summary;
      try {
        summary = await cleanupExpiredCloudAudio({ now: NOW });
      } finally {
        console.error = originalError;
      }

      // The undeletable asset is counted and reported, and the one after it is
      // still deleted rather than being skipped by the failure.
      assert.equal(summary.failed, 1);
      assert.equal(summary.deleted, 1);
      assert.equal(cloud.assets.has(first), true, "undeleted asset survives");
      assert.equal(cloud.assets.has(second), false);
      assert.equal(
        updates.pilots.length,
        1,
        "only the deleted asset has its references cleared",
      );
      assert.equal(updates.pilots[0].filter["audio.publicId"], second);
      assert.ok(
        logged.some((line) => line.includes(first)),
        "the failure names the asset it could not delete",
      );
    },
  );
});

test("a recording being processed or retried is protected, then expired once it is not", async () => {
  const processing = oldAsset("rec-processing");
  const failed = oldAsset("rec-failed");
  await withCloudRetention(
    {
      assetIds: [processing, failed],
      pilots: [
        cloudPilot(processing, {
          _id: "pilot-processing",
          pipeline: { stage: "transcribing" },
        }),
        cloudPilot(failed, {
          _id: "pilot-failed",
          pipeline: { stage: "failed" },
        }),
      ],
      calls: [
        cloudCall(processing, {
          _id: "call-processing",
          processingStatus: "processing",
        }),
        cloudCall(failed, { _id: "call-failed" }),
      ],
    },
    async ({ cloud, updates }) => {
      const summary = await cleanupExpiredCloudAudio({ now: NOW });

      // A failed pipeline is exactly what the retry button exists for, so the
      // recording it would retry from has to still be there.
      assert.equal(summary.preserved, 1);
      assert.equal(summary.deleted, 1);
      assert.equal(cloud.assets.has(processing), true, "in-flight asset kept");
      assert.equal(cloud.assets.has(failed), false, "idle asset expired");
      assert.deepEqual(
        updates.pilots.map((entry) => entry.filter["audio.publicId"]),
        [failed],
      );
    },
  );
});

test("a recording a real order depends on is preserved", async () => {
  const publicId = oldAsset("rec-ordered");
  await withCloudRetention(
    {
      assetIds: [publicId],
      pilots: [
        cloudPilot(publicId, {
          review: { status: "confirmed", confirmed: { orderCreated: true } },
        }),
      ],
      calls: [cloudCall(publicId)],
      orders: [{ phoneCallPilotIds: [PILOT_ID] }],
    },
    async ({ cloud, updates }) => {
      const summary = await cleanupExpiredCloudAudio({ now: NOW });

      assert.equal(summary.preserved, 1);
      assert.equal(summary.deleted, 0);
      assert.equal(cloud.assets.has(publicId), true);
      assert.equal(cloud.destroyed.length, 0);
      assert.equal(updates.pilots.length, 0);
    },
  );
});

test("an order being created right now protects the recording, a dead claim does not", async () => {
  const live = oldAsset("rec-claiming");
  const dead = oldAsset("rec-claim-dead");
  await withCloudRetention(
    {
      assetIds: [live, dead],
      pilots: [
        cloudPilot(live, {
          _id: "pilot-live",
          review: {
            status: "confirmed",
            confirmed: {
              orderCreated: false,
              orderClaimedAt: new Date(NOW.getTime() - 60 * 1000),
            },
          },
        }),
        cloudPilot(dead, {
          _id: "pilot-dead",
          review: {
            status: "confirmed",
            confirmed: {
              orderCreated: false,
              orderClaimedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
            },
          },
        }),
      ],
      calls: [],
    },
    async ({ cloud }) => {
      const summary = await cleanupExpiredCloudAudio({ now: NOW });

      assert.equal(summary.preserved, 1);
      assert.equal(summary.deleted, 1);
      assert.equal(cloud.assets.has(live), true, "a live claim keeps the audio");
      assert.equal(cloud.assets.has(dead), false, "a stale claim does not");
    },
  );
});

test("running the durable cleanup twice is harmless", async () => {
  const publicId = oldAsset("rec-twice");
  await withCloudRetention(
    {
      assetIds: [publicId],
      pilots: [cloudPilot(publicId)],
      calls: [cloudCall(publicId)],
    },
    async ({ cloud, updates }) => {
      const first = await cleanupExpiredCloudAudio({ now: NOW });
      assert.equal(first.deleted, 1);

      // The references are gone, so the second pass has nothing to consider, and
      // the asset is not touched again.
      const second = await cleanupExpiredCloudAudio({ now: NOW });
      assert.equal(second.scanned, 0);
      assert.equal(second.deleted, 0);
      assert.deepEqual(cloud.destroyed, [publicId]);
      assert.equal(updates.pilots.length, 1);

      // And if the references were never cleared, a repeat delete of an already
      // missing asset is still a success rather than an error.
      const third = await cleanupExpiredCloudAudio({ now: NOW });
      assert.equal(third.deleted, 0);
    },
  );
});

test("no supplier or customer data is written to the logs, on either outcome", async () => {
  const expired = oldAsset("rec-pii");
  const ordered = oldAsset("rec-pii-ordered");
  await withCloudRetention(
    {
      assetIds: [expired, ordered],
      pilots: [
        {
          ...cloudPilot(expired, { _id: "pilot-pii" }),
          caller: { raw: "+91 98765-43210", normalized: "9876543210" },
          customer: { matched: true, method: "exact-10-digit" },
        },
        cloudPilot(ordered, {
          _id: "pilot-pii-ordered",
          review: {
            status: "confirmed",
            confirmed: { orderCreated: true, orderId: "order-pii" },
          },
        }),
      ],
      calls: [
        {
          ...cloudCall(expired, { _id: "call-pii" }),
          from: { phoneNumber: "9876543210", name: "Anita Sharma" },
          to: { phoneNumber: "9811111111", name: "Ravi Kumar" },
        },
      ],
      orders: [{ phoneCallPilotId: "pilot-pii-ordered" }],
    },
    async ({ cloud }) => {
      // One asset expires, one is kept for its order, and one delete fails: all
      // three log lines are captured.
      cloud.failNextWith(new Error("upstream refused"));
      const logged = [];
      const originalError = console.error;
      const originalInfo = console.info;
      console.error = (...args) => logged.push(args.map(String).join(" "));
      console.info = (...args) => logged.push(args.map(String).join(" "));
      try {
        await cleanupExpiredCloudAudio({ now: NOW });
      } finally {
        console.error = originalError;
        console.info = originalInfo;
      }

      const output = logged.join("\n");
      assert.ok(output.length > 0, "the sweep reports what it did");
      for (const forbidden of [
        "9876543210",
        "98765-43210",
        "9811111111",
        "Anita",
        "Sharma",
        "Ravi",
        "Kumar",
        "CA-pii",
        "order-pii",
        "audio/",
      ]) {
        assert.equal(output.includes(forbidden), false, `no "${forbidden}"`);
      }
      // Counts and the opaque asset id are enough to act on.
      assert.equal(output.includes(expired), true);
    },
  );
});

test("a deletion failure never writes a url, a credential or a number to the logs", async () => {
  const publicId = oldAsset("rec-private");
  await withCloudRetention(
    {
      assetIds: [publicId],
      pilots: [cloudPilot(publicId)],
      calls: [cloudCall(publicId)],
    },
    async ({ cloud }) => {
      // An upstream error that quotes the request, the way a real SDK error can.
      cloud.failNextWith(
        new Error(
          "delete https://api.cloudinary.com/v1_1/test-cloud/video/authenticated" +
            "?signature=shh-secret&api_key=key-12345 failed for 9876543210",
        ),
      );

      const logged = [];
      const originalError = console.error;
      console.error = (...args) => logged.push(args.map(String).join(" "));
      try {
        await cleanupExpiredCloudAudio({ now: NOW });
      } finally {
        console.error = originalError;
      }

      const output = logged.join("\n");
      assert.ok(output.length > 0, "the failure is still reported");
      assert.equal(output.includes("https://"), false, "no url");
      assert.equal(output.includes("shh-secret"), false, "no signature");
      assert.equal(output.includes("key-12345"), false, "no key");
      assert.equal(output.includes("9876543210"), false, "no phone number");
      // The asset id is opaque random bytes, and without it the failure is not
      // diagnosable.
      assert.equal(output.includes(publicId), true);
    },
  );
});

test("legacy local recordings are still expired by the original policy", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "esetu-legacy-sweep-"));
  const previousDir = process.env.PILOT_AUDIO_DIR;
  const previousRetention = process.env.PILOT_AUDIO_RETENTION_DAYS;
  const previousCloud = [
    process.env.CLOUD_NAME,
    process.env.API_KEY,
    process.env.API_SECRET,
  ];
  const expiredPath = path.join(dir, "legacy-call.wav");
  const keptPath = path.join(dir, "ordered-call.wav");

  process.env.PILOT_AUDIO_DIR = dir;
  process.env.PILOT_AUDIO_RETENTION_DAYS = "1";
  process.env.CLOUD_NAME = "";
  process.env.API_KEY = "";
  process.env.API_SECRET = "";

  const originals = {
    pilotFind: PhoneCallPilot.find,
    callFind: PhoneCall.find,
    orderFind: Order.find,
    pilotUpdateMany: PhoneCallPilot.updateMany,
    callUpdateMany: PhoneCall.updateMany,
  };
  const cleared = [];
  PhoneCallPilot.find = () => ({
    select() {
      return this;
    },
    lean: async () => [
      { _id: PILOT_ID, audio: { fileName: "ordered-call.wav" } },
    ],
  });
  PhoneCall.find = () => ({
    select() {
      return this;
    },
    lean: async () => [],
  });
  Order.find = () => ({
    select() {
      return this;
    },
    lean: async () => [{ phoneCallPilotIds: [PILOT_ID] }],
  });
  PhoneCall.updateMany = async (filter, update) => {
    cleared.push({ filter, update });
    return { acknowledged: true };
  };
  PhoneCallPilot.updateMany = async (filter, update) => {
    cleared.push({ filter, update });
    return { acknowledged: true };
  };

  try {
    await fsp.writeFile(expiredPath, "legacy");
    await fsp.writeFile(keptPath, "legacy");
    const longAgo = new Date("2026-01-01T00:00:00Z");
    await fsp.utimes(expiredPath, longAgo, longAgo);
    await fsp.utimes(keptPath, longAgo, longAgo);

    // The expired file goes, the one an order depends on stays, and the
    // references to the removed file are cleared exactly as before.
    assert.equal(await cleanupExpiredPilotAudio(), 1);
    await assert.rejects(fsp.access(expiredPath));
    await fsp.access(keptPath);
    assert.equal(cleared.length, 2);
    assert.equal(
      cleared[1].update.$set["audio.fileName"],
      null,
      "the pilot reference is cleared",
    );
  } finally {
    PhoneCallPilot.find = originals.pilotFind;
    PhoneCall.find = originals.callFind;
    Order.find = originals.orderFind;
    PhoneCallPilot.updateMany = originals.pilotUpdateMany;
    PhoneCall.updateMany = originals.callUpdateMany;
    if (previousDir === undefined) delete process.env.PILOT_AUDIO_DIR;
    else process.env.PILOT_AUDIO_DIR = previousDir;
    if (previousRetention === undefined)
      delete process.env.PILOT_AUDIO_RETENTION_DAYS;
    else process.env.PILOT_AUDIO_RETENTION_DAYS = previousRetention;
    [process.env.CLOUD_NAME, process.env.API_KEY, process.env.API_SECRET] =
      previousCloud;
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
