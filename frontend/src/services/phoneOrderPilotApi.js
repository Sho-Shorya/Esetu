import axios from "axios";
import { API_BASE_URL } from "@/lib/constants";

/**
 * Supplier-only client for the Phase 1 phone-call pilot.
 *
 * Every draft route here reads or writes the pilot record only. The single
 * exception is the opt-in `createOrder` flag on confirm, which hands the
 * confirmed draft to the backend bridge — the one place allowed to write an
 * Order. No client here writes an Order directly.
 */

const base = () => `${API_BASE_URL}/api/v1/pilot/phone-call`;

/**
 * Analytics lives beside the pilot, not under it: /api/v1/pilot/analytics.
 * Kept as a separate literal so the path is obvious at the call site.
 */
const analyticsBase = () => `${API_BASE_URL}/api/v1/pilot`;

const authHeaders = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});

const unwrap = (response) => response.data;

export const fetchPilotCapability = async () =>
  unwrap(await axios.get(`${base()}/capability`, { headers: authHeaders() }));

export const fetchPilotCalls = async (limit = 50) =>
  unwrap(
    await axios.get(`${base()}`, {
      headers: authHeaders(),
      params: { limit },
    }),
  );

export const fetchPilotCall = async (pilotCallId) =>
  unwrap(
    await axios.get(`${base()}/${pilotCallId}`, { headers: authHeaders() }),
  );

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
  const response = await axios.get(`${base()}/${pilotCallId}/audio`, {
    headers: authHeaders(),
    responseType: "blob",
  });
  return URL.createObjectURL(response.data);
};

export const uploadTestAudio = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append("audio", file);

  return unwrap(
    await axios.post(`${base()}/test-audio`, formData, {
      headers: authHeaders(),
      onUploadProgress,
    }),
  );
};

/* ------------------------------- draft review ------------------------------ */

/**
 * Read-only product/brand/variant list for the review pickers. No price, no
 * stock, no cart, no order.
 */
export const fetchPilotReviewCatalog = async () =>
  unwrap(
    await axios.get(`${base()}/review/catalog`, { headers: authHeaders() }),
  );

/** The supplier's working copy, seeded from the AI draft on first open. */
export const fetchPilotReview = async (pilotCallId) =>
  unwrap(
    await axios.get(`${base()}/${pilotCallId}/review`, {
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
      `${base()}/${pilotCallId}/review`,
      { lines },
      {
        headers: authHeaders(),
      },
    ),
  );

/** Adds an item the AI missed. Still only a draft line. */
export const addPilotReviewItem = async (pilotCallId, line) =>
  unwrap(
    await axios.post(`${base()}/${pilotCallId}/review/items`, line, {
      headers: authHeaders(),
    }),
  );

/**
 * Final pilot action. Saves the supplier-confirmed result on the pilot record.
 *
 * With `createOrder: true` the same tap also asks the bridge to write the real
 * e-Setu Order, so the supplier reviews and orders in one action. Omitted or
 * false, no Order is created.
 */
export const confirmPilotDraft = async (pilotCallId, { createOrder = false } = {}) =>
  unwrap(
    await axios.post(
      `${base()}/${pilotCallId}/review/confirm`,
      { createOrder },
      {
        headers: authHeaders(),
      },
    ),
  );

/** Undo a confirmation made by mistake. Still cannot create an order. */
export const reopenPilotDraft = async (pilotCallId) =>
  unwrap(
    await axios.post(`${base()}/${pilotCallId}/review/reopen`, null, {
      headers: authHeaders(),
    }),
  );

/** Creates the production Order only from a supplier-confirmed pilot draft. */
export const createOrderFromConfirmedPilotCall = async (pilotCallId) =>
  unwrap(
    await axios.post(
      `${API_BASE_URL}/api/v1/phone-call/drafts/${pilotCallId}/order`,
      {},
      { headers: authHeaders() },
    ),
  );

/**
 * Re-runs the failed STT -> draft pipeline from the recording already held.
 * Creates no Order. Refused once the call has produced one.
 */
export const retryPilotProcessing = async (pilotCallId) =>
  unwrap(
    await axios.post(`${base()}/${pilotCallId}/retry`, null, {
      headers: authHeaders(),
    }),
  );
