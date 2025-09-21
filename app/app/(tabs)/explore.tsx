import React from "react";
import { ScrollView, View, Text } from "react-native";
import ConnectivitySuite from "../../components/ConnectivitySuite";

export default function ExploreTab() {
  return (
    <ScrollView>
      <ConnectivitySuite />
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Explore</Text>
        <Text>Try the Vehicles tab to upload/view manuals.</Text>
      </View>
    </ScrollView>
  );
}
