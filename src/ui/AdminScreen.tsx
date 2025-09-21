import React, { useEffect, useState } from "react";
import { Modal, View, Text, TextInput, Pressable, Platform, ScrollView, Alert } from "react-native";
import { app } from "../firebase";
import { getFirestore, doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, addDoc, collection } from "firebase/firestore";

const db = getFirestore(app);

export default function AdminScreen({
  visible, onClose, isOwner, editorEmails, refreshWhitelist
}: {
  visible: boolean;
  onClose: () => void;
  isOwner: boolean;
  editorEmails: string[];
  refreshWhitelist: () => Promise<void>;
}) {
  const [newEmail, setNewEmail] = useState("");
  const [vehCsv, setVehCsv] = useState("");
  const [contentCsv, setContentCsv] = useState("");

  useEffect(() => { /* noop for now */ }, []);

  async function addEditor() {
    if (!isOwner || !newEmail.trim()) return;
    const ref = doc(db, "config", "whitelist");
    const snap = await getDoc(ref);
    if (snap.exists()) await updateDoc(ref, { emails: arrayUnion(newEmail.trim()) });
    else await setDoc(ref, { emails: [newEmail.trim()] });
    setNewEmail("");
    await refreshWhitelist();
  }

  async function removeEditor(email: string) {
    if (!isOwner) return;
    const ref = doc(db, "config", "whitelist");
    await updateDoc(ref, { emails: arrayRemove(email) });
    await refreshWhitelist();
  }

  // very small CSV parser (comma split, quoted commas not supported)
  function parseCsv(csv: string): string[][] {
    return csv
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => l.split(",").map(s => s.trim()));
  }

  async function importVehicles() {
    const rows = parseCsv(vehCsv);
    if (!rows.length) return;
    const [h, ...rest] = rows;
    const hi = h.map(s => s.toLowerCase());
    const yi = hi.indexOf("year"), mi = hi.indexOf("make"), modi = hi.indexOf("model"), ti = hi.indexOf("type");
    for (const r of rest) {
      const year = Number(r[yi]); const make = r[mi]; const model = modi >= 0 ? r[modi] : null; const type = ti >= 0 ? r[ti] : null;
      if (!year || !make) continue;
      await addDoc(collection(db, "vehicles"), { year, make, model, type });
    }
    Alert.alert("Vehicles import", `Imported ${rest.length} rows`);
    setVehCsv("");
  }

  async function importContent() {
    const rows = parseCsv(contentCsv);
    if (!rows.length) return;
    const [h, ...rest] = rows;
    const hi = h.map(s => s.toLowerCase());
    const ti = hi.indexOf("title"), fi = hi.indexOf("feature"), yi = hi.indexOf("year"), mi = hi.indexOf("make"), yiid = hi.indexOf("youtubeid"), visi = hi.indexOf("visibility");
    for (const r of rest) {
      const title = r[ti]; const feature = r[fi]; const year = Number(r[yi]); const make = r[mi];
      const youtubeId = yiid >= 0 && r[yiid] ? r[yiid] : null;
      const visibility = (visi >= 0 ? (r[visi] || "public") : "public") as "public"|"private";
      if (!title || !feature || !year || !make) continue;
      await addDoc(collection(db, "contentItems"), {
        title, feature, type:"video", visibility, youtubeId, vehicleRef:{ year, make }, createdAt: Date.now()
      } as any);
    }
    Alert.alert("Content import", `Imported ${rest.length} rows`);
    setContentCsv("");
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, paddingTop: Platform.OS === "ios" ? 52 : 24, paddingHorizontal: 14 }}>
        <Text style={{ fontSize:20, fontWeight:"700", marginBottom:10 }}>Admin</Text>

        <Text style={{ fontWeight:"700", marginBottom:6 }}>Editors ({editorEmails.length})</Text>
        {editorEmails.map(e => (
          <View key={e} style={{ flexDirection:"row", alignItems:"center", marginBottom:6 }}>
            <Text style={{ flex:1 }}>{e}</Text>
            {isOwner ? (
              <Pressable onPress={()=>removeEditor(e)} style={{ backgroundColor:"#c23", padding:8, borderRadius:6 }}>
                <Text style={{ color:"#fff", fontWeight:"700" }}>REMOVE</Text>
              </Pressable>
            ) : null}
          </View>
        ))}

        {isOwner ? (
          <View style={{ borderWidth:1, borderColor:"#ddd", borderRadius:8, padding:10, marginTop:10, marginBottom:18 }}>
            <Text style={{ fontWeight:"700", marginBottom:6 }}>Add editor email</Text>
            <TextInput value={newEmail} onChangeText={setNewEmail} autoCapitalize="none"
              placeholder="name@example.com" style={{ borderWidth:1, borderColor:"#ccc", padding:8, borderRadius:6, marginBottom:8 }}/>
            <Pressable onPress={addEditor} style={{ backgroundColor:"#0a84ff", padding:10, borderRadius:6, alignSelf:"flex-start" }}>
              <Text style={{ color:"#fff", fontWeight:"700" }}>ADD EDITOR</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={{ fontWeight:"700", marginBottom:6 }}>Bulk import vehicles (CSV)</Text>
        <Text style={{ color:"#666", marginBottom:6 }}>Header: year,make,model,type</Text>
        <TextInput value={vehCsv} onChangeText={setVehCsv} multiline numberOfLines={8}
          placeholder="2024,Ford,F-150,Truck\n2024,Toyota,RAV4,SUV"
          style={{ borderWidth:1, borderColor:"#ccc", padding:8, borderRadius:6, minHeight:120, marginBottom:8 }}/>
        <Pressable onPress={importVehicles} style={{ backgroundColor:"#0a84ff", padding:10, borderRadius:6, alignSelf:"flex-start", marginBottom:18 }}>
          <Text style={{ color:"#fff", fontWeight:"700" }}>IMPORT VEHICLES</Text>
        </Pressable>

        <Text style={{ fontWeight:"700", marginBottom:6 }}>Bulk import content (CSV)</Text>
        <Text style={{ color:"#666", marginBottom:6 }}>Header: title,feature,year,make,youtubeId,visibility</Text>
        <TextInput value={contentCsv} onChangeText={setContentCsv} multiline numberOfLines={8}
          placeholder="How to pair Bluetooth,Bluetooth,2024,Ford,,public"
          style={{ borderWidth:1, borderColor:"#ccc", padding:8, borderRadius:6, minHeight:120, marginBottom:8 }}/>
        <Pressable onPress={importContent} style={{ backgroundColor:"#0a84ff", padding:10, borderRadius:6, alignSelf:"flex-start", marginBottom:18 }}>
          <Text style={{ color:"#fff", fontWeight:"700" }}>IMPORT CONTENT</Text>
        </Pressable>

        <Pressable onPress={onClose} style={{ backgroundColor:"#555", padding:10, borderRadius:6, alignSelf:"flex-start", marginBottom:24 }}>
          <Text style={{ color:"#fff", fontWeight:"700" }}>CLOSE</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}