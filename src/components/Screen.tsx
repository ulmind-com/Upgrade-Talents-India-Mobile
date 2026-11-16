import React from "react";
import { RefreshControl, ScrollView, StyleProp, View, ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "@/theme/ThemeProvider";
import { Glow } from "./ui";

/**
 * Page shell: themed background, status bar, Zomato District top ambient mesh glow,
 * and either a scroll container or a plain flex body.
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
  const background = bg ?? "#08090C";

  return (
    <View style={{ flex: 1, backgroundColor: background }}>
      <StatusBar style="light" />

      {/* Zomato District Signature Ambient Violet Glow at the top */}
      {glow ? (
        <LinearGradient
          colors={["rgba(139, 92, 246, 0.32)", "rgba(139, 92, 246, 0.08)", "transparent"]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 340,
            pointerEvents: "none",
          }}
        />
      ) : null}

      <SafeAreaView edges={edges} style={[{ flex: 1 }, style]}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[{ paddingHorizontal: padded ? 20 : 0, paddingBottom: 110 }, contentStyle]}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />
              ) : undefined
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
