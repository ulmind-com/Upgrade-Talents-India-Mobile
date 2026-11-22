import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, Dimensions, StyleSheet } from "react-native";
import { Image } from "expo-image";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

const { width: W, height: H } = Dimensions.get("window");

/**
 * Branded launch screen — one tight timeline:
 *   1. the U mark drops in from above and settles,
 *   2. it zooms (a bloom + haptic lands on the apex),
 *   3. the wordmark types itself out beneath, then INDIA fades in.
 * Stays mounted above the app so it plays a clean exit once the session is ready.
 */
const RUN = 2150;          // master clock length (ms)
const HIT = 0.4;           // the zoom apex — bloom + thump land here (~860ms)
const TYPE_START = 900;    // ms — wordmark starts typing just after the zoom releases
const TYPE_STEP = 52;      // ms per character
const WORD = "UPGRADE TALENTS";
const INDIA = ["I", "N", "D", "I", "A"];

const U_MARK = require("../../assets/Logo/u-mark-512.png");

/** Soft breathing radial glow. */
function Glow({ color, size, x, y, delay = 0 }: { color: string; size: number; x: number; y: number; delay?: number }) {
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
  const id = `glow${x}${y}`;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", left: x, top: y, width: size, height: size,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] }) }],
      }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.7} />
            <Stop offset="55%" stopColor={color} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

export function Splash({
  visible,
  onHidden,
  fontReady,
}: {
  visible: boolean;
  onHidden: () => void;
  fontReady?: boolean;
}) {
  const t = useRef(new Animated.Value(0)).current;   // master clock
  const exit = useRef(new Animated.Value(0)).current;
  const caret = useRef(new Animated.Value(1)).current;
  const [typed, setTyped] = useState(0);
  const stinger = useAudioPlayer(require("../../assets/sounds/launch.wav"));

  useEffect(() => {
    Animated.timing(t, { toValue: 1, duration: RUN, easing: Easing.linear, useNativeDriver: true }).start();
    try { stinger.play(); } catch {}

    // thump as the mark lands its zoom
    const hit = setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), RUN * HIT);

    // typewriter — one character a beat, a tick of haptic per letter
    const timers: ReturnType<typeof setTimeout>[] = [hit];
    for (let i = 1; i <= WORD.length; i++) {
      timers.push(
        setTimeout(() => {
          setTyped(i);
          if (WORD[i - 1] !== " ") Haptics.selectionAsync().catch(() => {});
        }, TYPE_START + i * TYPE_STEP)
      );
    }

    // blinking caret while typing
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(caret, { toValue: 0, duration: 420, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(caret, { toValue: 1, duration: 420, easing: Easing.linear, useNativeDriver: true }),
      ])
    );
    blink.start();

    return () => { timers.forEach(clearTimeout); blink.stop(); };
  }, []);

  useEffect(() => {
    if (visible) return;
    Animated.timing(exit, { toValue: 1, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => finished && onHidden()
    );
  }, [visible]);

  // ── slices of the master clock ──
  const drop = t.interpolate({ inputRange: [0, 0.26], outputRange: [0, 1], extrapolate: "clamp" });
  const markScale = t.interpolate({
    inputRange: [0, 0.26, HIT, 0.56, 1],
    outputRange: [0.6, 1.0, 1.16, 1.0, 1.0],
    extrapolate: "clamp",
  });
  const markY = drop.interpolate({ inputRange: [0, 1], outputRange: [-H * 0.16, 0] });
  const bloom = t.interpolate({ inputRange: [HIT - 0.06, HIT, HIT + 0.14], outputRange: [0, 1, 0], extrapolate: "clamp" });
  const flash = t.interpolate({ inputRange: [HIT - 0.02, HIT, HIT + 0.1], outputRange: [0, 0.35, 0], extrapolate: "clamp" });
  const indiaIn = t.interpolate({ inputRange: [0.86, 0.98], outputRange: [0, 1], extrapolate: "clamp" });

  const wordFont = fontReady ? "Poppins_800ExtraBold" : undefined;
  const typing = typed < WORD.length;

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: "#000000",
          opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
        },
      ]}
    >
      {/* ambient warm glows */}
      <Glow color="#ff6a1e" size={420} x={W / 2 - 210} y={H * 0.26} />
      <Glow color="#ff385c" size={320} x={W - 200} y={H * 0.6} delay={900} />

      {/* zoom bloom behind the mark */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute", top: H * 0.5 - 220, left: W / 2 - 220, width: 440, height: 440,
          opacity: bloom,
          transform: [{ scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] }) }],
        }}
      >
        <Svg width={440} height={440}>
          <Defs>
            <RadialGradient id="bloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#ffb257" stopOpacity={0.9} />
              <Stop offset="45%" stopColor="#ff6a1e" stopOpacity={0.4} />
              <Stop offset="100%" stopColor="#ff6a1e" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={220} cy={220} r={220} fill="url(#bloom)" />
        </Svg>
      </Animated.View>

      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        {/* 1-2. the U mark drops in, then zooms */}
        <Animated.View
          style={{
            opacity: drop,
            transform: [{ translateY: markY }, { scale: markScale }],
            shadowColor: "#ff6a1e", shadowOpacity: 0.5, shadowRadius: 30, shadowOffset: { width: 0, height: 12 },
          }}
        >
          <Image source={U_MARK} style={{ width: 132, height: 132 }} contentFit="contain" />
        </Animated.View>

        {/* 3. the wordmark types itself out */}
        <View style={{ height: 46, marginTop: 26, flexDirection: "row", alignItems: "center", justifyContent: "center" }}>
          <Text
            style={{
              color: "#ffffff", fontSize: 29, letterSpacing: 0.5, textAlign: "center",
              fontFamily: wordFont, fontWeight: wordFont ? undefined : "800",
            }}
          >
            {WORD.slice(0, typed)}
          </Text>
          {typing && typed > 0 ? (
            <Animated.View style={{ width: 3, height: 28, marginLeft: 3, borderRadius: 2, backgroundColor: "#ff385c", opacity: caret }} />
          ) : null}
        </View>

        {/* INDIA — settles in once the wordmark lands */}
        <Animated.View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10, opacity: indiaIn }}>
          <View style={{ width: 26, height: 2, borderRadius: 2, backgroundColor: "#ff6a1e" }} />
          <View style={{ flexDirection: "row" }}>
            {INDIA.map((ch, i) => (
              <Text key={i} style={{ color: "#ff8a3d", fontSize: 13, letterSpacing: 7, fontWeight: "700" }}>{ch}</Text>
            ))}
          </View>
          <View style={{ width: 26, height: 2, borderRadius: 2, backgroundColor: "#ff6a1e" }} />
        </Animated.View>
      </View>

      {/* impact flash — the last thing drawn */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#fff3e0", opacity: flash }]} />
    </Animated.View>
  );
}
