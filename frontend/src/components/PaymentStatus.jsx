import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock3,
  ShoppingBag,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/constants";
import { clearCart } from "@/redux/ProductSlice";
import { useDispatch } from "react-redux";

const PaymentStatus = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const [status, setStatus] = useState("VERIFYING");
  const [message, setMessage] = useState(
    "आपका पेमेंट verify किया जा रहा है...",
  );

  const processingRef = useRef(false);

  useEffect(() => {
    const verifyPayment = async () => {
      /*
       * Prevent React StrictMode from running
       * the payment verification twice.
       */
      if (processingRef.current) {
        return;
      }

      processingRef.current = true;

      const token = localStorage.getItem("token");

      if (!token) {
        setStatus("FAILED");
        setMessage("कृपया पहले लॉगिन करें।");
        return;
      }

      /*
       * PhonePe should redirect to:
       *
       * https://esetu.vercel.app/payment/status?transactionId=XXXX
       *
       * We support several possible parameter names
       * just in case PhonePe returns a slightly different one.
       */

      const searchParams = new URLSearchParams(location.search);

      const transactionId =
        searchParams.get("transactionId") ||
        searchParams.get("merchantOrderId") ||
        searchParams.get("orderId") ||
        searchParams.get("merchantTransactionId");

      if (!transactionId) {
        console.error(
          "PaymentStatus: Transaction ID missing.",
          location.search,
        );

        setStatus("FAILED");
        setMessage("पेमेंट transaction नहीं मिला।");
        return;
      }

      try {
        /* ======================================================
           STEP 1
           CHECK PAYMENT STATUS WITH PHONEPE
        ====================================================== */

        setStatus("VERIFYING");
        setMessage("पेमेंट की स्थिति verify की जा रही है...");

        const statusResponse = await axios.post(
          `${API_BASE_URL}/api/v1/payment/check-status`,
          {
            transactionId,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            timeout: 15000,
          },
        );

        if (!statusResponse.data?.success) {
          throw new Error(
            statusResponse.data?.message || "पेमेंट status verify नहीं हो सका।",
          );
        }

        const paymentStatus = String(
          statusResponse.data?.status || "PENDING",
        ).toUpperCase();

        /* ======================================================
           PAYMENT SUCCESS
        ====================================================== */

        if (paymentStatus === "SUCCESS") {
          setStatus("PROCESSING");
          setMessage("पेमेंट सफल है। आपका ऑर्डर बनाया जा रहा है...");

          /*
           * IMPORTANT:
           *
           * Do not create the order from the frontend.
           *
           * Backend verifies PhonePe AGAIN.
           */

          const completeResponse = await axios.post(
            `${API_BASE_URL}/api/v1/payment/complete-payment`,
            {
              transactionId,
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
              timeout: 15000,
            },
          );

          if (!completeResponse.data?.success) {
            throw new Error(
              completeResponse.data?.message ||
                "पेमेंट सफल है लेकिन ऑर्डर बनाया नहीं जा सका।",
            );
          }

          /*
           * Backend has now:
           *
           * 1. Verified PhonePe
           * 2. Created order
           * 3. Cleared backend cart
           */

          dispatch(clearCart());

          setStatus("SUCCESS");
          setMessage("पेमेंट सफल! आपका ऑर्डर सफलतापूर्वक बना दिया गया है।");

          /*
           * Give the user a moment to see the success state,
           * then go to your existing order-success page.
           */

          setTimeout(() => {
            navigate("/order-success", {
              replace: true,
              state: {
                order: completeResponse.data?.order || null,
                paymentMethod: "Online",
                transactionId,
                paymentTransactionId:
                  completeResponse.data?.paymentTransactionId || transactionId,
              },
            });
          }, 1200);

          return;
        }

        /* ======================================================
           PAYMENT FAILED
        ====================================================== */

        if (paymentStatus === "FAILED") {
          setStatus("FAILED");
          setMessage("पेमेंट असफल हो गया। आपका ऑर्डर नहीं बनाया गया।");
          return;
        }

        /* ======================================================
           PAYMENT EXPIRED
        ====================================================== */

        if (paymentStatus === "EXPIRED") {
          setStatus("EXPIRED");
          setMessage(
            "पेमेंट session expire हो गया। आपका ऑर्डर नहीं बनाया गया।",
          );
          return;
        }

        /* ======================================================
           PAYMENT PENDING
        ====================================================== */

        setStatus("PENDING");
        setMessage(
          "पेमेंट अभी process हो रहा है। कृपया थोड़ी देर बाद दोबारा check करें।",
        );
      } catch (error) {
        console.error(
          "Payment verification error:",
          error?.response?.data || error?.message || error,
        );

        setStatus("FAILED");

        setMessage(
          error?.response?.data?.message ||
            error?.message ||
            "पेमेंट verify नहीं हो सका।",
        );

        toast.error(
          error?.response?.data?.message ||
            error?.message ||
            "पेमेंट verify नहीं हो सका।",
          {
            duration: 2000,
          },
        );
      }
    };

    verifyPayment();
  }, [location.search, navigate, dispatch]);

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
            पेमेंट की पुष्टि अभी PhonePe से नहीं मिली है। आपका कार्ट सुरक्षित
            है।
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
     VERIFYING / FAILED
  ============================================================ */

  if (status === "FAILED") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-red-50">
            <XCircle className="h-12 w-12 text-red-600" />
          </div>

          <h1 className="mt-6 text-2xl font-extrabold text-gray-900">
            पेमेंट verify नहीं हो सका
          </h1>

          <p className="mt-3 text-sm leading-6 text-gray-500">{message}</p>

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
