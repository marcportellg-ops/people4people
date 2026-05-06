import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBjMuLZ2j9IkyN3sq8Ow1Tl2Z--3_iFiGk",
  authDomain: "people4people-1f7d5.firebaseapp.com",
  projectId: "people4people-1f7d5",
  storageBucket: "people4people-1f7d5.firebasestorage.app",
  messagingSenderId: "704684291498",
  appId: "1:704684291498:web:4e73e10ebff45ad95327d3",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);

export const SUPER_MODERATOR_EMAIL = "marcportellg@gmail.com";
