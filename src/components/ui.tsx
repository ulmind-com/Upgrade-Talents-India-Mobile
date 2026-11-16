import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaskedView } from "@/components/vendor";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/theme/ThemeProvider";
import { CheckCircle2, AlertTriangle, Info, XCircle } from "lucide-react-native";
import type { Palette } from "@/theme/tokens";
import { TONE_GRAD, type MsgTone } from "@/theme/tokens";

/* ─────────────── Text ─────────────── */
type Tone = "fg" | "muted" | "subtle" | "accent" | "primary" | "danger" | "success" | "warning" | "onAccent";
type FontKey =
  | "display" | "hero" | "heroSemi" | "sans" | "sansMed" | "sansSemi" | "sansBold" | "sansExt"
  | "mono" | "monoMed" | "cond" | "condBold" | "street" | "serif" | "serifItalic";

export function Txt({
  children,
  size = 15,
  tone = "fg",
  font = "sans",
  lh,
  tracking,
  align,
  style,
  numberOfLines,
  uppercase,
}: {
  children: React.ReactNode;
  size?: number;
  tone?: Tone;
  font?: FontKey;
  lh?: number;
  tracking?: number;
  align?: TextStyle["textAlign"];
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  uppercase?: boolean;
}) {
  const { c, fonts } = useTheme();
  const colorMap: Record<Tone, string> = {
    fg: c.fg, muted: c.fgMuted, subtle: c.fgSubtle, accent: c.accent,
    primary: c.primary, danger: c.danger, success: c.success, warning: c.warning, onAccent: c.onAccent,
  };
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          color: colorMap[tone],
          fontFamily: (fonts as any)[font],
          fontSize: size,
          lineHeight: lh ?? size * 1.4,
          letterSpacing: tracking,
          textAlign: align,
        },
        uppercase && { textTransform: "uppercase" },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ─────────────── Gradient text (brand mask) ─────────────── */
export function GradientText({
  children,
  size = 34,
  font = "display",
  lh,
  tracking = -0.5,
  style,
  colors,
}: {
  children: React.ReactNode;
  size?: number;
  font?: FontKey;
  lh?: number;
  tracking?: number;
  style?: StyleProp<TextStyle>;
  colors?: string[];
}) {
  const { c, fonts } = useTheme();
  const g = colors ?? c.gradBrand;
  const textStyle: StyleProp<TextStyle> = [
    { fontFamily: (fonts as any)[font], fontSize: size, lineHeight: lh ?? size * 1.02, letterSpacing: tracking },
    style,
  ];
  return (
    <MaskedView maskElement={<Text style={[textStyle, { color: "#000" }]}>{children}</Text>}>
      <LinearGradient colors={g as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={[textStyle, { opacity: 0 }]}>{children}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

/* ─────────────── Button ─────────────── */
export function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading,
  disabled,
  icon,
  iconRight,
  full,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "accent" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { c, fonts } = useTheme();
  const h = size === "sm" ? 42 : size === "lg" ? 56 : 50;
  const px = size === "sm" ? 20 : size === "lg" ? 34 : 28;
  const fs = size === "sm" ? 13 : size === "lg" ? 15 : 14;
  const isOff = disabled || loading;

  const press = () => {
    if (isOff) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress?.();
  };

  const textColor =
    variant === "primary" ? c.onAccent : variant === "ghost" ? c.fgMuted : c.fg;

  const content = (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        icon
      )}
      <Text
        style={{
          color: textColor,
          fontFamily: fonts.sansBold,
          fontSize: fs,
          letterSpacing: 1.2,
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      {iconRight}
    </View>
  );

  const base: ViewStyle = {
    height: h,
    paddingHorizontal: px,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    opacity: isOff ? 0.5 : 1,
    alignSelf: full ? "stretch" : "flex-start",
  };

  return (
    <Pressable onPress={press} disabled={isOff} style={({ pressed }) => [{ transform: [{ scale: pressed && !isOff ? 0.98 : 1 }] }, full && { alignSelf: "stretch" }, style]}>
      {variant === "primary" ? (
        <LinearGradient
          colors={c.gradBrand as any}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            base,
            { shadowColor: c.accent, shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 },
          ]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            base,
            variant === "accent" && { backgroundColor: c.surface2, borderWidth: 1, borderColor: c.borderStrong },
            variant === "outline" && { borderWidth: 1, borderColor: c.borderStrong, backgroundColor: "transparent" },
            variant === "ghost" && { backgroundColor: "transparent" },
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

/* ─────────────── Icon button (round) ─────────────── */
export function IconButton({
  children,
  onPress,
  size = 44,
  tone = "surface",
}: {
  children: React.ReactNode;
  onPress?: () => void;
  size?: number;
  tone?: "surface" | "glass" | "danger";
}) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: tone === "glass" ? c.surfaceGlass : c.surface,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      {children}
    </Pressable>
  );
}

/* ─────────────── Card ─────────────── */
export function Card({
  children,
  style,
  padding = 16,
  onPress,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  onPress?: () => void;
}) {
  const { c, radius } = useTheme();
  const body = (
    <View
      style={[
        {
          backgroundColor: c.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: c.border,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
  if (onPress)
    return (
      <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        {body}
      </Pressable>
    );
  return body;
}

/* ─────────────── Badge ─────────────── */
export function Badge({
  label,
  tone = "neutral",
  icon,
}: {
  label: string;
  tone?: "neutral" | "live" | "success" | "warning" | "danger" | "brand";
  icon?: React.ReactNode;
}) {
  const { c, fonts } = useTheme();
  const mix = (hex: string, amt: number) => hex + Math.round(amt * 255).toString(16).padStart(2, "0");
  const map: Record<string, { bg: string; fg: string; bd: string }> = {
    neutral: { bg: c.surface2, fg: c.fgMuted, bd: c.border },
    live: { bg: mix(c.danger, 0.16), fg: c.danger, bd: mix(c.danger, 0.4) },
    success: { bg: mix(c.success, 0.15), fg: c.success, bd: mix(c.success, 0.38) },
    warning: { bg: mix(c.warning, 0.15), fg: c.warning, bd: mix(c.warning, 0.38) },
    danger: { bg: mix(c.danger, 0.15), fg: c.danger, bd: mix(c.danger, 0.38) },
    brand: { bg: mix(c.accent, 0.16), fg: c.accent, bd: mix(c.accent, 0.38) },
  };
  const s = map[tone];
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "flex-start",
        backgroundColor: s.bg,
        borderColor: s.bd,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 11,
        paddingVertical: 5,
      }}
    >
      {tone === "live" && <Dot color={s.fg} pulse />}
      {icon}
      <Text style={{ color: s.fg, fontFamily: fonts.sansBold, fontSize: 10.5, letterSpacing: 1, textTransform: "uppercase" }}>
        {label}
      </Text>
    </View>
  );
}

/* ─────────────── Pulse dot ─────────────── */
export function Dot({ color, pulse, size = 7 }: { color: string; pulse?: boolean; size?: number }) {
  const a = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!pulse) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 0.3, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
        Animated.timing(a, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.inOut(Easing.ease) }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={{ width: size, height: size, borderRadius: size, backgroundColor: color, opacity: pulse ? a : 1 }} />;
}

/* ─────────────── Section label (eyebrow) ─────────────── */
export function SectionLabel({ children }: { children: React.ReactNode }) {
  const { c, fonts } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      <Dot color={c.accent} pulse size={8} />
      <Text style={{ color: c.fgMuted, fontFamily: fonts.monoMed, fontSize: 11, letterSpacing: 3, textTransform: "uppercase" }}>
        {children}
      </Text>
    </View>
  );
}

/* ─────────────── Chip (filter) ─────────────── */
export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress?: () => void }) {
  const { c, fonts } = useTheme();
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={{
        paddingHorizontal: 16,
        height: 38,
        justifyContent: "center",
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? "transparent" : c.border,
        backgroundColor: active ? c.accent : c.surface,
      }}
    >
      <Text style={{ color: active ? c.onAccent : c.fgMuted, fontFamily: fonts.sansSemi, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

/* ─────────────── Field + Input ─────────────── */
export function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  const { c, fonts } = useTheme();
  return (
    <View style={{ gap: 7 }}>
      <Text style={{ color: c.fg, fontFamily: fonts.sansSemi, fontSize: 13 }}>
        {label}
        {required ? <Text style={{ color: c.accent }}> *</Text> : null}
      </Text>
      {children}
      {error ? (
        <Text style={{ color: c.danger, fontFamily: fonts.sansMed, fontSize: 12 }}>{error}</Text>
      ) : hint ? (
        <Text style={{ color: c.fgSubtle, fontFamily: fonts.sans, fontSize: 12 }}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Input({
  invalid,
  style,
  ...props
}: TextInputProps & { invalid?: boolean }) {
  const { c, fonts, radius } = useTheme();
  return (
    <TextInput
      placeholderTextColor={c.fgSubtle}
      style={[
        {
          minHeight: 50,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: invalid ? c.danger : c.borderStrong,
          backgroundColor: c.bgElevated,
          color: c.fg,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontFamily: fonts.sansMed,
          fontSize: 15,
        },
        style,
      ]}
      {...props}
    />
  );
}

/* ─────────────── Divider ─────────────── */
export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ height: 1, backgroundColor: c.border }, style]} />;
}

/* ─────────────── Skeleton (shimmer) ─────────────── */
export function Skeleton({ h = 16, w = "100%", radius = 10, style }: { h?: number; w?: any; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 1300, useNativeDriver: true, easing: Easing.linear }));
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.4, 0.8, 0.4] });
  return <Animated.View style={[{ height: h, width: w, borderRadius: radius, backgroundColor: c.surface2, opacity }, style]} />;
}

/* ─────────────── Empty state ─────────────── */
export function EmptyState({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 56, gap: 12 }}>
      {icon ? (
        <View style={{ width: 72, height: 72, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
          {icon}
        </View>
      ) : null}
      <Txt size={17} font="sansBold" align="center">{title}</Txt>
      {subtitle ? <Txt size={14} tone="muted" align="center" style={{ maxWidth: 300 }}>{subtitle}</Txt> : null}
    </View>
  );
}

/* ─────────────── Ambient glow (soft radial spotlight) ─────────────── */
export function Glow({ color, size = 340, top, left, right, bottom }: { color: string; size?: number; top?: number; left?: number; right?: number; bottom?: number }) {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <View pointerEvents="none" style={{ position: "absolute", top, left, right, bottom, width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.9} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

/* ─────────────── Error state (with retry) ─────────────── */
export function ErrorState({ message, onRetry }: { message?: string | null; onRetry?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 14 }}>
      <View style={{ width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
        <Text style={{ color: c.danger, fontSize: 26 }}>!</Text>
      </View>
      <Txt size={16} font="sansBold" align="center">Couldn't load this</Txt>
      <Txt size={13.5} tone="muted" align="center" style={{ maxWidth: 300 }}>{message || "Check your connection and try again. The server may be waking up."}</Txt>
      {onRetry ? <Button label="Retry" variant="outline" onPress={onRetry} /> : null}
    </View>
  );
}

/* ─────────────── Inline alert ─────────────── */
export function Alert({ tone = "error", children }: { tone?: MsgTone; children: React.ReactNode }) {
  const { c, fonts } = useTheme();
  const [g1, g2] = TONE_GRAD[tone];
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? AlertTriangle : tone === "info" ? Info : XCircle;

  // Same language as the floating popup: gradient rail, gradient icon tile,
  // surface card — so a message looks the same wherever it appears.
  return (
    <View style={{ borderRadius: 18, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, flexDirection: "row", shadowColor: g2, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 }}>
      <LinearGradient colors={[g1, g2] as any} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ width: 5 }} />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 13, flex: 1 }}>
        <View style={{ width: 32, height: 32, borderRadius: 11, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
          <LinearGradient colors={[g1, g2] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
          <Icon size={17} color="#fff" />
        </View>
        <Text style={{ flex: 1, color: c.fg, fontFamily: fonts.sansMed, fontSize: 13.5, lineHeight: 19 }}>{children}</Text>
      </View>
    </View>
  );
}

export { ScrollView };
export type { Palette };
