import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock3,
  Phone,
  RefreshCw,
  UserRound,
  Volume2,
  Hourglass,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchCustomerCandidates,
  fetchPilotReviewCall,
  fetchSupplierPhoneSection,
  identifyCallCustomer,
  sendSupplierWaitNotice,
  startSupplierCall,
  uploadCallAudio,
} from "@/services/phoneCallingApi";

const TABS = [
  { id: "incoming", label: "आने वाली कॉल" },
  { id: "recent", label: "हाल की कॉल" },
  { id: "review", label: "ऑर्डर के लिए" },
];

const dateTime = (value) =>
  value
    ? new Date(value).toLocaleString("hi-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "समय उपलब्ध नहीं";
const statusText = (status) =>
  ({
    initiated: "कॉल शुरू हुई",
    ringing: "घंटी जा रही है",
    answered: "कॉल पर बात हुई",
    completed: "कॉल पूरी हुई",
    failed: "कॉल नहीं हो पाई",
    no_answer: "जवाब नहीं मिला",
    cancelled: "कॉल बंद हुई",
    missed: "कॉल नहीं उठी",
  })[status] || "स्थिति उपलब्ध नहीं";
const processText = (status) =>
  ({
    no_audio: "ऑडियो नहीं जुड़ा",
    waiting_audio: "ऑडियो बाकी है",
    processing: "ऑर्डर बन रहा है",
    draft_ready: "ऑर्डर जाँचें",
    needs_review: "ऑर्डर जाँचें",
    confirmed: "ऑर्डर जाँचें",
    order_created: "ऑर्डर पूरा हुआ",
    failed: "जाँच बाकी है",
  })[status] || "जाँच बाकी है";

const SupplierPhone = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("incoming");
  const [data, setData] = useState({
    incoming: [],
    recent: [],
    needsReview: [],
  });
  const [draftPreviews, setDraftPreviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState({});
  const [showShopkeeperPicker, setShowShopkeeperPicker] = useState(false);
  const [selectedShopkeeperId, setSelectedShopkeeperId] = useState("");
  const [startingCall, setStartingCall] = useState(false);
  const [sendingWaitCallId, setSendingWaitCallId] = useState(null);

  const load = useCallback(async () => {
    try {
      const section = await fetchSupplierPhoneSection();
      setData(section);
      const previews = await Promise.all(
        (section.needsReview || []).map(async (call) => {
          if (!call.pilotCallId) return [call.id, null];
          try {
            const result = await fetchPilotReviewCall(call.pilotCallId);
            return [call.id, result.call.extraction?.draft || null];
          } catch {
            return [call.id, null];
          }
        }),
      );
      setDraftPreviews(Object.fromEntries(previews));
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "कॉल नहीं खुल सकीं। दोबारा कोशिश करें।",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setExpandedId(null);
  };

  const identify = async (callId) => {
    const customerUserId = selectedCustomer[callId];
    if (!customerUserId) return toast.error("पहले ग्राहक चुनें।");
    try {
      await identifyCallCustomer(callId, customerUserId);
      toast.success("ग्राहक जोड़ दिया गया।");
      setExpandedId(null);
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "ग्राहक नहीं जुड़ सका।");
    }
  };

  const attachAudio = async (callId, file) => {
    if (!file) return;
    try {
      await uploadCallAudio(callId, file);
      toast.success("ऑडियो जाँच के लिए भेज दिया गया।");
      await load();
    } catch (error) {
      toast.error(error.response?.data?.message || "ऑडियो नहीं भेजा जा सका।");
    }
  };

  const loadShopkeepers = async () => {
    try {
      const result = await fetchCustomerCandidates();
      setCandidates(result.customers || []);
      setShowShopkeeperPicker(true);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "दुकानदारों की सूची नहीं खुली।",
      );
    }
  };

  const callShopkeeper = async () => {
    if (!selectedShopkeeperId) return toast.error("दुकानदार चुनें।");
    try {
      setStartingCall(true);
      const result = await startSupplierCall(selectedShopkeeperId);
      const number = String(result.phoneNumber || "").replace(/\D/g, "");
      if (!number) return toast.error("दुकानदार का फोन नंबर नहीं मिला।");
      window.location.href = `tel:${number.length === 10 ? `+91${number}` : `+${number}`}`;
    } catch (error) {
      toast.error(error.response?.data?.message || "कॉल शुरू नहीं हो सकी।");
    } finally {
      setStartingCall(false);
    }
  };

  const sendWait = async (callId) => {
    try {
      setSendingWaitCallId(callId);
      await sendSupplierWaitNotice(callId);
      toast.success("दुकानदार को 10 मिनट रुकने का संदेश भेजा गया।");
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "इंतज़ार का संदेश नहीं भेजा गया।",
      );
    } finally {
      setSendingWaitCallId(null);
    }
  };

  const calls =
    activeTab === "incoming"
      ? data.incoming
      : activeTab === "recent"
        ? data.recent
        : data.needsReview;

  return (
    <main className="min-h-screen bg-[#f6f8f5] px-4 pb-32 pt-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-bold text-emerald-700">e-Setu</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">
              <Phone className="h-6 w-6" />
              फोन
            </h1>
          </div>
          <button
            type="button"
            onClick={load}
            aria-label="कॉल फिर से लाएँ"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </header>

        <section className="border-b border-slate-200 py-4">
          <button
            type="button"
            onClick={loadShopkeepers}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-emerald-800 bg-white px-4 text-sm font-black text-emerald-900"
          >
            <Phone className="h-5 w-5" />
            दुकानदार को कॉल करें
          </button>
          {showShopkeeperPicker && (
            <div className="mt-3 flex gap-2">
              <select
                aria-label="दुकानदार चुनें"
                value={selectedShopkeeperId}
                onChange={(event) =>
                  setSelectedShopkeeperId(event.target.value)
                }
                className="min-h-12 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">दुकानदार चुनें</option>
                {candidates.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {[customer.firstName, customer.lastName]
                      .filter(Boolean)
                      .join(" ")}{" "}
                    · {customer.phoneNumber}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={callShopkeeper}
                disabled={!selectedShopkeeperId || startingCall}
                className="min-h-12 rounded-md bg-emerald-800 px-4 text-sm font-black text-white disabled:bg-slate-400"
              >
                {startingCall ? "कॉल खुल रही है..." : "कॉल करें"}
              </button>
            </div>
          )}
        </section>

        <nav
          aria-label="फोन के भाग"
          className="grid grid-cols-3 border-b border-slate-300"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`min-h-14 border-b-[3px] px-1 text-sm font-extrabold ${activeTab === tab.id ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600"}`}
            >
              {tab.label}
              {tab.id === "review" && data.needsReview?.length > 0
                ? ` (${data.needsReview.length})`
                : ""}
            </button>
          ))}
        </nav>

        {activeTab === "incoming" && (
          <p className="border-b border-slate-200 bg-white px-3 py-3 text-sm leading-5 text-slate-600">
            मोबाइल पर आने वाली सामान्य कॉल e-Setu में अपने-आप नहीं दिखती। यहाँ
            वही कॉल दिखेंगी जिनकी जानकारी सिस्टम तक पहुँची है।
          </p>
        )}
        {activeTab === "review" && (
          <p className="border-b border-slate-200 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-900">
            इन कॉलों के ऑर्डर की जाँच पूरी करें।
          </p>
        )}

        {loading ? (
          <p className="py-10 text-center text-slate-500">खुल रहा है...</p>
        ) : calls.length === 0 ? (
          <p className="py-12 text-center text-slate-600">
            {activeTab === "review"
              ? "अभी कोई ऑर्डर जाँचने के लिए नहीं है।"
              : activeTab === "incoming"
                ? "यहाँ कोई दर्ज आने वाली कॉल नहीं है।"
                : "अभी कोई हाल की कॉल नहीं है।"}
          </p>
        ) : (
          <ul className="divide-y divide-slate-200 border-b border-slate-200 bg-white">
            {calls.map((call) => {
              const open = expandedId === call.id;
              const needsReview = activeTab === "review";
              const customerName = call.from?.matched
                ? call.from.displayName
                : "अज्ञात कॉलर";
              const customerParty =
                call.initiatedByRole === "supplier" ? call.to : call.from;
              const knownCustomerId = customerParty?.matched
                ? customerParty.userId
                : null;
              const knownCustomerName = customerParty?.matched
                ? customerParty.displayName
                : "अज्ञात कॉलर";
              const preview = draftPreviews[call.id];
              return (
                <li key={call.id}>
                  <div
                    className={`px-3 py-4 sm:px-4 ${needsReview ? "border-l-4 border-amber-500 bg-amber-50/50" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : call.id)}
                      className="flex min-h-12 w-full items-start justify-between gap-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-base font-extrabold text-slate-900">
                          {call.initiatedByRole === "supplier"
                            ? knownCustomerName
                            : customerName}
                        </span>
                        <span className="mt-1 block text-sm text-slate-600">
                          {customerParty?.phoneNumber || "फोन नंबर उपलब्ध नहीं"}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {call.initiatedByRole === "supplier"
                            ? "दुकानदार को कॉल"
                            : call.direction === "incoming"
                              ? "आने वाली कॉल"
                              : "बाहर की कॉल"}{" "}
                          · {dateTime(call.callAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-bold text-slate-700">
                          {needsReview
                            ? processText(call.processingStatus)
                            : statusText(call.status)}
                        </span>
                        {call.durationSeconds != null && (
                          <span className="mt-1 block text-xs text-slate-500">
                            {Math.floor(call.durationSeconds / 60)} मिनट{" "}
                            {call.durationSeconds % 60} सेकंड
                          </span>
                        )}
                      </span>
                    </button>
                    {needsReview && preview?.items?.length > 0 && (
                      <ul className="mt-2 space-y-1 pl-1 text-sm text-slate-700">
                        {preview.items.slice(0, 3).map((item, index) => (
                          <li
                            key={`${item.productId || item.productName}-${index}`}
                          >
                            <span className="font-bold">
                              {item.productName || item.spokenName || "उत्पाद"}
                            </span>
                            {item.quantity != null
                              ? ` · ${item.quantity} ${item.unit || item.variantMeasurement || ""}`
                              : " · मात्रा जाँचें"}
                          </li>
                        ))}
                      </ul>
                    )}
                    {needsReview && preview?.unresolved?.length > 0 && (
                      <p className="mt-2 text-sm font-bold text-amber-800">
                        {preview.unresolved.length} चीज़ की पहचान जाँचें
                      </p>
                    )}
                    {needsReview && (
                      <button
                        type="button"
                        onClick={() =>
                          call.pilotCallId &&
                          navigate(
                            `/pilot/phone-orders?callId=${call.pilotCallId}`,
                          )
                        }
                        disabled={!call.pilotCallId}
                        className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 text-base font-black text-white disabled:bg-slate-400"
                      >
                        <UserRound className="h-5 w-5" />
                        ऑर्डर जाँचें
                      </button>
                    )}
                    {knownCustomerId && (
                      <button
                        type="button"
                        disabled={sendingWaitCallId === call.id}
                        onClick={() => sendWait(call.id)}
                        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-amber-500 bg-amber-50 px-3 text-sm font-extrabold text-amber-950 disabled:opacity-50"
                      >
                        <Hourglass className="h-4 w-4" />
                        {sendingWaitCallId === call.id
                          ? "संदेश भेज रहे हैं..."
                          : "10 मिनट रुकने का संदेश भेजें"}
                      </button>
                    )}
                    {open && (
                      <div className="mt-3 space-y-3 border-t border-slate-200 pt-3">
                        <p className="text-sm font-bold text-slate-700">
                          {statusText(call.status)} ·{" "}
                          {processText(call.processingStatus)}
                        </p>
                        {!call.from?.matched && (
                          <div className="space-y-2">
                            <p className="text-sm text-slate-600">
                              ग्राहक की पहचान नहीं हुई है। सही ग्राहक चुनें।
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                fetchCustomerCandidates()
                                  .then((result) =>
                                    setCandidates(result.customers || []),
                                  )
                                  .catch(() =>
                                    toast.error("ग्राहक सूची नहीं खुली।"),
                                  )
                              }
                              className="min-h-11 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-800"
                            >
                              ग्राहक चुनें
                            </button>
                            {candidates.length > 0 && (
                              <div className="flex gap-2">
                                <select
                                  aria-label="ग्राहक चुनें"
                                  value={selectedCustomer[call.id] || ""}
                                  onChange={(event) =>
                                    setSelectedCustomer((previous) => ({
                                      ...previous,
                                      [call.id]: event.target.value,
                                    }))
                                  }
                                  className="min-h-11 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2"
                                >
                                  <option value="">ग्राहक चुनें</option>
                                  {candidates.map((candidate) => (
                                    <option
                                      key={candidate._id}
                                      value={candidate._id}
                                    >
                                      {[candidate.firstName, candidate.lastName]
                                        .filter(Boolean)
                                        .join(" ")}{" "}
                                      · {candidate.phoneNumber}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => identify(call.id)}
                                  className="min-h-11 rounded-md bg-slate-900 px-3 text-sm font-bold text-white"
                                >
                                  जोड़ें
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-bold text-slate-700">
                          <Volume2 className="h-4 w-4" />
                          रिकॉर्डिंग अपलोड करें
                          <input
                            type="file"
                            accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
                            className="sr-only"
                            onChange={(event) =>
                              attachAudio(call.id, event.target.files?.[0])
                            }
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
          <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
          मोबाइल नेटवर्क की कॉल अपने-आप रिकॉर्ड नहीं होती। रिकॉर्डिंग तभी जोड़ें
          जब सभी की अनुमति हो और आपके फोन/कानून इसकी इजाज़त दें।
        </p>
      </div>
    </main>
  );
};

export default SupplierPhone;
