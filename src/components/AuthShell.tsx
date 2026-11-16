import React from "react";
import { View, Pressable, KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { X } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Glow } from "@/components/ui";
import { AppImage } from "@/components/AppImage";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  seed = 1,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  seed?: number;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={["rgba(124, 58, 237, 0.32)", "rgba(255, 56, 92, 0.08)", "transparent"]}
        locations={[0, 0.5, 1]}
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 260 }}
        pointerEvents="none"
      />
      <View style={{ height: 230 }}>
        <AppImage seed={seed} style={{ width: "100%", height: "100%" }} />
        <LinearGradient colors={["rgba(4,5,12,0.45)", "rgba(4,5,12,0.3)", c.bg] as any} style={{ position: "absolute", width: "100%", height: "100%" }} />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, marginTop: -70 }}>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
          <View
            style={{
              backgroundColor: c.bg,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              paddingHorizontal: 24,
              paddingTop: 28,
              minHeight: 600,
            }}
          >
            <Txt size={11.5} font="sansBold" tracking={2.5} uppercase style={{ color: "#C9F24A" }}>{eyebrow}</Txt>
            <Txt size={32} font="display" tracking={-1} style={{ marginTop: 8, color: "#fff" }}>{title}</Txt>
            <Txt size={14.5} tone="muted" lh={21} style={{ marginTop: 8, marginBottom: 26 }}>{subtitle}</Txt>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SafeAreaView edges={["top"]} style={{ position: "absolute", top: 0, right: 0 }}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(user)"))}
          style={{ margin: 16, width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(20, 22, 30, 0.8)", borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.14)" }}
        >
          <X size={20} color="#fff" />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}
