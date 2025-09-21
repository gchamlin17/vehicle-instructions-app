/**
 * Upload generated audio and video files to Firebase Storage and create
 * a corresponding Firestore document. This script should be run after
 * the content pipeline has produced a script, MP3 and MP4 for a given vehicle.
 *
 * Usage:
 *   node upload_to_firebase.js <vehicleId> [outputDir]
 *
 * The outputDir defaults to `dist/pipeline-output`. The script expects files
 * named `<vehicleId>_script.txt`, `<vehicleId>_audio.mp3` and
 * `<vehicleId>_video.mp4` in that directory. It uses the service account
 * credentials in `keys/admin.json` and the `FIREBASE_STORAGE_BUCKET` environment
 * variable to determine which bucket to upload to.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize the Firebase Admin SDK using the service account
const serviceAccount = require('../keys/admin.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '<your-storage-bucket>'
});

const db = admin.firestore();

async function uploadVehicleAssets(vehicleId, outputDir) {
  const bucket = admin.storage().bucket();
  const scriptPath = path.join(outputDir, `${vehicleId}_script.txt`);
  const audioPath = path.join(outputDir, `${vehicleId}_audio.mp3`);
  const videoPath = path.join(outputDir, `${vehicleId}_video.mp4`);

  if (!fs.existsSync(scriptPath) || !fs.existsSync(audioPath) || !fs.existsSync(videoPath)) {
    throw new Error(`Required files for vehicle ${vehicleId} not found in ${outputDir}`);
  }

  // Upload audio and video to Storage
  const [audioFile] = await bucket.upload(audioPath, {
    destination: `vehicles/${vehicleId}/audio.mp3`,
    public: true,
    metadata: { cacheControl: 'public,max-age=31536000' }
  });
  const [videoFile] = await bucket.upload(videoPath, {
    destination: `vehicles/${vehicleId}/video.mp4`,
    public: true,
    metadata: { cacheControl: 'public,max-age=31536000' }
  });

  // Read the narration script
  const script = fs.readFileSync(scriptPath, 'utf8');

  // Create or update Firestore document
  const docData = {
    vehicleId,
    script,
    audioUrl: audioFile.publicUrl(),
    videoUrl: videoFile.publicUrl(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };
  await db.collection('vehicles').doc(vehicleId).set(docData);

  console.log(`Uploaded assets for ${vehicleId}`);
  console.log(docData);
}

async function main() {
  const [vehicleId, outputDir = 'dist/pipeline-output'] = process.argv.slice(2);
  if (!vehicleId) {
    console.error('Usage: node upload_to_firebase.js <vehicleId> [outputDir]');
    process.exit(1);
  }
  try {
    await uploadVehicleAssets(vehicleId, outputDir);
  } catch (err) {
    console.error('Error uploading assets:', err);
    process.exit(1);
  }
}

main();