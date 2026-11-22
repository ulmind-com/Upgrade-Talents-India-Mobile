import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { Txt } from "@/components/ui";

/* ──────────────────────────────────────────────────────────────────────────
   District / Zomato-style glossy 3D category icons
   Rendered with high-resolution 3D claymorphic/studio-rendered assets
   with ambient tone-glow and tactile haptic feedback.
   ────────────────────────────────────────────────────────────────────────── */

const EVENT_ICON_SRC = require("../../assets/icons/3d_events.png");
const CONTEST_ICON_SRC = require("../../assets/icons/3d_contest.png");
const ACADEMY_ICON_SRC = require("../../assets/icons/3d_academy.png");
const SHOP_ICON_SRC = require("../../assets/icons/3d_shop.png");

/* Events — 3D stage speaker + golden mic + music sparkles */
export function EventsIcon({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={EVENT_ICON_SRC}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={150}
    />
  );
}

/* Contests — 3D championship golden trophy cup + royal purple ribbon */
export function ContestIcon({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={CONTEST_ICON_SRC}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={150}
    />
  );
}

/* Academy — 3D electric blue graduation cap + diploma scroll + sparkles */
export function AcademyIcon({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={ACADEMY_ICON_SRC}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={150}
    />
  );
}

/* Shop — 3D emerald green concert merch shopping bag + VIP ticket */
export function ShopIcon({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={SHOP_ICON_SRC}
      style={{ width: size, height: size }}
      contentFit="contain"
      transition={150}
    />
  );
}

export type ExploreItem = {
  key: string;
  label: string;
  Icon: (p: { size?: number }) => React.ReactElement;
  glow: string;
  onPress: () => void;
};

/* District "Explore" grid — four modern 3D squircle cards with ambient glow */
export function ExploreGrid({ items }: { items: ExploreItem[] }) {
  const tap = (fn: () => void) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    fn();
  };

  return (
    <View style={styles.container}>
      <Txt size={20} font="sansBold" style={styles.title}>
        Explore
      </Txt>
      <View style={styles.gridRow}>
        {items.map(({ key, label, Icon, glow, onPress }) => (
          <Pressable
            key={key}
            onPress={() => tap(onPress)}
            style={({ pressed }) => [
              styles.card,
              {
                transform: [{ scale: pressed ? 0.94 : 1 }],
              },
            ]}
          >
            {/* Ambient colored spotlight behind the 3D icon */}
            <View
              pointerEvents="none"
              style={[
                styles.glowSpotlight,
                {
                  backgroundColor: glow,
                },
              ]}
            />

            {/* Subtle top glass edge sheen */}
            <View pointerEvents="none" style={styles.sheenLine} />

            {/* 3D Icon container */}
            <View style={styles.iconWrapper}>
              <Icon size={54} />
            </View>

            {/* Category label */}
            <Txt
              size={12.5}
              font="sansBold"
              style={styles.label}
              numberOfLines={1}
            >
              {label}
            </Txt>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    marginTop: 20,
  },
  title: {
    color: "#ffffff",
    letterSpacing: -0.4,
    marginBottom: 12,
  },
  gridRow: {
    flexDirection: "row",
    gap: 10,
  },
  card: {
    flex: 1,
    height: 112,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#11131a",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingTop: 8,
    paddingBottom: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "space-between",
  },
  glowSpotlight: {
    position: "absolute",
    top: 6,
    alignSelf: "center",
    width: 62,
    height: 62,
    borderRadius: 31,
    opacity: 0.28,
  },
  sheenLine: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
  },
  iconWrapper: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: "#ffffff",
    letterSpacing: -0.2,
  },
});
