import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { fontMap } from "@/theme/fonts";
import { SessionProvider, useSession } from "@/context/Session";
import { CartProvider } from "@/context/Cart";
import { Splash, SPLASH_MS } from "@/components/Splash";
import { PopupProvider } from "@/components/Popup";
import { OnboardingGate } from "@/components/OnboardingGate";
import { ReviewPromptGate } from "@/components/ReviewPromptGate";
import { usePushSetup } from "@/lib/push";

/** Push registration + notification taps, for the signed-in member. */
function PushBridge() {
  const { user } = useSession();
  usePushSetup(!!user);
  return null;
}

function Boot({ children }: { children: React.ReactNode }) {
  const { ready } = useSession();
  const [fontsLoaded, fontError] = useFonts(fontMap);

  // Failsafe: never let the app hang on the splash. If fonts or the session
  // take too long (slow network, cold start, SecureStore), render anyway —
  // fonts fall back to the system face and the session fills in once ready.
  const [forced, setForced] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForced(true), 5000);
    return () => clearTimeout(t);
  }, []);

  const fontsDone = fontsLoaded || !!fontError;
  const show = (fontsDone && ready) || forced;

  // Keep the splash mounted over the app until it has played its exit. The
  // hold is the length of the launch stinger, so a warm start never cuts the
  // choreography — or the sound — off halfway.
  const [settled, setSettled] = useState(false);
  const [gone, setGone] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), SPLASH_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <PushBridge />
      {show ? children : null}
      {!gone ? <Splash visible={!(show && settled)} onHidden={() => setGone(true)} fontReady={fontsDone} /> : null}
      <ReviewPromptGate readyToShow={gone} />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <CartProvider>
            <PopupProvider>
            <Boot>
              <Stack screenOptions={{ headerShown: false, animation: "fade", contentStyle: { backgroundColor: "transparent" } }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="mode-select" />
                <Stack.Screen name="(user)" />
                <Stack.Screen name="(more)" options={{ animation: "slide_from_right" }} />
                <Stack.Screen name="(auth)" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
                <Stack.Screen name="(admin)" />
              </Stack>
              <OnboardingGate />
            </Boot>
            </PopupProvider>
            </CartProvider>
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
