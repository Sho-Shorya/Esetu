import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/*
 * The 10 minute recording limit, checked at the only place it can be enforced
 * honestly: the upload controller itself, after the file's real length has
 * been established and before anything is stored.
 *
 * This file deliberately keeps the default 64 MB size cap (the other upload
 * test file shrinks it to make oversize testable), because a 10 minute WAV is
 * ~19 MB and must pass the size check to reach the duration check.
 */

import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import { User } from "../models/userModel.js";
import {
  MAX_RECORDING_SECONDS,
  uploadRecording,
} from "../controllers/phoneOrderController.js";
import { getMaxAudioBytes } from "../services/pilotAudioStorage.js";
import { probeAudioDurationSeconds } from "../services/sttService.js";

const SUPPLIER_ID = "64b0000000000000000000b1";
const SHOPKEEPER_ID = "64b0000000000000000000c1";
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

const chain = (value) => {
  const api = {
    select: () => api,
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return api;
};

/** A 16 kHz mono 16-bit WAV of exactly `seconds`, so the length is exact. */
const makeWav = (seconds) => {
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

const originals = {
  userFindById: User.findById,
  callFindOne: PhoneCall.findOne,
  callCreate: PhoneCall.create,
  callDeleteOne: PhoneCall.deleteOne,
  pilotCreate: PhoneCallPilot.create,
  setImmediate: globalThis.setImmediate,
};

const restoreModels = () => {
  User.findById = originals.userFindById;
  PhoneCall.findOne = originals.callFindOne;
  PhoneCall.create = originals.callCreate;
  PhoneCall.deleteOne = originals.callDeleteOne;
  PhoneCallPilot.create = originals.pilotCreate;
  globalThis.setImmediate = originals.setImmediate;
};

const withUploadFakes = async (run) => {
  const createdCalls = [];
  const createdPilots = [];
  const scheduled = [];

  User.findById = (id) => chain(usersById[String(id)] || null);
  PhoneCall.findOne = () => chain(null);
  PhoneCall.create = async (payload) => {
    createdCalls.push(payload);
    return { ...payload, _id: CALL_ID, async save() {} };
  };
  PhoneCallPilot.create = async (payload) => {
    createdPilots.push(payload);
    return { _id: PILOT_ID };
  };
  PhoneCall.deleteOne = async () => ({ acknowledged: true });
  globalThis.setImmediate = (callback) => {
    scheduled.push(callback);
    return 1;
  };

  try {
    return await run({ createdCalls, createdPilots, scheduled });
  } finally {
    restoreModels();
  };
};

const withTempAudioDir = async (run) => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "esetu-duration-"));
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

const uploadWith = (wav) => ({
  userId: SUPPLIER_ID,
  body: { customerUserId: SHOPKEEPER_ID },
  file: { buffer: wav, originalname: "order-call.wav", mimetype: "audio/wav" },
});

test("the duration limit is ten minutes, and the byte cap leaves room for it", () => {
  assert.equal(MAX_RECORDING_SECONDS, 600);
  assert.ok(
    getMaxAudioBytes() > 600 * 32000,
    "the default 64 MB cap must not reject a ten minute WAV before the duration check",
  );
});

test("a recording of exactly ten minutes is accepted", async () => {
  const wav = makeWav(MAX_RECORDING_SECONDS);

  await withTempAudioDir(async (dir) => {
    await withUploadFakes(async ({ createdCalls, createdPilots, scheduled }) => {
      const res = makeRes();
      await uploadRecording(uploadWith(wav), res);

      assert.equal(res.statusCode, 202, JSON.stringify(res.body));
      assert.equal(res.body.durationSeconds, 600);
      assert.equal(res.body.stage, "transcribing");
      assert.equal(createdPilots.length, 1);
      assert.equal(createdCalls.length, 1);
      assert.equal(scheduled.length, 1);
      assert.equal((await fsp.readdir(dir)).filter((n) => n.endsWith(".wav")).length, 1);
    });
  });
});

test("a recording of ten minutes and one second is refused, before anything is stored", async () => {
  const wav = makeWav(MAX_RECORDING_SECONDS + 1);

  await withTempAudioDir(async (dir) => {
    await withUploadFakes(async ({ createdCalls, createdPilots, scheduled }) => {
      const res = makeRes();
      await uploadRecording(uploadWith(wav), res);

      assert.equal(res.statusCode, 413, JSON.stringify(res.body));
      assert.equal(res.body.code, "AUDIO_TOO_LONG");
      assert.match(res.body.message, /10 मिनट/);
      assert.equal(createdCalls.length, 0, "no call is written");
      assert.equal(createdPilots.length, 0, "no pilot is written");
      assert.equal(scheduled.length, 0, "the pipeline never starts");
      assert.deepEqual(
        (await fsp.readdir(dir)).filter((n) => n.endsWith(".wav")),
        [],
        "nothing is stored for a refused recording",
      );
    });
  });
});

test("the probe reads the length from the WAV header without ffmpeg", async () => {
  assert.equal(await probeAudioDurationSeconds({ buffer: makeWav(2) }), 2);
  assert.equal(
    await probeAudioDurationSeconds({
      buffer: Buffer.from("definitely not audio"),
      fileName: "junk.mp3",
    }),
    null,
    "an unreadable file reports no length instead of guessing",
  );
});
