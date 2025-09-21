import { initializeApp, setLogLevel } from "firebase/app";
import {
  getFirestore, enableNetwork, disableNetwork,
  doc, getDoc, setDoc, serverTimestamp, onSnapshot
} from "firebase/firestore";
import { getStorage, ref, uploadBytes, deleteObject } from "firebase/storage";
import { Platform } from "react-native";

export const firebaseConfig = {
  apiKey: "AIzaSyCPOIauE4golrN0UBRUnl8vw0F5Rb1WYkU",
  authDomain: "vehicle-instructions-app.firebaseapp.com",
  projectId: "vehicle-instructions-app",
  storageBucket: "vehicle-instructions-app.appspot.com",
  appId: "1:236887317601:web:fdfd9d99b5b399f2ca1e20"
};

setLogLevel("debug");

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

// --- helpers ---
export function keyToId(vehicleKey: string): string {
  return (vehicleKey || "").replace(/\//g, "~");
}

export async function forceOnline() {
  try { await disableNetwork(db); } catch {}
  try { await enableNetwork(db); } catch {}
}

export async function pingFirestore() {
  const refDoc = doc(db, "_vi_ping", "web");
  await setDoc(refDoc, { ok: true, ts: serverTimestamp() }, { merge: true });
  const snap = await getDoc(refDoc);
  return snap.exists();
}

export function subscribeFirestore(cb: (state: {ok:boolean; err?:string}) => void) {
  const refDoc = doc(db, "_vi_ping", "sub");
  return onSnapshot(refDoc, {
    next: () => cb({ ok: true }),
    error: (e) => cb({ ok: false, err: e?.message || String(e) })
  });
}

export async function testStorageWrite() {
  const key = "_vi_connectivity/test_" + Date.now() + ".txt";
  const fileRef = ref(storage, "manuals/" + key);
  const blob = new Blob(["ok"], { type: "text/plain" });
  await uploadBytes(fileRef, blob);
  await deleteObject(fileRef);
  return true;
}

export async function clearWebCaches() {
  if (Platform.OS !== "web") return;
  try {
    const regs = await (navigator as any)?.serviceWorker?.getRegistrations?.();
    if (Array.isArray(regs)) for (const r of regs) await r.unregister();
  } catch {}
  try {
    if ((window as any).caches) {
      const keys = await (window as any).caches.keys();
      for (const k of keys) await (window as any).caches.delete(k);
    }
  } catch {}
  try { localStorage?.clear?.(); sessionStorage?.clear?.(); } catch {}
  try { window.location.reload(); } catch {}
}

console.log("[firebase.ts] wired →", firebaseConfig.projectId, firebaseConfig.storageBucket);




