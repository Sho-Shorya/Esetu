import axios from "axios";
import { API_BASE_URL } from "@/lib/constants";

/**
 * Supplier-only client for the phone-order flow.
 *
 * Two families of routes:
 *   - /api/v1/phone-orders  → recording upload, upload limits, created orders
 *   - /api/v1/pilot/phone-call → the pipeline record, its draft and its review
 *
 * Every draft route reads or writes the pilot record only. The single
 * exception is the opt-in `createOrder` flag on confirm, which hands the
 * confirmed draft to the backend bridge — the one place allowed to write an
 * Order. No client here writes an Order directly.
 */

const uploadBase = () => `${API_BASE_URL}/api/v1/phone-orders`;

const pilotBase = () => `${API_BASE_URL}/api/v1/pilot/phone-call`;

const callBase = () => `${API_BASE_URL}/api/v1/phone-call`;

/**
 * Analytics lives beside the pilot, not under it: /api/v1/pilot/analytics.
 * Kept as a separate literal so the path is obvious at the call site.
 */
const analyticsBase = () => `${API_BASE_URL}/api/v1/pilot`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const unwrap = (response) => response.data;

/* ----------------------------- recording upload --------------------------- */

/** The server's own limits: size, duration and accepted file types. */
export const fetchPhoneOrderConfig = async () =>
  unwrap(await axios.get(`${uploadBase()}/config`, { headers: authHeaders() }));

/**
 * The one entry point of the flow. Expects a FormData with `customerUserId`
 * and the recording under `audio`; answers 202 once the bytes are stored and
 * the pipeline has been started in the background.
 */
export const uploadPhoneOrderRecording = async (formData, onUploadProgress) =>
  unwrap(
    await axios.post(`${uploadBase()}/recording`, formData, {
      headers: authHeaders(),
      onUploadProgress,
    }),
  );

/** Orders this supplier's recordings produced, newest first. */
export const fetchCreatedOrders = async (limit = 50) =>
  unwrap(
    await axios.get(`${uploadBase()}/orders`, {
      headers: authHeaders(),
      params: { limit },
    }),
  );

/* ------------------------------ customer picker --------------------------- */

/** Customers the supplier may pick as the shopkeeper on an upload. */
export const fetchCustomerCandidates = async () =>
  unwrap(
    await axios.get(`${callBase()}/supplier/candidates`, {
      headers: authHeaders(),
    }),
  );

/* -------------------------------- pipeline -------------------------------- */

export const fetchPilotCalls = async (limit = 50) =>
  unwrap(
    await axios.get(`${pilotBase()}`, {
      headers: authHeaders(),
      params: { limit },
    }),
  );

export const fetchPilotCall = async (pilotCallId) =>
  unwrap(await axios.get(`${pilotBase()}/${pilotCallId}`, { headers: authHeaders() }));

/**
 * Read-only accuracy report. Aggregated on the server from frozen confirmed
 * drafts; returns no transcript, customer record or order data.
 */
export const fetchPilotAnalytics = async () =>
  unwrap(
    await axios.get(`${analyticsBase()}/analytics`, { headers: authHeaders() }),
  );

/**
 * Audio is private, so it is fetched with the supplier token and handed to the
 * player as an object URL. Callers must revokeObjectURL when done.
 */
export const fetchPilotAudioObjectUrl = async (pilotCallId) => {
  const response = await axios.get(`${pilotBase()}/${pilotCallId}/audio`, {
    headers: authHeaders(),
    responseType: "blob",
  });
  return URL.createObjectURL(response.data);
};

/* ------------------------------- draft review ------------------------------ */

/**
 * Read-only product/brand/variant list for the review pickers. No price, no
 * stock, no cart, no order.
 */
export const fetchPilotReviewCatalog = async () =>
  unwrap(
    await axios.get(`${pilotBase()}/review/catalog`, { headers: authHeaders() }),
  );

/** The supplier's working copy, seeded from the AI draft on first open. */
export const fetchPilotReview = async (pilotCallId) =>
  unwrap(
    await axios.get(`${pilotBase()}/${pilotCallId}/review`, {
      headers: authHeaders(),
    }),
  );

/**
 * One autosave for the entire review screen. Edits, manual adds, removals,
 * restores and explicit resolutions are all sent as a single line list, so
 * correcting an order never costs more than one request.
 */
export const savePilotReview = async (pilotCallId, lines) =>
  unwrap(
    await axios.put(
      `${pilotBase()}/${pilotCallId}/review`,
      { lines },
      {
        headers: authHeaders(),
      },
    ),
  );

/** Adds an item the AI missed. Still only a draft line. */
export const addPilotReviewItem = async (pilotCallId, line) =>
  unwrap(
    await axios.post(`${pilotBase()}/${pilotCallId}/review/items`, line, {
      headers: authHeaders(),
    }),
  );

/**
 * Final action. Saves the supplier-confirmed result on the pilot record.
 *
 * With `createOrder: true` the same tap also asks the bridge to write the real
 * e-Setu Order, so the supplier reviews and orders in one action. Omitted or
 * false, no Order is created.
 */
export const confirmPilotDraft = async (pilotCallId, { createOrder = false } = {}) =>
  unwrap(
    await axios.post(
      `${pilotBase()}/${pilotCallId}/review/confirm`,
      { createOrder },
      {
        headers: authHeaders(),
      },
    ),
  );

/** Undo a confirmation made by mistake. Still cannot create an order. */
export const reopenPilotDraft = async (pilotCallId) =>
  unwrap(
    await axios.post(`${pilotBase()}/${pilotCallId}/review/reopen`, null, {
      headers: authHeaders(),
    }),
  );

/**
 * Re-runs the failed STT -> draft pipeline from the recording already held.
 * Creates no Order. Refused once the call has produced one.
 */
export const retryPilotProcessing = async (pilotCallId) =>
  unwrap(
    await axios.post(`${pilotBase()}/${pilotCallId}/retry`, null, {
      headers: authHeaders(),
    }),
  );
