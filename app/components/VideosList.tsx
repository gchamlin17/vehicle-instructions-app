import React, { useState } from "react";
import { View, Text, TextInput, Button, FlatList, ActivityIndicator } from "react-native";
import { db, storage, keyToId } from "../firebase";
import { collection, getDocs, query } from "firebase/firestore";
import { ref, getDownloadURL } from "firebase/storage";
import { Video } from "expo-av";

type Vid = { id: string; path: string; url?: string; title?: string };

export default function VideosList() {
  const [vehicleKey, setVehicleKey] = useState("honda/cr-v/2020/ex");
  const [items, setItems] = useState<Vid[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const load = async () => {
    setErr(""); setItems([]); setLoading(true);
    try {
      const flatId = keyToId(vehicleKey);
      const colRef = collection(db, "vehicles", flatId, "videos");
      const snap = await getDocs(query(colRef));
      const rows: Vid[] = [];
      for (const d of snap.docs) {
        const data: any = d.data() || {};
        if (!data.path) continue;
        const url = await getDownloadURL(ref(storage, data.path));
        rows.push({ id: d.id, path: data.path, url, title: data.title || d.id });
      }
      if (rows.length === 0) setErr("No videos for this vehicle yet.");
      setItems(rows);
    } catch (e:any) {
      setErr(e?.message || String(e));
      console.error("[VideosList] error:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ padding: 12, gap: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>Videos</Text>
      <TextInput value={vehicleKey} onChangeText={setVehicleKey}
        style={{ borderWidth:1, borderColor:"#ccc", padding:10, borderRadius:8 }} />
      <Button title={loading ? "Loading…" : "Load videos"} onPress={load} disabled={loading} />
      {loading ? <ActivityIndicator /> : null}
      {err ? <Text style={{ color:"red" }}>Error: {err}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(it) => it.id}
        renderItem={({ item }) => (
          <View style={{ marginTop: 12, gap: 6 }}>
            <Text style={{ fontWeight:"600" }}>{item.title}</Text>
            {item.url ? (
              <Video
                source={{ uri: item.url }}
                useNativeControls
                resizeMode="contain"
                style={{ width: "100%", height: 220, backgroundColor: "#000" }}
              />
            ) : <Text>(no url)</Text>}
          </View>
        )}
      />
    </View>
  );
}
