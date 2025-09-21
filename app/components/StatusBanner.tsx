import React, { useState } from "react";
import { View, Text, Button } from "react-native";
import { firebaseConfig, db } from "../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

export default function StatusBanner() {
  const [msg, setMsg] = useState<string>("");

  const doPing = async () => {
    try {
      setMsg("Pinging Firestore…");
      const ref = doc(db, "_vi_ping", "web");
      await setDoc(ref, { ok: true, ts: serverTimestamp() }, { merge: true });
      const snap = await getDoc(ref);
      setMsg(snap.exists() ? "✅ Firestore OK" : "❌ Ping doc not found");
    } catch (e:any) {
      setMsg("❌ " + (e.message || e.toString()));
    }
  };

  return (
    <View style={{ padding: 10, backgroundColor: "#eef", borderBottomWidth: 1, borderColor: "#ccd", gap: 6 }}>
      <Text>projectId: {firebaseConfig.projectId}</Text>
      <Text>bucket: {firebaseConfig.storageBucket}</Text>
      <Button title="Ping Firestore" onPress={doPing} />
      {msg ? <Text>{msg}</Text> : null}
    </View>
  );
}
