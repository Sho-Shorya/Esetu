import * as plivoProvider from "./plivoProvider.js";

/**
 * Provider-neutral seam for the pilot. Only one adapter ships in Phase 1
 * (Plivo); the second candidate (Exotel) can be added here later without
 * touching the controller, STT, storage or extraction code.
 *
 * Every adapter must expose:
 *   PROVIDER_NAME, isConfigured()
 *   verifyWebhookSignature(req, routePath)
 *   getCallId, getFromNumber, getToNumber, getDirection,
 *   getCallStatus, getDurationSeconds, getRecordingId, getRecordingUrl
 *   buildAnswerXml()
 *   downloadRecording(url)
 */

const ADAPTERS = {
  plivo: plivoProvider,
};

export const SUPPORTED_PROVIDERS = Object.keys(ADAPTERS);

export const getTelephonyProvider = () => {
  const requested = String(
    process.env.PILOT_TELEPHONY_PROVIDER || "plivo",
  ).toLowerCase();

  const adapter = ADAPTERS[requested];
  if (!adapter) {
    const error = new Error(
      `Unsupported PILOT_TELEPHONY_PROVIDER "${requested}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}.`,
    );
    error.code = "PILOT_PROVIDER_UNSUPPORTED";
    throw error;
  }

  return adapter;
};
