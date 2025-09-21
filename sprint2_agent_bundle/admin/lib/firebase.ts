import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "vehicle-instructions-app.firebaseapp.com",
  projectId: "vehicle-instructions-app",
  storageBucket: "vehicle-instructions-app.appspot.com",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const db = getFirestore(app);
