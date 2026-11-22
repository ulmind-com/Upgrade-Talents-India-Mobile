import React, { useRef } from "react";
import { View, Pressable, Animated, RefreshControl } from "react-native";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { PosterFill } from "@/components/AppImage";

/* ──────────────────────────────────────────────────────────────────────────
   The detail-page hero, in one place.

   Event detail grew a nice treatment — a tall poster that drifts as you
   scroll, stretches when you pull down, and hands over to a glass title bar
   on the way out, with the content riding up over it on a rounded sheet.
   Competition detail had a small cropped banner instead. The motion maths
   now lives here so the two screens cannot drift apart again.
   ────────────────────────────────────────────────────────────────────────── */

export const HERO_H = 380;

export function useParallaxHero(heroHeight: number = HERO_H) {
  const scrollY = useRef(new Animated.Value(0)).current;
  return {
    scrollY,
    onScroll: Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    /** Drifts with the scroll; over-scroll up is extended, down is clamped. */
    imgTranslate: scrollY.interpolate({
      inputRange: [-200, 0, heroHeight],
      outputRange: [-100, 0, 110],
      extrapolateLeft: "extend",
      extrapolateRight: "clamp",
    }),
    /** Pull-to-refresh stretch — only ever scales up. */
    imgScale: scrollY.interpolate({ inputRange: [-200, 0], outputRange: [1.5, 1], extrapolateRight: "clamp" }),
    /** The title bar takes over just before the hero leaves. */
    headerOpacity: scrollY.interpolate({
      inputRange: [heroHeight - 160, heroHeight - 90],
      outputRange: [0, 1],
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  };
}

export function FloatBtn({ onPress, children }: { onPress: () => void; children: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        width: 42,
        height: 42,
        borderRadius: 999,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: c.surfaceGlass,
        borderWidth: 1,
        borderColor: c.border,
        transform: [{ scale: pressed ? 0.94 : 1 }],
      })}
    >
      {children}
    </Pressable>
  );
}

/**
 * A whole detail page: parallax poster, overlapping content sheet, glass
 * title bar and floating back/action buttons.
 *
 * The poster is shown with `PosterFill`, so a tall or square upload is seen
 * whole rather than cropped to the frame.
 */
export function ParallaxDetailScreen({
  image,
  seed,
  title,
  heroOverlay,
  right,
  onBack,
  refreshing,
  onRefresh,
  overlay,
  footer,
  heroHeight = HERO_H,
  bottomPad = 150,
  children,
}: {
  image?: string | null;
  seed?: string | number;
  /** Shown in the glass bar once the hero scrolls away. */
  title: string;
  /** Badges, date chip, big title — drawn over the bottom of the poster. */
  heroOverlay?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Modals and sheets, mounted above everything. */
  overlay?: React.ReactNode;
  /** Pinned action bar at the bottom of the screen. */
  footer?: React.ReactNode;
  heroHeight?: number;
  bottomPad?: number;
  children: React.ReactNode;
}) {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { onScroll, imgTranslate, imgScale, headerOpacity } = useParallaxHero(heroHeight);

  const back = () => {
    if (onBack) return onBack();
    if (router.canGoBack()) router.back();
    else router.replace("/(user)/index" as any);
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#08090C" }}>
      <StatusBar style="light" />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        onScroll={onScroll}
        scrollEventThrottle={16}
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={c.accent} colors={[c.accent]} />
          ) : undefined
        }
      >
        <View style={{ height: heroHeight, overflow: "hidden" }}>
          <Animated.View
            style={{ width: "100%", height: "100%", transform: [{ translateY: imgTranslate }, { scale: imgScale }] }}
          >
            <PosterFill uri={image} seed={seed} />
          </Animated.View>
          <LinearGradient
            colors={["rgba(4,5,12,0.55)", "transparent", "rgba(4,5,12,0.5)", "rgba(4,5,12,0.9)"] as any}
            locations={[0, 0.32, 0.7, 1]}
            style={{ position: "absolute", width: "100%", height: "100%" }}
            pointerEvents="none"
          />
          {heroOverlay ? (
            <View style={{ position: "absolute", bottom: 46, left: 20, right: 20 }}>{heroOverlay}</View>
          ) : null}
        </View>

        {/* content rides up over the poster */}
        <View
          style={{
            backgroundColor: "#08090C",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            marginTop: -26,
            paddingTop: 26,
            paddingHorizontal: 20,
          }}
        >
          <View style={{ alignSelf: "center", width: 42, height: 5, borderRadius: 999, backgroundColor: c.border, marginTop: -14, marginBottom: 20 }} />
          {children}
        </View>
      </Animated.ScrollView>

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + 54,
          backgroundColor: "#08090C",
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.1)",
          opacity: headerOpacity,
          justifyContent: "flex-end",
          paddingBottom: 12,
          paddingHorizontal: 70,
        }}
      >
        <Txt size={16} font="sansBold" align="center" numberOfLines={1} style={{ color: "#fff" }}>
          {title}
        </Txt>
      </Animated.View>

      <View
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <FloatBtn onPress={back}>
          <ArrowLeft size={20} color={c.fg} />
        </FloatBtn>
        {right}
      </View>

      {footer}
      {overlay}
    </View>
  );
}
