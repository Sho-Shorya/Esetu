import { auth } from "../firebase";

import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";

let confirmationResult = null;

export const setupRecaptcha = () => {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      "recaptcha-container",
      {
        size: "invisible",
      },
    );
  }
};

export const sendOtp = async (phoneNumber) => {
  setupRecaptcha();

  confirmationResult = await signInWithPhoneNumber(
    auth,
    `+91${phoneNumber}`,
    window.recaptchaVerifier,
  );

  return true;
};

export const verifyOtp = async (otp) => {
  if (!confirmationResult) {
    throw new Error("OTP was not sent.");
  }

  const result = await confirmationResult.confirm(otp);

  return result.user;
};
