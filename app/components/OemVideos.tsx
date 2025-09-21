import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, SafeAreaView, Text, TouchableOpacity, View, Image, StyleSheet } from "react-native";
import { db } from "../firebaseConfig";
import { collection, getDocs, limit, query } from "firebase/firestore";
import * as WebBrowser from "expo-web-browser";

type OemVideo = { videoId:string; title:string; description?:string; publishedAt?:string; thumbnails?:any; make:string; source?:string };

const OemVideos: React.FC<{ make:string }> = ({ make }) => {
  const [items, setItems] = useState<OemVideo[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { (async () => {
      try {
        const col = collection(db, "oem_videos", make, "videos");
        const snap = await getDocs(query(col, limit(25)));
        const list: OemVideo[] = []; snap.forEach(d => list.push(d.data() as OemVideo));
        list.sort((a,b) => (b.publishedAt||"").localeCompare(a.publishedAt||""));
        setItems(list);
      } catch (e:any) { setErr(e.message || String(e)); }
  })(); }, [make]);

  if (err)   return <SafeAreaView style={styles.centered}><Text style={styles.error}>{err}</Text></SafeAreaView>;
  if (!items) return <SafeAreaView style={styles.centered}><ActivityIndicator size="large"/><Text style={styles.muted}>Loading OEM videos…</Text></SafeAreaView>;
  if (items.length===0) return <SafeAreaView style={styles.centered}><Text>No videos found for {make}.</Text></SafeAreaView>;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <FlatList
        contentContainerStyle={{ padding:12, gap:12 }}
        data={items}
        keyExtractor={(v)=>v.videoId}
        renderItem={({ item }) => {
          const thumb = item.thumbnails?.medium?.url || item.thumbnails?.default?.url;
          return (
            <TouchableOpacity style={styles.card} onPress={() => WebBrowser.openBrowserAsync(`https://www.youtube.com/watch?v=${item.videoId}`)}>
              {!!thumb && <Image source={{ uri: thumb }} style={styles.thumb} />}
              <View style={{ flex:1 }}>
                <Text style={styles.title}>{item.title}</Text>
                {!!item.publishedAt && <Text style={styles.date}>{new Date(item.publishedAt).toLocaleDateString()}</Text>}
                <Text numberOfLines={2} style={styles.desc}>{item.description || ""}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  centered:{flex:1,alignItems:"center",justifyContent:"center",gap:8,backgroundColor:"#fff"},
  muted:{color:"#666"}, error:{color:"#b00020",fontWeight:"700"},
  card:{flexDirection:"row",gap:12,padding:12,backgroundColor:"#fafafa",borderRadius:12,borderWidth:StyleSheet.hairlineWidth,borderColor:"#ddd"},
  thumb:{width:120,height:68,borderRadius:8,backgroundColor:"#eee"},
  title:{fontWeight:"700"}, date:{color:"#666",marginTop:2,marginBottom:6,fontSize:12}, desc:{color:"#333"}
});
export default OemVideos;