import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import {
  deleteAudioFromCloud,
  describeAudioStorage,
  downloadAudioFromCloud,
  getAudioBackend,
  isCloudAudioConfigured,
  uploadAudioToCloud,
} from "./pilotAudioCloud.js";

/**
 * Recording storage for the phone-order flow.
 *
 * Audio never gets a public URL. It is written either to durable cloud storage
 * (the production path, see `pilotAudioCloud.js`) or to a directory that is not
 * tracked by git, and is only ever reachable through an authenticated backend
 * route.
 *
 * The local disk backend is kept because it is the only thing that works without
 * cloud credentials, it is what the developer tooling and the existing tests
 * use, and it still holds every recording taken before the move to durable
 * storage. Callers never need to know which backend a given recording is on:
 * they save a buffer, or hand back the record they stored, and the helpers
 * below do the right thing for either.
 */

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SERVICE_DIR, "..", "pilot-audio");

export const getAudioDir = () =>
  path.resolve(process.env.PILOT_AUDIO_DIR || DEFAULT_DIR);

/**
 * 64 MB covers a full-length recording: a 600 s 16 kHz mono 16-bit WAV is
 * ~19 MB, and a 2 minute 48 kHz WAV is ~12 MB. The previous 25 MB default
 * silently rejected long real calls.
 */
export const getMaxAudioBytes = () =>
  Number(process.env.PILOT_MAX_AUDIO_BYTES || 64 * 1024 * 1024);

export const getAudioDigest = (buffer) =>
  crypto.createHash("sha256").update(buffer).digest("hex");

const EXT_BY_MIME = {
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/wave": ".wav",
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/opus": ".opus",
  "audio/flac": ".flac",
  "audio/amr": ".amr",
  "audio/x-ms-wma": ".wam",
};

const AUDIO_MIME_PREFIXES = ["audio/"];

const isAudioMime = (contentType) => {
  const mime = String(contentType || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (!mime) return false;
  return (
    AUDIO_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) ||
    mime === "application/octet-stream"
  );
};

const extensionFor = (contentType, originalName) => {
  const mime = String(contentType || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  if (EXT_BY_MIME[mime]) return EXT_BY_MIME[mime];

  const fromName = path.extname(String(originalName || "")).toLowerCase();
  if (fromName && /^\.[a-z0-9]{1,5}$/.test(fromName)) return fromName;

  return ".bin";
};

export const ensureAudioDir = async () => {
  const dir = getAudioDir();
  await fsp.mkdir(dir, { recursive: true });
  return dir;
};

/**
 * Scratch space for recordings pulled back out of durable storage. It sits
 * inside the audio directory so the same volume is used, but in a subdirectory
 * so the retention sweep, which only reads files in the top level, never treats
 * a short-lived working copy as a stored recording.
 */
const getAudioTempDir = () => path.join(getAudioDir(), "tmp");

const ensureAudioTempDir = async () => {
  const dir = getAudioTempDir();
  await fsp.mkdir(dir, { recursive: true });
  return dir;
};

const safeSegment = (value) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "pilot";

/**
 * Persists an in-memory audio payload. Throws on empty, oversized or
 * obviously non-audio input so nothing bogus reaches the STT step.
 *
 * The returned record is what gets stored on the pilot document, and it is what
 * every later read, retry and delete goes through. `storage` says which backend
 * holds the bytes: a local recording has `fileName` and no `publicId`, a durable
 * one has `publicId` and no `fileName`.
 */
export const saveAudioBuffer = async ({
  buffer,
  contentType,
  originalName,
  prefix,
}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Audio payload is empty.");
  }

  const maxBytes = getMaxAudioBytes();
  if (buffer.length > maxBytes) {
    const error = new Error(
      `Audio is ${buffer.length} bytes which exceeds the ${maxBytes} byte pilot limit.`,
    );
    error.code = "AUDIO_TOO_LARGE";
    throw error;
  }

  if (!isAudioMime(contentType)) {
    const error = new Error(
      `Unsupported audio content type "${contentType || "unknown"}".`,
    );
    error.code = "AUDIO_TYPE_UNSUPPORTED";
    throw error;
  }

  const descriptor = {
    contentType: String(contentType || "application/octet-stream"),
    bytes: buffer.length,
    sha256: getAudioDigest(buffer),
    originalName: originalName ? path.basename(String(originalName)) : null,
  };

  if (getAudioBackend() === "cloud") {
    // Durable storage is written before anything else happens, so a failure
    // here is a failed upload and never a "processing started" response. The
    // prefix is only used for local file names, never for a stored asset path.
    const stored = await uploadAudioToCloud({
      buffer,
      contentType: descriptor.contentType,
    });

    return {
      ...descriptor,
      storage: "cloud",
      publicId: stored.publicId,
      format: stored.format || null,
      fileName: null,
    };
  }

  await ensureAudioDir();

  const fileName = `${safeSegment(prefix)}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extensionFor(contentType, originalName)}`;
  const filePath = path.join(getAudioDir(), fileName);

  await fsp.writeFile(filePath, buffer);

  return {
    ...descriptor,
    storage: "local",
    publicId: null,
    format: null,
    fileName,
  };
};

/**
 * The storage columns shared by a pilot's `audio` and a call's `recording`.
 * Both subdocuments store the same thing in the same columns, so this is the
 * single place that decides how a saved recording is represented in Mongo.
 */
export const storageColumns = (saved) => ({
  storage: saved?.storage === "cloud" ? "cloud" : "local",
  publicId: saved?.publicId || null,
  format: saved?.format || null,
  fileName: saved?.fileName || null,
  contentType: saved?.contentType || null,
  bytes: saved?.bytes ?? null,
  sha256: saved?.sha256 || null,
  originalName: saved?.originalName || null,
});

/**
 * Normalises whatever a caller has to hand into a storage record.
 *
 * A bare file name is treated as a local recording, which is exactly what every
 * document written before durable storage holds, so those calls keep working
 * untouched.
 */
export const normalizeAudioRecord = (record) => {
  if (!record) return null;
  if (typeof record === "string") {
    return record ? { storage: "local", fileName: record, publicId: null } : null;
  }

  if (record.publicId) {
    return {
      storage: "cloud",
      publicId: record.publicId,
      format: record.format || null,
      fileName: null,
    };
  }

  if (record.fileName) {
    return {
      storage: "local",
      fileName: record.fileName,
      publicId: null,
      format: null,
    };
  }

  return null;
};

/** True when a recording exists on either backend. */
export const hasAudioRecord = (record) => Boolean(normalizeAudioRecord(record));

/**
 * Resolves a stored recording to a local file the STT step can read.
 *
 * A local recording is used where it lies. A durable one is fetched into a
 * working copy carrying the original extension, because the transcoder decides
 * how to normalise the file from its name. `temporary` says whether the caller
 * has to clean the file up.
 */
export const materializeAudio = async (record) => {
  const audio = normalizeAudioRecord(record);
  if (!audio) {
    const error = new Error("This call has no stored recording.");
    error.code = "AUDIO_NOT_STORED";
    throw error;
  }

  if (audio.storage === "local") {
    const filePath = resolveAudioPath(audio.fileName);
    if (!fs.existsSync(filePath)) {
      const error = new Error(
        "The stored recording is no longer on this server.",
      );
      error.code = "AUDIO_FILE_MISSING";
      throw error;
    }
    return {
      filePath,
      fileName: audio.fileName,
      temporary: false,
      cleanup: async () => {},
    };
  }

  const buffer = await downloadAudioFromCloud({
    publicId: audio.publicId,
    format: audio.format,
    maxBytes: getMaxAudioBytes(),
  });

  const dir = await ensureAudioTempDir();
  // The extension carries the real format, so the transcoder reads the working
  // copy exactly as it would have read the original upload.
  const extension = safeSegment(audio.format) || "wav";
  const fileName = `retry-${Date.now()}-${crypto.randomBytes(4).toString("hex")}.${extension}`;
  const filePath = path.join(dir, fileName);

  await fsp.writeFile(filePath, buffer);

  return {
    filePath,
    fileName,
    temporary: true,
    cleanup: async () => {
      await fsp.unlink(filePath).catch(() => {});
    },
  };
};

/**
 * Runs work against a local copy of a stored recording and always removes the
 * working copy afterwards. Used by transcription and by the authenticated
 * playback route so neither has to remember the cleanup itself.
 */
export const withAudioFile = async (record, run) => {
  const handle = await materializeAudio(record);
  try {
    return await run(handle);
  } finally {
    if (handle.temporary) await handle.cleanup();
  }
};

/**
 * Rejects anything that is not a plain file name sitting directly in the pilot
 * audio directory. Traversal attempts are refused outright rather than being
 * silently rewritten to a basename.
 */
export const resolveAudioPath = (fileName) => {
  const rawName = String(fileName ?? "");
  const baseName = path.basename(rawName);

  const isPlainName =
    baseName.length > 0 &&
    baseName === rawName &&
    baseName !== "." &&
    baseName !== ".." &&
    !baseName.startsWith(".") &&
    /^[A-Za-z0-9._-]+$/.test(baseName);

  if (!isPlainName) {
    const error = new Error("Invalid audio file name.");
    error.code = "AUDIO_NAME_INVALID";
    throw error;
  }

  return path.join(getAudioDir(), baseName);
};

/**
 * Whether a recording is retrievable. For a durable recording this reports the
 * stored identifier and configured credentials rather than probing the remote
 * asset, so the check stays cheap enough to sit in a request path.
 */
export const audioExists = (record) => {
  const audio = normalizeAudioRecord(record);
  if (!audio) return false;
  if (audio.storage === "cloud") {
    return Boolean(audio.publicId) && isCloudAudioConfigured();
  }

  try {
    return fs.existsSync(resolveAudioPath(audio.fileName));
  } catch {
    return false;
  }
};

/**
 * Deletes a recording from whichever backend holds it. Accepts a stored record
 * or a bare file name, so the callers that only have a file name keep working.
 */
export const removeAudio = async (record) => {
  const audio = normalizeAudioRecord(record);
  if (!audio) return false;

  if (audio.storage === "cloud") {
    if (!isCloudAudioConfigured()) return false;
    try {
      return await deleteAudioFromCloud({ publicId: audio.publicId });
    } catch {
      return false;
    }
  }

  try {
    await fsp.unlink(resolveAudioPath(audio.fileName));
    return true;
  } catch {
    return false;
  }
};

export { describeAudioStorage, getAudioBackend, isCloudAudioConfigured };

export const getAudioRetentionDays = () =>
  Math.max(1, Number(process.env.PILOT_AUDIO_RETENTION_DAYS) || 30);

export const listExpiredAudioFiles = async ({
  now = new Date(),
  retentionDays = getAudioRetentionDays(),
  dir = getAudioDir(),
} = {}) => {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const cutoff =
    now.getTime() -
    Math.max(1, Number(retentionDays) || 30) * 24 * 60 * 60 * 1000;
  const expired = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const filePath = path.join(dir, entry.name);
    const stats = await fsp.stat(filePath);
    if (stats.mtimeMs > cutoff) continue;

    expired.push(entry.name);
  }

  return expired;
};

export const cleanupExpiredAudioFiles = async (options = {}) => {
  const expired = await listExpiredAudioFiles(options);
  const preserved = new Set(options.preserveFileNames || []);
  const dir = options.dir || getAudioDir();
  const removed = [];

  for (const fileName of expired) {
    if (preserved.has(fileName)) continue;
    try {
      await fsp.unlink(path.join(dir, fileName));
      removed.push(fileName);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  return removed;
};
