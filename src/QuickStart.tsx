import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, FlatList, TextInput } from "react-native";
import { getFirestore, doc, collection, getDocs, query, orderBy, setDoc } from "firebase/firestore";
import { app } from "./firebase";
import YT from "./components/YouTube";

type Item = { id: string; title: string; order?: number; youtubeId?: string };
type Props = { make: string; year: number; visible: boolean; onClose?: () => void };

export default function QuickStart({ make, year, visible, onClose }: Props) {
  const db = getFirestore(app);
  const [items, setItems] = useState<Item[]>([]);
  const [yt, setYt] = useState<string>("");

  const load = async () => {
    const col = collection(db, "makes", make, "years", String(year), "content");
    const snap = await getDocs(query(col, orderBy("order")));
    setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  };
  useEffect(() => { if (visible) load(); }, [visible, make, year]);

  const saveYt = async (id: string) => {
    const target = doc(db, "makes", make, "years", String(year), "content", id);
    await setDoc(target, { youtubeId: yt.trim() }, { merge: true });
    setYt("");
    load();
  };

  const renderItem = ({ item }: { item: Item }) => (
    <View style={{ paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#eee" }}>
      <Text style={{ fontWeight: "700", marginBottom: 6 }}>{item.title}</Text>
      <YT videoId={item.youtubeId} />
      <View style={{ marginTop: 10, gap: 8 }}>
        <TextInput
          placeholder="YouTube ID (11 chars) or full URL"
          value={yt}
          onChangeText={setYt}
          style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 10 }}
        />
        <TouchableOpacity onPress={() => saveYt(item.id)} style={{ backgroundColor: "#1d4ed8", padding: 10, borderRadius: 8 }}>
          <Text style={{ color: "white", textAlign: "center", fontWeight: "600" }}>Save YouTube ID</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <View style={{ padding: 16, paddingBottom: 8, borderBottomColor: "#eee", borderBottomWidth: 1 }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>Quick Start · {make} {year}</Text>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 10, alignSelf: "flex-start" }}>
          <Text style={{ color: "#1d4ed8" }}>Close</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={<Text style={{ padding: 16, color: "#666" }}>No quick-start items yet.</Text>}
      />
    </View>
  );
}