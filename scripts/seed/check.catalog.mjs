import fs from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const keyPath = "./serviceAccount.json";
if (!fs.existsSync(keyPath)) {
  console.error("Missing serviceAccount.json in project root.");
  process.exit(1);
}
const svc = JSON.parse(fs.readFileSync(keyPath, "utf8"));
initializeApp({ credential: cert(svc) });
const db = getFirestore();

(async () => {
  console.log("Admin project_id:", svc.project_id);
  const sumDoc = await db.doc("catalog/summary").get();
  console.log("catalog/summary =>", sumDoc.exists ? sumDoc.data() : "MISSING");
  const makesSnap = await db.collection("catalog_makes").get();
  console.log("catalog_makes docs:", makesSnap.docs.map(d => d.id));
  process.exit(0);
})();