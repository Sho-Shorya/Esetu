/**
 * Pilot accuracy analytics.
 *
 * Reads only PhoneCallPilot records and only the fields the review step already
 * stored. It creates nothing, mutates nothing, and has no reference to Order,
 * cart, payment, invoice, delivery or customer data.
 *
 * The whole module is pure aggregation over plain objects, so every number it
 * reports is testable without a database.
 *
 * One distinction the dashboard depends on, repeated here because it is easy to
 * get wrong:
 *
 *   AI confidence      the model's own self-reported score. Not accuracy.
 *   Confirmed result   what the supplier approved. Ground truth.
 *   Correction         a field where the supplier's value differs from what the
 *                      AI proposed. The only real accuracy signal we have.
 *
 * Accuracy is therefore derived from corrections and removals, and confidence
 * is reported next to it as a separate, clearly-labelled number.
 */

export const PROBLEMS = {
  product: { label: "Wrong product picked", hint: "AI matched a different product" },
  unresolved: { label: "Product not recognized", hint: "AI could not match anything" },
  variant: { label: "Variant / size mismatch", hint: "Wrong weight or pack size" },
  company: { label: "Wrong company / brand", hint: "Wrong brand for that product" },
  quantity: { label: "Wrong quantity", hint: "Count did not match the call" },
  unit: { label: "Wrong unit", hint: "peti / kg / piece was misread" },
  ambiguous: { label: "Low-confidence match accepted", hint: "Supplier had to confirm a shaky match" },
  invalid: { label: "Invalid value", hint: "Value was not usable as drafted" },
  uncertain_variant: {
    label: "Variant not stated in call",
    hint: "Supplier had to pick the size",
  },
  quantity_unknown: {
    label: "Quantity never stated",
    hint: "Nobody said how many, so the supplier had to supply it",
  },
  merged_mentions: {
    label: "Quantity composed from repeats",
    hint: "The total was added up by the server, not said as one number",
  },
  missing_item: { label: "Missing item added", hint: "AI missed something the customer ordered" },
  spurious_item: { label: "Incorrect item removed", hint: "AI invented something not ordered" },
};

export const DEFAULT_RECENT_LIMIT = 25;

const AI_ORIGINS = new Set(["ai", "ai_unresolved"]);

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value) => (Array.isArray(value) ? value : []);

/** Rounded to a whole percent so the UI never shows 33.333333333%. */
const rate = (part, whole) => {
  const denominator = num(whole);
  if (denominator <= 0) return 0;
  return Math.round((num(part) / denominator) * 1000) / 10;
};

const mean = (values) => {
  const numbers = list(values).filter((value) => Number.isFinite(Number(value)));
  if (!numbers.length) return null;
  const total = numbers.reduce((sum, value) => sum + Number(value), 0);
  return Math.round((total / numbers.length) * 1000) / 1000;
};

/** Only ever the last four digits. An aggregate endpoint has no business
 *  handing out full phone numbers. */
export const maskCaller = (caller) => {
  const raw = typeof caller === "string" ? caller.trim() : "";
  if (!raw) return "unknown caller";
  const digits = raw.replace(/\D/g, "");
  if (digits.length <= 4) return `••••${digits}`;
  return `••••${digits.slice(-4)}`;
};

const plain = (doc) => (typeof doc?.toObject === "function" ? doc.toObject() : doc || {});

/* ------------------------------ per call rollup ---------------------------- */

/**
 * One confirmed draft, reduced to the numbers the dashboard needs.
 *
 * Everything is derived from `review.confirmed`, which is a frozen snapshot
 * taken at confirm time, so re-opening or re-saving a draft can never rewrite
 * history in this report.
 */
export const rollUpConfirmed = (doc) => {
  const record = plain(doc);
  const confirmed = record.review?.confirmed || {};
  const items = list(confirmed.items);
  const counts = confirmed.counts || {};
  const removed = list(confirmed.removed);

  // Prefer the snapshot's flat change list; fall back to the per-line diffs so
  // a record written before the flat list existed still reports corrections.
  // The fallback re-attaches origin and status, because per-line diffs do not
  // carry them and problemsFor needs both to tell a product mistake from a
  // placeholder that simply needed mapping.
  const changes = list(confirmed.changes).length
    ? list(confirmed.changes)
    : items.flatMap((item) =>
        list(item.changes).map((change) => ({
          ...change,
          origin: change.origin ?? item.origin,
          aiStatusAtReview: change.aiStatusAtReview ?? item.aiStatusAtReview,
        })),
      );

  const aiItems = items.filter((item) => AI_ORIGINS.has(item.origin));
  const manualItems = items.filter((item) => item.origin === "manual");
  const changedItems = items.filter((item) => list(item.changes).length > 0);
  const acknowledged = items.filter(
    (item) => item.resolution?.method === "supplier_acknowledged",
  );

  // Flags come from the frozen baseline, not from the post-review status, so a
  // problem the supplier correctly fixed still counts against the extraction.
  const flagged = new Map();
  const addFlag = (status) => {
    if (!status) return;
    flagged.set(status, num(flagged.get(status)) + 1);
  };
  for (const entry of [...items, ...removed]) {
    for (const flag of list(entry.aiFlags)) addFlag(flag);
  }
  // Older snapshots predate aiFlags; fall back to what they do have.
  if (!flagged.size) {
    for (const entry of [...items, ...removed]) {
      const status = entry.aiStatusAtReview;
      if (status && status !== "ok") addFlag(status);
    }
  }

  // Fall back to deriving the AI line count for snapshots confirmed before the
  // count was stored, so historical records still land in the totals.
  const aiLines = num(counts.aiLines, aiItems.length + removed.length);
  const confidenceValues = items
    .map((item) => item.aiConfidence)
    .filter((value) => typeof value === "number" && Number.isFinite(value));

  return {
    pilotCallId: String(record._id ?? ""),
    confirmedAt: confirmed.at || null,
    createdAt: record.createdAt || null,
    caller: maskCaller(record.caller?.raw || record.caller?.normalized),
    source: record.source || "live",

    itemCount: num(confirmed.itemCount, items.length),
    aiLines,
    aiLinesKept: num(counts.aiLinesKept, aiItems.length),
    manualLines: num(counts.manual, manualItems.length),
    removedLines: num(counts.removed, removed.length),
    removedAiLines: num(counts.removedAi, removed.length),

    // A "corrected" line is one the supplier explicitly acted on.
    correctedLines: num(counts.corrected, acknowledged.length),
    // A "changed" line is one whose values actually differ from the AI's.
    changedLines: changedItems.length,
    // Untouched AI lines: the closest honest proxy for a correct extraction.
    cleanAiLines: Math.max(0, aiLines - changedItems.length - removed.length),

    averageConfidence: mean(confidenceValues),
    confidenceSamples: confidenceValues.length,
    flaggedLines: {
      unresolved: num(flagged.get("unresolved")),
      ambiguous: num(flagged.get("ambiguous")),
      uncertainVariant: num(flagged.get("uncertain_variant")),
      quantityUnknown: num(flagged.get("quantity_unknown")),
      mergedMentions: num(flagged.get("merged_mentions")),
      invalid: num(flagged.get("invalid")),
    },

    changes,
    removed,
    // Read only to assert the pilot guarantee in the report; never exposed.
    orderCreated: confirmed.orderCreated === true,
  };
};

/* -------------------------------- problems --------------------------------- */

/**
 * Turns one confirmed draft into a problem tally.
 *
 * Two sources, deliberately not overlapping:
 *
 *   frozen flags    problems the AI's draft contained, including ones the
 *                   supplier fixed or simply accepted. Without these, a shaky
 *                   match that happened to be right would leave no trace.
 *   field diffs     what the supplier actually had to change, which is the
 *                   only evidence of a concrete mistake.
 *
 * A line can land in both, e.g. a product the AI never recognised and the
 * supplier then had to map by hand. That is one unresolved line and one product
 * correction, not two unresolved lines.
 */
export const problemsFor = (rollUp) => {
  const tally = new Map();
  const add = (key, amount = 1) => {
    tally.set(key, num(tally.get(key)) + amount);
  };

  // Keys are the rollUp's own camelCase names, mapped to the problem keys in
  // PROBLEMS. Read with the same spelling they are written with, otherwise
  // uncertain_variant silently never reaches the report.
  const flags = rollUp.flaggedLines || {};
  for (const [flagKey, problemKey] of [
    ["unresolved", "unresolved"],
    ["ambiguous", "ambiguous"],
    ["uncertainVariant", "uncertain_variant"],
    ["quantityUnknown", "quantity_unknown"],
    ["mergedMentions", "merged_mentions"],
    ["invalid", "invalid"],
  ]) {
    if (flags[flagKey]) add(problemKey, flags[flagKey]);
  }

  for (const change of list(rollUp.changes)) {
    if (change.kind) add(change.kind);
  }

  for (const item of list(rollUp.removed)) {
    add("spurious_item");
  }

  if (rollUp.manualLines > 0) add("missing_item", rollUp.manualLines);

  return tally;
};

/* ------------------------------- aggregation ------------------------------- */

const emptyCalls = () => ({
  total: 0,
  confirmed: 0,
  blocked: 0,
  open: 0,
  processing: 0,
  failed: 0,
  noOrderIntent: 0,
});

const emptyDrafts = () => ({
  aiLines: 0,
  confirmedLines: 0,
  correctedLines: 0,
  changedLines: 0,
  cleanAiLines: 0,
  removedLines: 0,
  removedAiLines: 0,
  manualLines: 0,
  unresolvedLines: 0,
  ambiguousLines: 0,
  uncertainVariantLines: 0,
  quantityUnknownLines: 0,
  mergedMentionLines: 0,
  invalidLines: 0,
});

/**
 * The whole report. `records` is any list of PhoneCallPilot documents (lean or
 * not); nothing here touches the database.
 */
export const aggregatePilotAnalytics = (records, { recentLimit = DEFAULT_RECENT_LIMIT } = {}) => {
  const docs = list(records).map(plain);

  const calls = emptyCalls();
  const drafts = emptyDrafts();
  const problemCounts = new Map();
  const rollups = [];
  let confidenceSum = 0;
  let confidenceCount = 0;

  for (const doc of docs) {
    calls.total += 1;

    const stage = doc.pipeline?.stage || "new";
    const reviewStatus = doc.review?.status || "not_started";
    const extractionStatus = doc.extraction?.status || "pending";
    const blockers = list(doc.review?.report?.blockers).length;

    if (stage === "failed") calls.failed += 1;
    else if (extractionStatus !== "completed") calls.processing += 1;
    else if (doc.extraction?.draft?.isOrderIntent === false) calls.noOrderIntent += 1;
    else if (reviewStatus === "confirmed") calls.confirmed += 1;
    else if (blockers > 0) calls.blocked += 1;
    else calls.open += 1;

    if (reviewStatus !== "confirmed" || !doc.review?.confirmed) continue;

    const rollUp = rollUpConfirmed(doc);
    rollups.push(rollUp);

    drafts.aiLines += rollUp.aiLines;
    drafts.confirmedLines += rollUp.itemCount;
    drafts.correctedLines += rollUp.correctedLines;
    drafts.changedLines += rollUp.changedLines;
    drafts.cleanAiLines += rollUp.cleanAiLines;
    drafts.removedLines += rollUp.removedLines;
    drafts.removedAiLines += rollUp.removedAiLines;
    drafts.manualLines += rollUp.manualLines;
    drafts.unresolvedLines += rollUp.flaggedLines.unresolved;
    drafts.ambiguousLines += rollUp.flaggedLines.ambiguous;
  drafts.uncertainVariantLines += rollUp.flaggedLines.uncertainVariant;
  drafts.quantityUnknownLines += rollUp.flaggedLines.quantityUnknown;
  drafts.mergedMentionLines += rollUp.flaggedLines.mergedMentions;
  drafts.invalidLines += rollUp.flaggedLines.invalid;

    for (const [key, amount] of problemsFor(rollUp)) {
      problemCounts.set(key, num(problemCounts.get(key)) + amount);
    }
  }

  // Averaged per AI line across every confirmed draft, so a ten-line call is
  // not given the same weight as a one-line call.
  for (const doc of docs) {
    if (doc.review?.status !== "confirmed" || !doc.review?.confirmed) continue;
    for (const item of list(doc.review.confirmed.items)) {
      const value = Number(item.aiConfidence);
      if (!Number.isFinite(value)) continue;
      confidenceSum += value;
      confidenceCount += 1;
    }
  }

  // Unresolved / ambiguous / uncertain / invalid counts are accumulated per
  // call above, from the frozen per-line flags, so no second pass is needed.

  const totalProblems = [...problemCounts.values()].reduce((sum, value) => sum + value, 0);

  const problems = [...problemCounts.entries()]
    .map(([key, count]) => ({
      key,
      label: PROBLEMS[key]?.label || key,
      hint: PROBLEMS[key]?.hint || "",
      count,
      share: rate(count, totalProblems),
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

  rollups.sort((a, b) => {
    const left = new Date(a.confirmedAt || 0).getTime();
    const right = new Date(b.confirmedAt || 0).getTime();
    return right - left;
  });

  const limit = Math.max(1, Number(recentLimit) || DEFAULT_RECENT_LIMIT);

  return {
    generatedAt: new Date(),
    calls: {
      ...calls,
      // A confirmed draft is the only thing that proves anything.
      confirmationRate: rate(calls.confirmed, calls.total),
    },
    drafts,
    confidence: {
      // Labelled as self-reported on purpose. It is never used as accuracy.
      average: confidenceCount ? Math.round((confidenceSum / confidenceCount) * 1000) / 1000 : null,
      samples: confidenceCount,
      isAccuracy: false,
    },
    rates: {
      // All measured against AI-proposed lines, which is the honest
      // denominator: a human-typed line can never be an AI mistake.
      correction: rate(drafts.changedLines, drafts.aiLines),
      removal: rate(drafts.removedAiLines, drafts.aiLines),
      manualAdd: rate(drafts.manualLines, drafts.confirmedLines),
      clean: rate(drafts.cleanAiLines, drafts.aiLines),
    },
    problems,
    totalProblems,
    recent: rollups.slice(0, limit).map((rollUp) => ({
      pilotCallId: rollUp.pilotCallId,
      confirmedAt: rollUp.confirmedAt,
      caller: rollUp.caller,
      source: rollUp.source,
      aiLines: rollUp.aiLines,
      confirmedLines: rollUp.itemCount,
      corrections: rollUp.changedLines,
      resolved: rollUp.correctedLines,
      removed: rollUp.removedLines,
      added: rollUp.manualLines,
      averageConfidence: rollUp.averageConfidence,
    })),
    integrity: {
      // Re-asserted on every read: the pilot has never made an order.
      confirmedOrders: rollups.filter((rollUp) => rollUp.orderCreated).length,
      pilotConfirmedDrafts: rollups.length,
    },
    notes: [
      "AI confidence is the model's own score, not a measure of correctness.",
      "Correction rate counts AI lines whose values the supplier changed.",
      "Manual lines are supplier-authored and are never counted as AI errors.",
      "All figures come from frozen review.confirmed snapshots only.",
    ],
  };
};

/** True when there is nothing measured yet, so the UI can say so plainly. */
export const isEmptyReport = (report) =>
  !report || report.calls.total === 0 || report.integrity.pilotConfirmedDrafts === 0;
