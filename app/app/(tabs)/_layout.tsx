import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Layout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="explore"
        options={{ title: "Explore", tabBarIcon: ({ color, size }) => <Ionicons name="compass" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="vehicle"
        options={{ title: "Vehicle", tabBarIcon: ({ color, size }) => <Ionicons name="car" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="videos"
        options={{ title: "Videos", tabBarIcon: ({ color, size }) => <Ionicons name="logo-youtube" color={color} size={size} /> }}
      />
    </Tabs>
  );
}