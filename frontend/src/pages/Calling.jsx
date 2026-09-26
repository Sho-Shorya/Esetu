import { useCallback, useEffect, useState } from "react";
import { Clock3, Loader2, Phone, RefreshCw, Store, Upload } from "lucide-react";
import { toast } from "sonner";
import {
  fetchCallSuppliers,
  fetchCallingCapability,
  fetchMyCalls,
  recordOutgoingCall,
  uploadCallAudio,
} from "@/services/phoneCallingApi";

const dateTime = (value) => {
  if (!value) return "समय उपलब्ध नहीं";
  const date = new Date(value);
  return `${date.toLocaleDateString("hi-IN")} · ${date.toLocaleTimeString("hi-IN", { hour: "2-digit", minute: "2-digit" })}`;
};

const callStatus = (status) =>
  ({
    initiated: "कॉल शुरू की गई",
    ringing: "घंटी जा रही है",
    answered: "कॉल पर बात हुई",
    completed: "कॉल खत्म हुई",
    failed: "कॉल नहीं हो पाई",
    no_answer: "जवाब नहीं मिला",
    cancelled: "कॉल बंद हुई",
    missed: "कॉल नहीं उठी",
  })[status] || "स्थिति उपलब्ध नहीं";

const processingStatus = (status) =>
  ({
    no_audio: "रिकॉर्डिंग जोड़ें",
    processing: "ऑर्डर बन रहा है",
    draft_ready: "सप्लायर जाँचेंगे",
    needs_review: "सप्लायर जाँचेंगे",
    confirmed: "ऑर्डर की जाँच पूरी",
    order_created: "ऑर्डर पूरा हुआ",
    failed: "जाँच बाकी है",
  })[status] || "रिकॉर्डिंग जोड़ें";

const dialTarget = (phone) => {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
};

const Calling = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [calls, setCalls] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingCallId, setUploadingCallId] = useState(null);
  const [maxAudioBytes, setMaxAudioBytes] = useState(64 * 1024 * 1024);
  const [wait, setWait] = useState({ active: false, secondsRemaining: 0 });
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const load = useCallback(async () => {
    try {
      const [supplierData, callData, capability] = await Promise.all([
        fetchCallSuppliers(),
        fetchMyCalls(),
        fetchCallingCapability(),
      ]);
      setSuppliers(supplierData.suppliers || []);
      setCalls(callData.calls || []);
      const nextWait = callData.wait || { active: false, secondsRemaining: 0 };
      setWait(nextWait);
      setSecondsRemaining(nextWait.secondsRemaining || 0);
      if (Number(capability.maxAudioBytes) > 0) {
        setMaxAudioBytes(Number(capability.maxAudioBytes));
      }
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "जानकारी नहीं खुल सकी। दोबारा कोशिश करें।",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  useEffect(() => {
    if (!wait.active) return undefined;
    const timer = setInterval(() => {
      setSecondsRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [wait.active]);

  const waitCountdown = `${Math.floor(secondsRemaining / 60)}:${String(secondsRemaining % 60).padStart(2, "0")}`;
  const isWaitActive = wait.active && secondsRemaining > 0;

  useEffect(() => {
    const timer = setInterval(load, 15000);
    return () => clearInterval(timer);
  }, [load]);

  const startCall = (supplier) => {
    const phone = dialTarget(supplier.phoneNumber);
    if (!phone) {
      toast.error("इस सप्लायर का फोन नंबर नहीं मिला।");
      return;
    }
    recordOutgoingCall({
      supplierId: supplier._id,
      toPhone: supplier.phoneNumber,
      callAt: new Date().toISOString(),
    })
      .then(() => fetchMyCalls().then((data) => setCalls(data.calls || [])))
      .catch(() =>
        toast.error(
          "कॉल का रिकॉर्ड नहीं बचा। फोन से कॉल फिर भी की जा सकती है।",
        ),
      );
  };

  const attachRecording = async (call, file, input) => {
    if (!file) return;
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!["wav", "mp3", "m4a"].includes(extension)) {
      toast.error("WAV, MP3 या M4A रिकॉर्डिंग चुनें।");
      input.value = "";
      return;
    }
    if (file.size > maxAudioBytes) {
      toast.error(
        `रिकॉर्डिंग ${Math.floor(maxAudioBytes / (1024 * 1024))} MB से छोटी रखें।`,
      );
      input.value = "";
      return;
    }

    try {
      setUploadingCallId(call.id);
      const result = await uploadCallAudio(call.id, file);
      toast.success(
        result.alreadyUploaded
          ? "यह रिकॉर्डिंग पहले से जुड़ी है।"
          : "रिकॉर्डिंग अपलोड हुई। ऑर्डर की जाँच शुरू है।",
      );
      setExpandedId(call.id);
      await load();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "रिकॉर्डिंग नहीं जुड़ी। सही कॉल और ऑडियो जाँचें।",
      );
    } finally {
      setUploadingCallId(null);
      input.value = "";
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f8f5] px-4 pb-32 pt-20 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div>
            <p className="text-sm font-bold text-emerald-700">e-Setu</p>
            <h1 className="mt-1 text-2xl font-black text-slate-900">
              सप्लायर को कॉल करें
            </h1>
          </div>
          <button
            type="button"
            onClick={load}
            aria-label="जानकारी फिर से लाएँ"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </header>

        {isWaitActive && (
          <section
            role="status"
            className="mt-4 border-l-4 border-amber-500 bg-amber-50 px-4 py-4"
          >
            <p className="text-base font-black text-amber-950">
              सप्लायर ने 10 मिनट रुकने को कहा है
            </p>
            {wait.supplierName && (
              <p className="mt-1 text-sm text-amber-900">
                {wait.supplierName} से इंतज़ार का संदेश
              </p>
            )}
            <p className="mt-2 text-3xl font-black tabular-nums text-amber-950">
              {waitCountdown}
            </p>
            <p className="text-xs text-amber-900">
              इस दौरान e-Setu से नई कॉल नहीं होगी। सप्लायर आपको कॉल कर सकते हैं।
            </p>
          </section>
        )}

        <section className="py-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <Store className="h-5 w-5 text-emerald-700" />
            सप्लायर
          </h2>
          {loading ? (
            <p className="py-6 text-center text-slate-500">खुल रहा है...</p>
          ) : suppliers.length === 0 ? (
            <p className="py-6 text-center text-slate-500">
              अभी कोई सप्लायर नहीं मिला।
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
              {suppliers.map((supplier) => {
                const phone = dialTarget(supplier.phoneNumber);
                return (
                  <li
                    key={supplier._id}
                    className="flex items-center justify-between gap-3 px-3 py-4 sm:px-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-slate-900">
                        {supplier.name}
                      </p>
                      {supplier.place && (
                        <p className="truncate text-sm text-slate-600">
                          {supplier.place}
                        </p>
                      )}
                      {supplier.phoneNumber && (
                        <p className="mt-0.5 text-sm text-slate-500">
                          {supplier.phoneNumber}
                        </p>
                      )}
                    </div>
                    <a
                      href={phone && !isWaitActive ? `tel:${phone}` : undefined}
                      onClick={(event) => {
                        if (!phone || isWaitActive) event.preventDefault();
                        else startCall(supplier);
                      }}
                      aria-disabled={isWaitActive || !phone}
                      aria-label={`${supplier.name} को कॉल करें`}
                      className={`flex h-12 shrink-0 items-center gap-2 rounded-md px-4 text-sm font-black text-white ${phone && !isWaitActive ? "bg-emerald-700 hover:bg-emerald-800" : "pointer-events-none bg-slate-400"}`}
                    >
                      {isWaitActive ? (
                        waitCountdown
                      ) : (
                        <>
                          <Phone className="h-5 w-5" />
                          कॉल करें
                        </>
                      )}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            कॉल आपके मोबाइल फोन से लगेगी। e-Setu सामान्य मोबाइल कॉल को अपने-आप
            सुन या रिकॉर्ड नहीं कर सकता।
          </p>
        </section>

        <section className="border-t border-slate-200 py-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <Clock3 className="h-5 w-5 text-emerald-700" />
            हाल की कॉल
          </h2>
          {calls.length === 0 ? (
            <p className="py-5 text-center text-slate-500">
              अभी कोई कॉल नहीं है।
            </p>
          ) : (
            <ul className="divide-y divide-slate-200 border-y border-slate-200 bg-white">
              {calls.map((call) => {
                const open = expandedId === call.id;
                const otherParty =
                  call.initiatedByRole === "supplier" ? call.from : call.to;
                return (
                  <li key={call.id}>
                    <button
                      type="button"
                      onClick={() => setExpandedId(open ? null : call.id)}
                      className="flex min-h-16 w-full items-center justify-between gap-3 px-3 py-3 text-left sm:px-4"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-bold text-slate-900">
                          {otherParty?.displayName ||
                            otherParty?.name ||
                            "सप्लायर"}
                        </span>
                        <span className="mt-1 block text-xs text-slate-500">
                          {call.initiatedByRole === "supplier"
                            ? "सप्लायर की कॉल"
                            : "बाहर की कॉल"}{" "}
                          · {dateTime(call.callAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-bold text-slate-700">
                        {callStatus(call.status)}
                      </span>
                    </button>
                    {open && (
                      <div className="space-y-3 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between gap-3">
                          <span>
                            {otherParty?.phoneNumber || "फोन नंबर उपलब्ध नहीं"}
                            {call.durationSeconds != null
                              ? ` · ${Math.floor(call.durationSeconds / 60)} मिनट ${call.durationSeconds % 60} सेकंड`
                              : " · अवधि उपलब्ध नहीं"}
                          </span>
                          {call.initiatedByRole !== "supplier" &&
                            call.to?.phoneNumber &&
                            !isWaitActive && (
                              <a
                                href={`tel:${dialTarget(call.to.phoneNumber)}`}
                                onClick={() =>
                                  startCall({
                                    _id: call.to.userId,
                                    phoneNumber: call.to.phoneNumber,
                                  })
                                }
                                className="shrink-0 font-extrabold text-emerald-800"
                              >
                                दोबारा कॉल करें
                              </a>
                            )}
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <p className="font-bold text-slate-700">
                            {call.initiatedByRole === "supplier"
                              ? "सप्लायर की कॉल"
                              : `कॉल चुनें: ${call.to?.displayName || "सप्लायर"}`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {call.hasAudio
                              ? processingStatus(call.processingStatus)
                              : "WAV, MP3 या M4A रिकॉर्डिंग जोड़ें। कॉल रिकॉर्डिंग फोन से चुनें।"}
                          </p>
                          <label className="mt-2 flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-black text-white">
                            {uploadingCallId === call.id ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Upload className="h-5 w-5" />
                            )}
                            {uploadingCallId === call.id
                              ? "रिकॉर्डिंग अपलोड हो रही है..."
                              : "रिकॉर्डिंग जोड़ें"}
                            <input
                              type="file"
                              accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
                              disabled={uploadingCallId === call.id}
                              onChange={(event) =>
                                attachRecording(
                                  call,
                                  event.target.files?.[0],
                                  event.currentTarget,
                                )
                              }
                              className="sr-only"
                            />
                          </label>
                          <p className="mt-1 text-center text-xs text-slate-500">
                            {Math.floor(maxAudioBytes / (1024 * 1024))} MB तक
                          </p>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
};

export default Calling;
