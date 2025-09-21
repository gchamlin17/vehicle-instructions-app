import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, FlatList, Modal, Platform } from "react-native";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { app } from "./src/firebase";
import SignIn, { signOutEverywhere } from "./src/auth/SignIn";
import AdminPanel from "./src/admin/AdminPanel";
import { useEditor } from "./src/hooks/useEditor";

type Vehicle = { id: string; make: string; year: number; model: string; title: string; youtubeId?: string | null };

export default function App() {
  const db = getFirestore(app);
  const auth = getAuth(app);

  const [make, setMake] = useState("Toyota");
  const [year, setYear] = useState(2022);
  const [items, setItems] = useState<Vehicle[]>([]);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);

  const { user, isEditor } = useEditor();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => { if (!u) await signInAnonymously(auth); });
    return () => unsub();
  }, []);

  async function reload() {
    const q = query(
      collection(db, `makes/${make}/years/${year}/vehicles`),
      orderBy("title", "asc")
    );
    const snap = await getDocs(q);
    setItems(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
  }

  useEffect(() => { reload(); }, [make, year]);

  return (
    <View style={{ flex: 1, padding: 16, gap: 12 }}>
      {/* Header */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 24, fontWeight: "700" }}>Vehicle Instructions</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {isEditor && (
            <Pressable onPress={() => setShowAdmin(true)} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }}>
              <Text>Admin</Text>
            </Pressable>
          )}
          {!user ? null : user.isAnonymous ? (
            <Pressable onPress={() => setShowSignIn(true)} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }}>
              <Text>Sign in</Text>
            </Pressable>
          ) : (
            <Pressable onPress={signOutEverywhere} style={{ borderWidth: 1, padding: 8, borderRadius: 8 }}>
              <Text>Sign out</Text>
            </Pressable>
          )}
        </View>
      </View>

      <Text>Make: {make}  |  Year: {year}  |  Vehicles: {items.length}</Text>

      {/* Simple chips – tap to change */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {["Audi","BMW","Chevrolet","Ford","GMC","Honda","Hyundai","Jeep","Nissan","Ram","Subaru","Tesla","Toyota"].map(m => (
          <Pressable key={m} onPress={() => setMake(m)}
            style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
                     backgroundColor: make===m ? "#10b981" : "#eee" }}>
            <Text style={{ color: make===m ? "white" : "#111" }}>{m}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[2022,2021,2020,2019].map(y => (
          <Pressable key={y} onPress={() => setYear(y)}
            style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
                     backgroundColor: year===y ? "#10b981" : "#eee" }}>
            <Text style={{ color: year===y ? "white" : "#111" }}>{y}</Text>
          </Pressable>
        ))}
        <Pressable onPress={reload} style={{ marginLeft: 8, backgroundColor: "#1e90ff", paddingHorizontal: 14, borderRadius: 8 }}>
          <Text style={{ color: "white", paddingVertical: 8, fontWeight: "600" }}>RELOAD</Text>
        </Pressable>
      </View>

      {/* Vehicle list */}
      <FlatList
        data={items}
        keyExtractor={(v) => v.id}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#eee" }} />}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 14, gap: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
            <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
              <View style={{ backgroundColor: "#eee", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 }}>
                <Text style={{ color: "#444" }}>{item.youtubeId ? "linked video" : "no video"}</Text>
              </View>
              <Text style={{ color: "#666" }}>Open details → link videos & features</Text>
            </View>
          </View>
        )}
      />

      {/* Modals */}
      <Modal visible={showSignIn} animationType="slide" onRequestClose={()=>setShowSignIn(false)}>
        <View style={{ flex: 1, paddingTop: Platform.OS === "web" ? 16 : 48 }}>
          <SignIn onClose={()=>setShowSignIn(false)} />
        </View>
      </Modal>

      <Modal visible={showAdmin && isEditor} animationType="slide" onRequestClose={()=>setShowAdmin(false)}>
        <View style={{ flex: 1, paddingTop: Platform.OS === "web" ? 16 : 48 }}>
          <AdminPanel make={make} year={year} onClose={()=>setShowAdmin(false)} />
        </View>
      </Modal>
    </View>
  );
}