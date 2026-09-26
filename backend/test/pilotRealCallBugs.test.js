import test from "node:test";
import assert from "node:assert/strict";

/**
 * Phase 1 regression tests.
 *
 * Every case here was found by running a real recorded distributor call through
 * the real pipeline (see pilot-evals/). They are kept as tests because each one
 * is a way the draft could have silently become a wrong order.
 *
 * The reference call is pilot-evals/_review.txt: a real Hindi/Hinglish order for
 * eggs, sugar, salt, honey, chilli powder and turmeric. The model read
 * "अंडे की करेट ले आना" (egg trays, no quantity), "सफेद अंडा", "अंडे की करेट दो"
 * (2) and "अंडे की करेट तीन" (3) as four mentions and the server merged them.
 */

import {
  LINE_ORIGIN,
  LINE_STATUS,
  checkLine,
  normalizeLines,
  reviewDraft,
  seedReviewLines,
} from "../services/pilotDraftReviewService.js";
import {
  mergeDuplicateLines,
  normalizeItemRow,
  scoreCatalog,
} from "../services/orderExtractionService.js";

/* ------------------------------- fake catalog ------------------------------ */

const catalog = [
  {
    ref: "P1",
    productId: "prod-namak",
    name: "नमक",
    hinglishName: "Namak",
    aliases: ["namak", "loonium"],
    variants: [
      { companyId: "c1", company: "टाटा", measurement: "500gm" },
      { companyId: "c1", company: "टाटा", measurement: "1kg" },
    ],
  },
  {
    ref: "P2",
    productId: "prod-ande",
    name: "अंडे",
    hinglishName: "Eggs",
    aliases: ["anda", "eggs", "egg"],
    variants: [{ companyId: "c2", company: "सफेद अंडा", measurement: "Tray(30 pc)" }],
  },
  {
    ref: "P3",
    productId: "prod-mirchi",
    name: "मिर्ची पाउडर",
    hinglishName: "Mirchi Powder",
    aliases: ["mirchi", "mirch", "मिर्ची"],
    variants: [
      { companyId: "c3", company: "MDH", measurement: "100gm" },
      { companyId: "c3", company: "MDH", measurement: "200gm" },
    ],
  },
];

/* ================== bug 1: an unstated quantity must not become 1 ============ */

/**
 * The real recording: the customer said "अंडे की करेट ले आना" with no quantity,
 * then twice more with a quantity. Coercing the unstated one to 1 made the merge
 * read 1+1+2+3 = 7 trays instead of 5.
 */
test("an unstated quantity is treated as no information, never as 1", () => {
  const lines = mergeDuplicateLines([
    { productId: "prod-ande", company: "सफेद अंडा", variantMeasurement: "Tray(30 pc)", quantity: null, unit: "", matchedPhrase: "ande crate", confidence: 0.9 },
    { productId: "prod-ande", company: "सफेद अंडा", variantMeasurement: "Tray(30 pc)", quantity: 2, unit: "", matchedPhrase: "ande crate", confidence: 0.9 },
    { productId: "prod-ande", company: "सफेद अंडा", variantMeasurement: "Tray(30 pc)", quantity: 3, unit: "", matchedPhrase: "ande crate", confidence: 0.9 },
  ]);

  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, 5, "2 + 3, the unstated mention contributes nothing");
  assert.equal(lines[0].mentions, 3);
});

test("a product mentioned only without a quantity stays unquantified", () => {
  const lines = mergeDuplicateLines([
    { productId: "prod-namak", company: "टाटा", variantMeasurement: "1kg", quantity: null, unit: "", matchedPhrase: "tata namak", confidence: 0.9 },
  ]);

  assert.equal(lines.length, 1);
  assert.equal(lines[0].quantity, null, "must stay unknown so review can ask for it");
});

test("a later unstated mention does not wipe out a stated quantity", () => {
  const lines = mergeDuplicateLines([
    { productId: "prod-namak", company: "टाटा", variantMeasurement: "1kg", quantity: 5, unit: "packet", matchedPhrase: "tata namak", confidence: 0.9 },
    { productId: "prod-namak", company: "टाटा", variantMeasurement: "1kg", quantity: null, unit: "", matchedPhrase: "tata namak", confidence: 0.9 },
  ]);

  assert.equal(lines[0].quantity, 5);
  assert.equal(lines[0].mentions, 2);
});

test("a correction without a quantity keeps the previously stated quantity", () => {
  const lines = mergeDuplicateLines([
    { productId: "prod-namak", company: "टाटा", variantMeasurement: "1kg", quantity: 3, unit: "", matchedPhrase: "namak", confidence: 0.9 },
    { productId: "prod-namak", company: "टाटा", variantMeasurement: "1kg", quantity: null, unit: "", matchedPhrase: "matlab teen", isCorrection: true, confidence: 0.9 },
  ]);

  assert.equal(lines[0].quantity, 3, "an unstated correction is not a correction of the number");
});

/* ============ bug 1b: an unquantified line must block confirmation ========== */

const unquantifiedDraft = {
  isOrderIntent: true,
  customerNote: "",
  items: [
    {
      productId: "prod-namak",
      productName: "नमक",
      hinglishName: "Namak",
      quantity: null,
      unit: "",
      variantMeasurement: "1kg",
      company: "टाटा",
      matchedPhrase: "tata namak",
      confidence: 0.95,
      isCorrection: false,
      mentions: 1,
    },
  ],
  unresolved: [],
  itemCount: 1,
};

test("a line with no quantity blocks confirm and asks the supplier for one", () => {
  const report = reviewDraft({ lines: seedReviewLines({ draft: unquantifiedDraft }), catalog });

  assert.equal(report.counts.ok, 0, "must not grade as ok");
  assert.equal(report.confirmable, false);
  assert.equal(report.blockers.length, 1);
  assert.equal(report.blockers[0].status, LINE_STATUS.QUANTITY_UNKNOWN);
  assert.match(report.blockers[0].messages.join(" "), /quantity/i);
});

test("an unquantified line becomes confirmable once the supplier types a quantity", () => {
  const seeded = seedReviewLines({ draft: unquantifiedDraft });
  const report = reviewDraft({
    lines: normalizeLines([{ ...seeded[0], quantity: 5 }], catalog),
    catalog,
  });

  assert.equal(report.counts.ok, 1);
  assert.equal(report.confirmable, true);
  assert.equal(report.lines[0].quantity, 5);
});

test("supplier autosave must not re-fabricate a quantity from a blank field", () => {
  const seeded = seedReviewLines({ draft: unquantifiedDraft });
  const [line] = normalizeLines([{ ...seeded[0], quantity: "" }], catalog);

  assert.equal(line.quantity, null, "a blank quantity stays unknown instead of becoming 1");
  assert.equal(checkLine(line, catalog).status, LINE_STATUS.QUANTITY_UNKNOWN);
});

test("the frozen baseline records the unstated quantity instead of defaulting to 1", () => {
  const [line] = seedReviewLines({ draft: unquantifiedDraft });

  assert.equal(line.baseline.quantity, null);
  assert.ok(line.baseline.flags.includes(LINE_STATUS.QUANTITY_UNKNOWN));
});

/* ============ bug 2: the ambiguity gate must not be dead =================== */

test("an AI line with no reported confidence is not treated as trustworthy", () => {
  const line = {
    origin: LINE_ORIGIN.AI,
    productId: "prod-mirchi",
    productName: "मिर्ची पाउडर",
    quantity: 2,
    unit: "",
    variantMeasurement: "200gm",
    company: "MDH",
    matchedPhrase: "mirchi",
    confidence: null,
  };

  assert.equal(checkLine(line, catalog).status, LINE_STATUS.AMBIGUOUS);
});

test("a genuinely low reported confidence is still flagged ambiguous", () => {
  const line = {
    origin: LINE_ORIGIN.AI,
    productId: "prod-mirchi",
    productName: "मिर्ची पाउडर",
    quantity: 2,
    unit: "",
    variantMeasurement: "200gm",
    company: "MDH",
    matchedPhrase: "mirchi",
    confidence: 0.4,
  };

  assert.equal(checkLine(line, catalog).status, LINE_STATUS.AMBIGUOUS);
});

test("a high reported confidence on a real match still grades ok", () => {
  const line = {
    origin: LINE_ORIGIN.AI,
    productId: "prod-mirchi",
    productName: "मिर्ची पाउडर",
    quantity: 2,
    unit: "",
    variantMeasurement: "200gm",
    company: "MDH",
    matchedPhrase: "mdh mirchi powder",
    confidence: 0.95,
  };

  assert.equal(checkLine(line, catalog).status, LINE_STATUS.OK);
});

test("a supplier-acknowledged line stops blocking", () => {
  const line = {
    origin: LINE_ORIGIN.AI,
    productId: "prod-mirchi",
    productName: "मिर्ची पाउडर",
    quantity: 2,
    unit: "",
    variantMeasurement: "200gm",
    company: "MDH",
    matchedPhrase: "mirchi",
    confidence: 0.4,
    resolution: { method: "supplier_acknowledged" },
  };

  assert.equal(checkLine(line, catalog).status, LINE_STATUS.OK);
});

/* ============ bug 3: a merged line is server arithmetic ===================== */

test("a line the server had to merge is recorded as AI-fragmented", () => {
  const [line] = seedReviewLines({
    draft: {
      items: [{ ...unquantifiedDraft.items[0], quantity: 5, mentions: 3 }],
      unresolved: [],
    },
  });

  assert.equal(line.mentions, 3);
  assert.ok(
    line.baseline.flags.includes(LINE_STATUS.MERGED_MENTIONS),
    "a composed total must be visible to the supplier and the accuracy report",
  );
});

test("a single spoken line is not flagged as fragmented", () => {
  const [line] = seedReviewLines({ draft: unquantifiedDraft });
  assert.equal(line.mentions, 1);
  assert.ok(!line.baseline.flags.includes(LINE_STATUS.MERGED_MENTIONS));
});

test("a composed total must be acknowledged, not confirmed silently", () => {
  // The real recording: "2 trays... 3 trays" became a server-composed total that
  // nobody ever said. The number can still be wrong, so it has to be waved
  // through rather than pass as ok.
  const [line] = seedReviewLines({
    draft: { items: [{ ...unquantifiedDraft.items[0], quantity: 6, mentions: 3 }], unresolved: [] },
  });

  const verdict = checkLine(line, catalog);
  assert.equal(verdict.status, LINE_STATUS.MERGED_MENTIONS);
  assert.equal(verdict.blocking, true);
  assert.match(verdict.issues.join(" "), /6/);
});

test("acknowledging a composed total clears the block", () => {
  const [line] = seedReviewLines({
    draft: { items: [{ ...unquantifiedDraft.items[0], quantity: 6, mentions: 3 }], unresolved: [] },
  });
  const acknowledged = { ...line, resolution: { method: "supplier_acknowledged" } };

  assert.equal(checkLine(acknowledged, catalog).status, LINE_STATUS.OK);
});

test("a wrong composed total blocks the whole draft", () => {
  const report = reviewDraft({
    lines: seedReviewLines({
      draft: { items: [{ ...unquantifiedDraft.items[0], quantity: 6, mentions: 3 }], unresolved: [] },
    }),
    catalog,
  });

  assert.equal(report.confirmable, false);
  assert.equal(report.counts.mergedMentions, 1);
});

/* =================== guards on the already-correct behaviour ================= */

test("a wrong arity item row is still rejected rather than reinterpreted", () => {
  assert.equal(normalizeItemRow(["P1", 2, "", "1kg"]), null);
  assert.equal(normalizeItemRow(["P1", 2, "", "1kg", "Tata", "namak", 0.9, false]).ref, "P1");
});

test("numbers alone never drive the lexical product fallback", () => {
  const ranked = scoreCatalog(catalog, "500 1 kg 250");
  assert.equal(ranked.filter((entry) => entry.score > 0).length, 0);
});

test("devanagari and hinglish both reach the right product", () => {
  for (const spoken of ["मिर्ची", "mirchi", "मिर्ची पाउडर"]) {
    const top = scoreCatalog(catalog, spoken).find((entry) => entry.score > 0);
    assert.equal(top?.product.productId, "prod-mirchi", `failed for "${spoken}"`);
  }
});
