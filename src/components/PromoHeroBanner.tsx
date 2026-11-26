import React from "react";
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Sparkles } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { Txt } from "@/components/ui";
import { playNavFeedback } from "@/lib/sound";

/* ──────────────────────────────────────────────────────────────────────────
   Zomato District-style Compact 3D Promo Hero Banner
   - Compact dark charcoal container (~104px height, exact match to InstagramCard)
   - Left: Tag with sparkles, bold title, concise subtitle, white capsule CTA
   - Right: 3D Mascot Character with subtle ambient dusk glow
   ────────────────────────────────────────────────────────────────────────── */

const CHARACTER_SRC = require("../../assets/banners/3d_avatar_character_cutout.png");

export function PromoHeroBanner({
  tag,
  title,
  subtitle,
  ctaText,
  characterSource,
  glowColor,
  onPress,
  style,
}: {
  tag?: string;
  title: string;
  subtitle: string;
  ctaText?: string;
  characterSource?: any;
  glowColor?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const handlePress = () => {
    try {
      Haptics.selectionAsync();
    } catch {}
    playNavFeedback();
    if (onPress) onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        style,
        { transform: [{ scale: pressed ? 0.985 : 1 }] },
      ]}
    >
      {/* Soft diffused background gradient (pure smooth dusk glow) */}
      <LinearGradient
        colors={["#13141c", "#171524", "#231427"]}
        start={{ x: 0, y: 0.6 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Left Content Column */}
      <View style={styles.contentCol}>
        {tag ? (
          <View style={styles.tagRow}>
            <Sparkles size={11} color="#C9F24A" />
            <Txt size={9.5} font="monoMed" style={styles.tagText} uppercase>
              {tag}
            </Txt>
          </View>
        ) : null}

        <Txt size={15} font="sansBold" style={styles.title} numberOfLines={2}>
          {title}
        </Txt>

        <Txt size={11.5} font="sansMed" style={styles.subtitle} numberOfLines={2}>
          {subtitle}
        </Txt>

        {ctaText ? (
          <View style={styles.ctaButton}>
            <Txt size={11.5} font="sansBold" style={styles.ctaText}>
              {ctaText}
            </Txt>
            <ChevronRight size={13} color="#000000" strokeWidth={2.6} />
          </View>
        ) : null}
      </View>

      {/* Right 3D Visual Artwork */}
      <View style={styles.artworkCol}>
        {/* Soft radial glow behind character */}
        <View
          style={[
            styles.ambientGlow,
            glowColor ? { backgroundColor: glowColor } : null,
          ]}
        />
        <Image
          source={characterSource ?? CHARACTER_SRC}
          style={styles.charImage}
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
    marginBottom: 16,
  },
  contentCol: {
    flex: 1,
    paddingRight: 8,
    justifyContent: "center",
  },
  tagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },
  tagText: {
    color: "#C9F24A",
    letterSpacing: 1.5,
  },
  title: {
    color: "#ffffff",
    letterSpacing: -0.3,
    lineHeight: 19,
  },
  subtitle: {
    color: "#9ea3b8",
    marginTop: 2.5,
    lineHeight: 15,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    height: 29,
    alignSelf: "flex-start",
    marginTop: 8,
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
    width: 94,
    height: 94,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  ambientGlow: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: "rgba(255, 56, 92, 0.14)",
  },
  charImage: {
    width: 94,
    height: 94,
  },
});
