import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, FlaskConical, Loader2, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchPilotCapability,
  uploadTestAudio,
} from "@/services/phoneOrderPilotApi";
import { formatBytes } from "./PhoneOrderPilot";

const TestAudioPage = () => {
  const [capability, setCapability] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef(null);

  const loadCapability = useCallback(async () => {
    try {
      const data = await fetchPilotCapability();
      setCapability(data);
    } catch (error) {
      toast.error("क्षमता नहीं खुल सकी।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCapability();
  }, [loadCapability]);

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
      toast.success("रिकॉर्डिंग अपलोड हो गई। आवाज़ लिखी जा रही है।");
      loadCapability();
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "अपलोड नहीं हुआ। क्या यह असली ऑडियो है?",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f7f6] pt-16">
        <main className="mx-auto max-w-2xl px-3 pb-32 pt-4 sm:px-5 lg:px-6">
          <div className="flex justify-center py-12">
            <Loader2 className="h-9 w-9 animate-spin text-slate-400" />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7f6] pt-16">
      <main className="mx-auto max-w-2xl px-3 pb-32 pt-4 sm:px-5 lg:px-6">
        <Link
          to="/pilot/phone-orders"
          className="mb-4 flex h-12 w-[110px] items-center gap-1.5 rounded-full border border-slate-300 bg-white px-4 text-base font-bold text-slate-700 transition hover:bg-slate-50"
        >
          <ChevronLeft className="h-5 w-5" />
          पीछे
        </Link>

        <section className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-violet-900 via-violet-800 to-violet-700 p-6 text-white shadow-xl">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
              <FlaskConical className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                टेस्ट ऑडियो
              </h1>
              <p className="text-sm font-medium text-violet-200">
                असली रिकॉर्डिंग अपलोड करके पाइपलाइन जाँचें
              </p>
            </div>
          </div>
        </section>

        {!capability?.testAudioEnabled ? (
          <section className="mt-4 rounded-[24px] border border-dashed border-slate-300 bg-white p-5">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-700">
              <FlaskConical className="h-5 w-5" />
              टेस्ट ऑडियो बंद है
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              बैकएंड में <code>PILOT_TEST_AUDIO_ENABLED=true</code> सेट करके
              असली रिकॉर्डिंग अपलोड करें और पाइपलाइन जाँचें।
            </p>
            <Link
              to="/pilot/phone-orders"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-full bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
              वापस जाएँ
            </Link>
          </section>
        ) : (
          <section className="mt-4 rounded-[24px] border border-violet-200 bg-violet-50/60 p-5">
            <h3 className="flex items-center gap-2 text-lg font-black text-violet-800">
              <FlaskConical className="h-5 w-5" />
              टेस्ट ऑडियो
            </h3>
            <p className="mt-1 text-sm text-violet-700">
              ऑर्डर कॉल की असली रिकॉर्डिंग अपलोड करें। आवाज़ कभी नकली नहीं लिखी
              जाती — अगर ऑडियो ठीक नहीं है, तो जाँच रद्द हो जाएगी।
            </p>

            <label className="mt-3 flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-300 bg-white text-base font-bold text-violet-700 transition hover:bg-violet-50">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Upload className="h-5 w-5" />
              )}
              {uploading ? `अपलोड हो रहा है ${progress}%` : "ऑडियो फ़ाइल चुनें"}
              <input
                ref={inputRef}
                type="file"
                accept="audio/*"
                onChange={handleFile}
                className="hidden"
                disabled={uploading}
              />
            </label>

            <p className="mt-2 text-xs text-violet-500">
              एक फ़ाइल ज़्यादा से ज़्यादा{" "}
              {formatBytes(capability.maxAudioBytes)}।
            </p>

            <div className="mt-4 rounded-xl bg-white p-4 border border-violet-100">
              <h4 className="text-sm font-bold text-violet-800">
                कैसे काम करता है
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-violet-700">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                  ऑडियो फ़ाइल चुनें (MP3, WAV, M4A, आदि)
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                  फ़ाइल सीधे बैकएंड पर अपलोड होती है
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                  पाइपलाइन: डाउनलोड → ट्रांसक्राइब → निकालें → ड्राफ्ट
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-violet-400 shrink-0" />
                  नतीजा{" "}
                  <Link
                    to="/pilot/phone-orders"
                    className="underline hover:text-violet-900"
                  >
                    फोन ऑर्डर जाँच
                  </Link>{" "}
                  पेज पर दिखेगा
                </li>
              </ul>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default TestAudioPage;
