import axios from "axios";
import { verifyPlivoV3Signature } from "./plivoSignature.js";

/**
 * Plivo adapter for the Phase 1 pilot.
 *
 * The pilot only needs four things from a voice provider:
 *   1. answer XML that starts a stereo recording
 *   2. signed call-status updates
 *   3. a signed recording-ready callback
 *   4. authenticated download of the recording
 *
 * Nothing here touches Order, checkout or any customer record.
 */

const PLIVO_API_BASE = (
  process.env.PILVO_API_BASE_URL || "https://api.plivo.com"
).replace(/\/+$/, "");

const readConfig = () => ({
  authId: process.env.PILVO_AUTH_ID || "",
  authToken: process.env.PILVO_AUTH_TOKEN || "",
  webhookBaseUrl: (process.env.PILVO_WEBHOOK_BASE_URL || "").replace(/\/+$/, ""),
  // WAV is the default because the 16 kHz normaliser in sttService can only
  // decode PCM. MP3 needs ffmpeg, and Sarvam mis-transcribes a wrongly
  // interpreted sample rate. WAV is larger, so the length cap is lower.
  recordFormat: (process.env.PILVO_RECORD_FORMAT || "wav").toLowerCase(),
  maxLengthSeconds: Number(process.env.PILVO_RECORD_MAX_LENGTH || 900),
  // Plivo stops recording after this much continuous silence. A short value
  // truncates real order calls, because customers pause while they think or
  // read a list, so it must comfortably exceed a normal thinking pause.
  silenceTimeoutSeconds: Number(process.env.PILVO_RECORD_SILENCE_TIMEOUT || 60),
  answerPrompt: process.env.PILVO_ANSWER_PROMPT || "",
  downloadTimeoutMs: Number(process.env.PILVO_DOWNLOAD_TIMEOUT_MS || 90000),
});

export const PROVIDER_NAME = "plivo";

export const isPlivoConfigured = () => {
  const { authId, authToken } = readConfig();
  return Boolean(authId && authToken);
};

const escapeXml = (value) =>
  String(value).replace(
    /[<>&'"]/g,
    (char) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        "'": "&apos;",
        '"': "&quot;",
      })[char],
  );

/**
 * Plivo signs the exact URL it called. Behind a proxy/load balancer we cannot
 * trust req.protocol/req.get("host"), so prefer the configured public base URL.
 */
export const resolvePlivoWebhookUrl = (req, routePath = "") => {
  const { webhookBaseUrl } = readConfig();
  const path = String(routePath || "").split("?")[0];

  if (webhookBaseUrl) return `${webhookBaseUrl}${path}`;

  const host = req?.get?.("host") || "localhost";
  const protocol = req?.protocol || "https";
  return `${protocol}://${host}${req?.originalUrl?.split("?")[0] || path}`;
};

const field = (req, ...names) => {
  for (const name of names) {
    const value = req?.body?.[name];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
};

const toPositiveInt = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed);
};

export const verifyWebhookSignature = (req, routePath) => {
  const { authToken } = readConfig();
  return verifyPlivoV3Signature({
    headers: req?.headers,
    params: req?.body,
    url: resolvePlivoWebhookUrl(req, routePath),
    authToken,
  });
};

export const getCallId = (req) => field(req, "CallUUID", "call_uuid", "callUUID");
export const getFromNumber = (req) => field(req, "From", "from", "Caller");
export const getToNumber = (req) => field(req, "To", "to", "Called");
export const getDirection = (req) => field(req, "Direction", "direction");
export const getCallStatus = (req) =>
  field(req, "CallStatus", "Status", "status", "Event");
export const getDurationSeconds = (req) =>
  toPositiveInt(field(req, "CallDuration", "Duration", "duration"));
export const getRecordingId = (req) =>
  field(req, "RecordingID", "recording_id", "RecordingId");
export const getRecordingUrl = (req) =>
  field(req, "RecordingUrl", "recording_url", "RecordingURL");

/**
 * Stereo keeps each party on its own channel, which is the closest thing to
 * real per-leg separation Plivo offers. The 16 kHz normaliser downmixes both
 * channels to mono before Sarvam, so per-speaker claims still require
 * diarization, never the channel layout.
 * Plivo's own transcription is deliberately not used: it is English only.
 */
export const buildAnswerXml = () => {
  const {
    maxLengthSeconds,
    silenceTimeoutSeconds,
    answerPrompt,
    webhookBaseUrl,
    recordFormat,
  } = readConfig();

  const callbackUrl = `${webhookBaseUrl}/api/v1/pilot/phone-call/recording-ready`;

  const speak = answerPrompt.trim()
    ? `\n  <Speak>${escapeXml(answerPrompt.trim())}</Speak>`
    : "";

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Response>",
    speak,
    `  <Record recordSession="true" recordChannelType="stereo" fileFormat="${escapeXml(recordFormat)}" startOnDialAnswer="true" maxLength="${maxLengthSeconds}" timeout="${silenceTimeoutSeconds}" callbackUrl="${escapeXml(callbackUrl)}" callbackMethod="POST" />`,
    "</Response>",
  ]
    .filter(Boolean)
    .join("\n");
};

const CONTENT_TYPES = {
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  ogg: "audio/ogg",
  opus: "audio/opus",
};

const contentTypeForUrl = (recordingUrl) => {
  const match = String(recordingUrl || "").toLowerCase().match(/\.([a-z0-9]{2,5})(?:\?|#|$)/);
  const ext = match?.[1];
  if (ext && CONTENT_TYPES[ext]) return CONTENT_TYPES[ext];
  if (ext === "aac") return "audio/aac";
  return "application/octet-stream";
};

/**
 * Pulls the recording into memory. Plivo deletes recordings after 30 days, so
 * this must run promptly after the recording-ready callback.
 */
export const downloadRecording = async (recordingUrl) => {
  const { authId, authToken, downloadTimeoutMs } = readConfig();

  if (!recordingUrl) {
    const error = new Error("Recording URL is missing.");
    error.code = "RECORDING_URL_MISSING";
    throw error;
  }
  if (!authId || !authToken) {
    const error = new Error("Plivo credentials are not configured.");
    error.code = "PLIVO_NOT_CONFIGURED";
    throw error;
  }

  const response = await axios.get(recordingUrl, {
    auth: { username: authId, password: authToken },
    responseType: "arraybuffer",
    timeout: downloadTimeoutMs,
    maxContentLength: Number(process.env.PILOT_MAX_AUDIO_BYTES || 25 * 1024 * 1024),
    maxBodyLength: Number(process.env.PILOT_MAX_AUDIO_BYTES || 25 * 1024 * 1024),
  });

  return {
    buffer: Buffer.from(response.data),
    // Plivo serves .wav as audio/x-wav, which the browser cannot reliably play.
    contentType: contentTypeForUrl(recordingUrl),
  };
};
