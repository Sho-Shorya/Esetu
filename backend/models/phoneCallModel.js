import mongoose from "mongoose";

/**
 * One phone call in the e-Setu phone-order flow.
 *
 * This is the join point between a call the supplier made on their own phone
 * and the existing PhoneCallPilot pipeline. It exists because the two halves of
 * the flow are recorded separately:
 *
 *   - who called whom, when, for how long                 -> this model
 *   - the recording, transcript, AI draft and review      -> PhoneCallPilot
 *
 * The call is created together with its pilot record when the supplier uploads
 * the recording, so `pilotCallId` is set from the start.
 */

const CALL_DIRECTION = ["incoming", "outgoing"];

/**
 * How the call ended, as reported by whoever reported it (today: the supplier's
 * upload, which records a completed call).
 */
const CALL_STATUS = [
  "initiated",
  "ringing",
  "answered",
  "completed",
  "failed",
  "no_answer",
  "cancelled",
  "missed",
];

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "no_answer",
  "cancelled",
  "missed",
]);

/**
 * Where the call is in the order pipeline, from the caller's point of view.
 * Kept separate from `status` so "the call failed" and "the order failed" never
 * get confused.
 */
const PROCESSING_STATUS = [
  "no_audio",
  "waiting_audio",
  "processing",
  "draft_ready",
  "needs_review",
  "confirmed",
  "order_created",
  "failed",
];

const recordingSchema = new mongoose.Schema(
  {
    // Where the bytes live. "local" is a file on this server's disk, which the
    // deployment target can erase on redeploy; "cloud" is a private, durable
    // asset. Records written before durable storage existed have no value here
    // and only a fileName, and are read as local.
    storage: { type: String, enum: ["local", "cloud", null], default: null },
    // Durable-storage asset id. Present only for a cloud recording, and never
    // exposed to a client: playback goes through an authenticated route.
    publicId: { type: String, default: null },
    // The format durable storage kept, so a download reproduces the original
    // file rather than a re-encoded one.
    format: { type: String, default: null },
    // A local private file. Never a public URL: audio is streamed through an
    // authenticated endpoint, never served from a guessable path.
    fileName: { type: String, default: null },
    contentType: { type: String, default: null },
    bytes: { type: Number, default: null },
    sha256: { type: String, default: null },
    originalName: { type: String, default: null },
    // Who captured it: the supplier, or the shopkeeper. "provider" stays a
    // legal value only so recordings made before the upload flow exist keep
    // saving cleanly — nothing writes it any more.
    capturedBy: {
      type: String,
      enum: ["provider", "supplier", "shopkeeper", null],
      default: null,
    },
    storedAt: { type: Date, default: null },
  },
  { _id: false },
);

const partySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // null with no matched userId means an unknown caller. The supplier is
    // allowed to attach the customer later; the system never guesses one.
    phoneNumber: { type: String, default: null },
    name: { type: String, default: "" },
    // "exact-10-digit" when matched on the number we already hold, "manual" when
    // a human picked the customer, null when nobody could be identified.
    matchMethod: { type: String, default: null },
    matched: { type: Boolean, default: false },
  },
  { _id: false },
);

const phoneCallSchema = new mongoose.Schema(
  {
    direction: {
      type: String,
      enum: CALL_DIRECTION,
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: CALL_STATUS,
      default: "initiated",
      index: true,
    },

    processingStatus: {
      type: String,
      enum: PROCESSING_STATUS,
      default: "no_audio",
      index: true,
    },

    from: { type: partySchema, default: () => ({}) },
    to: { type: partySchema, default: () => ({}) },

    // The shopkeeper who placed the call, for outgoing calls. Lets the calling
    // screen show "हाल की कॉल" without exposing anyone else's calls.
    initiatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    initiatedByRole: {
      type: String,
      enum: ["shopkeeper", "supplier", null],
      default: null,
    },

    // The supplier whose phone section lists this call.
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // The supplier who picked the unknown customer themselves.
    customerIdentifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    recording: { type: recordingSchema, default: () => ({}) },

    // The transcript/draft/review record this call feeds.
    pilotCallId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhoneCallPilot",
      default: null,
      index: true,
      sparse: true,
    },

    callAt: { type: Date, default: null, index: true },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSeconds: { type: Number, default: null },

    // Set when the supplier confirms the draft and an order is created.
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      default: null,
    },
    orderCreatedAt: { type: Date, default: null },

    // Never silently swallow a failure: this is what the screen shows instead
    // of a wrong order.
    lastError: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      at: { type: Date, default: null },
    },
  },
  { timestamps: true },
);

/* Supplier phone section: newest first, per supplier. */
phoneCallSchema.index({ supplierId: 1, callAt: -1 });
phoneCallSchema.index(
  { supplierId: 1, "recording.sha256": 1 },
  {
    unique: true,
    partialFilterExpression: { "recording.sha256": { $type: "string" } },
  },
);
/* Shopkeeper calling screen: newest first, per user. */
phoneCallSchema.index({ initiatedBy: 1, callAt: -1 });
/* Calls waiting for order review, most urgent first. */
phoneCallSchema.index({ supplierId: 1, processingStatus: 1, callAt: -1 });

export { CALL_DIRECTION, CALL_STATUS, PROCESSING_STATUS, TERMINAL_STATUSES };

export default mongoose.model("PhoneCall", phoneCallSchema);
