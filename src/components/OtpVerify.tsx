import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, TextInput, Pressable, Animated, Easing, Dimensions, type TextInputInstance } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { Check, AlertCircle } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { genz } from "@/theme/tokens";

/* ════════════════════════════════════════════════════════════
   OTP VERIFY — the website's four acts, rebuilt natively:
     1. input      — digit tiles, each one pops as it lands
     2. scatter    — tiles break the row, orbit the centre twice,
                     spin on their own axis, collapse inward
     3. verifying  — a progress ring counts up while the request
                     is actually in flight
     4. granted    — the ring blooms into a glow that settles
                     into a check, confetti bursts, a VERIFIED
                     pill rises underneath
   ════════════════════════════════════════════════════════════ */

type Phase = "input" | "scatter" | "verifying" | "granted" | "error";

const EASE = Easing.bezier(0.16, 1, 0.3, 1);
const TURNS = 2.15;
const SAMPLES = 20;
const SCATTER_MS = 1080;
const RING = 132;
const STAGE_H = 200;

/** Baked keyframes so the orbit, the spin and the collapse stay in lockstep. */
function orbitTrack(slotX: number, slotY: number, index: number, count: number, radius: number) {
  const base = -Math.PI / 2 + (index * 2 * Math.PI) / count;
  const x: number[] = [], y: number[] = [], rotate: number[] = [], scale: number[] = [], opacity: number[] = [];
  for (let k = 0; k <= SAMPLES; k++) {
    const p = k / SAMPLES;
    const spin = Math.pow(p, 1.15) * TURNS * Math.PI * 2;   // accelerates out of the row
    const rad = radius * (1 - Math.pow(p, 2.3));            // holds wide, then sucks inward
    const merge = Math.min(1, p / 0.22);
    const m = merge * merge * (3 - 2 * merge);              // smoothstep off the row position
    x.push(slotX + (Math.cos(base + spin) * rad - slotX) * m);
    y.push(slotY + (Math.sin(base + spin) * rad - slotY) * m);
    rotate.push(((spin * 180) / Math.PI) * 0.85);
    scale.push(p < 0.18 ? 1 + p * 0.5 : 1.09 - (p - 0.18) * 0.95);
    opacity.push(p < 0.72 ? 1 : Math.max(0, 1 - (p - 0.72) / 0.28));
  }
  return { x, y, rotate, scale, opacity };
}

const CONFETTI = Array.from({ length: 22 }).map((_, i) => {
  const a = (i / 22) * Math.PI * 2 + (i % 3) * 0.4;
  const dist = 78 + (i % 5) * 26;
  const [g0, g1] = genz(i);
  return { dx: Math.cos(a) * dist, dy: Math.sin(a) * dist, color: i % 4 === 0 ? g0 : g1, size: 5 + (i % 3) * 2, spin: (i % 2 ? 1 : -1) * (180 + i * 20) };
});

export function OtpVerify({
  length = 6,
  onVerify,
  onSuccess,
  onResend,
  title = "Enter the code",
  subtitle,
  successTitle = "Access Granted",
  successSubtitle = "Verified. Taking you through…",
  successHoldMs = 1500,
}: {
  length?: number;
  /** Must reject to show the error act. */
  onVerify: (code: string) => Promise<void>;
  onSuccess: () => void;
  onResend?: () => void;
  title?: string;
  subtitle?: string;
  successTitle?: string;
  successSubtitle?: string;
  successHoldMs?: number;
}) {
  const { c } = useTheme();
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const [phase, setPhase] = useState<Phase>("input");
  const [pct, setPct] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputs = useRef<Array<TextInputInstance | null>>([]);
  const busy = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raf = useRef<number | null>(null);
  const target = useRef(0);
  const minUntil = useRef(0);

  const tick = useAudioPlayer(require("../../assets/sounds/tick.wav"));
  const verified = useAudioPlayer(require("../../assets/sounds/verified.wav"));
  const pop = useAudioPlayer(require("../../assets/sounds/pop.wav"));

  useEffect(() => {
    try { tick.volume = 0.2; pop.volume = 0.35; verified.volume = 0.9; } catch {}
  }, []);
  const play = (p: any) => { try { p.seekTo(0); p.play(); } catch {} };

  const after = useCallback((ms: number, fn: () => void) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  }, []);

  useEffect(() => () => {
    timers.current.forEach(clearTimeout);
    if (raf.current) cancelAnimationFrame(raf.current);
  }, []);

  /* Animated drivers */
  const scatter = useRef(new Animated.Value(0)).current;   // 0→1 across act 2
  const ringIn = useRef(new Animated.Value(0)).current;    // ring/counter fade
  const grant = useRef(new Animated.Value(0)).current;     // act 4
  const shake = useRef(new Animated.Value(0)).current;

  const code = digits.join("");
  const locked = phase !== "input" && phase !== "error";

  const resetTiles = useCallback(() => {
    setDigits(Array(length).fill(""));
    setPct(0);
    setErrorMsg(null);
    scatter.setValue(0); ringIn.setValue(0); grant.setValue(0);
    setPhase("input");
    after(40, () => inputs.current[0]?.focus());
  }, [after, length]);

  /* ── Act 3: ring + counter, paced by the real request ── */
  const runRing = useCallback(() => {
    let cur = 0;
    const step = () => {
      const k = target.current > 100 ? 0.11 : 0.034;
      cur += (target.current - cur) * k;
      if (cur >= 99.4) { setPct(100); raf.current = null; return; }
      setPct(Math.round(cur));
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
  }, []);

  const start = useCallback(async (value: string) => {
    if (busy.current || value.length !== length) return;
    busy.current = true;
    setErrorMsg(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    setPhase("scatter");
    Animated.timing(scatter, { toValue: 1, duration: SCATTER_MS, easing: Easing.linear, useNativeDriver: true }).start();

    after(SCATTER_MS - 60, () => {
      setPhase("verifying");
      Animated.timing(ringIn, { toValue: 1, duration: 320, easing: EASE, useNativeDriver: true }).start();
      runRing();
    });

    target.current = 90;
    minUntil.current = Date.now() + SCATTER_MS + 1500;

    try {
      await onVerify(value);
      const wait = Math.max(0, minUntil.current - Date.now());
      after(wait, () => {
        target.current = 101;
        after(420, () => {
          setPct(100);
          setPhase("granted");
          play(verified);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          Animated.timing(grant, { toValue: 1, duration: 900, easing: EASE, useNativeDriver: true }).start();
          after(successHoldMs, onSuccess);
        });
      });
    } catch (err: any) {
      const message = err?.message || "That code wasn't accepted. Request a new one and try again.";
      const wait = Math.max(0, minUntil.current - Date.now() - 900);
      after(wait, () => {
        if (raf.current) { cancelAnimationFrame(raf.current); raf.current = null; }
        setErrorMsg(message);
        setPhase("error");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        Animated.sequence([
          Animated.timing(shake, { toValue: 1, duration: 70, useNativeDriver: true }),
          Animated.timing(shake, { toValue: -1, duration: 70, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
          Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
        ]).start();
        after(1150, () => { busy.current = false; resetTiles(); });
      });
    }
  }, [after, length, onSuccess, onVerify, resetTiles, runRing, successHoldMs]);

  /* ── Act 1: typing ── */
  const write = (i: number, raw: string) => {
    const clean = raw.replace(/\D/g, "");
    if (locked) return;
    if (!clean) {
      setDigits((d) => { const n = [...d]; n[i] = ""; return n; });
      return;
    }
    play(tick);
    setDigits((d) => {
      const n = [...d];
      // a pasted block fills forward from here
      clean.split("").forEach((ch, k) => { if (i + k < length) n[i + k] = ch; });
      const next = Math.min(i + clean.length, length - 1);
      inputs.current[next]?.focus();
      const joined = n.join("");
      if (joined.length === length && !n.includes("")) after(140, () => start(joined));
      return n;
    });
  };

  const onKey = (i: number, key: string) => {
    if (key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
      setDigits((d) => { const n = [...d]; n[i - 1] = ""; return n; });
    }
  };

  const tileW = useMemo(() => Math.min(52, (Dimensions.get("window").width - 80) / length - 8), [length]);
  const radius = 72;

  const headline = phase === "granted" ? successTitle : locked ? "Verifying…" : title;
  const sub = phase === "granted" ? successSubtitle : phase === "error" ? errorMsg : subtitle;

  const circ = 2 * Math.PI * ((RING - 10) / 2);

  return (
    <Animated.View
      style={{
        borderRadius: 26,
        borderWidth: 1,
        borderColor: phase === "granted" ? c.success + "70" : phase === "error" ? c.danger + "70" : c.border,
        backgroundColor: c.surface,
        padding: 20,
        overflow: "hidden",
        transform: [{ translateX: shake.interpolate({ inputRange: [-1, 1], outputRange: [-9, 9] }) }],
      }}
    >
      {/* success bloom behind everything */}
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, opacity: grant.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) }}
      >
        <LinearGradient colors={[c.success + "2e", "transparent"] as any} style={{ flex: 1 }} />
      </Animated.View>

      <Txt size={19} font="sansExt" align="center" style={{ color: phase === "granted" ? c.success : c.fg }}>{headline}</Txt>
      {sub ? (
        <Txt size={12.5} lh={18} align="center" tone={phase === "error" ? "danger" : "muted"} style={{ marginTop: 6 }}>{sub}</Txt>
      ) : null}

      {/* ── stage ── */}
      <View style={{ height: STAGE_H, alignItems: "center", justifyContent: "center", marginTop: 14 }}>
        {/* Act 1 — the row of tiles */}
        {phase === "input" || phase === "error" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            {Array.from({ length }).map((_, i) => (
              <Tile
                key={i}
                w={tileW}
                value={digits[i] || ""}
                invalid={phase === "error"}
                inputRef={(el) => { inputs.current[i] = el; }}
                onChangeText={(t) => write(i, t)}
                onKeyPress={(e) => onKey(i, e.nativeEvent.key)}
              />
            ))}
          </View>
        ) : null}

        {/* Act 2 — the orbit */}
        {phase === "scatter"
          ? digits.map((d, i) => {
              const slotX = (i - (length - 1) / 2) * (tileW + 8);
              const tr = orbitTrack(slotX, 0, i, length, radius);
              const range = tr.x.map((_, k) => k / SAMPLES);
              return (
                <Animated.View
                  key={i}
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    width: tileW, height: tileW * 1.22,
                    alignItems: "center", justifyContent: "center",
                    borderRadius: 14, borderWidth: 1.5, borderColor: c.accent, backgroundColor: c.accent + "1f",
                    opacity: scatter.interpolate({ inputRange: range, outputRange: tr.opacity }),
                    transform: [
                      { translateX: scatter.interpolate({ inputRange: range, outputRange: tr.x }) },
                      { translateY: scatter.interpolate({ inputRange: range, outputRange: tr.y }) },
                      { rotate: scatter.interpolate({ inputRange: range, outputRange: tr.rotate.map((r) => `${r}deg`) }) },
                      { scale: scatter.interpolate({ inputRange: range, outputRange: tr.scale }) },
                    ],
                  }}
                >
                  <Txt size={22} font="display" tone="accent">{d}</Txt>
                </Animated.View>
              );
            })
          : null}

        {/* Act 3 — the ring */}
        {phase === "verifying" ? (
          <Animated.View style={{ alignItems: "center", justifyContent: "center", opacity: ringIn, transform: [{ scale: ringIn.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }] }}>
            <Svg width={RING} height={RING} style={{ position: "absolute", transform: [{ rotate: "-90deg" }] }}>
              <Circle cx={RING / 2} cy={RING / 2} r={(RING - 10) / 2} stroke={c.surface2} strokeWidth={6} fill="none" />
              <Circle
                cx={RING / 2} cy={RING / 2} r={(RING - 10) / 2}
                stroke={c.accent} strokeWidth={6} fill="none" strokeLinecap="round"
                strokeDasharray={`${circ} ${circ}`}
                strokeDashoffset={circ * (1 - pct / 100)}
              />
            </Svg>
            <Txt size={30} font="display" tracking={-1}>{pct}%</Txt>
          </Animated.View>
        ) : null}

        {/* Act 4 — the check + confetti */}
        {phase === "granted" ? (
          <View style={{ alignItems: "center", justifyContent: "center" }}>
            {CONFETTI.map((p, i) => (
              <Animated.View
                key={i}
                pointerEvents="none"
                style={{
                  position: "absolute",
                  width: p.size, height: p.size, borderRadius: i % 3 === 0 ? 999 : 2,
                  backgroundColor: p.color,
                  opacity: grant.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] }),
                  transform: [
                    { translateX: grant.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                    { translateY: grant.interpolate({ inputRange: [0, 1], outputRange: [0, p.dy] }) },
                    { rotate: grant.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] }) },
                    { scale: grant.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1, 0.7] }) },
                  ],
                }}
              />
            ))}

            <Animated.View
              style={{
                width: 92, height: 92, borderRadius: 999,
                alignItems: "center", justifyContent: "center",
                backgroundColor: c.success + "24", borderWidth: 2, borderColor: c.success,
                transform: [{ scale: grant.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0.5, 1.12, 1] }) }],
              }}
            >
              <Check size={44} color={c.success} strokeWidth={3} />
            </Animated.View>

            <Animated.View
              style={{
                marginTop: 16, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6,
                backgroundColor: c.success,
                opacity: grant.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
                transform: [{ translateY: grant.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
              }}
            >
              <Txt size={11} font="sansBold" tracking={2} style={{ color: "#fff" }}>VERIFIED</Txt>
            </Animated.View>
          </View>
        ) : null}
      </View>

      {/* footer */}
      {phase === "error" ? (
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
          <AlertCircle size={14} color={c.danger} />
          <Txt size={12.5} tone="danger">Try the code again</Txt>
        </View>
      ) : !locked && onResend ? (
        <Pressable onPress={onResend} style={{ alignSelf: "center", paddingVertical: 6 }}>
          <Txt size={12.5} font="sansBold" tone="accent">Resend code</Txt>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

/** One digit tile. Pops when a digit lands in it. */
function Tile({ w, value, invalid, inputRef, onChangeText, onKeyPress }: {
  w: number; value: string; invalid?: boolean;
  inputRef: (el: TextInputInstance | null) => void;
  onChangeText: (t: string) => void;
  onKeyPress: (e: any) => void;
}) {
  const { c, fonts } = useTheme();
  const pop = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!value) return;
    pop.setValue(0);
    Animated.timing(pop, { toValue: 1, duration: 340, easing: EASE, useNativeDriver: true }).start();
  }, [value]);

  return (
    <Animated.View style={{ transform: [{ scale: pop.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 1.14, 1] }) }] }}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onKeyPress={onKeyPress}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        maxLength={6}
        selectTextOnFocus
        style={{
          width: w,
          height: w * 1.22,
          textAlign: "center",
          borderRadius: 14,
          borderWidth: 2,
          borderColor: invalid ? c.danger : focused ? c.accent : value ? c.borderStrong : c.border,
          backgroundColor: value ? c.surface2 : c.bgElevated,
          color: invalid ? c.danger : c.fg,
          fontFamily: fonts.display,
          fontSize: 23,
        }}
      />
    </Animated.View>
  );
}
