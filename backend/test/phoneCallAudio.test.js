import test from "node:test";
import assert from "node:assert/strict";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";
import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import { Order } from "../models/orderModel.js";
import { attachCallAudio } from "../controllers/phoneCallController.js";
import { cleanupExpiredPilotAudio } from "../services/pilotAudioRetentionService.js";
import {
  getAudioDigest,
  getMaxAudioBytes,
  saveAudioBuffer,
} from "../services/pilotAudioStorage.js";
import { validateManualAudio } from "../services/sttService.js";

const execFileAsync = promisify(execFile);
const USER_ID = "64b0000000000000000000c1";
const OTHER_USER_ID = "64b0000000000000000000c2";
const SUPPLIER_ID = "64b0000000000000000000b1";
const CALL_ID = "64b0000000000000000000d1";
const PILOT_ID = "64b0000000000000000000a1";

const makeWav = () => {
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
};

const makeQuery = (value) => ({
  select() {
    return this;
  },
  then(resolve, reject) {
    return Promise.resolve(value).then(resolve, reject);
  },
});

const makeResponse = () => ({
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

const makeCall = (overrides = {}) => ({
  _id: CALL_ID,
  supplierId: SUPPLIER_ID,
  initiatedBy: USER_ID,
  from: {
    matched: false,
    userId: null,
    phoneNumber: null,
    matchMethod: null,
  },
  to: {
    matched: true,
    userId: SUPPLIER_ID,
    name: "Supplier",
    phoneNumber: "9811111111",
  },
  recording: {},
  pilotCallId: null,
  processingStatus: "no_audio",
  saves: 0,
  async save() {
    this.saves += 1;
    return this;
  },
  ...overrides,
});

const originals = {
  callFindById: PhoneCall.findById,
  callFindOne: PhoneCall.findOne,
  pilotFindById: PhoneCallPilot.findById,
  pilotFind: PhoneCallPilot.find,
  pilotCreate: PhoneCallPilot.create,
  pilotUpdateOne: PhoneCallPilot.updateOne,
  orderFind: Order.find,
  callUpdateMany: PhoneCall.updateMany,
  pilotUpdateMany: PhoneCallPilot.updateMany,
  setImmediate: globalThis.setImmediate,
};

const restoreModels = () => {
  PhoneCall.findById = originals.callFindById;
  PhoneCall.findOne = originals.callFindOne;
  PhoneCallPilot.findById = originals.pilotFindById;
  PhoneCallPilot.find = originals.pilotFind;
  PhoneCallPilot.create = originals.pilotCreate;
  PhoneCallPilot.updateOne = originals.pilotUpdateOne;
  PhoneCall.updateMany = originals.callUpdateMany;
  PhoneCallPilot.updateMany = originals.pilotUpdateMany;
  Order.find = originals.orderFind;
  globalThis.setImmediate = originals.setImmediate;
};

const withUploadFakes = async ({
  call,
  duplicateCall = null,
  pilot = null,
  run,
}) => {
  const createdPilots = [];
  const scheduled = [];
  PhoneCall.findById = async () => call;
  PhoneCall.findOne = () => makeQuery(duplicateCall);
  PhoneCallPilot.findById = () => makeQuery(pilot);
  PhoneCallPilot.create = async (payload) => {
    createdPilots.push(payload);
    return { _id: PILOT_ID };
  };
  PhoneCallPilot.updateOne = async () => ({ acknowledged: true });
  globalThis.setImmediate = (callback) => {
    scheduled.push(callback);
    return 1;
  };

  try {
    return await run({ createdPilots, scheduled });
  } finally {
    restoreModels();
  }
};

test(
  "manual audio accepts readable WAV, MP3, and M4A recordings",
  { skip: !ffmpegPath },
  async () => {
    const dir = await fsp.mkdtemp(
      path.join(os.tmpdir(), "esetu-audio-formats-"),
    );
    const wavPath = path.join(dir, "recording.wav");
    const mp3Path = path.join(dir, "recording.mp3");
    const m4aPath = path.join(dir, "recording.m4a");
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

      for (const [filePath, contentType] of [
        [wavPath, "audio/wav"],
        [mp3Path, "audio/mpeg"],
        [m4aPath, "audio/mp4"],
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
  const previousLimit = process.env.PILOT_MAX_AUDIO_BYTES;
  process.env.PILOT_AUDIO_DIR = dir;
  process.env.PILOT_MAX_AUDIO_BYTES = "4096";

  try {
    assert.equal(getMaxAudioBytes(), 4096);
    await assert.rejects(
      saveAudioBuffer({
        buffer: Buffer.alloc(4097),
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
    if (previousLimit === undefined) delete process.env.PILOT_MAX_AUDIO_BYTES;
    else process.env.PILOT_MAX_AUDIO_BYTES = previousLimit;
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("shopkeeper upload associates audio with their selected call and hands off to existing pipeline", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "esetu-audio-call-"));
  const previousDir = process.env.PILOT_AUDIO_DIR;
  process.env.PILOT_AUDIO_DIR = dir;
  const call = makeCall();

  try {
    const outcome = await withUploadFakes({
      call,
      run: async ({ createdPilots, scheduled }) => {
        const res = makeResponse();
        await attachCallAudio(
          {
            params: { id: CALL_ID },
            userId: USER_ID,
            file: {
              buffer: makeWav(),
              mimetype: "audio/wav",
              originalname: "supplier-call.wav",
            },
          },
          res,
        );
        return { res, createdPilots, scheduled };
      },
    });

    assert.equal(outcome.res.statusCode, 202);
    assert.equal(String(outcome.createdPilots[0].phoneCallId), CALL_ID);
    assert.equal(String(outcome.createdPilots[0].supplierId), SUPPLIER_ID);
    assert.equal(outcome.createdPilots[0].customer.matched, false);
    assert.equal(outcome.createdPilots[0].customer.userId, null);
    assert.equal(outcome.res.body.call.processingStatus, "processing");
    assert.equal(outcome.scheduled.length, 1);
  } finally {
    if (previousDir === undefined) delete process.env.PILOT_AUDIO_DIR;
    else process.env.PILOT_AUDIO_DIR = previousDir;
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("supplier upload is accepted only for its call and an unrelated user is denied", async () => {
  const call = makeCall();
  const res = makeResponse();
  await withUploadFakes({
    call,
    run: () =>
      attachCallAudio(
        {
          params: { id: CALL_ID },
          userId: OTHER_USER_ID,
          file: {
            buffer: makeWav(),
            mimetype: "audio/wav",
            originalname: "supplier-call.wav",
          },
        },
        res,
      ),
  });
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.code, "FORBIDDEN");
  assert.equal(call.saves, 0);
});

test("same-call duplicate upload is idempotent and does not start another pipeline", async () => {
  const buffer = makeWav();
  const call = makeCall({
    recording: { sha256: getAudioDigest(buffer), fileName: "saved.wav" },
    pilotCallId: PILOT_ID,
  });
  const pilot = {
    audio: { fileName: "saved.wav", sha256: getAudioDigest(buffer) },
  };
  const outcome = await withUploadFakes({
    call,
    pilot,
    run: async ({ createdPilots, scheduled }) => {
      const res = makeResponse();
      await attachCallAudio(
        {
          params: { id: CALL_ID },
          userId: USER_ID,
          file: {
            buffer,
            mimetype: "audio/wav",
            originalname: "supplier-call.wav",
          },
        },
        res,
      );
      return { res, createdPilots, scheduled };
    },
  });
  assert.equal(outcome.res.statusCode, 200, JSON.stringify(outcome.res.body));
  assert.equal(outcome.res.body.alreadyUploaded, true);
  assert.equal(outcome.createdPilots.length, 0);
  assert.equal(outcome.scheduled.length, 0);
});

test("duplicate recording on another call is refused", async () => {
  const call = makeCall();
  const res = makeResponse();
  await withUploadFakes({
    call,
    duplicateCall: { _id: "another-call" },
    run: () =>
      attachCallAudio(
        {
          params: { id: CALL_ID },
          userId: USER_ID,
          file: {
            buffer: makeWav(),
            mimetype: "audio/wav",
            originalname: "supplier-call.wav",
          },
        },
        res,
      ),
  });
  assert.equal(res.statusCode, 409);
  assert.equal(res.body.code, "DUPLICATE_AUDIO");
});

test("a readable-file error is returned without creating a pilot draft", async () => {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), "esetu-audio-invalid-"));
  const previousDir = process.env.PILOT_AUDIO_DIR;
  process.env.PILOT_AUDIO_DIR = dir;
  const call = makeCall();
  const res = makeResponse();

  try {
    const result = await withUploadFakes({
      call,
      run: async ({ createdPilots }) => {
        await attachCallAudio(
          {
            params: { id: CALL_ID },
            userId: USER_ID,
            file: {
              buffer: Buffer.from("not an mp3"),
              mimetype: "audio/mpeg",
              originalname: "fake.mp3",
            },
          },
          res,
        );
        return createdPilots;
      },
    });
    assert.equal(res.statusCode, 415);
    assert.equal(result.length, 0);
    assert.equal(call.saves, 0);
  } finally {
    if (previousDir === undefined) delete process.env.PILOT_AUDIO_DIR;
    else process.env.PILOT_AUDIO_DIR = previousDir;
    await fsp.rm(dir, { recursive: true, force: true });
  }
});

test("retention keeps audio linked to a completed real Order", async () => {
  const dir = await fsp.mkdtemp(
    path.join(os.tmpdir(), "esetu-audio-order-retention-"),
  );
  const previousDir = process.env.PILOT_AUDIO_DIR;
  const previousRetention = process.env.PILOT_AUDIO_RETENTION_DAYS;
  const audioPath = path.join(dir, "ordered-call.wav");
  process.env.PILOT_AUDIO_DIR = dir;
  process.env.PILOT_AUDIO_RETENTION_DAYS = "1";
  PhoneCallPilot.find = () => ({
    select() {
      return this;
    },
    lean: async () => [
      { _id: PILOT_ID, audio: { fileName: "ordered-call.wav" } },
    ],
  });
  Order.find = () => ({
    select() {
      return this;
    },
    lean: async () => [{ phoneCallPilotIds: [PILOT_ID] }],
  });
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
