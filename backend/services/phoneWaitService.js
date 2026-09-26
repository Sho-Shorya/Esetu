import { User } from "../models/userModel.js";
import PhoneCall from "../models/phoneCallModel.js";
import { toPublicCall } from "./phoneCallService.js";
import { sendToUsers } from "./oneSignalService.js";

export const PHONE_WAIT_MINUTES = 10;
export const PHONE_WAIT_MS = PHONE_WAIT_MINUTES * 60 * 1000;

const waitView = ({ until, supplier, callId, now = new Date() }) => ({
  active: Boolean(until && new Date(until).getTime() > now.getTime()),
  until: until || null,
  supplierName: supplier
    ? [supplier.firstName, supplier.lastName].filter(Boolean).join(" ").trim()
    : "",
  callId: callId ? String(callId) : null,
  secondsRemaining: until
    ? Math.max(0, Math.ceil((new Date(until).getTime() - now.getTime()) / 1000))
    : 0,
});

export const getShopkeeperWaitState = async ({
  userId,
  now = new Date(),
} = {}) => {
  const user = await User.findById(userId)
    .select("phoneOrderWaitUntil phoneOrderWaitSupplierId phoneOrderWaitCallId")
    .populate("phoneOrderWaitSupplierId", "firstName lastName")
    .lean();

  if (!user?.phoneOrderWaitUntil) {
    return waitView({ now });
  }

  const wait = waitView({
    until: user.phoneOrderWaitUntil,
    supplier: user.phoneOrderWaitSupplierId,
    callId: user.phoneOrderWaitCallId,
    now,
  });

  if (!wait.active) {
    await User.updateOne(
      { _id: userId, phoneOrderWaitUntil: { $lte: now } },
      {
        $set: {
          phoneOrderWaitUntil: null,
          phoneOrderWaitSupplierId: null,
          phoneOrderWaitCallId: null,
        },
      },
    );
  }

  return wait;
};

const getKnownCustomerId = (call) => {
  for (const party of [call.from, call.to]) {
    if (!party?.matched || !party.userId) continue;
    if (String(party.userId) !== String(call.supplierId)) return party.userId;
  }
  return null;
};

export const sendSupplierWaitNotice = async ({
  callId,
  supplierId,
  now = new Date(),
  notify = sendToUsers,
} = {}) => {
  const call = await PhoneCall.findOne({ _id: callId, supplierId });
  if (!call) {
    return {
      ok: false,
      status: 404,
      code: "CALL_NOT_FOUND",
      message: "कॉल नहीं मिली।",
    };
  }

  const customerUserId = getKnownCustomerId(call);
  if (!customerUserId) {
    return {
      ok: false,
      status: 409,
      code: "CUSTOMER_UNKNOWN",
      message: "पहले दुकानदार की पहचान करें।",
    };
  }

  const until = new Date(now.getTime() + PHONE_WAIT_MS);
  const customer = await User.findOneAndUpdate(
    {
      _id: customerUserId,
      role: "user",
      $or: [
        { phoneOrderWaitUntil: null },
        { phoneOrderWaitUntil: { $exists: false } },
        { phoneOrderWaitUntil: { $lte: now } },
      ],
    },
    {
      $set: {
        phoneOrderWaitUntil: until,
        phoneOrderWaitSupplierId: supplierId,
        phoneOrderWaitCallId: call._id,
      },
    },
    { new: true },
  ).select("_id phoneNumber");

  if (!customer) {
    const current = await getShopkeeperWaitState({
      userId: customerUserId,
      now,
    });
    return {
      ok: false,
      status: 409,
      code: "WAIT_ALREADY_ACTIVE",
      message: "दुकानदार पहले से इंतज़ार कर रहे हैं।",
      wait: current,
    };
  }

  const sentAt = now;
  await PhoneCall.updateOne(
    { _id: call._id, supplierId },
    { $set: { waitNoticeSentAt: sentAt, waitUntil: until } },
  );
  call.waitNoticeSentAt = sentAt;
  call.waitUntil = until;

  await notify({
    userIds: [customerUserId],
    title: "10 मिनट रुकें",
    message: "सप्लायर ने कहा है: कृपया ऑर्डर कॉल के लिए 10 मिनट रुकें।",
    url: `${process.env.FRONTEND_BASE_URL || "https://esetu.vercel.app"}/calling`,
  });

  return {
    ok: true,
    wait: waitView({ until, supplier: null, callId: call._id, now }),
    call: toPublicCall(call),
  };
};
