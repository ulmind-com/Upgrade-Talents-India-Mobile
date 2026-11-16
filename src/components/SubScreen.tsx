import React from "react";
import { View, Pressable, ScrollView, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Glow } from "@/components/ui";

/** Full-screen detail page with a back header, used across the (more) group. */
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
  const { c } = useTheme();
  const router = useRouter();

  const header = (
    <View style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Pressable onPress={() => (onBack ? onBack() : router.canGoBack() ? router.back() : router.replace("/(user)/profile"))} style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
          <ArrowLeft size={20} color={c.fg} />
        </Pressable>
        {right}
      </View>
      {eyebrow ? <Txt size={11} font="monoMed" tone="accent" tracking={3} uppercase style={{ marginTop: 18 }}>{eyebrow}</Txt> : null}
      <Txt size={28} font="display" tracking={-1} style={{ marginTop: eyebrow ? 6 : 18 }}>{title}</Txt>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style={c.barStyle === "light" ? "light" : "dark"} />
      <Glow color={c.spot1} size={320} top={-120} right={-100} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 48 }}
            refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} /> : undefined}
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
