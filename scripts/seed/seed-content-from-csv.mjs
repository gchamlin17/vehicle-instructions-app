import fs from "fs";
import path from "path";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const sa = JSON.parse(fs.readFileSync(path.resolve("./serviceAccount.json"), "utf8"));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();

function csvRows(file) {
  const [header, ...rows] = fs.readFileSync(file,"utf8").trim().split(/\r?\n/);
  const keys = header.split(",");
  return rows.map(r => {
    const vals = r.split(",");
    const obj = {}; keys.forEach((k,i) => obj[k.trim()] = (vals[i]||"").trim());
    return obj;
  });
}

(async () => {
  const rows = csvRows("./data/content.csv");
  let wrote = 0;
  for (const r of rows) {
    const make = r.make; const year = Number(r.year);
    if (!make || !year) continue;
    const col = db.collection(`makes/${make}/years/${year}/content`);
    await col.add({
      title: r.title || "Untitled",
      feature: r.feature || "General",
      type: r.type || "content",
      youtubeId: r.youtubeId || "",
      vehicleRef: { make, year },
      visibility: "public",
      createdAt: Date.now()
    });
    wrote++;
  }
  console.log("Seeded content:", wrote);
})();