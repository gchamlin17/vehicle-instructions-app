import React, { useState } from "react";
import { View, Text, TextInput, Button, Linking, Platform } from "react-native";

export default function YoutubeLinker({
  youtubeId,
  onSave
}: {
  youtubeId?: string;
  onSave: (newId: string) => Promise<void> | void;
}) {
  const [val, setVal] = useState(youtubeId ?? "");

  const open = () => {
    const id = (val || youtubeId || "").trim();
    if (!id) return;
    const url = `https://youtu.be/${id}`;
    Linking.openURL(url);
  }

  return (
    <View style={{ borderTopWidth: 1, borderColor: "#eee", paddingTop: 8, marginTop: 8 }}>
      <Text style={{ fontWeight: "600", marginBottom: 6 }}>YouTube</Text>
      <TextInput
        placeholder="YouTube ID (e.g. dQw4w9WgXcQ)"
        value={val}
        onChangeText={setVal}
        autoCapitalize="none"
        style={{ borderWidth: 1, padding: 8, borderColor: "#ddd" }}
      />
      <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
        <Button title="Save" onPress={() => onSave(val.trim())} />
        <Button title="Open" onPress={open} />
      </View>
    </View>
  );
}