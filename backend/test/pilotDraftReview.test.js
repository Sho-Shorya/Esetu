import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  addManualReviewLine,
  buildConfirmedSnapshot,
  canAcknowledge,
  checkLine,
  confirmReviewDraft,
  createManualLine,
  describeBlockers,
  LINE_ORIGIN,
  LINE_STATUS,
  normalizeLines,
  openReview,
  publicReview,
  reopenReview,
  RESOLUTION_METHOD,
  REVIEW_STATUS,
  reviewDraft,
  saveReviewLines,
  seedReviewLines,
  setReviewCatalogLoader,
} from "../services/pilotDraftReviewService.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import PhoneCall from "../models/phoneCallModel.js";
import { Order } from "../models/orderModel.js";
import {
  confirmPilotDraft,
  retryPilotProcessing,
  savePilotReview,
} from "../controllers/phoneCallPilotController.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..");

/* ------------------------------- fake catalog ------------------------------ */

const catalog = [
  {
    ref: "P1",
    productId: "prod-salt",
    name: "Salt",
    hinglishName: "Namak",
    aliases: ["loonium namak", "salt", "namak"],
    variants: [
      { companyId: "cmp-a", company: "Tata", measurement: "1 kg" },
      { companyId: "cmp-b", company: "Aashirvaad", measurement: "1 kg" },
    ],
  },
  {
    ref: "P2",
    productId: "prod-atta",
    name: "Atta",
    hinglishName: "Gehun atta",
    aliases: ["wheat flour", "chokar", "atta"],
    variants: [
      { companyId: "cmp-c", company: "Aashirvaad", measurement: "5 kg" },
      { companyId: "cmp-c", company: "Aashirvaad", measurement: "10 kg" },
    ],
  },
  {
    ref: "P3",
    productId: "prod-oil",
    name: "Oil",
    hinglishName: "Tel",
    aliases: ["musterd oil", "cooking oil", "tel"],
    variants: [{ companyId: "cmp-d", company: "Fortune", measurement: "1 L" }],
  },
];

const saltItem = (overrides = {}) => ({
  productId: "prod-salt",
  productName: "Salt",
  hinglishName: "Namak",
  quantity: 2,
  unit: "peti",
  variantMeasurement: "1 kg",
  company: "Tata",
  matchedPhrase: "tata namak",
  confidence: 0.92,
  isCorrection: false,
  ...overrides,
});

const attaItem = (overrides = {}) => ({
  productId: "prod-atta",
  productName: "Atta",
  hinglishName: "Gehun atta",
  quantity: 1,
  unit: "packet",
  variantMeasurement: "5 kg",
  company: "Aashirvaad",
  matchedPhrase: "aashirvaad atta",
  confidence: 0.9,
  isCorrection: false,
  ...overrides,
});

/* ------------------------------ fake doc / res ----------------------------- */

/** Stands in for a PhoneCallPilot document. Mongoose is not connected here. */
const makeDoc = (draft = {}) => ({
  _id: "pilot-1",
  source: "test",
  supplierId: "supplier-1",
  extraction: {
    status: "completed",
    model: "test-model",
    draft: {
      isOrderIntent: true,
      customerNote: "",
      items: [],
      unresolved: [],
      ...draft,
    },
    validationErrors: [],
    needsReview: true,
  },
  stt: { status: "completed", transcript: "bhai do packet namak" },
  review: {
    status: REVIEW_STATUS.NOT_STARTED,
    lines: [],
    report: null,
    confirmed: null,
  },
  saves: 0,
  async save() {
    this.saves += 1;
    return this;
  },
  toObject() {
    return {
      _id: this._id,
      source: this.source,
      supplierId: this.supplierId,
      extraction: this.extraction,
      stt: this.stt,
      review: this.review,
    };
  },
});

const makeRes = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    this.body = payload;
    return this;
  },
});

/** Runs a handler against a fake document and a fake catalog, without Mongo. */
const withPatchedModel = async (doc, run) => {
  const originalFindById = PhoneCallPilot.findById;
  PhoneCallPilot.findById = async () => doc;
  setReviewCatalogLoader(() => catalog);
  try {
    return await run();
  } finally {
    PhoneCallPilot.findById = originalFindById;
    setReviewCatalogLoader(null);
  }
};

/* ============================ scenario: normal ============================= */

test("normal successful order seeds clean, confirmable lines", () => {
  const doc = makeDoc({ items: [saltItem(), attaItem()] });
  const report = openReview({ doc, catalog });

  assert.equal(doc.review.status, REVIEW_STATUS.IN_PROGRESS);
  assert.equal(report.lines.length, 2);
  assert.equal(report.counts.ok, 2);
  assert.equal(report.counts.unresolved, 0);
  assert.equal(report.counts.ambiguous, 0);
  assert.equal(report.blockers.length, 0);
  assert.equal(report.confirmable, true);
});

/* ======================= scenario: unresolved product ====================== */

test("unresolved product blocks confirm until it is mapped or removed", () => {
  const doc = makeDoc({
    items: [saltItem()],
    unresolved: [{ spokenName: "hing", reason: "not in catalog" }],
  });
  const seeded = openReview({ doc, catalog });
  const placeholder = seeded.lines.find(
    (line) => line.origin === LINE_ORIGIN.AI_UNRESOLVED,
  );

  assert.equal(placeholder.productId, null);
  assert.equal(placeholder.status, LINE_STATUS.UNRESOLVED);
  assert.equal(placeholder.blocking, true);
  assert.equal(seeded.counts.unresolved, 1);
  assert.equal(seeded.confirmable, false);
  assert.match(placeholder.issues[0], /hing/);
  // A product-less line can never just be waved through.
  assert.equal(canAcknowledge(placeholder), false);

  // 1) Mapping it to a real product resolves it. The UI clears the old
  //    variant when the product changes, so the test does the same.
  const mapped = saveReviewLines({
    doc,
    incomingLines: seeded.lines.map((line) =>
      line.key === placeholder.key
        ? {
            ...line,
            productId: "prod-oil",
            company: "Fortune",
            variantMeasurement: "1 L",
            resolution: { method: RESOLUTION_METHOD.PRODUCT },
          }
        : line,
    ),
    catalog,
  });
  assert.equal(mapped.counts.unresolved, 0);
  assert.equal(mapped.confirmable, true);

  // Mapping it to a product without settling the variant still blocks.
  const docPartial = makeDoc({
    items: [saltItem()],
    unresolved: [{ spokenName: "hing", reason: "not in catalog" }],
  });
  const seededPartial = openReview({ doc: docPartial, catalog });
  const partialTarget = seededPartial.lines.find(
    (line) => line.origin === LINE_ORIGIN.AI_UNRESOLVED,
  );
  const partial = saveReviewLines({
    doc: docPartial,
    incomingLines: seededPartial.lines.map((line) =>
      line.key === partialTarget.key
        ? {
            ...line,
            productId: "prod-oil",
            resolution: { method: RESOLUTION_METHOD.PRODUCT },
          }
        : line,
    ),
    catalog,
  });
  assert.equal(partial.counts.unresolved, 0);
  assert.equal(partial.counts.uncertainVariant, 1);
  assert.equal(partial.confirmable, false);

  // 2) Removing it also resolves it.
  const doc2 = makeDoc({
    items: [saltItem()],
    unresolved: [{ spokenName: "hing", reason: "not in catalog" }],
  });
  const seeded2 = openReview({ doc: doc2, catalog });
  const target2 = seeded2.lines.find(
    (l) => l.origin === LINE_ORIGIN.AI_UNRESOLVED,
  );
  const removed = saveReviewLines({
    doc: doc2,
    incomingLines: seeded2.lines.map((line) =>
      line.key === target2.key ? { ...line, removed: true } : line,
    ),
    catalog,
  });

  assert.equal(removed.counts.unresolved, 0);
  assert.equal(removed.counts.removed, 1);
  assert.equal(removed.confirmable, true);
});

/* ======================== scenario: ambiguous product ====================== */

test("ambiguous product blocks confirm until the supplier acts on it", () => {
  const doc = makeDoc({ items: [saltItem({ confidence: 0.41 })] });
  const seeded = openReview({ doc, catalog });
  const line = seeded.lines[0];

  assert.equal(line.status, LINE_STATUS.AMBIGUOUS);
  assert.equal(line.blocking, true);
  assert.equal(seeded.confirmable, false);
  assert.ok(
    line.candidates.length >= 1,
    "offers tappable alternative products",
  );
  assert.equal(canAcknowledge(line), true);

  // Explicit acknowledgement unlocks it.
  const acked = saveReviewLines({
    doc,
    incomingLines: seeded.lines.map((entry) => ({
      ...entry,
      resolution: { method: RESOLUTION_METHOD.ACKNOWLEDGED },
    })),
    catalog,
  });
  assert.equal(acked.lines[0].status, LINE_STATUS.OK);
  assert.equal(acked.confirmable, true);

  // So does switching to the right product (the UI resets the variant on a
  // product change, so an old brand can never leak onto a different product).
  const doc2 = makeDoc({ items: [saltItem({ confidence: 0.41 })] });
  const seeded2 = openReview({ doc: doc2, catalog });
  const switched = saveReviewLines({
    doc: doc2,
    incomingLines: seeded2.lines.map((entry) => ({
      ...entry,
      productId: "prod-oil",
      company: "Fortune",
      variantMeasurement: "1 L",
      resolution: { method: RESOLUTION_METHOD.PRODUCT },
    })),
    catalog,
  });
  assert.equal(switched.lines[0].status, LINE_STATUS.OK);
  assert.equal(switched.confirmable, true);

  // Editing only the quantity does NOT clear the ambiguity.
  const doc3 = makeDoc({ items: [saltItem({ confidence: 0.41 })] });
  const seeded3 = openReview({ doc: doc3, catalog });
  const qtyOnly = saveReviewLines({
    doc: doc3,
    incomingLines: seeded3.lines.map((entry) => ({ ...entry, quantity: 7 })),
    catalog,
  });

  assert.equal(qtyOnly.lines[0].status, LINE_STATUS.AMBIGUOUS);
  assert.equal(qtyOnly.confirmable, false);
});

/* ====================== scenario: quantity correction ====================== */

test("supplier can correct a wrong quantity", () => {
  const doc = makeDoc({ items: [saltItem({ quantity: 2 })] });
  const seeded = openReview({ doc, catalog });
  assert.equal(seeded.lines[0].quantity, 2);

  const corrected = saveReviewLines({
    doc,
    incomingLines: seeded.lines.map((line) => ({ ...line, quantity: 5 })),
    catalog,
  });
  assert.equal(corrected.lines[0].quantity, 5);
  assert.equal(corrected.confirmable, true);

  // A quantity of zero is a validation error, not a silent pass.
  const doc2 = makeDoc({ items: [saltItem({ quantity: 2 })] });
  const seeded2 = openReview({ doc: doc2, catalog });
  const broken = saveReviewLines({
    doc: doc2,
    incomingLines: seeded2.lines.map((line) => ({ ...line, quantity: 0 })),
    catalog,
  });

  assert.equal(broken.lines[0].status, LINE_STATUS.INVALID);
  assert.equal(broken.confirmable, false);
});

/* ======================== scenario: variant correction ====================== */

test("uncertain and invalid variants both block until corrected", () => {
  const doc = makeDoc({
    items: [saltItem({ company: null, variantMeasurement: null })],
  });
  const missing = openReview({ doc, catalog });

  assert.equal(missing.lines[0].status, LINE_STATUS.UNCERTAIN_VARIANT);
  assert.equal(missing.confirmable, false);
  assert.equal(canAcknowledge(missing.lines[0]), true);

  // A measurement that is not a real variant of the product is a hard error.
  const doc2 = makeDoc({ items: [saltItem({ variantMeasurement: "50 kg" })] });
  const bogus = openReview({ doc: doc2, catalog });

  assert.equal(bogus.lines[0].status, LINE_STATUS.INVALID);
  assert.equal(bogus.confirmable, false);
  assert.equal(canAcknowledge(bogus.lines[0]), false);

  // Correcting the variant to a listed one clears it.
  const fixed = saveReviewLines({
    doc: doc2,
    incomingLines: bogus.lines.map((line) => ({
      ...line,
      variantMeasurement: "1 kg",
      resolution: { method: RESOLUTION_METHOD.VARIANT },
    })),
    catalog,
  });
  assert.equal(fixed.lines[0].status, LINE_STATUS.OK);
  assert.equal(fixed.confirmable, true);

  // A company that does not make the product is also a hard error.
  const doc3 = makeDoc({ items: [saltItem({ company: "Fortune" })] });
  const wrongBrand = openReview({ doc: doc3, catalog });
  assert.equal(wrongBrand.lines[0].status, LINE_STATUS.INVALID);
  assert.match(wrongBrand.lines[0].issues.join(" "), /Fortune/);
});

/* ================== scenario: removing an incorrect item =================== */

test("supplier can remove an incorrect item and it leaves the confirmed draft", () => {
  const doc = makeDoc({ items: [saltItem(), attaItem()] });
  const seeded = openReview({ doc, catalog });

  const removed = saveReviewLines({
    doc,
    incomingLines: seeded.lines.map((line) =>
      line.productId === "prod-atta"
        ? {
            ...line,
            removed: true,
            removedAt: new Date(),
            removedReason: "not ordered",
          }
        : line,
    ),
    catalog,
  });

  assert.equal(removed.counts.kept, 1);
  assert.equal(removed.counts.removed, 1);
  assert.equal(removed.confirmable, true);

  const snapshot = buildConfirmedSnapshot({ report: removed, draft: {} });
  assert.equal(snapshot.itemCount, 1);
  assert.equal(snapshot.removed.length, 1);
  assert.equal(snapshot.removed[0].productName, "Atta");
  assert.equal(snapshot.removed[0].reason, "not ordered");
});

/* ===================== scenario: adding a missing item ====================== */

test("supplier can add a missing item by hand", () => {
  const doc = makeDoc({ items: [saltItem()] });
  openReview({ doc, catalog });

  const report = addManualReviewLine({
    doc,
    input: {
      productId: "prod-oil",
      quantity: 3,
      unit: "bottle",
      company: "Fortune",
      variantMeasurement: "1 L",
    },
    userId: "supplier-1",
    catalog,
  });

  const added = report.lines.find((line) => line.origin === LINE_ORIGIN.MANUAL);
  assert.equal(report.counts.kept, 2);
  assert.equal(added.status, LINE_STATUS.OK);
  assert.equal(added.quantity, 3);
  assert.equal(report.confirmable, true);

  // A manual add with no product is still blocked.
  const doc2 = makeDoc({ items: [saltItem()] });
  openReview({ doc: doc2, catalog });
  const emptyReport = addManualReviewLine({
    doc: doc2,
    input: { quantity: 2 },
    catalog,
  });

  assert.equal(emptyReport.counts.unresolved, 1);
  assert.equal(emptyReport.confirmable, false);
});

/* ====================== scenario: final confirmation ======================= */

test("confirming builds a confirmed pilot draft with corrections recorded", () => {
  const doc = makeDoc({
    items: [saltItem({ confidence: 0.4, quantity: 2 })],
    unresolved: [{ spokenName: "hing", reason: "not in catalog" }],
  });

  let report = openReview({ doc, catalog });
  const ambiguous = report.lines.find(
    (line) => line.status === LINE_STATUS.AMBIGUOUS,
  );
  const placeholder = report.lines.find(
    (line) => line.origin === LINE_ORIGIN.AI_UNRESOLVED,
  );

  // Supplier: fixes the quantity, accepts the ambiguous match, drops the
  // item the AI could not match at all.
  report = saveReviewLines({
    doc,
    incomingLines: report.lines.map((line) => {
      if (line.key === placeholder.key) return { ...line, removed: true };
      if (line.key === ambiguous.key) {
        return {
          ...line,
          quantity: 4,
          resolution: { method: RESOLUTION_METHOD.ACKNOWLEDGED },
        };
      }
      return line;
    }),
    catalog,
  });
  assert.equal(report.confirmable, true);

  const outcome = confirmReviewDraft({ doc, catalog, userId: "supplier-1" });

  assert.equal(outcome.ok, true);
  assert.equal(doc.review.status, REVIEW_STATUS.CONFIRMED);
  assert.equal(doc.review.confirmed.itemCount, 1);
  assert.equal(doc.review.confirmed.items[0].quantity, 4);
  assert.equal(doc.review.confirmed.counts.corrected, 1);
  assert.equal(doc.review.confirmed.counts.removed, 1);
  assert.equal(
    doc.review.confirmed.corrections[0].method,
    RESOLUTION_METHOD.ACKNOWLEDGED,
  );
  assert.equal(doc.review.confirmed.removed[0].productName, "hing");
  assert.match(outcome.message, /कन्फर्म/);
  // Confirming the draft is still not ordering. The order is a separate,
  // explicit step so the supplier can review first and order second.
  assert.equal(doc.review.confirmed.orderCreated, false);
  assert.equal(doc.review.confirmed.orderId, null);
});

test("reopening a confirmed draft clears the pilot snapshot only", () => {
  const doc = makeDoc({ items: [saltItem()] });
  openReview({ doc, catalog });
  confirmReviewDraft({ doc, catalog, userId: "supplier-1" });

  assert.equal(doc.review.status, REVIEW_STATUS.CONFIRMED);
  assert.ok(doc.review.confirmed);

  const view = reopenReview({ doc });

  assert.equal(view.status, REVIEW_STATUS.IN_PROGRESS);
  assert.equal(doc.review.confirmed, null);
  // The working copy survives, so nothing has to be retyped.
  assert.equal(doc.review.lines.length, 1);
});

test("describeBlockers explains why confirm is refused", () => {
  const doc = makeDoc({
    items: [],
    unresolved: [{ spokenName: "hing", reason: "no match" }],
  });
  const report = openReview({ doc, catalog });

  const message = describeBlockers(report.blockers);
  assert.match(message, /Resolve 1 item/);
  assert.match(message, /hing/);
  assert.equal(describeBlockers([]), null);
});

/* ============ scenario: confirm must NOT create a real Order ============== */

test("the whole pilot review path never imports production order code", () => {
  const pilotFiles = [
    "services/pilotDraftReviewService.js",
    "services/orderExtractionService.js",
    "services/pilotAudioStorage.js",
    "services/pilotPhoneNormalizer.js",
    "services/sttService.js",
    "controllers/phoneCallPilotController.js",
    "routes/phoneCallPilotRoutes.js",
    "models/phoneCallPilotModel.js",
  ];

  const banned =
    /orderModel|orderController|orderRoutes|cartController|paymentController|invoiceController/i;

  for (const file of pilotFiles) {
    const source = fs.readFileSync(path.join(backendRoot, file), "utf8");
    const statements =
      source.match(/import[\s\S]*?from\s+["'][^"']+["'];/g) || [];
    for (const statement of statements) {
      assert.doesNotMatch(
        statement,
        banned,
        `${file} must not import production order code: ${statement.trim()}`,
      );
    }
  }

  // The pilot schema must not hold an Order reference either.
  const model = fs.readFileSync(
    path.join(backendRoot, "models/phoneCallPilotModel.js"),
    "utf8",
  );
  assert.doesNotMatch(model, /ref:\s*["']Order["']/);
});

test("confirmPilotDraft stores the result on the pilot record and creates no Order", async () => {
  const originals = {
    create: Order.create,
    find: Order.find,
    insertMany: Order.insertMany,
  };

  // Any write to a real order from the pilot path fails this test loudly.
  const trap = () => {
    throw new Error("The pilot path must never create a real Order.");
  };
  Order.create = trap;
  Order.find = trap;
  Order.insertMany = trap;

  const doc = makeDoc({ items: [saltItem()] });
  openReview({ doc, catalog });

  const res = makeRes();
  try {
    await withPatchedModel(doc, () =>
      confirmPilotDraft(
        { params: { id: "pilot-1" }, userId: "supplier-1", body: {} },
        res,
      ),
    );
  } finally {
    Object.assign(Order, originals);
  }

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(doc.review.status, REVIEW_STATUS.CONFIRMED);
  assert.equal(doc.review.confirmed.itemCount, 1);
  assert.equal(doc.review.confirmed.orderCreated, false);
  assert.equal(doc.review.confirmed.orderId, null);
  assert.match(res.body.message, /कन्फर्म/);
  assert.equal(doc.saves, 1, "exactly one write, and it is the pilot document");
});

test("another supplier cannot confirm or read this supplier's pilot call", async () => {
  const doc = makeDoc({ items: [saltItem()] });
  const res = makeRes();

  await withPatchedModel(doc, () =>
    confirmPilotDraft(
      { params: { id: "pilot-1" }, userId: "supplier-2", body: {} },
      res,
    ),
  );

  assert.equal(res.statusCode, 404);
  assert.equal(doc.saves, 0);
  assert.equal(doc.review.confirmed, null);
});

test("confirming with createOrder hands off to the bridge, which is what writes the Order", async () => {
  const doc = makeDoc({ items: [saltItem()] });
  openReview({ doc, catalog });

  const res = makeRes();
  await withPatchedModel(doc, () =>
    confirmPilotDraft(
      {
        params: { id: "pilot-1" },
        userId: "supplier-1",
        body: { createOrder: true },
      },
      res,
    ),
  );

  // The draft is confirmed and safely stored before the bridge is asked to do
  // anything. This fake document has no real id, so the bridge refuses it
  // outright, which is the correct outcome: no order, and a clear reason.
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, "PHONE_CALL_NOT_FOUND");
  assert.equal(doc.review.status, REVIEW_STATUS.CONFIRMED);
  assert.equal(doc.review.confirmed.orderCreated, false);
  assert.equal(doc.review.confirmed.orderId, null);
  assert.ok(res.body.review, "the supplier keeps their confirmed work");
});

test("confirming again with createOrder retries the order instead of short-circuiting", async () => {
  const doc = makeDoc({ items: [saltItem()] });
  openReview({ doc, catalog });
  confirmReviewDraft({ doc, catalog, userId: "supplier-1" });

  const res = makeRes();
  await withPatchedModel(doc, () =>
    confirmPilotDraft(
      {
        params: { id: "pilot-1" },
        userId: "supplier-1",
        body: { createOrder: true },
      },
      res,
    ),
  );

  // This is the retry a supplier makes after an order creation was refused. It
  // must reach the bridge, so the refusal comes from the bridge (this fake
  // document has no real id) rather than from an "already confirmed" no-op that
  // silently swallowed the request. The stored draft is untouched either way.
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(res.body.code, "PHONE_CALL_NOT_FOUND");
  assert.equal(doc.review.status, REVIEW_STATUS.CONFIRMED);
  assert.equal(doc.saves, 0, "a retry must not rewrite the confirmed draft");
});

test("confirming an already confirmed draft without createOrder stays a no-op", async () => {
  const doc = makeDoc({ items: [saltItem()] });
  openReview({ doc, catalog });
  confirmReviewDraft({ doc, catalog, userId: "supplier-1" });

  const res = makeRes();
  await withPatchedModel(doc, () =>
    confirmPilotDraft(
      { params: { id: "pilot-1" }, userId: "supplier-1", body: {} },
      res,
    ),
  );

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  assert.equal(res.body.alreadyConfirmed, true);
  assert.equal(res.body.order, undefined, "no order was asked for, so none is made");
  assert.equal(doc.saves, 0);
});

test("confirmPilotDraft is refused with 422 while blockers remain and writes nothing", async () => {
  const doc = makeDoc({
    items: [saltItem()],
    unresolved: [{ spokenName: "hing", reason: "not in catalog" }],
  });
  openReview({ doc, catalog });

  const res = makeRes();
  await withPatchedModel(doc, () =>
    confirmPilotDraft(
      { params: { id: "pilot-1" }, userId: "supplier-1", body: {} },
      res,
    ),
  );

  assert.equal(res.statusCode, 422);
  assert.equal(res.body.code, "REVIEW_BLOCKED");
  assert.match(res.body.message, /hing/);
  assert.equal(doc.review.status, REVIEW_STATUS.IN_PROGRESS);
  assert.equal(doc.review.confirmed, null);
  assert.equal(doc.saves, 0, "a refused confirm must not write anything");
});

/* ============== server re-grades, so the client cannot lie =============== */

test("a client cannot forge a clean status or a fake product name", () => {
  const doc = makeDoc();
  const report = saveReviewLines({
    doc,
    incomingLines: [
      {
        key: "forged-1",
        origin: LINE_ORIGIN.AI,
        productId: "prod-salt",
        productName: "Hacked name",
        quantity: 3,
        unit: "peti",
        company: "Tata",
        variantMeasurement: "1 kg",
        matchedPhrase: "tata namak",
        confidence: 0.2,
        resolution: { method: null },
        status: LINE_STATUS.OK,
        blocking: false,
        issues: [],
      },
    ],
    catalog,
  });

  const line = report.lines[0];
  assert.equal(
    line.productName,
    "Salt",
    "name comes from the catalog, not the client",
  );
  assert.equal(
    line.status,
    LINE_STATUS.AMBIGUOUS,
    "low confidence is re-flagged",
  );
  assert.equal(line.blocking, true, "client cannot self-clear the blocker");
  assert.equal(report.confirmable, false);
});

test("a forged acknowledgement cannot clear a line that has no product", () => {
  const doc = makeDoc();
  const report = saveReviewLines({
    doc,
    incomingLines: [
      {
        key: "forged-2",
        origin: LINE_ORIGIN.MANUAL,
        productId: null,
        quantity: 1,
        resolution: { method: RESOLUTION_METHOD.ACKNOWLEDGED },
        removed: false,
      },
    ],
    catalog,
  });

  assert.equal(report.lines[0].status, LINE_STATUS.UNRESOLVED);
  assert.equal(report.confirmable, false);
});

test("a client cannot smuggle in a product id that is not in the catalog", () => {
  const doc = makeDoc();
  const report = saveReviewLines({
    doc,
    incomingLines: [
      {
        key: "forged-3",
        productId: "prod-not-real",
        quantity: 1,
        company: "Tata",
        variantMeasurement: "1 kg",
      },
    ],
    catalog,
  });

  assert.equal(report.lines[0].status, LINE_STATUS.INVALID);
  assert.equal(report.confirmable, false);
});

test("checkLine flags a product that disappeared from the catalog", () => {
  const verdict = checkLine(
    {
      key: "k",
      productId: "prod-deleted",
      quantity: 1,
      company: "Tata",
      variantMeasurement: "1 kg",
    },
    catalog,
  );

  assert.equal(verdict.status, LINE_STATUS.INVALID);
  assert.equal(verdict.blocking, true);
  assert.match(verdict.issues[0], /no longer in the catalog/);
});

test("normalizeLines rebuilds duplicate keys instead of colliding", () => {
  const lines = normalizeLines(
    [
      { key: "a", productId: "prod-salt", quantity: 2 },
      { key: "a", productId: "prod-oil", quantity: 1 },
    ],
    catalog,
  );

  assert.equal(lines[0].key, "a", "first occurrence keeps its key");
  assert.notEqual(lines[1].key, "a", "a repeated key is regenerated");
  assert.equal(lines[1].productName, "Oil");
});

test("savePilotReview rejects a body that is not a line list", async () => {
  const doc = makeDoc({ items: [saltItem()] });
  const res = makeRes();

  await withPatchedModel(doc, () =>
    savePilotReview(
      { params: { id: "pilot-1" }, userId: "supplier-1", body: {} },
      res,
    ),
  );

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.success, false);
  assert.equal(doc.saves, 0);
});

/* ------------------------------ public shape ------------------------------- */

test("publicReview exposes the pilot guarantee and never an order id", () => {
  const doc = makeDoc({ items: [saltItem()] });
  doc.review = {
    status: "confirmed",
    confirmed: { at: new Date(), itemCount: 2, orderCreated: false },
  };

  const view = publicReview(doc);

  assert.equal(view.status, "confirmed");
  assert.equal(view.confirmed.itemCount, 2);
  assert.equal(view.confirmed.orderCreated, false);
  assert.equal(view.confirmed.orderId, undefined);
});

test("createManualLine keeps a free-text unit exactly as typed", () => {
  const line = createManualLine({
    productId: "prod-salt",
    quantity: 1,
    unit: " half peti ",
  });

  assert.equal(line.unit, "half peti");
  assert.equal(line.origin, LINE_ORIGIN.MANUAL);
});

/* ==================== scenario: retry a failed recording ==================== */

/**
 * Retry has to satisfy the exact harness the handler expects: a queryable
 * pilot record, an atomic claim that can be won or refused, a linked call to
 * report status to, and a captured background run so no real STT happens.
 */
const withRetryFakes = async ({ doc, claimed, call, run }) => {
  const originals = {
    pilotFindById: PhoneCallPilot.findById,
    pilotFindOneAndUpdate: PhoneCallPilot.findOneAndUpdate,
    callFindOne: PhoneCall.findOne,
    callFindById: PhoneCall.findById,
    setImmediate: globalThis.setImmediate,
  };

  const claims = [];
  const scheduled = [];

  PhoneCallPilot.findById = () => ({
    select: async () => doc,
  });
  PhoneCallPilot.findOneAndUpdate = async (filter, update) => {
    claims.push({ filter, update });
    return claimed;
  };
  PhoneCall.findOne = () => ({ select: async () => call });
  PhoneCall.findById = async () => call;
  globalThis.setImmediate = (callback) => {
    scheduled.push(callback);
    return 1;
  };

  try {
    return await run({ claims, scheduled });
  } finally {
    PhoneCallPilot.findById = originals.pilotFindById;
    PhoneCallPilot.findOneAndUpdate = originals.pilotFindOneAndUpdate;
    PhoneCall.findOne = originals.callFindOne;
    PhoneCall.findById = originals.callFindById;
    globalThis.setImmediate = originals.setImmediate;
  }
};

const makeRetryDoc = (overrides = {}) => ({
  _id: "pilot-1",
  source: "phone_call",
  supplierId: "supplier-1",
  phoneCallId: null,
  audio: { fileName: "call-1.wav" },
  pipeline: { stage: "failed", error: { message: "boom" } },
  review: { status: REVIEW_STATUS.NOT_STARTED, confirmed: null },
  ...overrides,
});

const makeLinkedCall = (overrides = {}) => ({
  _id: "call-1",
  supplierId: "supplier-1",
  processingStatus: "failed",
  lastError: { message: "boom" },
  saves: 0,
  async save() {
    this.saves += 1;
    return this;
  },
  ...overrides,
});

test("retry re-arms the failed stage and hands the same recording to the pipeline", async () => {
  const doc = makeRetryDoc();
  const claimed = { ...doc, pipeline: { stage: "processing_recording" } };
  const res = makeRes();

  await withRetryFakes({
    doc,
    claimed,
    call: null,
    async run({ claims, scheduled }) {
      await retryPilotProcessing(
        { params: { id: "pilot-1" }, userId: "supplier-1" },
        res,
      );

      assert.equal(res.statusCode, 202);
      assert.equal(res.body.success, true);
      assert.equal(claims.length, 1, "the stage is claimed exactly once");
      assert.deepEqual(claims[0].filter["pipeline.stage"].$in, [
        "new",
        "call_answered",
        "call_ended",
        "recording_ready",
        "failed",
      ]);
      assert.equal(
        claims[0].update.$set["pipeline.stage"],
        "processing_recording",
      );
      assert.equal(claims[0].update.$set["pipeline.error"], null);
      assert.equal(scheduled.length, 1, "one background run, reusing the runner");
    },
  });
});

test("retry is refused for a call that already produced a real Order", async () => {
  const doc = makeRetryDoc({
    review: {
      status: REVIEW_STATUS.CONFIRMED,
      confirmed: { at: new Date(), itemCount: 1, orderCreated: true, orderId: "o1" },
    },
  });
  const res = makeRes();

  await withRetryFakes({
    doc,
    claimed: { ...doc },
    call: null,
    async run({ claims, scheduled }) {
      await retryPilotProcessing(
        { params: { id: "pilot-1" }, userId: "supplier-1" },
        res,
      );

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, "ORDER_ALREADY_CREATED");
      assert.equal(claims.length, 0, "no claim is taken for a finished call");
      assert.equal(scheduled.length, 0, "no pipeline is restarted");
    },
  });
});

test("retry without a recording is refused instead of failing silently later", async () => {
  const doc = makeRetryDoc({ audio: { fileName: null } });
  const res = makeRes();

  await withRetryFakes({
    doc,
    claimed: { ...doc },
    call: null,
    async run({ claims }) {
      await retryPilotProcessing(
        { params: { id: "pilot-1" }, userId: "supplier-1" },
        res,
      );

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, "NO_RECORDING");
      assert.equal(claims.length, 0);
    },
  });
});

test("a double-tapped retry cannot take the claim a run already holds", async () => {
  const doc = makeRetryDoc();
  const res = makeRes();

  await withRetryFakes({
    doc,
    claimed: null, // the atomic claim was lost: another run owns it
    call: null,
    async run({ scheduled }) {
      await retryPilotProcessing(
        { params: { id: "pilot-1" }, userId: "supplier-1" },
        res,
      );

      assert.equal(res.statusCode, 409);
      assert.equal(res.body.code, "ALREADY_PROCESSING");
      assert.equal(scheduled.length, 0, "no second pipeline is started");
    },
  });
});

test("another supplier cannot retry this supplier's failed call", async () => {
  const doc = makeRetryDoc({ supplierId: "supplier-1", phoneCallId: "call-1" });
  const res = makeRes();

  PhoneCall.findOne = () => ({
    select: async () => null, // no call of theirs matches this pilot record
  });

  await withRetryFakes({
    doc,
    claimed: { ...doc },
    call: null,
    async run({ claims }) {
      await retryPilotProcessing(
        { params: { id: "pilot-1" }, userId: "supplier-2" },
        res,
      );

      assert.equal(res.statusCode, 404);
      assert.equal(claims.length, 0);
    },
  });
});

test("retrying a linked call also clears its failed status on the screen", async () => {
  const doc = makeRetryDoc({ phoneCallId: "call-1" });
  const claimed = { ...doc, pipeline: { stage: "processing_recording" } };
  const call = makeLinkedCall();
  const res = makeRes();

  await withRetryFakes({
    doc,
    claimed,
    call,
    async run() {
      await retryPilotProcessing(
        { params: { id: "pilot-1" }, userId: "supplier-1" },
        res,
      );

      assert.equal(res.statusCode, 202);
      assert.equal(call.processingStatus, "processing");
      // The stored error is blanked, not deleted: the field shape the phone
      // list renders stays intact while the stale message is gone.
      assert.equal(call.lastError.message, null);
      assert.equal(call.saves, 1);
    },
  });
});
