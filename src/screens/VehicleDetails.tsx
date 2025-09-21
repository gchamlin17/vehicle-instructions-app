import React, { useEffect, useState, useCallback } from "react";
import { View, Text, FlatList } from "react-native";
import { getFirestore, collection, getDocs, doc, updateDoc, addDoc } from "firebase/firestore";
import { app } from "../firebase";
import YoutubeLinker from "../components/YoutubeLinker";
import FeatureChip from "../components/FeatureChip";

const db = getFirestore(app);

export default function VehicleDetails({ route }: any) {
  const { make, year, makeYearTitle } = route.params as { make: string; year: number; makeYearTitle: string };
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const contentPath = ["makes", make, "years", String(year), "content"] as const;
  const content = collection(db, ...contentPath);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(content);
      setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } finally {
      setLoading(false);
    }
  }, [make, year]);

  useEffect(() => { load(); }, [load]);

  const saveYoutube = async (id: string, newYoutubeId: string) => {
    await updateDoc(doc(db, ...contentPath, id), { youtubeId: newYoutubeId });
    await load();
  };

  const quickAdd = async () => {
    await addDoc(content, {
      title: "Getting started overview",
      feature: "Overview",
      type: "video",
      vehicleRef: { make, year },
      youtubeId: "",
      visibility: "public",
      createdAt: Date.now()
    });
    await load();
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: "bold", fontSize: 18 }}>{makeYearTitle}</Text>
      <Text style={{ color: "#666", marginBottom: 8 }}>Items: {items.length} {loading ? "(loading…)" : ""}</Text>

      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={<Text onPress={quickAdd} style={{ color: "#2563eb", marginBottom: 8 }}>+ Quick add “overview”</Text>}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 10, borderBottomWidth: 0.5, borderColor: "#eee" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontWeight: "600" }}>{item.title}</Text>
              {item.youtubeId ? (
                <View style={{ backgroundColor: "#e6ffed", borderColor: "#99e1b4", borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 12 }}>Video linked</Text>
                </View>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              <FeatureChip label={item.feature ?? "General"} />
              <FeatureChip label={item.type ?? "content"} />
            </View>
            <YoutubeLinker youtubeId={item.youtubeId} onSave={(newId) => saveYoutube(item.id, newId)} />
          </View>
        )}
      />
    </View>
  );
}