import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initializeApp, cert, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectId = process.env.FIREBASE_PROJECT_ID || "vehicle-instructions-app";

const saPath = path.resolve(__dirname, "..", "serviceAccount.json");
if (fs.existsSync(saPath)) {
  const sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
  initializeApp({ credential: cert(sa), projectId: sa.project_id || projectId });
} else {
  initializeApp({ credential: applicationDefault(), projectId });
}

const db = getFirestore();
const DRY = process.env.DRY_RUN === "1";

async function copyVehicles() {
  const snap = await db.collection("vehicles").get();
  let copied = 0, skipped = 0, bad = 0;
  for (const doc of snap.docs) {
    const v = doc.data() || {};
    const { make, year } = v;
    if (!make || !year) { bad++; continue; }
    const target = db.doc(`makes/${make}/years/${year}/vehicles/${doc.id}`);
    if ((await target.get()).exists) { skipped++; continue; }
    if (!DRY) await target.set(v, { merge: true });
    copied++;
  }
  return { total: snap.size, copied, skipped, bad };
}

async function copyContent() {
  const snap = await db.collection("contentItems").get();
  let copied = 0, skipped = 0, bad = 0;
  for (const doc of snap.docs) {
    const d = doc.data() || {};
    const vr = d.vehicleRef || {};
    const { make, year } = vr;
    if (!make || !year) { bad++; continue; }
    const target = db.doc(`makes/${make}/years/${year}/content/${doc.id}`);
    if ((await target.get()).exists) { skipped++; continue; }
    if (!DRY) await target.set(d, { merge: true });
    copied++;
  }
  return { total: snap.size, copied, skipped, bad };
}

(async () => {
  console.log("Starting migration", DRY ? "(DRY RUN)" : "(LIVE)");
  const v = await copyVehicles();   console.log("Vehicles:", v);
  const c = await copyContent();    console.log("Content:", c);
  console.log(DRY ? "No writes performed." : "Writes committed.");
})();