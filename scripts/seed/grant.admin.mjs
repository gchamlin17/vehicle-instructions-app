import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const email = process.env.SEED_EMAIL;
const password = process.env.SEED_PASSWORD;

if (!email || !password) {
  console.error("Missing SEED_EMAIL or SEED_PASSWORD");
  process.exit(1);
}

const app = initializeApp({
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
});

const auth = getAuth(app);
const db = getFirestore(app);

(async () => {
  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    const uid = userCred.user.uid;

    await setDoc(doc(db, "admins", uid), {
      email,
      created: new Date().toISOString(),
    });

    console.log(`✅ Granted admin rights to ${email} (${uid})`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Error granting admin rights:", err);
    process.exit(1);
  }
})();