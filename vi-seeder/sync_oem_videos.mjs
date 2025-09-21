import process from "process";
import admin from "firebase-admin";
import fetch from "node-fetch";

// Args: --make Honda --channel UCxxxx --max 10
const arg = (name, fallback) => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const MAKE = arg("make", "Honda");
const CHANNEL_ID = arg("channel", "");
const MAX = parseInt(arg("max", "10"), 10);

if (!CHANNEL_ID) {
  console.error("❌ Missing --channel=UCxl79GCsb6 (YouTube Channel ID)");
  process.exit(1);
}

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error("❌ Missing env var YOUTUBE_API_KEY");
  process.exit(1);
}

const credsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credsPath) {
  console.error("❌ GOOGLE_APPLICATION_CREDENTIALS not set for Firebase Admin");
  process.exit(1);
}

// Init Firebase Admin if not already
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();

// Get the "Uploads" playlist for the channel
async function getUploadsPlaylistId(channelId) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`channels.list failed: ${res.status}`);
  const json = await res.json();
  const item = json.items?.[0];
  const uploads = item?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploads) throw new Error("No uploads playlist found for channel");
  return uploads;
}

// Fetch latest N videos
async function fetchLatest(playlistId, max = 10) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlistId}&maxResults=${Math.min(max,50)}&key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`playlistItems.list failed: ${res.status}`);
  const json = await res.json();
  return (json.items || []).map(it => {
    const s = it.snippet;
    const videoId = s?.resourceId?.videoId;
    return {
      videoId,
      title: s?.title,
      description: s?.description || "",
      publishedAt: s?.publishedAt,
      thumbnails: s?.thumbnails || {},
      source: "OEM",
      make: MAKE
    };
  }).filter(v => v.videoId);
}

async function main() {
  console.log(`🔎 Syncing latest ${MAX} videos for ${MAKE} from channel ${CHANNEL_ID}`);
  const uploads = await getUploadsPlaylistId(CHANNEL_ID);
  const videos = await fetchLatest(uploads, MAX);

  const batch = db.batch();
  const col = db.collection("oem_videos").doc(MAKE).collection("videos");
  videos.forEach(v => {
    const ref = col.doc(v.videoId);
    batch.set(ref, v, { merge: true });
  });
  await batch.commit();
  console.log(`✅ Wrote ${videos.length} videos to oem_videos/${MAKE}/videos`);
}

main().catch(err => {
  console.error("❌ Sync failed:", err);
  process.exit(1);
});