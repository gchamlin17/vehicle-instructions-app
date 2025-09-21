import React, { useState } from "react";
import { View, Text, Button, TextInput } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { ref, uploadBytesResumable } from "firebase/storage";
import { storage } from "../firebase";

export default function UploadManual() {
  const [vehicleKey, setVehicleKey] = useState("honda/cr-v/2020/ex");
  const [status, setStatus] = useState("");

  const pickAndUpload = async () => {
    setStatus("");
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/pdf","text/plain"], multiple: false
    });
    if (res.canceled || !res.assets?.[0]) return;

    const asset = res.assets[0];
    const uri = asset.uri;
    const name = asset.name || (uri.split("/").pop() ?? "manual.pdf");

    const blob = await (await fetch(uri)).blob();
    const path = `manuals/${vehicleKey.replace(/\//g, "~")}/${name}`;
    const fileRef = ref(storage, path);

    setStatus("Uploading…");
    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(fileRef, blob);
      task.on("state_changed", null, reject, () => resolve());
    });
    setStatus("Uploaded ✔ Backend will process in ~5–15s");
  };

  return (
    <View style={{ padding:16, gap:10 }}>
      <Text style={{ fontSize:18, fontWeight:"600" }}>Upload Manual (PDF/TXT)</Text>
      <TextInput value={vehicleKey} onChangeText={setVehicleKey}
        style={{ borderWidth:1, borderColor:"#ccc", padding:10, borderRadius:8 }} />
      <Button title="Pick & Upload" onPress={pickAndUpload} />
      {status ? <Text>{status}</Text> : null}
    </View>
  );
}

