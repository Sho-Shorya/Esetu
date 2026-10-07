import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fsp from "fs/promises";
import os from "node:os";
import path from "path";
import { promisify } from "node:util";
import axios from "axios";

const execFileAsync = promisify(execFile);

/**
 * Speech-to-text for the Phase 1 pilot (Sarvam).
 *
 * Transport choice matters:
 *   - REST  (POST /speech-to-text)      — under 30 seconds, no diarization.
 *   - Batch (POST /speech-to-text/job/v1) — up to 2 hours, timestamps and
 *     diarization. This is the default because a real order call is normally
 *     longer than 30 seconds.
 *
 * Sarvam merges every input channel into one, so a stereo recording is
 * flattened before transcription. `speakerAttributionAvailable` is only ever
 * true when the engine actually returned diarized segments; channel layout is
 * never presented as speaker separation.
 */

const SARVAM_BASE = (
  process.env.SARVAM_API_BASE_URL || "https://api.sarvam.ai"
).replace(/\/+$/, "");

const TERMINAL_SUCCESS_STATES = new Set(["Completed", "PartiallyCompleted"]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const readTransport = () =>
  String(process.env.SARVAM_STT_TRANSPORT || "batch").toLowerCase();

const readModel = () => process.env.SARVAM_STT_MODEL || "saaras:v3";

export const isSarvamConfigured = () => Boolean(process.env.SARVAM_API_KEY);

const sarvamHeaders = () => ({
  "api-subscription-key": String(process.env.SARVAM_API_KEY || ""),
});

/**
 * Sarvam returns a structured error body. Without surfacing it we only ever
 * see "Request failed with status code 400", which is useless for debugging.
 */
const describeSarvamError = (error, step) => {
  const body = error?.response?.data;
  const detail =
    body?.error?.message ||
    body?.message ||
    (typeof body === "string" && body.trim() ? body.trim() : null) ||
    error?.message ||
    "unknown error";

  const enriched = new Error(`Sarvam ${step} failed: ${detail}`);
  enriched.code = body?.error?.code || error?.code || null;
  enriched.sarvamStep = step;
  return enriched;
};

const callSarvam = async (step, run) => {
  try {
    return await run();
  } catch (error) {
    throw describeSarvamError(error, step);
  }
};

const withoutDiarization = (parameters) => {
  const copy = { ...parameters };
  delete copy.with_diarization;
  delete copy.num_speakers;
  return copy;
};

const buildJobParameters = ({ withDiarization, keyterms }) => {
  const model = readModel();
  const parameters = {
    language_code: process.env.SARVAM_STT_LANGUAGE_CODE || "unknown",
    model,
    mode: process.env.SARVAM_STT_LANGUAGE_MODE || "transcribe",
    with_timestamps: true,
  };

  if (withDiarization) {
    parameters.with_diarization = true;
    const numSpeakers = Number(process.env.SARVAM_STT_NUM_SPEAKERS || 2);
    if (Number.isFinite(numSpeakers) && numSpeakers > 0) {
      parameters.num_speakers = numSpeakers;
    }
  }

  if (Array.isArray(keyterms) && keyterms.length && model === "saaras:v4") {
    parameters.keyterms = keyterms.slice(0, 50);
  }

  return parameters;
};

/**
 * Sarvam assumes 16 kHz input. A 48 kHz recording is therefore played back
 * roughly 3x too slowly, which destroys intelligibility and leaves only
 * low-frequency fragments. Verified: a 48 kHz clip transcribed as "Yeah" while
 * the same clip resampled to 16 kHz transcribed as a full Hindi order.
 *
 * PCM WAV is normalised to 16 kHz mono 16-bit here with no extra dependency.
 * Compressed formats (mp3/aac/opus) cannot be decoded without ffmpeg and are
 * passed through untouched, so those should be checked with ffmpeg available.
 */

export const STT_TARGET_SAMPLE_RATE = 16000;

const parseWav = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 44) return null;
  if (buffer.toString("ascii", 0, 4) !== "RIFF") return null;
  if (buffer.toString("ascii", 8, 12) !== "WAVE") return null;

  let offset = 12;
  let format = null;
  let dataOffset = 0;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === "fmt " && size >= 16) {
      format = {
        audioFormat: buffer.readUInt16LE(body),
        channels: buffer.readUInt16LE(body + 2),
        sampleRate: buffer.readUInt32LE(body + 4),
        bitsPerSample: buffer.readUInt16LE(body + 14),
      };
    } else if (id === "data") {
      dataOffset = body;
      dataLength = Math.min(size, buffer.length - body);
    }

    offset = body + size + (size % 2);
  }

  if (!format || !dataLength) return null;
  return { ...format, dataOffset, dataLength };
};

const readMonoSample = (buffer, format, frameIndex) => {
  const { channels, bitsPerSample } = format;
  const bytesPerSample = bitsPerSample / 8;
  const base = format.dataOffset + frameIndex * channels * bytesPerSample;

  let sum = 0;
  for (let channel = 0; channel < channels; channel += 1) {
    const at = base + channel * bytesPerSample;
    let value;

    if (bitsPerSample === 8) value = (buffer.readUInt8(at) - 128) / 128;
    else if (bitsPerSample === 16) value = buffer.readInt16LE(at) / 32768;
    else if (bitsPerSample === 24) {
      const raw =
        buffer.readUInt8(at) |
        (buffer.readUInt8(at + 1) << 8) |
        (buffer.readInt8(at + 2) << 16);
      value = raw / 8388608;
    } else if (bitsPerSample === 32)
      value = buffer.readInt32LE(at) / 2147483648;
    else return null;

    sum += value;
  }

  return sum / channels;
};

const resampleToMono16 = (buffer, format, targetRate) => {
  const bytesPerFrame = format.channels * (format.bitsPerSample / 8);
  const frames = Math.floor(format.dataLength / bytesPerFrame);
  if (frames < 1) return null;

  const ratio = targetRate / format.sampleRate;
  const outFrames = Math.max(1, Math.floor(frames * ratio));
  const out = Buffer.alloc(outFrames * 2);

  // When downsampling, average across the source span so we low-pass instead
  // of merely decimating (which would alias).
  const from = ratio < 1 ? -1 : 0;
  const to = ratio < 1 ? 1 : 0;

  for (let i = 0; i < outFrames; i += 1) {
    const centre = ratio < 1 ? i / ratio : (i + 0.5) / ratio - 0.5;
    const anchor = Math.floor(centre);

    let sum = 0;
    let counted = 0;

    for (let k = from; k <= to; k += 1) {
      const index = anchor + k;
      if (index < 0 || index >= frames) continue;
      const sample = readMonoSample(buffer, format, index);
      if (sample === null) return null;
      sum += sample;
      counted += 1;
    }

    if (!counted) continue;
    const clamped = Math.max(-1, Math.min(1, sum / counted));
    out.writeInt16LE(Math.round(clamped * 32767), i * 2);
  }

  return out;
};

const buildPcmWav = (pcm, sampleRate) => {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
};

export const normalizeAudioForStt = (buffer) => {
  const format = parseWav(buffer);

  const passthrough = (reason) => ({
    buffer,
    changed: false,
    reason,
    sourceSampleRate: format?.sampleRate ?? null,
    sourceChannels: format?.channels ?? null,
  });

  if (!format) return passthrough("not_pcm_wav");
  if (format.audioFormat !== 1)
    return passthrough(`wav_format_${format.audioFormat}_not_pcm`);
  if (
    format.sampleRate === STT_TARGET_SAMPLE_RATE &&
    format.channels === 1 &&
    format.bitsPerSample === 16
  ) {
    return passthrough("already_16k_mono_16bit");
  }

  const pcm = resampleToMono16(buffer, format, STT_TARGET_SAMPLE_RATE);
  if (!pcm) return passthrough("unsupported_bit_depth");

  return {
    buffer: buildPcmWav(pcm, STT_TARGET_SAMPLE_RATE),
    changed: true,
    reason: "resampled_to_16k_mono_16bit",
    sourceSampleRate: format.sampleRate,
    sourceChannels: format.channels,
  };
};

const remoteExtensionFor = (fileName) => {
  const ext = path.extname(String(fileName || "")).toLowerCase();
  return /^\.[a-z0-9]{1,5}$/.test(ext) ? ext.slice(1) : "mp3";
};

/**
 * Compressed recordings (mp3/m4a/aac/ogg/opus/webm/flac/amr/wma) cannot be
 * resampled in pure JS, so they are transcoded to 16 kHz mono PCM with ffmpeg.
 * That single conversion makes every accepted upload format usable, and it is
 * also what keeps Sarvam's 16 kHz assumption satisfied for any recording.
 *
 * ffmpeg-static ships a self-contained binary, so no system install or root is
 * needed on Railway. Set PILOT_FFMPEG_PATH to use a system binary instead, or
 * PILOT_DISABLE_FFMPEG=true to turn transcoding off.
 */
let ffmpegPath;
let ffmpegLookupDone = false;

const resolveFfmpeg = async () => {
  if (ffmpegLookupDone) return ffmpegPath;
  ffmpegLookupDone = true;

  if (process.env.PILOT_DISABLE_FFMPEG === "true") return null;

  const override = process.env.PILOT_FFMPEG_PATH;
  if (override) {
    ffmpegPath = override;
    return ffmpegPath;
  }

  try {
    const mod = await import("ffmpeg-static");
    const candidate = mod?.default ?? mod;
    if (typeof candidate === "string" && candidate) {
      await fsp.access(candidate);
      ffmpegPath = candidate;
    }
  } catch {
    ffmpegPath = null;
  }

  return ffmpegPath;
};

export const isFfmpegAvailable = async () => Boolean(await resolveFfmpeg());

const decodeWithFfmpeg = async (buffer, fileName) => {
  const binary = await resolveFfmpeg();
  if (!binary)
    return { decoded: null, attempted: false, reason: "ffmpeg_unavailable" };

  const token = randomUUID();
  // The dot matters: without it ffmpeg cannot use the extension as a hint.
  const ext = remoteExtensionFor(fileName);
  const inputPath = path.join(os.tmpdir(), `pilot-in-${token}.${ext}`);
  const outputPath = path.join(os.tmpdir(), `pilot-out-${token}.wav`);

  try {
    await fsp.writeFile(inputPath, buffer);
    await execFileAsync(
      binary,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-nostdin",
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "1",
        "-ar",
        String(STT_TARGET_SAMPLE_RATE),
        "-acodec",
        "pcm_s16le",
        "-f",
        "wav",
        outputPath,
      ],
      {
        timeout: Number(process.env.PILOT_FFMPEG_TIMEOUT_MS || 120000),
        maxBuffer: 4 * 1024 * 1024,
        windowsHide: true,
      },
    );

    const decoded = await fsp.readFile(outputPath);
    if (decoded.length > 44) return { decoded, attempted: true, reason: "ok" };

    return { decoded: null, attempted: true, reason: "ffmpeg_empty_output" };
  } catch (error) {
    console.warn(
      `[pilot-stt] ffmpeg could not decode ${fileName}: ${error.message}`,
    );
    return { decoded: null, attempted: true, reason: "ffmpeg_decode_failed" };
  } finally {
    await fsp.rm(inputPath, { force: true }).catch(() => {});
    await fsp.rm(outputPath, { force: true }).catch(() => {});
  }
};

/**
 * Single entry point for audio preparation. PCM WAV is resampled in-process;
 * anything else is transcoded by ffmpeg. If neither works the original bytes
 * are forwarded, because Sarvam can often still read the container itself.
 */
export const prepareSttInput = async (buffer, fileName) => {
  const direct = normalizeAudioForStt(buffer);

  if (direct.changed) return { ...direct, method: "resampled" };
  if (direct.reason === "already_16k_mono_16bit") {
    return { ...direct, method: "already_normal" };
  }

  const { decoded, reason } = await decodeWithFfmpeg(buffer, fileName);

  if (decoded) {
    return {
      buffer: decoded,
      changed: true,
      method: "transcoded",
      reason: `transcoded_to_16k_mono_16bit_from_${remoteExtensionFor(fileName)}`,
      sourceSampleRate: direct.sourceSampleRate,
      sourceChannels: direct.sourceChannels,
    };
  }

  return { ...direct, method: "passthrough", reason };
};

const MANUAL_AUDIO_EXTENSIONS = new Set([
  ".wav",
  ".mp3",
  ".m4a",
  ".aac",
  ".webm",
]);

export const validateManualAudio = async ({
  buffer,
  fileName,
  contentType,
} = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    const error = new Error("Audio payload is empty.");
    error.code = "AUDIO_EMPTY";
    throw error;
  }

  const extension = path.extname(String(fileName || "")).toLowerCase();
  if (!MANUAL_AUDIO_EXTENSIONS.has(extension)) {
    const error = new Error(
      "Only WAV, MP3, M4A, AAC or WebM recordings can be added.",
    );
    error.code = "AUDIO_FORMAT_UNSUPPORTED";
    throw error;
  }

  const mimeType = String(contentType || "")
    .toLowerCase()
    .split(";")[0]
    .trim();
  const allowedMimeTypes = new Set([
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
    "audio/aacp",
    "audio/x-aac",
    "audio/webm",
    "application/octet-stream",
  ]);
  if (mimeType && !allowedMimeTypes.has(mimeType)) {
    const error = new Error(
      "This file type is not a supported audio recording.",
    );
    error.code = "AUDIO_MIME_UNSUPPORTED";
    throw error;
  }

  const prepared = await prepareSttInput(buffer, fileName);
  if (prepared.method === "passthrough") {
    const error = new Error("This recording could not be read as audio.");
    error.code = "AUDIO_UNREADABLE";
    throw error;
  }

  return { extension, bytes: buffer.length };
};

const FFMPEG_DURATION_PATTERN = /Duration:\s*(\d+):(\d{2}):(\d{2}(?:\.\d+)?)/;

const parseFfmpegDuration = (text) => {
  const match = FFMPEG_DURATION_PATTERN.exec(String(text || ""));
  if (!match) return null;
  const total =
    Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  return Number.isFinite(total) ? total : null;
};

/**
 * The length of a recording in seconds, established before anything is stored.
 *
 * PCM WAV answers from its own header, with no subprocess — which is also the
 * path every generated test file takes. Compressed formats (mp3/m4a/aac) are
 * probed with ffmpeg: `ffmpeg -i <file>` prints the container's Duration line
 * and then exits non-zero because no output was given, so both the success and
 * the failure branch are parsed.
 *
 * Returns null when the length cannot be established; the upload route turns
 * that into a refusal instead of accepting a recording of unknown length.
 */
export const probeAudioDurationSeconds = async ({ buffer, fileName } = {}) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;

  const wav = parseWav(buffer);
  if (wav) {
    const byteRate = wav.sampleRate * wav.channels * (wav.bitsPerSample / 8);
    const fromHeader = byteRate > 0 ? wav.dataLength / byteRate : null;
    if (fromHeader !== null && Number.isFinite(fromHeader)) return fromHeader;
  }

  const binary = await resolveFfmpeg();
  if (!binary) return null;

  const token = randomUUID();
  const ext = remoteExtensionFor(fileName);
  const inputPath = path.join(os.tmpdir(), `pilot-probe-${token}.${ext}`);

  try {
    await fsp.writeFile(inputPath, buffer);

    let output = "";
    try {
      const { stdout, stderr } = await execFileAsync(
        binary,
        ["-hide_banner", "-nostdin", "-i", inputPath],
        {
          timeout: Number(process.env.PILOT_FFMPEG_PROBE_TIMEOUT_MS || 30000),
          maxBuffer: 1024 * 1024,
          windowsHide: true,
        },
      );
      output = `${stderr || ""}\n${stdout || ""}`;
    } catch (error) {
      output = `${error?.stderr || ""}\n${error?.stdout || ""}`;
    }

    return parseFfmpegDuration(output);
  } catch {
    return null;
  } finally {
    await fsp.rm(inputPath, { force: true }).catch(() => {});
  }
};

const pollBatchJob = async (jobId) => {
  const timeoutMs = Number(
    process.env.SARVAM_BATCH_POLL_TIMEOUT_MS || 10 * 60 * 1000,
  );
  const startedAt = Date.now();
  let delayMs = 2000;

  while (Date.now() - startedAt < timeoutMs) {
    await sleep(delayMs);

    const { data } = await callSarvam("status poll", () =>
      axios.get(
        `${SARVAM_BASE}/speech-to-text/job/v1/${encodeURIComponent(jobId)}/status`,
        { headers: sarvamHeaders(), timeout: 30000 },
      ),
    );

    if (TERMINAL_SUCCESS_STATES.has(data?.job_state)) return data;

    if (data?.job_state === "Failed") {
      const error = new Error(
        data?.error_message || "Sarvam batch job failed.",
      );
      error.code = "SARVAM_BATCH_FAILED";
      throw error;
    }

    // Sarvam asks for at least 5s between status polls; back off gently.
    delayMs = Math.min(Math.round(delayMs * 1.5), 30000);
  }

  const error = new Error(
    `Sarvam batch job ${jobId} did not finish within ${timeoutMs}ms.`,
  );
  error.code = "SARVAM_BATCH_TIMEOUT";
  throw error;
};

const runBatchTranscription = async ({ buffer, fileName, keyterms }) => {
  // Diarization is opt-in. Measured on real audio it dropped Sarvam's
  // language confidence from 0.72 to 0.00 and yielded empty transcripts, so
  // it must be explicitly enabled rather than assumed.
  const requestedParameters = buildJobParameters({
    withDiarization: process.env.SARVAM_STT_DIARIZATION === "true",
    keyterms,
  });

  // Diarization is a beta/paid feature. If the account is not entitled the
  // initiate call is rejected outright, so retry once without it rather than
  // failing the whole transcription.
  let jobParameters = requestedParameters;
  let initiate;

  try {
    initiate = await callSarvam("batch job initiate", () =>
      axios.post(
        `${SARVAM_BASE}/speech-to-text/job/v1`,
        { job_parameters: jobParameters },
        { headers: sarvamHeaders(), timeout: 60000 },
      ),
    );
  } catch (error) {
    if (!jobParameters.with_diarization) throw error;

    jobParameters = withoutDiarization(requestedParameters);
    initiate = await callSarvam(
      "batch job initiate (diarization unavailable)",
      () =>
        axios.post(
          `${SARVAM_BASE}/speech-to-text/job/v1`,
          { job_parameters: jobParameters },
          { headers: sarvamHeaders(), timeout: 60000 },
        ),
    );
  }

  const jobId = initiate.data?.job_id;
  if (!jobId) {
    const error = new Error("Sarvam did not return a batch job id.");
    error.code = "SARVAM_BATCH_NO_JOB_ID";
    throw error;
  }

  const remoteFile = `0.${remoteExtensionFor(fileName)}`;

  const uploadLinks = await callSarvam("batch upload-link request", () =>
    axios.post(
      `${SARVAM_BASE}/speech-to-text/job/v1/upload-files`,
      { job_id: jobId, files: [remoteFile] },
      { headers: sarvamHeaders(), timeout: 60000 },
    ),
  );

  const fileUrl = uploadLinks.data?.upload_urls?.[remoteFile]?.file_url;
  if (!fileUrl) {
    const error = new Error("Sarvam did not return a presigned upload URL.");
    error.code = "SARVAM_BATCH_NO_UPLOAD_URL";
    throw error;
  }

  // Presigned Azure URL: no Sarvam auth header. Azure requires an explicit
  // blob type header on the upload or it rejects the PUT.
  await callSarvam("audio upload to storage", () =>
    axios.put(fileUrl, buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "x-ms-blob-type": "BlockBlob",
      },
      timeout: Number(process.env.SARVAM_BATCH_UPLOAD_TIMEOUT_MS || 300000),
      maxBodyLength: Infinity,
    }),
  );

  await callSarvam("batch job start", () =>
    axios.post(
      `${SARVAM_BASE}/speech-to-text/job/v1/${encodeURIComponent(jobId)}/start`,
      null,
      { headers: sarvamHeaders(), timeout: 60000 },
    ),
  );

  const status = await pollBatchJob(jobId);

  const outputFile = (status?.job_details || [])
    .flatMap((detail) => detail?.outputs || [])
    .map((output) => output?.file_name)
    .find(Boolean);

  if (!outputFile) {
    const error = new Error("Sarvam batch job produced no transcript file.");
    error.code = "SARVAM_BATCH_NO_OUTPUT";
    throw error;
  }

  const downloadLinks = await callSarvam(
    "transcript download-link request",
    () =>
      axios.post(
        `${SARVAM_BASE}/speech-to-text/job/v1/download-files`,
        { job_id: jobId, files: [outputFile] },
        { headers: sarvamHeaders(), timeout: 60000 },
      ),
  );

  const downloadUrl = downloadLinks.data?.download_urls?.[outputFile]?.file_url;
  if (!downloadUrl) {
    const error = new Error("Sarvam did not return a transcript download URL.");
    error.code = "SARVAM_BATCH_NO_DOWNLOAD_URL";
    throw error;
  }

  const transcriptResponse = await callSarvam("transcript download", () =>
    axios.get(downloadUrl, { responseType: "json", timeout: 60000 }),
  );

  return {
    transport: "batch",
    jobId,
    remoteFile,
    outputFile,
    jobState: status?.job_state || null,
    diagnostics: {
      totalFiles: status?.total_files ?? null,
      successfulFiles: status?.successful_files_count ?? null,
      failedFiles: status?.failed_files_count ?? null,
      jobErrorMessage: status?.error_message || null,
      fileStates: (status?.job_details || []).map((detail) => ({
        state: detail?.state || null,
        errorMessage: detail?.error_message || null,
        exceptionName: detail?.exception_name || null,
      })),
    },
    payload: transcriptResponse.data,
  };
};

const runRestTranscription = async ({
  buffer,
  fileName,
  contentType,
  keyterms,
}) => {
  const model = readModel();
  const form = new FormData();

  form.append(
    "file",
    new Blob([buffer], { type: contentType || "application/octet-stream" }),
    fileName,
  );
  form.append("model", model);
  form.append("mode", process.env.SARVAM_STT_LANGUAGE_MODE || "transcribe");
  form.append(
    "language_code",
    process.env.SARVAM_STT_LANGUAGE_CODE || "unknown",
  );
  form.append("with_timestamps", "true");

  if (Array.isArray(keyterms) && keyterms.length && model === "saaras:v4") {
    form.append("keyterms", JSON.stringify(keyterms.slice(0, 50)));
  }

  const { data } = await callSarvam("transcription", () =>
    axios.post(`${SARVAM_BASE}/speech-to-text`, form, {
      headers: sarvamHeaders(),
      timeout: Number(process.env.SARVAM_REST_TIMEOUT_MS || 120000),
      maxBodyLength: Infinity,
    }),
  );

  return { transport: "rest", jobId: null, payload: data };
};

const firstString = (...candidates) => {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim())
      return candidate.trim();
  }
  return "";
};

const normalizeTimestamps = (raw) => {
  if (!raw || typeof raw !== "object") return null;

  const words = Array.isArray(raw.words) ? raw.words : null;
  const start = Array.isArray(raw.start_time_seconds)
    ? raw.start_time_seconds
    : null;
  const end = Array.isArray(raw.end_time_seconds) ? raw.end_time_seconds : null;

  if (
    !words ||
    !start ||
    !end ||
    words.length !== start.length ||
    words.length !== end.length
  ) {
    return null;
  }

  return {
    chunks: words.map((chunk, index) => ({
      text: String(chunk ?? ""),
      startSeconds: Number(start[index]),
      endSeconds: Number(end[index]),
    })),
  };
};

/**
 * Only recognises the diarized segment shape Sarvam documents. Anything else is
 * reported as "not available" instead of being guessed at.
 */
const normalizeSpeakers = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  const segments = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;

    const speaker =
      entry.speaker ?? entry.speaker_id ?? entry.speakerId ?? null;
    const start =
      entry.start ?? entry.start_time_seconds ?? entry.startTimeSeconds;
    const end = entry.end ?? entry.end_time_seconds ?? entry.endTimeSeconds;

    if (speaker === null || start === undefined || end === undefined)
      return null;

    segments.push({
      speaker: String(speaker),
      startSeconds: Number(start),
      endSeconds: Number(end),
    });
  }

  return segments.length ? segments : null;
};

const parsePayload = (payload) => {
  const transcriptEntry = Array.isArray(payload?.transcripts)
    ? payload.transcripts[0]
    : null;
  const scope =
    transcriptEntry && typeof transcriptEntry === "object"
      ? transcriptEntry
      : payload || {};

  const speakers = normalizeSpeakers(
    scope.diarized_speech ?? scope.diarization ?? payload?.diarized_speech,
  );

  return {
    transcript: firstString(
      scope.text,
      scope.transcript,
      payload?.transcript,
      payload?.text,
    ),
    languageCode:
      firstString(scope.language_code, payload?.language_code) || null,
    languageProbability:
      typeof scope.language_probability === "number"
        ? scope.language_probability
        : null,
    timestamps: normalizeTimestamps(scope.timestamps ?? payload?.timestamps),
    speakers,
    speakerAttributionAvailable: Boolean(speakers),
  };
};

export const transcribePilotAudio = async ({
  filePath,
  fileName,
  contentType,
  keyterms,
}) => {
  if (!isSarvamConfigured()) {
    const error = new Error("SARVAM_API_KEY is not configured.");
    error.code = "STT_NOT_CONFIGURED";
    throw error;
  }
  if (!filePath) {
    const error = new Error("Audio file path is required for transcription.");
    error.code = "STT_NO_AUDIO";
    throw error;
  }

  const stored = await fsp.readFile(filePath);

  // Sarvam assumes 16 kHz. Normalise before upload so 44.1/48 kHz phone
  // recordings are not slowed down and misheard, and so compressed uploads
  // (mp3/m4a/ogg/opus/webm/flac) become readable at all.
  const prepared = await prepareSttInput(stored, fileName);
  const buffer = prepared.buffer;
  const transport = readTransport();

  const fileNameForStt = prepared.changed
    ? `${path.parse(fileName || "audio.wav").name}.wav`
    : fileName;
  const contentTypeForStt = prepared.changed ? "audio/wav" : contentType;

  if (prepared.method === "passthrough") {
    console.warn(
      `[pilot-stt] ${fileName} was sent to Sarvam without 16 kHz normalisation ` +
        `(${prepared.reason}). It is not decodable PCM WAV and ffmpeg could not ` +
        "read it, so Sarvam may mis-transcribe it. Check PILOT_FFMPEG_PATH.",
    );
  }

  const result =
    transport === "rest"
      ? await runRestTranscription({
          buffer,
          fileName: fileNameForStt,
          contentType: contentTypeForStt,
          keyterms,
        })
      : await runBatchTranscription({
          buffer,
          fileName: fileNameForStt,
          keyterms,
        });

  const parsed = parsePayload(result.payload);

  if (!parsed.transcript) {
    // Surface what Sarvam actually returned. The output shape is not
    // documented, so guessing here would silently lose real transcripts.
    const preview = (() => {
      try {
        const text = JSON.stringify(result.payload);
        if (!text) return "(empty body)";
        return text.length > 900 ? `${text.slice(0, 900)}…` : text;
      } catch {
        return "(unserialisable payload)";
      }
    })();

    const diagnostics = result.diagnostics
      ? ` | job ${result.jobState}, files ok=${result.diagnostics.successfulFiles}/${result.diagnostics.totalFiles} failed=${result.diagnostics.failedFiles} fileStates=${JSON.stringify(result.diagnostics.fileStates)} jobError=${result.diagnostics.jobErrorMessage || "none"}`
      : "";

    const error = new Error(
      `Sarvam returned no transcript text. jobId=${result.jobId || "none"} outputFile=${result.outputFile || "none"}${diagnostics} | raw payload: ${preview}`,
    );
    error.code = "STT_EMPTY_TRANSCRIPT";
    throw error;
  }

  return {
    engine: "sarvam",
    transport: result.transport,
    model: readModel(),
    jobId: result.jobId,
    ...parsed,
    channelsMerged: true,
    audioInput: {
      normalizedTo16k: prepared.changed,
      method: prepared.method,
      reason: prepared.reason,
      sourceSampleRate: prepared.sourceSampleRate,
      sourceChannels: prepared.sourceChannels,
      targetSampleRate: STT_TARGET_SAMPLE_RATE,
    },
  };
};
