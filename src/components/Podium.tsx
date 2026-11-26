import React, { useEffect, useMemo, useRef } from "react";
import { InlineTick } from "@/components/VerifiedBadge";
import {
  View,
  StyleSheet,
  Animated,
  Easing,
  AccessibilityInfo,
  type ImageSourcePropType,
} from "react-native";
import { Image } from "expo-image";
import Svg, {
  Path,
  G,
  Rect,
  Circle,
  Ellipse,
  Polygon,
  Defs,
  LinearGradient,
  RadialGradient,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { Txt } from "@/components/ui";
import { fonts } from "@/theme/tokens";

/* ──────────────────────────────────────────────────────────────────────────
   Podium — three perspective blocks seen from slightly above.

   Every block is drawn as a top face (a trapezoid, receding toward a
   vanishing point over the middle of the screen) plus a front face that
   melts into the page background. The champion's block is taller, sits in
   front of the other two, and is outlined in gold; #2 and #3 are dark glass
   with their wreaths cut faintly into the front.

   All geometry lives in one 360-wide coordinate space and is scaled to the
   real screen width, so the avatars, wreaths and faces line up on every
   device instead of being nudged by hand.
   ────────────────────────────────────────────────────────────────────────── */

const BG = "#07080e";
const GOLD = "#F5C542";

let _uid = 0;
const useUid = (p: string) => useMemo(() => `${p}${++_uid}`, [p]);

/* ── Laurel wreath ─────────────────────────────────────────────────────── */

export type LaurelTone = "gold" | "silver" | "steel" | "ghost";

const TONES: Record<
  LaurelTone,
  { leaf: [string, string, string, string]; num: [string, string, string]; disc: [string, string, string]; discNum: string; stem: string }
> = {
  gold: {
    leaf: ["#FFF4BF", "#FFD24D", "#EFA21A", "#B06C06"],
    num: ["#FFFBE8", "#FFD75A", "#E39A12"],
    disc: ["#FFE680", "#F2B42A", "#A9690A"],
    discNum: "#3B2300",
    stem: "#C98A12",
  },
  silver: {
    leaf: ["#FFFFFF", "#E3E8EF", "#B3BDCB", "#7B8597"],
    num: ["#FFFFFF", "#E2E7EE", "#A9B3C2"],
    disc: ["#FFFFFF", "#DDE3EB", "#98A2B3"],
    discNum: "#151823",
    stem: "#9AA4B4",
  },
  steel: {
    leaf: ["#BFC6D2", "#8D95A6", "#687083", "#434A5A"],
    num: ["#E5E8EE", "#B5BCC8", "#7D8597"],
    disc: ["#3B4152", "#262A36", "#161922"],
    discNum: "#FFFFFF",
    stem: "#5E6677",
  },
  ghost: {
    leaf: ["#525872", "#3F4459", "#33384A", "#262A39"],
    num: ["#6F7590", "#535970", "#3D4255"],
    disc: ["#2A2E3D", "#1E212C", "#14161E"],
    discNum: "#8A90A6",
    stem: "#34394B",
  },
};

/** An almond leaf lying along +x, base at the origin. */
const leafPath = (L: number, W: number) =>
  `M0 0 C ${L * 0.26} ${-W} ${L * 0.7} ${-W} ${L} 0 C ${L * 0.7} ${W} ${L * 0.26} ${W} 0 0 Z`;

/** One branch of the wreath in a 100×100 box (the other is its mirror). */
const BRANCH = (() => {
  const cx = 50;
  const cy = 53;
  const r = 34;
  const P = (a: number) => [cx + r * Math.cos((a * Math.PI) / 180), cy - r * Math.sin((a * Math.PI) / 180)];
  const START = 262;
  const END = 118;
  const N = 7;

  const stem: string[] = [];
  for (let i = 0; i <= 24; i++) {
    const [x, y] = P(START - ((START - END) * i) / 24);
    stem.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
  }

  const leaves: { d: string; t: string }[] = [];
  for (let i = 0; i < N; i++) {
    const a = START - ((START - END) * (i + 0.55)) / N;
    const [x, y] = P(a);
    const [nx, ny] = P(a - 1);
    const dir = (Math.atan2(ny - y, nx - x) * 180) / Math.PI;
    const L = 17.5 - i * 1.05;
    const W = 5.6 - i * 0.32;
    // outer leaf, then inner leaf — both lean toward the tip of the branch
    leaves.push({ d: leafPath(L, W), t: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(dir - 44).toFixed(1)})` });
    leaves.push({ d: leafPath(L * 0.86, W * 0.88), t: `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(dir + 40).toFixed(1)})` });
  }
  const [tx, ty] = P(END);
  const [ux, uy] = P(END - 1);
  const tipDir = (Math.atan2(uy - ty, ux - tx) * 180) / Math.PI;
  leaves.push({ d: leafPath(11, 3.8), t: `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) rotate(${(tipDir - 6).toFixed(1)})` });

  return { stem: "M " + stem.join(" L "), leaves };
})();

/**
 * Laurel wreath with the rank inside it.
 * - `medal`: the number sits on a coin (table rows), like the reference list.
 * - otherwise: a large free-standing numeral (podium faces).
 */
export function RankLaurel({
  rank,
  size = 40,
  tone,
  medal = false,
  glow = false,
}: {
  rank: number;
  size?: number;
  tone?: LaurelTone;
  medal?: boolean;
  glow?: boolean;
}) {
  const id = useUid("lw");
  const t = TONES[tone ?? (rank === 1 ? "gold" : rank === 2 ? "silver" : "steel")];

  const leaves = (
    <G>
      <Path d={BRANCH.stem} stroke={t.stem} strokeWidth={1.4} fill="none" strokeLinecap="round" />
      {BRANCH.leaves.map((l, i) => (
        <Path key={i} d={l.d} transform={l.t} fill={`url(#${id}l)`} />
      ))}
    </G>
  );

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        {/* across each leaf: lit upper half, shaded lower half → a crisp midrib */}
        <LinearGradient id={`${id}l`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.leaf[0]} />
          <Stop offset="0.48" stopColor={t.leaf[1]} />
          <Stop offset="0.52" stopColor={t.leaf[2]} />
          <Stop offset="1" stopColor={t.leaf[3]} />
        </LinearGradient>
        <LinearGradient id={`${id}n`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={t.num[0]} />
          <Stop offset="0.5" stopColor={t.num[1]} />
          <Stop offset="1" stopColor={t.num[2]} />
        </LinearGradient>
        <LinearGradient id={`${id}d`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={t.disc[0]} />
          <Stop offset="0.55" stopColor={t.disc[1]} />
          <Stop offset="1" stopColor={t.disc[2]} />
        </LinearGradient>
        <RadialGradient id={`${id}g`} cx="50" cy="52" r="50" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={GOLD} stopOpacity="0.55" />
          <Stop offset="0.55" stopColor={GOLD} stopOpacity="0.16" />
          <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </RadialGradient>
      </Defs>

      {glow ? <Circle cx="50" cy="52" r="50" fill={`url(#${id}g)`} /> : null}

      {leaves}
      <G transform="translate(100 0) scale(-1 1)">{leaves}</G>
      {/* tie where the branches cross */}
      <Path d="M44 87.5 Q50 84 56 87.5 Q50 91 44 87.5 Z" fill={t.stem} />

      {medal ? (
        <>
          <Circle cx="50" cy="51" r="21" fill="rgba(0,0,0,0.35)" />
          <Circle cx="50" cy="50" r="20" fill={`url(#${id}d)`} />
          <Circle cx="50" cy="50" r="17.2" fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth={1} />
          <SvgText
            x="50"
            y="59.5"
            textAnchor="middle"
            fontFamily={fonts.display}
            fontWeight="800"
            fontSize="26"
            fill={t.discNum}
          >
            {String(rank)}
          </SvgText>
        </>
      ) : (
        <>
          {/* drop shadow, then the gradient numeral */}
          <SvgText x="50" y="70" textAnchor="middle" fontFamily={fonts.display} fontWeight="800" fontSize="46" fill="rgba(0,0,0,0.45)">
            {String(rank)}
          </SvgText>
          <SvgText x="50" y="68" textAnchor="middle" fontFamily={fonts.display} fontWeight="800" fontSize="46" fill={`url(#${id}n)`}>
            {String(rank)}
          </SvgText>
        </>
      )}

      {glow ? (
        <G fill="#FFF3C4">
          <Sparkle x={66} y={25} s={3.4} />
          <Sparkle x={34} y={33} s={2.2} />
          <Circle cx="62" cy="36" r="0.9" opacity={0.8} />
          <Circle cx="40" cy="22" r="0.8" opacity={0.6} />
        </G>
      ) : null}
    </Svg>
  );
}

function Sparkle({ x, y, s }: { x: number; y: number; s: number }) {
  return (
    <Path
      d={`M${x} ${y - s} Q${x + s * 0.18} ${y - s * 0.18} ${x + s} ${y} Q${x + s * 0.18} ${y + s * 0.18} ${x} ${y + s} Q${x - s * 0.18} ${y + s * 0.18} ${x - s} ${y} Q${x - s * 0.18} ${y - s * 0.18} ${x} ${y - s} Z`}
    />
  );
}

/* ── Podium ────────────────────────────────────────────────────────────── */

export type PodiumEntry = {
  key: string;
  name: string;
  avatar?: ImageSourcePropType | { uri: string };
  /** Draw the avatar yourself (e.g. initials when there is no photo). Gets the inner size. */
  renderAvatar?: (size: number) => React.ReactNode;
  score: string;
  badge?: React.ReactNode;
  /** Verified member — the tick flows right after the name. */
  verified?: boolean;
} | null;

/* Geometry in a 360 × 232 box. */
const VB_W = 360;
const VB_H = 232;
// centre block
const C_L = 118;
const C_R = 242;
const C_TOP = 64; // front-top edge
const C_BACK = 34; // back edge of the top face
const C_INSET = 16; // how much narrower the back edge is per side
// side blocks
const S_OUT = 6; // outer x of the left block (mirrored for the right)
const S_TOP = 114;
const S_BACK = 88;
const S_INSET = 24;

export function Podium({
  width,
  first,
  second,
  third,
  replayKey,
  bg = BG,
}: {
  width: number;
  first: PodiumEntry;
  second: PodiumEntry;
  third: PodiumEntry;
  /** Change it to play the entrance again (new competition / round / category). */
  replayKey?: string;
  /** Page background the blocks fade into. */
  bg?: string;
}) {
  const id = useUid("pd");
  const k = width / VB_W;
  const svgH = VB_H * k;
  // room above the champion's block for avatar + a name that may wrap to two lines
  const TOP = Math.max(26, 150 - C_BACK * k);
  const H = TOP + svgH;
  const X = (x: number) => x * k;
  const Y = (y: number) => TOP + y * k;

  const s1 = 96 * k;
  const s2 = 70 * k;
  const leftCx = (S_OUT + C_L) / 2 + 6;
  const rightCx = VB_W - leftCx;

  const R = VB_W - S_OUT; // outer x of the right block

  /* ── Entrance ──
     The blocks rise out of the floor one after another — #3, then #2, then
     the champion — on a long ease-out so they glide to a stop instead of
     snapping. Each contestant pops onto their block once it has landed. */
  const rise = useRef([0, 1, 2].map(() => new Animated.Value(0))).current; // [#3, #2, #1]
  const pop = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    let cancelled = false;
    let run: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        [...rise, ...pop].forEach((v) => v.setValue(reduce ? 1 : 0));
        if (reduce) return;
        const ease = Easing.bezier(0.16, 1, 0.3, 1);
        const block = (v: Animated.Value, delay: number) =>
          Animated.timing(v, { toValue: 1, duration: 1000, delay, easing: ease, useNativeDriver: true });
        const face = (v: Animated.Value, delay: number) =>
          Animated.spring(v, { toValue: 1, delay, tension: 110, friction: 9, useNativeDriver: true });
        run = Animated.parallel([
          block(rise[0], 0),
          block(rise[1], 140),
          block(rise[2], 280),
          face(pop[0], 620),
          face(pop[1], 760),
          face(pop[2], 900),
        ]);
        run.start();
      });
    return () => {
      cancelled = true;
      run?.stop();
    };
  }, [replayKey]);

  const riseStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 1, 1] }),
    transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [svgH * 0.85, 0] }) }],
  });

  const svgProps = {
    width,
    height: svgH,
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    style: { position: "absolute" as const, top: TOP, left: 0 },
  };
  const layer = [styles.layer, { width, height: H }];

  return (
    <View style={{ width, height: H, overflow: "hidden" }}>
      {/* soft light spilling up behind the champion */}
      <Animated.View pointerEvents="none" style={[layer, { opacity: rise[2] }]}>
        <Svg {...svgProps}>
          <BlockDefs bg={bg} id={`${id}h`} />
          <Ellipse cx="180" cy="66" rx="150" ry="66" fill={`url(#${id}hhalo)`} />
        </Svg>
      </Animated.View>

      {/* ── #2 (left) ── */}
      <Animated.View pointerEvents="none" style={[layer, riseStyle(rise[1])]}>
        <Svg {...svgProps}>
          <BlockDefs bg={bg} id={`${id}l`} />
          <Polygon points={`${S_OUT},${S_TOP} ${C_L},${S_TOP} ${C_L},${S_BACK} ${S_OUT + S_INSET},${S_BACK}`} fill={`url(#${id}lst)`} />
          <Rect x={S_OUT} y={S_TOP} width={C_L - S_OUT} height={VB_H - S_TOP} fill={`url(#${id}lsf)`} />
          <Rect x={S_OUT} y={S_TOP} width={C_L - S_OUT} height={VB_H - S_TOP} fill={`url(#${id}lshL)`} />
          <Path d={`M${S_OUT} ${S_TOP} L${C_L} ${S_TOP}`} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
          <Path d={`M${S_OUT} ${S_TOP} L${S_OUT + S_INSET} ${S_BACK} L${C_L} ${S_BACK}`} stroke="rgba(255,255,255,0.09)" strokeWidth={1} fill="none" />
          <Rect x={S_OUT} y={S_TOP} width={1} height={96} fill={`url(#${id}lef)`} />
        </Svg>
        <View style={[styles.abs, { left: X(leftCx) - s2 / 2, top: Y(166) - s2 / 2 }]}>
          <RankLaurel rank={2} size={s2} tone="ghost" />
        </View>
      </Animated.View>

      {/* ── #3 (right) ── */}
      <Animated.View pointerEvents="none" style={[layer, riseStyle(rise[0])]}>
        <Svg {...svgProps}>
          <BlockDefs bg={bg} id={`${id}r`} />
          <Polygon points={`${R},${S_TOP} ${C_R},${S_TOP} ${C_R},${S_BACK} ${R - S_INSET},${S_BACK}`} fill={`url(#${id}rst)`} />
          <Rect x={C_R} y={S_TOP} width={R - C_R} height={VB_H - S_TOP} fill={`url(#${id}rsf)`} />
          <Rect x={C_R} y={S_TOP} width={R - C_R} height={VB_H - S_TOP} fill={`url(#${id}rshR)`} />
          <Path d={`M${C_R} ${S_TOP} L${R} ${S_TOP}`} stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
          <Path d={`M${R} ${S_TOP} L${R - S_INSET} ${S_BACK} L${C_R} ${S_BACK}`} stroke="rgba(255,255,255,0.09)" strokeWidth={1} fill="none" />
          <Rect x={R - 1} y={S_TOP} width={1} height={96} fill={`url(#${id}ref)`} />
        </Svg>
        <View style={[styles.abs, { left: X(rightCx) - s2 / 2, top: Y(166) - s2 / 2 }]}>
          <RankLaurel rank={3} size={s2} tone="ghost" />
        </View>
      </Animated.View>

      {/* ── #1 (centre, in front) ── */}
      <Animated.View pointerEvents="none" style={[layer, riseStyle(rise[2])]}>
        <Svg {...svgProps}>
          <BlockDefs bg={bg} id={`${id}c`} />
          <Rect x={C_L} y={C_TOP} width={C_R - C_L} height={VB_H - C_TOP} fill={`url(#${id}cgf)`} />
          <Rect x={C_L} y={C_TOP} width={C_R - C_L} height={VB_H - C_TOP} fill={`url(#${id}cgg)`} />
          <Polygon
            points={`${C_L},${C_TOP} ${C_R},${C_TOP} ${C_R - C_INSET},${C_BACK} ${C_L + C_INSET},${C_BACK}`}
            fill={`url(#${id}cgt)`}
          />
          {/* neon rim: two wide faint passes under a crisp line read as glow */}
          {[
            { w: 7, o: 0.1 },
            { w: 3.6, o: 0.28 },
            { w: 1.5, o: 1 },
          ].map((p) => (
            <Polygon
              key={p.w}
              points={`${C_L},${C_TOP} ${C_R},${C_TOP} ${C_R - C_INSET},${C_BACK} ${C_L + C_INSET},${C_BACK}`}
              fill="none"
              stroke={GOLD}
              strokeOpacity={p.o}
              strokeWidth={p.w}
              strokeLinejoin="round"
            />
          ))}
          <Rect x={C_L - 0.7} y={C_TOP} width={1.5} height={140} fill={`url(#${id}cge)`} />
          <Rect x={C_R - 0.8} y={C_TOP} width={1.5} height={140} fill={`url(#${id}cge)`} />
          <Rect x={C_L - 3} y={C_TOP} width={6} height={60} fill={`url(#${id}cge)`} opacity={0.12} />
          <Rect x={C_R - 3} y={C_TOP} width={6} height={60} fill={`url(#${id}cge)`} opacity={0.12} />
        </Svg>
        <View style={[styles.abs, { left: X(180) - s1 / 2, top: Y(126) - s1 / 2 }]}>
          <RankLaurel rank={1} size={s1} tone="gold" glow />
        </View>
      </Animated.View>

      {/* contestants standing on their blocks */}
      <Face entry={second} anim={pop[1]} cx={X(leftCx)} bottom={H - Y(S_BACK + 12)} avatar={54} width={X(C_L - S_OUT) + 4} />
      <Face entry={third} anim={pop[0]} cx={X(rightCx)} bottom={H - Y(S_BACK + 12)} avatar={54} width={X(C_L - S_OUT) + 4} />
      <Face entry={first} anim={pop[2]} cx={X(180)} bottom={H - Y(C_BACK + 14)} avatar={66} width={X(C_R - C_L) + 8} />
    </View>
  );
}

/** Every gradient the blocks use, namespaced so each layer's SVG owns its own. */
function BlockDefs({ id, bg }: { id: string; bg: string }) {
  return (
    <Defs>
      <LinearGradient id={`${id}sf`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#1D2134" />
        <Stop offset="0.5" stopColor="#11131E" />
        <Stop offset="1" stopColor={bg} />
      </LinearGradient>
      <LinearGradient id={`${id}st`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#23273B" />
        <Stop offset="1" stopColor="#363C57" />
      </LinearGradient>
      {/* the champion block throws a shadow onto the inner side of each block */}
      <LinearGradient id={`${id}shL`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#000" stopOpacity="0" />
        <Stop offset="0.6" stopColor="#000" stopOpacity="0" />
        <Stop offset="1" stopColor="#000" stopOpacity="0.5" />
      </LinearGradient>
      <LinearGradient id={`${id}shR`} x1="1" y1="0" x2="0" y2="0">
        <Stop offset="0" stopColor="#000" stopOpacity="0" />
        <Stop offset="0.6" stopColor="#000" stopOpacity="0" />
        <Stop offset="1" stopColor="#000" stopOpacity="0.5" />
      </LinearGradient>
      <LinearGradient id={`${id}ef`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.2" />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </LinearGradient>
      <LinearGradient id={`${id}gf`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#4A370F" />
        <Stop offset="0.45" stopColor="#1C150A" />
        <Stop offset="1" stopColor={bg} />
      </LinearGradient>
      <LinearGradient id={`${id}gt`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={GOLD} stopOpacity="0.06" />
        <Stop offset="1" stopColor={GOLD} stopOpacity="0.24" />
      </LinearGradient>
      <LinearGradient id={`${id}ge`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor={GOLD} stopOpacity="1" />
        <Stop offset="0.55" stopColor={GOLD} stopOpacity="0.25" />
        <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
      </LinearGradient>
      <RadialGradient id={`${id}gg`} cx="180" cy="128" r="74" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor={GOLD} stopOpacity="0.36" />
        <Stop offset="0.6" stopColor={GOLD} stopOpacity="0.1" />
        <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
      </RadialGradient>
      {/* bounding-box gradient: fades to nothing exactly at the ellipse edge,
          so the halo never shows a hard cut at the top of the canvas */}
      <RadialGradient id={`${id}halo`} cx="50%" cy="50%" rx="50%" ry="50%">
        <Stop offset="0" stopColor={GOLD} stopOpacity="0.15" />
        <Stop offset="0.6" stopColor={GOLD} stopOpacity="0.05" />
        <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
      </RadialGradient>
    </Defs>
  );
}

function ScoreGem({ size = 11 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2L22 12L12 22L2 12Z" fill="#22C37A" />
      <Path d="M12 2L22 12H2Z" fill="#5BE3A4" />
    </Svg>
  );
}

function Face({
  entry,
  anim,
  cx,
  bottom,
  avatar,
  width,
}: {
  entry: PodiumEntry;
  anim: Animated.Value;
  cx: number;
  bottom: number;
  avatar: number;
  width: number;
}) {
  if (!entry) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.abs,
        styles.face,
        {
          left: cx - width / 2,
          bottom,
          width,
          opacity: anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1], extrapolate: "clamp" }),
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) },
          ],
        },
      ]}
    >
      <View style={[styles.avatar, { width: avatar, height: avatar, borderRadius: avatar / 2 }]}>
        {entry.renderAvatar ? (
          entry.renderAvatar(avatar - 4)
        ) : (
          <Image source={entry.avatar as any} style={StyleSheet.absoluteFill} contentFit="cover" />
        )}
      </View>
      <View style={styles.nameRow}>
        <Txt size={13} font="sansBold" numberOfLines={2} style={styles.name}>
          {entry.name}
          {entry.verified ? "\u00A0" : ""}
          {entry.verified ? <InlineTick fontSize={13} /> : null}
        </Txt>
        {entry.badge}
      </View>
      <View style={styles.pill}>
        <ScoreGem />
        <Txt size={13} font="sansExt" style={{ color: "#FFFFFF", letterSpacing: -0.2 }}>
          {entry.score}
        </Txt>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  abs: { position: "absolute" },
  layer: { position: "absolute", top: 0, left: 0 },
  face: { alignItems: "center" },
  avatar: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1A1C2A",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.14)",
    shadowColor: "#000",
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 6,
    maxWidth: "100%",
    paddingHorizontal: 2,
  },
  name: {
    color: "#FFFFFF",
    flexShrink: 1,
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowRadius: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 5,
    height: 25,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: "#0B1A14",
    borderWidth: 1.3,
    borderColor: "#1E9B66",
  },
});
