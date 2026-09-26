import fs from "fs";
import fsp from "fs/promises";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

/**
 * Phase 1 pilot private audio storage.
 *
 * Audio never gets a public URL. It is written to a directory that is not
 * tracked by git and is only reachable through an authenticated backend route.
 * On Railway this filesystem is ephemeral, which is acceptable for a pilot and
 * must not be treated as durable production storage.
 */

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = path.resolve(SERVICE_DIR, "..", "pilot-audio");

export const getAudioDir = () =>
  path.resolve(process.env.PILOT_AUDIO_DIR || DEFAULT_DIR);

/**
 * 64 MB covers a full-length pilot call: a 900 s Plivo WAV at 16 kHz mono
 * 16-bit is ~29 MB, and a 2 minute 48 kHz WAV is ~12 MB. The previous 25 MB
 * default silently rejected long real calls.
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

const safeSegment = (value) =>
  String(value || "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "pilot";

/**
 * Persists an in-memory audio payload. Throws on empty, oversized or
 * obviously non-audio input so nothing bogus reaches the STT step.
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

  await ensureAudioDir();

  const fileName = `${safeSegment(prefix)}-${Date.now()}-${crypto.randomBytes(4).toString("hex")}${extensionFor(contentType, originalName)}`;
  const filePath = path.join(getAudioDir(), fileName);

  await fsp.writeFile(filePath, buffer);

  return {
    fileName,
    contentType: String(contentType || "application/octet-stream"),
    bytes: buffer.length,
    sha256: getAudioDigest(buffer),
    originalName: originalName ? path.basename(String(originalName)) : null,
  };
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

export const audioExists = (fileName) => {
  try {
    return fs.existsSync(resolveAudioPath(fileName));
  } catch {
    return false;
  }
};

export const removeAudio = async (fileName) => {
  try {
    await fsp.unlink(resolveAudioPath(fileName));
    return true;
  } catch {
    return false;
  }
};

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
