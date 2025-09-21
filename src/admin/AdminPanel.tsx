import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { getFirestore, collection, query, getDocs, writeBatch, setDoc, doc, orderBy } from "firebase/firestore";

export default function AdminPanel({ make, year, onClose }:{ make:string; year:number; onClose?:()=>void }){
  const db = getFirestore(); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState<string|null>(null);
  const [yt,setYt]=useState("");

  async function seed(){
    setBusy(true); setMsg(null);
    try{
      const base = collection(db, `makes/${make}/years/${year}/vehicles`);
      const rows = [
        { model:"Base",    title:`${year} ${make} Sample Base` },
        { model:"EX",      title:`${year} ${make} Sample EX` },
        { model:"Touring", title:`${year} ${make} Sample Touring` },
      ];
      for(const r of rows){
        const id = r.title.toLowerCase().replace(/[^a-z0-9]+/g,"-");
        await setDoc(doc(base,id), { make, year, model:r.model, title:r.title });
      }
      setMsg(`Seeded ${rows.length}`);
    }catch(e:any){ setMsg(String(e.message||e)); } finally{ setBusy(false); }
  }
  async function stamp(){
    if(!yt.trim()){ setMsg("Enter YouTube ID"); return; }
    setBusy(true); setMsg(null);
    try{
      const q = query(collection(db, `makes/${make}/years/${year}/vehicles`), orderBy("title","asc"));
      const s = await getDocs(q); const b = writeBatch(db);
      s.forEach(d => b.update(d.ref, { youtubeId: yt.trim() }));
      await b.commit(); setMsg(`Stamped ${s.size} docs`);
    }catch(e:any){ setMsg(String(e.message||e)); } finally{ setBusy(false); }
  }
  async function clearV(){
    setBusy(true); setMsg(null);
    try{
      const q = query(collection(db, `makes/${make}/years/${year}/vehicles`), orderBy("title","asc"));
      const s = await getDocs(q); const b = writeBatch(db);
      s.forEach(d => b.update(d.ref, { youtubeId: null }));
      await b.commit(); setMsg(`Cleared ${s.size} docs`);
    }catch(e:any){ setMsg(String(e.message||e)); } finally{ setBusy(false); }
  }

  return (
    <View style={{ padding:16, gap:10 }}>
      <Text style={{ fontSize:18, fontWeight:"700" }}>Admin tools</Text>
      <Text>{make} {year}</Text>
      <Pressable onPress={seed} disabled={busy} style={{ backgroundColor:"#1e90ff", padding:10, borderRadius:8 }}>
        <Text style={{ color:"white", fontWeight:"600" }}>Seed 3 sample vehicles</Text>
      </Pressable>
      <TextInput placeholder="YouTube ID" value={yt} onChangeText={setYt}
        autoCapitalize="none" style={{ borderWidth:1, padding:10, borderRadius:8 }} />
      <Pressable onPress={stamp} disabled={busy} style={{ backgroundColor:"#16a34a", padding:10, borderRadius:8 }}>
        <Text style={{ color:"white", fontWeight:"600" }}>Bulk set video</Text>
      </Pressable>
      <Pressable onPress={clearV} disabled={busy} style={{ backgroundColor:"#b91c1c", padding:10, borderRadius:8 }}>
        <Text style={{ color:"white", fontWeight:"600" }}>Clear videos</Text>
      </Pressable>
      {!!msg && <Text>{msg}</Text>}
      <Pressable onPress={onClose} style={{ borderWidth:1, padding:10, borderRadius:8 }}><Text>Close</Text></Pressable>
    </View>
  );
}