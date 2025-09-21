
// upload_to_firebase_v2.js - reads manifest and uploads final media + metadata
// Usage: node scripts/upload_to_firebase_v2.js <vehicleId> <outDir>
const fs = require('fs');
const path = require('path');
const { Storage } = require('@google-cloud/storage');
const admin = require('firebase-admin');

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error("GOOGLE_APPLICATION_CREDENTIALS not set.");
  process.exit(1);
}
if (!process.env.FIREBASE_STORAGE_BUCKET) {
  console.error("FIREBASE_STORAGE_BUCKET not set.");
  process.exit(1);
}

try { admin.initializeApp({ storageBucket: process.env.FIREBASE_STORAGE_BUCKET }); } catch {}
const db = admin.firestore();
const bucket = admin.storage().bucket();

function publicUrl(filePath) {
  return `https://storage.googleapis.com/${bucket.name}/${filePath}`;
}

async function uploadFile(localPath, destPath, contentType) {
  await bucket.upload(localPath, { destination: destPath, metadata: { contentType, cacheControl: "public, max-age=3600" } });
  return publicUrl(destPath);
}

(async () => {
  const [vehicleId, outDir] = process.argv.slice(2);
  if (!vehicleId || !outDir) {
    console.error("Usage: node scripts/upload_to_firebase_v2.js <vehicleId> <outDir>");
    process.exit(1);
  }

  const manifestPath = path.join(outDir, `${vehicleId}_manifest.json`);
  const videoPath    = path.join(outDir, `${vehicleId}_video.mp4`);
  const audioPath    = path.join(outDir, `${vehicleId}_audio.mp3`);
  const scriptPath   = path.join(outDir, `${vehicleId}_script.txt`);

  if (!fs.existsSync(videoPath) || !fs.existsSync(audioPath) || !fs.existsSync(scriptPath) || !fs.existsSync(manifestPath)) {
    console.error("Required output files missing. Check pipeline_v3 outputs.");
    process.exit(1);
  }

  const basePrefix = `vehicles/${vehicleId}`;
  const videoKey = `${basePrefix}/video.mp4`;
  const audioKey = `${basePrefix}/audio.mp3`;
  const scriptKey = `${basePrefix}/script.txt`;

  console.log("[upload] Uploading final media...");
  const [videoUrl, audioUrl] = await Promise.all([
    uploadFile(videoPath, videoKey, "video/mp4"),
    uploadFile(audioPath, audioKey, "audio/mpeg")
  ]);
  await uploadFile(scriptPath, scriptKey, "text/plain");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

  console.log("[upload] Writing Firestore doc…");
  await db.collection("vehicles").doc(vehicleId).set({
    vehicleId,
    name: vehicleId,
    script: fs.readFileSync(scriptPath, "utf-8"),
    videoUrl,
    audioUrl,
    segments: manifest.segments.map(s => ({ index: s.index, text: s.text, image: path.basename(s.image) })),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  console.log("[upload] Done.");
})().catch(err => { console.error(err); process.exit(1); });
