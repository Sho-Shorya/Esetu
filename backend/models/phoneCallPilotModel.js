import mongoose from "mongoose";

/**
 * A phone call whose audio produced a draft order.
 *
 * The AI draft, transcript, audio reference and every supplier correction are
 * kept here permanently and are never overwritten. A confirmed draft may go on
 * to create exactly one real e-Setu Order, and that order links back to this
 * record through `review.confirmed.orderId` and `Order.phoneCallPilotId`.
 */

/**
 * The states this pipeline can be in, and the only ones a document may be
 * validated against. The recording arrives already uploaded, so there is no
 * dialling or downloading state any more.
 */
const PIPELINE_STAGES = [
  "new",
  "processing_recording",
  "transcribing",
  "extracting",
  "completed",
  "failed",
];

const callerSchema = new mongoose.Schema(
  {
    raw: { type: String, default: null },
    normalized: { type: String, default: null },
    method: { type: String, default: null },
  },
  { _id: false },
);

const customerSchema = new mongoose.Schema(
  {
    matched: { type: Boolean, default: false },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    method: { type: String, default: "exact-10-digit" },
  },
  { _id: false },
);

const audioSchema = new mongoose.Schema(
  {
    // Where the bytes live. "local" is a file on this server's disk, which the
    // deployment target can erase on redeploy; "cloud" is a private, durable
    // asset. Records written before durable storage existed have no value here
    // and only a fileName, and are read as local.
    storage: { type: String, enum: ["local", "cloud", null], default: null },
    // Durable-storage asset id. Present only for a cloud recording, and never
    // exposed to a client: reads go through the authenticated backend routes.
    publicId: { type: String, default: null },
    // The format Cloudinary kept, so a download reproduces the original file
    // rather than a re-encoded one.
    format: { type: String, default: null },
    fileName: { type: String, default: null },
    contentType: { type: String, default: null },
    bytes: { type: Number, default: null },
    sha256: { type: String, default: null },
    originalName: { type: String, default: null },
    source: { type: String, default: null },
    storedAt: { type: Date, default: null },
  },
  { _id: false },
);

const sttSchema = new mongoose.Schema(
  {
    engine: { type: String, default: "sarvam" },
    transport: { type: String, default: null },
    model: { type: String, default: null },
    jobId: { type: String, default: null },
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "skipped"],
      default: "pending",
    },
    transcript: { type: String, default: "" },
    languageCode: { type: String, default: null },
    timestamps: { type: mongoose.Schema.Types.Mixed, default: null },
    speakers: { type: mongoose.Schema.Types.Mixed, default: null },
    // True only when the engine actually returned diarized segments.
    speakerAttributionAvailable: { type: Boolean, default: false },
    // Sarvam merges every input channel into one. There is no true
    // per-leg channel separation in the transcript.
    channelsMerged: { type: Boolean, default: true },
    // Sarvam assumes 16 kHz input, so phone recordings are resampled before
    // upload. Recorded so a bad transcript can be traced to its input format.
    audioInput: { type: mongoose.Schema.Types.Mixed, default: null },
    error: { type: String, default: null },
  },
  { _id: false },
);

const extractionSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "skipped"],
      default: "pending",
    },
    model: { type: String, default: null },
    draft: { type: mongoose.Schema.Types.Mixed, default: null },
    validationErrors: { type: [String], default: [] },
    needsReview: { type: Boolean, default: true },
    error: { type: String, default: null },
  },
  { _id: false },
);

const pipelineErrorSchema = new mongoose.Schema(
  {
    message: { type: String, default: null },
    code: { type: String, default: null },
    at: { type: Date, default: null },
  },
  { _id: false },
);

const pipelineSchema = new mongoose.Schema(
  {
    stage: { type: String, enum: PIPELINE_STAGES, default: "new" },
    startedAt: { type: Date, default: null },
    recordingReadyAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    error: { type: pipelineErrorSchema, default: null },
  },
  { _id: false },
);

/* ----------------------------- supplier review ---------------------------- */

const reviewResolutionSchema = new mongoose.Schema(
  {
    method: {
      type: String,
      enum: ["supplier_product", "supplier_variant", "supplier_acknowledged"],
      default: null,
    },
    at: { type: Date, default: null },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { _id: false },
);

/**
 * One line of the supplier's working copy. A line with no productId is an
 * AI-unresolved placeholder the supplier must map to a real product or remove.
 *
 * `status` / `issues` / `candidates` are written by the server on every save
 * (see pilotDraftReviewService), never trusted from the client.
 */
const reviewLineSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    origin: {
      type: String,
      enum: ["ai", "ai_unresolved", "manual"],
      default: "ai",
    },
    // Kept as a string to match the extraction draft, which never exposes an
    // ObjectId. The live catalog is the only thing allowed to resolve it.
    productId: { type: String, default: null },
    productName: { type: String, default: "" },
    hinglishName: { type: String, default: "" },
    company: { type: String, default: null },
    variantMeasurement: { type: String, default: null },
    // null means the customer never said a quantity. It is deliberately not
    // defaulted to 1, because 1 would be indistinguishable from a real "one"
    // once stored, and repeated mentions of a product have their quantities
    // added together.
    quantity: { type: Number, default: null },
    unit: { type: String, default: "" },
    spokenName: { type: String, default: "" },
    matchedPhrase: { type: String, default: "" },
    reason: { type: String, default: "" },
    confidence: { type: Number, default: null },
    mentions: { type: Number, default: 1 },
    // Frozen copy of what the AI proposed. Corrections are measured against
    // this, never against the previous autosave, so an edit that is undone
    // records nothing.
    baseline: { type: mongoose.Schema.Types.Mixed, default: null },
    // Field-level diff against `baseline`, recomputed on every save.
    changes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    status: {
      type: String,
      enum: [
        "ok",
        "unresolved",
        "ambiguous",
        "uncertain_variant",
        "quantity_unknown",
        "merged_mentions",
        "invalid",
      ],
      default: "ok",
    },
    issues: { type: [String], default: [] },
    candidates: { type: [mongoose.Schema.Types.Mixed], default: [] },
    blocking: { type: Boolean, default: false },
    // Set only by an explicit supplier action, which is what unlocks
    // Confirm Draft for an ambiguous or uncertain line.
    resolution: { type: reviewResolutionSchema, default: null },
    removed: { type: Boolean, default: false },
    removedAt: { type: Date, default: null },
    removedReason: { type: String, default: null },
  },
  { _id: false },
);

const reviewReportSchema = new mongoose.Schema(
  {
    counts: { type: mongoose.Schema.Types.Mixed, default: null },
    blockers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    confirmable: { type: Boolean, default: false },
  },
  { _id: false },
);

/**
 * The supplier-approved result, and the record of the real e-Setu Order it went
 * on to create.
 *
 * `orderCreated` / `orderId` are the duplicate guard: they are set exactly once,
 * and the order itself carries a unique sparse index on the pilot id, so a
 * second confirmation can never produce a second order.
 */
const reviewConfirmedSchema = new mongoose.Schema(
  {
    at: { type: Date, default: null },
    by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    itemCount: { type: Number, default: 0 },
    customerNote: { type: String, default: "" },
    counts: { type: mongoose.Schema.Types.Mixed, default: null },
    corrections: { type: [mongoose.Schema.Types.Mixed], default: [] },
    // Every field the supplier actually changed, with the before/after values.
    changes: { type: [mongoose.Schema.Types.Mixed], default: [] },
    removed: { type: [mongoose.Schema.Types.Mixed], default: [] },
    transcriptLength: { type: Number, default: 0 },
    orderCreated: { type: Boolean, default: false },
    orderId: { type: String, default: null },
    orderCreatedAt: { type: Date, default: null },
    /**
     * Written before the order is created and cleared if creation fails. Two
     * concurrent confirmations race on this single conditional update, so only
     * one of them ever gets to create anything.
     */
    orderClaimedAt: { type: Date, default: null },
    orderClaimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    /**
     * A failed order creation is recorded, never swallowed, and never leaves a
     * half-made order behind.
     */
    orderCreationError: {
      message: { type: String, default: null },
      code: { type: String, default: null },
      at: { type: Date, default: null },
    },
  },
  { _id: false },
);

const reviewSchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: ["not_started", "in_progress", "confirmed"],
      default: "not_started",
    },
    startedAt: { type: Date, default: null },
    updatedAt: { type: Date, default: null },
    lines: { type: [reviewLineSchema], default: [] },
    report: { type: reviewReportSchema, default: null },
    confirmed: { type: reviewConfirmedSchema, default: null },
  },
  { _id: false },
);

const phoneCallPilotSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ["live", "test"], default: "live" },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // The PhoneCall this record belongs to. Set when the call came through the
    // e-Setu calling feature, so a confirmed draft can always be traced back to
    // the real call it was made from.
    phoneCallId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PhoneCall",
      default: null,
      index: true,
      sparse: true,
    },

    caller: { type: callerSchema, default: () => ({}) },
    customer: { type: customerSchema, default: () => ({}) },
    audio: { type: audioSchema, default: () => ({}) },
    stt: { type: sttSchema, default: () => ({}) },
    extraction: { type: extractionSchema, default: () => ({}) },
    pipeline: { type: pipelineSchema, default: () => ({}) },

    // The supplier's working copy, their confirmed draft, and the id of the one
    // real Order that draft produced.
    review: { type: reviewSchema, default: () => ({}) },

    testUpload: {
      uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
      },
      originalName: { type: String, default: null },
    },
  },
  { timestamps: true },
);

export { PIPELINE_STAGES };

/*
 * One pilot record per real call: the upload route creates the call and this
 * record together, and the unique link makes a duplicate upload of the same
 * recording impossible at the database level. The partial filter leaves the
 * many nulls in legacy rows untouched while still making each live call link
 * unique.
 */
phoneCallPilotSchema.index(
  { phoneCallId: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { phoneCallId: { $type: "objectId" } },
  },
);

export default mongoose.model("PhoneCallPilot", phoneCallPilotSchema);
