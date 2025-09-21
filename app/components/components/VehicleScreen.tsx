import React, { useEffect, useMemo, useState, useCallback } from "react";
import { ActivityIndicator, FlatList, RefreshControl, SafeAreaView, Text, View, Image, StyleSheet } from "react-native";
import { db } from "../firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import { toDocId, titleFromVehicle } from "../utils/key";

type Feature = {
  featureId: string;
  name: string;
  category: string;
  steps: string[];
  notes?: string;
};

type Vehicle = {
  vehicleKey: string;
  make: string;
  model: string;
  year: number;
  trim?: string;
  media?: {
    heroImage?: string;
    videos?: { title: string; youtubeId: string; lang?: string; source?: string }[];
  };
  features?: Feature[];
};

type Props = {
  vehicleKey: string; // e.g., "honda/cr-v/2020/ex"
};

const Hero: React.FC<{ uri?: string; title: string }> = ({ uri, title }) => {
  if (!uri) {
    return (
      <View style={[styles.hero, styles.heroFallback]}>
        <Text style={styles.heroFallbackText}>{title}</Text>
      </View>
    );
  }
  return <Image source={{ uri }} style={styles.hero} resizeMode="cover" />;
};

const SkeletonCard: React.FC = () => (
  <View style={[styles.card, { backgroundColor: "#f2f2f2" }]}>
    <View style={{ height: 16, width: "40%", backgroundColor: "#e0e0e0", borderRadius: 6, marginBottom: 12 }} />
    {[...Array(3)].map((_, i) => (
      <View key={i} style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <View style={{ width: 20, height: 16, backgroundColor: "#e5e5e5", borderRadius: 4 }} />
        <View style={{ flex: 1, height: 16, backgroundColor: "#e5e5e5", borderRadius: 4 }} />
      </View>
    ))}
  </View>
);

export const VehicleScreen: React.FC<Props> = ({ vehicleKey }) => {
  const [data, setData] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const docId = useMemo(() => toDocId(vehicleKey), [vehicleKey]);

  const fetchOnce = useCallback(async () => {
    setErr(null);
    try {
      const ref = doc(db, "vehicles", docId);
      const snap = await getDoc(ref);
      if (!snap.exists()) throw new Error(`Vehicle not found: ${vehicleKey}`);
      setData(snap.data() as Vehicle);
    } catch (e: any) {
      setErr(e?.message || String(e));
    }
  }, [docId, vehicleKey]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      await fetchOnce();
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, [fetchOnce]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOnce();
    setRefreshing(false);
  }, [fetchOnce]);

  const title = useMemo(() => titleFromVehicle({ ...data, vehicleKey }), [data, vehicleKey]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}><Text style={styles.title}>Loading…</Text></View>
        <View style={{ padding: 16, gap: 12 }}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  if (err) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.error}>Error</Text>
        <Text style={styles.muted}>{err}</Text>
        <View style={{ height: 12 }} />
        <Text onPress={onRefresh} style={styles.link}>Try again</Text>
      </SafeAreaView>
    );
  }

  if (!data) {
    return (
      <SafeAreaView style={styles.centered}>
        <Text style={styles.muted}>No data.</Text>
        <View style={{ height: 12 }} />
        <Text onPress={onRefresh} style={styles.link}>Reload</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Hero uri={data.media?.heroImage} title={title} />
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
      </View>

      <FlatList
        data={data.features || []}
        keyExtractor={(f) => f.featureId}
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
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#fff", padding: 24 },
  muted: { color: "#666" },
  error: { fontWeight: "700", fontSize: 18, color: "#b00020" },
  link: { color: "#0a66c2", fontWeight: "600" },

  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#eee" },
  title: { fontSize: 20, fontWeight: "700" },

  hero: { width: "100%", height: 200, backgroundColor: "#eee" },
  heroFallback: { alignItems: "center", justifyContent: "center" },
  heroFallbackText: { color: "#444", fontWeight: "600" },

  listContent: { padding: 16, gap: 12 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderColor: "#ddd", borderRadius: 14, padding: 12, gap: 8, backgroundColor: "#fafafa", shadowColor: "#000", shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 1 },
  featureName: { fontSize: 16, fontWeight: "700" },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  stepIndex: { width: 20, textAlign: "right", fontWeight: "700" },
  stepText: { flex: 1, color: "#222" },
  notes: { marginTop: 6, fontStyle: "italic", color: "#555" }
});

export default VehicleScreen;