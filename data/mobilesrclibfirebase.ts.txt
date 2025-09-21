// mobile/src/lib/firebase.ts
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCPOIauE4golrN0UBRUnl8vw0F5Rb1WYkU",
  authDomain: "vehicle-instructions-app.firebaseapp.com",
  projectId: "vehicle-instructions-app",
  storageBucket: "vehicle-instructions-app.appspot.com",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
