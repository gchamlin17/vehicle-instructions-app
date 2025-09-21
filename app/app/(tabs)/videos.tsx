import React from "react";
import { ScrollView } from "react-native";
import ConnectivitySuite from "../../components/ConnectivitySuite";
import VideosList from "../../components/VideosList";

export default function VideosTab() {
  return (
    <ScrollView>
      <ConnectivitySuite />
      <VideosList />
    </ScrollView>
  );
}
