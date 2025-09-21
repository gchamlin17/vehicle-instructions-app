import React, { useMemo, useState } from "react";
import { Modal, View, Text, FlatList, TextInput, Pressable, Platform } from "react-native";
import YoutubeIframe from "react-native-youtube-iframe";
import { getFirestore, addDoc, collection, setDoc, doc } from "firebase/firestore";
import { app } from "../firebase";
import { parseYoutubeId } from "../utils/youtube";

const db = getFirestore(app);

type Item = {
  id?: string;
  title: string;
  feature: string;
  youtubeId?: string | null;
  visibility: "public" | "private";
  type: "video";
  vehicleRef: { year: number; make: string };
};

export default function VehicleDetails({
  visible, onClose, make, year, items, canEdit
}: {
  visible: boolean;
  onClose: () => void;
  make: string;
  year: number;
  items: Item[];
  canEdit: boolean;
}) {
  const [title, setTitle] = useState("");
  const [feature, setFeature] = useState("Bluetooth");
  const [yt, setYt] = useState("");

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const key = it.feature || "Other";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [items]);

  async function quickAdd() {
    if (!canEdit) return;
    const youtubeId = parseYoutubeId(yt);
    const payload: Item = {
      title: title.trim() || `${feature} – ${make} ${year}`,
      feature,
      type: "video",
      visibility: "public",
      youtubeId: youtubeId ?? null,
      vehicleRef: { make, year }
    };
    const ref = await addDoc(collection(db, "contentItems"), payload as any);
    // also patch the ID in case we need it later
    await setDoc(doc(db, "contentItems", ref.id), { id: ref.id }, { merge: true });
    setTitle("");
    setFeature("Bluetooth");
    setYt("");
  }

  function Section({ label, data }: { label: string; data: Item[] }) {
    return (
      <View style={{ marginBottom: 18 }}>
        <Text style={{ fontWeight: "700", marginBottom: 6 }}>{label} ({data.length})</Text>
        {data.map((it) => (
          <View key={(it.id || it.title) + label} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" }}>
            <Text style={{ fontWeight: "600" }}>{it.title}</Text>
            <Text style={{ color: it.youtubeId ? "#0a84ff" : "#666" }}>
              {it.feature} · {make} {year}{it.youtubeId ? "  •  🎬 Video linked" : ""}
            </Text>
            {it.youtubeId ? (
              <View style={{ height: 210, marginTop: 8, backgroundColor: "#000" }}>
                <YoutubeIframe height={210} videoId={it.youtubeId} />
              </View>
            ) : null}
          </View>
        ))}
      </View>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, paddingTop: Platform.OS === "ios" ? 52 : 24, paddingHorizontal: 14 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 6 }}>{make} {year} · Details</Text>

        {/* Quick add */}
        <View style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <Text style={{ fontWeight: "700", marginBottom: 6 }}>Quick add video</Text>
          <Text>Title</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="e.g., How to pair Bluetooth"
            style={{ borderWidth:1, borderColor:"#ccc", padding:8, borderRadius:6, marginBottom:8 }}/>
          <Text>Feature</Text>
          <TextInput value={feature} onChangeText={setFeature} placeholder="e.g., Bluetooth"
            style={{ borderWidth:1, borderColor:"#ccc", padding:8, borderRadius:6, marginBottom:8 }}/>
          <Text>YouTube URL or ID (optional)</Text>
          <TextInput value={yt} onChangeText={setYt} placeholder="https://youtu.be/... or 11-char ID"
            autoCapitalize="none"
            style={{ borderWidth:1, borderColor:"#ccc", padding:8, borderRadius:6, marginBottom:10 }}/>
          <Pressable onPress={quickAdd} disabled={!canEdit}
            style={{ backgroundColor: canEdit ? "#0a84ff" : "#888", padding:10, borderRadius:6, alignSelf:"flex-start" }}>
            <Text style={{ color:"#fff", fontWeight:"700" }}>ADD</Text>
          </Pressable>
        </View>

        {/* Groups */}
        <FlatList
          data={grouped}
          keyExtractor={([label]) => label}
          renderItem={({ item: [label, data] }) => <Section label={label} data={data} />}
          ListEmptyComponent={<Text style={{ marginTop: 24, color: "#666" }}>No items yet for this vehicle.</Text>}
        />

        <Pressable onPress={onClose} style={{ backgroundColor:"#555", padding:10, borderRadius:6, marginVertical:12, alignSelf:"flex-start" }}>
          <Text style={{ color:"#fff", fontWeight:"700" }}>CLOSE</Text>
        </Pressable>
      </View>
    </Modal>
  );
}