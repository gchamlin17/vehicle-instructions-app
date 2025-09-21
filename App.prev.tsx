import React, { useEffect, useState, useCallback } from "react";
import { SafeAreaView, View, Text, TextInput, Button, FlatList, TouchableOpacity, Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { app } from "./src/firebase";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, getDocs, addDoc } from "firebase/firestore";

type Vehicle = { id: string; make: string; year: number; model?: string };
type ContentItem = { id: string; title: string; feature?: string; type?: string; youtubeId?: string; vehicleRef?: any };

const db = getFirestore(app);
const auth = getAuth(app);

// Namespaced collection helpers
const vehiclesCol = (make: string, year: number) =>
  collection(db, "makes", make, "years", String(year), "vehicles");
const contentCol = (make: string, year: number) =>
  collection(db, "makes", make, "years", String(year), "content");

export default function App() {
  const [ready, setReady] = useState(false);
  const [userUid, setUserUid] = useState<string | null>(null);

  const [make, setMake] = useState("Honda");
  const [year, setYear] = useState("2021");

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) await signInAnonymously(auth);
      setUserUid(u?.uid ?? null);
      setReady(true);
    });
    return () => unsub();
  }, []);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(vehiclesCol(make, Number(year)));
      setVehicles(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } finally {
      setLoading(false);
    }
  }, [make, year]);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(contentCol(make, Number(year)));
      setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } finally {
      setLoading(false);
    }
  }, [make, year]);

  const addPlaceholder = useCallback(async () => {
    await addDoc(contentCol(make, Number(year)), {
      title: "How to pair Bluetooth",
      feature: "Bluetooth",
      type: "video",
      vehicleRef: { make, year: Number(year) },
      youtubeId: "", // blank until you paste one
      visibility: "public",
      createdAt: Date.now()
    });
    await loadItems();
  }, [make, year, loadItems]);

  useEffect(() => {
    if (ready) { loadVehicles(); loadItems(); }
  }, [ready, loadVehicles, loadItems]);

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <StatusBar style="auto" />
      <Text style={{ fontWeight: "bold", fontSize: 18 }}>Vehicle Instructions (namespaced)</Text>
      <Text style={{ marginTop: 6, marginBottom: 10 }}>
        Signed in: {(userUid ?? "anon").slice(0,8)} | Vehicles: {vehicles.length} | Items: {items.length}
        {loading ? " (loading…)" : ""}
      </Text>

      <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <TextInput
          value={make}
          onChangeText={setMake}
          placeholder="Make"
          style={{ borderWidth: 1, padding: 8, minWidth: 120 }}
        />
        <TextInput
          value={year}
          onChangeText={setYear}
          placeholder="Year"
          keyboardType={Platform.OS === "web" ? "text" : "number-pad"}
          style={{ borderWidth: 1, padding: 8, minWidth: 100 }}
        />
        <Button title="Reload" onPress={() => { loadVehicles(); loadItems(); }} />
        <Button title="Add placeholder" onPress={addPlaceholder} />
      </View>

      <Text style={{ fontWeight: "bold", marginTop: 8 }}>Vehicles</Text>
      <FlatList
        data={vehicles}
        keyExtractor={(v) => v.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 6 }}>
            <Text>{item.year} {item.make} {item.model ?? ""}</Text>
          </View>
        )}
        style={{ maxHeight: 160, borderTopWidth: 1, marginBottom: 12 }}
      />

      <Text style={{ fontWeight: "bold" }}>Content</Text>
      <FlatList
        data={items}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderColor: "#ddd" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={{ fontWeight: "600" }}>{item.title}</Text>
              {!!item.youtubeId && (
                <View style={{ backgroundColor: "#e6ffed", borderColor: "#99e1b4", borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                  <Text style={{ fontSize: 12 }}>Video linked</Text>
                </View>
              )}
            </View>
            <Text style={{ color: "#666" }}>
              {item.feature ?? "General"} • {item.type ?? "content"}
            </Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}