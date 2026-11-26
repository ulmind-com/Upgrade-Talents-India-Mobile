import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Animated, Easing, Dimensions, StyleSheet, AccessibilityInfo } from "react-native";
import { Image } from "expo-image";
import Svg, {
  Circle,
  Defs,
  RadialGradient,
  Stop,
  Path,
  Polygon,
  Text as SvgText,
  TextPath,
} from "react-native-svg";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";

const { width: W, height: H } = Dimensions.get("window");

/* ──────────────────────────────────────────────────────────────────────────
   Launch poster — a 5 second, single-clock sequence:

   0.0s  hairline grid draws itself
   0.2s  the TALENT column slides in on the right and starts scrolling
   0.6s  two diagonal tapes sweep across, their text running
   0.9s  "SHOW YOUR TALENT."  →  starburst  →  "OWN THE STAGE."
   1.8s  the spinning seal (U mark ringed by our name) lands bottom-left
   3.3s  the poster dims back, the U mark punches in centre stage
         (bloom + haptic + stinger), the wordmark settles under it
   5.0s  hand-off — the layout fades the splash out over the app
   ────────────────────────────────────────────────────────────────────────── */

export const SPLASH_MS = 5000;

const BG = "#0B0B0E";
/* The logo's own orange runs the poster (tapes, TALENT column, seal);
   red is kept only for the small stamp. */
const RED = "#FF385C";
const ORANGE = "#F9862B"; // sampled from the logo itself
const PEACH = "#FFC08A";
const CREAM = "#F4EDE4";
const LINE = "rgba(255,255,255,0.09)";

const U_MARK = require("../../assets/Logo/u-mark-white-512.png");

const TAPE_TEXT = "UPGRADE TALENTS INDIA  ✦  COMPETE  ✦  PERFORM  ✦  WIN  ✦  ";
const SEAL_TEXT = "UPGRADE • TALENTS • INDIA • UPGRADE • TALENTS • INDIA • ";
const COLUMN = ["TALENT", "TALENT", "TALENT", "TALENT", "TALENT", "TALENT", "TALENT", "TALENT", "TALENT", "TALENT"];
const ROW_H = 46;

/** ms window on the master clock → 0..1 with an ease. */
const useWindow = (t: Animated.Value) => (a: number, b: number, easing = Easing.out(Easing.cubic)) =>
  t.interpolate({ inputRange: [a / SPLASH_MS, b / SPLASH_MS], outputRange: [0, 1], extrapolate: "clamp", easing });

/** A value that runs 0→1 forever. */
function useLoop(duration: number) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(v, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, []);
  return v;
}

/** 12-point burst, like a stamp on a gig poster. */
function Starburst({ size, color }: { size: number; color: string }) {
  const pts = useMemo(() => {
    const n = 24;
    const out: string[] = [];
    for (let i = 0; i < n; i++) {
      const r = i % 2 === 0 ? size / 2 : size / 2 - size * 0.32;
      const a = (Math.PI * 2 * i) / n - Math.PI / 2;
      out.push(`${(size / 2 + r * Math.cos(a)).toFixed(2)},${(size / 2 + r * Math.sin(a)).toFixed(2)}`);
    }
    return out.join(" ");
  }, [size]);
  return (
    <Svg width={size} height={size}>
      <Polygon points={pts} fill={color} />
      <Circle cx={size / 2} cy={size / 2} r={size * 0.1} fill={BG} />
    </Svg>
  );
}

/** A diagonal strip of running text. */
function Tape({
  top,
  angle,
  fill,
  color,
  outline,
  reveal,
  speed,
  reverse,
  font,
}: {
  top: number;
  angle: number;
  fill: string;
  color: string;
  outline?: string;
  reveal: Animated.AnimatedInterpolation<number>;
  speed: number;
  reverse?: boolean;
  font?: string;
}) {
  const [segW, setSegW] = useState(0);
  const run = useLoop(speed);
  const shift = segW
    ? run.interpolate({ inputRange: [0, 1], outputRange: reverse ? [-segW, 0] : [0, -segW] })
    : 0;
  const len = W * 1.9;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute",
        top,
        left: (W - len) / 2,
        width: len,
        height: 34,
        backgroundColor: fill,
        borderTopWidth: outline ? 1 : 0,
        borderBottomWidth: outline ? 1 : 0,
        borderColor: outline,
        justifyContent: "center",
        overflow: "hidden",
        opacity: reveal,
        transform: [
          { rotate: `${angle}deg` },
          { translateX: reveal.interpolate({ inputRange: [0, 1], outputRange: [reverse ? len : -len, 0] }) },
        ],
      }}
    >
      <Animated.View style={{ flexDirection: "row", transform: [{ translateX: shift as any }] }}>
        {[0, 1, 2, 3].map((i) => (
          <Text
            key={i}
            onLayout={i === 0 ? (e) => setSegW(e.nativeEvent.layout.width) : undefined}
            style={[s.tapeText, { color, fontFamily: font }]}
            numberOfLines={1}
          >
            {TAPE_TEXT}
          </Text>
        ))}
      </Animated.View>
    </Animated.View>
  );
}

/** One headline line rising out of its own slot. */
function Line({ text, accent, p, font }: { text: string; accent?: boolean; p: Animated.AnimatedInterpolation<number>; font?: string }) {
  return (
    <View style={{ overflow: "hidden" }}>
      <Animated.Text
        style={[
          s.headline,
          { fontFamily: font, fontWeight: font ? undefined : "800" },
          { opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0, 1], outputRange: [44, 0] }) }] },
        ]}
      >
        {accent ? text.slice(0, -1) : text}
        {accent ? <Text style={{ color: ORANGE }}>.</Text> : null}
      </Animated.Text>
    </View>
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
  const t = useRef(new Animated.Value(0)).current; // master clock, 0..1 over SPLASH_MS
  const exit = useRef(new Animated.Value(0)).current;
  const win = useWindow(t);
  const stinger = useAudioPlayer(require("../../assets/sounds/launch.wav"));

  const spin = useLoop(9000);
  const sealSpin = useLoop(12000);
  const column = useLoop(7000);

  useEffect(() => {
    let timers: ReturnType<typeof setTimeout>[] = [];
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (reduce) {
          // straight to the logo, no choreography
          t.setValue(1);
          return;
        }
        Animated.timing(t, { toValue: 1, duration: SPLASH_MS, easing: Easing.linear, useNativeDriver: true }).start();
        timers = [
          setTimeout(() => Haptics.selectionAsync().catch(() => {}), 1300), // starburst stamp
          setTimeout(() => {
            try {
              stinger.play();
            } catch {}
          }, 3350),
          setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}), 3850), // logo lands
        ];
      });
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    if (visible) return;
    Animated.timing(exit, { toValue: 1, duration: 520, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(
      ({ finished }) => finished && onHidden()
    );
  }, [visible]);

  const display = fontReady ? "Poppins_800ExtraBold" : undefined;
  const mono = fontReady ? "Inter_800ExtraBold" : undefined;

  /* ── windows on the clock (built once — re-renders must not rebuild native nodes) ── */
  const { grid, col, tape1, tape2, h1a, h1b, star, h2a, h2b, seal, dim, mark, bloom, word, india } = useMemo(() => {
    const grid = win(0, 700);
    const col = win(200, 1200);
    const tape1 = win(600, 1400);
    const tape2 = win(800, 1600);
    const h1a = win(900, 1350);
    const h1b = win(1000, 1450);
    const star = win(1250, 1650, Easing.out(Easing.back(2)));
    const h2a = win(1500, 1950);
    const h2b = win(1600, 2050);
    const seal = win(1800, 2400, Easing.out(Easing.back(1.6)));
    const dim = win(3300, 3900, Easing.inOut(Easing.cubic));
    const mark = win(3500, 3900, Easing.out(Easing.back(1.8)));
    const bloom = t.interpolate({
      inputRange: [3700 / SPLASH_MS, 3900 / SPLASH_MS, 4500 / SPLASH_MS],
      outputRange: [0, 1, 0],
      extrapolate: "clamp",
    });
    const word = win(3950, 4450);
    const india = win(4250, 4700);
    return { grid, col, tape1, tape2, h1a, h1b, star, h2a, h2b, seal, dim, mark, bloom, word, india };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const columnShift = column.interpolate({ inputRange: [0, 1], outputRange: [0, -ROW_H * 5] });
  const sealSize = Math.min(124, W * 0.32);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: BG,
          opacity: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ scale: exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) }],
        },
      ]}
    >
      {/* ═════════ the poster ═════════ */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: dim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }] },
        ]}
      >
        {/* hairline grid */}
        <Animated.View style={[s.vLine, { left: 24, transform: [{ scaleY: grid }] }]} />
        <Animated.View style={[s.vLine, { left: W * 0.56, transform: [{ scaleY: grid }] }]} />
        <Animated.View style={[s.hLine, { top: H * 0.15, transform: [{ scaleX: grid }] }]} />
        <Animated.View style={[s.hLine, { top: H * 0.9, transform: [{ scaleX: grid }] }]} />

        {/* the TALENT column, scrolling, clipped by the right edge */}
        <Animated.View
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: W * 0.56 + 10,
            width: W * 0.6,
            overflow: "hidden",
            opacity: col,
            transform: [{ translateX: col.interpolate({ inputRange: [0, 1], outputRange: [W * 0.4, 0] }) }],
          }}
        >
          <Animated.View style={{ transform: [{ translateY: columnShift }] }}>
            <Svg width={W * 0.6} height={ROW_H * (COLUMN.length * 2)}>
              {[...COLUMN, ...COLUMN].map((w, i) => {
                const kind = i % 5; // orange outline ×2, a solid orange, white outline ×2
                const filled = kind === 2; // only the orange one is solid — white is always an outline
                return (
                  <SvgText
                    key={i}
                    x={0}
                    y={ROW_H * (i + 1) - 8}
                    fontSize={46}
                    fontFamily={display}
                    fontWeight="800"
                    letterSpacing={1}
                    fill={filled ? ORANGE : "none"}
                    stroke={filled ? "none" : kind >= 3 ? CREAM : ORANGE}
                    strokeWidth={filled ? 0 : 1.2}
                    opacity={filled ? 1 : 0.85}
                  >
                    {w}
                  </SvgText>
                );
              })}
            </Svg>
          </Animated.View>
        </Animated.View>

        {/* headlines + stamp */}
        <View style={{ position: "absolute", left: 32, top: H * 0.24, width: W * 0.6 }}>
          <Line text="SHOW YOUR" p={h1a} font={display} />
          <Line text="TALENT." accent p={h1b} font={display} />
          <Animated.View
            style={{
              marginTop: 24,
              marginBottom: 24,
              marginLeft: 24,
              opacity: star,
              transform: [
                { scale: star },
                { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) },
              ],
            }}
          >
            <Starburst size={56} color={CREAM} />
          </Animated.View>
          <Line text="OWN THE" p={h2a} font={display} />
          <Line text="STAGE." accent p={h2b} font={display} />
        </View>

        {/* diagonal tapes — drawn over the column, like the reference */}
        <Tape top={H * 0.06} angle={-26} fill={ORANGE} color={BG} reveal={tape1} speed={9000} font={mono} />
        <Tape top={H * 0.66} angle={-26} fill={BG} color={ORANGE} outline={ORANGE} reveal={tape2} speed={11000} reverse font={mono} />

        {/* the spinning seal */}
        <Animated.View
          style={{
            position: "absolute",
            left: 24,
            top: H * 0.76,
            width: sealSize,
            height: sealSize,
            alignItems: "center",
            justifyContent: "center",
            opacity: seal,
            transform: [{ scale: seal }],
          }}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              { transform: [{ rotate: sealSpin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "-360deg"] }) }] },
            ]}
          >
            <Svg width={sealSize} height={sealSize} viewBox="0 0 100 100">
              <Defs>
                <Path id="sealRing" d="M50,50 m-40,0 a40,40 0 1,1 80,0 a40,40 0 1,1 -80,0" />
              </Defs>
              <SvgText fontSize={8.6} fontFamily={mono} fontWeight="800" letterSpacing={1.6} fill={ORANGE}>
                <TextPath href="#sealRing">{SEAL_TEXT}</TextPath>
              </SvgText>
            </Svg>
          </Animated.View>
          <View style={[s.sealCore, { width: sealSize * 0.56, height: sealSize * 0.56 }]}>
            <Image source={U_MARK} style={{ width: "62%", height: "62%" }} contentFit="contain" />
          </View>
        </Animated.View>

        {/* small pink stamp, bottom-right */}
        <Animated.View
          style={{
            position: "absolute",
            right: 32,
            top: H * 0.8,
            opacity: seal,
            transform: [
              { scale: seal },
              { rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] }) },
            ],
          }}
        >
          <Starburst size={44} color={RED} />
        </Animated.View>
      </Animated.View>

      {/* ═════════ the take-over: logo centre stage ═════════ */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: BG, opacity: dim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.94] }) }]} />

      <Animated.View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: H * 0.42 - 210,
          left: W / 2 - 210,
          width: 420,
          height: 420,
          opacity: bloom,
          transform: [{ scale: bloom.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.2] }) }],
        }}
      >
        <Svg width={420} height={420}>
          <Defs>
            <RadialGradient id="splashBloom" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={PEACH} stopOpacity={0.8} />
              <Stop offset="45%" stopColor={ORANGE} stopOpacity={0.35} />
              <Stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={210} cy={210} r={210} fill="url(#splashBloom)" />
        </Svg>
      </Animated.View>

      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingBottom: H * 0.08 }]}>
        <Animated.View
          style={{
            opacity: mark,
            transform: [{ scale: mark.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
            shadowColor: ORANGE,
            shadowOpacity: 0.55,
            shadowRadius: 30,
            shadowOffset: { width: 0, height: 12 },
          }}
        >
          <Image source={U_MARK} style={{ width: 128, height: 128 }} contentFit="contain" />
        </Animated.View>

        <View style={{ overflow: "hidden", marginTop: 24 }}>
          <Animated.Text
            style={[
              s.word,
              { fontFamily: display, fontWeight: display ? undefined : "800" },
              { opacity: word, transform: [{ translateY: word.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }] },
            ]}
          >
            UPGRADE TALENTS
          </Animated.Text>
        </View>

        <Animated.View style={[s.indiaRow, { opacity: india }]}>
          <Animated.View style={[s.indiaLine, { transform: [{ scaleX: india }] }]} />
          <Text style={[s.india, { fontFamily: mono }]}>INDIA</Text>
          <Animated.View style={[s.indiaLine, { transform: [{ scaleX: india }] }]} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  vLine: { position: "absolute", top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: LINE },
  hLine: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: LINE },
  headline: { color: CREAM, fontSize: 34, lineHeight: 40, letterSpacing: 2 },
  tapeText: { fontSize: 13, letterSpacing: 3, fontWeight: "800" },
  sealCore: {
    borderRadius: 999,
    backgroundColor: "#17181F",
    borderWidth: 1.5,
    borderColor: ORANGE,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: ORANGE,
    shadowOpacity: 0.6,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
  word: { color: "#FFFFFF", fontSize: 29, letterSpacing: 0.5, textAlign: "center" },
  indiaRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  indiaLine: { width: 28, height: 2, borderRadius: 2, backgroundColor: ORANGE },
  india: { color: PEACH, fontSize: 13, letterSpacing: 7, fontWeight: "800" },
});
