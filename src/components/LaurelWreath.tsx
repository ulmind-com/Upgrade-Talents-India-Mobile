import React from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Path, G } from "react-native-svg";
import { Txt } from "@/components/ui";

/* ──────────────────────────────────────────────────────────────────────────
   Laurel Wreath with Rank Badge — Classic Olympic High-Contrast Edition
   - Open horseshoe laurel wreath with leaves curving outward
   - Center area kept completely open for crystal-clear readability
   - Numbers and suffixes rendered in crisp solid WHITE (#FFFFFF)
   - Gold (#FBBF24), Silver (#CBD5E1), Bronze (#F59E0B) support
   ────────────────────────────────────────────────────────────────────────── */

export function LaurelWreath({
  rank,
  size = 50,
  color,
}: {
  rank: number;
  size?: number;
  color?: string;
}) {
  const defaultColor =
    rank === 1
      ? "#FBBF24" // Bright Champion Gold
      : rank === 2
      ? "#CBD5E1" // Elegant Silver
      : rank === 3
      ? "#F59E0B" // Warm Bronze
      : "#D97706"; // Amber Gold for 4th, 5th, etc.
  const c = color || defaultColor;

  const suffix =
    rank === 1 ? "st" : rank === 2 ? "nd" : rank === 3 ? "rd" : "th";

  // Stem: curves from bottom center (30, 56) outward to (10, 30) and up to (26, 6)
  const stemD = "M 30 56 C 16 53 10 39 10 27 C 10 16 18 8 26 6";

  // 5 pairs of lush outward-pointing leaves — carefully shaped to stay outside x = 20
  // leaving the central region (x: 20 to 44) completely clear for text.
  const leafPairs = [
    // Bottom leaves
    "M 26 53 C 21 55 17 53 15 50 C 18 48 23 50 26 53 Z M 27 48 C 23 48 19 44 20 40 C 23 43 27 45 27 48 Z",
    // Lower-mid leaves
    "M 19 42 C 14 42 10 39 9 36 C 13 35 17 37 19 42 Z M 19 36 C 15 34 12 30 13 26 C 16 28 19 32 19 36 Z",
    // Mid leaves (widest spread outward)
    "M 13 28 C 8 27 6 23 6 19 C 10 19 13 22 13 28 Z M 15 24 C 12 21 12 16 14 12 C 17 15 17 20 15 24 Z",
    // Upper leaves
    "M 16 16 C 13 12 14 7 17 4 C 19 8 18 13 16 16 Z M 21 12 C 18 9 20 4 23 2 C 24 6 23 10 21 12 Z",
    // Tip leaf
    "M 26 6 C 25 2 27 0 29 0 C 30 3 29 6 26 6 Z",
  ].join(" ");

  // Small ribbon bow / tie at bottom center
  const ribbonD = "M 29 55 Q 32 53 35 55 Q 32 57 29 55 Z";

  const isDoubleDigit = rank >= 10;
  // Font sizes: large, prominent, perfectly centered
  const numSize = isDoubleDigit ? size * 0.28 : size * 0.34;
  const sufSize = isDoubleDigit ? size * 0.15 : size * 0.18;

  return (
    <View
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 64 64" style={StyleSheet.absoluteFill}>
        {/* Left branch */}
        <G fill={c}>
          <Path
            d={stemD}
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path d={leafPairs} />
        </G>

        {/* Right branch mirrored */}
        <G transform="translate(64, 0) scale(-1, 1)" fill={c}>
          <Path
            d={stemD}
            stroke={c}
            strokeWidth={1.8}
            strokeLinecap="round"
            fill="none"
          />
          <Path d={leafPairs} />
        </G>

        {/* Ribbon knot at bottom */}
        <Path d={ribbonD} fill={c} />
      </Svg>

      {/* Rank Text in Center — Solid crisp WHITE with subtle shadow for 100% legibility */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-start",
          justifyContent: "center",
          marginBottom: 2,
        }}
      >
        <Txt
          size={numSize}
          font="display"
          style={{
            color: "#FFFFFF",
            letterSpacing: -0.5,
            lineHeight: numSize + 4,
            textShadowColor: "rgba(0, 0, 0, 0.9)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
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
            textShadowColor: "rgba(0, 0, 0, 0.9)",
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
          }}
        >
          {suffix}
        </Txt>
      </View>
    </View>
  );
}
