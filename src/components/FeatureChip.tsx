import React from "react";
import { View, Text } from "react-native";

export default function FeatureChip({ label }: { label: string }) {
  return (
    <View style={{
      backgroundColor: "#eef2ff",
      borderColor: "#c7d2fe",
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      marginRight: 6,
      marginTop: 4
    }}>
      <Text style={{ fontSize: 12, color: "#3730a3" }}>{label}</Text>
    </View>
  );
}