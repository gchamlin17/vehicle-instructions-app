import fs from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

if (!fs.existsSync("./serviceAccount.json")) {
  console.error("Missing serviceAccount.json in project root."); process.exit(1);
}
initializeApp({ credential: cert(JSON.parse(fs.readFileSync("./serviceAccount.json","utf8"))) });
const db = getFirestore();

const MAKE = process.env.MAKE || "Honda";
const YEAR = Number(process.env.YEAR || 2022);
const YT   = (process.env.YT || "").trim();

if (!YT) { console.error("Set env YT to an 11-char YouTube ID via $env:YT"); process.exit(1); }

async function run() {
  const col = db.collection(`makes/${MAKE}/years/${YEAR}/vehicles`);
  const snap = await col.get();
  if (snap.empty) { console.log(`No vehicles found for ${MAKE} ${YEAR}`); return; }

  let updates = 0;
  const batch = db.batch();
  snap.forEach(doc => {
    const cur = (doc.get("youtubeId") || "").trim();
    if (!cur) { batch.update(doc.ref, { youtubeId: YT }); updates++; }
  });
  if (updates) await batch.commit();
  console.log(`Stamped ${updates} vehicles in ${MAKE} ${YEAR} with youtubeId=${YT}`);
}
run().catch(e => { console.error(e); process.exit(1); });