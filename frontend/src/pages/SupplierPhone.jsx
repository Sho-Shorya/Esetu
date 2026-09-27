import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar,
  Clock3,
  Phone,
  RefreshCw,
  UserRound,
  Volume2,
  Hourglass,
  Smartphone,
  Search,
  Mic2,
  X,
  UserPlus,
  MapPin,
  Delete,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneOff,
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

const POLL_MS = 15000; // 15s: matches the pilot list's polling rhythm

const TABS = [
  { id: "dialer", label: "कॉल", icon: Smartphone },
  { id: "recent", label: "कॉल हिस्ट्री" },
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
    processing: "प्रोसेस हो रहा है...",
    draft_ready: "ऑर्डर की जाँच करें",
    needs_review: "ऑर्डर की जाँच करें",
    confirmed: "ऑर्डर पक्का करें",
    order_created: "ऑर्डर बन गया ✓",
    failed: "प्रोसेस नहीं हो पाया",
  })[status] || "प्रोसेस हो रहा है...";

const SupplierPhone = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("dialer");
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [data, setData] = useState({
    incoming: [],
    recent: [],
    needsReview: [],
  });
  const [draftPreviews, setDraftPreviews] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState({});
  const [showShopkeeperPicker, setShowShopkeeperPicker] = useState(false);
  const [selectedShopkeeperId, setSelectedShopkeeperId] = useState("");
  const [startingCall, setStartingCall] = useState(false);
  const [sendingWaitCallId, setSendingWaitCallId] = useState(null);
  // Dialer state
  const [dialedNumber, setDialedNumber] = useState("");
  const [shopkeepers, setShopkeepers] = useState([]);
  const [filteredShopkeepers, setFilteredShopkeepers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(true);
  const [voiceListening, setVoiceListening] = useState(false);
  const [isDialerVisible, setIsDialerVisible] = useState(false);

  const load = useCallback(
    async ({ quiet = false } = {}) => {
      try {
        const section = await fetchSupplierPhoneSection(selectedDate);
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
        // A background refresh must never interrupt with a toast: the supplier
        // did nothing wrong, and a polling failure is not their problem to fix.
        if (!quiet) setLoadError("");
      } catch (error) {
        const message =
          error.response?.data?.message ||
          "कॉल नहीं खुल सकीं। दोबारा कोशिश करें।";
        if (quiet) setLoadError(message);
        else {
          setLoadError(message);
          toast.error(message);
        }
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [selectedDate],
  );

  // Load shopkeepers for dialer
  const loadShopkeepers = useCallback(async () => {
    try {
      const result = await fetchCustomerCandidates();
      const shopkeepersList = result.customers || [];
      setShopkeepers(shopkeepersList);
      setFilteredShopkeepers(shopkeepersList);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "दुकानदारों की सूची नहीं खुली।",
      );
    }
  }, []);

  // Load shopkeepers when dialer tab is active
  useEffect(() => {
    if (activeTab === "dialer") {
      loadShopkeepers();
    }
  }, [activeTab, loadShopkeepers]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  /*
   * Processing runs on the server, so the state a supplier needs to act on
   * changes without them doing anything. Polling quietly keeps "प्रोसेस हो रहा
   * है..." moving to "ऑर्डर की जाँच करें" on its own, instead of stranding them on
   * a stale label until they hit refresh. Paused while the tab is hidden so a
   * backgrounded phone does not keep calling the API.
   */
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load({ quiet: true });
    }, POLL_MS);

    return () => clearInterval(timer);
  }, [load]);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setExpandedId(null);
  };

  // Dialer functions
  const handleDial = (digit) => {
    setDialedNumber((prev) => prev + digit);
  };

  const handleBackspace = () => {
    setDialedNumber((prev) => prev.slice(0, -1));
  };

  const handleCallFromDialer = () => {
    if (!dialedNumber) return;
    // Find matching shopkeeper
    const shopkeeper = shopkeepers.find(
      (s) =>
        s.phoneNumber &&
        typeof s.phoneNumber === "string" &&
        s.phoneNumber.replace(/\D/g, "") === dialedNumber.replace(/\D/g, ""),
    );
    if (shopkeeper) {
      setSelectedShopkeeperId(shopkeeper._id);
      callShopkeeper();
    } else {
      // Direct dial
      const number = dialedNumber.replace(/\D/g, "");
      if (number.length === 10) {
        window.location.href = `tel:+91${number}`;
      } else if (number.length > 0) {
        window.location.href = `tel:+${number}`;
      }
    }
    setDialedNumber("");
  };

  const handleShopkeeperCall = (shopkeeper) => {
    setSelectedShopkeeperId(shopkeeper._id);
    callShopkeeper();
    setDialedNumber("");
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    const filtered = shopkeepers.filter((s) => {
      const name = [s.firstName, s.lastName]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const phone = String(s.phoneNumber || "");
      const city = s.city || s.address?.city || "";
      return (
        name.includes(query.toLowerCase()) ||
        phone.includes(query) ||
        city.toLowerCase().includes(query.toLowerCase())
      );
    });
    setFilteredShopkeepers(filtered);
    setShowSearch(true);
  };

  const handleVoiceSearch = () => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      toast.error("वॉइस सर्च इस ब्राउज़र में समर्थित नहीं है।");
      return;
    }
    setVoiceListening(true);
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "hi-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      handleSearch(transcript);
      setVoiceListening(false);
    };

    recognition.onerror = () => {
      toast.error("आवाज़ पहचानी नहीं जा सकी।");
      setVoiceListening(false);
    };

    recognition.onend = () => {
      setVoiceListening(false);
    };

    recognition.start();
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

  const loadShopkeepersForPicker = async () => {
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

  const calls = activeTab === "recent" ? data.recent : data.needsReview;

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
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="h-10 px-3 rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-700"
              aria-label="तारीख चुनें"
            />
            <button
              type="button"
              onClick={load}
              aria-label="कॉल फिर से लाएँ"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white"
            >
              <RefreshCw className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* <section className="border-b border-slate-200 py-4">
          <button
            type="button"
            onClick={loadShopkeepersForPicker}
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
        </section> */}

        <nav
          aria-label="फोन के भाग"
          className="grid grid-cols-3 border-b border-slate-300"
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => selectTab(tab.id)}
              className={`min-h-14 border-b-[3px] px-1 text-sm font-extrabold flex items-center justify-center gap-1 ${activeTab === tab.id ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600"}`}
            >
              {tab.icon && <tab.icon className="h-5 w-5" />}
              {tab.label}
              {tab.id === "review" && data.needsReview?.length > 0
                ? ` (${data.needsReview.length})`
                : ""}
            </button>
          ))}
        </nav>

        {activeTab === "dialer" && (
          <section className="border-b border-slate-200 bg-white p-4">
            {/* Search and Voice Search */}

            {/* Dialer */}
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <input
                  type="tel"
                  value={dialedNumber}
                  readOnly
                  className="flex-1 h-14 w-[300px] rounded-xl text-center text-3xl font-bold text-slate-900 "
                  placeholder="नंबर डायल करें"
                />
                {dialedNumber && (
                  <button
                    type="button"
                    onClick={handleBackspace}
                    disabled={!dialedNumber}
                    className="flex absolute right-10 h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 disabled:opacity-50"
                    aria-label="हटाएं"
                  >
                    <Delete className="h-6 w-6" />
                  </button>
                )}
              </div>

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { digit: "1", letters: "" },
                  { digit: "2", letters: "ABC" },
                  { digit: "3", letters: "DEF" },
                  { digit: "4", letters: "GHI" },
                  { digit: "5", letters: "JKL" },
                  { digit: "6", letters: "MNO" },
                  { digit: "7", letters: "PQRS" },
                  { digit: "8", letters: "TUV" },
                  { digit: "9", letters: "WXYZ" },
                  { digit: "*", letters: "" },
                  { digit: "0", letters: "+" },
                  { digit: "#", letters: "" },
                ].map((key) => (
                  <button
                    key={key.digit}
                    type="button"
                    onClick={() => handleDial(key.digit)}
                    className="flex flex-col items-center justify-center h-16 rounded-full bg-white border border-slate-200 text-2xl font-bold text-slate-900 transition active:scale-95 active:bg-slate-50"
                  >
                    {key.digit}
                    {key.letters && (
                      <span className="text-xs text-slate-400">
                        {key.letters}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Call Button */}
              <button
                type="button"
                onClick={handleCallFromDialer}
                disabled={!dialedNumber}
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-full bg-emerald-600 text-white text-lg font-black transition hover:bg-emerald-700 disabled:opacity-50 disabled:bg-slate-400"
              >
                <Phone className="h-6 w-6" />
                कॉल करें
              </button>
            </div>

            {/* Shopkeeper List */}
            <div className="mt-6 min-h-screen border-t border-slate-200 pt-4">
              <h3 className="text-lg font-black text-slate-900 mb-3">
                दुकानदार सूची
              </h3>

              {showSearch && (
                <div className="mb-4">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                    placeholder="नाम, नंबर या शहर से खोजें..."
                    className="w-full h-10 px-3 rounded-full border border-slate-300 bg-white text-sm font-bold text-slate-700 placeholder-slate-400"
                    autoFocus
                  />
                </div>
              )}
              {filteredShopkeepers.length === 0 ? (
                <p className="text-center text-slate-500 py-8">
                  कोई दुकानदार नहीं मिला
                </p>
              ) : (
                <ul className="divide-y divide-slate-200">
                  {filteredShopkeepers.map((shopkeeper) => (
                    <li key={shopkeeper._id}>
                      <button
                        type="button"
                        onClick={() => handleShopkeeperCall(shopkeeper)}
                        className="w-full px-3 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition"
                      >
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-black text-lg">
                          {(
                            [shopkeeper.firstName, shopkeeper.lastName]
                              .filter(Boolean)
                              .join(" ")[0] || "द"
                          ).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">
                            {[shopkeeper.firstName, shopkeeper.lastName]
                              .filter(Boolean)
                              .join(" ") || "बिना नाम"}
                          </p>
                          <p className="text-sm text-slate-600 truncate">
                            {shopkeeper.phoneNumber || "नंबर नहीं"}
                          </p>
                          {(shopkeeper.city || shopkeeper.address?.city) && (
                            <p className="text-xs text-slate-400 flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {shopkeeper.city || shopkeeper.address?.city}
                            </p>
                          )}
                        </div>
                        <Phone className="h-5 w-5 text-slate-400" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        )}

        {activeTab === "review" && (
          <p className="border-b border-slate-200 bg-amber-50 px-3 py-3 text-sm font-bold text-amber-900">
            इन कॉलों के ऑर्डर की जाँच पूरी करें।
          </p>
        )}

        {loadError && (
          <div
            role="status"
            className="flex items-center gap-2 border-b border-amber-200 bg-amber-100 px-3 py-2 text-sm font-bold text-amber-900"
          >
            <RefreshCw className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{loadError}</span>
            <button
              type="button"
              onClick={() => void load()}
              className="shrink-0 rounded-md bg-amber-800 px-2.5 py-1 text-xs font-black text-white"
            >
              फिर कोशिश करें
            </button>
          </div>
        )}

        {activeTab !== "dialer" && (
          <>
            {loading ? (
              <p className="py-10 text-center text-slate-500">खुल रहा है...</p>
            ) : calls.length === 0 ? (
              <p className="py-12 text-center text-slate-600">
                {activeTab === "review"
                  ? "अभी कोई ऑर्डर जाँचने के लिए नहीं है।"
                  : "इस दिन कोई कॉल नहीं है।"}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 bg-white">
                {calls.map((call) => {
                  const open = expandedId === call.id;
                  const needsReview = activeTab === "review";
                  const isRecent = activeTab === "recent";
                  const customerName = call.from?.matched
                    ? call.from.displayName
                    : "Unknown कॉलर";
                  const customerParty =
                    call.initiatedByRole === "supplier" ? call.to : call.from;
                  const knownCustomerId = customerParty?.matched
                    ? customerParty.userId
                    : null;
                  const knownCustomerName = customerParty?.matched
                    ? customerParty.displayName
                    : "Unknown कॉलर";
                  const preview = draftPreviews[call.id];
                  const isIncoming = call.direction === "incoming";
                  const isOutgoing = call.initiatedByRole === "supplier";
                  return (
                    <li key={call.id}>
                      <div
                        className={`px-3 py-2.5 sm:px-3 ${needsReview ? "border-l-3 border-amber-500 bg-amber-50/30" : "hover:bg-slate-50/50 transition-colors"}`}
                      >
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : call.id)}
                          className="flex min-h-10 w-full items-center justify-between gap-2 text-left"
                        >
                          <span className="min-w-0 flex items-center gap-2">
                            {/* Call direction icon */}
                            <span className="flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold">
                              {isIncoming ? (
                                <PhoneIncoming className="h-5 w-5 text-red-600" />
                              ) : isOutgoing ? (
                                <PhoneOutgoing className="h-5 w-5 text-green-600" />
                              ) : (
                                <PhoneOff className="h-5 w-5 text-gray-400" />
                              )}
                            </span>
                            <span className="flex flex-col min-w-0">
                              <span className="block truncate flex gap-2 items-center text-sm font-semibold text-slate-900">
                                {call.initiatedByRole === "supplier"
                                  ? knownCustomerName
                                  : customerName}
                              </span>
                              <span className="block truncate text-xs text-slate-500 flex items-center gap-1">
                                {customerParty?.phoneNumber ||
                                  "फोन नंबर उपलब्ध नहीं"}
                                <span className="text-slate-300">·</span>
                                {dateTime(call.callAt.split(' '))}
                              </span>
                            </span>
                          </span>
                          <span className="shrink-0 text-right flex flex-col items-end gap-0.5">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                needsReview
                                  ? "bg-amber-100 text-amber-800"
                                  : call.status === "completed" ||
                                      call.status === "answered"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : call.status === "failed" ||
                                        call.status === "no_answer" ||
                                        call.status === "missed"
                                      ? "bg-red-100 text-red-800"
                                      : call.status === "ringing"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {needsReview
                                ? processText(call.processingStatus)
                                : statusText(call.status)}
                            </span>
                            {call.durationSeconds != null && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {Math.floor(call.durationSeconds / 60)}:
                                {String(call.durationSeconds % 60).padStart(
                                  2,
                                  "0",
                                )}
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
                                  {item.productName ||
                                    item.spokenName ||
                                    "उत्पाद"}
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
                            ऑर्डर की जाँच करें
                          </button>
                        )}
                        {knownCustomerId && !needsReview && isIncoming && (
                          <button
                            type="button"
                            disabled={sendingWaitCallId === call.id}
                            onClick={() => sendWait(call.id)}
                            className="mt-2 flex h-[40px] w-[150px] items-center justify-center gap-2 rounded-2xl border border-amber-500 bg-amber-50 px-3 text-sm font-extrabold text-amber-950 disabled:opacity-50"
                          >
                            <Hourglass className="h-4 w-4" />
                            {sendingWaitCallId === call.id ? (
                              <loading className="animate-spin h-5 w-5" />
                            ) : (
                              "10 मिनट रुके!"
                            )}
                          </button>
                        )}
                        {open && (
                          <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                            <p className="text-xs font-medium text-slate-600">
                              {statusText(call.status)} ·{" "}
                              {processText(call.processingStatus)}
                            </p>
                            {!call.from?.matched && (
                              <div className="space-y-1.5">
                                <p className="text-xs text-slate-500">
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
                                  className="min-h-10 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-700"
                                >
                                  ग्राहक चुनें
                                </button>
                                {candidates.length > 0 && (
                                  <div className="flex gap-1.5">
                                    <select
                                      aria-label="ग्राहक चुनें"
                                      value={selectedCustomer[call.id] || ""}
                                      onChange={(event) =>
                                        setSelectedCustomer((previous) => ({
                                          ...previous,
                                          [call.id]: event.target.value,
                                        }))
                                      }
                                      className="min-h-10 min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 text-xs"
                                    >
                                      <option value="">ग्राहक चुनें</option>
                                      {candidates.map((candidate) => (
                                        <option
                                          key={candidate._id}
                                          value={candidate._id}
                                        >
                                          {[
                                            candidate.firstName,
                                            candidate.lastName,
                                          ]
                                            .filter(Boolean)
                                            .join(" ")}{" "}
                                          · {candidate.phoneNumber}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => identify(call.id)}
                                      className="min-h-10 rounded-md bg-slate-900 px-2.5 text-xs font-medium text-white"
                                    >
                                      जोड़ें
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                            <label className="flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-slate-300 px-2.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                              <Volume2 className="h-3.5 w-3.5" />
                              रिकॉर्डिंग जोड़ें
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
              मोबाइल नेटवर्क की कॉल अपने-आप रिकॉर्ड नहीं होती। रिकॉर्डिंग तभी
              जोड़ें जब सभी की अनुमति हो और आपके फोन/कानून इसकी इजाज़त दें।
            </p>
          </>
        )}
      </div>
    </main>
  );
};

export default SupplierPhone;
