import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import {
  aggregatePilotAnalytics,
  isEmptyReport,
  maskCaller,
  PROBLEMS,
  rollUpConfirmed,
} from "../services/pilotAnalyticsService.js";
import {
  buildConfirmedSnapshot,
  confirmReviewDraft,
  createManualLine,
  diffLine,
  LINE_ORIGIN,
  REVIEW_STATUS,
  seedReviewLines,
} from "../services/pilotDraftReviewService.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, "..");

/* ------------------------------- fixtures --------------------------------- */

const catalogEntry = (id, name, company, measurement) => ({
  productId: id,
  name,
  hinglishName: name,
  aliases: [],
  variants: [{ companyId: `${id}-${company}`, company, measurement }],
});

const makeCatalog = () => [
  catalogEntry("p1", "Sona Masoori Rice", "Daawat", "5 kg"),
  catalogEntry("p2", "Toor Dal", "Daawat", "1 kg"),
  catalogEntry("p3", "Sugar", "Dhampure", "10 kg"),
];

const gradedLine = (overrides = {}) => {
  const [line] = seedReviewLines({
    draft: {
      items: [
        {
          productId: "p1",
          productName: "Sona Masoori Rice",
          hinglishName: "sona chawal",
          company: "Daawat",
          variantMeasurement: "5 kg",
          quantity: 1,
          unit: "peti",
          matchedPhrase: "sona chawal",
          confidence: 0.9,
        },
      ],
    },
  });

  return {
    ...line,
    status: "ok",
    issues: [],
    blocking: false,
    candidates: [],
    ...overrides,
  };
};

const snapshot = (overrides = {}) => ({
  at: new Date("2026-03-01T10:00:00.000Z"),
  by: "supplier-1",
  items: [],
  itemCount: 0,
  customerNote: "",
  counts: {},
  corrections: [],
  changes: [],
  removed: [],
  transcriptLength: 120,
  orderCreated: false,
  orderId: null,
  ...overrides,
});

const confirmedCall = (confirmed, extra = {}) => ({
  _id: extra._id || "call-1",
  caller: { raw: "+919812345678", normalized: "+919812345678" },
  source: "live",
  createdAt: new Date("2026-03-01T09:59:00.000Z"),
  pipeline: { stage: "review" },
  extraction: { status: "completed", draft: { isOrderIntent: true } },
  review: { status: "confirmed", confirmed, ...(extra.review || {}) },
  ...extra.top,
});

/* ------------------------------ change tracking --------------------------- */

test("baseline is frozen from the AI proposal and diffLine reports the real edit", () => {
  const line = gradedLine();
  assert.equal(line.baseline.productId, "p1");
  assert.equal(line.baseline.quantity, 1);

  const edited = { ...line, quantity: 3, variantMeasurement: "10 kg" };
  const changes = diffLine(edited);

  assert.deepEqual(
    changes.map((change) => change.kind).sort(),
    ["quantity", "variant"],
  );
  const quantity = changes.find((change) => change.kind === "quantity");
  assert.equal(quantity.from, 1);
  assert.equal(quantity.to, 3);
});

test("an edit that is reverted records no correction", () => {
  const line = gradedLine();
  // 1 -> 3 -> 1 against a baseline of 1.
  const reverted = { ...line, quantity: 1 };
  assert.deepEqual(diffLine(reverted), []);
});

test("manual lines have no baseline so a human edit is not an AI error", () => {
  assert.deepEqual(seedReviewLines({ draft: { items: [] } }), []);

  const [aiLine] = seedReviewLines({
    draft: {
      items: [
        {
          productId: "p1",
          productName: "Sona Masoori Rice",
          company: "Daawat",
          variantMeasurement: "5 kg",
          confidence: 0.9,
          quantity: 1,
          unit: "peti",
        },
      ],
    },
  });
  assert.ok(aiLine.baseline, "AI line must carry a baseline");

  const result = confirmReviewDraft({
    doc: { review: { lines: [{ ...aiLine, status: "ok", issues: [], blocking: false }] } },
    catalog: makeCatalog(),
    userId: "supplier-1",
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  // Untouched, so nothing to correct.
  assert.deepEqual(result.confirmed.changes, []);
  assert.equal(result.confirmed.counts.aiLines, 1);
  assert.equal(result.confirmed.orderCreated, false);
});

test("a manual line carries no baseline, so editing it is not an AI correction", () => {
  const manual = createManualLine({ productName: "Jeera", quantity: 2, unit: "kg" });
  assert.equal(manual.origin, LINE_ORIGIN.MANUAL);
  assert.equal(manual.baseline, null);
  assert.deepEqual(diffLine({ ...manual, quantity: 9 }), []);
});

/* -------------------------------- empty ----------------------------------- */

test("no pilot calls yields a zeroed, non-crashing report", () => {
  const report = aggregatePilotAnalytics([]);
  assert.equal(report.calls.total, 0);
  assert.equal(report.calls.confirmed, 0);
  assert.equal(report.drafts.aiLines, 0);
  assert.equal(report.confidence.average, null);
  assert.deepEqual(report.problems, []);
  assert.deepEqual(report.recent, []);
  // No denominator means no misleading percentage.
  assert.equal(report.rates.correction, 0);
  assert.equal(report.rates.removal, 0);
  assert.ok(isEmptyReport(report));
});

/* ------------------------------ single draft ------------------------------ */

test("one confirmed call reports its lines, confidence and no corrections", () => {
  const confirmed = snapshot({
    items: [
      {
        productId: "p1",
        productName: "Sona Masoori Rice",
        origin: LINE_ORIGIN.AI,
        aiConfidence: 0.9,
        aiFlags: [],
        changes: [],
      },
      {
        productId: "p2",
        productName: "Toor Dal",
        origin: LINE_ORIGIN.AI,
        aiConfidence: 0.7,
        aiFlags: [],
        changes: [],
      },
    ],
    itemCount: 2,
    counts: { aiLines: 2, aiLinesKept: 2, fromAi: 2, manual: 0, corrected: 0, removed: 0 },
  });

  const report = aggregatePilotAnalytics([confirmedCall(confirmed)]);
  assert.equal(report.calls.confirmed, 1);
  assert.equal(report.drafts.confirmedLines, 2);
  assert.equal(report.drafts.aiLines, 2);
  assert.equal(report.confidence.average, 0.8);
  assert.equal(report.rates.correction, 0);
  assert.equal(report.rates.clean, 100);
  assert.equal(report.recent.length, 1);
  // The raw phone number must not leave the service.
  assert.equal(report.recent[0].caller, "••••5678");
});

/* --------------------------- multiple drafts ------------------------------ */

test("multiple calls aggregate and are ordered newest first", () => {
  const older = confirmedCall(
    snapshot({
      at: new Date("2026-03-01T10:00:00.000Z"),
      items: [{ productId: "p1", origin: LINE_ORIGIN.AI, aiConfidence: 0.5, changes: [] }],
      itemCount: 1,
      counts: { aiLines: 1, aiLinesKept: 1, fromAi: 1, removed: 0 },
    }),
    { _id: "older" },
  );
  const newer = confirmedCall(
    snapshot({
      at: new Date("2026-03-02T10:00:00.000Z"),
      items: [
        { productId: "p1", origin: LINE_ORIGIN.AI, aiConfidence: 0.9, changes: [] },
        { productId: "p3", origin: LINE_ORIGIN.AI, aiConfidence: 0.9, changes: [] },
      ],
      itemCount: 2,
      counts: { aiLines: 2, aiLinesKept: 2, fromAi: 2, removed: 0 },
    }),
    { _id: "newer" },
  );

  const report = aggregatePilotAnalytics([older, newer]);
  assert.equal(report.calls.total, 2);
  assert.equal(report.calls.confirmed, 2);
  assert.equal(report.drafts.aiLines, 3);
  // 0.5, 0.9, 0.9 -> 0.767, weighted per line rather than per call.
  assert.equal(report.confidence.average, 0.767);
  assert.equal(report.confidence.samples, 3);
  assert.equal(report.recent[0].pilotCallId, "newer");
  assert.equal(report.recent[1].pilotCallId, "older");
});

test("recent list is capped and unconfirmed calls are excluded", () => {
  const many = Array.from({ length: 30 }, (_, index) =>
    confirmedCall(snapshot({ at: new Date(2026, 2, index + 1) }), { _id: `call-${index}` }),
  );
  const notConfirmed = confirmedCall(snapshot(), {
    _id: "pending",
    review: { status: REVIEW_STATUS.IN_REVIEW, report: { blockers: ["missing quantity"] } },
  });

  const report = aggregatePilotAnalytics([...many, notConfirmed], { recentLimit: 5 });
  assert.equal(report.recent.length, 5);
  assert.equal(report.calls.confirmed, 30);
  // A draft still awaiting review is "blocked", not confirmed.
  assert.equal(report.calls.blocked, 1);
  assert.equal(report.drafts.confirmedLines, 0);
});

/* ------------------------------ corrections ------------------------------- */

test("field corrections are counted per line and broken down by kind", () => {
  const confirmed = snapshot({
    items: [
      {
        productId: "p1",
        origin: LINE_ORIGIN.AI,
        aiConfidence: 0.9,
        aiFlags: [],
        changes: [{ kind: "variant", from: "5 kg", to: "10 kg" }],
      },
      {
        productId: "p2",
        origin: LINE_ORIGIN.AI,
        aiConfidence: 0.8,
        aiFlags: [],
        changes: [
          { kind: "quantity", from: 1, to: 2 },
          { kind: "unit", from: "peti", to: "kg" },
        ],
      },
    ],
    itemCount: 2,
    counts: { aiLines: 4, aiLinesKept: 2, fromAi: 2, corrected: 2, removed: 0 },
  });

  const report = aggregatePilotAnalytics([confirmedCall(confirmed)]);
  assert.equal(report.drafts.changedLines, 2);
  // 2 corrected of 4 AI-proposed lines.
  assert.equal(report.rates.correction, 50);

  const byKey = Object.fromEntries(report.problems.map((entry) => [entry.key, entry.count]));
  assert.equal(byKey.variant, 1);
  assert.equal(byKey.quantity, 1);
  assert.equal(byKey.unit, 1);
  assert.equal(report.problems[0].label, PROBLEMS.quantity.label);
});

test("manual lines raise the add rate but never the correction rate", () => {
  const confirmed = snapshot({
    items: [
      { productId: "p1", origin: LINE_ORIGIN.AI, aiConfidence: 0.9, aiFlags: [], changes: [] },
      { productId: null, origin: LINE_ORIGIN.MANUAL, aiConfidence: null, aiFlags: [], changes: [] },
    ],
    itemCount: 2,
    counts: { aiLines: 1, aiLinesKept: 1, fromAi: 1, manual: 1, corrected: 0, removed: 0 },
  });

  const report = aggregatePilotAnalytics([confirmedCall(confirmed)]);
  assert.equal(report.rates.manualAdd, 50);
  assert.equal(report.rates.correction, 0);
  assert.equal(report.drafts.manualLines, 1);
  const missing = report.problems.find((entry) => entry.key === "missing_item");
  assert.equal(missing.count, 1);
});

/* -------------------------------- removals -------------------------------- */

test("removals are AI mistakes and count toward the removal rate", () => {
  const confirmed = snapshot({
    items: [{ productId: "p1", origin: LINE_ORIGIN.AI, aiConfidence: 0.9, aiFlags: [], changes: [] }],
    itemCount: 1,
    counts: { aiLines: 3, aiLinesKept: 1, fromAi: 1, removed: 2, removedAi: 2 },
    removed: [
      { productName: "Sugar", origin: LINE_ORIGIN.AI, aiFlags: [], aiStatusAtReview: "ok" },
      { productName: "Toor Dal", origin: LINE_ORIGIN.AI, aiFlags: [], aiStatusAtReview: "ok" },
    ],
  });

  const report = aggregatePilotAnalytics([confirmedCall(confirmed)]);
  assert.equal(report.drafts.removedLines, 2);
  assert.equal(report.rates.removal, 66.7);
  const spurious = report.problems.find((entry) => entry.key === "spurious_item");
  assert.equal(spurious.count, 2);
});

/* ------------------- unresolved / ambiguous reporting ---------------------- */

test("unresolved and ambiguous lines are reported from the frozen AI flags", () => {
  const confirmed = snapshot({
    items: [
      // Supplier picked the right product, but the AI never recognised it.
      {
        productId: "p2",
        origin: LINE_ORIGIN.AI_UNRESOLVED,
        aiConfidence: null,
        aiFlags: ["unresolved"],
        changes: [{ kind: "product", from: null, to: "p2" }],
      },
      // Low-confidence match the supplier had to confirm.
      {
        productId: "p3",
        origin: LINE_ORIGIN.AI,
        aiConfidence: 0.4,
        aiFlags: ["ambiguous", "uncertain_variant"],
        changes: [],
      },
    ],
    itemCount: 2,
    counts: { aiLines: 2, aiLinesKept: 2, fromAi: 1, manual: 0, corrected: 0, removed: 0 },
  });

  const report = aggregatePilotAnalytics([confirmedCall(confirmed)]);
  assert.equal(report.drafts.unresolvedLines, 1);
  assert.equal(report.drafts.ambiguousLines, 1);
  assert.equal(report.drafts.uncertainVariantLines, 1);

  const byKey = Object.fromEntries(report.problems.map((entry) => [entry.key, entry.count]));
  assert.equal(byKey.unresolved, 1);
  assert.equal(byKey.ambiguous, 1);
});

test("a problem the supplier fixed still counts against the extraction", () => {
  // The line ended ok and uncorrected, but the AI's draft was ambiguous. The
  // frozen flags are the only reason this is still visible.
  const confirmed = snapshot({
    items: [
      { productId: "p1", origin: LINE_ORIGIN.AI, aiConfidence: 0.4, aiFlags: ["ambiguous"], changes: [] },
    ],
    itemCount: 1,
    counts: { aiLines: 1, aiLinesKept: 1, fromAi: 1, corrected: 0, removed: 0 },
  });

  const report = aggregatePilotAnalytics([confirmedCall(confirmed)]);
  assert.equal(report.drafts.ambiguousLines, 1);
  assert.equal(report.rates.correction, 0);
  assert.equal(report.rates.clean, 100);
});

test("older snapshots without aiFlags fall back to their review status", () => {
  const rollUp = rollUpConfirmed(
    confirmedCall(
      snapshot({
        items: [
          { productId: "p1", origin: LINE_ORIGIN.AI, aiConfidence: 0.9, aiStatusAtReview: "ambiguous" },
        ],
        itemCount: 1,
        counts: { aiLines: 1, aiLinesKept: 1, fromAi: 1, removed: 0 },
      }),
    ),
  );
  assert.equal(rollUp.flaggedLines.ambiguous, 1);
});

/* -------------------------- confidence vs accuracy ------------------------ */

test("high confidence with heavy corrections is not reported as accurate", () => {
  const confirmed = snapshot({
    items: Array.from({ length: 4 }, (_, index) => ({
      productId: `p${index + 1}`,
      origin: LINE_ORIGIN.AI,
      aiConfidence: 0.95,
      aiFlags: [],
      changes: [{ kind: "product", from: `p${index + 1}`, to: "p9" }],
    })),
    itemCount: 4,
    counts: { aiLines: 4, aiLinesKept: 4, fromAi: 4, corrected: 4, removed: 0 },
  });

  const report = aggregatePilotAnalytics([confirmedCall(confirmed)]);
  assert.equal(report.confidence.average, 0.95);
  assert.equal(report.confidence.isAccuracy, false);
  assert.equal(report.rates.correction, 100);
  assert.equal(report.rates.clean, 0);
});

/* ------------------------------- integrity -------------------------------- */

test("the report never reports a pilot order and never counts order data", () => {
  const report = aggregatePilotAnalytics([
    confirmedCall(snapshot({ counts: { aiLines: 0, removed: 0 } })),
  ]);
  assert.equal(report.integrity.confirmedOrders, 0);
  assert.equal(report.integrity.pilotConfirmedDrafts, 1);
  assert.ok(!Object.keys(report).includes("orders"));
});

test("maskCaller keeps only the last four digits", () => {
  assert.equal(maskCaller("+91 98123-45678"), "••••5678");
  assert.equal(maskCaller("9812"), "••••9812");
  assert.equal(maskCaller(""), "unknown caller");
  assert.equal(maskCaller(undefined), "unknown caller");
});

/* --------------------------- isolation guarantees ------------------------- */

test("analytics service imports no order, cart or payment code", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "services", "pilotAnalyticsService.js"),
    "utf8",
  );
  // Only the import block matters. The prose explains the isolation, and the
  // word "order" appears there on purpose.
  const imports = [...source.matchAll(/^\s*(?:import|export)[^;]*from\s+["']([^"']+)["']/gm)]
    .map((match) => match[1]);

  assert.deepEqual(imports, [], "analytics service must import nothing at all");
});

test("the analytics service reaches no model and no database", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "services", "pilotAnalyticsService.js"),
    "utf8",
  );
  // Comments and identifiers are excluded: this file explains its own
  // isolation in prose, and "confirmedOrders" is a report key, not an import.
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  for (const forbidden of [
    "PhoneCallPilot",
    "mongoose",
    ".find(",
    ".findOne",
    ".aggregate(",
    ".save(",
    ".create(",
    "axios",
    "fetch(",
  ]) {
    assert.ok(!code.includes(forbidden), `analytics service must not use ${forbidden}`);
  }
  assert.ok(!/\bOrder\b/.test(code), "analytics service must not reference the Order model");
  assert.ok(!/\b(Cart|Payment|Invoice)\b/.test(code), "no cart, payment or invoice code");
});

test("analytics endpoint is supplier-only and mounted at /api/v1/pilot/analytics", () => {
  const routes = fs.readFileSync(path.join(projectRoot, "routes", "pilotAnalyticsRoutes.js"), "utf8");
  assert.match(routes, /isAuthenticated/);
  assert.match(routes, /isSupp/);
  assert.match(routes, /router\.get\("\/analytics"/);

  const server = fs.readFileSync(path.join(projectRoot, "server.js"), "utf8");
  assert.match(server, /app\.use\("\/api\/v1\/pilot", pilotAnalyticsRoutes\)/);
});

test("controller projects only review fields and writes nothing", () => {
  const source = fs.readFileSync(
    path.join(projectRoot, "controllers", "phoneCallPilotController.js"),
    "utf8",
  );
  const start = source.indexOf("export const getPilotAnalytics");
  assert.ok(start > -1, "getPilotAnalytics handler must exist");
  const body = source.slice(start, source.indexOf("export const getPilotReviewCatalog"));
  assert.match(body, /review\.confirmed/);
  assert.ok(!/\.save\(|\.create\(|insertMany|findOneAndUpdate/.test(body), "must be read-only");
});

/* --------------------------- snapshot integration ------------------------- */

test("confirmed snapshot carries baselines, changes and AI line totals", () => {
  const aiLine = gradedLine();
  const [removedLine] = seedReviewLines({
    draft: {
      items: [
        {
          productId: "p2",
          productName: "Toor Dal",
          company: "Daawat",
          variantMeasurement: "1 kg",
          quantity: 1,
          unit: "kg",
          matchedPhrase: "toor dal",
          confidence: 0.75,
        },
      ],
    },
  });

  const [unresolvedLine] = seedReviewLines({ draft: { items: [], unresolved: [{ spokenName: "jeera" }] } });

  const report = {
    status: "ready",
    blockers: [],
    counts: { fromAi: 2, manual: 0, mappedFromUnresolved: 0, corrected: 1, removed: 1, unresolved: 0, ambiguous: 0, uncertainVariant: 0, invalid: 0 },
    lines: [
      { ...aiLine, quantity: 4, status: "ok", issues: [], blocking: false, changes: diffLine({ ...aiLine, quantity: 4 }) },
      { ...removedLine, removed: true, removedReason: "not ordered", status: "ok", issues: [], blocking: false },
      {
        ...unresolvedLine,
        productId: "p3",
        productName: "Sugar",
        status: "ok",
        issues: [],
        blocking: false,
        resolution: { method: "supplier_acknowledged", at: new Date() },
        changes: diffLine({ ...unresolvedLine, productId: "p3" }),
      },
    ],
  };

  const built = buildConfirmedSnapshot({
    report,
    draft: { transcript: "hello", customerNote: "call again" },
    confirmedBy: "supplier-1",
    confirmedAt: new Date("2026-03-01T10:00:00.000Z"),
  });

  // 3 AI-proposed lines total, 2 of which survived.
  assert.equal(built.counts.aiLines, 3);
  assert.equal(built.counts.aiLinesKept, 2);
  // Only one kept line is a direct AI match; the other is a mapped placeholder.
  assert.equal(built.counts.fromAi, 1);
  assert.equal(built.counts.mappedFromUnresolved, 1);
  assert.equal(built.counts.removed, 1);
  assert.equal(built.counts.removedAi, 1);
  assert.equal(built.counts.changed, 2);
  assert.equal(built.itemCount, 2);
  assert.equal(built.orderCreated, false);
  assert.equal(built.orderId, null);

  // Kept AI line: quantity diff is preserved with before/after.
  const quantityChange = built.changes.find((change) => change.kind === "quantity");
  assert.equal(quantityChange.from, 1);
  assert.equal(quantityChange.to, 4);

  // The unresolved placeholder became a product, which is an unresolved event.
  assert.ok(built.changes.some((change) => change.kind === "product" && change.origin === LINE_ORIGIN.AI_UNRESOLVED));
  assert.ok(built.items.every((item) => Array.isArray(item.aiFlags)));
  assert.equal(built.removed[0].origin, LINE_ORIGIN.AI);
  assert.equal(built.removed[0].reason, "not ordered");

  // The snapshot must survive a trip through the analytics service unchanged.
  const analytics = aggregatePilotAnalytics([confirmedCall(built)]);
  assert.equal(analytics.drafts.aiLines, 3);
  assert.equal(analytics.drafts.unresolvedLines, 1);
  assert.equal(analytics.rates.removal, 33.3);
});
