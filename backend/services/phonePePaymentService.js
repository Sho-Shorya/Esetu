import crypto from "crypto";
import axios from "axios";

/* ============================================================
   PHONEPE CONFIG
============================================================ */

const PHONEPE_MERCHANT_ID = process.env.PHONEPE_MERCHANT_ID;

const PHONEPE_SALT_KEY = process.env.PHONEPE_SALT_KEY;

const PHONEPE_SALT_INDEX = process.env.PHONEPE_SALT_INDEX;

const PHONEPE_BASE_URL = process.env.PHONEPE_BASE_URL;

/* ============================================================
   VERIFY PHONEPE PAYMENT
============================================================ */

/*
 * This function checks PhonePe directly.
 *
 * IMPORTANT:
 *
 * Never trust:
 *
 * req.body.status === "SUCCESS"
 *
 * from the frontend.
 *
 * Your backend must verify the transaction
 * with PhonePe.
 */

export const verifyPhonePePayment = async (transactionId) => {
  if (!transactionId) {
    throw new Error("Transaction ID is required.");
  }

  /* ==========================================================
     1. CHECK CONFIGURATION
  ========================================================== */

  if (
    !PHONEPE_MERCHANT_ID ||
    !PHONEPE_SALT_KEY ||
    !PHONEPE_SALT_INDEX ||
    !PHONEPE_BASE_URL
  ) {
    throw new Error("PhonePe configuration is incomplete.");
  }

  /* ==========================================================
     2. PHONEPE STATUS URL
  ========================================================== */

  /*
   * Classic PhonePe PG API:
   *
   * /pg/v1/status/{merchantId}/{merchantTransactionId}
   */

  const endpoint = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${transactionId}`;

  /* ==========================================================
     3. CREATE X-VERIFY
  ========================================================== */

  const stringToHash = `${endpoint}${PHONEPE_SALT_KEY}`;

  const checksum = crypto
    .createHash("sha256")
    .update(stringToHash)
    .digest("hex");

  const xVerify = `${checksum}###${PHONEPE_SALT_INDEX}`;

  /* ==========================================================
     4. CALL PHONEPE
  ========================================================== */

  const response = await axios.get(`${PHONEPE_BASE_URL}${endpoint}`, {
    headers: {
      "Content-Type": "application/json",

      "X-VERIFY": xVerify,

      "X-MERCHANT-ID": PHONEPE_MERCHANT_ID,
    },

    timeout: 10000,
  });

  const data = response.data;

  /* ==========================================================
     5. RETURN NORMALIZED RESULT
  ========================================================== */

  return {
    success: data?.success === true,

    code: data?.code || null,

    message: data?.message || "",

    state: data?.data?.state || null,

    transactionId: data?.data?.merchantTransactionId || transactionId,

    paymentTransactionId: data?.data?.transactionId || null,

    amount: Number(data?.data?.amount || 0),

    rawResponse: data,
  };
};
