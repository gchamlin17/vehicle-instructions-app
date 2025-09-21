const functions = require("firebase-functions");
const admin = require("firebase-admin");
const textToSpeech = require("@google-cloud/text-to-speech");

try { admin.app(); } catch { admin.initializeApp(); }
const db = admin.firestore();
const storage = admin.storage();
const ttsClient = new textToSpeech.TextToSpeechClient();

/**
 * When manual text is created/updated:
 *  - If long enough, synthesize speech -> audios/<vehicleKey>/tts.mp3
 *  - Write metadata into /vehicles/<vehicleKey>/audio/tts
 */
exports.synthesizeTTSOnManual = functions.firestore
  .document("vehicles/{vehicleKey}/content/manual")
  .onWrite(async (change, context) => {
    const vehicleKey = context.params.vehicleKey;
    const after = change.after.exists ? change.after.data() : null;
    if (!after || !after.text) return;

    const text = String(after.text).trim();
    if (text.length < 200) { console.log("Manual text too short for TTS:", text.length); return; }

    const projectId = process.env.GCLOUD_PROJECT;
    const bucketName = `${projectId}.appspot.com`;
    const bucket = storage.bucket(bucketName);
    const outPath = `audios/${vehicleKey}/tts.mp3`;
    const outFile = bucket.file(outPath);

    console.log("TTS start:", vehicleKey, "bytes:", text.length);

    const request = {
      input: { text },
      // Choose a safe/neutral US English female; tweak as you like
      voice: { languageCode: "en-US", ssmlGender: "FEMALE", name: "en-US-Standard-F" },
      audioConfig: { audioEncoding: "MP3", speakingRate: 1.0, pitch: 0.0 }
    };

    const [response] = await ttsClient.synthesizeSpeech(request);
    if (!response.audioContent || !response.audioContent.length) {
      console.error("No audioContent from TTS");
      return;
    }

    await outFile.save(Buffer.from(response.audioContent, "base64"), {
      resumable: false,
      contentType: "audio/mpeg",
      metadata: { cacheControl: "public, max-age=3600" }
    });

    await db.collection("vehicles").doc(vehicleKey)
      .collection("audio").doc("tts")
      .set({
        gsUri: `gs://${bucketName}/${outPath}`,
        path: outPath,
        voice: request.voice,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

    console.log("TTS complete:", outPath);
  });
