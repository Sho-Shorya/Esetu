import crypto from "crypto";
import cloudinary from "../utils/cloudinary.js";

/**
 * Durable, private storage for phone-call recordings.
 *
 * Recordings used to live only on the server's disk, which is ephemeral on the
 * deployment target: a restart or redeploy loses the audio, and with it the only
 * way to re-run transcription. This module moves the bytes to Cloudinary, which
 * is already configured for product images in `utils/cloudinary.js`, so no
 * second set of credentials or a second SDK configuration is introduced.
 *
 * Two properties matter more than anything else here:
 *
 *   1. Privacy. Every asset is uploaded with `type: "authenticated"`, so the
 *      asset type cannot be fetched by an unauthenticated request and no public
 *      listing or search can reach it. The only way to read a recording is a
 *      server-side signed URL, requested by code that already verified that the
 *      caller owns the call. The public id is opaque random bytes, so it leaks
 *      no supplier or customer name, number, or anything else about the call.
 *
 *   2. Format fidelity. Cloudinary is given no `format`, so the uploaded format
 *      is kept as-is and the stored format is recorded on the pilot document.
 *      Transcription re-encodes to 16 kHz WAV anyway, but the original bytes are
 *      what a supplier may need to listen back to, so they are not degraded.
 */

export const CLOUD_AUDIO_FOLDER = "esetu/phone-calls";

// Cloudinary files audio under the "video" resource type; "image" and "raw"
// are separate namespaces and an audio asset is not addressable as either.
const RESOURCE_TYPE = "video";

// Not "upload": an "authenticated" asset has no public delivery URL at all.
const DELIVERY_TYPE = "authenticated";

export const isCloudAudioConfigured = () =>
  Boolean(
    process.env.CLOUD_NAME && process.env.API_KEY && process.env.API_SECRET,
  );

const requestedBackend = () =>
  String(process.env.PILOT_AUDIO_BACKEND || "auto").trim().toLowerCase();

/**
 * Which backend a new recording is written to.
 *
 * `local` is the default outside production on purpose. Cloudinary credentials
 * are present on developer machines and in CI, and an implicit default would
 * mean a local test run starts writing real call audio into the production
 * account. In production, where losing audio actually costs a real order, cloud
 * is the default and is used whenever the credentials are there.
 *
 * PILOT_AUDIO_BACKEND=local|cloud|auto forces the choice explicitly.
 */
export const getAudioBackend = () => {
  const requested = requestedBackend();
  if (requested === "local" || requested === "cloud") return requested;

  return process.env.NODE_ENV === "production" && isCloudAudioConfigured()
    ? "cloud"
    : "local";
};

/**
 * A one-line, secret-free description of the storage arrangement, for the
 * startup log. Falling back to local disk in production is a durability bug
 * rather than a preference, so it is reported loudly rather than silently.
 */
export const describeAudioStorage = () => {
  const backend = getAudioBackend();
  const summary = `pilot audio storage: ${backend}`;

  if (backend === "cloud") {
    return `${summary} (folder ${CLOUD_AUDIO_FOLDER}, authenticated delivery)`;
  }
  if (process.env.NODE_ENV === "production") {
    return `${summary} - WARNING: recordings are ephemeral and will be lost on redeploy. ` +
      "Set CLOUD_NAME, API_KEY and API_SECRET (or PILOT_AUDIO_BACKEND=cloud).";
  }
  return summary;
};

/**
 * Opaque asset name: a fixed tag, the time, and random bytes.
 *
 * Deliberately built from nothing a caller supplies. A prefix such as a
 * telephony call id is useful in a log line but must never reach a stored path,
 * because one of these ids is all that stands between a leaked URL and a
 * customer's phone number. The time and random bytes are enough to make the
 * name unique and unguessable.
 */
const opaqueAssetName = () =>
  `rec-${Date.now()}-${crypto.randomBytes(12).toString("hex")}`;

const uploadFailed = (cause) => {
  const error = new Error(
    `Recording could not be saved to durable storage: ${cause?.message || cause || "unknown error"}`,
  );
  error.code = "AUDIO_CLOUD_UPLOAD_FAILED";
  error.cause = cause;
  return error;
};

/**
 * Uploads a recording as a private, authenticated asset and returns the
 * identifiers needed to fetch or delete it later. Rejects with
 * AUDIO_CLOUD_UPLOAD_FAILED, so a caller can never mistake a half-finished
 * upload for a stored recording.
 */
export const uploadAudioToCloud = ({
  buffer,
  contentType,
  folder = CLOUD_AUDIO_FOLDER,
} = {}) => {
  if (!isCloudAudioConfigured()) {
    return Promise.reject(uploadFailed("Cloudinary is not configured."));
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: RESOURCE_TYPE,
        type: DELIVERY_TYPE,
        public_id: opaqueAssetName(),
        // The name is already random, so refusing to overwrite is a cheap
        // guarantee that an upload can never clobber an existing recording.
        overwrite: false,
        use_filename: false,
        unique_filename: false,
      },
      (error, result) => {
        if (error) return reject(uploadFailed(error));

        if (!result?.public_id) {
          return reject(uploadFailed("storage returned no asset id"));
        }

        return resolve({
          publicId: result.public_id,
          format: result.format || null,
          resourceType: result.resource_type || RESOURCE_TYPE,
          bytes: Number(result.bytes) || buffer.length,
          contentType: contentType || null,
        });
      },
    );

    stream.on("error", (error) => reject(uploadFailed(error)));
    stream.end(buffer);
  });
};

/**
 * A signed, short-lived URL for a private asset. The signature is what makes
 * the request valid, so this must only be called server-side, after the caller's
 * ownership of the call has been established.
 */
export const signedAudioUrl = ({ publicId, format } = {}) => {
  if (!publicId) return null;

  return cloudinary.url(publicId, {
    resource_type: RESOURCE_TYPE,
    type: DELIVERY_TYPE,
    format: format || undefined,
    secure: true,
    sign_url: true,
  });
};

/**
 * Pulls a stored recording back into memory. Fails loudly rather than handing
 * the pipeline a truncated file, because a partial recording would produce a
 * plausible-looking but wrong transcript.
 */
export const downloadAudioFromCloud = async ({
  publicId,
  format,
  maxBytes,
} = {}) => {
  const url = signedAudioUrl({ publicId, format });
  if (!url) {
    const error = new Error("This call has no durable recording to read.");
    error.code = "AUDIO_CLOUD_MISSING";
    throw error;
  }

  const response = await fetch(url);
  if (!response.ok) {
    const error = new Error(
      `Durable recording could not be downloaded (HTTP ${response.status}).`,
    );
    error.code = "AUDIO_CLOUD_DOWNLOAD_FAILED";
    error.status = response.status;
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const limit = Number(maxBytes) || 0;
  if (limit && buffer.length > limit) {
    const error = new Error(
      `Stored recording is ${buffer.length} bytes which exceeds the ${limit} byte limit.`,
    );
    error.code = "AUDIO_TOO_LARGE";
    throw error;
  }

  return buffer;
};

/**
 * Removes a durable recording. A missing asset counts as removed, so a retried
 * cleanup never turns into a permanent error.
 */
export const deleteAudioFromCloud = async ({ publicId } = {}) => {
  if (!publicId) return false;

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: RESOURCE_TYPE,
    invalidate: true,
  });

  return result?.result === "ok" || result?.result === "not found";
};
