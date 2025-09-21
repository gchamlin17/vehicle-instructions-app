import React from "react";
import { ScrollView, View } from "react-native";
import ConnectivitySuite from "../../components/ConnectivitySuite";
import UploadManual from "../../components/UploadManual";
import ManualViewer from "../../components/ManualViewer";

export default function VehiclesTab() {
  return (
    <ScrollView>
      <ConnectivitySuite />
      <View style={{ padding: 8 }}>
        <UploadManual />
        <ManualViewer />
      </View>
    </ScrollView>
  );
}
