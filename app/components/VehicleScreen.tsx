import React, { useEffect, useMemo, useState, useCallback } from "react";
import { FlatList, RefreshControl, SafeAreaView, Text, View, Image, StyleSheet } from "react-native";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { toDocId, titleFromVehicle } from "../utils/key";

type Feature = { featureId: string; name: string; category: string; steps: string[]; notes?: string; };
type Vehicle = {
  vehicleKey: string; make: string; model: string; year: number; trim?: string;
  media?: { heroImage?: string; videos?: { title: string; youtubeId: string; lang?: string; source?: string }[]; };
  features?: Feature[];
};
const Hero: React.FC<{ uri?: string; title: string }> = ({ uri, title }) =>
  !uri ? (<View style={[styles.hero, styles.heroFallback]}><Text style={styles.heroFallbackText}>{title}</Text></View>)
       : (<Image source={{ uri }} style={styles.hero} resizeMode="cover" />);

export const VehicleScreen: React.FC<{ vehicleKey: string }> = ({ vehicleKey }) => {
  const [data, setData] = useState<Vehicle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const docId = useMemo(() => toDocId(vehicleKey), [vehicleKey]);

  const fetchOnce = useCallback(async () => {
    setErr(null);
    const ref = doc(db, "vehicles", docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error(`Vehicle not found: ${vehicleKey}`);
    setData(snap.data() as Vehicle);
  }, [docId, vehicleKey]);

  useEffect(() => { fetchOnce().catch(e => setErr(e.message || String(e))); }, [fetchOnce]);
  const onRefresh = useCallback(async () => { setRefreshing(true); try { await fetchOnce(); } finally { setRefreshing(false);} }, [fetchOnce]);
  const title = useMemo(() => titleFromVehicle({ ...data, vehicleKey }), [data, vehicleKey]);

  if (err) return <SafeAreaView style={styles.centered}><Text style={styles.error}>Error</Text><Text style={styles.muted}>{err}</Text></SafeAreaView>;
  if (!data) return <SafeAreaView style={styles.centered}><Text style={styles.muted}>Loading…</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.container}>
      <Hero uri={data.media?.heroImage} title={title} />
      <View style={styles.header}><Text style={styles.title}>{title}</Text></View>
      <FlatList
        data={data.features || []}
        keyExtractor={f => f.featureId}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.featureName}>{item.name}</Text>
            {item.steps?.map((s, idx) => (
              <View key={idx} style={styles.stepRow}>
                <Text style={styles.stepIndex}>{idx + 1}.</Text>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
            {!!item.notes && <Text style={styles.notes}>Note: {item.notes}</Text>}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.muted}>No features yet.</Text>}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:{flex:1,backgroundColor:"#fff"}, centered:{flex:1,alignItems:"center",justifyContent:"center",gap:8,padding:24},
  muted:{color:"#666"}, error:{color:"#b00020",fontWeight:"700"},
  header:{paddingHorizontal:16,paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:"#eee"},
  title:{fontSize:20,fontWeight:"700"}, hero:{width:"100%",height:200,backgroundColor:"#eee"},
  heroFallback:{alignItems:"center",justifyContent:"center"}, heroFallbackText:{color:"#444",fontWeight:"600"},
  listContent:{padding:16,gap:12}, card:{borderWidth:StyleSheet.hairlineWidth,borderColor:"#ddd",borderRadius:12,padding:12,gap:8,backgroundColor:"#fafafa"},
  featureName:{fontSize:16,fontWeight:"700"}, stepRow:{flexDirection:"row",gap:8}, stepIndex:{width:20,textAlign:"right",fontWeight:"700"},
  stepText:{flex:1,color:"#222"}, notes:{marginTop:6,fontStyle:"italic",color:"#555"}
});
export default VehicleScreen;