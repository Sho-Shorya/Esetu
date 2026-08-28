import axios from "axios";

/*
|--------------------------------------------------------------------------
| PhonePe Configuration (v2 / OAuth)
|--------------------------------------------------------------------------
| .env needed:
|
| PHONEPE_AUTH_BASE_URL=https://api-preprod.phonepe.com/apis/pg-sandbox   (sandbox)
| PHONEPE_BASE_URL=https://api-preprod.phonepe.com/apis/pg-sandbox        (sandbox)
| PHONEPE_CLIENT_ID=...
| PHONEPE_CLIENT_SECRET=...
| PHONEPE_CLIENT_VERSION=1
| PHONEPE_REDIRECT_URL=https://your-frontend.com/payment/status
|
| NOTE: In PRODUCTION, the auth/token host is different from the
| payment host (identity-manager vs pg). Check your PhonePe dashboard
| for the exact production auth URL before going live.
|--------------------------------------------------------------------------
*/

/*
 * The Payment Gateway host and the Authorization (token) host are
 * DIFFERENT in production:
 *
 *   sandbox:
 *     token  -> https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token
 *     payment-> https://api-preprod.phonepe.com/apis/pg-sandbox/...
 *
 *   production:
 *     token  -> https://api.phonepe.com/apis/identity-manager/v1/oauth/token
 *     payment-> https://api.phonepe.com/apis/pg/...
 *
 * PHONEPE_AUTH_BASE_URL MUST be set explicitly before going live. The
 * fallback to PHONEPE_BASE_URL is only correct for the sandbox host.
 */

const PHONEPE_AUTH_BASE_URL =
  process.env.PHONEPE_AUTH_BASE_URL || process.env.PHONEPE_BASE_URL;

const PHONEPE_BASE_URL = process.env.PHONEPE_BASE_URL;

const isProductionEnvironment = () => {
  const base = String(PHONEPE_BASE_URL || "");

  return /api\.phonepe\.com\/apis\/pg/.test(base);
};

const PHONEPE_CLIENT_ID = process.env.PHONEPE_CLIENT_ID;

const PHONEPE_CLIENT_SECRET = process.env.PHONEPE_CLIENT_SECRET;

const PHONEPE_CLIENT_VERSION = process.env.PHONEPE_CLIENT_VERSION || "1";

const PHONEPE_REDIRECT_URL = process.env.PHONEPE_REDIRECT_URL;

/*
|--------------------------------------------------------------------------
| Validate Configuration
|--------------------------------------------------------------------------
*/

const validatePhonePeConfig = () => {
  const missing = [];

  if (!PHONEPE_AUTH_BASE_URL) missing.push("PHONEPE_AUTH_BASE_URL");
  if (!PHONEPE_BASE_URL) missing.push("PHONEPE_BASE_URL");
  if (!PHONEPE_CLIENT_ID) missing.push("PHONEPE_CLIENT_ID");
  if (!PHONEPE_CLIENT_SECRET) missing.push("PHONEPE_CLIENT_SECRET");
  if (!PHONEPE_REDIRECT_URL) missing.push("PHONEPE_REDIRECT_URL");

  if (missing.length > 0) {
    throw new Error(
      `Missing PhonePe environment variables: ${missing.join(", ")}`,
    );
  }

  if (isProductionEnvironment() && !process.env.PHONEPE_AUTH_BASE_URL) {
    throw new Error(
      "PHONEPE_AUTH_BASE_URL must be set explicitly for production. " +
        "Use https://api.phonepe.com/apis/identity-manager.",
    );
  }
};

export const isPhonePeConfigured = () => {
  if (
    !PHONEPE_AUTH_BASE_URL ||
    !PHONEPE_BASE_URL ||
    !PHONEPE_CLIENT_ID ||
    !PHONEPE_CLIENT_SECRET ||
    !PHONEPE_REDIRECT_URL
  ) {
    return false;
  }

  if (isProductionEnvironment() && !process.env.PHONEPE_AUTH_BASE_URL) {
    return false;
  }

  return true;
};

/*
|--------------------------------------------------------------------------
| Axios Client
|--------------------------------------------------------------------------
*/

const phonePeClient = axios.create({
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/*
|--------------------------------------------------------------------------
| OAuth Token (cached in memory, refetched when near expiry)
|--------------------------------------------------------------------------
*/

let cachedToken = null;
let cachedTokenExpiryMs = 0;

const fetchAccessToken = async () => {
  const now = Date.now();

  if (cachedToken && now < cachedTokenExpiryMs - 60000) {
    return cachedToken;
  }

  const params = new URLSearchParams({
    client_id: PHONEPE_CLIENT_ID,
    client_version: PHONEPE_CLIENT_VERSION,
    client_secret: PHONEPE_CLIENT_SECRET,
    grant_type: "client_credentials",
  });

  const response = await axios.post(
    `${PHONEPE_AUTH_BASE_URL}/v1/oauth/token`,
    params,
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } },
  );

  const data = response.data;

  cachedToken = data.access_token;
  cachedTokenExpiryMs = Number(data.expires_at) * 1000;

  if (!cachedToken) {
    throw new Error("PhonePe did not return an access token.");
  }

  return cachedToken;
};

/*
|--------------------------------------------------------------------------
| Generate Merchant Order ID
|--------------------------------------------------------------------------
*/

export const generateMerchantOrderId = (userId) => {
  const timestamp = Date.now();
  const randomPart = Math.random().toString(36).substring(2, 10);

  return `ESETU_${timestamp}_${userId.toString().slice(-6)}_${randomPart}`;
};

/*
|--------------------------------------------------------------------------
| Convert INR <-> Paise
|--------------------------------------------------------------------------
*/

export const rupeesToPaise = (amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error("Invalid payment amount.");
  }

  return Math.round(numericAmount * 100);
};

export const paiseToRupees = (amount) => {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount < 0) {
    throw new Error("Invalid paise amount.");
  }

  return numericAmount / 100;
};

/*
|--------------------------------------------------------------------------
| Create PhonePe Payment
|--------------------------------------------------------------------------
*/

export const createPhonePePayment = async ({
  merchantOrderId,
  amount,
  userId,
}) => {
  validatePhonePeConfig();

  if (!merchantOrderId) throw new Error("Merchant order ID is required.");
  if (!userId) throw new Error("User ID is required.");

  const amountInPaise = rupeesToPaise(amount);

  if (amountInPaise <= 0) {
    throw new Error("Payment amount must be greater than zero.");
  }

  const token = await fetchAccessToken();

  const payload = {
    merchantOrderId,
    amount: amountInPaise,
    paymentFlow: {
      type: "PG_CHECKOUT",
      merchantUrls: {
        redirectUrl: PHONEPE_REDIRECT_URL,
      },
    },
  };

  try {
    const response = await phonePeClient.post(
      `${PHONEPE_BASE_URL}/checkout/v2/pay`,
      payload,
      { headers: { Authorization: `O-Bearer ${token}` } },
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      "PhonePe create payment error:",
      error.response?.data || error.message,
    );

    const phonePeMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "PhonePe payment creation failed.";

    throw new Error(phonePeMessage);
  }
};

/*
|--------------------------------------------------------------------------
| Get PhonePe Payment Status
|--------------------------------------------------------------------------
*/

export const getPhonePePaymentStatus = async (merchantOrderId) => {
  validatePhonePeConfig();

  if (!merchantOrderId) throw new Error("Merchant order ID is required.");

  const token = await fetchAccessToken();

  try {
    const response = await phonePeClient.get(
      `${PHONEPE_BASE_URL}/checkout/v2/order/${encodeURIComponent(
        merchantOrderId,
      )}/status`,
      { headers: { Authorization: `O-Bearer ${token}` } },
    );

    return { success: true, data: response.data };
  } catch (error) {
    console.error(
      "PhonePe payment status error:",
      error.response?.data || error.message,
    );

    const phonePeMessage =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      "Unable to check PhonePe payment status.";

    throw new Error(phonePeMessage);
  }
};

/*
|--------------------------------------------------------------------------
| Normalize PhonePe Status
|--------------------------------------------------------------------------
*/

export const normalizePhonePeStatus = (response) => {
  if (!response) return "PENDING";

  /*
   * PhonePe can return the order status in several shapes:
   *
   *   1) Flat:            { state: "COMPLETED", amount, paymentDetails }
   *   2) Wrapped:         { success, code, message, data: { state, ... } }
   *   3) data.response:   { success, code, message, data: { response: { state, ... } } }
   *   4) PayPage handler: { success, code, message, data: { state, ... } }
   *
   * We descend into every layer below `state`/`status`/`orderState` and, if an
   * order-level state is not available, fall back to the FIRST payment-attempt
   * state (which is what actually tells us whether money moved for UPI).
   */

  const candidates = [
    response?.state,
    response?.status,
    response?.orderState,
    response?.data?.state,
    response?.data?.status,
    response?.data?.orderState,
    response?.data?.response?.state,
    response?.data?.response?.status,
    response?.data?.response?.orderState,
    response?.data?.transaction?.state,
  ].filter((v) => v != null && v !== "");

  let firstNonNullState = candidates[0] || "PENDING";

  /*
   * Only fall back to the payment-attempt state if the order-level state is
   * PENDING/unknown but a payment attempt has a concrete terminal state. UPI
   * sometimes leaves the order state as PENDING momentarily even though the
   * actual attempt already COMPLETED.
   */
  const orderLevelState = candidates.find((s) => {
    const n = String(s).toUpperCase();
    return !["PENDING", ""].includes(n);
  });

  if (orderLevelState) {
    firstNonNullState = orderLevelState;
  } else {
    const attemptState =
      response?.paymentDetails?.[0]?.state ||
      response?.data?.paymentDetails?.[0]?.state ||
      response?.data?.response?.paymentDetails?.[0]?.state ||
      response?.data?.paymentDetails?.at?.(-1)?.state ||
      null;

    if (attemptState) {
      const n = String(attemptState).toUpperCase();
      if (!["PENDING", ""].includes(n)) {
        firstNonNullState = attemptState;
      }
    }
  }

  const normalized = String(firstNonNullState).toUpperCase();

  if (["SUCCESS", "COMPLETED", "PAID"].includes(normalized)) return "SUCCESS";

  if (["FAILED", "FAILURE", "CANCELLED", "CANCELED"].includes(normalized))
    return "FAILED";

  if (["EXPIRED", "TIMEOUT"].includes(normalized)) return "EXPIRED";

  return "PENDING";
};

/*
|--------------------------------------------------------------------------
| Extract PhonePe Transaction ID
|--------------------------------------------------------------------------
*/

export const extractPhonePeTransactionId = (response) => {
  const nested = response?.data?.response;
  const inner = response?.data;

  const lastAttempt =
    inner?.paymentDetails?.[inner?.paymentDetails?.length - 1] ||
    inner?.response?.paymentDetails?.at?.(-1) ||
    response?.paymentDetails?.[response?.paymentDetails?.length - 1] ||
    null;

  return (
    response?.transactionId ||
    response?.providerReferenceId ||
    inner?.transactionId ||
    inner?.providerReferenceId ||
    nested?.transactionId ||
    nested?.providerReferenceId ||
    lastAttempt?.transactionId ||
    inner?.paymentDetails?.[0]?.transactionId ||
    response?.paymentDetails?.[0]?.transactionId ||
    nested?.paymentDetails?.[0]?.transactionId ||
    null
  );
};
