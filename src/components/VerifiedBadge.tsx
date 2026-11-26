import React from "react";
import { View, type StyleProp, type TextStyle } from "react-native";
import { Txt } from "@/components/ui";
import Svg, { Circle, Path } from "react-native-svg";

/** True when any of the shapes the API uses for a verified member is set. */
export function isVerified(row: any): boolean {
  return Boolean(row?.is_verified || row?.verified_badge || row?.verified_tick || row?.is_profile_verified);
}

/**
 * The official blue verified tick — same geometry as the website's badge
 * (circle #1877F2, white check). Shown beside verified contestants everywhere.
 */
export function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 512 512">
      <Circle cx={256} cy={256} r={256} fill="#1877F2" />
      <Path d="M152 254L225 327L360 176" stroke="#FFFFFF" strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

/** Convenience: renders the badge only when the row qualifies. */
export function VerifiedTick({ row, size = 16 }: { row: any; size?: number }) {
  if (!isVerified(row)) return null;
  return <VerifiedBadge size={size} />;
}

/**
 * The tick as part of the text itself: drop it inside a <Txt> right after the
 * name and it flows with the words — it always sits beside the LAST word, on
 * whichever line the name ends, never stranded at the far edge or on a line
 * of its own. `fontSize` keeps it centred on the line.
 */
export function InlineTick({ fontSize, size }: { fontSize: number; size?: number }) {
  const t = size ?? Math.round(fontSize * 0.86);
  return (
    <View style={{ width: t, height: t, transform: [{ translateY: Math.round(fontSize * 0.14) }] }}>
      <VerifiedBadge size={t} />
    </View>
  );
}

/**
 * A name with its verified tick glued to the end. Use instead of putting a
 * <VerifiedTick> next to a <Txt> in a row (which strands the tick when the
 * name wraps). Takes the same text props as Txt.
 */
export function VerifiedName({
  name,
  row,
  verified,
  size = 15,
  font = "sansBold",
  lh,
  numberOfLines,
  align,
  style,
}: {
  name: string;
  row?: any;
  verified?: boolean;
  size?: number;
  font?: any;
  lh?: number;
  numberOfLines?: number;
  align?: "left" | "center" | "right";
  style?: StyleProp<TextStyle>;
}) {
  const v = verified ?? isVerified(row);
  return (
    <Txt size={size} font={font} lh={lh} numberOfLines={numberOfLines} align={align} style={style}>
      {name}
      {v ? "\u00A0" : ""}
      {v ? <InlineTick fontSize={size} /> : null}
    </Txt>
  );
}
