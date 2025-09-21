import "dotenv/config";
import fs from "fs";
import Papa from "papaparse";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore, writeBatch, doc, setDoc } from "firebase/firestore";

function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

const app = initializeApp({
  apiKey: env("EXPO_PUBLIC_FIREBASE_API_KEY"),
  authDomain: env("EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN"),
  projectId: env("EXPO_PUBLIC_FIREBASE_PROJECT_ID"),
  storageBucket: env("EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET"),
});

const auth = getAuth(app);
const db = getFirestore(app);

function parseCsv(path) {
  const txt = fs.readFileSync(path, "utf8");
  return Papa.parse(txt, { header: true, skipEmptyLines: true }).data;
}

function slug(s) {
  return (s || "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

async function importVehicles(rows) {
  if (!rows.length) return 0;
  let batch = writeBatch(db); let n = 0;
  for (const r of rows) {
    const id = `${r.year}_${slug(r.make)}_${slug(r.model)}`;
    const ref = doc(db, "vehicles", id);
    batch.set(ref, {
      year: Number(r.year), make: r.make, model: r.model, type: r.type || null,
      key: id, createdAt: Date.now(),
    });
    if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
  }
  await batch.commit();
  return rows.length;
}

async function importContent(rows) {
  if (!rows.length) return 0;
  let batch = writeBatch(db); let n = 0;
  for (const r of rows) {
    const vidKey = `${r.year}_${slug(r.make)}`;
    const docId = `${slug(r.title)}_${vidKey}_${Math.random().toString(36).slice(2,7)}`;
    const ref = doc(db, "contentItems", docId);
    batch.set(ref, {
      title: r.title,
      feature: r.feature,
      type: "video",
      visibility: r.visibility || "public",
      youtubeId: r.youtubeId || null,
      vehicleRef: { year: Number(r.year), make: r.make },
      createdAt: Date.now(),
    });
    if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
  }
  await batch.commit();
  return rows.length;
}

(async () => {
  await signInAnonymously(auth);
  const vehicles = parseCsv(process.argv[2] || "./data/vehicles.csv");
  const content  = parseCsv(process.argv[3] || "./data/content.csv");
  const v = await importVehicles(vehicles);
  const c = await importContent(content);
  console.log(`Imported vehicles: ${v}, content items: ${c}`);
  process.exit(0);
})();
