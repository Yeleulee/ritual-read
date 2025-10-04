import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyA7RtnCwp_oaQJ6ezJSykZDnJ9yvrkS1sQ",
  authDomain: "ritual-5141b.firebaseapp.com",
  projectId: "ritual-5141b",
  storageBucket: "ritual-5141b.firebasestorage.app",
  messagingSenderId: "545843037917",
  appId: "1:545843037917:web:83a43a57a2032bef5b7d34",
  measurementId: "G-J0PLYCC7GX",
};

export const firebaseApp = initializeApp(firebaseConfig);

export const initFirebaseAnalytics = async () => {
  try {
    if (await isSupported()) {
      return getAnalytics(firebaseApp);
    }
  } catch (err) {
    // no-op if analytics not supported (SSR or unsupported env)
  }
  return null;
};


