import React, { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";
import { app } from "../firebase";

type Props = { onClose?: () => void };

export default function SignIn({ onClose }: Props) {
  const auth = getAuth(app);
  const [email, setEmail] = useState(""); const [pass, setPass] = useState("");
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false);

  async function doSignIn() {
    setErr(null); setBusy(true);
    try { await signInWithEmailAndPassword(auth, email.trim(), pass); onClose?.(); }
    catch (e:any) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }
  async function doCreate() {
    setErr(null); setBusy(true);
    try { await createUserWithEmailAndPassword(auth, email.trim(), pass); onClose?.(); }
    catch (e:any) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }

  return (
    <View style={{ padding: 16, gap: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: "600" }}>Admin sign in</Text>
      <TextInput placeholder="email" autoCapitalize="none" keyboardType="email-address"
        value={email} onChangeText={setEmail} style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}/>
      <TextInput placeholder="password" secureTextEntry value={pass} onChangeText={setPass}
        style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}/>
      {!!err && <Text style={{ color: "red" }}>{err}</Text>}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Pressable onPress={doSignIn} disabled={busy} style={{ backgroundColor: "#1e90ff", padding: 10, borderRadius: 8 }}>
          <Text style={{ color: "white", fontWeight: "600" }}>Sign in</Text>
        </Pressable>
        <Pressable onPress={doCreate} disabled={busy} style={{ backgroundColor: "#555", padding: 10, borderRadius: 8 }}>
          <Text style={{ color: "white" }}>Create</Text>
        </Pressable>
        <Pressable onPress={onClose} style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}>
          <Text>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}
export async function signOutEverywhere(){ await signOut(getAuth(app)); }