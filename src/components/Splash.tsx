import React, { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, Dimensions, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaskedView } from "@/components/vendor";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { Sheen } from "@/components/motion";

const { width: W, height: H } = Dimensions.get("window");
const BAR = 168;

/* Splash paints before useFonts() resolves, so every glyph here is the system
   face — a custom fontFamily would throw on Android while it is still loading. */

/**
 * The whole launch is one 2150ms timeline, matching the stinger sample frame
 * for frame. Every element reads a *slice* of it rather than running its own
 * clock, so the picture and the sound land on the same beat on any device.
 */
const RUN = 2150;
/** The beat the monogram lands — the sub thump in the sample sits here. */
const HIT = 0.428; // 920ms

function Breath({ color, size, x, y, delay }: { color: string; size: number; x: number; y: number; delay: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 2600, delay, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", left: x, top: y, width: size, height: size,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.85] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={`g${x}${y}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.75} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.28} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${`g${x}${y}`})`} />
      </Svg>
    </Animated.View>
  );
}

/** Four bars keeping time — the stage is warming up. */
function Equalizer() {
  const b0 = useRef(new Animated.Value(0.3)).current;
  const b1 = useRef(new Animated.Value(0.3)).current;
  const b2 = useRef(new Animated.Value(0.3)).current;
  const b3 = useRef(new Animated.Value(0.3)).current;
  const b4 = useRef(new Animated.Value(0.3)).current;
  const bars = [b0, b1, b2, b3, b4];
  useEffect(() => {
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(b, { toValue: 1, duration: 300 + i * 70, delay: i * 60, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(b, { toValue: 0.3, duration: 300 + i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 22 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: 4, height: 22, borderRadius: 3, backgroundColor: i % 2 ? "#ff9a3d" : "#ff5e1f", transform: [{ scaleY: b }] }} />
      ))}
    </View>
  );
}

/** A ring thrown off by the impact. */
function Shock({ t, at, size, color, to = 3.4 }: { t: Animated.Value; at: number; size: number; color: string; to?: number }) {
  const p = t.interpolate({ inputRange: [at, Math.min(at + 0.22, 1)], outputRange: [0, 1], extrapolate: "clamp" });
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", width: size, height: size, borderRadius: 999,
        borderWidth: 2, borderColor: color,
        opacity: p.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.75, 0] }),
        transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.35, to] }) }],
      }}
    />
  );
}

/**
 * Branded launch screen. Stays mounted above the app so it can play an exit
 * when the session is ready, instead of popping away.
 */
export function Splash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  /** The master clock. Linear, so each slice carries its own easing. */
  const t = useRef(new Animated.Value(0)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const stinger = useAudioPlayer(require("../../assets/sounds/launch.wav"));

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: RUN, easing: Easing.linear, useNativeDriver: true }).start();

    // Picture and sound share one start, so the thump lands with the monogram.
    try { stinger.play(); } catch {}
    const hit = setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }, RUN * HIT);

    const s = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true }));
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(bar, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(bar, { toValue: 0.12, duration: 700, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ])
    );
    // A spotlight crossing the stage while we wait on the session.
    const sw = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(sweep, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    s.start(); b.start(); sw.start();
    return () => { clearTimeout(hit); s.stop(); b.stop(); sw.stop(); };
  }, []);

  useEffect(() => {
    if (visible) return;
    // The stinger's tail is left to ring out under the home screen's own entrance.
    Animated.timing(exit, { toValue: 1, duration: 540, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
      if (finished) onHidden();
    });
  }, [visible]);

  /** A slice of the master clock, pre-eased. */
  const slice = (at: number, span: number) => {
    const p = t.interpolate({ inputRange: [at, Math.min(at + span, 1)], outputRange: [0, 1], extrapolate: "clamp" });
    return p.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, 0.58, 0.86, 0.97, 1] });
  };

  const slit = slice(0, 0.2);                 // the light line opens
  const bloom = slice(0.18, 0.26);            // the stage irises open from it
  const mark = t.interpolate({ inputRange: [HIT, HIT + 0.16], outputRange: [0, 1], extrapolate: "clamp" });
  const word = slice(0.52, 0.2);
  const tail = slice(0.68, 0.22);

  const rise = (p: Animated.AnimatedInterpolation<number>, from: number) => ({
    opacity: p,
    transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) }],
  });

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: "#05060d",
          opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }],
        },
      ]}
    >
      {/* The stage irises open out of a single line of light. */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { opacity: bloom, transform: [{ scaleY: bloom.interpolate({ inputRange: [0, 1], outputRange: [0.004, 1] }) }] },
        ]}
      >
        <LinearGradient colors={["#0a0f20", "#140a1e", "#1c0a10"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", top: H / 2 - 1, left: W * 0.05, width: W * 0.9, height: 2, borderRadius: 2,
          backgroundColor: "#ffd9a8",
          shadowColor: "#ff9a3d", shadowOpacity: 0.9, shadowRadius: 16, shadowOffset: { width: 0, height: 0 },
          opacity: Animated.multiply(slit, t.interpolate({ inputRange: [0.2, 0.42], outputRange: [1, 0], extrapolate: "clamp" })),
          transform: [{ scaleX: slit }],
        }}
      />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: slice(0.34, 0.3) }]}>
        <Breath color="#ff5e1f" size={360} x={-110} y={H * 0.1} delay={0} />
        <Breath color="#b36bff" size={300} x={W - 170} y={H * 0.62} delay={900} />
      </Animated.View>

      {/* Spotlight crossing the stage while the session loads. */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", top: -H * 0.2, height: H * 1.4, width: W * 0.5,
          opacity: 0.1,
          transform: [
            { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.6, W * 1.1] }) },
            { rotate: "14deg" },
          ],
        }}
      >
        <LinearGradient colors={["transparent", "#ffd9a8", "transparent"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ flex: 1 }} />
      </Animated.View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 26 }}>
        {/* monogram — lands on the thump, throwing off two rings */}
        <Animated.View
          style={{
            alignItems: "center", justifyContent: "center",
            opacity: mark.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 1, 1] }),
            transform: [{ scale: mark.interpolate({ inputRange: [0, 0.45, 0.72, 1], outputRange: [0.3, 1.14, 0.97, 1] }) }],
          }}
        >
          <Shock t={t} at={HIT} size={110} color="#ff9a3d" />
          <Shock t={t} at={HIT + 0.05} size={110} color="#b36bff" to={2.6} />
          <Animated.View
            style={{
              position: "absolute", width: 108, height: 108, borderRadius: 999,
              borderWidth: 2, borderColor: "rgba(255,154,61,0.28)", borderTopColor: "#ff5e1f", borderRightColor: "#ff9a3d",
              transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }],
            }}
          />
          <LinearGradient
            colors={["#ffab52", "#ff7a33", "#ff5e1f"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ width: 78, height: 78, borderRadius: 26, alignItems: "center", justifyContent: "center", overflow: "hidden", shadowColor: "#ff5e1f", shadowOpacity: 0.65, shadowRadius: 22, shadowOffset: { width: 0, height: 10 }, elevation: 14 }}
          >
            <Text style={{ color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: -1 }}>UT</Text>
            <Sheen width={78} height={78} radius={26} delay={RUN * HIT + 260} loop tint="rgba(255,255,255,0.4)" />
          </LinearGradient>
        </Animated.View>

        {/* wordmark, filled with the brand gradient, with a light crossing it */}
        <Animated.View style={rise(word, 16)}>
          <View style={{ overflow: "hidden" }}>
            <MaskedView
              maskElement={
                <View style={{ backgroundColor: "transparent" }}>
                  <Text style={{ fontSize: 34, fontWeight: "900", letterSpacing: -1, textAlign: "center" }}>UPGRADE TALENTS</Text>
                </View>
              }
            >
              <LinearGradient colors={["#ffd9a8", "#ff9a3d", "#ff5e1f"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <Text style={{ fontSize: 34, fontWeight: "900", letterSpacing: -1, textAlign: "center", opacity: 0 }}>UPGRADE TALENTS</Text>
              </LinearGradient>
            </MaskedView>
            <Sheen width={W - 60} height={48} delay={RUN * 0.6} loop tint="rgba(255,255,255,0.45)" />
          </View>
          {/* INDIA — one letter a beat behind the last */}
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 8 }}>
            {["I", "N", "D", "I", "A"].map((ch, i) => {
              const p = slice(0.6 + i * 0.025, 0.16);
              return (
                <Animated.Text
                  key={i}
                  style={{
                    color: "rgba(255,255,255,0.45)", fontSize: 11, letterSpacing: 6,
                    opacity: p,
                    transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [7, 0] }) }],
                  }}
                >
                  {ch}
                </Animated.Text>
              );
            })}
          </View>
        </Animated.View>

        <Animated.View style={[{ alignItems: "center", gap: 16 }, rise(tail, 24)]}>
          <Equalizer />
          {/* loading rail */}
          <View style={{ width: BAR, height: 3, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
            <Animated.View
              style={{
                width: BAR, height: 3, borderRadius: 3,
                transform: [
                  { translateX: -BAR / 2 },
                  { scaleX: bar },
                  { translateX: BAR / 2 },
                ],
              }}
            >
              <LinearGradient colors={["#ff5e1f", "#ff9a3d"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1, borderRadius: 3 }} />
            </Animated.View>
          </View>
        </Animated.View>
      </View>

      <Animated.Text style={[{ position: "absolute", bottom: 46, alignSelf: "center", color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 4 }, { opacity: tail }]}>
        SETTING THE STAGE
      </Animated.Text>

      {/* The impact flash — brief, and the last thing drawn. */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: "#fff3e0",
            opacity: t.interpolate({ inputRange: [HIT - 0.01, HIT + 0.01, HIT + 0.1], outputRange: [0, 0.5, 0], extrapolate: "clamp" }),
          },
        ]}
      />
    </Animated.View>
  );
}
