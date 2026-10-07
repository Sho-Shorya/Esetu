import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

/*
 * Must be set before the router module is first imported: multer freezes its
 * file-size limit at import time, so every HTTP upload in this file runs with
 * an 8 KB cap — small enough to exceed with a fake file instead of 64 MB, but
 * still above the 0.2 s test WAV so normal uploads reach the controller.
 */
process.env.PILOT_MAX_AUDIO_BYTES = "8192";
process.env.JWT_SECRET ??= "phone-order-upload-test-secret";

const execFileAsync = promisify(execFile);

import express from "express";
import jwt from "jsonwebtoken";
import ffmpegPath from "ffmpeg-static";

import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import { Order } from "../models/orderModel.js";
import { User } from "../models/userModel.js";
import { cleanupExpiredPilotAudio } from "../services/pilotAudioRetentionService.js";
import {
  getAudioDigest,
  getMaxAudioBytes,
  saveAudioBuffer,
} from "../services/pilotAudioStorage.js";
import { validateManualAudio } from "../services/sttService.js";

const { default: phoneOrderRoutes } = await import(
  "../routes/phoneOrderRoutes.js"
);

/**
 * The supplier recording upload: the single entry point of the phone-order
 * flow, plus the order list behind the supplier's "बने हुए ऑर्डर" tab.
 *
 * The route stack is exercised over real HTTP so the auth middleware is part
 * of the test — a shopkeeper token and a missing token are refused before the
 * controller is ever reached. The database is faked at the model level, and
 * the pipeline launch is captured instead of run, so nothing here needs a
 * server, a database, or the network.
 */

const SUPPLIER_ID = "64b0000000000000000000b1";
const SHOPKEEPER_ID = "64b0000000000000000000c1";
const STRANGER_ID = "64b0000000000000000000e1";
const CALL_ID = "64b0000000000000000000d1";
const PILOT_ID = "64b0000000000000000000a1";

const usersById = {
  [SUPPLIER_ID]: {
    _id: SUPPLIER_ID,
    firstName: "Ramesh",
    lastName: "Wholesale",
    phoneNumber: "9811111111",
    role: "supplier",
    place: "Market",
  },
  [SHOPKEEPER_ID]: {
    _id: SHOPKEEPER_ID,
    firstName: "Suresh",
    lastName: "Kirana",
    phoneNumber: "9876543210",
    role: "user",
    place: "Village",
  },
};

/** One object that answers both `await q` and `q.select().lean()`. */
const chain = (value) => {
  const api = {
    select: () => api,
    sort: () => api,
    limit: () => api,
    populate: () => api,
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return api;
};

/** A real, decodable 16 kHz mono WAV (0.2 s), so validation runs for real. */
const makeWav = (seconds = 0.2) => {
  const samples = Buffer.alloc(Math.round(seconds * 16000) * 2);
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
};

const makeRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

const tokenFor = (userId) => jwt.sign({ id: userId }, process.env.JWT_SECRET);

const withTempAudioDir = async (run) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "esetu-upload-"));
  const previous = process.env.PILOT_AUDIO_DIR;
  process.env.PILOT_AUDIO_DIR = dir;
  try {
    return await run(dir);
  } finally {
    if (previous === undefined) delete process.env.PILOT_AUDIO_DIR;
    else process.env.PILOT_AUDIO_DIR = previous;
    await fsp.rm(dir, { recursive: true, force: true });
  }
};

const storedWavs = async (dir) =>
  (await fsp.readdir(dir, { recursive: true })).filter((name) =>
    String(name).endsWith(".wav"),
  );

/* ------------------------------ model fakes ------------------------------- */

const originals = {
  userFindById: User.findById,
  callFindOne: PhoneCall.findOne,
  callCreate: PhoneCall.create,
  callDeleteOne: PhoneCall.deleteOne,
  callFind: PhoneCall.find,
  callUpdateMany: PhoneCall.updateMany,
  pilotFindById: PhoneCallPilot.findById,
  pilotCreate: PhoneCallPilot.create,
  pilotFind: PhoneCallPilot.find,
  pilotUpdateMany: PhoneCallPilot.updateMany,
  orderFind: Order.find,
  setImmediate: globalThis.setImmediate,
};

const restoreModels = () => {
  User.findById = originals.userFindById;
  PhoneCall.findOne = originals.callFindOne;
  PhoneCall.create = originals.callCreate;
  PhoneCall.deleteOne = originals.callDeleteOne;
  PhoneCall.find = originals.callFind;
  PhoneCall.updateMany = originals.callUpdateMany;
  PhoneCallPilot.findById = originals.pilotFindById;
  PhoneCallPilot.create = originals.pilotCreate;
  PhoneCallPilot.find = originals.pilotFind;
  PhoneCallPilot.updateMany = originals.pilotUpdateMany;
  Order.find = originals.orderFind;
  globalThis.setImmediate = originals.setImmediate;
};

/**
 * Installs every model fake an upload needs and hands the test what it wants
 * to observe: created documents, captured pipeline launches, the duplicate the
 * caller claimed, and a way to make the pilot write fail.
 */
const withUploadFakes = async ({
  duplicateCall = null,
  duplicatePilot = null,
  failPilotCreateWith = null,
  run,
}) => {
  const createdCalls = [];
  const createdPilots = [];
  const scheduled = [];

  User.findById = (id) => chain(usersById[String(id)] || null);
  PhoneCall.findOne = () => chain(duplicateCall);
  PhoneCallPilot.findById = () => chain(duplicatePilot);
  PhoneCall.create = async (payload) => {
    createdCalls.push(payload);
    return { ...payload, _id: CALL_ID, async save() {} };
  };
  PhoneCallPilot.create = async (payload) => {
    if (failPilotCreateWith) throw failPilotCreateWith;
    createdPilots.push(payload);
    return { _id: PILOT_ID };
  };
  PhoneCall.deleteOne = async () => ({ acknowledged: true });
  /*
   * Only the pipeline launch itself is captured. Express/multer/fetch sprinkle
   * their own setImmediate callbacks around a multipart request, so every
   * other callback keeps running on the real scheduler.
   */
  const realSetImmediate = globalThis.setImmediate;
  globalThis.setImmediate = (callback, ...args) => {
    const source = Function.prototype.toString.call(callback);
    if (source.includes("runPilotPipeline")) {
      scheduled.push(callback);
      return 1;
    }
    return realSetImmediate.call(globalThis, callback, ...args);
  };

  try {
    return await run({ createdCalls, createdPilots, scheduled });
  } finally {
    restoreModels();
  };
};

/* ------------------------------ HTTP harness ------------------------------ */

const withServer = async (run) => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/phone-orders", phoneOrderRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}/api/v1/phone-orders`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
};

const uploadRequest = (
  base,
  { token, customerUserId, wav = makeWav(), fileName = "call.wav", type = "audio/wav" } = {},
) => {
  const form = new FormData();
  if (customerUserId !== undefined) {
    form.append("customerUserId", String(customerUserId));
  }
  form.append("audio", new Blob([wav], { type }), fileName);
  return fetch(`${base}/recording`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
};

/* ============================ accepted formats ============================ */

test(
  "manual audio accepts readable WAV, MP3, M4A, AAC and WebM recordings",
  { skip: !ffmpegPath },
  async () => {
    const dir = await fsp.mkdtemp(
      path.join(os.tmpdir(), "esetu-audio-formats-"),
    );
    const wavPath = path.join(dir, "recording.wav");
    const mp3Path = path.join(dir, "recording.mp3");
    const m4aPath = path.join(dir, "recording.m4a");
    const aacPath = path.join(dir, "recording.aac");
    const webmPath = path.join(dir, "recording.webm");
    const wav = makeWav();

    try {
      await fsp.writeFile(wavPath, wav);
      await execFileAsync(ffmpegPath, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        wavPath,
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "32k",
        mp3Path,
      ]);
      await execFileAsync(ffmpegPath, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        wavPath,
        "-c:a",
        "aac",
        m4aPath,
      ]);
      await execFileAsync(ffmpegPath, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        wavPath,
        "-c:a",
        "aac",
        "-f",
        "adts",
        aacPath,
      ]);
      // The browser's own recorder writes this exact kind of file.
      await execFileAsync(ffmpegPath, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        wavPath,
        "-c:a",
        "libopus",
        webmPath,
      ]);

      for (const [filePath, contentType] of [
        [wavPath, "audio/wav"],
        [mp3Path, "audio/mpeg"],
        [m4aPath, "audio/mp4"],
        [aacPath, "audio/aac"],
        [webmPath, "audio/webm"],
      ]) {
        const buffer = await fsp.readFile(filePath);
        await validateManualAudio({
          buffer,
          fileName: path.basename(filePath),
          contentType,
        });
      }
    } finally {
      await fsp.rm(dir, { recursive: true, force: true });
    }
  },
);

test("manual audio rejects unsupported types and unreadable audio", async () => {
  await assert.rejects(
    validateManualAudio({
      buffer: makeWav(),
      fileName: "call.ogg",
      contentType: "audio/ogg",
    }),
    { code: "AUDIO_FORMAT_UNSUPPORTED" },
  );
  await assert.rejects(
    validateManualAudio({
      buffer: makeWav(),
      fileName: "call.mp3",
      contentType: "application/pdf",
    }),
    { code: "AUDIO_MIME_UNSUPPORTED" },
  );
  await assert.rejects(
    validateManualAudio({
      buffer: Buffer.from("not audio"),
      fileName: "call.mp3",
      contentType: "audio/mpeg",
    }),
    { code: "AUDIO_UNREADABLE" },
  );
  await assert.rejects(
    validateManualAudio({
      buffer: Buffer.alloc(0),
      fileName: "call.wav",
      contentType: "audio/wav",
    }),
    { code: "AUDIO_EMPTY" },
  );
});

test("audio storage enforces its configured size limit and returns a SHA-256 digest", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "esetu-audio-store-"));
  const previousDir = process.env.PILOT_AUDIO_DIR;
  process.env.PILOT_AUDIO_DIR = dir;

  try {
    // The suite runs with an 8 KB cap (set before the router was imported).
    assert.equal(getMaxAudioBytes(), 8192);
    await assert.rejects(
      saveAudioBuffer({
        buffer: Buffer.alloc(getMaxAudioBytes() + 1),
        contentType: "audio/wav",
        originalName: "call.wav",
      }),
      { code: "AUDIO_TOO_LARGE" },
    );
    const buffer = makeWav();
    const saved = await saveAudioBuffer({
      buffer,
      contentType: "audio/wav",
      originalName: "call.wav",
    });
    assert.equal(saved.sha256, getAudioDigest(buffer));
    assert.equal(saved.contentType, "audio/wav");
  } finally {
    if (previousDir === undefined) delete process.env.PILOT_AUDIO_DIR;
    else process.env.PILOT_AUDIO_DIR = previousDir;
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

/* ============================== authentication ============================ */

test("an unauthenticated upload is refused before any file is read", async () => {
  await withServer(async (base) => {
    const response = await uploadRequest(base, {
      customerUserId: SHOPKEEPER_ID,
    });
    const body = await response.json();

    assert.equal(response.status, 400);
    assert.equal(body.success, false);
    assert.equal(body.message, "Authorization token is missing or invalid");
  });
});

test("a shopkeeper token cannot use the supplier upload endpoint", async () => {
  await withUploadFakes({
    async run({ createdCalls, createdPilots, scheduled }) {
      await withServer(async (base) => {
        const response = await uploadRequest(base, {
          token: tokenFor(SHOPKEEPER_ID),
          customerUserId: SHOPKEEPER_ID,
        });
        const body = await response.json();

        assert.equal(response.status, 403);
        assert.equal(body.success, false);
        assert.equal(createdCalls.length, 0);
        assert.equal(createdPilots.length, 0);
        assert.equal(scheduled.length, 0);
      });
    },
  });
});

/* ============================== the upload ================================ */

test("a supplier upload creates the call and pilot, stores the recording and starts the pipeline", async () => {
  await withTempAudioDir(async (dir) => {
    await withUploadFakes({
      async run({ createdCalls, createdPilots, scheduled }) {
        await withServer(async (base) => {
          const response = await uploadRequest(base, {
            token: tokenFor(SUPPLIER_ID),
            customerUserId: SHOPKEEPER_ID,
          });
          const body = await response.json();

          assert.equal(response.status, 202, JSON.stringify(body));
          assert.equal(body.success, true);
          assert.equal(body.stage, "transcribing");
          assert.equal(String(body.pilotCallId), PILOT_ID);
          assert.equal(String(body.callId), CALL_ID);
          assert.match(body.message, /अपलोड हो गई/);

          assert.equal(createdCalls.length, 1);
          const call = createdCalls[0];
          assert.equal(call.direction, "outgoing");
          assert.equal(call.status, "completed");
          assert.equal(call.processingStatus, "processing");
          assert.equal(String(call.supplierId), SUPPLIER_ID);
          assert.equal(String(call.initiatedBy), SUPPLIER_ID);
          assert.equal(call.initiatedByRole, "supplier");
          assert.equal(String(call.customerIdentifiedBy), SUPPLIER_ID);
          assert.equal(call.recording.capturedBy, "supplier");
          assert.ok(call.recording.sha256, "the digest is stored for dedupe");
          assert.ok(call.recording.fileName, "the bytes are stored");
          assert.ok(call.durationSeconds !== null);

          assert.equal(createdPilots.length, 1);
          const pilot = createdPilots[0];
          assert.equal(String(pilot.phoneCallId), CALL_ID);
          assert.equal(String(pilot.supplierId), SUPPLIER_ID);
          assert.equal(pilot.source, "live");
          assert.equal(pilot.audio.source, "upload");
          assert.equal(pilot.pipeline.stage, "transcribing");
          assert.ok(pilot.pipeline.recordingReadyAt, "the run token is set");
          assert.equal(pilot.customer.matched, true);
          assert.equal(String(pilot.customer.userId), SHOPKEEPER_ID);
          assert.equal(pilot.customer.method, "supplier-selected");
          assert.equal(pilot.caller.method, "supplier-selected");

          assert.equal(scheduled.length, 1, "the pipeline is launched once");
          assert.deepEqual(await storedWavs(dir).then((f) => f.length), 1);
        });
      },
    });
  });
});

test("an upload with no shopkeeper chosen is refused with a simple message", async () => {
  await withTempAudioDir(async (dir) => {
    await withUploadFakes({
      async run({ createdCalls, createdPilots, scheduled }) {
        await withServer(async (base) => {
          const response = await uploadRequest(base, {
            token: tokenFor(SUPPLIER_ID),
          });
          const body = await response.json();

          assert.equal(response.status, 400);
          assert.equal(body.code, "CUSTOMER_REQUIRED");
          assert.match(body.message, /दुकानदार/);
          assert.equal(createdCalls.length, 0);
          assert.equal(createdPilots.length, 0);
          assert.equal(scheduled.length, 0);
          assert.deepEqual(await storedWavs(dir), []);
        });
      },
    });
  });
});

test("a shopkeeper id that does not exist is refused", async () => {
  await withUploadFakes({
    async run({ createdPilots }) {
      await withServer(async (base) => {
        const response = await uploadRequest(base, {
          token: tokenFor(SUPPLIER_ID),
          customerUserId: STRANGER_ID,
        });
        const body = await response.json();

        assert.equal(response.status, 400);
        assert.equal(body.code, "CUSTOMER_NOT_FOUND");
        assert.equal(createdPilots.length, 0);
      });
    },
  });
});

test("an unreadable file is refused with no pilot and nothing left on disk", async () => {
  await withTempAudioDir(async (dir) => {
    await withUploadFakes({
      async run({ createdCalls, createdPilots, scheduled }) {
        await withServer(async (base) => {
          const response = await uploadRequest(base, {
            token: tokenFor(SUPPLIER_ID),
            customerUserId: SHOPKEEPER_ID,
            wav: Buffer.from("not an mp3"),
            fileName: "fake.mp3",
            type: "audio/mpeg",
          });
          const body = await response.json();

          assert.equal(response.status, 415, JSON.stringify(body));
          assert.equal(createdCalls.length, 0);
          assert.equal(createdPilots.length, 0);
          assert.equal(scheduled.length, 0);
          assert.deepEqual(await storedWavs(dir), []);
        });
      },
    });
  });
});

test("a file over the size limit is refused with a Hindi message", async () => {
  await withUploadFakes({
    async run({ createdPilots }) {
      await withServer(async (base) => {
        const oversized = Buffer.alloc(getMaxAudioBytes() + 1);
        const response = await uploadRequest(base, {
          token: tokenFor(SUPPLIER_ID),
          customerUserId: SHOPKEEPER_ID,
          wav: oversized,
        });
        const body = await response.json();

        assert.equal(response.status, 413, JSON.stringify(body));
        assert.equal(body.code, "AUDIO_TOO_LARGE");
        assert.match(body.message, /बहुत बड़ी/);
        assert.equal(createdPilots.length, 0);
      });
    },
  });
});

test("the same recording uploaded twice starts no second pipeline", async () => {
  const wav = makeWav();
  const digest = getAudioDigest(wav);

  await withUploadFakes({
    duplicateCall: {
      _id: "64b0000000000000000000d2",
      pilotCallId: { _id: PILOT_ID },
      recording: { sha256: digest, fileName: "first.wav" },
    },
    duplicatePilot: {
      _id: PILOT_ID,
      pipeline: { stage: "transcribing" },
      review: { confirmed: { orderCreated: false } },
    },
    async run({ createdCalls, createdPilots, scheduled }) {
      await withServer(async (base) => {
        const response = await uploadRequest(base, {
          token: tokenFor(SUPPLIER_ID),
          customerUserId: SHOPKEEPER_ID,
          wav,
        });
        const body = await response.json();

        assert.equal(response.status, 200, JSON.stringify(body));
        assert.equal(body.duplicate, true);
        assert.equal(String(body.pilotCallId), PILOT_ID);
        assert.match(body.message, /पहले से अपलोड/);
        assert.equal(createdCalls.length, 0, "no second call is created");
        assert.equal(createdPilots.length, 0, "no second pilot is created");
        assert.equal(scheduled.length, 0, "the pipeline is not started again");
      });
    },
  });
});

test("a failed database write leaves no orphaned recording behind", async () => {
  await withTempAudioDir(async (dir) => {
    const duplicate = new Error("duplicate key");
    duplicate.code = 11000;

    await withUploadFakes({
      failPilotCreateWith: duplicate,
      async run({ scheduled }) {
        await withServer(async (base) => {
          const response = await uploadRequest(base, {
            token: tokenFor(SUPPLIER_ID),
            customerUserId: SHOPKEEPER_ID,
          });
          const body = await response.json();

          assert.equal(response.status, 409, JSON.stringify(body));
          assert.equal(body.code, "DUPLICATE_AUDIO");
          assert.equal(scheduled.length, 0, "no pipeline starts");
          assert.deepEqual(
            await storedWavs(dir),
            [],
            "the bytes nothing points at are removed",
          );
        });
      },
    });
  });
});

/* ============================== the config ================================ */

test("the upload form can read its own limits from the server", async () => {
  User.findById = (id) => chain(usersById[String(id)] || null);
  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/config`, {
        headers: { Authorization: `Bearer ${tokenFor(SUPPLIER_ID)}` },
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.maxDurationSeconds, 600);
      assert.equal(body.maxAudioBytes, 8192);
      assert.deepEqual(body.formats, ["mp3", "m4a", "wav", "aac", "webm"]);
    });
  } finally {
    restoreModels();
  }
});

/* ============================ created orders ============================== */

test("the supplier sees the orders their recordings produced", async () => {
  const captured = [];
  const orders = [
    {
      _id: "64b0000000000000000000f1",
      status: "Pending",
      paymentStatus: null,
      totalAmount: 250,
      items: [{}, {}],
      createdAt: new Date("2026-10-01T10:00:00Z"),
      userId: {
        _id: SHOPKEEPER_ID,
        firstName: "Suresh",
        lastName: "Kirana",
        place: "Village",
      },
    },
  ];

  User.findById = (id) => chain(usersById[String(id)] || null);
  Order.find = (query) => {
    captured.push(query);
    const api = {
      sort: () => api,
      limit: () => api,
      select: () => api,
      populate: () => api,
      lean: async () => orders,
    };
    return api;
  };

  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/orders`, {
        headers: { Authorization: `Bearer ${tokenFor(SUPPLIER_ID)}` },
      });
      const body = await response.json();

      assert.equal(response.status, 200);
      assert.equal(body.count, 1);
      assert.equal(body.orders[0]._id, "64b0000000000000000000f1");
      assert.equal(body.orders[0].status, "Pending");
      assert.equal(body.orders[0].totalAmount, 250);
      assert.equal(body.orders[0].itemCount, 2);
      assert.equal(body.orders[0].customer.name, "Suresh Kirana");
      assert.equal(body.orders[0].customer.place, "Village");

      // Only this supplier's phone-made orders, never anyone else's.
      assert.equal(String(captured[0].supplierId), SUPPLIER_ID);
      assert.ok(captured[0].$or);
    });
  } finally {
    restoreModels();
  }
});

test("a shopkeeper cannot read the supplier order list", async () => {
  User.findById = (id) => chain(usersById[String(id)] || null);
  try {
    await withServer(async (base) => {
      const response = await fetch(`${base}/orders`, {
        headers: { Authorization: `Bearer ${tokenFor(SHOPKEEPER_ID)}` },
      });

      assert.equal(response.status, 403);
    });
  } finally {
    restoreModels();
  }
});

/* ======================= retention of ordered audio ======================= */

test("retention keeps audio linked to a completed real Order", async () => {
  const dir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "esetu-audio-order-retention-"),
  );
  const previousDir = process.env.PILOT_AUDIO_DIR;
  const previousRetention = process.env.PILOT_AUDIO_RETENTION_DAYS;
  const audioPath = path.join(dir, "ordered-call.wav");
  process.env.PILOT_AUDIO_DIR = dir;
  process.env.PILOT_AUDIO_RETENTION_DAYS = "1";

  PhoneCallPilot.find = () => chain([
    { _id: PILOT_ID, audio: { fileName: "ordered-call.wav" } },
  ]);
  PhoneCall.find = () => chain([]);
  Order.find = () => chain([{ phoneCallPilotIds: [PILOT_ID] }]);
  PhoneCall.updateMany = async () => ({ acknowledged: true });
  PhoneCallPilot.updateMany = async () => ({ acknowledged: true });

  try {
    await fsp.writeFile(audioPath, makeWav());
    await fsp.utimes(
      audioPath,
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-01-01T00:00:00Z"),
    );
    assert.equal(await cleanupExpiredPilotAudio(), 0);
    await fsp.access(audioPath);
  } finally {
    if (previousDir === undefined) delete process.env.PILOT_AUDIO_DIR;
    else process.env.PILOT_AUDIO_DIR = previousDir;
    if (previousRetention === undefined)
      delete process.env.PILOT_AUDIO_RETENTION_DAYS;
    else process.env.PILOT_AUDIO_RETENTION_DAYS = previousRetention;
    restoreModels();
    await fsp.rm(dir, { recursive: true, force: true });
  }
});
