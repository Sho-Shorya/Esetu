import mongoose from "mongoose";

/**
 * One phone call in the e-Setu calling feature.
 *
 * This is the join point between a real dialled call and the existing
 * PhoneCallPilot pipeline. It exists because the two halves of the flow are
 * recorded separately:
 *
 *   - who called whom, when, for how long, and how it ended  -> this model
 *   - the recording, transcript, AI draft and review           -> PhoneCallPilot
 *
 * A call links to a pilot record through `pilotCallId` once audio exists. Before
 * that the call is a real, logged phone call with no order attached, which is
 * the honest state of a call made on a normal handset.
 */

const CALL_DIRECTION = ["incoming", "outgoing"];

/**
 * How the dialler actually ended. `device` means the handset reported it, which
 * is the only truth available without a telephony provider on the line.
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

const providerSchema = new mongoose.Schema(
  {
    name: { type: String, default: "device" },
    callId: { type: String, default: null, index: true, sparse: true },
    recordingId: { type: String, default: null },
    recordingUrl: { type: String, default: null },
  },
  { _id: false },
);

const recordingSchema = new mongoose.Schema(
  {
    // Local private file only. Never a public URL: audio is streamed through an
    // authenticated endpoint, never served from a guessable path.
    fileName: { type: String, default: null },
    contentType: { type: String, default: null },
    bytes: { type: Number, default: null },
    sha256: { type: String, default: null },
    originalName: { type: String, default: null },
    // Who captured it: a telephony provider, the supplier, or the shopkeeper.
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

    provider: { type: providerSchema, default: () => ({}) },
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
    waitNoticeSentAt: { type: Date, default: null },
    waitUntil: { type: Date, default: null },

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
