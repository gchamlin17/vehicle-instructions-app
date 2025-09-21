import React, { useEffect, useMemo, useState } from "react";
import { View, Text, FlatList, Pressable, Modal, TextInput, Platform } from "react-native";
import { app } from "./src/firebase";
import { getAuth, signInAnonymously, onAuthStateChanged, signOut, signInWithEmailAndPassword, User } from "firebase/auth";
import { getFirestore, collection, getDocs, addDoc, doc, setDoc, query, where, deleteDoc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import VehicleDetails from "./src/ui/VehicleDetails";
import AdminScreen from "./src/ui/AdminScreen";

type Vehicle = { year: number; make: string; model?: string; type?: string; key?: string; };
type ContentItem = { id: string; title: string; feature: string; type: "video"; visibility: "public"|"private"; youtubeId?: string | null; vehicleRef?: { year:number; make:string } };

const db = getFirestore(app);
const auth = getAuth(app);
const OWNER_EMAIL = "drivethisthing@gmail.com"; // change if needed

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [editorEmails, setEditorEmails] = useState<string[]>([]);
  const email = user?.email ?? null;
  const canEdit = !!(email && editorEmails.includes(email));

  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);

  // filters
  const [fYear, setFYear] = useState<number | undefined>();
  const [fMake, setFMake] = useState<string | undefined>();
  const [fFeature, setFFeature] = useState<string | undefined>();
  const [q, setQ] = useState("");

  // modals / picks
  const [adminOpen, setAdminOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);

  // editor login modal
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginErr, setLoginErr] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (!u) await signInAnonymously(auth);
      setUser(u ?? null);
      await Promise.all([loadAll(), loadWhitelist()]);
    });
    return () => unsub();
  }, []);

  async function loadWhitelist() {
    const snap = await getDoc(doc(db, "config", "whitelist"));
    setEditorEmails((snap.exists() ? (snap.data()?.emails ?? []) : []) as string[]);
  }

  async function loadAll() {
    setLoading(true);
    try {
      const vSnap = await getDocs(collection(db, "vehicles"));
      setVehicles(vSnap.docs.map(d => ({ key: d.id, ...(d.data() as any) })));
      const iSnap = await getDocs(query(collection(db, "contentItems"), where("visibility", "==", "public")));
      setItems(iSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })));
    } finally { setLoading(false); }
  }

  // counts & filters
  const yearCounts = useMemo(() => {
    const m = new Map<number, number>(); vehicles.forEach(v => m.set(v.year, (m.get(v.year) || 0) + 1));
    return Array.from(m.entries()).sort((a,b)=>b[0]-a[0]);
  }, [vehicles]);
  const makeCounts = useMemo(() => {
    const m = new Map<string, number>(); vehicles.forEach(v => m.set(v.make, (m.get(v.make) || 0) + 1));
    return Array.from(m.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
  }, [vehicles]);
  const featureCounts = useMemo(() => {
    const m = new Map<string, number>(); items.forEach(i => m.set(i.feature, (m.get(i.feature) || 0) + 1));
    return Array.from(m.entries()).sort((a,b)=>a[0].localeCompare(b[0]));
  }, [items]);

  const filtered = useMemo(() => {
    const qlc = q.trim().toLowerCase();
    return items.filter(i =>
      (!fYear || i.vehicleRef?.year === fYear) &&
      (!fMake || i.vehicleRef?.make === fMake) &&
      (!fFeature || i.feature === fFeature) &&
      (!qlc || i.title.toLowerCase().includes(qlc))
    );
  }, [items, fYear, fMake, fFeature, q]);

  function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
    return (
      <Pressable onPress={onPress}
        style={{ paddingVertical:8, paddingHorizontal:12, borderRadius:16, borderWidth:1, borderColor: active? "#0a84ff":"#ddd",
                 backgroundColor: active? "#e6f2ff":"#fff", marginRight:8, marginBottom:8 }}>
        <Text style={{ color: active? "#0a84ff":"#333" }}>{label}</Text>
      </Pressable>
    );
  }

  function Row({ item }: { item: ContentItem }) {
    const hasVid = !!item.youtubeId;
    return (
      <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#eee" }}>
        <Text style={{ fontWeight: "600" }}>{item.title}</Text>
        <Text style={{ color: hasVid ? "#0a84ff" : "#444" }}>
          {item.feature} · {item.vehicleRef?.make} {item.vehicleRef?.year}{hasVid ? "  •  🎬 Video linked" : ""}
        </Text>
      </View>
    );
  }

  // sample data helpers
  async function addSample() {
    if (!canEdit) return;
    await addDoc(collection(db, "contentItems"), {
      title:"How to pair Bluetooth", feature:"Bluetooth", type:"video", visibility:"public",
      youtubeId:null, vehicleRef:{ year:2021, make:"Honda" }, createdAt:Date.now(),
    });
    await loadAll();
  }
  async function seed5() {
    if (!canEdit) return;
    const rows = [
      ["Open fuel door","Fuel Door",2021,"Hyundai"],
      ["Use CarPlay","CarPlay",2019,"Subaru"],
      ["Reset maintenance light","Maintenance",2018,"Toyota"],
      ["Change clock time","Clock",2020,"Ford"],
      ["Pair Android Auto","Android Auto",2022,"Kia"],
    ] as const;
    for (const [title, feature, year, make] of rows) {
      await addDoc(collection(db, "contentItems"), {
        title, feature, type:"video", visibility:"public", youtubeId:null, vehicleRef:{ year, make }, createdAt:Date.now(),
      });
    }
    await loadAll();
  }
  async function clearAllContent() {
    if (!canEdit) return;
    const snap = await getDocs(collection(db, "contentItems"));
    await Promise.all(snap.docs.map(d => deleteDoc(doc(db, "contentItems", d.id))));
    await loadAll();
  }

  // editor login
  async function doLogin() {
    setLoginErr(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail.trim(), loginPass);
      setUser(cred.user);
      await loadWhitelist();
      setLoginOpen(false);
    } catch (e: any) { setLoginErr(String(e?.message ?? e)); }
  }
  async function doLogout() { await signOut(auth); }

  async function grantEditor() {
    if (!email || email !== OWNER_EMAIL) return;
    const ref = doc(db, "config", "whitelist");
    const snap = await getDoc(ref);
    if (snap.exists()) await updateDoc(ref, { emails: arrayUnion(email) });
    else await setDoc(ref, { emails: [email] });
    await loadWhitelist();
  }

  const [vdOpen, setVdOpen] = useState(false);
  function openVehicleDetails(v: Vehicle) {
    setSelectedVehicle(v);
    setVdOpen(true);
  }

  const itemsForSelected = useMemo(() =>
    selectedVehicle
      ? items.filter(i => i.vehicleRef?.make === selectedVehicle.make && i.vehicleRef?.year === selectedVehicle.year)
      : []
  , [items, selectedVehicle]);

  return (
    <View style={{ flex:1, paddingTop: Platform.OS === "ios" ? 52 : 24, paddingHorizontal: 14 }}>
      <Text style={{ fontSize:20, fontWeight:"700", marginBottom:8 }}>Vehicle Instructions · MVP</Text>

      <Text style={{ marginBottom:8 }}>
        {(email ? `Signed in: ${email}` : `Signed in: ${(user?.uid ?? "anon").slice(0,8)}`)}
        {" · "}Vehicles: {vehicles.length} · Items: {items.length}{loading ? " (loading…)" : ""}
        {email && !canEdit ? " · view-only (not editor)" : ""}
      </Text>

      {/* toolbar */}
      <View style={{ flexDirection:"row", flexWrap:"wrap", marginBottom:10 }}>
        <Pressable onPress={loadAll} style={btn}><Text style={btnT}>RELOAD</Text></Pressable>
        <Pressable onPress={()=>setPickerOpen(true)} style={btn}><Text style={btnT}>VEHICLES</Text></Pressable>
        <Pressable onPress={()=>setAdminOpen(true)} style={btn}><Text style={btnT}>ADMIN</Text></Pressable>
        <Pressable disabled={!canEdit} onPress={addSample} style={[btn, !canEdit && btnDis]}><Text style={btnT}>ADD SAMPLE ITEM</Text></Pressable>
        <Pressable disabled={!canEdit} onPress={seed5} style={[btn, !canEdit && btnDis]}><Text style={btnT}>SEED 5 ITEMS</Text></Pressable>
        <Pressable disabled={!canEdit} onPress={clearAllContent} style={[btn, { backgroundColor:"#c23" }, !canEdit && btnDis]}><Text style={btnT}>CLEAR ALL</Text></Pressable>
        {!email
          ? <Pressable onPress={()=>setLoginOpen(true)} style={[btn, { backgroundColor:"#555" }]}><Text style={btnT}>EDITOR LOGIN</Text></Pressable>
          : <Pressable onPress={doLogout} style={[btn, { backgroundColor:"#555" }]}><Text style={btnT}>LOG OUT</Text></Pressable>}
        {email === OWNER_EMAIL && !canEdit
          ? <Pressable onPress={grantEditor} style={[btn, { backgroundColor:"#0c8a3e" }]}><Text style={btnT}>GRANT EDITOR</Text></Pressable>
          : null}
      </View>

      {/* search & chips */}
      <TextInput value={q} onChangeText={setQ} placeholder="Search titles…"
        style={{ borderWidth:1, borderColor:"#ddd", padding:10, borderRadius:6, marginBottom:10 }}/>
      <Text style={{ fontWeight:"600", marginTop:6 }}>Filter by Year</Text>
      <View style={{ flexDirection:"row", flexWrap:"wrap", marginVertical:6 }}>
        <Chip label={"All"} active={!fYear} onPress={()=>setFYear(undefined)} />
        {yearCounts.map(([y,n])=> <Chip key={y} label={`${y} (${n})`} active={fYear===y} onPress={()=>setFYear(fYear===y?undefined:y)} />)}
      </View>
      <Text style={{ fontWeight:"600", marginTop:6 }}>Filter by Make</Text>
      <View style={{ flexDirection:"row", flexWrap:"wrap", marginVertical:6 }}>
        <Chip label={"All"} active={!fMake} onPress={()=>setFMake(undefined)} />
        {makeCounts.map(([m,n])=> <Chip key={m} label={`${m} (${n})`} active={fMake===m} onPress={()=>setFMake(fMake===m?undefined:m)} />)}
      </View>
      <Text style={{ fontWeight:"600", marginTop:6 }}>Filter by Feature</Text>
      <View style={{ flexDirection:"row", flexWrap:"wrap", marginVertical:6 }}>
        <Chip label={"All"} active={!fFeature} onPress={()=>setFFeature(undefined)} />
        {featureCounts.map(([f,n])=> <Chip key={f} label={`${f} (${n})`} active={fFeature===f} onPress={()=>setFFeature(fFeature===f?undefined:f)} />)}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(it)=>it.id}
        renderItem={({item})=> <Row item={item} />}
        ListEmptyComponent={<Text style={{ marginTop:24, color:"#666" }}>No items match the current filters.</Text>}
      />

      {/* Vehicle picker */}
      <Modal visible={pickerOpen} animationType="slide" onRequestClose={()=>setPickerOpen(false)}>
        <View style={{ flex:1, paddingTop: Platform.OS === "ios" ? 52 : 24, paddingHorizontal: 14 }}>
          <Text style={{ fontSize:20, fontWeight:"700", marginBottom:8 }}>Vehicles</Text>
          <FlatList
            data={[...vehicles].sort((a,b)=> b.year - a.year || a.make.localeCompare(b.make))}
            keyExtractor={(v)=>v.key!}
            renderItem={({item:v})=> (
              <Pressable onPress={()=>{ setPickerOpen(false); openVehicleDetails(v); }}
                style={{ paddingVertical:12, borderBottomWidth:1, borderBottomColor:"#eee" }}>
                <Text style={{ fontWeight:"600" }}>{v.year} · {v.make} {v.model ?? ""}</Text>
                <Text style={{ color:"#666" }}>{v.type ?? ""}</Text>
              </Pressable>
            )}
            ListEmptyComponent={<Text style={{ marginTop:24, color:"#666" }}>No vehicles yet.</Text>}
          />
          <Pressable onPress={()=>setPickerOpen(false)} style={{ backgroundColor:"#555", padding:10, borderRadius:6, marginVertical:12, alignSelf:"flex-start" }}>
            <Text style={{ color:"#fff", fontWeight:"700" }}>CLOSE</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Vehicle details */}
      <VehicleDetails
        visible={vdOpen && !!selectedVehicle}
        onClose={()=>setVdOpen(false)}
        make={selectedVehicle?.make || ""}
        year={selectedVehicle?.year || 0}
        items={itemsForSelected as any}
        canEdit={canEdit}
      />

      {/* Admin */}
      <AdminScreen
        visible={adminOpen}
        onClose={()=>setAdminOpen(false)}
        isOwner={email === OWNER_EMAIL}
        editorEmails={editorEmails}
        refreshWhitelist={loadWhitelist}
      />

      {/* Editor login */}
      <Modal visible={loginOpen} animationType="slide" onRequestClose={()=>setLoginOpen(false)}>
        <View style={{ flex:1, padding:16 }}>
          <Text style={{ fontSize:20, fontWeight:"700", marginBottom:10 }}>Editor Login</Text>
          <Text>Email</Text>
          <TextInput value={loginEmail} onChangeText={setLoginEmail} autoCapitalize="none"
            style={{ borderWidth:1, borderColor:"#000", padding:10, borderRadius:4, marginBottom:10 }}/>
          <Text>Password</Text>
          <TextInput value={loginPass} onChangeText={setLoginPass} autoCapitalize="none" secureTextEntry
            style={{ borderWidth:1, borderColor:"#000", padding:10, borderRadius:4, marginBottom:10 }}/>
          {loginErr ? <Text style={{ color:"#c23", marginBottom:8 }}>{loginErr}</Text> : null}
          <Pressable onPress={doLogin} style={[btn]}><Text style={btnT}>SIGN IN</Text></Pressable>
          <Pressable onPress={()=>setLoginOpen(false)} style={[btn, { marginTop:10 }]}><Text style={btnT}>CANCEL</Text></Pressable>
        </View>
      </Modal>
    </View>
  );
}

const btn = { paddingVertical:10, paddingHorizontal:12, borderRadius:6, backgroundColor:"#0a84ff", marginRight:8, marginBottom:8 };
const btnT = { color:"#fff", fontWeight:"700" };
const btnDis = { opacity:0.4 };