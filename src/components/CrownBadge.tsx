import React from "react";
import { View, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { Txt } from "@/components/ui";

/* ──────────────────────────────────────────────────────────────────────────
   CrownBadge — 3D Glowing Royal Championship Crown
   - Gold (#FBBF24) 3D Crown for Rank 1
   - Silver (#CBD5E1) 3D Chrome Crown for Rank 2
   - Bronze (#F59E0B) 3D Antique Bronze Crown for Rank 3
   - Amber / Copper 3D Crown for Ranks 4+
   - Glowing emerald crest medallion displaying the dynamic rank number & suffix
   - Signature sparkling 4-point star glint
   ────────────────────────────────────────────────────────────────────────── */

const CROWN_ASSETS = {
  gold: require("../../assets/crown_gold.png"),
  silver: require("../../assets/crown_silver.png"),
  bronze: require("../../assets/crown_bronze.png"),
  amber: require("../../assets/crown_amber.png"),
};

export function CrownBadge({
  rank,
  size = 52,
}: {
  rank: number;
  size?: number;
}) {
  const isTop1 = rank === 1;
  const isTop2 = rank === 2;
  const isTop3 = rank === 3;

  const crownSource = isTop1
    ? CROWN_ASSETS.gold
    : isTop2
    ? CROWN_ASSETS.silver
    : isTop3
    ? CROWN_ASSETS.bronze
    : CROWN_ASSETS.amber;

  // Ambient 3D glow aura color
  const glowColor = isTop1
    ? "rgba(251, 191, 36, 0.45)"
    : isTop2
    ? "rgba(203, 213, 225, 0.35)"
    : isTop3
    ? "rgba(245, 158, 11, 0.35)"
    : "rgba(217, 119, 6, 0.22)";

  // Medallion golden/silver bezel border
  const gemBorderColor = isTop2 ? "#FFFFFF" : "#FDE68A";

  const suffix =
    rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";

  const isDoubleDigit = rank >= 10;
  const numSize = isDoubleDigit ? size * 0.2 : size * 0.24;
  const sufSize = isDoubleDigit ? size * 0.11 : size * 0.13;

  // Crown aspect ratio ~ 1.2 : 1 (269:223)
  const crownW = size;
  const crownH = Math.round(size * 0.83);

  return (
    <View
      style={{
        width: crownW,
        height: crownH,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Ambient 3D Glow Aura */}
      <View
        style={{
          position: "absolute",
          width: crownW * 0.75,
          height: crownH * 0.75,
          borderRadius: 999,
          backgroundColor: glowColor,
          opacity: 0.6,
        }}
      />

      {/* 3D Crown Image */}
      <Image
        source={crownSource}
        style={{ width: crownW, height: crownH }}
        contentFit="contain"
      />

      {/* Central Glowing Emerald Medallion with the Rank */}
      <View
        style={[
          styles.gemMedallion,
          {
            borderColor: gemBorderColor,
            paddingHorizontal: isDoubleDigit ? 5 : 6,
            paddingVertical: 1,
            borderRadius: Math.round(size * 0.1),
          },
        ]}
      >
        <LinearGradient
          colors={["#10B981", "#059669", "#047857"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        {/* Tiny 4-point sparkle star glint */}
        <Svg
          width={7}
          height={7}
          viewBox="0 0 12 12"
          style={styles.glintStar}
        >
          <Path
            d="M 6 0 Q 6 6 12 6 Q 6 6 6 12 Q 6 6 0 6 Q 6 6 6 0 Z"
            fill="#FFFFFF"
          />
        </Svg>

        {/* Rank Number & Suffix */}
        <View style={styles.rankRow}>
          <Txt
            size={numSize}
            font="display"
            style={{
              color: "#FFFFFF",
              letterSpacing: -0.4,
              lineHeight: numSize + 3,
              textShadowColor: "rgba(0, 0, 0, 0.8)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            {rank}
          </Txt>
          <Txt
            size={sufSize}
            font="sansBold"
            style={{
              color: "#FFFFFF",
              marginTop: 1,
              letterSpacing: -0.2,
              textShadowColor: "rgba(0, 0, 0, 0.8)",
              textShadowOffset: { width: 0, height: 1 },
              textShadowRadius: 2,
            }}
          >
            {suffix}
          </Txt>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gemMedallion: {
    position: "absolute",
    top: "54%",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.2,
    overflow: "hidden",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.6,
    shadowRadius: 3,
    elevation: 3,
  },
  glintStar: {
    position: "absolute",
    top: -1,
    right: -1,
    zIndex: 2,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
  },
});
