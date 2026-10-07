import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ClipboardList,
  Clock3,
  FileAudio,
  Loader2,
  MapPin,
  Mic,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  fetchCreatedOrders,
  fetchCustomerCandidates,
  fetchPhoneOrderConfig,
  fetchPilotCall,
  fetchPilotCalls,
  retryPilotProcessing,
  uploadPhoneOrderRecording,
} from "@/services/phoneOrderPilotApi";
import PilotOrderReview from "./pilot/PilotOrderReview";

/**
 * The supplier's phone-order screen, built for one person: someone who calls a
 * shopkeeper, records the conversation and wants an order out of it — with no
 * technical knowledge at all.
 *
 * Two tabs, nothing else:
 *   रिकॉर्डिंग अपलोड करें → pick shopkeeper, record or choose a file, upload,
 *                           watch the simple stage, review, order
 *   बने हुए ऑर्डर        → the real orders those recordings produced
 *
 * Every string here is plain Hindi; server errors arrive in Hindi too, and
 * anything without a response is translated to "internet is not working"
 * instead of ever showing a code to the person using the page.
 */

const PIPELINE_POLL_MS = 15000;
const RECORDING_TICK_MS = 1000;

/** Stages a fresh upload can pass through, in order. */
const ACTIVE_STAGES = ["new", "processing_recording", "transcribing", "extracting"];

/** The one place stage names become words a person understands. */
const STAGE_LABELS = {
  new: "कतार में",
  processing_recording: "रिकॉर्डिंग तैयार हो रही है",
  transcribing: "आवाज़ लिखी जा रही है",
  extracting: "सामान जुदा किए जा रहे हैं",
  completed: "जाँच के लिए तैयार",
  failed: "जाँच नहीं हो पाई",
};

const ORDER_STATUS_LABELS = {
  Pending: "लंबित",
  Approved: "मंज़ूर",
  Preparing: "तैयार हो रहा है",
  "Out For Delivery": "डिलीवरी के लिए निकला",
  Delivered: "पहुँच गया",
  Cancelled: "रद्द",
  Declined: "अस्वीकृत",
};

const stageLabel = (stage) => STAGE_LABELS[stage] || "प्रोसेस हो रहा है";

const isTerminal = (call) =>
  ["completed", "failed"].includes(call?.pipeline?.stage);

const needsAttention = (call) => {
  const stage = call?.pipeline?.stage;
  if (stage === "failed") return true;
  if (ACTIVE_STAGES.includes(stage)) return true;
  return (
    stage === "completed" &&
    call?.extraction?.draft?.isOrderIntent === true &&
    call?.review?.status !== "confirmed"
  );
};

const readyForReview = (call) =>
  call?.pipeline?.stage === "completed" &&
  call?.extraction?.status === "completed" &&
  call?.extraction?.draft?.isOrderIntent === true;

const friendlyError = (error, fallback) => {
  // No response at all means the network, not the app — say that and stop.
  if (!error?.response) {
    return "इंटरनेट चल नहीं रहा। नेटवर जाँचकर दोबारा कोशिश करें।";
  }
  return error.response?.data?.message || fallback;
};

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("hi-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const formatDay = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("hi-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatCompactDay = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("hi-IN", { day: "numeric", month: "long" });
};

const formatClock = (totalSeconds) => {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

const shopkeeperName = (person) =>
  [person?.firstName, person?.lastName].filter(Boolean).join(" ").trim() ||
  "बिना नाम";

/** Browser recordings differ per phone; pick the kind this backend accepts. */
const pickRecorderMime = () => {
  if (typeof MediaRecorder === "undefined") return null;
  for (const candidate of ["audio/webm", "audio/mp4"]) {
    try {
      if (MediaRecorder.isTypeSupported(candidate)) return candidate;
    } catch {
      // isTypeSupported can be missing on old browsers; fall through.
    }
  }
  return "";
};

const extensionForType = (type) => {
  const mime = String(type || "").split(";")[0];
  if (mime === "audio/mp4") return "m4a";
  if (mime === "audio/webm") return "webm";
  return "webm";
};

const SupplierPhone = () => {
  const [tab, setTab] = useState("upload");
  const [config, setConfig] = useState(null);
  const [shopkeepers, setShopkeepers] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);

  const [activeCall, setActiveCall] = useState(null);
  const [reviewCall, setReviewCall] = useState(null);
  const [pending, setPending] = useState([]);
  const [pendingError, setPendingError] = useState("");

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const streamRef = useRef(null);
  const tickRef = useRef(null);
  const urlRef = useRef(null);

  /* ------------------------------- data loads ------------------------------ */

  const loadSetup = useCallback(async () => {
    try {
      const [limits, candidates] = await Promise.all([
        fetchPhoneOrderConfig(),
        fetchCustomerCandidates(),
      ]);
      setConfig(limits);
      setShopkeepers(candidates.customers || []);
    } catch (error) {
      toast.error(
        friendlyError(error, "पेज नहीं खुल सका। दोबारा कोशिश करें।"),
      );
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const data = await fetchPilotCalls(20);
      setPending((data.calls || []).filter(needsAttention));
      setPendingError("");
    } catch (error) {
      setPendingError(friendlyError(error, "लिस्ट नहीं खुली।"));
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const data = await fetchCreatedOrders(50);
      setOrders(data.orders || []);
      setOrdersError("");
    } catch (error) {
      setOrdersError(friendlyError(error, "ऑर्डर नहीं खुले।"));
    } finally {
      setOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadSetup);
    void Promise.resolve().then(loadPending);
  }, [loadSetup, loadPending]);

  useEffect(() => {
    if (tab === "orders") void Promise.resolve().then(loadOrders);
  }, [tab, loadOrders]);

  /*
   * The work happens on the server, so the label under the upload moves on its
   * own: "आवाज़ लिखी जा रही है" → "सामान जुदा किए जा रहे हैं" → "जाँच के लिए
   * तैयार". Polling pauses while the tab is hidden so a backgrounded phone
   * does not keep calling the API, and stops once the run has landed.
   */
  const activeStage = activeCall?.pipeline?.stage;
  useEffect(() => {
    if (!activeCall || isTerminal(activeCall)) return undefined;

    let cancelled = false;
    const load = async () => {
      try {
        const data = await fetchPilotCall(activeCall._id);
        if (!cancelled && data.call) setActiveCall(data.call);
      } catch {
        // A missed poll is not the user's problem; the next tick retries.
      }
    };

    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void load();
    }, PIPELINE_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeCall, activeStage]);

  /* ------------------------------- recording ------------------------------- */

  const stopClock = () => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  useEffect(
    () => () => {
      stopClock();
      releaseStream();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const keepAudio = (blob) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const extension = extensionForType(blob.type);
    const file = new File([blob], `order-recording.${extension}`, {
      type: String(blob.type || "audio/webm").split(";")[0],
      lastModified: Date.now(),
    });
    setAudioUrl(url);
    setAudioFile(file);
  };

  const startRecording = async () => {
    if (recording || uploading) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("इस फ़ोन पर रिकॉर्डिंग नहीं हो सकती। फ़ाइल चुनकर अपलोड करें।");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = pickRecorderMime();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        releaseStream();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];
        if (blob.size) keepAudio(blob);
        else toast.error("रिकॉर्डिंग नहीं बनी। दोबारा कोशिश करें।");
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setElapsed(0);
      const limit = config?.maxDurationSeconds || 600;
      tickRef.current = setInterval(() => {
        setElapsed((previous) => {
          const next = previous + 1;
          // The server refuses anything longer than 10 minutes anyway, so the
          // recorder stops itself before it can produce a file that dies there.
          if (next >= limit) {
            stopRecording();
            return limit;
          }
          return next;
        });
      }, RECORDING_TICK_MS);
    } catch {
      toast.error(
        "माइक्रोफ़ोन की अनुमति नहीं मिली। फ़ाइल चुनकर अपलोड करें।",
      );
      releaseStream();
    }
  };

  const stopRecording = () => {
    stopClock();
    setRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  };

  const pickFile = (file) => {
    if (!file) return;
    const maxBytes = config?.maxAudioBytes || 0;
    if (maxBytes && file.size > maxBytes) {
      toast.error(
        `फ़ाइल बहुत बड़ी है। ${(maxBytes / (1024 * 1024)).toFixed(0)} एमबी से छोटी रिकॉर्डिंग चुनें।`,
      );
      return;
    }
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setAudioUrl(url);
    setAudioFile(file);
    setElapsed(0);
  };

  const clearAudio = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setAudioUrl(null);
    setAudioFile(null);
    setElapsed(0);
  };

  /* -------------------------------- upload --------------------------------- */

  const selectedShopkeeper = shopkeepers.find(
    (person) => person._id === selectedId,
  );

  const upload = async () => {
    if (!selectedId || !audioFile || uploading) return;
    if (!navigator.onLine) {
      toast.error("इंटरनेट चल नहीं रहा। नेटवर जोड़कर दोबारा कोशिश करें।");
      return;
    }

    setUploading(true);
    setUploadPercent(0);
    try {
      const form = new FormData();
      form.append("customerUserId", selectedId);
      form.append("audio", audioFile);
      const result = await uploadPhoneOrderRecording(form, (event) => {
        if (event.total) {
          setUploadPercent(Math.round((event.loaded * 100) / event.total));
        }
      });

      clearAudio();
      setSelectedId("");
      setActiveCall(null);
      setReviewCall(null);

      if (result.duplicate) {
        toast.info("यह रिकॉर्डिंग पहले से अपलोड हो चुकी है।");
      } else {
        toast.success("रिकॉर्डिंग अपलोड हो गई। अब ऑर्डर तैयार हो रहा है।");
      }

      if (result.pilotCallId) {
        try {
          const data = await fetchPilotCall(result.pilotCallId);
          if (data.call) setActiveCall(data.call);
        } catch {
          setActiveCall({ _id: result.pilotCallId, pipeline: { stage: "transcribing" } });
        }
      }
      await loadPending();
    } catch (error) {
      toast.error(friendlyError(error, "रिकॉर्डिंग अपलोड नहीं हो पाई। फिर कोशिश करें।"));
    } finally {
      setUploading(false);
      setUploadPercent(0);
    }
  };

  /* ------------------------------ open / review ---------------------------- */

  const openCall = useCallback(async (summary) => {
    try {
      const data = await fetchPilotCall(summary._id);
      const call = data.call;
      if (readyForReview(call)) {
        setReviewCall(call);
        setTab("upload");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      setActiveCall(call);
      setReviewCall(null);
      setTab("upload");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      toast.error(friendlyError(error, "यह कॉल नहीं खुल सकी।"));
    }
  }, []);

  /*
   * A ?callId= link (from the accuracy report) opens that call straight away:
   * ready drafts land in the review, running ones in the status card.
   */
  useEffect(() => {
    const initialId = new URLSearchParams(window.location.search).get("callId");
    if (!initialId) return;
    void Promise.resolve().then(() => openCall({ _id: initialId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryActive = async () => {
    if (!activeCall) return;
    try {
      const result = await retryPilotProcessing(activeCall._id);
      toast.success(result.message || "प्रोसेसिंग फिर से शुरू हो गई।");
      const data = await fetchPilotCall(activeCall._id);
      if (data.call) setActiveCall(data.call);
      await loadPending();
    } catch (error) {
      toast.error(friendlyError(error, "फिर कोशिश नहीं हो पाई।"));
    }
  };

  const onReviewChanged = useCallback(() => {
    void loadPending();
    if (tab === "orders") void loadOrders();
  }, [loadPending, loadOrders, tab]);

  const closeReview = () => {
    setReviewCall(null);
    setActiveCall(null);
    void loadPending();
  };

  /* --------------------------------- render -------------------------------- */

  const filteredShopkeepers = shopkeepers.filter((person) => {
    const text = query.trim().toLowerCase();
    if (!text) return true;
    return (
      shopkeeperName(person).toLowerCase().includes(text) ||
      String(person.phoneNumber || "").includes(text) ||
      String(person.place || "").toLowerCase().includes(text)
    );
  });

  const canUpload = Boolean(selectedId && audioFile && !uploading);
  const stage = activeCall?.pipeline?.stage || null;
  const stageFailed = stage === "failed";
  const stageReady = readyForReview(activeCall);

  const renderStatusCard = () => {
    if (!activeCall || reviewCall) return null;

    return (
      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100">
            {stageFailed ? (
              <X className="h-6 w-6 text-red-600" />
            ) : stage === "completed" ? (
              <Check className="h-6 w-6 text-emerald-700" />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-emerald-700" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-black text-slate-900">
              {stageFailed
                ? "ऑर्डर तैयार नहीं हो पाया"
                : stage === "completed"
                  ? "रिकॉर्डिंग पढ़ ली गई"
                  : "ऑर्डर तैयार हो रहा है"}
            </p>
            <p className="mt-0.5 text-sm font-bold text-slate-600">
              {stageFailed
                ? "रिकॉर्डिंग सुरक्षित है। नीचे दबाकर दोबारा कोशिश करें।"
                : stageLabel(stage)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {formatDate(activeCall.createdAt)}
            </p>
          </div>
        </div>

        {stageReady && (
          <button
            type="button"
            onClick={() => setReviewCall(activeCall)}
            className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-base font-black text-white transition hover:bg-emerald-800"
          >
            <ClipboardList className="h-5 w-5" />
            ऑर्डर की जाँच करें
          </button>
        )}

        {stage === "completed" && !stageReady && !stageFailed && (
          <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm font-bold text-slate-600">
            इस रिकॉर्डिंग में ऑर्डर का इरादा नहीं मिला।
          </p>
        )}

        {stageFailed && (
          <button
            type="button"
            onClick={retryActive}
            className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 text-base font-black text-white transition hover:bg-red-800"
          >
            <RotateCcw className="h-5 w-5" />
            फिर कोशिश करें
          </button>
        )}
      </section>
    );
  };

  const renderPendingList = () => {
    const others = pending.filter((call) => call._id !== activeCall?._id);
    if (others.length === 0) return null;

    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
        <h2 className="flex items-center gap-1.5 text-sm font-black text-amber-900">
          <Clock3 className="h-4 w-4" />
          जाँच बाकी ({others.length})
        </h2>
        <ul className="mt-2 max-h-44 space-y-1.5 overflow-y-auto">
          {others.map((call) => {
            const callStage = call.pipeline?.stage;
            const done = callStage === "completed";
            const callerNumber = call.caller?.raw || "";
            const displayName = call.customer?.matched &&
              call.customer?.name
              ? call.customer.name
              : callerNumber || "रिकॉर्डिंग";
            const showNumber =
              callerNumber && callerNumber !== displayName;
            return (
              <li
                key={call._id}
                className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-2.5 py-1.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-black text-slate-900">
                    {displayName}
                    {showNumber ? ` · ${callerNumber}` : ""}
                  </p>
                  <p className="truncate text-[10px] font-bold text-slate-500">
                    {formatCompactDay(call.createdAt)} · {stageLabel(callStage)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void openCall(call)}
                  className={`flex h-8 shrink-0 items-center gap-1 rounded-full px-3 text-[11px] font-black text-white transition ${
                    callStage === "failed"
                      ? "bg-red-600 hover:bg-red-700"
                      : done
                        ? "bg-emerald-700 hover:bg-emerald-800"
                        : "bg-slate-700 hover:bg-slate-800"
                  }`}
                >
                  {callStage === "failed" ? (
                    <RotateCcw className="h-3.5 w-3.5" />
                  ) : done ? (
                    <ClipboardList className="h-3.5 w-3.5" />
                  ) : (
                    <Loader2 className="h-3.5 w-3.5" />
                  )}
                  {callStage === "failed"
                    ? "फिर कोशिश"
                    : done
                      ? "जाँचें"
                      : "देखें"}
                </button>
              </li>
            );
          })}
        </ul>
        {pendingError && (
          <p className="mt-2 text-[11px] font-bold text-amber-800">
            {pendingError}
          </p>
        )}
      </section>
    );
  };

  const renderReview = () => (
    <div>
      <button
        type="button"
        onClick={closeReview}
        className="mb-4 flex h-11 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
      >
        <ChevronLeft className="h-4 w-4" />
        पीछे
      </button>
      <PilotOrderReview call={reviewCall} onChanged={onReviewChanged} />
    </div>
  );

  const renderUploadTab = () => {
    if (reviewCall) return renderReview();

    return (
      <div className="space-y-4">
        {renderStatusCard()}
        {renderPendingList()}

        {/* Step 1 — who is this recording for */}
        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">
              1
            </span>
            <h2 className="text-lg font-black text-slate-900">
              दुकानदार चुनें
            </h2>
          </div>

          {selectedShopkeeper ? (
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-700 text-base font-black text-white">
                {shopkeeperName(selectedShopkeeper).charAt(0) || "द"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black text-emerald-950">
                  {shopkeeperName(selectedShopkeeper)}
                </p>
                <p className="truncate text-xs font-bold text-emerald-800">
                  {selectedShopkeeper.phoneNumber || "नंबर नहीं"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId("")}
                className="flex h-9 shrink-0 items-center gap-1 rounded-full border border-emerald-300 bg-white px-3 text-xs font-black text-emerald-800"
              >
                <X className="h-4 w-4" />
                बदलें
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    // Searching is easier when the list and its context are in
                    // view again, so typing pulls the page back to the top.
                    if (window.scrollY > 0) {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  placeholder="नाम या नंबर खोजें..."
                  className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-base font-bold text-slate-800 placeholder-slate-400"
                />
              </div>

              {filteredShopkeepers.length === 0 ? (
                <p className="py-6 text-center text-sm font-bold text-slate-500">
                  कोई दुकानदार नहीं मिला।
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                  {filteredShopkeepers.slice(0, 30).map((person) => (
                    <li key={person._id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(person._id);
                          // The list collapses into the chosen shopkeeper card;
                          // glide back up so the selection and the steps that
                          // follow it are right where the eye left them.
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
                          {shopkeeperName(person).charAt(0) || "द"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-slate-900">
                            {shopkeeperName(person)}
                          </p>
                          <p className="truncate text-xs font-bold text-slate-500">
                            {person.phoneNumber || "नंबर नहीं"}
                            {person.place ? ` · ${person.place}` : ""}
                          </p>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {/* Step 2 — the recording itself */}
        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">
              2
            </span>
            <h2 className="text-lg font-black text-slate-900">
              रिकॉर्डिंग तैयार करें
            </h2>
          </div>

          {audioFile ? (
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                <FileAudio className="h-5 w-5 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-slate-800">
                    {audioFile.name}
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    {(audioFile.size / (1024 * 1024)).toFixed(1)} एमबी
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearAudio}
                  aria-label="रिकॉर्डिंग हटाएँ"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 transition hover:bg-slate-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {audioUrl && <audio src={audioUrl} controls className="h-11 w-full" />}
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-base font-black text-slate-700 transition hover:border-slate-400"
              >
                <Mic className="h-5 w-5" />
                दोबारा रिकॉर्ड करें
              </button>
            </div>
          ) : recording ? (
            <div className="mt-3 space-y-3 text-center">
              <p className="text-3xl font-black text-red-600">
                {formatClock(elapsed)}
              </p>
              <p className="text-sm font-bold text-slate-600">
                बोलिए... बात पूरी होते ही "रोकें" दबाएँ
              </p>
              <button
                type="button"
                onClick={stopRecording}
                className="mx-auto flex min-h-16 w-full max-w-xs items-center justify-center gap-3 rounded-full bg-red-600 px-6 text-lg font-black text-white transition hover:bg-red-700"
              >
                <Square className="h-6 w-6" />
                रोकें
              </button>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <button
                type="button"
                onClick={startRecording}
                className="flex min-h-16 w-full items-center justify-center gap-3 rounded-full bg-slate-900 px-6 text-lg font-black text-white transition hover:bg-slate-800"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15">
                  <Mic className="h-6 w-6" />
                </span>
                अभी रिकॉर्ड करें
              </button>

              <p className="text-center text-xs font-bold text-slate-400">
                ज़्यादा से ज़्यादा{" "}
                {Math.floor((config?.maxDurationSeconds || 600) / 60)} मिनट
              </p>

              <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-4 text-base font-black text-slate-600 transition hover:border-slate-400">
                <Upload className="h-5 w-5" />
                पहले से रिकॉर्ड की फ़ाइल चुनें
                <input
                  type="file"
                  accept=".wav,.mp3,.m4a,.aac,.webm,audio/wav,audio/mpeg,audio/mp4,audio/aac,audio/webm"
                  className="sr-only"
                  onChange={(event) => {
                    pickFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
          )}
        </section>

        {/* Step 3 — send it */}
        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-sm font-black text-emerald-800">
              3
            </span>
            <h2 className="text-lg font-black text-slate-900">अपलोड करें</h2>
          </div>

          <button
            type="button"
            onClick={upload}
            disabled={!canUpload}
            className="mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-lg font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                अपलोड हो रहा है... {uploadPercent}%
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                रिकॉर्डिंग अपलोड करें
              </>
            )}
          </button>

          {uploading && (
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-emerald-600 transition-all"
                style={{ width: `${Math.max(4, uploadPercent)}%` }}
              />
            </div>
          )}

          {!canUpload && !uploading && (
            <p className="mt-3 text-center text-xs font-bold text-slate-500">
              {!selectedId
                ? "पहले दुकानदार चुनें"
                : !audioFile
                  ? "फिर रिकॉर्डिंग तैयार करें"
                  : ""}
            </p>
          )}

          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-500">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            सबकी अनुमति से और अपने देश/कानून की इजाज़त से ही रिकॉर्ड करें।
          </p>
        </section>
      </div>
    );
  };

  const renderOrdersTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-slate-900">
          बने हुए ऑर्डर ({orders.length})
        </h2>
        <button
          type="button"
          onClick={loadOrders}
          aria-label="फिर से लाएँ"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
        >
          <RefreshCw className={`h-4 w-4 ${ordersLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {ordersError && (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-bold text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">{ordersError}</span>
          <button
            type="button"
            onClick={loadOrders}
            className="shrink-0 rounded-md bg-amber-800 px-2.5 py-1 text-xs font-black text-white"
          >
            फिर कोशिश
          </button>
        </div>
      )}

      {ordersLoading && orders.length === 0 ? (
        <p className="py-10 text-center text-sm font-bold text-slate-500">
          खुल रहा है...
        </p>
      ) : orders.length === 0 ? (
        <p className="rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center text-base font-bold text-slate-400">
          अभी कोई ऑर्डर नहीं बना है। रिकॉर्डिंग अपलोड करके ऑर्डर बनाएँ।
        </p>
      ) : (
        (() => {
          const groups = orders.reduce((acc, order) => {
            const key = order.createdAt
              ? new Date(order.createdAt).toLocaleDateString("en-CA")
              : "अन्य";
            if (!acc[key]) acc[key] = [];
            acc[key].push(order);
            return acc;
          }, {});

          return Object.entries(groups).map(([key, list]) => (
            <div key={key}>
              <p className="my-4 text-center text-xs font-black tracking-wide text-slate-500">
                {key === "अन्य" ? key : formatDay(key)}
              </p>
              <ul className="space-y-3">
                {list.map((order) => (
                  <li
                    key={order._id}
                    className="rounded-[24px] border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-black text-slate-900">
                          {order.customer?.name || "दुकानदार"}
                        </p>
                        <p className="flex items-center gap-1 text-xs font-bold text-slate-500">
                          {order.customer?.place && (
                            <>
                              <MapPin className="h-3.5 w-3.5" />
                              {order.customer.place} ·{" "}
                            </>
                          )}
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
                        {ORDER_STATUS_LABELS[order.status] || "ऑर्डर बन गया"}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                      <p className="text-sm font-bold text-slate-600">
                        {order.itemCount} चीज़
                        {order.paymentStatus === "Paid" ? " · भुगतान हो गया" : ""}
                      </p>
                      <p className="text-base font-black text-slate-900">
                        ₹{Number(order.totalAmount || 0).toFixed(0)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ));
        })()
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-[#f6f8f5] px-4 pb-32 pt-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-bold text-emerald-700">e-Setu</p>
            <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900">
              <UserRound className="h-6 w-6" />
              कॉल ऑर्डर
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadSetup();
              void loadPending();
              if (tab === "orders") void loadOrders();
            }}
            aria-label="पेज फिर से लाएँ"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </header>

        {/* Exactly two tabs: the bar the whole flow hangs on. */}
        <nav
          aria-label="फोन ऑर्डर के भाग"
          className="mt-4 grid grid-cols-2 gap-2"
        >
          <button
            type="button"
            onClick={() => {
              setTab("upload");
              setReviewCall(null);
            }}
            className={`flex min-h-13 items-center justify-center gap-2 rounded-xl px-3 text-base font-black transition ${
              tab === "upload"
                ? "bg-emerald-800 text-white"
                : "border border-slate-300 bg-white text-slate-600"
            }`}
          >
            <Upload className="h-5 w-5" />
            रिकॉर्डिंग अपलोड करें
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("orders");
              setReviewCall(null);
            }}
            className={`flex min-h-13 items-center justify-center gap-2 rounded-xl px-3 text-base font-black transition ${
              tab === "orders"
                ? "bg-emerald-800 text-white"
                : "border border-slate-300 bg-white text-slate-600"
            }`}
          >
            <ClipboardList className="h-5 w-5" />
            बने हुए ऑर्डर
          </button>
        </nav>

        <div className="mt-4">
          {tab === "upload" ? renderUploadTab() : renderOrdersTab()}
        </div>
      </div>
    </main>
  );
};

export default SupplierPhone;
