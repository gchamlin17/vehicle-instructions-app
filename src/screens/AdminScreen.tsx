import React, { useEffect, useState } from "react";
import { View, Text, TextInput, Button, FlatList, TouchableOpacity, Alert } from "react-native";
import { app } from "../firebase";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, deleteDoc } from "firebase/firestore";

const db = getFirestore(app);

export default function AdminScreen() {
  // Whitelist (config/whitelist: { emails: [] })
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");

  // Editor scopes (editorScopes/{email}: { allowedMakes: [] })
  const [scopes, setScopes] = useState<{ email: string; allowedMakes: string[] }[]>([]);
  const [scopeEmail, setScopeEmail] = useState("");
  const [scopeMake, setScopeMake] = useState("");

  const load = async () => {
    // whitelist
    const wref = doc(db, "config", "whitelist");
    const w = await getDoc(wref);
    setEmails((w.data()?.emails ?? []) as string[]);

    // scopes
    const sref = collection(db, "editorScopes");
    const s = await getDocs(sref);
    setScopes(s.docs.map(d => ({ email: d.id, ...(d.data() as any) })));
  };

  useEffect(() => { load(); }, []);

  const addEmail = async () => {
    const list = Array.from(new Set([...(emails||[]), newEmail.trim()].filter(Boolean)));
    await setDoc(doc(db, "config", "whitelist"), { emails: list }, { merge: true });
    setNewEmail("");
    await load();
  };

  const removeEmail = async (email: string) => {
    const list = (emails||[]).filter(e => e !== email);
    await setDoc(doc(db, "config", "whitelist"), { emails: list }, { merge: true });
    await load();
  };

  const addScope = async () => {
    const e = scopeEmail.trim();
    const m = scopeMake.trim();
    if (!e || !m) return;
    const ref = doc(db, "editorScopes", e);
    const current = (await getDoc(ref)).data() || {};
    const makes = Array.from(new Set([...(current.allowedMakes||[]), m]));
    await setDoc(ref, { allowedMakes: makes }, { merge: true });
    setScopeMake("");
    await load();
  };

  const clearScope = async (email: string) => {
    await deleteDoc(doc(db, "editorScopes", email));
    await load();
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontWeight: "bold", fontSize: 18 }}>Admin</Text>

      <Text style={{ marginTop: 12, fontWeight: "600" }}>Whitelist</Text>
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 6 }}>
        <TextInput value={newEmail} onChangeText={setNewEmail} placeholder="name@domain.com"
          autoCapitalize="none" style={{ borderWidth: 1, padding: 8, minWidth: 220 }} />
        <Button title="Add" onPress={addEmail} />
      </View>
      <FlatList
        data={emails}
        keyExtractor={(e) => e}
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
            <Text>{item}</Text>
            <Text style={{ color: "#dc2626" }} onPress={() => removeEmail(item)}>Remove</Text>
          </View>
        )}
        style={{ borderTopWidth: 1, borderColor: "#eee", marginBottom: 16 }}
      />

      <Text style={{ fontWeight: "600" }}>Editor Scopes (per make)</Text>
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 6 }}>
        <TextInput value={scopeEmail} onChangeText={setScopeEmail} placeholder="email"
          autoCapitalize="none" style={{ borderWidth: 1, padding: 8, minWidth: 220 }} />
        <TextInput value={scopeMake} onChangeText={setScopeMake} placeholder="Make (e.g. Toyota)"
          autoCapitalize="none" style={{ borderWidth: 1, padding: 8, minWidth: 150 }} />
        <Button title="Grant" onPress={addScope} />
      </View>

      <FlatList
        data={scopes}
        keyExtractor={(s) => s.email}
        renderItem={({ item }) => (
          <View style={{ paddingVertical: 8, borderBottomWidth: 0.5, borderColor: "#eee" }}>
            <Text style={{ fontWeight: "600" }}>{item.email}</Text>
            <Text style={{ color: "#555" }}>{(item.allowedMakes||[]).join(", ") || "—"}</Text>
            <Text style={{ color: "#dc2626", marginTop: 4 }} onPress={() => clearScope(item.email)}>Remove scope</Text>
          </View>
        )}
      />
    </View>
  );
}