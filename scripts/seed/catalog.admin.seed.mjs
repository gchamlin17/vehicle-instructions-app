import fs from "node:fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

const svc = JSON.parse(fs.readFileSync("./serviceAccount.json","utf8"));
initializeApp({ credential: cert(svc) });
const db = getFirestore();

const DATA = [
  { make:"Honda",  years:[2019,2020,2021,2022], models:["Civic","Accord","CR-V","Pilot"] },
  { make:"Toyota", years:[2019,2020,2021,2022], models:["Corolla","Camry","RAV4","Highlander"] },
  { make:"Ford",   years:[2019,2020,2021,2022], models:["F-150","Escape","Explorer","Bronco"] },
  { make:"Nissan", years:[2019,2020,2021,2022], models:["Sentra","Altima","Rogue","Frontier"] },
  { make:"Chevrolet", years:[2019,2020,2021,2022], models:["Silverado","Equinox","Traverse","Malibu"] },
];

function idFor(v) { return `${v.year}-${v.make}-${v.model}-${v.trim}`.replace(/\s+/g,"-"); }

async function seed() {
  const batch = db.batch();
  batch.set(db.doc("catalog/summary"), { updatedAt: FieldValue.serverTimestamp() }, { merge: true });

  for (const row of DATA) {
    // Top-level “catalog_makes”
    batch.set(db.doc(`catalog_makes/${row.make}`), { years: row.years });

    for (const year of row.years) {
      const coll = db.collection(`makes/${row.make}/years/${year}/vehicles`);
      for (const model of row.models) {
        for (const trim of ["Base","EX","LX"]) {
          const doc = coll.doc(idFor({ make:row.make, year, model, trim }));
          batch.set(doc, { make:row.make, year, model, trim });
        }
      }
    }
  }

  await batch.commit();
  console.log("Seeded catalog_makes and nested vehicles.");

  // add a tiny bit of video content (1 per make/year as example)
  for (const row of DATA) {
    for (const year of row.years.slice(0,2)) {
      await db.collection(`makes/${row.make}/years/${year}/content`).add({
        feature: "Bluetooth",
        type: "video",
        youtubeId: "dQw4w9WgXcQ",
        title: `${row.make} ${year} – Bluetooth Pairing`,
        visibility: "public",
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }
  console.log("Seeded a few example content items.");
}

seed().catch(e => { console.error(e); process.exit(1); });