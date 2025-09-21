import "dotenv/config";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, collectionGroup, getDocs, doc, setDoc } from "firebase/firestore";

const cfg = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
};
const app = initializeApp(cfg);
const auth = getAuth(app);

async function ensureAuth() {
  const email = process.env.SEED_EMAIL;
  const pass  = process.env.SEED_PASSWORD;
  if (email && pass) {
    await signInWithEmailAndPassword(auth, email, pass);
    console.log("Signed in as", email);
  } else {
    console.warn("SEED_EMAIL/SEED_PASSWORD not set; trying anonymous (may fail)");
    await signInAnonymously(auth);
  }
}

async function main() {
  await ensureAuth();
  const db = getFirestore(app);

  // read vehicles from nested structure first, fallback to root
  let vdocs = (await getDocs(collectionGroup(db, "vehicles"))).docs;
  if (vdocs.length === 0) vdocs = (await getDocs(collection(db, "vehicles"))).docs;

  const makes = new Map(); // make -> { years:Set, counts: Map(year->n) }
  for (const d of vdocs) {
    const v = d.data();
    const make = String(v.make || "").trim();
    const year = Number(v.year);
    if (!make || !Number.isFinite(year)) continue;

    if (!makes.has(make)) makes.set(make, { years: new Set(), counts: new Map() });
    const m = makes.get(make);
    m.years.add(year);
    m.counts.set(year, (m.counts.get(year) || 0) + 1);
  }

  await setDoc(doc(db, "catalog", "summary"), { totalVehicles: vdocs.length, updatedAt: Date.now() });

  for (const [make, { years, counts }] of makes) {
    const yearsArr = Array.from(years).sort((a,b)=>b-a);
    const countsObj = {}; for (const [y,c] of counts) countsObj[String(y)] = c;
    await setDoc(doc(collection(db, "catalog_makes"), make), {
      years: yearsArr, counts: countsObj, updatedAt: Date.now()
    });
  }

  console.log(`Wrote catalog for ${makes.size} makes; total ${vdocs.length} vehicles`);
}

main().catch(e => { console.error(e); process.exit(1); });