import React from "react";
import { View, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Glow } from "@/components/ui";
import { playNavFeedback } from "@/lib/sound";

/** Full-screen detail page with a Zomato District Gen-Z header, used across the (more) group. */
export function SubScreen({
  title,
  eyebrow,
  children,
  scroll = true,
  refreshing,
  onRefresh,
  right,
  onBack,
  overlay,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  right?: React.ReactNode;
  onBack?: () => void;
  overlay?: React.ReactNode;
}) {
  const { c, name } = useTheme();
  const router = useRouter();

  const handleBack = () => {
    playNavFeedback();
    if (onBack) onBack();
    else if (router.canGoBack()) router.back();
    else router.replace("/(user)/profile");
  };

  const header = (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.12)",
            backgroundColor: "rgba(20, 22, 30, 0.9)",
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <ArrowLeft size={20} color="#FFFFFF" />
        </Pressable>
        {right}
      </View>
      {eyebrow ? (
        <Txt
          size={11.5}
          font="monoMed"
          style={{ color: "#C9F24A", letterSpacing: 2, marginTop: 18 }}
          uppercase
        >
          {eyebrow}
        </Txt>
      ) : null}
      <Txt
        size={28}
        font="display"
        tracking={-0.6}
        style={{ color: "#FFFFFF", marginTop: eyebrow ? 6 : 16 }}
      >
        {title}
      </Txt>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#08090C" }}>
      <StatusBar style="light" />

      {/* Soft brand-orange glow at the top — the logo's hue, low enough to sit on black */}
      <LinearGradient
        colors={[
          "rgba(255, 122, 48, 0.20)",
          "rgba(255, 112, 38, 0.11)",
          "rgba(255, 106, 30, 0.05)",
          "rgba(255, 106, 30, 0.015)",
          "rgba(255, 106, 30, 0)",
        ]}
        locations={[0, 0.25, 0.5, 0.75, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 300, // soft top wash — eases out to nothing, no visible edge
          pointerEvents: "none",
        }}
      />

      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 48 }}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />
              ) : undefined
            }
          >
            {header}
            <View style={{ paddingHorizontal: 20 }}>{children}</View>
          </ScrollView>
        ) : (
          <>
            {header}
            <View style={{ flex: 1, paddingHorizontal: 20 }}>{children}</View>
          </>
        )}
      </SafeAreaView>
      {overlay}
    </View>
  );
}
