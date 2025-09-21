import React from "react";
import { ScrollView, View, Text } from "react-native";
import ConnectivitySuite from "../../components/ConnectivitySuite";

export default function HomeTab() {
  return (
    <ScrollView>
      <ConnectivitySuite />
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Home</Text>
        <Text>Welcome.</Text>
      </View>
    </ScrollView>
  );
}
