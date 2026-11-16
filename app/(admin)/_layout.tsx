import React from "react";
import { Stack, Redirect, useSegments } from "expo-router";
import { useSession } from "@/context/Session";

/**
 * Admin area gate. Everything except the login screen requires an admin token.
 * Admin auth is fully separate from the user session (own endpoint + token).
 */
export default function AdminLayout() {
  const { admin, adminLoading } = useSession();
  const segments = useSegments();
  const onLogin = segments[segments.length - 1] === "login";

  if (!admin && !adminLoading && !onLogin) {
    return <Redirect href="/(admin)/login" />;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "transparent" }, animation: "slide_from_right" }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
    </Stack>
  );
}
