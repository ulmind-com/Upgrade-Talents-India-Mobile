import React from "react";
import { View, Pressable, StyleSheet, Linking } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Txt } from "@/components/ui";
import { playNavFeedback } from "@/lib/sound";

/* ──────────────────────────────────────────────────────────────────────────
   Zomato District-style 3D Instagram Community Card
   Features:
   - Compact dark charcoal card with seamless dusk-glow LinearGradient
   - v1 3D glossy Instagram icon with natural tilt and glass finish
   - Crisp copy + white capsule CTA button ("Tap here >")
   - Opens official Upgrade Talents India Instagram profile
   ────────────────────────────────────────────────────────────────────────── */

const INSTA_URL = "https://www.instagram.com/upgradetalentsindia?mdxt=ZTB1MjNmcW5qaTBz";
const INSTA_3D_ICON = require("../../assets/icons/3d_instagram_v1.png");

export function InstagramCard() {
  const handleOpen = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    playNavFeedback();
    try {
      await Linking.openURL(INSTA_URL);
    } catch {
      // Fallback
    }
  };

  return (
    <Pressable
      onPress={handleOpen}
      style={({ pressed }) => [
        styles.card,
        { transform: [{ scale: pressed ? 0.98 : 1 }] },
      ]}
    >
      {/* Soft diffused background gradient (no harsh red circle, pure smooth glow) */}
      <LinearGradient
        colors={["#13141c", "#161421", "#241328"]}
        start={{ x: 0, y: 0.6 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Left Content */}
      <View style={styles.contentCol}>
        <Txt size={15} font="sansBold" style={styles.title} numberOfLines={2}>
          Catch the vibe on Instagram
        </Txt>
        <Txt size={11.5} font="sansMed" style={styles.subtitle} numberOfLines={2}>
          Exclusive backstage clips, artist spotlights & live updates
        </Txt>

        {/* White Pill CTA Button (Exact to screenshot: "Tap here >") */}
        <View style={styles.ctaButton}>
          <Txt size={12} font="sansBold" style={styles.ctaText}>
            Tap here
          </Txt>
          <ChevronRight size={13} color="#000000" strokeWidth={2.6} />
        </View>
      </View>

      {/* Right 3D Visual Artwork (v1 icon) */}
      <View style={styles.artworkCol}>
        <Image
          source={INSTA_3D_ICON}
          style={styles.icon3d}
          contentFit="contain"
          transition={150}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#13141c",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    position: "relative",
  },
  contentCol: {
    flex: 1,
    paddingRight: 6,
    justifyContent: "center",
  },
  title: {
    color: "#ffffff",
    letterSpacing: -0.3,
    lineHeight: 19,
  },
  subtitle: {
    color: "#9ea3b8",
    marginTop: 3,
    lineHeight: 15.5,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 13,
    height: 31,
    alignSelf: "flex-start",
    marginTop: 10,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ctaText: {
    color: "#000000",
    letterSpacing: -0.2,
  },
  artworkCol: {
    width: 86,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
  },
  icon3d: {
    width: 82,
    height: 82,
  },
});
