import React, { useEffect, useRef, useState } from "react";
import { View, Text, Animated, Easing, Dimensions } from "react-native";
import Svg, { Path, Defs, LinearGradient as SvgGrad, Stop, Circle } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { MaskedView } from "@/components/vendor";
import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import { CalendarDays, Users, GraduationCap, Trophy, Sparkles } from "lucide-react-native";
import { Txt } from "@/components/ui";
import { useTheme } from "@/theme/ThemeProvider";


const { width: W, height: SCREEN_H } = Dimensions.get("window");

const XL = 54;
const XR = W - 54;
const ROW_Y = [40, 148, 256, 364];
const CANVAS_H = 408;

/* The run: one bent line that snakes down the band, a node per milestone. */
const D =
  `M ${XL} ${ROW_Y[0]} ` +
  `C ${XL} ${ROW_Y[0] + 54}, ${XR} ${ROW_Y[1] - 54}, ${XR} ${ROW_Y[1]} ` +
  `C ${XR} ${ROW_Y[1] + 54}, ${XL} ${ROW_Y[2] - 54}, ${XL} ${ROW_Y[2]} ` +
  `C ${XL} ${ROW_Y[2] + 54}, ${XR} ${ROW_Y[3] - 54}, ${XR} ${ROW_Y[3]}`;

/* Sampled once so the dash animation draws the line exactly, not approximately. */
const PATH_LEN = (() => {
  const seg = (p0: number[], c1: number[], c2: number[], p3: number[]) => {
    let len = 0;
    let prev = p0;
    for (let i = 1; i <= 48; i++) {
      const t = i / 48;
      const u = 1 - t;
      const x = u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * p3[0];
      const y = u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * p3[1];
      len += Math.hypot(x - prev[0], y - prev[1]);
      prev = [x, y];
    }
    return len;
  };
  return (
    seg([XL, ROW_Y[0]], [XL, ROW_Y[0] + 54], [XR, ROW_Y[1] - 54], [XR, ROW_Y[1]]) +
    seg([XR, ROW_Y[1]], [XR, ROW_Y[1] + 54], [XL, ROW_Y[2] - 54], [XL, ROW_Y[2]]) +
    seg([XL, ROW_Y[2]], [XL, ROW_Y[2] + 54], [XR, ROW_Y[3] - 54], [XR, ROW_Y[3]])
  );
})();

const APath = Animated.createAnimatedComponent(Path);



/** Fraction of the line that must be drawn before each node lands. */
const GATE = [0.02, 0.34, 0.67, 0.98];

type Sfx = { tick: () => void; pop: () => void };

/** Gradient-filled odometer. Steps at ~22fps so the masked fill stays cheap. */
function Counter({ to, suffix, run, tone, sfx }: { to: number; suffix?: string; run: boolean; tone: string[]; sfx: Sfx }) {
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!run) return;
    let step = 0;
    const steps = 22;
    const id = setInterval(() => {
      step += 1;
      const p = Math.min(1, step / steps);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (step % 4 === 0 && p < 1) sfx.tick();
      if (p >= 1) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, [run, to]);

  const label = `${n.toLocaleString("en-IN")}${suffix || ""}`;
  const style = { fontSize: 33, fontWeight: "900" as const, letterSpacing: -1.5, lineHeight: 38 };

  return (
    <MaskedView maskElement={<View style={{ backgroundColor: "transparent" }}><Text style={style}>{label}</Text></View>}>
      <LinearGradient colors={tone as [string, string, ...string[]]} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 1 }}>
        <Text style={[style, { opacity: 0 }]}>{label}</Text>
      </LinearGradient>
    </MaskedView>
  );
}

function Node({ x, y, tone, on }: { x: number; y: number; tone: string; on: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!on) return;
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 13, bounciness: 14 }).start();
    const loop = Animated.loop(Animated.timing(halo, { toValue: 1, duration: 2000, easing: Easing.out(Easing.ease), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [on]);

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", left: x - 14, top: y - 14, width: 28, height: 28,
        alignItems: "center", justifyContent: "center",
        opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
      }}
    >
      <Animated.View
        style={{
          position: "absolute", width: 28, height: 28, borderRadius: 999, backgroundColor: tone,
          opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
          transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.8, 2.1] }) }],
        }}
      />
      <View style={{ width: 13, height: 13, borderRadius: 999, backgroundColor: tone, shadowColor: tone, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 }} />
    </Animated.View>
  );
}

function Chip({
  y, side, tone, accent, Icon, index, value, suffix, label, on, sfx,
}: {
  y: number; side: "left" | "right"; tone: string[]; accent: string; Icon: any;
  index: number; value: number; suffix?: string; label: string; on: boolean; sfx: Sfx;
}) {
  const { c } = useTheme();
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!on) return;
    sfx.pop();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.spring(v, { toValue: 1, useNativeDriver: true, speed: 12, bounciness: 11 }).start();
  }, [on]);

  const left = side === "left";
  const from = left ? 44 : -44;
  const box = left
    ? { left: XL + 24, right: 14, alignItems: "flex-start" as const }
    : { left: 14, right: W - XR + 24, alignItems: "flex-end" as const };

  return (
    <Animated.View
      style={{
        position: "absolute", top: y - 46, height: 92, justifyContent: "center",
        ...box,
        opacity: v,
        transform: [
          { translateX: v.interpolate({ inputRange: [0, 1], outputRange: [from, 0] }) },
          { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) },
        ],
      }}
    >
      {/* a quiet glass plate, so each figure reads as a set piece */}
      <View
        style={{
          paddingVertical: 11, paddingHorizontal: 15, borderRadius: 20,
          backgroundColor: c.surface, borderWidth: 1, borderColor: c.border,
          shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3,
          alignItems: left ? "flex-start" : "flex-end",
        }}
      >
        {/* index · icon — editorial header line */}
        <View style={{ flexDirection: left ? "row" : "row-reverse", alignItems: "center", gap: 7, marginBottom: 2 }}>
          <Txt size={9.5} font="monoMed" tracking={1.5} style={{ color: accent }}>{String(index).padStart(2, "0")}</Txt>
          <View style={{ width: 14, height: 1, backgroundColor: c.border }} />
          <Icon size={13} color={c.fgSubtle} />
        </View>

        <Counter to={value} suffix={suffix} run={on} tone={tone} sfx={sfx} />

        <Txt size={10} font="monoMed" tracking={2} uppercase tone="subtle" style={{ marginTop: 2 }} numberOfLines={1}>{label}</Txt>
      </View>
    </Animated.View>
  );
}

export function StatsRun({ eventCount = 0, courseCount = 0, scrollY }: { eventCount?: number; courseCount?: number; scrollY?: Animated.Value }) {
  const { c } = useTheme();
  const tickPlayer = useAudioPlayer(require("../../assets/sounds/tick.wav"));
  const popPlayer = useAudioPlayer(require("../../assets/sounds/pop.wav"));

  useEffect(() => {
    try { tickPlayer.volume = 0.22; popPlayer.volume = 0.45; } catch {}
  }, []);

  const sfx: Sfx = {
    tick: () => { try { tickPlayer.seekTo(0); tickPlayer.play(); } catch {} },
    pop: () => { try { popPlayer.seekTo(0); popPlayer.play(); } catch {} },
  };

  const prog = useRef(new Animated.Value(0)).current;
  const [landed, setLanded] = useState(0);
  const [started, setStarted] = useState(!scrollY);
  const top = useRef(0);

  // The run only starts once the band is genuinely on screen — otherwise the
  // whole thing plays out (sounds and all) while it is still below the fold.
  useEffect(() => {
    if (!scrollY || started) return;
    const id = scrollY.addListener(({ value }) => {
      if (top.current && value + SCREEN_H > top.current + 120) setStarted(true);
    });
    return () => scrollY.removeListener(id);
  }, [scrollY, started]);

  useEffect(() => {
    if (!started) return;
    const id = prog.addListener(({ value }) => {
      setLanded((n) => {
        let next = n;
        while (next < GATE.length && value >= GATE[next]) next += 1;
        return next;
      });
    });
    Animated.timing(prog, { toValue: 1, duration: 2300, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
    return () => prog.removeListener(id);
  }, [started]);

  const stats = [
    { label: "Live events", value: Math.max(eventCount, 12), suffix: "+", Icon: CalendarDays },
    { label: "Dancers on stage", value: 25000, suffix: "+", Icon: Users },
    { label: "Masterclasses", value: Math.max(courseCount, 40), suffix: "+", Icon: GraduationCap },
    { label: "Cities covered", value: 28, suffix: "", Icon: Trophy },
  ];

  return (
    <View onLayout={(e) => { top.current = e.nativeEvent.layout.y; }} style={{ marginTop: 30 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 14 }}>
        <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, backgroundColor: c.accent + "1c", borderWidth: 1, borderColor: c.accent + "4d" }}>
          <Sparkles size={12} color={c.accent} />
          <Txt size={10} font="monoMed" tracking={2.5} uppercase tone="accent">Since day one</Txt>
        </View>
        <Txt size={28} font="display" tracking={-1} style={{ marginTop: 10 }}>The numbers so far</Txt>
        <Txt size={13} lh={19} tone="muted" style={{ marginTop: 5, maxWidth: 260 }}>Every stage, every dancer, every city we have lit up.</Txt>
      </View>

      <View style={{ height: CANVAS_H }}>
        <Svg width={W} height={CANVAS_H} style={{ position: "absolute", top: 0, left: 0 }} pointerEvents="none">
          <Defs>
            <SvgGrad id="runLine" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={c.gradBrand[0]} />
              <Stop offset="0.5" stopColor={c.gradBrand[1]} />
              <Stop offset="1" stopColor={c.gradBrand[3]} />
            </SvgGrad>
          </Defs>

          {/* ghost rail, so the curve reads even before it is drawn */}
          <Path d={D} stroke={c.border} strokeWidth={3} fill="none" strokeLinecap="round" />

          {/* soft bloom under the stroke — the line feels lit, not printed */}
          <APath
            d={D}
            stroke={c.accent}
            strokeWidth={11}
            strokeOpacity={0.14}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${PATH_LEN} ${PATH_LEN}`}
            strokeDashoffset={prog.interpolate({ inputRange: [0, 1], outputRange: [PATH_LEN, 0] }) as any}
          />
          <APath
            d={D}
            stroke="url(#runLine)"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${PATH_LEN} ${PATH_LEN}`}
            strokeDashoffset={prog.interpolate({ inputRange: [0, 1], outputRange: [PATH_LEN, 0] }) as any}
          />

          {ROW_Y.map((y, i) => (
            <Circle key={i} cx={i % 2 === 0 ? XL : XR} cy={y} r={5} fill={c.border} />
          ))}
        </Svg>

        {stats.map((_, i) => (
          <Node key={`n${i}`} x={i % 2 === 0 ? XL : XR} y={ROW_Y[i]} tone={c.accent} on={landed > i} />
        ))}

        {stats.map((s, i) => (
          <Chip
            key={`c${i}`}
            y={ROW_Y[i]}
            side={i % 2 === 0 ? "left" : "right"}
            tone={c.gradBrand}
            accent={c.accent}
            Icon={s.Icon}
            index={i + 1}
            value={s.value}
            suffix={s.suffix}
            label={s.label}
            on={landed > i}
            sfx={sfx}
          />
        ))}
      </View>
    </View>
  );
}
