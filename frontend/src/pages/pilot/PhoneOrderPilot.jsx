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
  Play,
  RefreshCw,
  Upload,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  fetchPilotAudioObjectUrl,
  fetchPilotCalls,
  fetchPilotCapability,
  createOrderFromConfirmedPilotCall,
  uploadTestAudio,
} from "@/services/phoneOrderPilotApi";
import PilotOrderReview from "./PilotOrderReview";
import PilotAccuracyDashboard from "./PilotAccuracyDashboard";

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
  new: "Queued",
  call_answered: "Call answered",
  call_ended: "Call ended",
  recording_ready: "Recording ready",
  processing_recording: "Fetching recording",
  downloading_recording: "Downloading audio",
  transcribing: "Transcribing",
  extracting: "Extracting items",
  completed: "Ready for review",
  failed: "Failed",
};

const PIPELINE_POLL_MS = 15000;

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-IN") : "—";

const formatDuration = (seconds) => {
  const total = Number(seconds);
  if (!Number.isFinite(total) || total < 0) return "—";
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
};

const formatBytes = (bytes) => {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const stageBadgeClass = (stage) => {
  if (stage === "completed") return "bg-emerald-100 text-emerald-700";
  if (stage === "failed") return "bg-red-100 text-red-700";
  if (ACTIVE_STAGES.includes(stage)) return "bg-amber-100 text-amber-700";
  return "bg-slate-100 text-slate-600";
};

/** Lazily pulls the private recording and plays it from a blob URL. */
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
      toast.error("Recording could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  const toggle = async () => {
    if (!objectUrl) await load();
    const node = audioRef.current;
    if (!node) return;
    if (node.paused) {
      await node.play().catch(() => toast.error("Playback was blocked."));
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
        title={playing ? "Pause" : "Play"}
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

const TestAudioPanel = ({ capability, onUploaded }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!capability?.testAudioEnabled) {
    return (
      <section className="rounded-[24px] border border-dashed border-slate-300 bg-white p-5">
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-700">
          <FlaskConical className="h-5 w-5" />
          Test audio
        </h3>
        <p className="mt-2 text-sm text-slate-500">
          Disabled. Set <code>PILOT_TEST_AUDIO_ENABLED=true</code> in a
          non-production backend to upload a real recording and exercise the
          pipeline.
        </p>
      </section>
    );
  }

  const handleFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setProgress(0);
      await uploadTestAudio(file, (event) => {
        if (event.total) {
          setProgress(Math.round((event.loaded * 100) / event.total));
        }
      });
      toast.success("Recording uploaded. Transcription started.");
      onUploaded();
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Upload failed. Is it really audio?",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <section className="rounded-[24px] border border-violet-200 bg-violet-50/60 p-5">
      <h3 className="flex items-center gap-2 text-lg font-black text-violet-800">
        <FlaskConical className="h-5 w-5" />
        Test audio
      </h3>
      <p className="mt-1 text-sm text-violet-700">
        Upload a real recording of an order call. Transcription is never faked —
        if the audio is unusable, the run fails.
      </p>

      <label className="mt-3 flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 bg-white text-base font-bold text-violet-700 transition hover:bg-violet-50">
        {uploading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Upload className="h-5 w-5" />
        )}
        {uploading ? `Uploading ${progress}%` : "Choose audio file"}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={handleFile}
          className="hidden"
        />
      </label>

      <p className="mt-2 text-xs text-violet-500">
        Max {formatBytes(capability.maxAudioBytes)} per file.
      </p>
    </section>
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
            Recording
          </h4>
          <AudioPlayer pilotCallId={call._id} />
          <p className="mt-2 text-xs text-slate-400">
            {formatBytes(call.audio.bytes)} · {call.audio.contentType} · stored
            privately, streamed only to suppliers
          </p>
        </section>
      )}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <h4 className="mb-2 text-base font-black text-slate-800">Transcript</h4>

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
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                channels merged
              </span>
              <span
                className={`rounded-full px-2.5 py-1 ${
                  stt.speakerAttributionAvailable
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {stt.speakerAttributionAvailable
                  ? "diarized"
                  : "no speaker data"}
              </span>
            </div>

            <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-base leading-relaxed text-slate-800">
              {stt.transcript}
            </p>

            {Array.isArray(stt.speakers) && stt.speakers.length > 0 && (
              <div className="mt-3">
                <p className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                  Speaker segments
                </p>
                <SpeakerSegments speakers={stt.speakers} />
              </div>
            )}

            {stt.timestamps?.chunks?.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-600">
                  Timestamps ({stt.timestamps.chunks.length} chunks)
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
            {stt.error || "Transcription failed."}
          </p>
        ) : (
          <p className="text-sm text-slate-400">
            Waiting for transcription… ({STAGE_LABELS[stage] || stage})
          </p>
        )}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <div className="mb-2 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-base font-black text-slate-800">
            <ClipboardList className="h-5 w-5" />
            Order draft
          </h4>
          {call.extraction?.needsReview &&
            call.review?.status !== "confirmed" && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-700">
                needs human review
              </span>
            )}
          {call.review?.status === "confirmed" && (
            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700">
              draft confirmed
            </span>
          )}
        </div>

        {call.extraction?.status === "completed" && draft ? (
          <>
            {call.extraction.validationErrors?.length > 0 && (
              <details className="mb-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-600">
                  Catalog validation ({call.extraction.validationErrors.length})
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
                  No order intent detected in this call.
                </p>
                {draft.unresolved?.length > 0 && (
                  <div className="mt-3 rounded-xl bg-amber-50 p-3">
                    <p className="text-sm font-black text-amber-800">
                      Unresolved ({draft.unresolved.length})
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
                      जाँचा हुआ ऑर्डर तैयार है। पक्का करने पर e-Setu में असली
                      ऑर्डर बनेगा।
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
                        : "ऑर्डर पक्का करें"}
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
            {call.extraction.error || "Extraction failed."}
          </p>
        ) : (
          <p className="text-sm text-slate-400">Extraction pending…</p>
        )}
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5">
        <h4 className="mb-2 text-base font-black text-slate-800">Caller</h4>
        <p className="text-sm text-slate-600">
          <span className="font-bold">Raw:</span> {caller.raw || "—"}
        </p>
        <p className="text-sm text-slate-600">
          <span className="font-bold">Normalized:</span>{" "}
          {caller.normalized || "not recognised"}
          {caller.method ? ` (${caller.method})` : ""}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm font-bold">
          {customer.matched ? (
            <span className="flex items-center gap-1.5 text-emerald-700">
              <UserCheck className="h-4 w-4" /> exact match to an existing
              customer
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-700">
              <UserX className="h-4 w-4" /> no exact customer match
            </span>
          )}
        </p>
      </section>

      {call.pipeline?.error && (
        <section className="rounded-[24px] border border-red-200 bg-red-50 p-5">
          <h4 className="flex items-center gap-2 text-base font-black text-red-800">
            <AlertTriangle className="h-5 w-5" />
            Pipeline error
          </h4>
          <p className="mt-1 text-sm text-red-700">
            {call.pipeline.error.message}
          </p>
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

  const loadCalls = useCallback(async ({ quiet = false } = {}) => {
    try {
      const data = await fetchPilotCalls(50);
      setCalls(data.calls || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load pilot calls.");
    } finally {
      // The first render is already the loading state, so a quiet reload never
      // blanks the list the supplier is working in.
      if (!quiet) setLoading(false);
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
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <Mic className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Phone Order Pilot
              </h1>
              <p className="text-sm font-medium text-slate-300">
                Phase 1 · calls → transcript → draft items
              </p>
            </div>
          </div>

          <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-400/15 p-3 text-sm font-bold text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Pilot only. This screen creates no orders, touches no carts and
            changes no customers. Every result needs human review.
          </p>
        </section>

        <div className="mt-4">
          <TestAudioPanel
            capability={capability}
            onUploaded={() => loadCalls({ quiet: true })}
          />
        </div>

        <div className="mt-4 flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900">
            Calls ({calls.length})
          </h2>
          <button
            type="button"
            onClick={() => loadCalls({ quiet: true })}
            className="flex h-10 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
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
            No pilot calls yet.
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
                          {call.caller?.raw || "unknown caller"}
                        </p>
                        <p className="text-sm text-slate-500">
                          {formatDate(call.createdAt)} ·{" "}
                          {call.source === "test" ? "test audio" : "live call"}{" "}
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
                          customer matched
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                          customer unknown
                        </span>
                      )}
                      {call.extraction?.draft?.itemCount > 0 && (
                        <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">
                          {call.extraction.draft.itemCount} item(s)
                        </span>
                      )}
                      {call.extraction?.draft?.unresolved?.length > 0 && (
                        <span className="rounded-full bg-orange-100 px-2.5 py-1 text-orange-700">
                          {call.extraction.draft.unresolved.length} unresolved
                        </span>
                      )}
                      {call.audio?.available && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                          audio stored
                        </span>
                      )}
                      {stage === "completed" &&
                        call.review?.status === "confirmed" && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                            draft confirmed
                          </span>
                        )}
                      {stage === "completed" &&
                        call.review?.status !== "confirmed" &&
                        call.extraction?.draft?.isOrderIntent && (
                          <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-700">
                            {call.review?.blocking > 0
                              ? `${call.review.blocking} to review`
                              : "awaiting review"}
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

        {/*
          Accuracy sits below the call list on purpose: the daily job is working
          through calls, and the dashboard is for looking at the trend afterwards.
          Clicking a caller reopens that call's existing detail above.
        */}
        <div className="mt-8 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <PilotAccuracyDashboard
            onOpenCall={(pilotCallId) => {
              setSelectedId(pilotCallId);
              loadCalls({ quiet: true });
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
          />
        </div>
      </main>
    </div>
  );
};

export default PhoneOrderPilot;
