/**
 * Phase 1 pilot: caller-phone normalisation.
 *
 * Strictly format-based. It never guesses and never fuzzy-matches.
 * Accepted Indian formats:
 *   +91XXXXXXXXXX  (12 digits, leading country code)
 *   91XXXXXXXXXX   (12 digits, leading country code)
 *   0XXXXXXXXXX    (11 digits, leading trunk zero)
 *   XXXXXXXXXX     (10 digits)
 *
 * The e-Setu User collection stores phoneNumber as a 10-digit number without
 * "+91", so `normalized` is the exact string used for equality lookup.
 */

const TEN_DIGIT = /^\d{10}$/;

export const normalizeIndianPhone = (raw) => {
  if (raw === null || raw === undefined || raw === "") {
    return { raw: raw ?? null, normalized: null, method: "absent" };
  }

  const rawValue = String(raw).trim();
  const digits = rawValue.replace(/\D/g, "");

  let candidate = null;
  let method = "unrecognized";

  if (digits.length === 12 && digits.startsWith("91")) {
    candidate = digits.slice(2);
    method = rawValue.startsWith("+") ? "plus91" : "cc-without-plus";
  } else if (digits.length === 11 && digits.startsWith("0")) {
    candidate = digits.slice(1);
    method = "leading-zero";
  } else if (digits.length === 10) {
    candidate = digits;
    method = rawValue.startsWith("+") ? "plus91" : "ten-digit";
  }

  if (candidate && TEN_DIGIT.test(candidate)) {
    return { raw: rawValue, normalized: candidate, method };
  }

  return { raw: rawValue, normalized: null, method };
};

/**
 * Exact 10-digit match only. Returns the number used for the lookup so the
 * caller can record whether a match was actually possible.
 */
export const toLookupNumber = (raw) => {
  const { normalized } = normalizeIndianPhone(raw);
  return normalized ? Number(normalized) : null;
};
