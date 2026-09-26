import test from "node:test";
import assert from "node:assert/strict";
import PhoneCall from "../models/phoneCallModel.js";
import { User } from "../models/userModel.js";
import { recordOutgoingCall } from "../controllers/phoneCallController.js";
import {
  getShopkeeperWaitState,
  PHONE_WAIT_MS,
  sendSupplierWaitNotice,
} from "../services/phoneWaitService.js";
import { logSupplierOutgoingCall } from "../services/phoneCallService.js";

const IDS = {
  supplier: "64b0000000000000000000b1",
  customer: "64b0000000000000000000c1",
  other: "64b0000000000000000000c2",
  call: "64b0000000000000000000d1",
};

const query = (value) => {
  const result = {
    select: () => result,
    populate: () => result,
    lean: async () => value,
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject),
  };
  return result;
};

const makeResponse = () => ({
  statusCode: null,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});

test("supplier call logs a real device-dial target against the selected shopkeeper", async () => {
  const originalUserFindById = User.findById;
  const originalCallCreate = PhoneCall.create;
  let created;
  User.findById = (id) =>
    query(
      String(id) === IDS.supplier
        ? {
            _id: IDS.supplier,
            firstName: "Sita",
            lastName: "Supply",
            role: "supplier",
            phoneNumber: 9811111111,
          }
        : {
            _id: IDS.customer,
            firstName: "Ramesh",
            lastName: "Kirana",
            role: "user",
            phoneNumber: 9876543210,
          },
    );
  PhoneCall.create = async (payload) => {
    created = payload;
    return { _id: IDS.call, ...payload };
  };

  try {
    const result = await logSupplierOutgoingCall({
      supplierId: IDS.supplier,
      customerUserId: IDS.customer,
      now: new Date("2026-09-27T10:00:00Z"),
    });
    assert.equal(result.ok, true);
    assert.equal(String(created.initiatedBy), IDS.supplier);
    assert.equal(created.initiatedByRole, "supplier");
    assert.equal(String(created.supplierId), IDS.supplier);
    assert.equal(String(created.to.userId), IDS.customer);
    assert.equal(created.to.phoneNumber, "9876543210");
  } finally {
    User.findById = originalUserFindById;
    PhoneCall.create = originalCallCreate;
  }
});

test("wait notice claims the customer for exactly ten minutes and sends targeted notification", async () => {
  const originalCallFindOne = PhoneCall.findOne;
  const originalCallUpdateOne = PhoneCall.updateOne;
  const originalUserFindOneAndUpdate = User.findOneAndUpdate;
  const now = new Date("2026-09-27T10:00:00Z");
  const call = {
    _id: IDS.call,
    direction: "outgoing",
    status: "initiated",
    processingStatus: "no_audio",
    supplierId: IDS.supplier,
    from: {
      userId: IDS.customer,
      name: "Ramesh Kirana",
      matched: true,
      phoneNumber: "9876543210",
    },
    to: {
      userId: IDS.supplier,
      name: "Sita Supply",
      matched: true,
      phoneNumber: "9811111111",
    },
    initiatedByRole: "shopkeeper",
    callAt: now,
    toObject() {
      return this;
    },
  };
  let updateFilter;
  let updateBody;
  let callAudit;
  let notification;
  PhoneCall.findOne = async (filter) => {
    assert.equal(String(filter._id), IDS.call);
    assert.equal(String(filter.supplierId), IDS.supplier);
    return call;
  };
  User.findOneAndUpdate = (filter, update) => {
    updateFilter = filter;
    updateBody = update;
    return query({ _id: IDS.customer });
  };
  PhoneCall.updateOne = async (_filter, update) => {
    callAudit = update.$set;
    return { acknowledged: true };
  };

  try {
    const result = await sendSupplierWaitNotice({
      callId: IDS.call,
      supplierId: IDS.supplier,
      now,
      notify: async (payload) => {
        notification = payload;
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.wait.active, true);
    assert.equal(result.wait.secondsRemaining, PHONE_WAIT_MS / 1000);
    assert.equal(String(updateFilter._id), IDS.customer);
    assert.equal(updateFilter.role, "user");
    assert.equal(
      updateBody.$set.phoneOrderWaitUntil.getTime(),
      now.getTime() + PHONE_WAIT_MS,
    );
    assert.equal(
      String(updateBody.$set.phoneOrderWaitSupplierId),
      IDS.supplier,
    );
    assert.equal(String(updateBody.$set.phoneOrderWaitCallId), IDS.call);
    assert.equal(callAudit.waitUntil.getTime(), now.getTime() + PHONE_WAIT_MS);
    assert.equal(notification.userIds[0], IDS.customer);
    assert.match(notification.message, /10 मिनट/);
    assert.match(notification.url, /\/calling$/);
  } finally {
    PhoneCall.findOne = originalCallFindOne;
    PhoneCall.updateOne = originalCallUpdateOne;
    User.findOneAndUpdate = originalUserFindOneAndUpdate;
  }
});

test("unknown caller cannot receive a wait lock or targeted notification", async () => {
  const originalCallFindOne = PhoneCall.findOne;
  const originalUserFindOneAndUpdate = User.findOneAndUpdate;
  PhoneCall.findOne = async () => ({
    _id: IDS.call,
    supplierId: IDS.supplier,
    from: { matched: false, userId: null },
    to: { matched: true, userId: IDS.supplier },
  });
  User.findOneAndUpdate = async () => {
    throw new Error("must not lock unknown caller");
  };

  try {
    const result = await sendSupplierWaitNotice({
      callId: IDS.call,
      supplierId: IDS.supplier,
      notify: async () => {
        throw new Error("must not notify unknown caller");
      },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "CUSTOMER_UNKNOWN");
  } finally {
    PhoneCall.findOne = originalCallFindOne;
    User.findOneAndUpdate = originalUserFindOneAndUpdate;
  }
});

test("shopkeeper app call API rejects an active wait before writing a call", async () => {
  const originalUserFindById = User.findById;
  const originalUserFindOneAndUpdate = User.findOneAndUpdate;
  const originalCallCreate = PhoneCall.create;
  User.findOneAndUpdate = () => query(null);
  User.findById = () =>
    query({
      phoneOrderWaitUntil: new Date(Date.now() + 5 * 60 * 1000),
      phoneOrderWaitSupplierId: { firstName: "Sita", lastName: "Supply" },
      phoneOrderWaitCallId: IDS.call,
    });
  PhoneCall.create = async () => {
    throw new Error("must reject before call log write");
  };

  try {
    const res = makeResponse();
    await recordOutgoingCall(
      {
        userId: IDS.customer,
        body: { supplierId: IDS.supplier, toPhone: "9811111111" },
      },
      res,
    );
    assert.equal(res.statusCode, 423);
    assert.equal(res.body.code, "PHONE_ORDER_WAIT_ACTIVE");
    assert.equal(res.body.wait.active, true);
  } finally {
    User.findById = originalUserFindById;
    User.findOneAndUpdate = originalUserFindOneAndUpdate;
    PhoneCall.create = originalCallCreate;
  }
});

test("expired wait state returns inactive and is cleared", async () => {
  const originalUserFindById = User.findById;
  const originalUserUpdateOne = User.updateOne;
  const expired = new Date("2026-09-27T09:00:00Z");
  let cleared = false;
  User.findById = () =>
    query({
      phoneOrderWaitUntil: expired,
      phoneOrderWaitSupplierId: null,
      phoneOrderWaitCallId: IDS.call,
    });
  User.updateOne = async (_filter, update) => {
    cleared = update.$set.phoneOrderWaitUntil === null;
    return { acknowledged: true };
  };

  try {
    const wait = await getShopkeeperWaitState({
      userId: IDS.customer,
      now: new Date("2026-09-27T10:00:00Z"),
    });
    assert.equal(wait.active, false);
    assert.equal(wait.secondsRemaining, 0);
    assert.equal(cleared, true);
  } finally {
    User.findById = originalUserFindById;
    User.updateOne = originalUserUpdateOne;
  }
});
