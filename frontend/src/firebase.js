import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBVcyACoxtIts3bfJbzl9LW69UCTd8sx0A",
  authDomain: "esetu-373f4.firebaseapp.com",
  projectId: "esetu-373f4",
  storageBucket: "esetu-373f4.firebasestorage.app",
  messagingSenderId: "252941708235",
  appId: "1:252941708235:web:44625cae3664f6f02d644e",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
