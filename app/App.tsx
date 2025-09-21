import React from "react";
import { SafeAreaView, ScrollView, View } from "react-native";
import ConnectivitySuite from "./components/ConnectivitySuite";
import ManualViewer from "./components/ManualViewer";

export default function App() {
  return (
    <SafeAreaView>
      <ScrollView>
        <ConnectivitySuite />
        <View style={{ padding: 8 }}>
          <ManualViewer />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
