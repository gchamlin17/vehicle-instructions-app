import React from "react";
import { Platform, View } from "react-native";
import YoutubePlayer from "react-native-youtube-iframe";

type Props = { videoId?: string; height?: number; };

export default function YT({ videoId, height = 220 }: Props) {
  if (!videoId) return null;

  // Web: simple iframe avoids extra webview deps
  if (Platform.OS === "web") {
    const src = `https://www.youtube.com/embed/${videoId}?playsinline=1`;
    return (
      <div style={{ width: "100%", maxWidth: 720, aspectRatio: "16/9" }}>
        <iframe
          src={src}
          width="100%"
          height="100%"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          style={{ border: 0, width: "100%", height: "100%" }}
          title="YouTube player"
        />
      </div>
    );
  }

  // Native: use the YouTube player
  return (
    <View style={{ width: "100%" }}>
      <YoutubePlayer height={height} play={false} videoId={videoId} />
    </View>
  );
}