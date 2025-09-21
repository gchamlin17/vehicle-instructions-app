const { onRequest } = require("firebase-functions/v2/https");
const { setGlobalOptions, onObjectFinalized, onMessagePublished } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const crypto = require("crypto");

setGlobalOptions({ region: "us-central1", maxInstances: 50 });
if (!admin.apps.length) admin.initializeApp();
const storage = admin.storage();

// Small logger
function log(obj){ try{ console.log(JSON.stringify(Object.assign({ts:Date.now()},obj))) }catch{ console.log(obj) } }

// Helpers
function parsePath(objectName) {
  // orgId/vehicleKey/...
  const parts = objectName.split("/");
  if (parts.length < 3) return null;
  const orgId = parts[0];
  const vehicleKey = parts[1] + (parts[2] ? "/" + parts[2] : "");
  // vehicleKey may itself be multi-part, e.g. "honda", "cr-v", "2020", "ex"
  // For manifest, we infer by scanning folders below orgId/
  return { orgId, vehicleRoot: parts.slice(0,4).join("/") }; // orgId/make/model/year (rough heuristic)
}

async function checksumFile(file) {
  // Stream SHA256 for reasonable sizes
  const [exists] = await file.exists();
  if (!exists) return null;
  return new Promise((resolve, reject)=>{
    const hash = crypto.createHash("sha256");
    file.createReadStream()
      .on("data", (d)=> hash.update(d))
      .on("error", reject)
      .on("end", ()=> resolve("sha256:"+hash.digest("hex")));
  });
}

async function listVehicleClips(bucket, orgId, vehicleKey) {
  // Expect layout: orgId/vehicleKey/videos/*.mp4 ; captions/*.vtt ; thumbnails optional
  const base = `${orgId}/${vehicleKey}`;
  const [videos] = await bucket.getFiles({ prefix: `${base}/videos/` });
  const [captions] = await bucket.getFiles({ prefix: `${base}/captions/` });
  const [thumbs] = await bucket.getFiles({ prefix: `${base}/videos/`, delimiter: undefined });

  const capIndex = new Map();
  for (const f of captions) {
    const name = f.name.split("/").pop().replace(/\.vtt$/i,"");
    capIndex.set(name, f.name);
  }
  const thumbIndex = new Map(); // if you later drop .jpg alongside mp4, same id.jpg
  for (const f of thumbs) {
    if (/\.(jpg|png)$/i.test(f.name)) {
      const baseId = f.name.split("/").pop().replace(/\.(jpg|png)$/i,"");
      thumbIndex.set(baseId, f.name);
    }
  }

  const clips = [];
  for (const vf of videos) {
    if (!/\.mp4$/i.test(vf.name)) continue;
    const id = vf.name.split("/").pop().replace(/\.mp4$/i,"");
    const cap = capIndex.get(id) || null;
    const thumb = thumbIndex.get(id) || null;
    const sum = await checksumFile(vf).catch(()=>null);
    clips.push({ id, title: id.replace(/[-_]/g," "), src: `videos/${id}.mp4`, thumb: thumb ? `videos/${id}.jpg` : null, caption: cap ? `captions/${id}.vtt` : null, checksum: sum });
  }
  clips.sort((a,b)=> a.id.localeCompare(b.id));
  return clips;
}

async function writeManifest(bucketName, orgId, vehicleKey) {
  const bucket = storage.bucket(bucketName);
  const clips = await listVehicleClips(bucket, orgId, vehicleKey);
  const manifest = {
    version: 1,
    orgId, vehicleKey,
    updatedAt: Date.now(),
    clips
  };
  const dest = bucket.file(`${orgId}/${vehicleKey}/manifests/videos.json`);
  await dest.save(Buffer.from(JSON.stringify(manifest, null, 2)), { contentType: "application/json", resumable: false });
  return { count: clips.length, path: dest.name };
}

// HTTP admin to rebuild: /rebuild?orgId=...&vehicleKey=...
exports.rebuild = onRequest(async (req, res) => {
  try {
    const bucketName = process.env.GCLOUD_PROJECT + ".appspot.com";
    const orgId = req.query.orgId;
    const vehicleKey = req.query.vehicleKey;
    if (!orgId || !vehicleKey) { res.status(400).json({error:"orgId and vehicleKey required"}); return; }
    const out = await writeManifest(bucketName, orgId, vehicleKey);
    log({event:"manifest.rebuild", orgId, vehicleKey, ...out});
    res.status(200).json({ok:true, ...out});
  } catch (e) {
    log({event:"manifest.rebuild.error", msg: e.message});
    res.status(500).json({ok:false, error:e.message});
  }
});

// Storage finalize → publish to Pub/Sub (ingest-uploaded)
exports.onUpload = onObjectFinalized(async (event) => {
  const { bucket, name, contentType } = event.data;
  if (!name) return;
  const parsed = parsePath(name);
  if (!parsed) return;
  // Heuristic: only enqueue for videos/captions area
  if (!/\/(videos|captions)\//i.test(name)) return;
  const parts = name.split("/");
  const orgId = parts[0];
  const vehicleKey = parts.slice(1,5).join("/"); // make/model/year/trim
  log({event:"upload.finalize", bucket, name, orgId, vehicleKey, contentType});
  // Publish to implicit topic by invoking the worker HTTP-style via Pub/Sub message:
  const message = { orgId, vehicleKey };
  // Use onMessagePublished topic; functions v2 auto-creates it on first deploy
  const { PubSub } = require("@google-cloud/pubsub");
  const pubsub = new PubSub();
  await pubsub.topic("ingest-uploaded").publishMessage({ json: message });
});

// Worker: Pub/Sub "ingest-uploaded" → (re)write manifest
exports.ingestWorker = onMessagePublished("ingest-uploaded", async (event) => {
  const bucketName = process.env.GCLOUD_PROJECT + ".appspot.com";
  const data = event.data?.message?.json || event.data?.message?.data || {};
  const orgId = data.orgId, vehicleKey = data.vehicleKey;
  if (!orgId || !vehicleKey) { log({event:"ingest.skip", reason:"missing fields"}); return; }
  const out = await writeManifest(bucketName, orgId, vehicleKey).catch(e=>({error:e.message}));
  log({event:"ingest.manifest.write", orgId, vehicleKey, ...out});
});