import axios from "axios";
import { API_BASE_URL } from "@/lib/constants";

const base = () => `${API_BASE_URL}/api/v1/phone-call`;
const pilotBase = () => `${API_BASE_URL}/api/v1/pilot/phone-call`;
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem("token")}`,
});
const unwrap = (response) => response.data;

export const fetchCallSuppliers = async () =>
  unwrap(await axios.get(`${base()}/suppliers`, { headers: headers() }));

export const fetchCallingCapability = async () =>
  unwrap(await axios.get(`${base()}/capability`, { headers: headers() }));

export const fetchMyCalls = async () =>
  unwrap(await axios.get(`${base()}/my-calls`, { headers: headers() }));

export const recordOutgoingCall = async ({ supplierId, toPhone, callAt }) =>
  unwrap(
    await axios.post(
      `${base()}/calls`,
      { supplierId, toPhone, callAt, status: "initiated" },
      { headers: headers() },
    ),
  );

export const fetchSupplierPhoneSection = async (date) => {
  const params = date ? { date } : {};
  return unwrap(
    await axios.get(`${base()}/supplier/section`, {
      headers: headers(),
      params,
    }),
  );
};

export const fetchSupplierCall = async (callId) =>
  unwrap(
    await axios.get(`${base()}/supplier/calls/${callId}`, {
      headers: headers(),
    }),
  );

export const fetchCustomerCandidates = async () =>
  unwrap(
    await axios.get(`${base()}/supplier/candidates`, { headers: headers() }),
  );

export const startSupplierCall = async (customerUserId) =>
  unwrap(
    await axios.post(
      `${base()}/supplier/calls`,
      { customerUserId },
      { headers: headers() },
    ),
  );

export const sendSupplierWaitNotice = async (callId) =>
  unwrap(
    await axios.post(`${base()}/supplier/calls/${callId}/wait`, null, {
      headers: headers(),
    }),
  );

export const identifyCallCustomer = async (callId, customerUserId) =>
  unwrap(
    await axios.post(
      `${base()}/supplier/calls/${callId}/customer`,
      { customerUserId },
      { headers: headers() },
    ),
  );

export const uploadCallAudio = async (callId, file) => {
  const form = new FormData();
  form.append("audio", file);
  return unwrap(
    await axios.post(`${base()}/supplier/calls/${callId}/audio`, form, {
      headers: headers(),
    }),
  );
};

export const createOrderFromPhoneCall = async (pilotCallId, customerUserId) =>
  unwrap(
    await axios.post(
      `${base()}/drafts/${pilotCallId}/order`,
      customerUserId ? { customerUserId } : {},
      { headers: headers() },
    ),
  );

export const fetchPilotReviewCall = async (pilotCallId) =>
  unwrap(
    await axios.get(`${pilotBase()}/${pilotCallId}`, { headers: headers() }),
  );
