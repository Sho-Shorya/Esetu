import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ChevronLeft,
  ClipboardList,
  FlaskConical,
  Loader2,
  Mic,
  Pause,
  Phone,
  Play,
  RefreshCw,
  RotateCcw,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  fetchPilotAudioObjectUrl,
  fetchPilotCalls,
  fetchPilotCapability,
  createOrderFromConfirmedPilotCall,
  retryPilotProcessing,
  uploadTestAudio,
} from "@/services/phoneOrderPilotApi";
import PilotOrderReview from "./PilotOrderReview";
import { Link } from "react-router-dom";

const ACTIVE_STAGES = [
  "new",
  "call_answered",
  "call_ended",
  "recording_ready",
  "processing_recording",
  "downloading_recording",
  "transcribing",
  "extracting",
];

const STAGE_LABELS = {
  new: "कतार में",
  call_answered: "कॉल पर बात हुई",
  call_ended: "कॉल पूरी हुई",
  recording_ready: "रिकॉर्डिंग तैयार",
  processing_recording: "रिकॉर्डिंग लाई जा रही है",
  downloading_recording: "ऑडियो आ रहा है",
  transcribing: "आवाज़ लिखी जा रही है",
  extracting: "सामान जुदा किए जा रहे हैं",
  completed: "जाँच के लिए तैयार",
  failed: "जाँच नहीं हो पाई",
};

const PIPELINE_POLL_MS = 15000;

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleString("hi-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const formatDuration = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "—";
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

export const formatBytes = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 1024) return `${value} बाइट`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} केबी`;
  return `${(value / (1024 * 1024)).toFixed(1)} एमबी`;
};

const stageBadgeClass = (stage) => {
  if (stage === "completed") return "bg-emerald-100 text-emerald-700";
  if (stage === "failed") return "bg-red-100 text-red-700";
  if (ACTIVE_STAGES.includes(stage)) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
};

/** निजी रिकॉर्डिंग को खींचकर ब्लॉब URL से चलाता है। */
const AudioPlayer = ({ pilotCallId }) => {
  const [objectUrl, setObjectUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef(null);

  useEffect(
    () => () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    },
    [objectUrl],
  );

  const load = async () => {
    if (objectUrl) return;
    try {
      setLoading(true);
      setObjectUrl(await fetchPilotAudioObjectUrl(pilotCallId));
    } catch {
      toast.error("रिकॉर्डिंग नहीं खुल सकी।");
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (!objectUrl) await load();
    const node = audioRef.current;
    if (!node) return;
    if (node.paused) {
      await node
        .play()
        .catch(() => toast.error("ऑडियो चलाने की इजाज़त नहीं मिली।"));
    } else {
      node.pause();
    }
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700 disabled:opacity-50"
        title={playing ? "रोकें" : "चलाएँ"}
      >
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </button>

      {objectUrl && (
        <audio
          ref={audioRef}
          src={objectUrl}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          controls
          className="h-10 w-full"
        />
      )}
    </div>
  );
};

const SpeakerSegments = ({ speakers }) => {
  if (!Array.isArray(speakers) || speakers.length === 0) return null;

  return (
    <div className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-slate-50 p-3">
      {speakers.map((segment, index) => (
        <p
          key={`${segment.speaker}-${index}`}
          className="text-sm text-slate-700"
        >
          <span className="font-bold text-slate-900">{segment.speaker}</span>{" "}
          <span className="text-xs text-slate-400">
            {segment.startSeconds}s – {segment.endSeconds}s
          </span>
        </p>
      ))}
    </div>
  );
};

/**
 * Re-runs a failed pipeline from the recording the backend already holds, so
 * the supplier never has to find and re-upload the file by hand.
 */
const RetryProcessingButton = ({ pilotCallId, onRetried }) => {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const data = await retryPilotProcessing(pilotCallId);
      toast.success(data.message || "प्रोसेसिंग फिर से शुरू हो गई।");
      onRetried?.();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "फिर कोशिश नहीं हो पाई।",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={run}
      className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 text-sm font-black text-white transition hover:bg-red-800 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      {busy ? "प्रोसेस हो रहा है..." : "फिर कोशिश करें"}
    </button>
  );
};

const CallDetail = ({ call, onReviewChanged }) => {
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [orderError, setOrderError] = useState("");
  const stage = call.pipeline?.stage || "new";
  const draft = call.extraction?.draft;
  const stt = call.stt || {};
  const caller = call.caller || {};
  const customer = call.customer || {};

  const createOrder = async () => {
    setCreatingOrder(true);
    setOrderError("");
    try {
      const result = await createOrderFromConfirmedPilotCall(call._id);
      toast.success(result.message || "ऑर्डर बन गया।");
      onReviewChanged();
    } catch (error) {
      const message =
        error.response?.data?.message ||
        "ऑर्डर नहीं बन सका। जाँचकर दोबारा कोशिश करें।";
      setOrderError(message);
      toast.error(message);
    } finally {
      setCreatingOrder(false);
    }
  };

  return (
    <div className="space-y-4">
      {call.audio?.available && (
        <section className="rounded-[24px] border border-slate-200 bg-white p-5">
          <h4 className="mb-3 flex items-center gap-2 text-base font-black text-slate-800">
            <Mic className="h-5 w-5" />
            कॉल रिकॉर्डिंग
          </h4>
          <AudioPlayer pilotCallId={call._id} />
          <p className="mt-2 text-xs text-slate-400">
            {formatBytes(call.audio.bytes)} · {call.audio.contentType} · निजी
            तौर पर सहेजी गई, सिर्फ़ सप्लायर को दिखती है
          </p>
        </section>
      )}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <h4 className="mb-2 text-base font-black text-slate-800">
          कॉल की लिखावट
        </h4>

        {stt.status === "completed" && stt.transcript ? (
          <>
            <div className="mb-3 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                {stt.engine} · {stt.transport} · {stt.model}
              </span>
              {stt.languageCode && (
                <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">
                  {stt.languageCode}
                </span>
              )}
              {stt.channelsMerged && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                  चैनल जोड़े गए
                </span>
              )}
              <span
                className={`rounded-full px-2.5 py-1 ${
                  stt.speakerAttributionAvailable
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {stt.speakerAttributionAvailable
                  ? "आवाज़ें अलग पहचानी गईं"
                  : "आवाज़ की जानकारी नहीं"}
              </span>
            </div>

            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-base leading-relaxed text-slate-800">
              {stt.transcript}
            </p>

            {Array.isArray(stt.speakers) && stt.speakers.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                  आवाज़ के हिस्से
                </p>
                <SpeakerSegments speakers={stt.speakers} />
              </div>
            )}

            {stt.timestamps?.chunks?.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-600">
                  समय के हिस्से ({stt.timestamps.chunks.length})
                </summary>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                  {stt.timestamps.chunks.map((chunk, index) => (
                    <p key={index} className="text-xs text-slate-600">
                      <span className="font-bold text-slate-400">
                        {chunk.startSeconds}s
                      </span>{" "}
                      {chunk.text}
                    </p>
                  ))}
                </div>
              </details>
            )}
          </>
        ) : stt.status === "failed" ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {stt.error || "आवाज़ नहीं लिखी जा सकी।"}
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            आवाज़ लिखी जा रही है… ({STAGE_LABELS[stage] || stage})
          </p>
        )}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-base font-black text-slate-800">
            <ClipboardList className="h-5 w-5" />
            ऑर्डर ड्राफ्ट
          </h4>
          {call.extraction?.needsReview &&
            call.review?.status !== "confirmed" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                इंसानी जाँच बाकी
              </span>
            )}
          {call.review?.status === "confirmed" && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
              ड्राफ्ट पक्का हुआ
            </span>
          )}
        </div>

        {call.extraction?.status === "completed" && draft ? (
          <>
            {call.extraction.validationErrors?.length > 0 && (
              <details className="mb-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-600">
                  कैटलॉग जाँच ({call.extraction.validationErrors.length})
                </summary>
                <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                  {call.extraction.validationErrors.map((message, index) => (
                    <li key={index}>• {message}</li>
                  ))}
                </ul>
              </details>
            )}

            {call.extraction.draft.isOrderIntent ? (
              <PilotOrderReview call={call} onChanged={onReviewChanged} />
            ) : (
              <>
                <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  इस कॉल में ऑर्डर का इरादा नहीं मिला।
                </p>
                {draft.unresolved?.length > 0 && (
                  <div className="mt-3 rounded-xl bg-amber-50 p-3">
                    <p className="text-sm font-black text-amber-800">
                      अनसुलझे सामान ({draft.unresolved.length})
                    </p>
                    <ul className="mt-1 space-y-0.5 text-sm text-amber-900">
                      {draft.unresolved.map((entry, index) => (
                        <li key={index}>
                          “{entry.spokenName}” — {entry.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}

            {call.review?.status === "confirmed" && (
              <div className="mt-3 space-y-2 rounded-xl bg-emerald-50 p-3">
                {call.review.orderCreated ? (
                  <p className="text-sm font-extrabold text-emerald-800">
                    ऑर्डर पूरा हुआ। इस कॉल से ऑर्डर पहले ही बन चुका है।
                  </p>
                ) : (
                  <>
                    <p className="text-sm font-bold text-emerald-900">
                      ड्राफ्ट पक्का है पर इस कॉल का ऑर्डर अभी नहीं बना। यहाँ से
                      बनाया जा सकता है।
                    </p>
                    <button
                      type="button"
                      onClick={createOrder}
                      disabled={creatingOrder}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 text-sm font-black text-white disabled:opacity-50"
                    >
                      {creatingOrder ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      {creatingOrder
                        ? "ऑर्डर बन रहा है..."
                        : "इस कॉल से ऑर्डर बनाएँ"}
                    </button>
                    {orderError && (
                      <p
                        role="alert"
                        className="text-sm font-bold text-red-700"
                      >
                        {orderError}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        ) : call.extraction?.status === "failed" ? (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {call.extraction.error || "सामान जुदा नहीं हो सके।"}
          </p>
        ) : (
          <p className="text-sm text-slate-400">सामान जुदा हो रहे हैं…</p>
        )}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <h4 className="mb-2 text-base font-black text-slate-800">
          कॉल करने वाला
        </h4>
        <p className="text-sm text-slate-600">
          <span className="font-bold">कच्चा नंबर:</span> {caller.raw || "—"}
        </p>
        <p className="text-sm text-slate-600">
          <span className="font-bold">पहचाना गया:</span>{" "}
          {caller.normalized || "नहीं पहचाना गया"}
          {caller.method ? ` (${caller.method})` : ""}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm font-bold">
          {customer.matched ? (
            <span className="flex items-center gap-1.5 text-emerald-700">
              <UserCheck className="h-4 w-4" /> मौजूदा ग्राहक से पूरा मैच
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-700">
              <UserX className="h-4 w-4" /> कोई ग्राहक मैच नहीं हुआ
            </span>
          )}
        </p>
      </section>

      {call.pipeline?.error && (
        <section className="rounded-[24px] border border-red-200 bg-red-50 p-5">
          <h4 className="flex items-center gap-2 text-base font-black text-red-800">
            <AlertTriangle className="h-5 w-5" />
            ऑर्डर तैयार नहीं हो पाया
          </h4>
          <p className="mt-1 text-sm text-red-700">
            {call.pipeline.error.message}
          </p>
          <p className="mt-1 text-sm text-red-700">
            रिकॉर्डिंग सुरक्षित है। दोबारा कोशिश करने पर वही रिकॉर्डिंग फिर से
            पढ़ी जाएगी।
          </p>
          <RetryProcessingButton pilotCallId={call._id} onRetried={onReviewChanged} />
        </section>
      )}
    </div>
  );
};

const PhoneOrderPilot = () => {
  const [calls, setCalls] = useState([]);
  const [selectedId, setSelectedId] = useState(() =>
    new URLSearchParams(window.location.search).get("callId"),
  );
  const [capability, setCapability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const firstLoadRef = useRef(true);

  const loadCalls = useCallback(async ({ quiet = false } = {}) => {
    try {
      const data = await fetchPilotCalls(50);
      setCalls(data.calls || []);
      setError(null);
      // Set loading to false after the first successful load
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        setLoading(false);
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "कॉल्स नहीं खुल सकीं। दोबारा कोशिश करें।",
      );
      if (firstLoadRef.current) {
        firstLoadRef.current = false;
        setLoading(false);
      }
    } finally {
      // The first render is already the loading state, so a quiet reload never
      // blanks the list the supplier is working in.
      if (!quiet && !firstLoadRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPilotCapability()
      .then(setCapability)
      .catch(() => {});
    void Promise.resolve().then(() => loadCalls({ quiet: true }));
  }, [loadCalls]);

  useEffect(() => {
    const hasActive = calls.some((call) =>
      ACTIVE_STAGES.includes(call.pipeline?.stage),
    );
    if (!hasActive) return undefined;

    const timer = setInterval(
      () => loadCalls({ quiet: true }),
      PIPELINE_POLL_MS,
    );
    return () => clearInterval(timer);
  }, [calls, loadCalls]);

  return (
    <div className="min-h-screen bg-[#f5f7f6] pt-16">
      <main className="mx-auto max-w-5xl px-3 pb-32 pt-4 sm:px-5 lg:px-6">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="mb-4 flex h-12 w-[110px] items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-base font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronLeft className="h-5 w-5" />
          पीछे
        </button>

        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 p-6 text-white shadow-xl">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
                <Phone className="h-7 w-7" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
                  फोन ऑर्डर जाँच
                </h1>
                <p className="text-[10px] font-medium text-slate-300">
                  कॉल सुनें · ऑर्डर ड्राफ्ट जाँचें
                </p>
              </div>
            </div>
            <Link
              to="/pilot/test-audio"
              className="flex h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-bold text-white transition hover:bg-white/20"
            >
              <FlaskConical className="h-4 w-4" />
              टेस्ट
            </Link>
          </div>
        </section>

        {/* <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
          {[
            {
              label: "कुल कॉल्स",
              value: calls.length,
              className: "bg-white text-slate-900 border-slate-200",
            },
            {
              label: "जाँच बाकी",
              value: calls.filter(
                (call) =>
                  call.pipeline?.stage === "completed" &&
                  call.review?.status !== "confirmed",
              ).length,
              className: "bg-violet-50 text-violet-700 border-violet-200",
            },
            {
              label: "ड्राफ्ट पक्का",
              value: calls.filter(
                (call) => call.review?.status === "confirmed",
              ).length,
              className: "bg-emerald-50 text-emerald-700 border-emerald-200",
            },
            {
              label: "अनसुलझे सामान",
              value: calls.reduce(
                (sum, call) =>
                  sum + (call.extraction?.draft?.unresolved?.length || 0),
                0,
              ),
              className: "bg-amber-50 text-amber-700 border-amber-200",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`rounded-2xl border p-3 text-center ${stat.className}`}
            >
              <p className="text-2xl font-black leading-none">{stat.value}</p>
              <p className="mt-1.5 text-xs font-bold">{stat.label}</p>
            </div>
          ))}
        </div> */}

        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">
            कॉल्स ({calls.length})
          </h2>
          <button
            type="button"
            onClick={() => loadCalls({ quiet: true })}
            className="flex h-10 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            रिफ्रेश
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-9 w-9 animate-spin text-slate-400" />
          </div>
        ) : calls.length === 0 ? (
          <p className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white p-8 text-center text-base text-slate-400">
            अभी कोई कॉल नहीं आई। जब ग्राहक फ़ोन पर ऑर्डर देगा, तब यहाँ दिखेगी।
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {calls.map((call) => {
              const stage = call.pipeline?.stage || "new";
              const isOpen = call._id === selectedId;

              return (
                <div key={call._id} className="space-y-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId(isOpen ? null : call._id)}
                    className={`w-full rounded-[24px] border bg-white p-4 text-left transition ${
                      isOpen
                        ? "border-slate-900 ring-2 ring-slate-900/10"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-slate-900">
                          {call.caller?.raw || "अनजान नंबर"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatDate(call.createdAt)} ·{" "}
                          {call.source === "test" ? "टेस्ट ऑडियो" : "असली कॉल"}{" "}
                          · {formatDuration(call.provider?.durationSeconds)}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${stageBadgeClass(stage)}`}
                      >
                        {STAGE_LABELS[stage] || stage}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
                      {call.customer?.matched ? (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                          ग्राहक पहचाना गया
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                          ग्राहक अनजान
                        </span>
                      )}
                      {call.extraction?.draft?.itemCount > 0 && (
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">
                          {call.extraction.draft.itemCount} सामान
                        </span>
                      )}
                      {call.extraction?.draft?.unresolved?.length > 0 && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-700">
                          {call.extraction.draft.unresolved.length} अनसुलझे
                        </span>
                      )}
                      {call.audio?.available && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                          ऑडियो सहेजा
                        </span>
                      )}
                      {stage === "completed" &&
                        call.review?.status === "confirmed" && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                            ड्राफ्ट पक्का
                          </span>
                        )}
                      {stage === "completed" &&
                        call.review?.status !== "confirmed" &&
                        call.extraction?.draft?.isOrderIntent && (
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">
                            {call.review?.blocking > 0
                              ? `${call.review.blocking} जाँच बाकी`
                              : "जाँच बाकी"}
                          </span>
                        )}
                    </div>
                  </button>

                  {isOpen && (
                    <CallDetail
                      call={call}
                      onReviewChanged={() => loadCalls({ quiet: true })}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Real Orders Section */}
        {calls.some((call) => call.review?.status === "confirmed") && (
          <section className="mt-8">
            <h2 className="text-xl font-black text-slate-900 mb-4">
              असली ऑर्डर (
              {calls.filter((c) => c.review?.status === "confirmed").length})
            </h2>
            <div className="space-y-3">
              {calls
                .filter((call) => call.review?.status === "confirmed")
                .map((call) => (
                  <div
                    key={call._id}
                    className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-black text-slate-900">
                          {call.caller?.raw || "अनजान नंबर"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatDate(call.createdAt)} ·{" "}
                          {call.review?.orderCreated
                            ? "ऑर्डर बन चुका है"
                            : "ड्राफ्ट पक्का हुआ"}
                          · {call.extraction?.draft?.itemCount || 0} सामान
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {call.review?.orderCreated ? (
                          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                            ऑर्डर पूरा
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setSelectedId(call._id)}
                            className="flex h-9 items-center gap-1.5 rounded-full bg-emerald-600 px-3 text-xs font-bold text-white transition hover:bg-emerald-700"
                          >
                            <ClipboardList className="h-3.5 w-3.5" />
                            जाँचें
                          </button>
                        )}
                        <button
                          type="button"
                          className="flex h-9 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          दोहराएँ
                        </button>
                        <button
                          type="button"
                          className="flex h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                          संशोधित करें
                        </button>
                      </div>
                    </div>
                    {call.extraction?.draft?.items?.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {call.extraction.draft.items
                          .slice(0, 5)
                          .map((item, idx) => (
                            <span
                              key={idx}
                              className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-700 border border-slate-200"
                            >
                              {item.productName || item.spokenName} ×{" "}
                              {item.quantity} {item.unit || ""}
                            </span>
                          ))}
                        {call.extraction.draft.items.length > 5 && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                            +{call.extraction.draft.items.length - 5} और
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default PhoneOrderPilot;
