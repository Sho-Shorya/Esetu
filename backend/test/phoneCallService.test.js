import test from "node:test";
import assert from "node:assert/strict";

import PhoneCall from "../models/phoneCallModel.js";
import { User } from "../models/userModel.js";
import {
  CALL_STATUS_BY_KEYWORD,
  buildParty,
  identifyCallCustomer,
  isTerminalStatus,
  listCallsNeedingReview,
  listCallsForSupplier,
  listCallsForUser,
  logIncomingCall,
  logOutgoingCall,
  maskPhone,
  normalizeCallStatus,
  setProcessingStatus,
  toDialString,
  toPublicCall,
  updateCallStatus,
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
  callCreate: PhoneCall.create,
  callFind: PhoneCall.find,
  callFindOne: PhoneCall.findOne,
  callFindById: PhoneCall.findById,
};

const restore = () => {
  User.findOne = originals.userFindOne;
  User.findById = originals.userFindById;
  User.find = originals.userFind;
  PhoneCall.create = originals.callCreate;
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

/* ============================ status vocabulary ============================ */

test("a real provider status word maps onto our own vocabulary", () => {
  assert.equal(normalizeCallStatus("Ringing"), "ringing");
  assert.equal(normalizeCallStatus("in-progress"), "answered");
  assert.equal(normalizeCallStatus("completed"), "completed");
  assert.equal(normalizeCallStatus("no-answer"), "no_answer");
  assert.equal(normalizeCallStatus("busy"), "failed");
  assert.equal(normalizeCallStatus("unanswered"), "missed");
  assert.equal(normalizeCallStatus("something-unknown"), null);
  assert.equal(normalizeCallStatus(null), null);
});

test("every mapped status is one the model actually accepts", () => {
  const allowed = new Set(PhoneCall.schema.path("status").enumValues);

  for (const value of Object.values(CALL_STATUS_BY_KEYWORD)) {
    assert.ok(allowed.has(value), `${value} is not a valid call status`);
  }
});

test("a finished call stays finished", () => {
  assert.equal(isTerminalStatus("completed"), true);
  assert.equal(isTerminalStatus("missed"), true);
  assert.equal(isTerminalStatus("ringing"), false);
  assert.equal(isTerminalStatus("answered"), false);
});

/* ================================ dialling ================================= */

test("a number is dialled as a plain 10-digit string", () => {
  assert.equal(toDialString("9876543210"), 9876543210);
  assert.equal(toDialString("+91 98765 43210"), 9876543210);
  assert.equal(toDialString("09876543210"), 9876543210);
  assert.equal(toDialString("12345"), null);
  assert.equal(toDialString(""), null);
  assert.equal(toDialString(null), null);
});

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
  // rather than dialling the wrong person.
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
  const saved = [];
  PhoneCall.findById = async () => ({
    _id: OBJECT_IDS.call,
    direction: "incoming",
    from: { matched: false, phoneNumber: "9000000000" },
    to: { userId: OBJECT_IDS.supplier },
    pilotCallId: null,
    set(patch) {
      Object.assign(this, patch);
    },
    async save() {
      saved.push(this);
    },
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

/* =============================== call writing ============================== */

test("a dialled call is recorded with the real supplier, not a guess", async () => {
  let created = null;
  PhoneCall.create = async (payload) => {
    created = payload;
    return payload;
  };

  const result = await withUsers(() =>
    logOutgoingCall({
      initiatedBy: OBJECT_IDS.shopkeeper,
      supplierId: OBJECT_IDS.supplier,
      toPhone: "9811111111",
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(created.direction, "outgoing");
  assert.equal(String(created.supplierId), OBJECT_IDS.supplier);
  assert.equal(String(created.initiatedBy), OBJECT_IDS.shopkeeper);
  assert.equal(created.processingStatus, "no_audio");
  assert.equal(created.to.name, "Ramesh Wholesale");
  assert.equal(String(created.from.userId), OBJECT_IDS.shopkeeper);
});

test("a call to a number that is not a supplier is refused", async () => {
  PhoneCall.create = async () => {
    throw new Error("must not create a call to a non-supplier");
  };

  const result = await withUsers(() =>
    logOutgoingCall({
      initiatedBy: OBJECT_IDS.shopkeeper,
      toPhone: "9876543210",
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "SUPPLIER_NOT_FOUND");
});

test("a call with no known outcome is stored as initiated, not as completed", async () => {
  let created = null;
  PhoneCall.create = async (payload) => {
    created = payload;
    return payload;
  };

  await withUsers(() =>
    logOutgoingCall({
      initiatedBy: OBJECT_IDS.shopkeeper,
      supplierId: OBJECT_IDS.supplier,
      status: "something-the-app-cannot-know",
    }),
  );

  assert.equal(created.status, "initiated");
  assert.equal(created.endedAt, null);
});

test("a reported duration is kept when the handset actually knows it", async () => {
  let created = null;
  PhoneCall.create = async (payload) => {
    created = payload;
    return payload;
  };

  await withUsers(() =>
    logOutgoingCall({
      initiatedBy: OBJECT_IDS.shopkeeper,
      supplierId: OBJECT_IDS.supplier,
      status: "completed",
      durationSeconds: 42,
    }),
  );

  assert.equal(created.status, "completed");
  assert.equal(created.durationSeconds, 42);
  assert.ok(created.endedAt);
});

test("an incoming call is recorded against the supplier who owns the line", async () => {
  let created = null;
  PhoneCall.create = async (payload) => {
    created = payload;
    return payload;
  };

  const result = await withUsers(() =>
    logIncomingCall({
      supplierId: OBJECT_IDS.supplier,
      fromPhone: "9876543210",
      status: "ringing",
    }),
  );

  assert.equal(result.ok, true);
  assert.equal(created.direction, "incoming");
  assert.equal(created.status, "ringing");
  assert.equal(String(created.from.userId), OBJECT_IDS.shopkeeper);
});

test("an incoming call for a non-supplier is refused", async () => {
  PhoneCall.create = async () => {
    throw new Error("must not create a call");
  };

  const result = await withUsers(() =>
    logIncomingCall({
      supplierId: OBJECT_IDS.shopkeeper,
      fromPhone: "9876543210",
    }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "SUPPLIER_NOT_FOUND");
});

/* ============================== status updates ============================= */

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

test("answering then ending a call records the time we can actually prove", async () => {
  const call = makeSavedCall();

  await withUsers(async () => {
    PhoneCall.findById = async () => call;
    await updateCallStatus({ callId: OBJECT_IDS.call, status: "answered" });
    assert.equal(call.status, "answered");
    assert.ok(call.answeredAt);

    await updateCallStatus({
      callId: OBJECT_IDS.call,
      status: "completed",
      now: new Date(new Date(call.answeredAt).getTime() + 65_000),
    });
  });

  assert.equal(call.status, "completed");
  assert.ok(call.endedAt);
  // Measured from answer to end, not invented.
  assert.equal(call.durationSeconds, 65);
});

test("a late webhook cannot resurrect a call that already ended", async () => {
  const call = makeSavedCall({ status: "completed" });
  PhoneCall.findById = async () => call;

  const result = await withUsers(() =>
    updateCallStatus({ callId: OBJECT_IDS.call, status: "ringing" }),
  );

  assert.equal(result.unchanged, true);
  assert.equal(call.status, "completed");
  assert.equal(call.saves, 0, "nothing was written");
});

test("an unusable status is rejected instead of guessed at", async () => {
  PhoneCall.findById = async () => makeSavedCall();

  const result = await withUsers(() =>
    updateCallStatus({ callId: OBJECT_IDS.call, status: "banana" }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.code, "BAD_STATUS");
});

test("a missing call is a 404, not a crash", async () => {
  PhoneCall.findById = async () => null;

  const result = await withUsers(() =>
    updateCallStatus({ callId: OBJECT_IDS.call, status: "completed" }),
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, 404);
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

/* ================================= lists ================================== */

test("the shopkeeper only ever sees their own calls", async () => {
  const filter = [];
  PhoneCall.find = (query) => {
    filter.push(query);
    return chain([]);
  };

  await withUsers(() => listCallsForUser({ userId: OBJECT_IDS.shopkeeper }));
  assert.deepEqual(filter[0].$or, [
    { initiatedBy: OBJECT_IDS.shopkeeper },
    { "to.userId": OBJECT_IDS.shopkeeper },
  ]);
});

test("the supplier section only ever sees calls to their own line", async () => {
  const filter = [];
  PhoneCall.find = (query) => {
    filter.push(query);
    return chain([]);
  };

  await withUsers(() =>
    listCallsForSupplier({ supplierId: OBJECT_IDS.supplier }),
  );
  assert.equal(filter[0].supplierId, OBJECT_IDS.supplier);
});

test("calls needing review are only drafts that are not ordered yet", async () => {
  const filter = [];
  PhoneCall.find = (query) => {
    filter.push(query);
    return chain([]);
  };

  await withUsers(() =>
    listCallsNeedingReview({ supplierId: OBJECT_IDS.supplier }),
  );

  const statuses = filter[0].processingStatus.$in;
  assert.ok(statuses.includes("draft_ready"));
  assert.ok(statuses.includes("needs_review"));
  assert.ok(statuses.includes("confirmed"));
  assert.equal(statuses.includes("order_created"), false);
  assert.equal(statuses.includes("failed"), false);
});

/* ============================== pipeline state ============================ */

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
