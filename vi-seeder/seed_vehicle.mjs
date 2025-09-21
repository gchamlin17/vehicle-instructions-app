import fs from "fs/promises";
import process from "process";
import admin from "firebase-admin";

const arg = (name, fallback) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  return hit.slice(name.length + 3);
};

// vehicleKey can contain slashes (e.g., "honda/cr-v/2020/ex")
const vehicleKey = arg("vehicleKey", "honda/cr-v/2020/ex");

// Convert to a Firestore-safe document id (no slashes)
const toDocId = (key) => key.replace(/\//g, "__");    // "honda__cr-v__2020__ex"
const docId = toDocId(vehicleKey);

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credsPath) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS not set.");
  console.error('   PowerShell: $env:GOOGLE_APPLICATION_CREDENTIALS="C:\\keys\\admin.json"');
  process.exit(1);
}

let serviceAccount;
try {
  const raw = await fs.readFile(credsPath, "utf8");
  serviceAccount = JSON.parse(raw);
} catch (e) {
  console.error(`❌ Failed to read service account JSON at: ${credsPath}`);
  console.error(e);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});
const db = admin.firestore();

const payload = {
  vehicleKey, // keep original key for display
  make: "Honda",
  model: "CR-V",
  year: 2020,
  trim: "EX",
  media: { heroImage: "", videos: [] },
  features: [
    {
      featureId: "bluetooth_pairing",
      name: "Pair Bluetooth",
      category: "infotainment",
      steps: [
        "On the display audio, tap Home > Settings > Bluetooth.",
        "On your phone, open Bluetooth and select 'Honda CR-V'.",
        "Verify the pairing code matches and confirm on both devices."
      ],
      notes: "Some iPhones prompt to allow contacts sync."
    },
    {
      featureId: "tpms_reset",
      name: "Reset Tire Pressure (TPMS)",
      category: "safety",
      steps: [
        "Turn ignition to ON.",
        "On the display, tap Menu > Vehicle Settings.",
        "Select TPMS Calibration > Calibrate and confirm."
      ]
    }
  ],
  updatedAt: Math.floor(Date.now() / 1000)
};

const docPath = `vehicles/${docId}`;
try {
  await db.doc(docPath).set(payload, { merge: true });
  console.log(`✅ Seeded ${docPath} (from key: ${vehicleKey})`);
  process.exit(0);
} catch (e) {
  console.error(`❌ Failed to seed ${docPath}`);
  console.error(e);
  process.exit(1);
}