import React, { useEffect, useRef, useState } from "react";
import { View, Animated, Easing, StyleProp, ViewStyle, Dimensions } from "react-native";
import Svg, { Defs, Pattern, Circle, Line, Rect, Path } from "react-native-svg";

const SCREEN_W = Dimensions.get("window").width;

/* Sawtooth / zigzag top edge — the band colour fills below, teeth point up. */
export function ZigzagTop({ color, height = 16, width = SCREEN_W }: { color: string; height?: number; width?: number }) {
  const n = Math.max(6, Math.round(width / 26));
  const tw = width / n;
  let d = `M0 ${height}`;
  for (let i = 0; i < n; i++) d += ` L ${i * tw + tw / 2} 0 L ${(i + 1) * tw} ${height}`;
  d += ` L ${width} ${height} L 0 ${height} Z`;
  return (
    <Svg width={width} height={height} style={{ marginBottom: -1 }}>
      <Path d={d} fill={color} />
    </Svg>
  );
}
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";

/* Dotted grid fill (academy / blueprint vibe). */
export function DottedGrid({ color, opacity = 1, gap = 22, r = 1.4 }: { color: string; opacity?: number; gap?: number; r?: number }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: "100%", height: "100%", opacity }}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse">
            <Circle cx={r} cy={r} r={r} fill={color} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/* Layered flowing wave top edge (op "dheu" look) — band colour fills below,
   an optional back wave adds depth. */
export function WaveEdge({ color, back, height = 26, width = SCREEN_W }: { color: string; back?: string; height?: number; width?: number }) {
  const h = height;
  const w = width;
  const front = `M0 ${h} C ${w * 0.18} ${h * 0.0}, ${w * 0.3} ${h * 0.95}, ${w * 0.5} ${h * 0.5} C ${w * 0.7} ${h * 0.05}, ${w * 0.82} ${h * 0.95}, ${w} ${h * 0.35} L ${w} ${h} L 0 ${h} Z`;
  const backP = `M0 ${h} C ${w * 0.22} ${h * 0.5}, ${w * 0.4} ${h * 0.1}, ${w * 0.58} ${h * 0.55} C ${w * 0.78} ${h * 0.95}, ${w * 0.9} ${h * 0.2}, ${w} ${h * 0.55} L ${w} ${h} L 0 ${h} Z`;
  return (
    <Svg width={w} height={h} style={{ marginBottom: -1 }}>
      {back ? <Path d={backP} fill={back} opacity={0.65} /> : null}
      <Path d={front} fill={color} />
    </Svg>
  );
}

/**
 * A full-bleed section whose top AND bottom edges are waves, with nothing
 * opaque outside them — so the page (and whatever glow it is painting) flows
 * straight through the curve instead of hitting a flat seam. Every layer that
 * paints the band goes in `backdrop`; it is clipped to the band's interior so
 * it can never bleed into the sections above or below.
 */
/* A single diagonal slash across the top — the band reads as a cut sheet
   rather than a pasted rectangle. An optional stroke lights the cut up. */
export function BladeTop({ color, height = 22, width = SCREEN_W, stroke }: { color: string; height?: number; width?: number; stroke?: string }) {
  return (
    <Svg width={width} height={height} style={{ marginBottom: -1 }} pointerEvents="none">
      <Path d={`M0 ${height} L ${width} 0 L ${width} ${height} Z`} fill={color} />
      {stroke ? <Path d={`M0 ${height} L ${width} 0`} stroke={stroke} strokeWidth={2.5} strokeLinecap="round" fill="none" /> : null}
    </Svg>
  );
}

/* Concentric rings radiating from a point — stadium radar / sound-wave feel. */
export function ArcRings({ color, opacity = 1, cx, cy, count = 7, gap = 52, w = 1.2 }: { color: string; opacity?: number; cx: number; cy: number; count?: number; gap?: number; w?: number }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: "100%", height: "100%", opacity }}>
      <Svg width="100%" height="100%">
        {Array.from({ length: count }).map((_, i) => (
          <Circle key={i} cx={cx} cy={cy} r={gap * (i + 1)} stroke={color} strokeWidth={w} fill="none" />
        ))}
      </Svg>
    </View>
  );
}

function Edge({ kind, color, height, stroke }: { kind: "wave" | "zigzag" | "blade"; color: string; height: number; stroke?: string }) {
  if (kind === "blade") return <BladeTop color={color} height={height} stroke={stroke} />;
  if (kind === "zigzag") return <ZigzagTop color={color} height={height} />;
  return <WaveEdge color={color} height={height} />;
}

export function WaveBand({
  color,
  bottomColor,
  backdrop,
  children,
  wave = 26,
  paddingTop = 24,
  paddingBottom = 24,
  flip,
  edge = "wave",
  edgeStroke,
  style,
}: {
  color: string;
  bottomColor?: string;
  backdrop?: React.ReactNode;
  children: React.ReactNode;
  wave?: number;
  paddingTop?: number;
  paddingBottom?: number;
  /** Mirrors the curves, so neighbouring bands never share a silhouette. */
  flip?: boolean;
  /** Edge silhouette — a flowing wave, sawtooth teeth, or a diagonal cut. */
  edge?: "wave" | "zigzag" | "blade";
  /** Lights up the cut with a neon line (blade edges only). */
  edgeStroke?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ paddingTop: paddingTop + wave, paddingBottom: paddingBottom + wave }, style]}>
      <View style={{ position: "absolute", top: wave - 1, left: 0, right: 0, bottom: wave - 1, overflow: "hidden" }}>
        <View style={{ position: "absolute", width: "100%", height: "100%", backgroundColor: color }} />
        {backdrop}
      </View>
      <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, transform: flip ? [{ scaleX: -1 }] : [] }}>
        <Edge kind={edge} color={color} height={wave} stroke={edgeStroke} />
      </View>
      <View pointerEvents="none" style={{ position: "absolute", bottom: 0, left: 0, right: 0, transform: flip ? [{ rotate: "180deg" }, { scaleX: -1 }] : [{ rotate: "180deg" }] }}>
        <Edge kind={edge} color={bottomColor || color} height={wave} stroke={edgeStroke} />
      </View>
      {children}
    </View>
  );
}

/* Horizontal scanlines fill (CRT / broadcast vibe). */
export function Scanlines({ color, opacity = 1, gap = 5 }: { color: string; opacity?: number; gap?: number }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: "100%", height: "100%", opacity }}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse">
            <Line x1={0} y1={0} x2={gap} y2={0} stroke={color} strokeWidth={1} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/* Diagonal stripes fill (ticket / energy vibe). */
export function DiagonalStripes({ color, opacity = 1, gap = 16, w = 7 }: { color: string; opacity?: number; gap?: number; w?: number }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View pointerEvents="none" style={{ position: "absolute", width: "100%", height: "100%", opacity }}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={gap} height={gap} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Line x1={0} y1={0} x2={0} y2={gap} stroke={color} strokeWidth={w} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/* Auto-scrolling text ticker (marquee headline strip). */
export function TextTicker({ text, color, size = 26, font = "street", gap = 26, speed = 60, style }: { text: string; color: string; size?: number; font?: any; gap?: number; speed?: number; style?: StyleProp<ViewStyle> }) {
  const { fonts } = useTheme();
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!w) return;
    x.setValue(0);
    const loop = Animated.loop(Animated.timing(x, { toValue: -w, duration: (w / speed) * 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [w]);

  const Item = ({ onLayout }: any) => (
    <View onLayout={onLayout} style={{ flexDirection: "row", alignItems: "center", paddingRight: gap }}>
      <Txt size={size} font={font} style={{ color }}>{text}</Txt>
      <View style={{ width: 8, height: 8, borderRadius: 8, backgroundColor: color, marginLeft: gap - 4 }} />
    </View>
  );

  return (
    <View style={[{ overflow: "hidden" }, style]}>
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: x }] }}>
        <Item onLayout={(e: any) => setW(e.nativeEvent.layout.width)} />
        <Item />
        <Item />
      </Animated.View>
    </View>
  );
}

/** A ticket's torn edge: two half-notches bitten out of the sides, dashes between. */
export function Perforation({ color, bg, notch = 11 }: { color: string; bg: string; notch?: number }) {
  return (
    <View style={{ height: notch, justifyContent: "center" }}>
      <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: notch / 2 + 4, gap: 5 }}>
        {Array.from({ length: 34 }).map((_, i) => (
          <View key={i} style={{ flex: 1, height: 1, backgroundColor: color }} />
        ))}
      </View>
      <View style={{ position: "absolute", left: -notch / 2, width: notch, height: notch, borderRadius: 999, backgroundColor: bg }} />
      <View style={{ position: "absolute", right: -notch / 2, width: notch, height: notch, borderRadius: 999, backgroundColor: bg }} />
    </View>
  );
}
