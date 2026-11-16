import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, Pressable, TextInput, ScrollView, Modal as RNModal, Animated, Easing,
  ActivityIndicator, StyleProp, ViewStyle, TextStyle, Dimensions,
} from "react-native";
import Svg, { Path, Defs, Pattern, Rect, G } from "react-native-svg";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { AlertCircle, Inbox, X, ArrowUpRight, Search, ChevronLeft, ChevronRight, Check } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { ADMIN_DARK, ADMIN_LIGHT, adminFonts, type AdminPalette } from "@/theme/adminTokens";

/* ═══════════ THEME ═══════════ */

const Ctx = createContext<AdminPalette>(ADMIN_LIGHT);

/** Supplies the control room palette, following the app's light/dark choice. */
export function AdminTheme({ children }: { children: React.ReactNode }) {
  const { name } = useTheme();
  const p = name === "dark" ? ADMIN_DARK : ADMIN_LIGHT;
  return <Ctx.Provider value={p}>{children}</Ctx.Provider>;
}

export const useAdmin = () => useContext(Ctx);
export const F = adminFonts;

/** The site's single easing curve, cubic-bezier(0.16, 1, 0.3, 1). */
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/* ═══════════ TEXT ═══════════ */

type TProps = {
  children: React.ReactNode;
  size?: number;
  font?: keyof typeof adminFonts;
  color?: string;
  mut?: boolean;
  sub?: boolean;
  upper?: boolean;
  track?: number;
  lh?: number;
  align?: "left" | "center" | "right";
  numberOfLines?: number;
  style?: StyleProp<TextStyle>;
};

export function T({ children, size = 13, font = "regular", color, mut, sub, upper, track, lh, align, numberOfLines, style }: TProps) {
  const c = useAdmin();
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontFamily: adminFonts[font],
          fontSize: size,
          color: color || (sub ? c.fgSubtle : mut ? c.fgMuted : c.fg),
          lineHeight: lh ?? Math.round(size * 1.45),
          letterSpacing: track,
          textAlign: align,
        },
        upper ? { textTransform: "uppercase" } : null,
        style,
      ]}
    >
      {children}
    </Text>
  );
}

/* ═══════════ BUTTON ═══════════ */

export function AButton({
  label, onPress, variant = "primary", size = "md", loading, disabled, icon, iconRight, full, style,
}: {
  label?: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconRight?: React.ReactNode;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const c = useAdmin();
  const off = disabled || loading;
  const h = size === "sm" ? 36 : 44;        // h-9 / h-11
  const px = size === "sm" ? 14 : 20;
  const fs = size === "sm" ? 12.5 : 13.5;

  const bg =
    variant === "primary" ? c.brand :
    variant === "danger" ? c.danger :
    variant === "success" ? c.success :
    variant === "secondary" ? c.surface : "transparent";
  const fg =
    variant === "primary" ? c.onBrand :
    variant === "danger" || variant === "success" ? "#ffffff" :
    variant === "ghost" ? c.fgMuted : c.fg;

  return (
    <Pressable
      onPress={() => { if (off) return; Haptics.selectionAsync().catch(() => {}); onPress?.(); }}
      style={({ pressed }) => [
        {
          height: h, paddingHorizontal: px, borderRadius: 12,
          flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
          backgroundColor: pressed && variant === "ghost" ? c.surface2 : bg,
          borderWidth: variant === "secondary" ? 1 : 0,
          borderColor: c.borderStrong,
          opacity: off ? 0.5 : pressed ? 0.88 : 1,
          alignSelf: full ? "stretch" : "flex-start",
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon}
      {label ? <T size={fs} font="semi" color={fg}>{label}</T> : null}
      {iconRight}
    </Pressable>
  );
}

/* ═══════════ BADGE ═══════════ */

export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";

export function ABadge({ children, tone = "neutral", icon }: { children: React.ReactNode; tone?: Tone; icon?: React.ReactNode }) {
  const c = useAdmin();
  const map: Record<Tone, [string, string]> = {
    neutral: [c.surface3, c.fgMuted],
    brand: [c.brandSoft, c.brand],
    success: [c.successSoft, c.success],
    warning: [c.warningSoft, c.warning],
    danger: [c.dangerSoft, c.danger],
    info: [c.infoSoft, c.info],
  };
  const [bg, fg] = map[tone] || map.neutral;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
      {icon}
      <T size={11.5} font="semi" color={fg}>{children}</T>
    </View>
  );
}

const STATUS_TONE: Record<string, Tone> = {
  published: "success", active: "success", confirmed: "success", paid: "success", approved: "success",
  completed: "success", open: "success", live: "success", issued: "success", delivered: "success",
  pending: "warning", draft: "warning", processing: "warning", scheduled: "warning", upcoming: "info",
  cancelled: "danger", failed: "danger", revoked: "danger", expired: "danger", closed: "neutral",
  archived: "neutral", refunded: "info",
};

/** Maps common backend status strings onto badge tones, as the web kit does. */
export function AStatusBadge({ value }: { value?: string | boolean | null }) {
  const c = useAdmin();
  if (value === true) return <ABadge tone="success">Yes</ABadge>;
  if (value === false) return <ABadge tone="neutral">No</ABadge>;
  const v = String(value ?? "").toLowerCase();
  if (!v) return <T size={13} color={c.fgSubtle}>—</T>;
  return <ABadge tone={STATUS_TONE[v] || "neutral"}>{v.replace(/_/g, " ")}</ABadge>;
}

/* ═══════════ CARD / PANEL ═══════════ */

export function card(c: AdminPalette): ViewStyle {
  return {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    shadowColor: c.shadowCard.color,
    shadowOpacity: c.shadowCard.opacity,
    shadowRadius: c.shadowCard.radius,
    shadowOffset: { width: 0, height: c.shadowCard.offsetY },
    elevation: c.shadowCard.elevation,
  };
}

export function APanel({
  title, subtitle, action, children, style, bodyStyle, flush,
}: {
  title?: React.ReactNode; subtitle?: string; action?: React.ReactNode;
  children: React.ReactNode; style?: StyleProp<ViewStyle>; bodyStyle?: StyleProp<ViewStyle>; flush?: boolean;
}) {
  const c = useAdmin();
  return (
    <View style={[card(c), { overflow: "hidden", marginBottom: 16 }, style]}>
      {title || action ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 20, paddingVertical: 14 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            {typeof title === "string" ? <T size={15} font="bold" numberOfLines={1}>{title}</T> : title}
            {subtitle ? <T size={12.5} mut style={{ marginTop: 2 }}>{subtitle}</T> : null}
          </View>
          {action}
        </View>
      ) : null}
      <View style={[{ padding: flush ? 0 : 20 }, bodyStyle]}>{children}</View>
    </View>
  );
}

/* ═══════════ STATES ═══════════ */

/** Shimmering placeholder, matching the site's `.skeleton` keyframes. */
export function ASkeleton({ h = 48, w, radius = 8, style }: { h?: number; w?: number | string; radius?: number; style?: StyleProp<ViewStyle> }) {
  const c = useAdmin();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(x, { toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const W = typeof w === "number" ? w : Dimensions.get("window").width;
  return (
    <View style={[{ height: h, width: (w as any) ?? "100%", borderRadius: radius, backgroundColor: c.surface2, overflow: "hidden" }, style]}>
      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, width: W, transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-W, W] }) }] }}>
        <LinearGradient colors={[c.surface2, c.surface3, c.surface2]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

export function ALoading({ rows = 4 }: { rows?: number }) {
  return <View style={{ gap: 10 }}>{Array.from({ length: rows }).map((_, i) => <ASkeleton key={i} h={48} />)}</View>;
}

export function AErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const c = useAdmin();
  return (
    <View style={{ alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, borderColor: c.danger, backgroundColor: c.dangerSoft, paddingHorizontal: 24, paddingVertical: 40 }}>
      <AlertCircle size={28} color={c.danger} />
      <T size={13} font="medium" color={c.danger} align="center">{message}</T>
      {onRetry ? <AButton label="Retry" variant="secondary" size="sm" onPress={onRetry} /> : null}
    </View>
  );
}

export function AEmptyState({ title, body, action }: { title: string; body?: string; action?: React.ReactNode }) {
  const c = useAdmin();
  return (
    <View style={{ alignItems: "center", gap: 12, borderRadius: 12, borderWidth: 1, borderStyle: "dashed", borderColor: c.borderStrong, paddingHorizontal: 24, paddingVertical: 48 }}>
      <Inbox size={32} color={c.fgSubtle} />
      <T size={15} font="bold" align="center">{title}</T>
      {body ? <T size={13} mut align="center">{body}</T> : null}
      {action}
    </View>
  );
}

/* ═══════════ FORM ═══════════ */

export function AField({ label, hint, error, required, children }: { label: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode }) {
  const c = useAdmin();
  return (
    <View style={{ gap: 6, marginBottom: 14 }}>
      <T size={12.5} font="semi">
        {label}{required ? <T size={12.5} font="semi" color={c.danger}> *</T> : null}
      </T>
      {hint ? <T size={11.5} sub>{hint}</T> : null}
      {children}
      {error ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <AlertCircle size={12} color={c.danger} />
          <T size={11.5} color={c.danger}>{error}</T>
        </View>
      ) : null}
    </View>
  );
}

export function AInput({
  value, onChangeText, placeholder, invalid, multiline, keyboardType, autoCapitalize, secureTextEntry, onSubmitEditing, style,
}: {
  value?: string; onChangeText?: (v: string) => void; placeholder?: string; invalid?: boolean; multiline?: boolean;
  keyboardType?: any; autoCapitalize?: any; secureTextEntry?: boolean; onSubmitEditing?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const c = useAdmin();
  const [focus, setFocus] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={c.fgSubtle}
      multiline={multiline}
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      secureTextEntry={secureTextEntry}
      onSubmitEditing={onSubmitEditing}
      onFocus={() => setFocus(true)}
      onBlur={() => setFocus(false)}
      style={[
        {
          minHeight: multiline ? 92 : 44,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: invalid ? c.danger : focus ? c.brand : c.border,
          backgroundColor: c.surface2,
          paddingHorizontal: 14,
          paddingVertical: multiline ? 12 : 0,
          fontFamily: adminFonts.regular,
          fontSize: 13.5,
          color: c.fg,
          textAlignVertical: multiline ? "top" : "center",
        },
        style as any,
      ]}
    />
  );
}

export function ASelect({ value, options, onChange }: { value?: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const c = useAdmin();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {options.map((o) => {
        const on = String(value ?? "") === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(o.value); }}
            style={{ height: 40, paddingHorizontal: 14, borderRadius: 12, justifyContent: "center", borderWidth: 1, borderColor: on ? c.brand : c.border, backgroundColor: on ? c.brandSoft : c.surface2 }}
          >
            <T size={13} font={on ? "semi" : "regular"} color={on ? c.brand : c.fgMuted}>{o.label}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function AToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  const c = useAdmin();
  const a = useRef(new Animated.Value(checked ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: checked ? 1 : 0, duration: 200, easing: EASE, useNativeDriver: true }).start();
  }, [checked]);
  return (
    <Pressable
      onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(!checked); }}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, borderRadius: 12, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, paddingHorizontal: 14, paddingVertical: 12 }}
    >
      <T size={13} font="medium" style={{ flex: 1 }}>{label}</T>
      <View style={{ width: 44, height: 24, borderRadius: 999, backgroundColor: checked ? c.brand : c.borderStrong, justifyContent: "center" }}>
        <Animated.View
          style={{
            width: 20, height: 20, borderRadius: 999, backgroundColor: "#fff",
            transform: [{ translateX: a.interpolate({ inputRange: [0, 1], outputRange: [2, 22] }) }],
            shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 2, shadowOffset: { width: 0, height: 1 },
          }}
        />
      </View>
    </Pressable>
  );
}

/* ═══════════ SEARCH ═══════════ */

export function ASearch({ value, onChangeText, placeholder = "Search" }: { value: string; onChangeText: (v: string) => void; placeholder?: string }) {
  const c = useAdmin();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10, height: 40, borderRadius: 12, borderWidth: 1, borderColor: focus ? c.brand : c.border, backgroundColor: c.surface2, paddingHorizontal: 14 }}>
      <Search size={16} color={c.fgSubtle} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.fgSubtle}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
        style={{ flex: 1, fontFamily: adminFonts.regular, fontSize: 13, color: c.fg }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText("")} hitSlop={8}><X size={14} color={c.fgSubtle} /></Pressable>
      ) : null}
    </View>
  );
}

/* ═══════════ MODAL ═══════════ */

/** Bottom sheet on phones, matching the web dialog's motion and chrome. */
export function AModal({
  open, onClose, title, subtitle, children, footer,
}: {
  open: boolean; onClose: () => void; title: string; subtitle?: string;
  children: React.ReactNode; footer?: React.ReactNode;
}) {
  const c = useAdmin();
  const { name } = useTheme();
  const a = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(a, { toValue: open ? 1 : 0, duration: 280, easing: EASE, useNativeDriver: true }).start();
  }, [open]);

  return (
    <RNModal visible={open} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={{ flex: 1, justifyContent: "flex-end", opacity: a }}>
        <Pressable onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
          <BlurView intensity={18} tint={name === "dark" ? "dark" : "light"} style={{ flex: 1, backgroundColor: c.scrim }} />
        </Pressable>

        <Animated.View
          style={{
            maxHeight: "92%",
            backgroundColor: c.surface,
            borderTopLeftRadius: 16, borderTopRightRadius: 16,
            shadowColor: c.shadowPop.color, shadowOpacity: c.shadowPop.opacity, shadowRadius: c.shadowPop.radius, shadowOffset: { width: 0, height: -c.shadowPop.offsetY }, elevation: c.shadowPop.elevation,
            transform: [
              { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) },
            ],
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 16, borderBottomWidth: 1, borderBottomColor: c.border, paddingHorizontal: 24, paddingVertical: 16 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={16} font="bold">{title}</T>
              {subtitle ? <T size={12.5} mut style={{ marginTop: 2 }}>{subtitle}</T> : null}
            </View>
            <Pressable onPress={onClose} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? c.surface2 : "transparent" })}>
              <X size={16} color={c.fgMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 20 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>

          {footer ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 10, borderTopWidth: 1, borderTopColor: c.border, paddingHorizontal: 24, paddingVertical: 16 }}>
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </RNModal>
  );
}

/* ═══════════ DASHBOARD PIECES ═══════════ */

/** Headline metric tile. The first in a row is `accent`, on the brand surface. */
export function AStatCard({
  label, value, hint, Icon, accent, index = 0, onPress, style,
}: {
  label: string; value: string | number; hint?: string; Icon?: any; accent?: boolean; index?: number;
  onPress?: () => void; style?: StyleProp<ViewStyle>;
}) {
  const c = useAdmin();
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 450, delay: index * 60, easing: EASE, useNativeDriver: true }).start();
  }, []);

  const fg = accent ? "#ffffff" : c.fg;
  const body = (
    <Animated.View
      style={[
        {
          borderRadius: 16, padding: 20, justifyContent: "space-between", gap: 24, overflow: "hidden",
          borderWidth: accent ? 0 : 1, borderColor: c.border,
          backgroundColor: accent ? c.brand : c.surface,
          shadowColor: c.shadowCard.color, shadowOpacity: accent ? 0 : c.shadowCard.opacity, shadowRadius: c.shadowCard.radius, shadowOffset: { width: 0, height: c.shadowCard.offsetY }, elevation: accent ? 0 : c.shadowCard.elevation,
          opacity: a,
          transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
        style,
      ]}
    >
      {accent ? (
        <LinearGradient
          colors={[c.brand, c.brandHover]}
          start={{ x: 0.1, y: 0 }}
          end={{ x: 0.9, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <T size={13.5} font="semi" color={accent ? "rgba(255,255,255,0.9)" : c.fg} style={{ flex: 1 }}>{label}</T>
        <View style={{ width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: accent ? "rgba(255,255,255,0.3)" : c.border, backgroundColor: accent ? "rgba(255,255,255,0.15)" : "transparent" }}>
          <ArrowUpRight size={16} color={accent ? "#fff" : c.fgMuted} />
        </View>
      </View>

      <View>
        <T size={40} font="bold" lh={40} color={fg}>{value}</T>
        {hint ? (
          <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: accent ? "rgba(255,255,255,0.15)" : c.surface3 }}>
            {Icon ? <Icon size={12} color={accent ? "rgba(255,255,255,0.9)" : c.fgMuted} /> : null}
            <T size={11} font="medium" color={accent ? "rgba(255,255,255,0.9)" : c.fgMuted}>{hint}</T>
          </View>
        ) : null}
      </View>
    </Animated.View>
  );

  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>{body}</Pressable> : body;
}

/** Vertical bars with a hatched remainder — the reference's analytics card. */
export function AHatchBars({ data, peakLabel, height = 230 }: { data: { label: string; value: number }[]; peakLabel?: string; height?: number }) {
  const c = useAdmin();
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.reduce((a, b) => (b.value > a.value ? b : a), data[0]);
  const grow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(grow, { toValue: 1, duration: 800, easing: EASE, useNativeDriver: false }).start();
  }, [data.length]);

  if (!data.length) return null;

  return (
    <View style={{ height, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 10 }}>
      {data.map((d, i) => {
        const pct = Math.max((d.value / max) * 100, d.value > 0 ? 8 : 0);
        const isPeak = d.label === peak?.label && d.value > 0;
        return (
          <View key={`${d.label}-${i}`} style={{ flex: 1, height: "100%", alignItems: "center", gap: 10 }}>
            {isPeak && peakLabel ? (
              <View style={{ position: "absolute", top: -4, zIndex: 10, backgroundColor: c.brand, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <T size={10} font="bold" color="#fff">{peakLabel}</T>
              </View>
            ) : null}

            <View style={{ flex: 1, width: "100%", maxWidth: 52, borderRadius: 999, borderBottomLeftRadius: 12, borderBottomRightRadius: 12, overflow: "hidden", justifyContent: "flex-end", backgroundColor: "transparent" }}>
              <Hatch color={c.hatch} />
              <Animated.View
                style={{
                  width: "100%",
                  height: grow.interpolate({ inputRange: [0, 1], outputRange: ["0%", `${pct}%`] }),
                  borderRadius: 999, borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
                  backgroundColor: isPeak ? c.brand : c.brandBright,
                  opacity: d.value > 0 ? 1 : 0,
                }}
              />
            </View>

            <T size={11} font="medium" mut numberOfLines={1}>{d.label}</T>
          </View>
        );
      })}
    </View>
  );
}

/** Diagonal hatch fill, as `.hatch` paints on the web. */
export function Hatch({ color }: { color: string }) {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="adminHatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <Rect width={2} height={6} fill={color} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#adminHatch)" />
      </Svg>
    </View>
  );
}

/** Semi-circular progress gauge with a hatched remainder. */
export function AGauge({ percent, caption }: { percent: number; caption: string }) {
  const c = useAdmin();
  const p = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const C = Math.PI * 70;
  const anim = useRef(new Animated.Value(0)).current;
  const [offset, setOffset] = useState(C);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setOffset(C - (C * p * value) / 100));
    Animated.timing(anim, { toValue: 1, duration: 1100, easing: EASE, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [p]);

  const d = "M20 94 A70 70 0 0 1 160 94";
  return (
    <View style={{ alignSelf: "center", width: "100%", maxWidth: 240 }}>
      <Svg viewBox="0 0 180 104" width="100%" height={118}>
        <Defs>
          <Pattern id="gaugeHatch" width={6} height={6} patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <Rect width={2} height={6} fill={c.hatch} />
          </Pattern>
        </Defs>
        <G>
          <Path d={d} fill="none" stroke="url(#gaugeHatch)" strokeWidth={24} strokeLinecap="round" />
          <Path d={d} fill="none" stroke={c.brand} strokeWidth={24} strokeLinecap="round" strokeDasharray={`${C} ${C}`} strokeDashoffset={offset} />
        </G>
      </Svg>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center" }}>
        <T size={34} font="bold" lh={34}>{p}%</T>
        <T size={12} mut style={{ marginTop: 4 }}>{caption}</T>
      </View>
    </View>
  );
}

/** Compact two-column key/value list used across detail panels. */
export function AKeyValues({ items }: { items: { k: string; v: React.ReactNode }[] }) {
  const c = useAdmin();
  return (
    <View>
      {items.map((it, i) => (
        <View key={it.k} style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 24, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
          <T size={12} font="semi" sub upper track={0.6}>{it.k}</T>
          {typeof it.v === "string" || typeof it.v === "number"
            ? <T size={13} font="medium" align="right" style={{ flex: 1 }}>{String(it.v)}</T>
            : <View style={{ flex: 1, alignItems: "flex-end" }}>{it.v ?? <T size={13} sub>—</T>}</View>}
        </View>
      ))}
    </View>
  );
}

/* ═══════════ TABLE → MOBILE LIST ═══════════ */

/** The DataTable's phone form: a searchable, paged stack of record rows. */
export function AList<T>({
  rows, loading, error, onRetry, search, onSearch, searchPlaceholder, pageSize = 20,
  renderRow, empty, toolbar, keyOf,
}: {
  rows: T[]; loading?: boolean; error?: string | null; onRetry?: () => void;
  search?: string; onSearch?: (v: string) => void; searchPlaceholder?: string; pageSize?: number;
  renderRow: (row: T, i: number) => React.ReactNode;
  empty?: { title: string; body?: string; action?: React.ReactNode };
  toolbar?: React.ReactNode;
  keyOf?: (row: T, i: number) => string;
}) {
  const c = useAdmin();
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  useEffect(() => { setPage(1); }, [rows.length, search]);
  const slice = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [rows, page, pageSize]);

  return (
    <View style={{ gap: 16 }}>
      {onSearch || toolbar ? (
        <View style={{ gap: 10 }}>
          {onSearch ? <ASearch value={search || ""} onChangeText={onSearch} placeholder={searchPlaceholder} /> : null}
          {toolbar ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{toolbar}</View> : null}
        </View>
      ) : null}

      {loading ? (
        <ALoading />
      ) : error ? (
        <AErrorState message={error} onRetry={onRetry} />
      ) : !rows.length ? (
        <AEmptyState title={empty?.title || "Nothing here yet"} body={empty?.body} action={empty?.action} />
      ) : (
        <>
          <View style={{ gap: 12 }}>
            {slice.map((row, i) => (
              <View key={keyOf?.(row, i) || i}>{renderRow(row, i)}</View>
            ))}
          </View>

          {totalPages > 1 ? (
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16, paddingTop: 4 }}>
              <T size={12.5} mut>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, rows.length)} of {rows.length}</T>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <PageBtn disabled={page <= 1} onPress={() => setPage((p) => p - 1)}><ChevronLeft size={16} color={c.fg} /></PageBtn>
                <T size={12.5} font="semi" style={{ paddingHorizontal: 8 }}>{page} / {totalPages}</T>
                <PageBtn disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)}><ChevronRight size={16} color={c.fg} /></PageBtn>
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

function PageBtn({ children, disabled, onPress }: { children: React.ReactNode; disabled?: boolean; onPress: () => void }) {
  const c = useAdmin();
  return (
    <Pressable
      onPress={() => !disabled && onPress()}
      style={{ width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.border, opacity: disabled ? 0.4 : 1 }}
    >
      {children}
    </Pressable>
  );
}

/** A record as the table renders one row: title line, then labelled cells. */
export function ARow({
  title, subtitle, badge, cells, actions, onPress,
}: {
  title: string; subtitle?: string; badge?: React.ReactNode;
  cells?: { label: string; value: React.ReactNode }[];
  actions?: React.ReactNode; onPress?: () => void;
}) {
  const c = useAdmin();
  const body = (
    <View style={[card(c), { padding: 16 }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <T size={14} font="bold" numberOfLines={1}>{title}</T>
          {subtitle ? <T size={12.5} mut numberOfLines={1} style={{ marginTop: 2 }}>{subtitle}</T> : null}
        </View>
        {badge}
      </View>

      {cells?.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 12 }}>
          {cells.map((cell) => (
            <View key={cell.label}>
              <T size={11} font="bold" sub upper track={0.8}>{cell.label}</T>
              <View style={{ marginTop: 3 }}>
                {typeof cell.value === "string" || typeof cell.value === "number"
                  ? <T size={13}>{String(cell.value)}</T>
                  : cell.value}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {actions ? <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>{actions}</View> : null}
    </View>
  );
  return onPress ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>{body}</Pressable> : body;
}

export { Check };

/* ═══════════ TABS ═══════════ */

/** Wide web panels become tabs on a phone, in the kit's pill chrome. */
export function ATabs<K extends string>({ tabs, value, onChange }: { tabs: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  const c = useAdmin();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <Pressable
            key={t.key}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(t.key); }}
            style={{ height: 36, paddingHorizontal: 14, borderRadius: 12, justifyContent: "center", borderWidth: 1, borderColor: on ? c.brand : c.border, backgroundColor: on ? c.brandSoft : c.surface }}
          >
            <T size={12.5} font="semi" color={on ? c.brand : c.fgMuted}>{t.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ═══════════ ACTION ROW ═══════════ */

/** A workflow action: what it does, and the button that does it. */
export function AAction({ label, hint, cta, tone = "brand", disabled, busy, onPress, Icon, first }: {
  label: string; hint?: string; cta: string; tone?: "brand" | "danger" | "success";
  disabled?: boolean; busy?: boolean; onPress: () => void; Icon?: any; first?: boolean;
}) {
  const c = useAdmin();
  const col = tone === "danger" ? c.danger : tone === "success" ? c.success : c.brand;
  const soft = tone === "danger" ? c.dangerSoft : tone === "success" ? c.successSoft : c.brandSoft;
  const off = disabled || busy;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <View style={{ flex: 1 }}>
        <T size={13} font="semi">{label}</T>
        {hint ? <T size={11.5} mut lh={16} style={{ marginTop: 2 }}>{hint}</T> : null}
      </View>
      <Pressable
        onPress={() => { if (off) return; Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); onPress(); }}
        style={({ pressed }) => ({
          flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 14, borderRadius: 12,
          backgroundColor: soft, opacity: off ? 0.45 : pressed ? 0.75 : 1,
        })}
      >
        {Icon ? <Icon size={14} color={col} /> : null}
        <T size={12.5} font="semi" color={col}>{busy ? "Working…" : cta}</T>
      </Pressable>
    </View>
  );
}

/* ═══════════ NUMBER ROW ═══════════ */

export function ANum({ label, hint, value, onChange, suffix, first }: {
  label: string; hint?: string; value: any; onChange: (v: string) => void; suffix?: string; first?: boolean;
}) {
  const c = useAdmin();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <View style={{ flex: 1 }}>
        <T size={13} font="semi">{label}</T>
        {hint ? <T size={11.5} mut lh={16} style={{ marginTop: 2 }}>{hint}</T> : null}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <TextInput
          value={value == null ? "" : String(value)}
          onChangeText={onChange}
          keyboardType="numeric"
          style={{
            minWidth: 72, textAlign: "right", height: 40, borderRadius: 12,
            borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2,
            paddingHorizontal: 12, fontFamily: adminFonts.semi, fontSize: 13.5, color: c.fg,
          }}
        />
        {suffix ? <T size={12} sub>{suffix}</T> : null}
      </View>
    </View>
  );
}

/* ═══════════ STAT GRID ═══════════ */

/** Two-up metric tiles; the first is the featured brand surface. */
export function AStats({ items }: { items: { label: string; value: string | number; hint?: string; Icon?: any; onPress?: () => void }[] }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
      {items.map((s, i) => (
        <View key={s.label} style={{ width: "47.8%", flexGrow: 1 }}>
          <AStatCard label={s.label} value={s.value} hint={s.hint} Icon={s.Icon} accent={i === 0} index={i} onPress={s.onPress} />
        </View>
      ))}
    </View>
  );
}

/* ═══════════ LAYOUT HELPERS ═══════════ */

export function AGrid({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>{children}</View>;
}

/** Compact metric tile for grids that are not the dashboard headline row. */
export function AStatTile({ label, value, hint, Icon, tone, wide }: { label: string; value: string | number; hint?: string; Icon?: any; tone?: string; wide?: boolean }) {
  const c = useAdmin();
  const col = tone || c.brand;
  return (
    <View style={[card(c), { width: wide ? "100%" : "47.8%", flexGrow: 1, padding: 16 }]}>
      {Icon ? (
        <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: c.brandSoft, marginBottom: 10 }}>
          <Icon size={15} color={col} />
        </View>
      ) : null}
      <T size={26} font="bold" lh={28} numberOfLines={1}>{typeof value === "number" ? value.toLocaleString("en-IN") : value}</T>
      <T size={11} font="bold" sub upper track={0.8} style={{ marginTop: 4 }} numberOfLines={1}>{label}</T>
      {hint ? <T size={11.5} mut style={{ marginTop: 4 }} numberOfLines={1}>{hint}</T> : null}
    </View>
  );
}

export function ACard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const c = useAdmin();
  return <View style={[card(c), { padding: 16 }, style]}>{children}</View>;
}

export function ATag({ label, tone = "neutral" }: { label: string; tone?: Tone }) {
  return <ABadge tone={tone}>{label}</ABadge>;
}

export function AEmpty({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return <AEmptyState title={title} body={subtitle} />;
}

/** Toggle with a hint line, for settings panels. */
export function AToggleRow({ label, hint, value, onChange, first }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void; first?: boolean }) {
  const c = useAdmin();
  return (
    <View style={{ paddingVertical: 10, borderTopWidth: first ? 0 : 1, borderTopColor: c.border }}>
      <AToggle label={label} checked={value} onChange={onChange} />
      {hint ? <T size={11.5} mut lh={16} style={{ marginTop: 6 }}>{hint}</T> : null}
    </View>
  );
}

/** Horizontal scope chips — "which event / competition are we looking at". */
export function AScope({ items, value, onChange, placeholder = "All" }: {
  items: { id: string; label: string }[]; value: string | null; onChange: (id: string | null) => void; placeholder?: string;
}) {
  const c = useAdmin();
  const all = [{ id: "", label: placeholder }, ...items];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginBottom: 16 }}>
      {all.map((it) => {
        const on = (value || "") === it.id;
        return (
          <Pressable
            key={it.id || "all"}
            onPress={() => { Haptics.selectionAsync().catch(() => {}); onChange(it.id || null); }}
            style={{ height: 34, paddingHorizontal: 13, borderRadius: 999, justifyContent: "center", borderWidth: 1, borderColor: on ? c.brand : c.border, backgroundColor: on ? c.brandSoft : c.surface }}
          >
            <T size={12} font={on ? "semi" : "regular"} color={on ? c.brand : c.fgMuted} numberOfLines={1}>{it.label}</T>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** A read-only record line (orders, logs, check-ins). */
export function ARecord({ title, subtitle, right, meta, onPress }: {
  title: string; subtitle?: string; right?: React.ReactNode; meta?: { label: string; value: string }[]; onPress?: () => void;
}) {
  return <ARow title={title} subtitle={subtitle} badge={right} cells={meta?.map((m) => ({ label: m.label, value: m.value }))} onPress={onPress} />;
}
