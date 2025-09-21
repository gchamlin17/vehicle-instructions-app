import React, { useState } from "react";
import { View, Text, TextInput, Button, ScrollView } from "react-native";
import { db, keyToId } from "../firebase";
import { doc, getDoc } from "firebase/firestore";

export default function ManualViewer() {
  const [vehicleKey, setVehicleKey] = useState("honda/cr-v/2020/ex");
  const [text, setText] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const load = async () => {
    setErr(""); setText("");
    try {
      const id = keyToId(vehicleKey);
      const d = await getDoc(doc(db, "vehicles", id, "content", "manual"));
      if (!d.exists()) { setText("(no manual yet)"); return; }
      setText(String(d.data()?.text || ""));
    } catch (e:any) { setErr(e?.message || String(e)); }
  };

  return (
    <View style={{ padding: 16, gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Vehicle Manual</Text>
      <TextInput value={vehicleKey} onChangeText={setVehicleKey}
        placeholder="make/model/year/trim"
        style={{ borderWidth:1, borderColor:"#ccc", padding:10, borderRadius:8 }} />
      <Button title="Load manual" onPress={load} />
      {err ? <Text style={{ color: "red" }}>Error: {err}</Text> : null}
      <ScrollView style={{ maxHeight: 320, borderWidth:1, borderColor:"#eee", padding:10 }}>
        <Text>{text}</Text>
      </ScrollView>
    </View>
  );
}
