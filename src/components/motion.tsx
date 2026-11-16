import React, { useEffect, useRef } from "react";
import { Animated, Easing, Dimensions, StyleProp, ViewStyle, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const { height: SCREEN_H } = Dimensions.get("window");
/** The house easing — a fast start that settles, never a linear slide. */
export const EASE = Easing.bezier(0.16, 1, 0.3, 1);

/**
 * One shared launch timeline, 0 → 1.
 *
 * Every block on the first screenful reads a *slice* of this single value
 * instead of starting its own animation, so opening the app is one
 * choreographed move rather than a dozen competing ones.
 */
export function useIntro(ready = true) {
  const t = useRef(new Animated.Value(0)).current;
  const started = useRef(false);
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    Animated.timing(t, { toValue: 1, duration: 1250, easing: Easing.linear, useNativeDriver: true }).start();
  }, [ready]);
  return t;
}

/**
 * A block's slice of the launch timeline. `at` is where it starts (0–1) and
 * `span` how long it takes, so callers choreograph by naming beats.
 */
export function Intro({
  t, at = 0, span = 0.42, y = 24, from = 0.96, children, style,
}: {
  t: Animated.Value;
  at?: number;
  span?: number;
  /** Rise distance; 0 for a pure fade. */
  y?: number;
  /** Starting scale; 1 to skip the scale. */
  from?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const p = t.interpolate({
    inputRange: [at, Math.min(at + span, 1)],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  // The eased curve lives here, so the driver itself can stay linear and be
  // shared by every slice without one block's easing bleeding into the next.
  const e = p.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 0.58, 0.86, 0.97, 1],
  });
  return (
    <Animated.View
      style={[
        {
          opacity: p.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.85, 1] }),
          transform: [
            { translateY: e.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) },
            { scale: e.interpolate({ inputRange: [0, 1], outputRange: [from, 1] }) },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Reveals its children the first time they come into view.
 *
 * The threshold check rides the existing scroll value on the JS side, but the
 * animation itself runs on the native driver — so the reveal stays at 60fps
 * however heavy the page is. A section already on screen at mount plays at
 * once rather than waiting for a scroll that may never come.
 */
export function Reveal({
  scrollY, children, y = 30, delay = 0, duration = 680, style,
}: {
  scrollY: Animated.Value;
  children: React.ReactNode;
  y?: number;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const a = useRef(new Animated.Value(0)).current;
  const top = useRef<number | null>(null);
  const played = useRef(false);
  const offset = useRef(0);

  const play = () => {
    if (played.current) return;
    played.current = true;
    Animated.timing(a, { toValue: 1, duration, delay, easing: EASE, useNativeDriver: true }).start();
  };

  /* Fire a little before the top edge arrives, so content is already settled
     by the time the eye reaches it. */
  const check = () => {
    if (played.current || top.current === null) return;
    if (top.current < offset.current + SCREEN_H - 70) play();
  };

  useEffect(() => {
    const id = scrollY.addListener(({ value }) => { offset.current = value; check(); });
    return () => scrollY.removeListener(id);
  }, []);

  return (
    <Animated.View
      onLayout={(e) => { top.current = e.nativeEvent.layout.y; check(); }}
      style={[
        {
          opacity: a,
          transform: [
            { translateY: a.interpolate({ inputRange: [0, 1], outputRange: [y, 0] }) },
            { scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A light sweep across a surface — the touch that makes a plain row read as
 * glass. Runs once after `delay`, or forever with `loop`.
 */
export function Sheen({
  width, height, delay = 0, loop = false, tint = "rgba(255,255,255,0.22)", radius = 0,
}: {
  width: number;
  height: number;
  delay?: number;
  loop?: boolean;
  tint?: string;
  radius?: number;
}) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = Animated.timing(x, { toValue: 1, duration: 1100, delay, easing: Easing.inOut(Easing.quad), useNativeDriver: true });
    if (loop) Animated.loop(Animated.sequence([run, Animated.delay(2600), Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true })])).start();
    else run.start();
  }, []);
  const band = Math.max(90, width * 0.45);
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: radius, overflow: "hidden" }}>
      <Animated.View
        style={{
          position: "absolute", top: -height, height: height * 3, width: band,
          transform: [
            { translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-band, width + band] }) },
            { rotate: "18deg" },
          ],
        }}
      >
        <LinearGradient
          colors={["transparent", tint, "transparent"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
}

/**
 * Slow ambient drift for the background glows.
 *
 * Deliberately uncoupled from scroll: it keeps the page alive while idle
 * without adding bridge traffic to every scroll frame.
 */
export function Drift({
  children, amp = 14, period = 9000, phase = 0, style,
}: {
  children: React.ReactNode;
  /** Travel in each direction, in px. */
  amp?: number;
  period?: number;
  /** 0–1 offset into the cycle, so two glows never move in lockstep. */
  phase?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const a = useRef(new Animated.Value(phase)).current;
  useEffect(() => {
    const cycle = () =>
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: period * (1 - phase), easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: period, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]);
    Animated.loop(cycle()).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          transform: [
            { translateX: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-amp, amp * 0.6, amp] }) },
            { translateY: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [amp * 0.5, -amp, amp * 0.5] }) },
            { scale: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] }) },
          ],
          opacity: a.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.85, 1, 0.85] }),
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/** A soft pulse — for a live dot, a badge, anything that should feel awake. */
export function Pulse({ children, min = 0.55, period = 1400 }: { children: React.ReactNode; min?: number; period?: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: period / 2, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: a.interpolate({ inputRange: [0, 1], outputRange: [min, 1] }),
        transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [1, 1.14] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}
