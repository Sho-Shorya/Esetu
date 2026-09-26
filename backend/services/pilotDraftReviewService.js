import { buildCatalogProjection, scoreCatalog } from "./orderExtractionService.js";

/**
 * Phase 2 pilot: supplier review of the AI draft.
 *
 * Isolation rules enforced in this file:
 *   - it imports no Order model and no Order controller
 *   - it imports no cart, payment, invoice, delivery or customer code
 *   - the only thing "Confirm Draft" produces is a snapshot stored on the
 *     PhoneCallPilot document itself
 *
 * Everything below is a pure function over plain objects so the whole review
 * rule set is testable without a database, an LLM or a network call.
 */

export const REVIEW_STATUS = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  CONFIRMED: "confirmed",
};

export const LINE_STATUS = {
  OK: "ok",
  UNRESOLVED: "unresolved",
  AMBIGUOUS: "ambiguous",
  UNCERTAIN_VARIANT: "uncertain_variant",
  // The customer never said how many and the model refused to guess, so the
  // number is still missing. It has to be supplied before the draft is real.
  QUANTITY_UNKNOWN: "quantity_unknown",
  // Not a problem with the line, but a warning about where the number came
  // from: the server composed this total out of several mentions instead of
  // transcribing one number the customer gave. Kept separate from the statuses
  // above so it can be shown without blocking a correct order.
  MERGED_MENTIONS: "merged_mentions",
  INVALID: "invalid",
};

export const LINE_ORIGIN = {
  AI: "ai",
  AI_UNRESOLVED: "ai_unresolved",
  MANUAL: "manual",
};

export const RESOLUTION_METHOD = {
  PRODUCT: "supplier_product",
  VARIANT: "supplier_variant",
  ACKNOWLEDGED: "supplier_acknowledged",
};

/**
 * A line the model matched but with low confidence is offered to the supplier
 * as "ambiguous" rather than silently accepted. The supplier can then either
 * pick the right product or explicitly say the match is fine.
 */
export const AMBIGUOUS_CONFIDENCE = Number(
  process.env.PILOT_AMBIGUOUS_CONFIDENCE || 0.65,
);

export const MAX_CANDIDATES = 4;

const trimOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

/**
 * `null` means the quantity is genuinely unknown and has to stay that way until
 * the supplier types one. It must not become 1, because 1 is indistinguishable
 * from a real "one" once it is stored, and the extractor adds quantities of
 * repeated mentions together.
 */
const toQuantity = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = Number(text);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed);
};

export const isValidQuantity = (value) => {
  const parsed = toQuantity(value);
  return parsed !== null && parsed > 0;
};

const isUnstatedQuantity = (value) => toQuantity(value) === null;

/* ------------------------------ catalog access ----------------------------- */

let catalogCache = { at: 0, value: null };
let catalogLoader = buildCatalogProjection;

/**
 * Swaps where the review catalog comes from. Defaults to the live read-only
 * projection; tests and any future read replica can point it elsewhere.
 */
export const setReviewCatalogLoader = (loader) => {
  catalogLoader = typeof loader === "function" ? loader : buildCatalogProjection;
  clearReviewCatalogCache();
};

/**
 * The pickers need product + company + measurement on every save. Reading them
 * straight from Mongo each keystroke would be wasteful, so the read-only
 * projection is cached for a short pilot-only window.
 */
export const getReviewCatalog = async ({ maxAgeMs } = {}) => {
  const ttl = Math.max(0, Number(maxAgeMs ?? process.env.PILOT_CATALOG_CACHE_MS ?? 60000));
  const now = Date.now();

  if (catalogCache.value && now - catalogCache.at < ttl) return catalogCache.value;

  const catalog = await catalogLoader();
  catalogCache = { at: now, value: catalog };
  return catalog;
};

export const clearReviewCatalogCache = () => {
  catalogCache = { at: 0, value: null };
};

const indexCatalog = (catalog) => {
  const list = Array.isArray(catalog) ? catalog : [];
  return {
    list,
    byId: new Map(list.map((product) => [String(product.productId), product])),
  };
};

/* ------------------------------ baseline & diffs --------------------------- */

/**
 * The five things a supplier can correct, mapped to the problem they represent.
 * This is the vocabulary the accuracy dashboard aggregates on, so it lives here
 * next to the values it compares rather than in a second place.
 */
export const CHANGE_FIELDS = [
  { field: "productId", kind: "product" },
  { field: "variantMeasurement", kind: "variant" },
  { field: "company", kind: "company" },
  { field: "quantity", kind: "quantity" },
  { field: "unit", kind: "unit" },
];

const normalizeForDiff = (field, value) => {
  if (field === "quantity") {
    const parsed = toQuantity(value);
    return parsed === null ? null : parsed;
  }
  if (field === "unit") return String(value ?? "").trim().toLowerCase();
  return trimOrNull(value);
};

/**
 * The problems the AI's own draft contained, judged on the AI's values alone.
 *
 * This is captured at seed time and frozen, because a line the supplier
 * correctly fixed would otherwise look clean forever and the dashboard would
 * never learn that the extraction needed work. It is the "as proposed" side of
 * the ledger; `changes` is the "as confirmed" side.
 */
export const baselineFlags = (line) => {
  const flags = [];

  if (line?.origin === LINE_ORIGIN.AI_UNRESOLVED || !trimOrNull(line?.productId)) {
    flags.push(LINE_STATUS.UNRESOLVED);
  }

  if (isUnstatedQuantity(line?.quantity)) {
    flags.push(LINE_STATUS.QUANTITY_UNKNOWN);
  } else if (!isValidQuantity(line?.quantity)) {
    flags.push(LINE_STATUS.INVALID);
  }

  // A model that reported no confidence at all has not said it is sure. Treating
  // that as trustworthy is how a shaky match reaches a confirmed draft.
  if (line?.origin !== LINE_ORIGIN.MANUAL) {
    const confidence = typeof line?.confidence === "number" ? line.confidence : null;
    if (confidence === null || confidence < AMBIGUOUS_CONFIDENCE) {
      flags.push(LINE_STATUS.AMBIGUOUS);
    }
  }

  if (!trimOrNull(line?.variantMeasurement) || !trimOrNull(line?.company)) {
    flags.push(LINE_STATUS.UNCERTAIN_VARIANT);
  }

  if (Number(line?.mentions) > 1) {
    flags.push(LINE_STATUS.MERGED_MENTIONS);
  }

  return [...new Set(flags)];
};

/**
 * Freezes what the AI actually proposed for a line.
 *
 * Diffs are measured against this, not against the previous autosave, so
 * typing 2 -> 3 -> 2 and landing back on 2 records no correction at all, which
 * is the only honest answer for "what did the supplier actually change".
 */
const freezeBaseline = (line) => ({
  productId: trimOrNull(line?.productId),
  productName: trimOrNull(line?.productName) || "",
  company: trimOrNull(line?.company),
  variantMeasurement: trimOrNull(line?.variantMeasurement),
  // Kept as null when unknown, so the diff against a supplier-typed number reads
  // as "the AI never gave one" rather than as a change from 1.
  quantity: toQuantity(line?.quantity),
  unit: trimOrNull(line?.unit) || "",
  confidence: typeof line?.confidence === "number" ? line.confidence : null,
  // Derived from the AI's own output, not from the catalog, so it stays valid
  // even for a line the supplier later replaced entirely.
  flags: baselineFlags(line),
});

/**
 * Every field where the supplier's confirmed value differs from the AI's
 * proposal. A line the supplier authored by hand has no baseline and therefore
 * no changes: it was never the AI's claim to be right or wrong about.
 */
export const diffLine = (line) => {
  const baseline = line?.baseline;
  if (!baseline) return [];

  return CHANGE_FIELDS.map(({ field, kind }) => {
    const from = normalizeForDiff(field, baseline[field]);
    const to = normalizeForDiff(field, line?.[field]);
    if (from === to) return null;
    return { field, kind, from, to };
  }).filter(Boolean);
};

/* --------------------------------- seeding --------------------------------- */

let keyCounter = 0;

const nextKey = (origin) => {
  keyCounter += 1;
  return `${origin}-${Date.now().toString(36)}-${keyCounter}`;
};

/**
 * Turns the read-only AI draft into editable supplier lines.
 *
 * AI-matched items and AI-unresolved placeholders both become lines, so the
 * supplier works through one list. An unresolved placeholder carries no
 * productId and must be mapped to a real product or removed before the draft
 * can be confirmed.
 */
export const seedReviewLines = ({ draft } = {}) => {
  const source = draft || {};
  const items = Array.isArray(source.items) ? source.items : [];
  const unresolved = Array.isArray(source.unresolved) ? source.unresolved : [];

  const lines = items.map((item) => ({
    key: nextKey(LINE_ORIGIN.AI),
    origin: LINE_ORIGIN.AI,
    productId: trimOrNull(item?.productId),
    productName: trimOrNull(item?.productName) || "",
    hinglishName: trimOrNull(item?.hinglishName) || "",
    company: trimOrNull(item?.company),
    variantMeasurement: trimOrNull(item?.variantMeasurement),
    quantity: toQuantity(item?.quantity),
    unit: trimOrNull(item?.unit) || "",
    spokenName: trimOrNull(item?.matchedPhrase) || "",
    matchedPhrase: trimOrNull(item?.matchedPhrase) || "",
    reason: "",
    confidence: typeof item?.confidence === "number" ? item.confidence : null,
    mentions: Number.isInteger(item?.mentions) ? item.mentions : 1,
    resolution: null,
    removed: false,
    removedAt: null,
    removedReason: null,
  }));

  const placeholders = unresolved.map((entry) => ({
    key: nextKey(LINE_ORIGIN.AI_UNRESOLVED),
    origin: LINE_ORIGIN.AI_UNRESOLVED,
    productId: null,
    productName: "",
    hinglishName: "",
    company: null,
    variantMeasurement: null,
    quantity: 1,
    unit: "",
    spokenName: trimOrNull(entry?.spokenName) || "",
    matchedPhrase: trimOrNull(entry?.spokenName) || "",
    reason: trimOrNull(entry?.reason) || "not matched to catalog",
    confidence: null,
    mentions: 1,
    resolution: null,
    removed: false,
    removedAt: null,
    removedReason: null,
  }));

  // Frozen last, so the baseline is exactly what the AI proposed.
  return [...lines, ...placeholders].map((line) => ({ ...line, baseline: freezeBaseline(line) }));
};

/**
 * A line the supplier typed themselves. It gets no baseline, which is what
 * makes "corrected" mean "the AI was wrong" rather than "a human typed".
 */
export const createManualLine = (input = {}) => ({
  key: nextKey(LINE_ORIGIN.MANUAL),
  origin: LINE_ORIGIN.MANUAL,
  productId: trimOrNull(input.productId),
  productName: trimOrNull(input.productName) || "",
  hinglishName: trimOrNull(input.hinglishName) || "",
  company: trimOrNull(input.company),
  variantMeasurement: trimOrNull(input.variantMeasurement),
  quantity: toQuantity(input.quantity),
  unit: trimOrNull(input.unit) || "",
  spokenName: trimOrNull(input.spokenName) || "",
  matchedPhrase: trimOrNull(input.spokenName) || "",
  reason: "",
  confidence: null,
  mentions: 1,
  baseline: null,
  resolution: null,
  removed: false,
  removedAt: null,
  removedReason: null,
});

/* ------------------------------ line checking ------------------------------ */

/**
 * Alternate products for a flagged line, so the supplier can fix an ambiguous
 * match in one tap instead of retyping a search. Reuses the extractor's
 * lexical scorer instead of paying for another LLM call.
 */
export const candidateProductsFor = (line, catalog) => {
  const { list, byId } = indexCatalog(catalog);
  if (!list.length) return [];

  const phrase = trimOrNull(line?.matchedPhrase) || trimOrNull(line?.spokenName);
  if (!phrase) return [];

  const ranked = scoreCatalog(list, phrase).filter((entry) => entry.score > 0);
  const seen = new Set();
  const candidates = [];

  for (const entry of ranked) {
    const product = entry.product;
    const productId = String(product.productId);
    if (seen.has(productId)) continue;
    seen.add(productId);
    candidates.push({
      productId,
      productName: product.name || "",
      hinglishName: product.hinglishName || "",
      score: entry.score,
      isCurrent: productId === String(line?.productId || ""),
    });
    if (candidates.length >= MAX_CANDIDATES) break;
  }

  // The currently matched product is always offered, even when the phrase does
  // not lexically reach it, otherwise the supplier could not confirm their pick.
  const currentId = String(line?.productId || "");
  if (currentId && !seen.has(currentId) && byId.has(currentId)) {
    const product = byId.get(currentId);
    candidates.unshift({
      productId: currentId,
      productName: product.name || "",
      hinglishName: product.hinglishName || "",
      score: 0,
      isCurrent: true,
    });
  }

  return candidates.slice(0, MAX_CANDIDATES);
};

const isExplicitlyResolved = (line) => {
  const method = line?.resolution?.method;
  return (
    method === RESOLUTION_METHOD.PRODUCT ||
    method === RESOLUTION_METHOD.VARIANT ||
    method === RESOLUTION_METHOD.ACKNOWLEDGED
  );
};

/**
 * Grades one supplier line against the live catalog.
 *
 * `status` is the problem to show, `blocking` is whether it must be dealt with
 * before Confirm Draft is allowed. An ambiguous or uncertain-variant line stops
 * blocking only once the supplier has explicitly acted on it, which is why
 * `resolution` matters and not just the current field values.
 */
export const checkLine = (line, catalog) => {
  const { byId } = indexCatalog(catalog);
  const issues = [];

  const productId = trimOrNull(line?.productId);
  const product = productId ? byId.get(productId) : null;

  if (!productId) {
    issues.push(
      line?.origin === LINE_ORIGIN.AI_UNRESOLVED
        ? `AI could not match “${line?.spokenName || "this item"}”: ${line?.reason || "not in catalog"}.`
        : "No product selected.",
    );
    return {
      status: LINE_STATUS.UNRESOLVED,
      issues,
      blocking: true,
      candidates: candidateProductsFor(line, catalog),
    };
  }

  if (!product) {
    issues.push("This product is no longer in the catalog. Pick another product.");
    return {
      status: LINE_STATUS.INVALID,
      issues,
      blocking: true,
      candidates: candidateProductsFor(line, catalog),
    };
  }

  let quantityValid = true;
  let quantityUnstated = false;
  if (isUnstatedQuantity(line?.quantity)) {
    // "Nobody said how many" is a different problem from "that is not a number",
    // and it is the one that must never be papered over with a 1.
    quantityValid = false;
    quantityUnstated = true;
    issues.push(`No quantity was stated for ${product.name}. Enter how many.`);
  } else if (!isValidQuantity(line?.quantity)) {
    quantityValid = false;
    issues.push("Quantity must be a whole number of 1 or more.");
  }

  const variants = Array.isArray(product.variants) ? product.variants : [];
  const measurements = new Set(
    variants.map((variant) => trimOrNull(variant.measurement)).filter(Boolean),
  );
  const companies = new Set(
    variants.map((variant) => trimOrNull(variant.company)).filter(Boolean),
  );

  const measurement = trimOrNull(line?.variantMeasurement);
  const company = trimOrNull(line?.company);

  // "Not stated" is an uncertainty the supplier can settle by choosing.
  // "Stated but wrong" is a validation error that has to be corrected.
  let uncertain = false;
  if (!measurement) {
    uncertain = true;
    issues.push("Variant (size/weight) was not stated. Pick the right one.");
  } else if (!measurements.has(measurement)) {
    issues.push(`“${measurement}” is not a variant of ${product.name}. Pick a listed variant.`);
  }

  if (!company) {
    uncertain = true;
    issues.push("Company/brand was not stated. Pick the right one.");
  } else if (!companies.has(company)) {
    issues.push(`“${company}” does not make ${product.name}. Pick a listed company.`);
  }

  if (quantityUnstated) {
    return {
      status: LINE_STATUS.QUANTITY_UNKNOWN,
      issues,
      blocking: true,
      candidates: [],
    };
  }

  if (issues.length) {
    return {
      status:
        uncertain && quantityValid ? LINE_STATUS.UNCERTAIN_VARIANT : LINE_STATUS.INVALID,
      issues,
      blocking: true,
      candidates: [],
    };
  }

  // A missing confidence is not evidence of a good match. The model is asked to
  // report one, and a line that came back without one is exactly the line the
  // supplier has to look at, so it is offered as ambiguous rather than waved
  // through. In a real recording every line came back at a flat 0.95, which
  // would otherwise have made this whole check unreachable.
  const confidence = typeof line?.confidence === "number" ? line.confidence : null;
  const aiLine = line?.origin === LINE_ORIGIN.AI;
  const notTrustworthy =
    aiLine && (confidence === null || confidence < AMBIGUOUS_CONFIDENCE);
  const lowConfidence = notTrustworthy && !isExplicitlyResolved(line);

  if (lowConfidence) {
    return {
      status: LINE_STATUS.AMBIGUOUS,
      issues: [
        confidence === null
          ? `The AI did not report how sure it was that this is ${product.name}. Confirm or change it.`
          : `AI was only ${Math.round(confidence * 100)}% sure this is ${product.name}. Confirm or change it.`,
      ],
      blocking: true,
      candidates: candidateProductsFor(line, catalog),
    };
  }

  // A total the server added up out of several mentions is arithmetic, not
  // transcription: the customer never said that number. It has to be waved
  // through explicitly, because a repeat mention is exactly where an unstated
  // quantity turns into a wrong total.
  const composed = (line?.baseline?.flags || []).includes(LINE_STATUS.MERGED_MENTIONS);
  if (composed && !isExplicitlyResolved(line)) {
    return {
      status: LINE_STATUS.MERGED_MENTIONS,
      issues: [
        `The customer mentioned this ${line.mentions} times and the total was added up. Check ${product.name} is ${line.quantity}.`,
      ],
      blocking: true,
      candidates: [],
    };
  }

  return { status: LINE_STATUS.OK, issues: [], blocking: false, candidates: [] };
};

/* -------------------------------- reporting -------------------------------- */

const emptyCounts = () => ({
  total: 0,
  kept: 0,
  removed: 0,
  ok: 0,
  unresolved: 0,
  ambiguous: 0,
  uncertainVariant: 0,
  quantityUnknown: 0,
  mergedMentions: 0,
  invalid: 0,
});

/**
 * Grades the whole draft. This is the single source of truth for the badge
 * counts, the blocker list and the Confirm Draft gate, so the screen and the
 * server can never disagree about whether a draft is confirmable.
 */
export const reviewDraft = ({ lines, catalog } = {}) => {
  const source = Array.isArray(lines) ? lines : [];
  const graded = [];

  for (const line of source) {
    if (line?.removed) {
      graded.push({
        ...line,
        status: LINE_STATUS.OK,
        issues: [],
        blocking: false,
        candidates: [],
        changes: diffLine(line),
      });
      continue;
    }

    const verdict = checkLine(line, catalog);
    graded.push({ ...line, ...verdict, changes: diffLine(line) });
  }

  const counts = emptyCounts();
  counts.total = source.length;

  for (const line of graded) {
    if (line.removed) {
      counts.removed += 1;
      continue;
    }
    counts.kept += 1;
    if (line.status === LINE_STATUS.OK) counts.ok += 1;
    if (line.status === LINE_STATUS.UNRESOLVED) counts.unresolved += 1;
    if (line.status === LINE_STATUS.AMBIGUOUS) counts.ambiguous += 1;
    if (line.status === LINE_STATUS.UNCERTAIN_VARIANT) counts.uncertainVariant += 1;
    if (line.status === LINE_STATUS.QUANTITY_UNKNOWN) counts.quantityUnknown += 1;
    // Not a status a graded line can hold, so it is read off the frozen baseline
    // where the merge was recorded.
    if ((line.baseline?.flags || []).includes(LINE_STATUS.MERGED_MENTIONS)) {
      counts.mergedMentions += 1;
    }
    if (line.status === LINE_STATUS.INVALID) counts.invalid += 1;
  }

  const blockers = graded
    .filter((line) => line.blocking)
    .map((line) => ({
      key: line.key,
      status: line.status,
      productName: line.productName || line.spokenName || "Item",
      messages: line.issues,
    }));

  return {
    lines: graded,
    counts,
    blockers,
    // A draft with no lines at all is nothing to confirm.
    confirmable: blockers.length === 0 && counts.kept > 0,
  };
};

export const describeBlockers = (blockers) => {
  if (!Array.isArray(blockers) || blockers.length === 0) return null;

  const count = blockers.length;
  return (
    `Resolve ${count} item${count === 1 ? "" : "s"} before confirming: ` +
    blockers
      .slice(0, 3)
      .map((blocker) => blocker.productName)
      .join(", ") +
    (count > 3 ? `, +${count - 3} more` : "") +
    "."
  );
};

/**
 * A line the supplier is allowed to explicitly wave through. Anything else has
 * to be fixed by editing it: a product-less line can never be acknowledged,
 * because "looks right" on nothing is not a decision.
 */
export const canAcknowledge = (line) => {
  if (!line || line.removed) return false;
  if (!trimOrNull(line.productId)) return false;
  if (line.status === LINE_STATUS.INVALID) return false;
  return (
    line.status === LINE_STATUS.AMBIGUOUS ||
    line.status === LINE_STATUS.UNCERTAIN_VARIANT ||
    line.status === LINE_STATUS.MERGED_MENTIONS
  );
};

/* ------------------------------ confirmation ------------------------------ */

const listFlags = (baseline) =>
  Array.isArray(baseline?.flags) ? baseline.flags.filter(Boolean) : [];

const snapshotLine = (line) => ({
  productId: line.productId || null,
  productName: line.productName || "",
  hinglishName: line.hinglishName || "",
  company: line.company || null,
  variantMeasurement: line.variantMeasurement || null,
  quantity: Number(line.quantity),
  unit: line.unit || "",
  spokenName: line.spokenName || "",
  matchedPhrase: line.matchedPhrase || "",
  origin: line.origin,
  aiConfidence: typeof line.confidence === "number" ? line.confidence : null,
  aiStatusAtReview: line.status || LINE_STATUS.OK,
  // Problems present in the AI's own draft, frozen at seed time.
  aiFlags: listFlags(line.baseline),
  // What the AI originally proposed, kept so the dashboard can show the
  // before/after of a correction without re-reading the transcript.
  aiBaseline: line.baseline || null,
  // Field-level diff against that baseline. This is the supplier's actual
  // correction, which is a different thing from the AI's own confidence.
  changes: Array.isArray(line.changes) ? line.changes : diffLine(line),
  resolution: line.resolution
    ? {
        method: line.resolution.method,
        at: line.resolution.at || null,
      }
    : null,
});

/**
 * Builds the payload stored on PhoneCallPilot.review.confirmed.
 *
 * This is the whole point of the pilot step: a supplier-approved record that is
 * useful to measure against real orders later. `orderCreated` is written as
 * false and no order-shaped object is produced here.
 */
export const buildConfirmedSnapshot = ({ report, draft, confirmedBy, confirmedAt } = {}) => {
  const graded = Array.isArray(report?.lines) ? report.lines : [];
  const kept = graded.filter((line) => !line.removed);
  const removed = graded.filter((line) => line.removed);
  const source = draft || {};

  // AI-proposed lines, kept and removed alike. A hallucinated line the supplier
  // threw away still proves the AI proposed it, so it belongs in the denominator.
  const aiLines = graded.filter(
    (line) => line.origin === LINE_ORIGIN.AI || line.origin === LINE_ORIGIN.AI_UNRESOLVED,
  );
  const manualLines = kept.filter((line) => line.origin === LINE_ORIGIN.MANUAL);

  return {
    at: confirmedAt || new Date(),
    by: confirmedBy || null,
    items: kept.map(snapshotLine),
    itemCount: kept.length,
    customerNote: trimOrNull(source.customerNote) || "",
    counts: {
      // Total AI-proposed lines, the denominator for every rate below.
      aiLines: aiLines.length,
      aiLinesKept: kept.filter(
        (line) => line.origin === LINE_ORIGIN.AI || line.origin === LINE_ORIGIN.AI_UNRESOLVED,
      ).length,
      fromAi: kept.filter((line) => line.origin === LINE_ORIGIN.AI).length,
      manual: manualLines.length,
      mappedFromUnresolved: kept.filter((line) => line.origin === LINE_ORIGIN.AI_UNRESOLVED)
        .length,
      corrected: kept.filter((line) => Boolean(line.resolution)).length,
      changed: kept.filter((line) => (line.changes || []).length > 0).length,
      removed: removed.length,
      removedAi: removed.filter(
        (line) => line.origin === LINE_ORIGIN.AI || line.origin === LINE_ORIGIN.AI_UNRESOLVED,
      ).length,
    },
    corrections: kept
      .filter((line) => Boolean(line.resolution))
      .map((line) => ({
        productId: line.productId || null,
        productName: line.productName || "",
        heardAs: line.matchedPhrase || line.spokenName || "",
        method: line.resolution.method,
        aiStatus: line.origin === LINE_ORIGIN.MANUAL ? "manual" : line.status,
      })),
    /**
     * Every field the supplier actually changed, keyed by the kind of problem
     * it represents. This is the raw material for the accuracy dashboard.
     */
    changes: kept.flatMap((line) =>
      (line.changes || []).map((change) => ({
        kind: change.kind,
        field: change.field,
        from: change.from ?? null,
        to: change.to ?? null,
        productId: line.productId || null,
        productName: line.productName || "",
        heardAs: line.matchedPhrase || line.spokenName || "",
        origin: line.origin,
        aiStatusAtReview: line.status || LINE_STATUS.OK,
      })),
    ),
    removed: removed.map((line) => ({
      productId: line.productId || null,
      productName: line.productName || line.spokenName || "",
      quantity: Number(line.quantity) || null,
      origin: line.origin,
      heardAs: line.matchedPhrase || line.spokenName || "",
      aiStatusAtReview: line.status || LINE_STATUS.OK,
      aiFlags: listFlags(line.baseline),
      aiConfidence: typeof line.confidence === "number" ? line.confidence : null,
      reason: line.removedReason || line.reason || "removed by supplier",
    })),
    transcriptLength: (source.transcript || "").length,
    // Hard guarantee, asserted here and re-asserted by the controller.
    orderCreated: false,
    orderId: null,
  };
};

/* ------------------------------ normalising ------------------------------- */

/**
 * Accepts whatever the screen sent and rebuilds trustworthy lines from it.
 * Field values are taken from the client (the supplier is the authority), but
 * product names, statuses and issues are always recomputed here.
 */
export const normalizeLines = (incoming, catalog) => {
  const { byId } = indexCatalog(catalog);
  const list = Array.isArray(incoming) ? incoming : [];
  const seen = new Set();

  return list.map((raw) => {
    const productId = trimOrNull(raw?.productId);
    const product = productId ? byId.get(productId) : null;
    let key = trimOrNull(raw?.key);

    if (!key || seen.has(key)) key = nextKey(raw?.origin || LINE_ORIGIN.MANUAL);
    seen.add(key);

    const method = raw?.resolution?.method;
    const resolutionMethod = Object.values(RESOLUTION_METHOD).includes(method)
      ? method
      : null;

    return {
      key,
      origin: Object.values(LINE_ORIGIN).includes(raw?.origin) ? raw.origin : LINE_ORIGIN.MANUAL,
      productId: product ? product.productId : productId,
      // Never trust a client-supplied name for a real product.
      productName: product ? product.name || "" : "",
      hinglishName: product ? product.hinglishName || "" : "",
      company: trimOrNull(raw?.company),
      variantMeasurement: trimOrNull(raw?.variantMeasurement),
      quantity: toQuantity(raw?.quantity),
      unit: trimOrNull(raw?.unit) || "",
      spokenName: trimOrNull(raw?.spokenName) || "",
      matchedPhrase: trimOrNull(raw?.matchedPhrase) || "",
      reason: trimOrNull(raw?.reason) || "",
      confidence: typeof raw?.confidence === "number" ? raw.confidence : null,
      mentions: Number.isInteger(raw?.mentions) ? raw.mentions : 1,
      // Carried through untouched: it is the AI's original proposal and must
      // never be rewritten by a later save, or corrections would vanish.
      baseline: raw?.baseline ?? freezeBaseline(raw),
      resolution: resolutionMethod
        ? {
            method: resolutionMethod,
            at: raw?.resolution?.at || null,
            by: raw?.resolution?.by || null,
          }
        : null,
      removed: raw?.removed === true,
      removedAt: raw?.removedAt || null,
      removedReason: trimOrNull(raw?.removedReason),
    };
  });
};

export const publicReview = (doc) => {
  const plain = typeof doc?.toObject === "function" ? doc.toObject() : doc || {};
  const review = plain.review || {};

  return {
    status: review.status || REVIEW_STATUS.NOT_STARTED,
    startedAt: review.startedAt || null,
    updatedAt: review.updatedAt || null,
    lines: Array.isArray(review.lines) ? review.lines : [],
    report: review.report || null,
    confirmed: review.confirmed || null,
  };
};

/* -------------------------- review state changes -------------------------- */

/** Writes a graded line list onto the document. Never touches anything else. */
const applyLines = (doc, report, now) => {
  doc.review.status = REVIEW_STATUS.IN_PROGRESS;
  doc.review.startedAt = doc.review.startedAt || now;
  doc.review.updatedAt = now;
  doc.review.lines = report.lines;
  doc.review.report = {
    counts: report.counts,
    blockers: report.blockers,
    confirmable: report.confirmable,
  };
};

/**
 * First open of the review. Seeds the supplier's working copy from the AI draft
 * so the screen never has to build lines itself.
 */
export const openReview = ({ doc, catalog, now } = {}) => {
  const at = now || new Date();
  const lines = seedReviewLines({ draft: doc?.extraction?.draft });
  const report = reviewDraft({ lines, catalog });

  applyLines(doc, report, at);
  return report;
};

/**
 * Autosave. Field values come from the supplier because they are the authority,
 * but names, statuses, issues and candidates are always recomputed here, so a
 * hand-crafted request cannot mark a broken line as clean.
 */
export const saveReviewLines = ({ doc, incomingLines, catalog, now } = {}) => {
  const at = now || new Date();
  const lines = normalizeLines(incomingLines, catalog);
  const report = reviewDraft({ lines, catalog });

  applyLines(doc, report, at);
  return report;
};

/** Adds an item the AI missed. Validated exactly like every other line. */
export const addManualReviewLine = ({ doc, input, userId, catalog, now } = {}) => {
  const at = now || new Date();
  const line = createManualLine(input || {});

  line.resolution = {
    method: line.productId ? RESOLUTION_METHOD.PRODUCT : null,
    at,
    by: userId || null,
  };

  const report = reviewDraft({ lines: [...(doc.review?.lines || []), line], catalog });
  applyLines(doc, report, at);
  return report;
};

const blockerSummary = (counts) => {
  const reasons = [];
  if (counts.unresolved) reasons.push(`${counts.unresolved} unresolved`);
  if (counts.quantityUnknown) reasons.push(`${counts.quantityUnknown} missing quantity`);
  if (counts.ambiguous) reasons.push(`${counts.ambiguous} ambiguous`);
  if (counts.uncertainVariant) reasons.push(`${counts.uncertainVariant} uncertain variant`);
  if (counts.invalid) reasons.push(`${counts.invalid} invalid`);
  return reasons;
};

/**
 * The final supplier action on the draft itself.
 *
 * Refused while any line is unresolved, ambiguous, uncertain or invalid, unless
 * the supplier explicitly resolved that line during review. On success the
 * result is written to PhoneCallPilot.review.confirmed and nowhere else: this
 * function still creates no Order, which is what lets the supplier review first
 * and order second. Turning the confirmed draft into a real order is the
 * separate, explicit bridge in phoneOrderBridgeService.
 */
export const confirmReviewDraft = ({ doc, catalog, userId, now } = {}) => {
  const at = now || new Date();
  const lines = doc.review?.lines?.length
    ? normalizeLines(doc.review.lines, catalog)
    : seedReviewLines({ draft: doc?.extraction?.draft });

  const report = reviewDraft({ lines, catalog });

  if (!report.confirmable) {
    return {
      ok: false,
      code: "REVIEW_BLOCKED",
      status: 422,
      message:
        describeBlockers(report.blockers) ||
        `Cannot confirm: ${blockerSummary(report.counts).join(", ")}.`,
      report,
    };
  }

  const confirmed = buildConfirmedSnapshot({
    report,
    draft: {
      customerNote: doc?.extraction?.draft?.customerNote,
      transcript: doc?.stt?.transcript || "",
    },
    confirmedBy: userId || null,
    confirmedAt: at,
  });

  doc.review.lines = report.lines;
  doc.review.report = { counts: report.counts, blockers: [], confirmable: true };
  doc.review.status = REVIEW_STATUS.CONFIRMED;
  doc.review.updatedAt = at;
  doc.review.confirmed = confirmed;

  return {
    ok: true,
    status: 200,
    confirmed,
    message: `${confirmed.itemCount} आइटम कन्फर्म हो गए।`,
    report,
  };
};

/** Undo a confirmation made by mistake. Still cannot create an order. */
export const reopenReview = ({ doc, now } = {}) => {
  const at = now || new Date();
  doc.review.status = REVIEW_STATUS.IN_PROGRESS;
  doc.review.confirmed = null;
  doc.review.updatedAt = at;
  return publicReview(doc);
};
