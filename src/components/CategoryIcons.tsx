import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
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

/* District "Explore" row — compact dark cards washed with each icon's own
   colour, the 3D icon standing up out of the card's top edge, label below. */
const ICON = 66;
const LIFT = 26; // how far the icon rises above the card

export function ExploreGrid({ items }: { items: ExploreItem[] }) {
  const tap = (fn: () => void) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
            accessibilityRole="button"
            accessibilityLabel={label}
            style={({ pressed }) => [styles.cell, { transform: [{ scale: pressed ? 0.95 : 1 }] }]}
          >
            {/* the card: a soft wash of the icon's colour fading into the dark */}
            <View style={[styles.card, { borderColor: glow + "33" }]}>
              <LinearGradient
                colors={[glow + "47", glow + "14", "rgba(16,18,24,0)"]}
                locations={[0, 0.55, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View pointerEvents="none" style={styles.sheenLine} />
              <Txt size={13} font="sansBold" style={styles.label} numberOfLines={1}>
                {label}
              </Txt>
            </View>

            {/* the 3D icon, standing out of the card */}
            <View pointerEvents="none" style={[styles.icon, { shadowColor: glow }]}>
              <Icon size={ICON} />
            </View>
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
    paddingTop: LIFT, // room for the icons that rise above the cards
  },
  cell: {
    flex: 1,
    height: 82,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#101218",
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 12,
  },
  sheenLine: {
    position: "absolute",
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
  icon: {
    position: "absolute",
    top: -LIFT,
    alignSelf: "center",
    width: ICON,
    height: ICON,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  label: {
    color: "#ffffff",
    letterSpacing: -0.2,
  },
});
