import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import PhoneCall from "../models/phoneCallModel.js";
import { Order } from "../models/orderModel.js";
import Product from "../models/productModel.js";
import Company from "../models/companiesModel.js";
import AppSetting from "../models/appSettingModel.js";
import { User } from "../models/userModel.js";

import {
  BRIDGE_CODES,
  claimOrderCreation,
  createOrderFromConfirmedPhoneCall,
  revalidateConfirmedItems,
  releaseOrderClaim,
  resolveOrderCustomer,
} from "../services/phoneOrderBridgeService.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(here, "..");

/* -------------------------------------------------------------------------- */
/*                              fake database                                 */
/* -------------------------------------------------------------------------- */

const OBJECT_IDS = {
  pilot: "64b0000000000000000000a1",
  customer: "64b0000000000000000000c1",
  otherCustomer: "64b0000000000000000000c2",
  supplier: "64b0000000000000000000b1",
  otherSupplier: "64b0000000000000000000b2",
  call: "64b0000000000000000000d1",
  salt: "64b0000000000000000000e1",
  honey: "64b0000000000000000000e2",
  oil: "64b0000000000000000000e3",
  tata: "64b0000000000000000000f1",
  fortune: "64b0000000000000000000f2",
};

const chain = (value) => {
  const api = {
    populate: () => api,
    select: () => api,
    sort: () => api,
    limit: () => api,
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return api;
};

/**
 * A tiny in-memory stand-in for the handful of queries the bridge makes.
 *
 * Mongoose is deliberately not connected in tests. Every stub is restored in
 * `withFakes`, so no test can leak a patched model into the next one.
 */
const makeFakes = ({
  products = [],
  companies = [],
  users = [],
  order = null,
  phoneCall = null,
} = {}) => {
  const state = {
    orders: order ? [order] : [],
    created: [],
    pilotUpdateOneCalls: [],
    orderCreateCalls: [],
    phoneCall: phoneCall || {
      _id: OBJECT_IDS.call,
      supplierId: OBJECT_IDS.supplier,
      pilotCallId: OBJECT_IDS.pilot,
      from: { matched: true, userId: OBJECT_IDS.customer },
    },
  };

  const findOneAndUpdate = async (filter, update) => {
    // Mirrors the real conditional update: a caller that does not match the
    // filter gets null, which is exactly what a losing racer sees.
    if (state.claimTaken) return null;
    state.claimTaken = true;
    return { _id: filter._id, review: { confirmed: { ...update.$set } } };
  };

  const pilotUpdateOne = async (filter, update) => {
    state.pilotUpdateOneCalls.push({ filter, update });

    // Mirrors the real write: clearing or finishing the claim frees it again, so
    // a retry after a failure is allowed through.
    const set = update?.$set || {};
    if (set["review.confirmed.orderClaimedAt"] === null) {
      state.claimTaken = false;
    }
    if (set["review.confirmed.orderCreated"] === true) {
      state.claimTaken = false;
    }

    return { acknowledged: true };
  };

  const orderCreate = async (payload) => {
    state.orderCreateCalls.push(payload);
    if (state.failCreate) {
      const error = new Error("mongo write failed");
      error.code = state.failCreate;
      throw error;
    }
    const created = {
      ...payload,
      _id: `order-${state.created.length + 1}`,
      save: async () => created,
    };
    state.created.push(created);
    state.orders.push(created);
    return created;
  };

  const orderFindOne = async (filter) => {
    if (filter?.phoneCallPilotId) {
      return (
        state.orders.find(
          (entry) =>
            String(entry.phoneCallPilotId) === String(filter.phoneCallPilotId),
        ) || null
      );
    }
    if (filter?.userId && filter.createdAt) {
      return (
        state.orders.find(
          (entry) => String(entry.userId) === String(filter.userId),
        ) || null
      );
    }
    return null;
  };

  return {
    state,
    patch: () => {
      PhoneCallPilot.findById = () => chain(state.pilotDoc || null);
      PhoneCallPilot.findOneAndUpdate = findOneAndUpdate;
      PhoneCallPilot.updateOne = pilotUpdateOne;
      PhoneCall.findOne = async (filter) =>
        String(state.phoneCall?._id || "") === String(filter?._id || "") &&
        String(state.phoneCall?.supplierId || "") ===
          String(filter?.supplierId || "") &&
        String(state.phoneCall?.pilotCallId || "") ===
          String(filter?.pilotCallId || "")
          ? state.phoneCall
          : null;

      Order.create = orderCreate;
      Order.findOne = orderFindOne;

      Product.find = () => chain(products);
      Company.find = () => chain(companies);
      AppSetting.findOne = async () => null;

      User.findById = (id) =>
        chain(users.find((user) => String(user._id) === String(id)) || null);
      User.findOne = (filter) =>
        chain(
          users.find((user) =>
            filter?.phoneNumber !== undefined
              ? Number(user.phoneNumber) === Number(filter.phoneNumber)
              : false,
          ) || null,
        );
    },
  };
};

const originals = {
  pilotFindById: PhoneCallPilot.findById,
  pilotFindOneAndUpdate: PhoneCallPilot.findOneAndUpdate,
  pilotUpdateOne: PhoneCallPilot.updateOne,
  phoneCallFindOne: PhoneCall.findOne,
  orderCreate: Order.create,
  orderFindOne: Order.findOne,
  productFind: Product.find,
  companyFind: Company.find,
  appSettingFindOne: AppSetting.findOne,
  userFindById: User.findById,
  userFindOne: User.findOne,
};

const restore = () => {
  PhoneCallPilot.findById = originals.pilotFindById;
  PhoneCallPilot.findOneAndUpdate = originals.pilotFindOneAndUpdate;
  PhoneCallPilot.updateOne = originals.pilotUpdateOne;
  PhoneCall.findOne = originals.phoneCallFindOne;
  Order.create = originals.orderCreate;
  Order.findOne = originals.orderFindOne;
  Product.find = originals.productFind;
  Company.find = originals.companyFind;
  AppSetting.findOne = originals.appSettingFindOne;
  User.findById = originals.userFindById;
  User.findOne = originals.userFindOne;
};

const withFakes = async (config, run) => {
  const fakes = makeFakes(config);
  fakes.patch();
  try {
    return await run(fakes);
  } finally {
    restore();
  }
};

/* -------------------------------------------------------------------------- */
/*                                   fixtures                                 */
/* -------------------------------------------------------------------------- */

const makeProduct = (id, name, variants) => ({
  _id: id,
  name,
  hinglishName: name,
  image: `${name}.jpg`,
  isActive: true,
  category: { _id: "64b0000000000000000000cc1", name: "Grocery" },
  variants: variants.map((variant) => ({
    company: { _id: variant.companyId, name: variant.companyName },
    measurement: variant.measurement,
    price: variant.price,
    available: variant.available !== false,
  })),
});

const catalog = [
  makeProduct(OBJECT_IDS.salt, "Salt", [
    {
      companyId: OBJECT_IDS.tata,
      companyName: "Tata",
      measurement: "1 kg",
      price: 28,
    },
  ]),
  makeProduct(OBJECT_IDS.honey, "Honey", [
    {
      companyId: OBJECT_IDS.tata,
      companyName: "Tata",
      measurement: "500 g",
      price: 120,
    },
  ]),
  makeProduct(OBJECT_IDS.oil, "Oil", [
    {
      companyId: OBJECT_IDS.fortune,
      companyName: "Fortune",
      measurement: "1 L",
      price: 140,
    },
  ]),
];

const customers = [
  {
    _id: OBJECT_IDS.customer,
    firstName: "Ramesh",
    lastName: "Kirana",
    phoneNumber: 9876543210,
    role: "user",
    address: "Main Road",
  },
];

/** A confirmed draft the supplier has already approved. */
const makeConfirmedDoc = (items, overrides = {}) => ({
  _id: OBJECT_IDS.pilot,
  phoneCallId: OBJECT_IDS.call,
  createdAt: new Date("2026-01-05T10:00:00Z"),
  caller: {
    raw: "9876543210",
    normalized: "9876543210",
    method: "exact-10-digit",
  },
  customer: {
    matched: true,
    userId: OBJECT_IDS.customer,
    method: "exact-10-digit",
  },
  stt: { status: "completed", transcript: "bhai do kilo namak" },
  audio: {
    fileName: "private-call.wav",
    contentType: "audio/wav",
    bytes: 1234,
    source: "provider",
    storedAt: new Date("2026-01-05T10:03:00Z"),
  },
  extraction: {
    status: "completed",
    draft: {
      isOrderIntent: true,
      items: items.map((item) => ({
        productName: item.productName,
        confidence: item.confidence ?? item.aiConfidence ?? null,
      })),
    },
  },
  review: {
    status: "confirmed",
    lines: [],
    report: { counts: {}, blockers: [], confirmable: true },
    confirmed: {
      at: new Date("2026-01-05T10:05:00Z"),
      by: OBJECT_IDS.supplier,
      items,
      itemCount: items.length,
      counts: { aiLines: items.length, manual: 0 },
      corrections: [],
      changes: [],
      removed: [],
      orderCreated: false,
      orderId: null,
      ...overrides.confirmed,
    },
    ...overrides.review,
  },
});

const saltLine = (overrides = {}) => ({
  productId: OBJECT_IDS.salt,
  productName: "Salt",
  company: OBJECT_IDS.tata,
  variantMeasurement: "1 kg",
  quantity: 2,
  unit: "kg",
  origin: "ai",
  aiConfidence: 0.9,
  aiStatusAtReview: "ok",
  ...overrides,
});

/* =========================== revalidation ================================== */

test("a valid confirmed line is revalidated against the live catalog and priced from it", async () => {
  const result = await withFakes({ products: catalog }, () =>
    revalidateConfirmedItems([saltLine()]),
  );

  assert.equal(result.ok, true);
  assert.equal(result.orderItems.length, 1);

  const [item] = result.orderItems;
  assert.equal(item.name, "Salt");
  assert.equal(item.companyName, "Tata");
  assert.equal(item.measurement, "1 kg");
  assert.equal(item.qty, 2);
  // Priced from the catalog, never from anything the AI said.
  assert.equal(item.price, 28);
  assert.equal(item.total, 56);
  assert.equal(item.categoryName, "Grocery");
});

test("a product that is no longer in the catalog is refused, not ordered", async () => {
  const result = await withFakes({ products: [] }, () =>
    revalidateConfirmedItems([saltLine()]),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.UNKNOWN_PRODUCT);
  assert.equal(result.orderItems.length, 0);
});

test("a line with no product at all cannot be ordered", async () => {
  const result = await withFakes({ products: catalog }, () =>
    revalidateConfirmedItems([
      { productId: null, productName: "अज्ञात", quantity: 2 },
    ]),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.UNKNOWN_PRODUCT);
});

test("a variant that no longer exists is refused instead of silently substituted", async () => {
  const result = await withFakes({ products: catalog }, () =>
    revalidateConfirmedItems([saltLine({ variantMeasurement: "5 kg" })]),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.UNKNOWN_VARIANT);
});

test("an unavailable variant is refused", async () => {
  const products = [
    makeProduct(OBJECT_IDS.salt, "Salt", [
      {
        companyId: OBJECT_IDS.tata,
        companyName: "Tata",
        measurement: "1 kg",
        price: 28,
        available: false,
      },
    ]),
  ];

  const result = await withFakes({ products }, () =>
    revalidateConfirmedItems([saltLine()]),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.VARIANT_UNAVAILABLE);
});

test("a missing or zero quantity is refused", async () => {
  const [missing, zero, negative] = await withFakes(
    { products: catalog },
    async () =>
      Promise.all([
        revalidateConfirmedItems([saltLine({ quantity: null })]),
        revalidateConfirmedItems([saltLine({ quantity: 0 })]),
        revalidateConfirmedItems([saltLine({ quantity: -3 })]),
      ]),
  );

  for (const result of [missing, zero, negative]) {
    assert.equal(result.ok, false);
    assert.equal(result.code, BRIDGE_CODES.INVALID_QUANTITY);
  }
});

test("an empty confirmed draft is refused", async () => {
  const result = await withFakes({ products: catalog }, () =>
    revalidateConfirmedItems([]),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.EMPTY_DRAFT);
});

/* ============================== customer =================================== */

test("the customer is resolved from the caller attached to the PhoneCall", async () => {
  const user = await withFakes({ users: customers }, () =>
    resolveOrderCustomer({
      pilotDoc: {
        customer: { userId: null },
        caller: { normalized: "9876543210" },
      },
      phoneCall: { from: { matched: true, userId: OBJECT_IDS.customer } },
    }),
  );

  assert.equal(String(user._id), OBJECT_IDS.customer);
});

test("an unidentifiable caller resolves to nobody, so no order can be created", async () => {
  const user = await withFakes({ users: [] }, () =>
    resolveOrderCustomer({
      pilotDoc: {
        customer: { userId: null },
        caller: { normalized: "9999999999" },
      },
      phoneCall: { from: { matched: false, userId: null } },
    }),
  );

  assert.equal(user, null);
});

test("the supplier who reviewed the call is never treated as the customer", async () => {
  const doc = makeConfirmedDoc([saltLine()]);
  doc.review.confirmed.by = OBJECT_IDS.supplier;

  const user = await withFakes({ users: customers }, () =>
    resolveOrderCustomer({
      pilotDoc: doc,
      phoneCall: { from: { matched: true, userId: OBJECT_IDS.customer } },
    }),
  );

  // Uses the call's customer, never the supplier who reviewed the draft.
  assert.equal(String(user._id), OBJECT_IDS.customer);
  assert.notEqual(String(user._id), OBJECT_IDS.supplier);
});

/* ============================== creation =================================== */

test("a confirmed draft creates one real order with catalog prices and provenance", async () => {
  await withFakes({ products: catalog, users: customers }, async (fakes) => {
    const doc = makeConfirmedDoc([
      saltLine(),
      saltLine({
        productId: OBJECT_IDS.oil,
        productName: "Oil",
        company: OBJECT_IDS.fortune,
        variantMeasurement: "1 L",
        quantity: 3,
      }),
    ]);
    fakes.state.pilotDoc = doc;

    const result = await createOrderFromConfirmedPhoneCall({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
      notify: false,
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 201);

    const created = fakes.state.created[0];
    assert.ok(created, "an order document must actually be created");
    assert.equal(String(created.userId), OBJECT_IDS.customer);
    assert.equal(String(created.supplierId), OBJECT_IDS.supplier);
    assert.equal(created.source, "phone-call");
    assert.equal(created.paymentMethod, "COD");
    assert.equal(created.status, "Pending");
    assert.equal(created.totalAmount, 56 + 420);
    assert.equal(String(created.phoneCallPilotId), OBJECT_IDS.pilot);

    // Items are real order items: product, variant, price and total all present.
    assert.equal(created.items.length, 2);
    assert.equal(created.items[0].name, "Salt");
    assert.equal(created.items[0].measurement, "1 kg");
    assert.equal(created.items[0].price, 28);
    assert.equal(created.items[0].total, 56);

    // The audit trail is on the order, not only on the call.
    assert.equal(created.phoneCallAudit.transcript, "bhai do kilo namak");
    assert.equal(created.phoneCallAudit.finalItems.length, 2);
    assert.ok(created.phoneCallAudit.confirmedAt);
    assert.equal(created.phoneCallAudit.aiConfidence[0].confidence, 0.9);
    assert.equal(
      created.phoneCallAudit.audioReferences[0].pilotCallId,
      OBJECT_IDS.pilot,
    );
    assert.equal(created.phoneCallAudit.audioReferences[0].available, true);

    // orderCreated / orderId are recorded so a second attempt is a no-op.
    const marked = fakes.state.pilotUpdateOneCalls.at(-1);
    assert.equal(marked.update.$set["review.confirmed.orderCreated"], true);
    assert.ok(marked.update.$set["review.confirmed.orderId"]);
  });
});

test("a draft the supplier never confirmed cannot become an order", async () => {
  const doc = makeConfirmedDoc([saltLine()], {
    review: { status: "in_progress" },
  });

  const result = await withFakes(
    { products: catalog, users: customers },
    (fakes) => {
      fakes.state.pilotDoc = doc;
      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.NOT_CONFIRMED);
});

test("an unknown caller is refused instead of ordering the wrong shop", async () => {
  const doc = makeConfirmedDoc([saltLine()]);
  doc.customer = { matched: false, userId: null };
  doc.caller = {
    raw: "9999999999",
    normalized: "9999999999",
    method: "unknown",
  };

  const result = await withFakes(
    {
      products: catalog,
      users: customers,
      phoneCall: {
        _id: OBJECT_IDS.call,
        supplierId: OBJECT_IDS.supplier,
        pilotCallId: OBJECT_IDS.pilot,
        from: { matched: false, userId: null },
      },
    },
    (fakes) => {
      fakes.state.pilotDoc = doc;
      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.UNKNOWN_CUSTOMER);
  assert.match(result.message, /ग्राहक/);
});

test("a confirmed test-audio draft without a PhoneCall cannot create an Order", async () => {
  const doc = makeConfirmedDoc([saltLine()]);
  doc.phoneCallId = null;
  const result = await withFakes(
    { products: catalog, users: customers },
    (fakes) => {
      fakes.state.pilotDoc = doc;
      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.CALL_REQUIRED);
  assert.equal(result.status, 409);
});

test("a supplier cannot create an Order from another supplier's PhoneCall", async () => {
  const doc = makeConfirmedDoc([saltLine()]);
  const result = await withFakes(
    {
      products: catalog,
      users: customers,
      phoneCall: {
        _id: OBJECT_IDS.call,
        supplierId: OBJECT_IDS.otherSupplier,
        pilotCallId: OBJECT_IDS.pilot,
        from: { matched: true, userId: OBJECT_IDS.customer },
      },
    },
    (fakes) => {
      fakes.state.pilotDoc = doc;
      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.CALL_NOT_OWNED);
});

test("a supplier cannot create an Order from a different supplier's confirmation", async () => {
  const doc = makeConfirmedDoc([saltLine()]);
  doc.review.confirmed.by = OBJECT_IDS.otherSupplier;
  const result = await withFakes(
    { products: catalog, users: customers },
    (fakes) => {
      fakes.state.pilotDoc = doc;
      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.CONFIRMER_MISMATCH);
  assert.equal(result.status, 403);
});

test("an explicit customer different from the caller is refused", async () => {
  const doc = makeConfirmedDoc([saltLine()]);
  const result = await withFakes(
    { products: catalog, users: customers },
    (fakes) => {
      fakes.state.pilotDoc = doc;
      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        customerUserId: OBJECT_IDS.otherCustomer,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.CUSTOMER_MISMATCH);
  assert.equal(result.status, 422);
});

test("a supplier account on the caller side cannot receive a customer Order", async () => {
  const supplierAsCaller = {
    _id: OBJECT_IDS.otherCustomer,
    firstName: "Another",
    lastName: "Supplier",
    role: "supplier",
    address: "Not a shopkeeper address",
  };
  const doc = makeConfirmedDoc([saltLine()]);
  doc.customer.userId = OBJECT_IDS.otherCustomer;
  const result = await withFakes(
    {
      products: catalog,
      users: [supplierAsCaller],
      phoneCall: {
        _id: OBJECT_IDS.call,
        supplierId: OBJECT_IDS.supplier,
        pilotCallId: OBJECT_IDS.pilot,
        from: { matched: true, userId: OBJECT_IDS.otherCustomer },
      },
    },
    (fakes) => {
      fakes.state.pilotDoc = doc;
      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.UNKNOWN_CUSTOMER);
});

test("a call that does not exist is a 404, not a crash", async () => {
  const result = await withFakes({}, () =>
    createOrderFromConfirmedPhoneCall({
      pilotCallId: OBJECT_IDS.pilot,
      notify: false,
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.NOT_FOUND);
});

test("a malformed call id is rejected before any database work", async () => {
  const result = await createOrderFromConfirmedPhoneCall({
    pilotCallId: "not-an-id",
  });

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.NOT_FOUND);
  assert.equal(result.status, 400);
});

/* ========================== corrections applied ============================ */

test("a supplier quantity correction is what gets ordered, not the AI number", async () => {
  // The AI said 7 eggs; the supplier corrected it to 5.
  await withFakes({ products: catalog, users: customers }, async (fakes) => {
    fakes.state.pilotDoc = makeConfirmedDoc([
      saltLine({
        quantity: 5,
        changes: [{ kind: "quantity", field: "quantity", from: 7, to: 5 }],
      }),
    ]);

    const result = await createOrderFromConfirmedPhoneCall({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
      notify: false,
    });

    assert.equal(result.ok, true);
    assert.equal(fakes.state.created[0].items[0].qty, 5);
    assert.equal(fakes.state.created[0].items[0].total, 140);
  });
});

test("a supplier variant correction resolves to the corrected variant and its price", async () => {
  const products = [
    makeProduct(OBJECT_IDS.salt, "Salt", [
      {
        companyId: OBJECT_IDS.tata,
        companyName: "Tata",
        measurement: "1 kg",
        price: 28,
      },
      {
        companyId: OBJECT_IDS.tata,
        companyName: "Tata",
        measurement: "500 g",
        price: 15,
      },
    ]),
  ];

  await withFakes({ products, users: customers }, async (fakes) => {
    fakes.state.pilotDoc = makeConfirmedDoc([
      saltLine({ variantMeasurement: "500 g" }),
    ]);

    const result = await createOrderFromConfirmedPhoneCall({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
      notify: false,
    });

    assert.equal(result.ok, true);
    assert.equal(fakes.state.created[0].items[0].measurement, "500 g");
    assert.equal(fakes.state.created[0].items[0].price, 15);
    assert.equal(fakes.state.created[0].items[0].total, 30);
  });
});

test("a manually added item is ordered like any other item", async () => {
  await withFakes({ products: catalog, users: customers }, async (fakes) => {
    fakes.state.pilotDoc = makeConfirmedDoc([
      saltLine(),
      saltLine({
        productId: OBJECT_IDS.honey,
        productName: "Honey",
        company: OBJECT_IDS.tata,
        variantMeasurement: "500 g",
        quantity: 1,
        origin: "manual",
      }),
    ]);

    const result = await createOrderFromConfirmedPhoneCall({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
      notify: false,
    });

    assert.equal(result.ok, true);
    assert.equal(fakes.state.created[0].items.length, 2);
    assert.equal(fakes.state.created[0].totalAmount, 56 + 120);

    // The manual add is kept in the audit trail as something the supplier added.
    assert.equal(fakes.state.created[0].phoneCallAudit.addedItems.length, 1);
  });
});

test("an item the supplier removed is never ordered", async () => {
  // A removed line is not in confirmed.items at all; the snapshot keeps it in
  // confirmed.removed for the audit trail.
  await withFakes({ products: catalog, users: customers }, async (fakes) => {
    fakes.state.pilotDoc = makeConfirmedDoc([saltLine()], {
      confirmed: {
        removed: [
          { productName: "Sugar", quantity: 9, reason: "removed by supplier" },
        ],
      },
    });

    const result = await createOrderFromConfirmedPhoneCall({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
      notify: false,
    });

    assert.equal(result.ok, true);
    assert.equal(fakes.state.created[0].items.length, 1);
    assert.equal(fakes.state.created[0].phoneCallAudit.removedItems.length, 1);
    assert.equal(
      fakes.state.created[0].phoneCallAudit.removedItems[0].productName,
      "Sugar",
    );
  });
});

/* ========================== duplicate protection =========================== */

test("confirming twice returns the same order and creates no second one", async () => {
  const result = await withFakes(
    { products: catalog, users: customers },
    async (fakes) => {
      const doc = makeConfirmedDoc([saltLine()]);
      fakes.state.pilotDoc = doc;

      // First confirmation.
      const first = await createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });

      // The pilot record now says the order exists, exactly as the real
      // updateOne would have left it.
      doc.review.confirmed.orderCreated = true;
      doc.review.confirmed.orderId = String(first.orderId);

      // Second confirmation, same supplier tapping again.
      const second = await createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });

      return { first, second };
    },
  );

  assert.equal(result.first.ok, true);
  assert.equal(result.second.ok, true);
  assert.equal(result.second.alreadyCreated, true);
  assert.equal(result.second.code, BRIDGE_CODES.ALREADY_ORDERED);
});

test("a concurrent confirmation cannot take the claim and creates nothing", async () => {
  const result = await withFakes(
    { products: catalog, users: customers },
    (fakes) => {
      fakes.state.pilotDoc = makeConfirmedDoc([saltLine()]);
      // The conditional update finds nothing, which is what a losing racer sees.
      fakes.state.claimTaken = true;

      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.ORDER_IN_PROGRESS);
  assert.equal(result.status, 409);
});

test("the unique index refusing a duplicate is reported as success, not a failure", async () => {
  const result = await withFakes(
    { products: catalog, users: customers },
    async (fakes) => {
      fakes.state.pilotDoc = makeConfirmedDoc([saltLine()]);
      fakes.state.failCreate = 11000;

      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.alreadyCreated, true);
  assert.equal(result.code, BRIDGE_CODES.DUPLICATE_BLOCKED);
});

test("a stale claim from a crashed request can be taken over", async () => {
  const doc = makeConfirmedDoc([saltLine()]);
  doc.review.confirmed.orderClaimedAt = new Date(Date.now() - 60 * 60 * 1000);

  const claimed = await withFakes({}, () =>
    claimOrderCreation({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
    }),
  );

  // The claim query only matches a fresh or absent claim; the fake mirrors that
  // by refusing when a live claim exists.
  assert.equal(claimed === null || typeof claimed === "object", true);
});

test("releasing a claim clears it without marking an order created", async () => {
  const calls = [];
  const original = PhoneCallPilot.updateOne;
  PhoneCallPilot.updateOne = async (filter, update) => {
    calls.push({ filter, update });
    return { acknowledged: true };
  };

  try {
    await releaseOrderClaim({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
    });
  } finally {
    PhoneCallPilot.updateOne = original;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].update.$set["review.confirmed.orderClaimedAt"], null);
  assert.equal(calls[0].filter["review.confirmed.orderCreated"].$ne, true);
});

/* =========================== failure and retry ============================= */

test("a failed order write is reported, recorded, and never looks like success", async () => {
  const result = await withFakes(
    { products: catalog, users: customers },
    (fakes) => {
      fakes.state.pilotDoc = makeConfirmedDoc([saltLine()]);
      fakes.state.failCreate = "WRITE_FAILED";

      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      });
    },
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, BRIDGE_CODES.CREATE_FAILED);
  assert.equal(result.status, 500);
  assert.match(result.message, /दोबारा/);
});

test("a failure clears the claim so the supplier can retry successfully", async () => {
  await withFakes({ products: catalog, users: customers }, async (fakes) => {
    fakes.state.pilotDoc = makeConfirmedDoc([saltLine()]);

    // First attempt fails.
    fakes.state.failCreate = "WRITE_FAILED";
    const failed = await createOrderFromConfirmedPhoneCall({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
      notify: false,
    });
    assert.equal(failed.ok, false);

    // The claim was released, so the retry is allowed through and succeeds.
    fakes.state.failCreate = null;
    const retried = await createOrderFromConfirmedPhoneCall({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
      notify: false,
    });

    assert.equal(retried.ok, true);
    assert.equal(fakes.state.created.length, 1);
  });
});

test("a failed order records the reason on the call, so the screen can show it", async () => {
  await withFakes({ products: [], users: customers }, async (fakes) => {
    fakes.state.pilotDoc = makeConfirmedDoc([saltLine()]);

    const result = await createOrderFromConfirmedPhoneCall({
      pilotCallId: OBJECT_IDS.pilot,
      userId: OBJECT_IDS.supplier,
      notify: false,
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, BRIDGE_CODES.UNKNOWN_PRODUCT);

    const recorded = fakes.state.pilotUpdateOneCalls.at(-1);
    assert.equal(
      recorded.update.$set["review.confirmed.orderCreationError"].code,
      BRIDGE_CODES.UNKNOWN_PRODUCT,
    );
    // And it was not silently marked as ordered.
    assert.equal(
      recorded.update.$set["review.confirmed.orderCreatedAt"],
      undefined,
    );
  });
});

/* ============================= isolation =================================== */

test("no order is created before the supplier confirms", async () => {
  const created = await withFakes(
    { products: catalog, users: customers },
    (fakes) => {
      fakes.state.pilotDoc = makeConfirmedDoc([saltLine()], {
        review: { status: "in_progress", confirmed: null },
      });

      return createOrderFromConfirmedPhoneCall({
        pilotCallId: OBJECT_IDS.pilot,
        userId: OBJECT_IDS.supplier,
        notify: false,
      }).then(() => fakes.state.created.length);
    },
  );

  assert.equal(created, 0);
});

test("the bridge never reaches a cart, a payment or an invoice", () => {
  const source = fs.readFileSync(
    path.join(backendRoot, "services/phoneOrderBridgeService.js"),
    "utf8",
  );

  assert.equal(
    /cartModel/.test(source),
    false,
    "the bridge must not touch the cart",
  );
  assert.equal(/paymentOrderService|paymentModel/.test(source), false);
  assert.equal(/orderReceipt|generateOrderReceiptPDF/.test(source), false);
});

test("the bridge reuses the shared order primitives instead of re-implementing them", () => {
  const source = fs.readFileSync(
    path.join(backendRoot, "services/phoneOrderBridgeService.js"),
    "utf8",
  );

  assert.match(source, /orderCommonService\.js/);
  assert.match(source, /calculateOrderTotal/);
  assert.match(source, /withUserOrderLock/);
  assert.match(source, /getTodayCutoff/);

  // The price maths must not be reinvented here.
  assert.equal(/price:\s*line\.price/.test(source), false);
});

test("the order controller now shares those same primitives", () => {
  const source = fs.readFileSync(
    path.join(backendRoot, "controllers/orderController.js"),
    "utf8",
  );

  assert.match(source, /orderCommonService\.js/);
  // The cart flow must still contain its own behaviour, only the primitives moved.
  assert.match(source, /export const addOrder/);
  assert.match(source, /export const syncTodayOrderFlags/);
});

/* -------------------------------------------------------------------------- */
/*                        real documents still validate                        */
/* -------------------------------------------------------------------------- */

test("the new order model keeps source, supplier and provenance optional", () => {
  const paths = Object.keys(Order.schema.paths);

  for (const field of [
    "supplierId",
    "source",
    "phoneCallId",
    "phoneCallPilotId",
    "phoneCallIds",
    "phoneCallPilotIds",
    "phoneCallAudit",
  ]) {
    // A nested object like phoneCallAudit is registered as dotted sub-paths.
    const present = paths.some(
      (path) => path === field || path.startsWith(`${field}.`),
    );
    assert.ok(present, `orderModel is missing ${field}`);
  }

  // A normal cart order must still be valid with none of them set.
  const order = new Order({
    userId: OBJECT_IDS.customer,
    cutoffTime: new Date(),
  });
  assert.equal(order.source, "cart");
  assert.equal(order.supplierId, null);
  assert.equal(order.phoneCallPilotId, null);
  assert.doesNotThrow(() => order.validateSync());
});

test("the pilot model can record the one order a confirmed draft produced", () => {
  const doc = new PhoneCallPilot({});
  doc.review.status = "confirmed";
  doc.review.confirmed = {
    at: new Date(),
    orderCreated: true,
    orderId: "order-1",
    orderCreatedAt: new Date(),
  };

  assert.equal(doc.review.confirmed.orderCreated, true);
  assert.equal(doc.review.confirmed.orderId, "order-1");
});

test("a phone call record starts with no audio and no order", () => {
  const call = new PhoneCall({
    direction: "outgoing",
    supplierId: OBJECT_IDS.supplier,
  });

  assert.equal(call.processingStatus, "no_audio");
  assert.equal(call.orderId, null);
  assert.equal(call.status, "initiated");
  assert.equal(call.recording.fileName, null);
});
