import React from "react";
import { RefreshControl, ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useTheme } from "@/theme/ThemeProvider";
import { Glow } from "./ui";

/**
 * Page shell: themed background, status bar, optional ambient glows, and either
 * a scroll container or a plain flex body.
 */
export function Screen({
  children,
  scroll = true,
  glow = true,
  padded = true,
  edges = ["top"],
  refreshing,
  onRefresh,
  contentStyle,
  style,
  bg,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  glow?: boolean;
  padded?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  bg?: string;
}) {
  const { c } = useTheme();
  const background = bg ?? c.bg;

  const decor = glow ? (
    <>
      <Glow color={c.spot1} size={380} top={-120} left={-100} />
      <Glow color={c.spot2} size={300} top={120} right={-120} />
    </>
  ) : null;

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <StatusBar style={c.barStyle === "light" ? "light" : "dark"} />
      {decor}
      <SafeAreaView edges={edges} style={[{ flex: 1 }, style]}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ paddingHorizontal: padded ? 20 : 0, paddingBottom: 110 }, contentStyle]}
            refreshControl={
              onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} /> : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1, paddingHorizontal: padded ? 20 : 0 }, contentStyle]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}
