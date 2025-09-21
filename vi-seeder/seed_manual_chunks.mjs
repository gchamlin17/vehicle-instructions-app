import fs from "fs/promises";
import path from "path";
import admin from "firebase-admin";

// ---- args ----
const arg = (k, d) => {
  const hit = process.argv.find(a => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const vehicleKey = arg("vehicleKey", "honda/cr-v/2020/ex");
const inputFile  = arg("in", "./out/crv2020.txt");

// ---- env/creds ----
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("❌ Set GOOGLE_APPLICATION_CREDENTIALS to your admin.json path");
  process.exit(1);
}
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
const db = admin.firestore();

// replace "/" -> "__" for Firestore doc id
const toDocId = (k) => k.replace(/\//g, "__");

// split into ~900 char chunks at paragraph boundaries
function chunkify(text, target = 900, hardMax = 1200) {
  const paras = text.split(/\r?\n\s*\r?\n/); // blank line = new paragraph
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    const add = (cur ? cur + "\n\n" : "") + p.trim();
    if (add.length <= target) {
      cur = add;
      continue;
    }
    if (cur.length > 0) {
      chunks.push(cur);
      cur = p.trim();
      continue;
    }
    // very long single paragraph -> hard split
    for (let i = 0; i < p.length; i += hardMax) {
      const part = p.slice(i, i + hardMax).trim();
      chunks.push(part);
    }
    cur = "";
  }
  if (cur.trim().length) chunks.push(cur.trim());
  return chunks.map(c => c.replace(/\u0000/g, "").trim()).filter(Boolean);
}

async function main() {
  const abs = path.resolve(inputFile);
  const raw = await fs.readFile(abs, "utf8");
  if (!raw || raw.trim().length === 0) throw new Error("Input text is empty");
  const chunks = chunkify(raw);

  const docId = toDocId(vehicleKey);
  const base  = db.collection("vehicles").doc(docId);
  const col   = base.collection("manual_chunks");

  // Clear previous chunks
  const old = await col.limit(500).get();
  const batchDeletes = db.batch();
  old.forEach(d => batchDeletes.delete(col.doc(d.id)));
  if (!old.empty) await batchDeletes.commit();

  // Write new chunks in batches
  const pad = (n) => n.toString().padStart(4, "0");
  let batch = db.batch(), ct = 0, writes = 0;
  for (let i = 0; i < chunks.length; i++) {
    const id = pad(i + 1);
    batch.set(col.doc(id), { order: i + 1, text: chunks[i] });
    ct++; writes++;
    if (ct === 400) { await batch.commit(); batch = db.batch(); ct = 0; }
  }
  if (ct > 0) await batch.commit();

  // Update vehicle manual metadata
  await base.set({
    manual: {
      chunkCount: writes,
      source: "local-pdf",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  }, { merge: true });

  console.log(`✅ Wrote ${writes} chunks to vehicles/${docId}/manual_chunks`);
}

main().catch(e => { console.error("❌ Manual seeding failed:", e); process.exit(1); });