import crypto from "crypto";

/**
 * Plivo V3 webhook signature verification.
 *
 * Base string = for every parameter sorted by name: name + urlencoded(value),
 * then the full URL Plivo requested, then the nonce.
 * Signature = base64(HMAC-SHA256(base string, Auth Token)).
 *
 * The reconstructed URL must be byte-identical to the one Plivo called, so
 * pass the externally visible base URL (PILVO_WEBHOOK_BASE_URL) rather than
 * trusting proxy headers.
 */

export const SIGNATURE_HEADER = "x-plivo-signature-v3";
export const NONCE_HEADER = "x-plivo-signature-v3-nonce";

const encodeValue = (value) => encodeURIComponent(String(value));

export const buildPlivoV3BaseString = ({ url, params, nonce }) => {
  const source = params && typeof params === "object" ? params : {};
  const names = Object.keys(source).sort();

  let base = "";
  for (const name of names) {
    const value = source[name];
    if (value === undefined || value === null) continue;
    base += name + encodeValue(value);
  }

  return base + String(url || "") + String(nonce || "");
};

export const computePlivoV3Signature = ({ url, params, nonce, authToken }) =>
  crypto
    .createHmac("sha256", String(authToken || ""))
    .update(buildPlivoV3BaseString({ url, params, nonce }), "utf8")
    .digest("base64");

export const verifyPlivoV3Signature = ({ headers, params, url, authToken }) => {
  const signature = headers?.[SIGNATURE_HEADER];
  const nonce = headers?.[NONCE_HEADER];

  if (!signature || Array.isArray(signature)) {
    return { valid: false, reason: "missing_signature_header" };
  }
  if (!nonce || Array.isArray(nonce)) {
    return { valid: false, reason: "missing_nonce_header" };
  }
  if (!authToken) {
    return { valid: false, reason: "auth_token_not_configured" };
  }

  const expected = computePlivoV3Signature({ url, params, nonce, authToken });
  const expectedBuf = Buffer.from(expected, "utf8");
  const receivedBuf = Buffer.from(String(signature), "utf8");

  if (expectedBuf.length !== receivedBuf.length) {
    return { valid: false, reason: "signature_mismatch" };
  }

  const valid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
  return valid ? { valid: true, reason: null } : { valid: false, reason: "signature_mismatch" };
};
