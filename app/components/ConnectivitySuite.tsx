import React, { useEffect, useRef, useState } from "react";
import { View, Text, Button, Platform } from "react-native";
import { firebaseConfig, forceOnline, pingFirestore, subscribeFirestore, testStorageWrite, clearWebCaches } from "../firebase";

export default function ConnectivitySuite() {
  const [status, setStatus] = useState<string>("");
  const [stream, setStream] = useState<string>("(no updates)");
  const unsubRef = useRef<() => void>();

  useEffect(() => {
    unsubRef.current = subscribeFirestore((s) => {
      if (s.ok) setStream("RT: ok");
      else setStream("RT: " + (s.err || "error"));
    });
    return () => { try { unsubRef.current?.(); } catch {} };
  }, []);

  const doPing = async () => {
    setStatus("Pinging Firestore…");
    try { setStatus((await pingFirestore()) ? "✅ Firestore ping ok" : "❌ Ping doc missing"); }
    catch (e:any) { setStatus("❌ " + (e?.message || String(e))); }
  };
  const goOnline = async () => {
    setStatus("Forcing online…");
    try { await forceOnline(); setStatus("🔄 Online requested; try Ping again"); }
    catch (e:any) { setStatus("❌ " + (e?.message || String(e))); }
  };
  const tryStorage = async () => {
    setStatus("Testing Storage write…");
    try { await testStorageWrite(); setStatus("✅ Storage write/delete ok"); }
    catch (e:any) { setStatus("❌ Storage: " + (e?.message || String(e))); }
  };
  const nukeWebCache = async () => {
    setStatus("Clearing caches / SW (web) and reloading…");
    await clearWebCaches();
  };

  return (
    <View style={{ gap: 10, padding: 12, borderBottomWidth: 1, borderColor: "#ddd", backgroundColor: "#f5f7ff" }}>
      <Text style={{ fontWeight: "700", fontSize: 16 }}>Connectivity</Text>
      <Text>projectId: {firebaseConfig.projectId}</Text>
      <Text>bucket: {firebaseConfig.storageBucket}</Text>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Button title="Ping Firestore" onPress={doPing} />
        <Button title="Force Online" onPress={goOnline} />
        <Button title="Test Storage" onPress={tryStorage} />
        {Platform.OS === "web" ? <Button title="Clear Web Cache" onPress={nukeWebCache} /> : null}
      </View>
      <Text>{status}</Text>
      <Text>{stream}</Text>
    </View>
  );
}
