import React, { useEffect, useState } from "react";
import { ShieldCheck, RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import { sendOtp, verifyOtp } from "@/services/firebaseOtp";
import axios from "axios";
import { API_BASE_URL } from "@/lib/constants";

const VerifyOtp = () => {
  const location = useLocation();

  const phoneNumber = location.state?.phoneNumber;
  console.log(`phoneNumber = ${phoneNumber}`);

  //send otp
  useEffect(() => {
    if (phoneNumber) {
      sendOtp(phoneNumber);
    }
  }, [phoneNumber]);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error("6 अंकों का नंबर डालें");
      return;
    }
    setLoading(true);
    await verifyOtp(otp);

    try {
      const res = await axios.put(`${API_BASE_URL}/api/v1/user/verify`, {
        phoneNumber,
      });

      console.log("Verifying OTP:", otp);

      if (res.data.success) {
        navigate("/login");
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    try {
      await sendOtp(phoneNumber);
      toast.success("OTP Sent Again");
    } catch (err) {
      console.log(err);
      toast.error("Failed to send OTP");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl p-6">
        <div className="flex justify-center mb-4">
          <div className="bg-red-100 p-4 rounded-full">
            <ShieldCheck size={40} className="text-red-600" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-center">OTP वेरिफ़ाई करें</h1>

        <p className="text-center text-gray-500 mt-2">
          हमने +91 {phoneNumber} नंबर पर एक वेरिफिकेशन कोड भेजा है।
        </p>
        <div id="recaptcha-container"></div>
        <input
          type="text"
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="Enter 6-digit OTP"
          className="w-full mt-8 border-2 border-gray-300 rounded-2xl p-4 text-center text-2xl font-bold outline-none focus:border-red-500"
        />

        <button
          onClick={handleVerify}
          disabled={loading}
          className="w-full flex items-center justify-center mt-6 bg-red-600 hover:bg-green-700 text-white rounded-2xl py-4 font-bold transition disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="animate-spin h-6 w-6" />
          ) : (
            "Verify OTP"
          )}
        </button>

        <button
          onClick={handleResend}
          className="w-full mt-4 flex items-center justify-center gap-2 text-red-600 font-semibold"
        >
          <RotateCcw size={18} />
          Resend OTP
        </button>

        <p className="text-xs text-center text-gray-400 mt-6">
          Didn't receive the OTP? Wait for 30 seconds and then tap "Resend OTP".
        </p>
      </div>
    </div>
  );
};

export default VerifyOtp;
