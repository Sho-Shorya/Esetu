import test from "node:test";
import assert from "node:assert/strict";

import PhoneCall from "../models/phoneCallModel.js";
import { User } from "../models/userModel.js";
import {
  buildParty,
  identifyCallCustomer,
  maskPhone,
  setProcessingStatus,
  toPublicCall,
  UNKNOWN_CALLER_LABEL,
} from "../services/phoneCallService.js";

const OBJECT_IDS = {
  supplier: "64b0000000000000000000b1",
  shopkeeper: "64b0000000000000000000c1",
  otherShop: "64b0000000000000000000c2",
  call: "64b0000000000000000000d1",
};

const users = [
  {
    _id: OBJECT_IDS.supplier,
    firstName: "Ramesh",
    lastName: "Wholesale",
    phoneNumber: 9811111111,
    role: "supplier",
    place: "Market",
  },
  {
    _id: OBJECT_IDS.shopkeeper,
    firstName: "Suresh",
    lastName: "Kirana",
    phoneNumber: 9876543210,
    role: "user",
    place: "Village",
  },
  {
    _id: OBJECT_IDS.otherShop,
    firstName: "Anil",
    lastName: "Store",
    phoneNumber: 9555555555,
    role: "user",
    place: "Village",
  },
];

const chain = (value) => {
  const api = {
    select: () => api,
    sort: () => api,
    limit: () => api,
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return api;
};

const originals = {
  userFindOne: User.findOne,
  userFindById: User.findById,
  userFind: User.find,
  callFind: PhoneCall.find,
  callFindOne: PhoneCall.findOne,
  callFindById: PhoneCall.findById,
};

const restore = () => {
  User.findOne = originals.userFindOne;
  User.findById = originals.userFindById;
  User.find = originals.userFind;
  PhoneCall.find = originals.callFind;
  PhoneCall.findOne = originals.callFindOne;
  PhoneCall.findById = originals.callFindById;
};

const withUsers = async (run) => {
  User.findOne = (filter) =>
    chain(
      users.find((user) =>
        filter?.phoneNumber !== undefined
          ? Number(user.phoneNumber) === Number(filter.phoneNumber)
          : false,
      ) || null,
    );
  User.findById = (id) =>
    chain(users.find((user) => String(user._id) === String(id)) || null);
  try {
    return await run();
  } finally {
    restore();
  }
};

/* ============================ customer association ========================= */

test("a known caller number is matched exactly, never fuzzily", async () => {
  const party = await withUsers(() => buildParty({ phone: "9876543210" }));

  assert.equal(party.matched, true);
  assert.equal(String(party.userId), OBJECT_IDS.shopkeeper);
  assert.equal(party.name, "Suresh Kirana");
  assert.equal(party.matchMethod, "exact-10-digit");
});

test("an unknown caller stays unknown, with nothing filled in", async () => {
  const party = await withUsers(() => buildParty({ phone: "9000000000" }));

  assert.equal(party.matched, false);
  assert.equal(party.userId, null);
  assert.equal(party.name, "");
  assert.equal(party.matchMethod, null);
  // The number is still kept, so the supplier can recognise their own line.
  assert.equal(party.phoneNumber, "9000000000");
});

test("a supplier slot refuses a shopkeeper's number", async () => {
  const party = await withUsers(() =>
    buildParty({ phone: "9876543210", preferSupplier: true }),
  );

  // A shopkeeper is not a supplier, so the call is treated as unresolvable
  // rather than pointing at the wrong person.
  assert.equal(party.matched, false);
  assert.equal(party.userId, null);
});

test("a supplier number resolves in a supplier slot", async () => {
  const party = await withUsers(() =>
    buildParty({ phone: "9811111111", preferSupplier: true }),
  );

  assert.equal(party.matched, true);
  assert.equal(party.isSupplier, true);
});

test("the supplier can identify an unknown caller by hand, and it is recorded", async () => {
  PhoneCall.findById = async () => ({
    _id: OBJECT_IDS.call,
    direction: "incoming",
    from: { matched: false, phoneNumber: "9000000000" },
    to: { userId: OBJECT_IDS.supplier },
    pilotCallId: null,
    set(patch) {
      Object.assign(this, patch);
    },
    async save() {},
  });

  try {
    const result = await withUsers(() =>
      identifyCallCustomer({
        callId: OBJECT_IDS.call,
        customerUserId: OBJECT_IDS.shopkeeper,
        byUserId: OBJECT_IDS.supplier,
      }),
    );

    assert.equal(result.ok, true);
    assert.equal(result.call.from.matched, true);
    assert.equal(String(result.call.from.userId), OBJECT_IDS.shopkeeper);
    assert.equal(result.call.from.matchMethod, "manual");
    assert.equal(String(result.call.customerIdentifiedBy), OBJECT_IDS.supplier);
  } finally {
    restore();
  }
});

test("identifying a call with no customer is refused", async () => {
  PhoneCall.findById = async () => ({
    _id: OBJECT_IDS.call,
    direction: "outgoing",
    from: { matched: false },
    to: {},
    async save() {},
  });

  try {
    const result = await withUsers(() =>
      identifyCallCustomer({
        callId: OBJECT_IDS.call,
        byUserId: OBJECT_IDS.supplier,
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.code, "CUSTOMER_REQUIRED");
  } finally {
    restore();
  }
});

test("a supplier can never be attached as the customer", async () => {
  PhoneCall.findById = async () => ({
    _id: OBJECT_IDS.call,
    direction: "incoming",
    from: { matched: false },
    to: {},
    async save() {},
  });

  try {
    const result = await withUsers(() =>
      identifyCallCustomer({
        callId: OBJECT_IDS.call,
        customerUserId: OBJECT_IDS.supplier,
        byUserId: OBJECT_IDS.supplier,
      }),
    );

    assert.equal(result.ok, false);
    assert.equal(result.code, "NOT_A_CUSTOMER");
  } finally {
    restore();
  }
});

test("identifying a supplier-dialled call writes the customer to the other side", async () => {
  // The supplier placed this call, so the supplier is on "from" and the
  // shopkeeper is on "to". Writing the customer to "from" here would overwrite
  // the supplier with the customer and lose the real caller, which then also
  // makes the order resolve to the wrong party.
  PhoneCall.findById = async () => ({
    _id: OBJECT_IDS.call,
    direction: "outgoing",
    initiatedByRole: "supplier",
    from: { userId: OBJECT_IDS.supplier, matched: true, name: "Supplier" },
    to: { matched: false, phoneNumber: "9000000000" },
    pilotCallId: null,
    async save() {},
  });

  try {
    const result = await withUsers(() =>
      identifyCallCustomer({
        callId: OBJECT_IDS.call,
        customerUserId: OBJECT_IDS.shopkeeper,
        byUserId: OBJECT_IDS.supplier,
      }),
    );

    assert.equal(result.ok, true);
    assert.equal(String(result.call.to.userId), OBJECT_IDS.shopkeeper);
    assert.equal(result.call.to.matchMethod, "manual");
    assert.equal(
      String(result.call.from.userId),
      OBJECT_IDS.supplier,
      "the real caller is left alone",
    );
  } finally {
    restore();
  }
});

test("a shopkeeper-dialled call still records the customer as the caller", async () => {
  PhoneCall.findById = async () => ({
    _id: OBJECT_IDS.call,
    direction: "incoming",
    initiatedByRole: "shopkeeper",
    from: { matched: false, phoneNumber: "9000000000" },
    to: { userId: OBJECT_IDS.supplier },
    pilotCallId: null,
    async save() {},
  });

  try {
    const result = await withUsers(() =>
      identifyCallCustomer({
        callId: OBJECT_IDS.call,
        customerUserId: OBJECT_IDS.shopkeeper,
        byUserId: OBJECT_IDS.supplier,
      }),
    );

    assert.equal(result.ok, true);
    assert.equal(String(result.call.from.userId), OBJECT_IDS.shopkeeper);
    assert.equal(String(result.call.to.userId), OBJECT_IDS.supplier);
  } finally {
    restore();
  }
});

/* ============================== projection ================================= */

test("an unidentified caller is shown as अज्ञात कॉलर with a masked number", () => {
  const view = toPublicCall({
    _id: OBJECT_IDS.call,
    direction: "incoming",
    status: "completed",
    processingStatus: "no_audio",
    from: { matched: false, phoneNumber: "9876543210", name: "", userId: null },
    to: { matched: true, name: "Ramesh Wholesale", phoneNumber: "9811111111" },
    callAt: new Date(),
    durationSeconds: 30,
  });

  assert.equal(view.from.displayName, UNKNOWN_CALLER_LABEL);
  assert.equal(view.from.displayName, "अज्ञात कॉलर");
  assert.equal(view.from.phoneNumber, "98XXXXXXXX");
  assert.equal(view.from.matched, false);
  assert.equal(view.to.displayName, "Ramesh Wholesale");
  assert.equal(view.hasAudio, false);
  assert.equal(view.orderId, null);
});

test("a call with audio or a draft reports that it has one", () => {
  const withPilot = toPublicCall({
    _id: OBJECT_IDS.call,
    direction: "outgoing",
    from: { matched: true, name: "Suresh" },
    to: { matched: true, name: "Ramesh" },
    pilotCallId: "pilot-1",
  });
  assert.equal(withPilot.hasAudio, true);

  const withFile = toPublicCall({
    _id: OBJECT_IDS.call,
    direction: "outgoing",
    from: { matched: true, name: "Suresh" },
    to: { matched: true, name: "Ramesh" },
    recording: { fileName: "call-1.mp3" },
  });
  assert.equal(withFile.hasAudio, true);

  const bare = toPublicCall({
    _id: OBJECT_IDS.call,
    direction: "outgoing",
    from: { matched: true, name: "Suresh" },
    to: { matched: true, name: "Ramesh" },
  });
  assert.equal(bare.hasAudio, false);
});

test("a phone number is masked for display", () => {
  assert.equal(maskPhone("9876543210"), "98XXXXXXXX");
  assert.equal(maskPhone("98111"), "98XXX");
  assert.equal(maskPhone(""), "");
});

/* ============================== pipeline state ============================ */

const makeSavedCall = (overrides = {}) => {
  const call = {
    _id: OBJECT_IDS.call,
    status: "ringing",
    answeredAt: null,
    endedAt: null,
    durationSeconds: null,
    saves: 0,
    set(patch) {
      Object.assign(this, patch);
    },
    async save() {
      this.saves += 1;
      return this;
    },
    ...overrides,
  };
  return call;
};

test("attaching an order marks the call done and clears any error", async () => {
  const call = makeSavedCall({
    processingStatus: "processing",
    lastError: { message: "boom" },
  });
  PhoneCall.findById = async () => call;

  const result = await withUsers(() =>
    setProcessingStatus({ callId: OBJECT_IDS.call, orderId: "order-1" }),
  );

  assert.equal(result.ok, true);
  assert.equal(call.processingStatus, "order_created");
  assert.equal(String(call.orderId), "order-1");
  assert.equal(call.lastError.message, null);
});

test("a failure is recorded on the call rather than hidden", async () => {
  const call = makeSavedCall();
  PhoneCall.findById = async () => call;

  await withUsers(() =>
    setProcessingStatus({
      callId: OBJECT_IDS.call,
      processingStatus: "failed",
      error: { message: "ऑडियो नहीं मिला", code: "NO_AUDIO" },
    }),
  );

  assert.equal(call.processingStatus, "failed");
  assert.equal(call.lastError.message, "ऑडियो नहीं मिला");
  assert.equal(call.lastError.code, "NO_AUDIO");
  assert.ok(call.lastError.at);
});

/* ============================ the model itself ============================= */

test("a phone call record starts with nothing attached", () => {
  const call = new PhoneCall({
    direction: "outgoing",
    supplierId: OBJECT_IDS.supplier,
  });

  assert.equal(call.status, "initiated");
  assert.equal(call.processingStatus, "no_audio");
  assert.equal(call.pilotCallId, null);
  assert.equal(call.orderId, null);
  assert.equal(call.durationSeconds, null);
  assert.doesNotThrow(() => call.validateSync());
});

test("an unusable processing status cannot be stored", () => {
  const call = new PhoneCall({
    direction: "outgoing",
    processingStatus: "bogus",
  });
  const error = call.validateSync();

  assert.ok(error.errors.processingStatus);
  const allowed = PhoneCall.schema.path("processingStatus").enumValues;
  assert.ok(allowed.includes("needs_review"));
  assert.equal(allowed.includes("bogus"), false);
});

test("the provider block is gone from the call model", () => {
  const call = new PhoneCall({ direction: "outgoing" });

  assert.equal(call.provider, undefined);
  assert.equal(call.schema.path("provider"), undefined);
  assert.equal(call.waitUntil, undefined);
  assert.equal(call.waitNoticeSentAt, undefined);
});
