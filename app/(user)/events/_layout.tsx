import { Stack } from "expo-router";

export default function EventsLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" }, animation: "slide_from_right" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[id]/index" />
      <Stack.Screen name="[id]/book" />
    </Stack>
  );
}
