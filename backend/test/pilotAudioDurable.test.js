import test from "node:test";
import assert from "node:assert/strict";
import fsp from "fs/promises";
import os from "os";
import path from "path";

import cloudinary from "../utils/cloudinary.js";
import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import {
  CLOUD_AUDIO_FOLDER,
  getAudioBackend,
  isCloudAudioConfigured,
  signedAudioUrl,
} from "../services/pilotAudioCloud.js";
import {
  audioExists,
  hasAudioRecord,
  materializeAudio,
  normalizeAudioRecord,
  removeAudio,
  saveAudioBuffer,
  storageColumns,
  withAudioFile,
} from "../services/pilotAudioStorage.js";
import {
  getPilotCall,
  retryPilotProcessing,
  streamPilotAudio,
} from "../controllers/phoneCallPilotController.js";
import { attachCallAudio } from "../controllers/phoneCallController.js";

/**
 * Durable recording storage.
 *
 * Every Cloudinary call and every network fetch is replaced here, so the suite
 * never uploads anything and never talks to the network. The fake Cloudinary
 * keeps a real in-memory asset table, which is what lets these tests prove the
 * thing that actually matters: that a recording written before a "restart" is
 * still readable after one, and that it is the same bytes.
 */

/** A real, decodable 16 kHz mono WAV, so the same validation runs as in production. */
const WAV = (() => {
  const samples = Buffer.alloc(3200);
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + samples.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(16000, 24);
  header.writeUInt32LE(32000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(samples.length, 40);
  return Buffer.concat([header, samples]);
})();

/* ------------------------------- fake cloudinary ---------------------------- */

const makeCloudinaryFake = () => {
  const assets = new Map();
  const calls = { uploadStream: [], destroy: [], url: [] };

  const failNextUploadWith = (error) => {
    calls.uploadError = error;
  };

  // Cloudinary reports the format it actually stored, which for a WAV upload is
  // wav. The fake reads it out of the bytes rather than being told.
  const formatOf = (buffer) =>
    buffer.subarray(0, 4).toString("ascii") === "RIFF" ? "wav" : "bin";

  cloudinary.uploader.upload_stream = (options, callback) => {
    calls.uploadStream.push(options);
    const chunks = [];
    const stream = {
      on: () => stream,
      end: (chunk) => {
        if (chunk) chunks.push(Buffer.from(chunk));

        if (calls.uploadError) {
          const error = calls.uploadError;
          calls.uploadError = null;
          callback(error, null);
          return;
        }

        const publicId = `${options.folder}/${options.public_id}`;
        const body = Buffer.concat(chunks);
        assets.set(publicId, body);

        callback(null, {
          public_id: publicId,
          format: formatOf(body),
          resource_type: options.resource_type,
          bytes: body.length,
        });
      },
    };
    return stream;
  };

  cloudinary.uploader.destroy = async (publicId, options) => {
    calls.destroy.push({ publicId, options });
    const existed = assets.delete(publicId);
    return { result: existed ? "ok" : "not found" };
  };

  cloudinary.url = (publicId, options) => {
    calls.url.push({ publicId, options });
    return (
      "https://res.cloudinary.com/test-cloud/image/authenticated/s--sig--/" +
      `${publicId}.${options.format || "wav"}`
    );
  };

  return { assets, calls, failNextUploadWith };
};

const makeFetchFake = ({ assets } = {}) => {
  const requests = [];
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (url) => {
    requests.push(String(url));
    // The signed URL addresses the asset by its id, so the asset is whatever
    // stored id the request path contains.
    const publicId = [...(assets?.keys() || [])].find((id) =>
      String(url).includes(id),
    );
    const body = publicId ? assets.get(publicId) : null;

    if (!body) {
      return {
        ok: false,
        status: 404,
        arrayBuffer: async () => new ArrayBuffer(0),
      };
    }

    return {
      ok: true,
      status: 200,
      arrayBuffer: async () =>
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };

  return {
    requests,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
};

/* --------------------------------- harness --------------------------------- */

const ENV_KEYS = [
  "PILOT_AUDIO_BACKEND",
  "PILOT_AUDIO_DIR",
  "PILOT_MAX_AUDIO_BYTES",
  "NODE_ENV",
  "CLOUD_NAME",
  "API_KEY",
  "API_SECRET",
];

const withEnv = async (values, run) => {
  const previous = {};
  for (const key of ENV_KEYS) {
    previous[key] = process.env[key];
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
  try {
    return await run();
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
};

/**
 * Runs a test as a production server with cloud credentials present and an
 * isolated audio directory, which is exactly the arrangement where a lost
 * recording costs a real order.
 */
const withDurableStorage = async (run) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "esetu-durable-"));
  const cloud = makeCloudinaryFake();
  const fetches = makeFetchFake({ assets: cloud.assets });

  try {
    return await withEnv(
      {
        PILOT_AUDIO_BACKEND: "cloud",
        PILOT_AUDIO_DIR: dir,
        NODE_ENV: "production",
        CLOUD_NAME: "test-cloud",
        API_KEY: "test-key",
        API_SECRET: "test-secret",
      },
      async () => run({ dir, cloud, fetches }),
    );
  } finally {
    fetches.restore();
    await fsp.rm(dir, { recursive: true, force: true });
  }
};

const withLocalStorage = async (run) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "esetu-local-"));
  const previousBackend = process.env.PILOT_AUDIO_BACKEND;
  process.env.PILOT_AUDIO_BACKEND = "local";
  process.env.PILOT_AUDIO_DIR = dir;

  try {
    return await run({ dir });
  } finally {
    if (previousBackend === undefined) delete process.env.PILOT_AUDIO_BACKEND;
    else process.env.PILOT_AUDIO_BACKEND = previousBackend;
    const previousDir = process.env.PILOT_AUDIO_DIR;
    if (previousDir === undefined) delete process.env.PILOT_AUDIO_DIR;
    else process.env.PILOT_AUDIO_DIR = previousDir;
    await fsp.rm(dir, { recursive: true, force: true });
  }
};

const makeRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

/* ====================== backend selection and configuration ================= */

test("durable storage is used in production and stays out of the way elsewhere", async () => {
  await withEnv(
    {
      NODE_ENV: "production",
      CLOUD_NAME: "c",
      API_KEY: "k",
      API_SECRET: "s",
      PILOT_AUDIO_BACKEND: undefined,
    },
    () => {
      assert.equal(getAudioBackend(), "cloud");
    },
  );

  await withEnv(
    {
      NODE_ENV: "test",
      CLOUD_NAME: "c",
      API_KEY: "k",
      API_SECRET: "s",
      PILOT_AUDIO_BACKEND: undefined,
    },
    () => {
      // A developer machine or a CI run has the same credentials as production.
      // It must not start writing real call audio into the live account.
      assert.equal(getAudioBackend(), "local");
    },
  );

  await withEnv(
    {
      NODE_ENV: "production",
      CLOUD_NAME: "c",
      API_KEY: "k",
      API_SECRET: undefined,
      PILOT_AUDIO_BACKEND: undefined,
    },
    () => {
      assert.equal(isCloudAudioConfigured(), false);
      assert.equal(getAudioBackend(), "local");
    },
  );

  await withEnv(
    {
      NODE_ENV: "production",
      CLOUD_NAME: "c",
      API_KEY: "k",
      API_SECRET: "s",
      PILOT_AUDIO_BACKEND: "local",
    },
    () => {
      assert.equal(getAudioBackend(), "local");
    },
  );
});

/* ============================== durable upload ============================== */

test("a recording is uploaded to durable storage in a dedicated folder, privately", async () => {
  await withDurableStorage(async ({ cloud }) => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    assert.equal(saved.storage, "cloud");
    assert.equal(saved.fileName, null, "no local file is relied on");
    assert.ok(saved.publicId, "the asset id is recorded for later retrieval");
    assert.ok(
      saved.publicId.startsWith(`${CLOUD_AUDIO_FOLDER}/`),
      `expected a dedicated folder, got ${saved.publicId}`,
    );
    assert.equal(saved.format, "wav", "the original format is preserved");
    assert.equal(saved.bytes, WAV.length);
    assert.ok(cloud.assets.has(saved.publicId), "the bytes are in storage");

    const [options] = cloud.calls.uploadStream;
    assert.equal(options.type, "authenticated", "not publicly deliverable");
    assert.equal(options.resource_type, "video", "audio lives in this namespace");
    assert.equal(options.folder, CLOUD_AUDIO_FOLDER);
    assert.equal(options.overwrite, false);
    assert.equal(
      options.format,
      undefined,
      "no format is imposed, so the upload is not re-encoded",
    );
  });
});

test("the stored asset name discloses nothing about the supplier or customer", async () => {
  await withDurableStorage(async ({ cloud }) => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "9811111111-asha-rai.wav",
      prefix: "9811111111-asha-rai",
    });

    const publicId = saved.publicId;
    assert.doesNotMatch(publicId, /9811111111/);
    assert.doesNotMatch(publicId, /asha/i);
    assert.doesNotMatch(publicId, /rai/i);
    assert.doesNotMatch(publicId, /call\.wav$/i);
    assert.match(publicId, /^[a-z0-9/_-]+$/i, "opaque characters only");
    assert.equal(
      cloud.calls.uploadStream[0].public_id.includes("9811"),
      false,
      "the caller-supplied prefix is not used for the asset name",
    );
  });
});

test("a failed durable upload is reported and nothing pretends it was stored", async () => {
  await withDurableStorage(async ({ cloud }) => {
    cloud.failNextUploadWith(new Error("connection reset"));

    await assert.rejects(
      saveAudioBuffer({
        buffer: WAV,
        contentType: "audio/wav",
        originalName: "call.wav",
        prefix: "call",
      }),
      { code: "AUDIO_CLOUD_UPLOAD_FAILED" },
    );

    assert.equal(cloud.assets.size, 0, "no half-written asset is left behind");
  });
});

test("audio is still validated before anything leaves the server", async () => {
  await withDurableStorage(async ({ cloud }) => {
    await assert.rejects(
      saveAudioBuffer({ buffer: Buffer.alloc(0), contentType: "audio/wav" }),
      /empty/,
    );
    await assert.rejects(
      saveAudioBuffer({
        buffer: Buffer.from("not audio at all"),
        contentType: "text/plain",
      }),
      { code: "AUDIO_TYPE_UNSUPPORTED" },
    );

    assert.equal(cloud.assets.size, 0, "invalid input never reaches storage");
  });
});

/* ============================== durable read-back ============================ */

test("the pipeline reads a durable recording and gets the original bytes back", async () => {
  await withDurableStorage(async ({ cloud, fetches }) => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    let read = null;
    await withAudioFile(saved, async (handle) => {
      read = {
        bytes: await fsp.readFile(handle.filePath),
        fileName: handle.fileName,
        temporary: handle.temporary,
      };
    });

    assert.deepEqual(read.bytes, WAV, "byte-for-byte the uploaded recording");
    assert.match(
      read.fileName,
      /\.wav$/,
      "the working copy keeps the format so the transcoder reads it correctly",
    );
    assert.equal(read.temporary, true);
    assert.deepEqual(
      await fsp.readdir(path.join(process.env.PILOT_AUDIO_DIR, "tmp")),
      [],
      "the working copy is removed once transcription is done",
    );
    assert.equal(fetches.requests.length, 1);
    assert.equal(cloud.assets.size, 1, "the stored recording is left in place");
  });
});

test("the working copy is removed even when transcription throws", async () => {
  await withDurableStorage(async () => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    await assert.rejects(
      withAudioFile(saved, async () => {
        throw new Error("transcription failed");
      }),
      /transcription failed/,
    );

    const leftovers = await fsp
      .readdir(path.join(process.env.PILOT_AUDIO_DIR, "tmp"))
      .catch(() => []);
    assert.deepEqual(leftovers, [], "no working copy is left behind");
  });
});

test("a signed url is required, so a durable recording has no public address", async () => {
  await withDurableStorage(async ({ cloud }) => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    const url = signedAudioUrl({
      publicId: saved.publicId,
      format: saved.format,
    });

    const [{ publicId, options }] = cloud.calls.url;
    assert.equal(publicId, saved.publicId);
    assert.equal(options.type, "authenticated");
    assert.equal(options.sign_url, true, "the request is signed server-side");
    assert.equal(options.secure, true);
    assert.match(url, /^https:\/\//);
  });
});

/* ============================== retry durability ============================ */

const withRetryFakes = async ({ doc, call, run }) => {
  const originals = {
    pilotFindById: PhoneCallPilot.findById,
    pilotFindOneAndUpdate: PhoneCallPilot.findOneAndUpdate,
    callFindOne: PhoneCall.findOne,
    callFindById: PhoneCall.findById,
    setImmediate: globalThis.setImmediate,
  };
  const scheduled = [];

  PhoneCallPilot.findById = () => ({ select: async () => doc });
  PhoneCallPilot.findOneAndUpdate = async () => doc;
  PhoneCall.findOne = () => ({ select: async () => call });
  PhoneCall.findById = async () => call;
  globalThis.setImmediate = (callback) => {
    scheduled.push(callback);
    return 1;
  };

  try {
    return await run({ scheduled });
  } finally {
    PhoneCallPilot.findById = originals.pilotFindById;
    PhoneCallPilot.findOneAndUpdate = originals.pilotFindOneAndUpdate;
    PhoneCall.findOne = originals.callFindOne;
    PhoneCall.findById = originals.callFindById;
    globalThis.setImmediate = originals.setImmediate;
  }
};

test("a failed durable recording can be retried on a server that never had the file", async () => {
  await withDurableStorage(async ({ cloud, dir }) => {
    // The recording was taken and stored durably, then transcription failed.
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    // A "restart": a brand new server with an empty disk, holding only the
    // database document. The asset is in cloud storage and nowhere else.
    const doc = {
      _id: "pilot-1",
      supplierId: "supplier-1",
      source: "live",
      phoneCallId: "call-1",
      audio: {
        ...storageColumns(saved),
        source: "call-upload",
      },
      pipeline: { stage: "failed", error: { message: "sarvam timeout" } },
      review: { status: "not_started", confirmed: null },
    };

    assert.deepEqual(
      (await fsp.readdir(dir)).filter((name) => name !== "tmp"),
      [],
      "this server holds no local copy at all, exactly as after a redeploy",
    );

    const res = makeRes();
    await withRetryFakes({
      doc,
      call: { processingStatus: "failed", save: async () => {} },
      async run({ scheduled }) {
        await retryPilotProcessing(
          { params: { id: "pilot-1" }, userId: "supplier-1" },
          res,
        );

        assert.equal(res.statusCode, 202, "the retry is accepted");
        assert.equal(res.body.success, true);
        assert.equal(scheduled.length, 1, "the pipeline runs again");
      },
    });

    // And the audio the retry will transcribe is still there, byte for byte.
    const handle = await materializeAudio(doc.audio);
    assert.deepEqual(await fsp.readFile(handle.filePath), WAV);
    await handle.cleanup();
    assert.equal(cloud.assets.size, 1, "a failed run never deletes the recording");
  });
});

test("a retry with no recording at all is refused", async () => {
  await withDurableStorage(async () => {
    const doc = {
      _id: "pilot-1",
      supplierId: "supplier-1",
      audio: { fileName: null, publicId: null, storage: null },
      pipeline: { stage: "failed" },
      review: { status: "not_started", confirmed: null },
    };

    const res = makeRes();
    await withRetryFakes({
      doc,
      call: null,
      async run({ scheduled }) {
        await retryPilotProcessing(
          { params: { id: "pilot-1" }, userId: "supplier-1" },
          res,
        );

        assert.equal(res.statusCode, 409);
        assert.equal(res.body.code, "NO_RECORDING");
        assert.equal(scheduled.length, 0);
      },
    });
  });
});

test("a call that already produced an order cannot be retried", async () => {
  await withDurableStorage(async () => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    const doc = {
      _id: "pilot-1",
      supplierId: "supplier-1",
      audio: storageColumns(saved),
      pipeline: { stage: "failed" },
      review: {
        status: "confirmed",
        confirmed: { orderCreated: true, orderId: "order-1" },
      },
    };

    const res = makeRes();
    await withRetryFakes({
      doc,
      call: null,
      async run({ scheduled }) {
        await retryPilotProcessing(
          { params: { id: "pilot-1" }, userId: "supplier-1" },
          res,
        );

        assert.equal(res.statusCode, 409);
        assert.equal(res.body.code, "ORDER_ALREADY_CREATED");
        assert.equal(
          scheduled.length,
          0,
          "retry never re-runs the pipeline for a call that is already ordered",
        );
      },
    });
  });
});

test("another supplier cannot retry or play a durable recording", async () => {
  await withDurableStorage(async ({ cloud }) => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    const doc = {
      _id: "pilot-1",
      supplierId: "supplier-1",
      phoneCallId: "call-1",
      audio: storageColumns(saved),
      pipeline: { stage: "failed" },
      review: { status: "not_started", confirmed: null },
    };

    const retryRes = makeRes();
    await withRetryFakes({
      doc,
      call: null,
      async run({ scheduled }) {
        await retryPilotProcessing(
          { params: { id: "pilot-1" }, userId: "supplier-2" },
          retryRes,
        );

        assert.equal(retryRes.statusCode, 404, "not their call to retry");
        assert.equal(scheduled.length, 0);
      },
    });

    const playRes = makeRes();
    const originals = {
      findById: PhoneCallPilot.findById,
      callFindOne: PhoneCall.findOne,
    };
    PhoneCallPilot.findById = () => ({ select: async () => doc });
    // The ownership check goes through the linked call, and no call of theirs
    // matches this pilot record.
    PhoneCall.findOne = () => ({ select: async () => null });
    try {
      await streamPilotAudio(
        { params: { id: "pilot-1" }, userId: "supplier-2" },
        playRes,
      );
      assert.equal(playRes.statusCode, 404, "not their recording to play");
    } finally {
      PhoneCallPilot.findById = originals.findById;
      PhoneCall.findOne = originals.callFindOne;
    }

    assert.equal(cloud.assets.size, 1, "nothing was fetched or destroyed");
  });
});

test("a durable recording is reported as playable, without exposing where it lives", async () => {
  await withDurableStorage(async () => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    const doc = {
      _id: "pilot-1",
      supplierId: "supplier-1",
      phoneCallId: "call-1",
      source: "provider",
      status: "completed",
      caller: { normalized: "9876543210" },
      audio: storageColumns(saved),
      pipeline: { stage: "done" },
      stt: { status: "completed", transcript: "bhai do kilo namak" },
      review: { status: "not_started", confirmed: null },
    };

    const originals = {
      findById: PhoneCallPilot.findById,
      callFindOne: PhoneCall.findOne,
    };
    PhoneCallPilot.findById = async () => doc;
    PhoneCall.findOne = () => ({ select: async () => ({ _id: "call-1" }) });

    const res = makeRes();
    try {
      await getPilotCall({ params: { id: "pilot-1" }, userId: "supplier-1" }, res);

      assert.equal(res.statusCode, 200);
      // No local file name exists for this recording, so availability has to
      // come from the stored record or the supplier would be told there is no
      // audio to play.
      assert.equal(res.body.call.audio.available, true);
      assert.equal(
        res.body.call.audio.endpoint,
        "/api/v1/pilot/phone-call/pilot-1/audio",
      );
      assert.equal(res.body.call.audio.bytes, WAV.length);
    } finally {
      PhoneCallPilot.findById = originals.findById;
      PhoneCall.findOne = originals.callFindOne;
    }

    // The only way to reach the audio is the authenticated endpoint: no asset
    // name, folder, or storage kind crosses the API.
    const payload = JSON.stringify(res.body);
    assert.equal(payload.includes("publicId"), false);
    assert.equal(payload.includes(CLOUD_AUDIO_FOLDER), false);
    assert.equal(payload.includes("cloud"), false);
  });
});

/* ============================ backward compatibility ======================== */

test("a recording stored before durable storage still plays and retries", async () => {
  await withLocalStorage(async ({ dir }) => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    assert.equal(saved.storage, "local");
    assert.ok(saved.fileName);
    assert.equal(saved.publicId, null);

    // A document written before the move: no storage, no publicId, just the
    // file name that has always been there.
    const legacy = { fileName: saved.fileName };
    assert.equal(hasAudioRecord(legacy), true);
    assert.equal(audioExists(legacy), true);

    const handle = await materializeAudio(legacy);
    assert.deepEqual(await fsp.readFile(handle.filePath), WAV);
    assert.equal(handle.temporary, false, "a local file is used where it lies");

    const res = makeRes();
    await withRetryFakes({
      doc: {
        _id: "pilot-1",
        supplierId: "supplier-1",
        audio: legacy,
        pipeline: { stage: "failed" },
        review: { status: "not_started", confirmed: null },
      },
      call: null,
      async run({ scheduled }) {
        await retryPilotProcessing(
          { params: { id: "pilot-1" }, userId: "supplier-1" },
          res,
        );
        assert.equal(res.statusCode, 202);
        assert.equal(scheduled.length, 1);
      },
    });

    assert.deepEqual(
      (await fsp.readdir(dir)).filter((name) => name !== "tmp"),
      [saved.fileName],
      "the old file is left exactly where it was",
    );
  });
});

test("a bare file name is still accepted as a storage reference", () => {
  assert.deepEqual(normalizeAudioRecord("call-1.wav"), {
    storage: "local",
    fileName: "call-1.wav",
    publicId: null,
  });
  assert.equal(normalizeAudioRecord(null), null);
  assert.equal(normalizeAudioRecord({}), null);
  assert.equal(hasAudioRecord(undefined), false);

  // A cloud record with a stale file name still resolves to the durable copy.
  assert.deepEqual(
    normalizeAudioRecord({
      storage: "local",
      fileName: "call-1.wav",
      publicId: "esetu/phone-calls/call-1",
      format: "wav",
    }),
    { storage: "cloud", publicId: "esetu/phone-calls/call-1", format: "wav", fileName: null },
  );
});

test("a missing local file is reported rather than read as empty audio", async () => {
  await withLocalStorage(async () => {
    await assert.rejects(
      materializeAudio({ fileName: "gone.wav" }),
      { code: "AUDIO_FILE_MISSING" },
    );
    assert.equal(audioExists({ fileName: "gone.wav" }), false);
  });
});

/* ================================= deletion ================================= */

test("removing a recording deletes it from whichever backend holds it", async () => {
  await withDurableStorage(async ({ cloud }) => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    assert.equal(cloud.assets.size, 1);
    assert.equal(await removeAudio(saved), true);
    assert.equal(cloud.assets.size, 0);
    assert.equal(cloud.calls.destroy[0].options.resource_type, "video");
    assert.equal(cloud.calls.destroy[0].options.invalidate, true);
  });

  await withLocalStorage(async () => {
    const saved = await saveAudioBuffer({
      buffer: WAV,
      contentType: "audio/wav",
      originalName: "call.wav",
      prefix: "call",
    });

    assert.equal(await removeAudio(saved.fileName), true, "legacy string form");
    assert.equal(audioExists(saved), false);
  });
});

/* ====================== upload path: no orphaned assets ===================== */

test("a failed database write does not leave an orphaned durable asset", async () => {
  await withDurableStorage(async ({ cloud }) => {
    const originals = {
      callFindById: PhoneCall.findById,
      pilotCreate: PhoneCallPilot.create,
      pilotFindById: PhoneCallPilot.findById,
      callFindOne: PhoneCall.findOne,
      setImmediate: globalThis.setImmediate,
    };

    const call = {
      _id: "call-1",
      supplierId: "supplier-1",
      initiatedByRole: "supplier",
      recording: null,
      pilotCallId: null,
      processingStatus: "no_audio",
      lastError: null,
      async save() {},
    };

    PhoneCall.findById = async () => call;
    PhoneCall.findOne = () => ({ select: async () => null });
    PhoneCallPilot.findById = () => ({ select: async () => null });
    // The upload succeeded, then the database refused the write.
    PhoneCallPilot.create = async () => {
      const error = new Error("duplicate key");
      error.code = 11000;
      throw error;
    };
    globalThis.setImmediate = () => 1;

    const res = makeRes();
    try {
      await attachCallAudio(
        {
          params: { id: "call-1" },
          userId: "supplier-1",
          file: {
            buffer: WAV,
            originalname: "call.wav",
            mimetype: "audio/wav",
          },
        },
        res,
      );
    } finally {
      PhoneCall.findById = originals.callFindById;
      PhoneCall.findOne = originals.callFindOne;
      PhoneCallPilot.create = originals.pilotCreate;
      PhoneCallPilot.findById = originals.pilotFindById;
      globalThis.setImmediate = originals.setImmediate;
    }

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.success, false);
    assert.equal(
      cloud.assets.size,
      0,
      "the asset nothing points at is cleaned up",
    );
  });
});

test("a durable upload that fails returns a clear error and starts no processing", async () => {  await withDurableStorage(async ({ cloud }) => {
    const originals = {
      callFindById: PhoneCall.findById,
      callFindOne: PhoneCall.findOne,
      pilotFindById: PhoneCallPilot.findById,
      setImmediate: globalThis.setImmediate,
    };

    let pipelineStarted = false;
    const call = {
      _id: "call-1",
      supplierId: "supplier-1",
      initiatedByRole: "supplier",
      recording: null,
      pilotCallId: null,
      processingStatus: "no_audio",
      lastError: null,
      async save() {},
    };

    PhoneCall.findById = async () => call;
    PhoneCall.findOne = () => ({ select: async () => null });
    PhoneCallPilot.findById = () => ({ select: async () => null });
    globalThis.setImmediate = () => {
      pipelineStarted = true;
      return 1;
    };

    cloud.failNextUploadWith(new Error("cloudinary is down"));

    const res = makeRes();
    try {
      await attachCallAudio(
        {
          params: { id: "call-1" },
          userId: "supplier-1",
          file: {
            buffer: WAV,
            originalname: "call.wav",
            mimetype: "audio/wav",
          },
        },
        res,
      );
    } finally {
      PhoneCall.findById = originals.callFindById;
      PhoneCall.findOne = originals.callFindOne;
      PhoneCallPilot.findById = originals.pilotFindById;
      globalThis.setImmediate = originals.setImmediate;
    }

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, "AUDIO_CLOUD_UPLOAD_FAILED");
    assert.match(res.body.message, /सेव नहीं हो पाई/);
    assert.equal(
      pipelineStarted,
      false,
      "processing is not started when the recording was never stored",
    );
    assert.equal(call.processingStatus, "no_audio", "the call is untouched");
  });
});
