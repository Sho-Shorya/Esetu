import PhoneCall from "../models/phoneCallModel.js";
import PhoneCallPilot from "../models/phoneCallPilotModel.js";
import { User } from "../models/userModel.js";
import { createOrderFromConfirmedPhoneCall } from "../services/phoneOrderBridgeService.js";
import {
  identifyCallCustomer,
  setProcessingStatus,
  toPublicCall,
} from "../services/phoneCallService.js";

/**
 * HTTP layer for the two phone-order steps that are not the pipeline itself:
 * fixing who the customer is, and turning a confirmed draft into a real Order.
 *
 * Recording upload lives in phoneOrderController (POST /api/v1/phone-orders/
 * recording) and the STT -> draft -> review pipeline lives in
 * phoneCallPilotController. This file holds neither.
 */

const ok = (res, body) => res.status(200).json({ success: true, ...body });
const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, code, message });

/**
 * Attaches a customer to a call the supplier recorded.
 *
 * This is the "wrong shopkeeper" fix: the supplier picks the customer by hand
 * and the system records that they did, so nobody had to guess.
 */
export const identifyCustomer = async (req, res) => {
  try {
    const call = await PhoneCall.findOne({
      _id: req.params.id,
      supplierId: req.user._id,
    }).select("_id");

    if (!call) return fail(res, 404, "NOT_FOUND", "कॉल नहीं मिली।");

    const result = await identifyCallCustomer({
      callId: call._id,
      customerUserId: req.body?.customerUserId,
      byUserId: req.userId,
    });

    if (!result.ok) {
      return fail(res, result.status || 400, result.code, result.message);
    }

    return ok(res, {
      call: toPublicCall(result.call),
      customer: result.customer,
    });
  } catch (error) {
    return fail(res, 500, "IDENTIFY_FAILED", error.message);
  }
};

/** Customers the supplier may pick, for the upload form and the review fix. */
export const listIdentifyCandidates = async (req, res) => {
  try {
    const query = String(req.query.query || req.query.q || "")
      .trim()
      .slice(0, 60);

    const filter = { role: "user" };
    if (query) {
      const asNumber = Number(String(query).replace(/\D/g, ""));
      const or = [
        { firstName: { $regex: query, $options: "i" } },
        { lastName: { $regex: query, $options: "i" } },
        { place: { $regex: query, $options: "i" } },
      ];
      // A digits-only search also matches on the phone number, which is how a
      // supplier often knows a shopkeeper.
      if (Number.isInteger(asNumber) && String(asNumber).length >= 3) {
        or.push({ phoneNumber: asNumber });
      }
      filter.$or = or;
    }

    const users = await User.find(filter)
      .select("_id firstName lastName phoneNumber place")
      .sort({ firstName: 1 })
      .limit(50)
      .lean();

    return ok(res, { customers: users });
  } catch (error) {
    return fail(res, 500, "CUSTOMERS_FAILED", error.message);
  }
};

/**
 * Turns a confirmed phone-call draft into a real e-Setu Order.
 *
 * All of the decision-making lives in phoneOrderBridgeService; this only maps the
 * result onto HTTP.
 */
export const createOrderFromCall = async (req, res) => {
  try {
    const pilotCallId = req.params.id;

    const pilot = await PhoneCallPilot.findById(pilotCallId).select(
      "_id phoneCallId supplierId",
    );

    if (!pilot) return fail(res, 404, "NOT_FOUND", "कॉल नहीं मिली।");

    // A supplier may only order from a call addressed to them.
    let ownsCall = String(pilot.supplierId || "") === String(req.userId || "");
    if (!ownsCall && pilot.phoneCallId) {
      ownsCall = Boolean(
        await PhoneCall.findOne({
          _id: pilot.phoneCallId,
          supplierId: req.userId,
        }).select("_id"),
      );
    }
    if (!ownsCall) return fail(res, 403, "FORBIDDEN", "यह कॉल आपकी नहीं है।");

    const result = await createOrderFromConfirmedPhoneCall({
      pilotCallId,
      userId: req.userId,
      customerUserId: req.body?.customerUserId || null,
    });

    if (!result.ok) {
      // A failure on a call that has a linked PhoneCall is recorded there too,
      // so the supplier's list shows why instead of silently showing nothing.
      // "confirmed" rather than "failed": the draft is confirmed and the order
      // step is what was refused, and only "confirmed" keeps the call in the
      // "ऑर्डर के लिए" list where the supplier can actually retry it.
      if (pilot.phoneCallId) {
        await setProcessingStatus({
          callId: pilot.phoneCallId,
          processingStatus: "confirmed",
          error: { message: result.message, code: result.code },
        });
      }

      return res.status(result.status || 400).json({
        success: false,
        code: result.code,
        message: result.message,
        blockers: result.blockers || [],
      });
    }

    if (pilot.phoneCallId) {
      await setProcessingStatus({
        callId: pilot.phoneCallId,
        orderId: result.orderId,
      });
    }

    return res.status(result.status || 201).json({
      success: true,
      order: result.order,
      orderId: result.orderId,
      alreadyCreated: result.alreadyCreated === true,
      merged: result.merged === true,
      message: result.message,
    });
  } catch (error) {
    return fail(res, 500, "ORDER_FAILED", error.message);
  }
};
