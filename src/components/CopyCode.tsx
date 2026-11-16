import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Easing } from "react-native";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { Copy, Check, Gift } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Card } from "@/components/ui";

/**
 * Invite code with unmistakable copy feedback: the card springs, the icon
 * flips to a tick, a ring pulses out of it and a "COPIED" pill flies up — so
 * there is never any doubt that the tap landed.
 */
export function CopyCode({
  code,
  label = "Invite & earn · tap to copy",
  tone,
}: {
  code: string;
  label?: string;
  tone?: string;
}) {
  const { c } = useTheme();
  const accent = tone || c.accent;
  const [done, setDone] = useState(false);

  const a = useRef(new Animated.Value(0)).current; // 0 idle → 1 copied
  const ring = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = async () => {
    await Clipboard.setStringAsync(String(code));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setDone(true);

    ring.setValue(0);
    Animated.parallel([
      Animated.spring(a, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 12 }),
      Animated.timing(ring, { toValue: 1, duration: 620, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(a, { toValue: 0, duration: 260, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(() => setDone(false));
    }, 1500);
  };

  const cardScale = a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.035, 1.015] });

  return (
    <Pressable onPress={copy}>
      <Animated.View style={{ transform: [{ scale: cardScale }] }}>
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, borderColor: done ? c.success + "66" : c.border }}>
          {/* icon well — copy flips to tick, ring pulses out */}
          <View style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute", width: 44, height: 44, borderRadius: 14, borderWidth: 2, borderColor: c.success,
                opacity: ring.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0] }),
                transform: [{ scale: ring.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
              }}
            />
            <Animated.View
              style={{
                position: "absolute", width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center",
                backgroundColor: accent + "22",
                opacity: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.6] }) }],
              }}
            >
              <Gift size={20} color={accent} />
            </Animated.View>
            <Animated.View
              style={{
                position: "absolute", width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center",
                backgroundColor: c.success + "26",
                opacity: a,
                transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }, { rotate: a.interpolate({ inputRange: [0, 1], outputRange: ["-35deg", "0deg"] }) }],
              }}
            >
              <Check size={21} color={c.success} strokeWidth={3} />
            </Animated.View>
          </View>

          <View style={{ flex: 1 }}>
            <Txt size={11} font="monoMed" tone="subtle" tracking={1.5} uppercase>{label}</Txt>
            <Txt size={18} font="sansExt" style={{ marginTop: 2, letterSpacing: 1, color: done ? c.success : accent }}>{code}</Txt>
          </View>

          {/* trailing: copy glyph swaps for the flying "COPIED" pill */}
          <View style={{ width: 70, alignItems: "flex-end", justifyContent: "center" }}>
            <Animated.View style={{ opacity: a.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: "clamp" }) }}>
              <Copy size={18} color={c.fgMuted} />
            </Animated.View>
            <Animated.View
              pointerEvents="none"
              style={{
                position: "absolute",
                backgroundColor: c.success, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4,
                opacity: a.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
                transform: [
                  { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [10, -2] }) },
                  { scale: a.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 1.12, 1] }) },
                ],
              }}
            >
              <Txt size={9.5} font="sansBold" tracking={1} style={{ color: "#fff" }}>COPIED</Txt>
            </Animated.View>
          </View>
        </Card>
      </Animated.View>
    </Pressable>
  );
}
