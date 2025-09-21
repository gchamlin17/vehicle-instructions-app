/**
 * Cloud Function to process vehicle manuals uploaded to Firebase Storage.
 *
 * This function triggers whenever a new PDF is uploaded into the
 * `manuals/` folder of your default Firebase Storage bucket. It uses
 * a Python script to generate a narration script, audio and video from
 * the manual and then uploads those assets back to Storage and writes
 * a Firestore document.  The heavy lifting is delegated to the
 * `scripts/pipeline.py` and `scripts/upload_to_firebase.js` scripts
 * located in the root of your repository.
 *
 * To deploy this function, install the Firebase CLI and run
 * `firebase deploy --only functions:processManual`.  Ensure your
 * service account JSON is available at `keys/admin.json` and that
 * environment variables such as DEFAULT_IMAGE_PATH, FIREBASE_STORAGE_BUCKET
 * and PIPLINE_ROOT are set in your Firebase project configuration.
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { exec } = require('child_process');
const path = require('path');

// Initialize the Admin SDK. When running inside Cloud Functions the
// default credentials will be used. Locally you may need to provide
// your service account key via GOOGLE_APPLICATION_CREDENTIALS.
admin.initializeApp();

/**
 * Triggered when a PDF is uploaded to the `manuals/` path in the
 * default bucket.  Runs the content pipeline and uploads the results.
 */
exports.processManual = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name || '';
  // Only process PDFs uploaded into the manuals folder
  if (!filePath.startsWith('manuals/') || !filePath.endsWith('.pdf')) {
    console.log(`Ignoring ${filePath}`);
    return null;
  }

  const bucket = admin.storage().bucket(object.bucket);
  const fileName = path.basename(filePath); // e.g. camry-2025.pdf
  const vehicleId = fileName.replace(/\.pdf$/i, '');

  // Download the PDF to a temporary location inside the Cloud Function
  const tempPdfPath = `/tmp/${fileName}`;
  await bucket.file(filePath).download({ destination: tempPdfPath });
  console.log(`Downloaded ${filePath} to ${tempPdfPath}`);

  // Prepare output directory in /tmp
  const outputDir = `/tmp/${vehicleId}`;
  // Ensure the directory exists
  const fs = require('fs');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Image to use for video: use DEFAULT_IMAGE_PATH environment variable or a
  // fallback image stored in Storage.  You can upload a default image to
  // Storage at `defaults/dashboard.jpg` and set DEFAULT_IMAGE_PATH to
  // `/tmp/default_dashboard.jpg` after downloading it in a separate init step.
  const defaultImage = process.env.DEFAULT_IMAGE_PATH || '';
  if (!defaultImage) {
    console.warn('DEFAULT_IMAGE_PATH is not set; video generation may fail');
  }

  // Define commands to run the pipeline and upload scripts.  PIPLINE_ROOT
  // points to the root of your repository (containing the scripts folder).
  const repoRoot = process.env.PIPLINE_ROOT || '/workspace';
  const pipelineCmd = `python3 scripts/pipeline.py --pdf "${tempPdfPath}" --image "${defaultImage}" --output "${outputDir}" --vehicle "${vehicleId}"`;
  const uploadCmd = `node scripts/upload_to_firebase.js ${vehicleId} ${outputDir}`;

  // Helper to promisify child_process.exec
  function execPromise(command, cwd) {
    return new Promise((resolve, reject) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          console.error(stderr);
          return reject(error);
        }
        console.log(stdout);
        resolve();
      });
    });
  }

  try {
    // Run the content pipeline
    console.log(`Running pipeline for ${vehicleId}`);
    await execPromise(pipelineCmd, repoRoot);
    console.log(`Pipeline complete for ${vehicleId}`);

    // Upload the generated assets and write Firestore document
    console.log(`Uploading assets for ${vehicleId}`);
    await execPromise(uploadCmd, repoRoot);
    console.log(`Upload complete for ${vehicleId}`);
  } catch (err) {
    console.error('Error processing manual:', err);
    throw err;
  }

  return null;
});