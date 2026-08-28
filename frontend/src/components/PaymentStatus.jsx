import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock3,
  ShoppingBag,
  RefreshCw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/constants";
import { clearCart } from "@/redux/ProductSlice";
import { useDispatch } from "react-redux";

/* Wait helper (ms). */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* A network / server error means we DON'T know the real payment outcome,
   so we must not tell the user the payment failed. Only an explicit
   PhonePe FAILED / EXPIRED means the payment truly did not go through. */
const isTransientError = (error) => {
  const status = error?.response?.status;
  const code = error?.code;

  if (code === "ECONNABORTED" || code === "ERR_NETWORK") return true;

  if (status >= 500) return true;

  return false;
};

const PaymentStatus = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [status, setStatus] = useState("VERIFYING");
  const [message, setMessage] = useState(
    "आपका पेमेंट verify किया जा रहा है...",
  );

  const processingRef = useRef(false);
  const doneRef = useRef(false);

  const runVerification = useCallback(async () => {
    /*
     * Only allow one verification flow at a time. Errors set status to
     * RETRY/EERROR but never clear the cart, so re-running is safe.
     */
    if (processingRef.current) {
      return;
    }

    processingRef.current = true;

    try {
      const token = localStorage.getItem("token");

      if (!token) {
        setStatus("RETRY");
        setMessage("कृपया पहले लॉगिन करें।");
        return;
      }

      const searchParams = new URLSearchParams(location.search);

      /*
       * The redirect URL may or may not echo our merchantOrderId. Pass
       * whatever we found (possibly empty) — the backend resolves the user's
       * current pending payment when the URL value is missing.
       */
      const transactionId =
        searchParams.get("transactionId") ||
        searchParams.get("merchantOrderId") ||
        searchParams.get("orderId") ||
        searchParams.get("merchantTransactionId") ||
        "";

      /* ====================================================
         STEP 1 — CHECK STATUS WITH PHONEPE (via backend)
      ==================================================== */

      const statusResponse = await axios.post(
        `${API_BASE_URL}/api/v1/payment/check-status`,
        { transactionId: transactionId || undefined },
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 20000,
          validateStatus: (s) => s >= 200 && s < 500,
        },
      );

      const statusData = statusResponse.data || {};

      const paymentStatus = String(
        statusData?.status ||
          (statusData?.paymentSuccessful ? "SUCCESS" : "PENDING"),
      ).toUpperCase();

      /* ---------------- SUCCESS ---------------- */

      if (paymentStatus === "SUCCESS") {
        setStatus("PROCESSING");
        setMessage("पेमेंट सफल है। आपका ऑर्डर बनाया जा रहा है...");

        /*
         * The backend may have resolved the effective merchant order ID when
         * the redirect URL did not echo it. Prefer the resolved value.
         */
        const effectiveId =
          statusData?.transactionId || transactionId || "";

        /*
         * Backend re-verifies PhonePe and creates the order + clears the
         * backend cart. If this fails for a transient reason we MUST retry,
         * because the payment was already successful.
         */

        let completeResponse;

        for (let i = 0; i < 3; i += 1) {
          try {
            completeResponse = await axios.post(
              `${API_BASE_URL}/api/v1/payment/complete-payment`,
              { transactionId: effectiveId },
              {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 25000,
                validateStatus: (s) => s >= 200 && s < 500,
              },
            );

            break;
          } catch (completeError) {
            const last = i === 2;

            if (last || !isTransientError(completeError)) {
              throw completeError;
            }

            setMessage("पेमेंट सफल है। ऑर्डर बनाया जा रहा है...");
            await sleep(1500 * (i + 1));
          }
        }

        if (!completeResponse?.data?.success) {
          throw new Error(
            completeResponse?.data?.message ||
              "पेमेंट सफल है लेकिन ऑर्डर बनाया नहीं जा सका।",
          );
        }

        /* Backend has verified, created the order and cleared the cart. */
        dispatch(clearCart());

        doneRef.current = true;

        setStatus("SUCCESS");
        setMessage("पेमेंट सफल! आपका ऑर्डर सफलतापूर्वक बना दिया गया है।");

        setTimeout(() => {
          navigate("/order-success", {
            replace: true,
            state: {
              order: completeResponse.data?.order || null,
              paymentMethod: "Online",
              transactionId: effectiveId,
              paymentTransactionId:
                completeResponse.data?.paymentTransactionId || effectiveId,
            },
          });
        }, 1200);

        return;
      }

      /* ---------------- FAILED ---------------- */

      if (paymentStatus === "FAILED") {
        setStatus("FAILED");
        setMessage("पेमेंट असफल हो गया। आपका ऑर्डर नहीं बनाया गया।");
        return;
      }

      /* ---------------- EXPIRED ---------------- */

      if (paymentStatus === "EXPIRED") {
        setStatus("EXPIRED");
        setMessage(
          "पेमेंट session expire हो गया। आपका ऑर्डर नहीं बनाया गया।",
        );
        return;
      }

      /* ---------------- PENDING ---------------- */

      setStatus("PENDING");
      setMessage(
        "पेमेंट अभी process हो रहा है। कृपया थोड़ी देर बाद दोबारा check करें।",
      );
    } catch (error) {
      console.error(
        "Payment verification error:",
        error?.response?.data || error?.message || error,
      );

      const serverMessage =
        error?.response?.data?.message ||
        error?.message ||
        "पेमेंट verify नहीं हो सका।";

      /*
       * If this was a transient/unknown error we must NOT claim the payment
       * failed — the user's money may already be taken. Show a retry state
       * and keep the cart intact so nothing is lost.
       */
      const explicitFailure =
        error?.response?.data?.status === "FAILED" ||
        error?.response?.data?.status === "EXPIRED";

      if (explicitFailure) {
        const failed =
          error.response.data.status === "EXPIRED" ? "EXPIRED" : "FAILED";
        setStatus(failed);
        setMessage(
          failed === "EXPIRED"
            ? "पेमेंट session expire हो गया। आपका ऑर्डर नहीं बनाया गया।"
            : "पेमेंट असफल हो गया। आपका ऑर्डर नहीं बनाया गया।",
        );
        return;
      }

      setStatus("RETRY");
      setMessage(
        `${serverMessage} कृपया दोबारा प्रयास करें। यदि पैसा कट गया है, तो ऑर्डर अपने आप बन जाएगा।`,
      );

      toast.error(serverMessage, { duration: 2500 });
    } finally {
      processingRef.current = false;
    }
  }, [location.search, navigate, dispatch]);

  useEffect(() => {
    if (doneRef.current) {
      return;
    }

    runVerification();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  const retry = () => {
    runVerification();
  };

  /* ============================================================
     SUCCESS
  ============================================================ */

  if (status === "SUCCESS") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
          </div>

          <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
            पेमेंट सफल!
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            आपका पेमेंट verify हो गया है और आपका ऑर्डर बनाया जा रहा है।
          </p>

          <div className="mt-6 flex items-center justify-center gap-2 text-sm font-semibold text-green-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            ऑर्डर पेज पर जा रहे हैं...
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     PROCESSING
  ============================================================ */

  if (status === "PROCESSING") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
            <Loader2 className="h-11 w-11 animate-spin text-blue-600" />
          </div>

          <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
            ऑर्डर बनाया जा रहा है
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            पेमेंट सफल है। कृपया इस पेज को बंद या refresh न करें।
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     RETRY — an unknown / transient outcome (money may be taken)
  ============================================================ */

  if (status === "RETRY") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-amber-50">
            <RefreshCw className="h-11 w-11 text-amber-500" />
          </div>

          <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
            पेमेंट की स्थिति पुष्टि नहीं हो सकी
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">{message}</p>

          <Button
            onClick={retry}
            className="mt-7 h-12 w-full rounded-2xl bg-green-600 font-bold hover:bg-green-700"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            फिर से Check करें
          </Button>

          <button
            onClick={() => navigate("/cart")}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-red-200 font-bold text-red-600 hover:bg-red-50"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            कार्ट पर वापस जाएँ
          </button>

          <p className="mt-4 text-xs text-gray-400">
            यदि आपका पैसा कट गया है, तो ऑर्डर अपने आप बन जाएगा और आपको
            confirmation मिलेगा।
          </p>
        </div>
      </div>
    );
  }

  /* ============================================================
     PENDING
  ============================================================ */

  if (status === "PENDING") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-yellow-50">
            <Clock3 className="h-11 w-11 text-yellow-600" />
          </div>

          <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
            पेमेंट अभी processing में है
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            पेमेंट की पुष्टि अभी PhonePe से नहीं मिली है। कृपया फिर से check
            करें।
          </p>

          <Button
            onClick={retry}
            className="mt-7 h-12 w-full rounded-2xl bg-green-600 font-bold hover:bg-green-700"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            फिर से Check करें
          </Button>

          <button
            onClick={() => navigate("/cart")}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-red-200 font-bold text-red-600 hover:bg-red-50"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            कार्ट पर वापस जाएँ
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
     EXPIRED
  ============================================================ */

  if (status === "EXPIRED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-orange-50">
            <Clock3 className="h-11 w-11 text-orange-500" />
          </div>

          <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
            पेमेंट session expire हो गया
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">
            पेमेंट पूरा नहीं हुआ। आपका कार्ट सुरक्षित है, इसलिए आप दोबारा
            payment कर सकते हैं।
          </p>

          <Button
            onClick={() => navigate("/cart")}
            className="mt-7 h-12 w-full rounded-2xl bg-red-600 font-bold hover:bg-red-700"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            कार्ट पर वापस जाएँ
          </Button>
        </div>
      </div>
    );
  }

  /* ============================================================
     FAILED
  ============================================================ */

  if (status === "FAILED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>

          <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
            पेमेंट असफल हो गया
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">{message}</p>

          <Button
            onClick={retry}
            className="mt-7 h-12 w-full rounded-2xl bg-green-600 font-bold hover:bg-green-700"
          >
            <RefreshCw className="mr-2 h-5 w-5" />
            फिर से Check करें
          </Button>

          <button
            onClick={() => navigate("/cart")}
            className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-red-200 font-bold text-red-600 hover:bg-red-50"
          >
            <ShoppingBag className="mr-2 h-5 w-5" />
            कार्ट पर वापस जाएँ
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
     VERIFYING
  ============================================================ */

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50">
          <Loader2 className="h-11 w-11 animate-spin text-green-600" />
        </div>

        <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
          पेमेंट verify किया जा रहा है
        </h1>

        <p className="mt-3 text-sm leading-6 text-gray-500">{message}</p>

        <p className="mt-5 text-xs text-gray-400">
          कृपया इस पेज को बंद न करें।
        </p>
      </div>
    </div>
  );
};

export default PaymentStatus;
