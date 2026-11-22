import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { playNavFeedback } from "@/lib/sound";

/* ──────────────────────────────────────────────────────────────────────────
   District / HSBC-style ultra-slim horizontal promotional referral banner
   Clean dark charcoal gradient card with 3D character on the right
   and zero logos, zero coins text on the left (~3.7:1 slim aspect ratio).
   ────────────────────────────────────────────────────────────────────────── */

const BANNER_SRC = require("../../assets/banners/refer_and_earn_ultra_slim.jpg");

export function ReferralBanner({
  onPress,
}: {
  onPress: () => void;
}) {
  const handlePress = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    playNavFeedback();
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      <Image
        source={BANNER_SRC}
        style={styles.bannerImage}
        contentFit="cover"
        transition={150}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 18,
    marginBottom: 4,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#161720",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  bannerImage: {
    width: "100%",
    aspectRatio: 1270 / 343,
  },
});
