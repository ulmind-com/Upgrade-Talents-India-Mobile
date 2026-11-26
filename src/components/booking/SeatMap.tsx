import React, { forwardRef, memo, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { View, Pressable, StyleSheet, Text } from "react-native";
import Animated, { Easing, FadeIn, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from "react-native-gesture-handler";
import Svg, { Defs, LinearGradient as SvgGradient, Path, Stop } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { Minus, Plus, Maximize } from "lucide-react-native";
import type { TicketTier } from "@/lib/api";
import { seatId, zoneFor, type SeatRow } from "@/lib/seating";
import { formatINR } from "@/lib/format";
import { useTheme } from "@/theme/ThemeProvider";

/* ──────────────────────────────────────────────────────────────────────────
   The arena. Stage at the top, one zone per tier, rows of seats split by
   aisles. Pinch to zoom (anchored under your fingers), drag to pan, the
   +/− buttons for one-handed use, and zone chips glide the camera to a
   zone. Motion is eased and calm — fades and glides, never a bounce.
   Everything that moves runs on the UI thread.
   ────────────────────────────────────────────────────────────────────────── */

export const PICK = "#FF385C";
const BOOKED_FILL = "#1C1E26";
const MIN_SCALE = 1;
const MAX_SCALE = 3.2;
/** Every camera move eases out — no overshoot, no bounce. */
const EASE = { duration: 320, easing: Easing.out(Easing.cubic) };
const glide = (v: number) => {
  "worklet";
  return withTiming(v, EASE);
};
/** Smallest comfortable seat; wider arenas pan sideways instead of shrinking. */
const MIN_UNIT = 22;

export type SeatTap = { id: string; row: string; num: number; tier: TicketTier };
export type SeatMapHandle = { focusTier: (tierId: string) => void; reset: () => void };

type Props = {
  tiers: TicketTier[];
  rows: Map<string, SeatRow[]>;
  booked: Set<string>;
  picked: Map<string, number>; // seat id → order picked (1-based), drives the number on the seat
  onTap: (s: SeatTap) => void;
  height: number;
};

export const SeatMap = forwardRef<SeatMapHandle, Props>(function SeatMap({ tiers, rows, booked, picked, onTap, height }, ref) {
  const { c } = useTheme();
  const [w, setW] = useState(0);

  /* ── sizing: the widest row fills the width at 1×, aisles count as one seat ── */
  const maxCols = useMemo(() => {
    let m = 10;
    rows.forEach((rs) => rs.forEach((r) => (m = Math.max(m, r.left.length + r.center.length + r.right.length))));
    return m;
  }, [rows]);
  const LABEL = 16;
  const AISLE = 0.7; // aisle width in seat units
  const fit = w ? (w - 24 - LABEL * 2) / (maxCols + AISLE * 2) : 0;
  const unit = w ? Math.max(MIN_UNIT, fit) : 0;
  const seat = Math.floor(unit * 0.84);
  const gap = Math.max(3, unit - seat);
  // the arena can be wider than the screen; it starts centred and pans sideways
  const contentW = w ? Math.max(w, Math.ceil(24 + LABEL * 2 + unit * (maxCols + AISLE * 2))) : 0;

  /* ── camera ── */
  const scale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const s0 = useSharedValue(1);
  const x0 = useSharedValue(0);
  const y0 = useSharedValue(0);
  const contentH = useSharedValue(height);
  const contentWsv = useSharedValue(0);
  const viewW = useSharedValue(0);
  const viewH = useSharedValue(height);
  const zoneY = useRef(new Map<string, number>()).current;

  useEffect(() => {
    viewW.set(w);
    viewH.set(height);
    contentWsv.set(contentW);
  }, [w, height, contentW, viewW, viewH, contentWsv]);

  const clampX = (x: number, s: number) => {
    "worklet";
    const max = Math.max(0, (contentWsv.value * s - viewW.value) / 2);
    return Math.min(max, Math.max(-max, x));
  };
  const clampY = (y: number, s: number) => {
    "worklet";
    const H = contentH.value;
    const top = (H * s - H) / 2; // translate that puts the scaled content's top edge at 0
    const bottom = viewH.value - H / 2 - (H * s) / 2; // …its bottom edge at the view's bottom
    if (bottom > top) return top; // shorter than the view: pin to the top
    return Math.min(top, Math.max(bottom, y));
  };

  const pinch = usePinchGesture({
    onBegin: () => {
      "worklet";
      s0.value = scale.value;
      x0.value = tx.value;
      y0.value = ty.value;
    },
    onUpdate: (e) => {
      "worklet";
      const ns = Math.min(MAX_SCALE + 0.4, Math.max(MIN_SCALE * 0.85, s0.value * e.scale));
      // keep the point under the fingers still
      const cx = viewW.value / 2;
      const cy = contentH.value / 2;
      const k = ns / s0.value;
      scale.value = ns;
      tx.value = e.focalX - cx - k * (e.focalX - cx - x0.value);
      ty.value = e.focalY - cy - k * (e.focalY - cy - y0.value);
    },
    onDeactivate: () => {
      "worklet";
      const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value));
      scale.value = glide(s);
      tx.value = glide(clampX(tx.value, s));
      ty.value = glide(clampY(ty.value, s));
    },
  });

  const pan = usePanGesture({
    minDistance: 8,
    maxPointers: 2,
    onBegin: () => {
      "worklet";
      x0.value = tx.value;
      y0.value = ty.value;
    },
    onUpdate: (e) => {
      "worklet";
      // rubber-band past the edges
      const s = scale.value;
      const nx = x0.value + e.translationX;
      const ny = y0.value + e.translationY;
      const cx = clampX(nx, s);
      const cy = clampY(ny, s);
      tx.value = cx + (nx - cx) * 0.25;
      ty.value = cy + (ny - cy) * 0.25;
    },
    onDeactivate: (e) => {
      "worklet";
      const s = scale.value;
      tx.value = glide(clampX(tx.value + e.velocityX * 0.06, s));
      ty.value = glide(clampY(ty.value + e.velocityY * 0.06, s));
    },
  });

  const gesture = useSimultaneousGestures(pinch, pan);

  const camera = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }, { scale: scale.value }],
  }));

  // zoom about the centre of what's on screen
  const zoomBy = (f: number) => {
    const cur = scale.get();
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cur * f));
    const k = s / cur;
    const pivot = viewH.get() / 2 - contentH.get() / 2;
    scale.set(glide(s));
    tx.set(glide(clampX(tx.get() * k, s)));
    ty.set(glide(clampY((ty.get() - pivot) * k + pivot, s)));
    Haptics.selectionAsync().catch(() => {});
  };

  const reset = () => {
    scale.set(glide(1));
    tx.set(glide(0));
    ty.set(glide(clampY(0, 1)));
  };

  useImperativeHandle(ref, () => ({
    reset,
    focusTier: (tierId: string) => {
      const y = zoneY.get(tierId);
      if (y == null) return;
      const s = 1.45;
      const H = contentH.get();
      // translate so the zone's top sits a little below the view's top
      const want = 14 - (H / 2 + (y - H / 2) * s);
      scale.set(glide(s));
      tx.set(glide(0));
      ty.set(glide(clampY(want, s)));
    },
  }));

  let rowIndex = 0;

  return (
    <View style={{ height, overflow: "hidden" }} onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))}>
      {w ? (
        <GestureDetector gesture={gesture}>
          <View style={{ flex: 1 }}>
            <Animated.View
              style={[{ width: contentW, marginLeft: (w - contentW) / 2, paddingHorizontal: 12, paddingBottom: 28 }, camera]}
              onLayout={(e) => {
                contentH.set(e.nativeEvent.layout.height);
                ty.set(clampY(ty.get(), scale.get()));
              }}
            >
              <Stage width={contentW - 24} />

              {tiers.map((t) => {
                const z = zoneFor(t.type, t.price);
                const rs = rows.get(t._id) || [];
                return (
                  <View key={t._id} onLayout={(e) => zoneY.set(t._id, e.nativeEvent.layout.y)} style={{ marginTop: 18 }}>
                    <Animated.View entering={FadeIn.duration(400)} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10, paddingHorizontal: LABEL }}>
                      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: z.color + "55" }} />
                      <Text style={[st.zoneTxt, { color: z.color }]}>
                        {(t.type || z.label).toUpperCase()} · {t.price > 0 ? formatINR(t.price) : "FREE"}
                      </Text>
                      <View style={{ flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: z.color + "55" }} />
                    </Animated.View>

                    {rs.map((r) => {
                      const i = rowIndex++;
                      return (
                        <Animated.View
                          key={r.code}
                          entering={FadeIn.delay(Math.min(i, 20) * 24).duration(360).easing(Easing.out(Easing.cubic))}
                          style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: gap + 1 }}
                        >
                          <Text style={[st.rowTxt, { width: LABEL, color: c.fgSubtle }]}>{r.code}</Text>
                          <Block nums={r.left} row={r.code} tier={t} color={z.color} seat={seat} gap={gap} booked={booked} picked={picked} onTap={onTap} />
                          <View style={{ width: unit * AISLE }} />
                          <Block nums={r.center} row={r.code} tier={t} color={z.color} seat={seat} gap={gap} booked={booked} picked={picked} onTap={onTap} />
                          <View style={{ width: unit * AISLE }} />
                          <Block nums={r.right} row={r.code} tier={t} color={z.color} seat={seat} gap={gap} booked={booked} picked={picked} onTap={onTap} />
                          <Text style={[st.rowTxt, { width: LABEL, color: c.fgSubtle }]}>{r.code}</Text>
                        </Animated.View>
                      );
                    })}
                  </View>
                );
              })}
            </Animated.View>
          </View>
        </GestureDetector>
      ) : null}

      {/* camera controls */}
      <View style={st.controls} pointerEvents="box-none">
        <CamBtn onPress={() => zoomBy(1.45)} label="Zoom in"><Plus size={17} color="#fff" /></CamBtn>
        <CamBtn onPress={() => zoomBy(1 / 1.45)} label="Zoom out"><Minus size={17} color="#fff" /></CamBtn>
        <CamBtn onPress={reset} label="Fit arena"><Maximize size={15} color="#fff" /></CamBtn>
      </View>
    </View>
  );
});

/** One aisle-to-aisle block of seats in a row. */
const Block = memo(function Block({
  nums, row, tier, color, seat, gap, booked, picked, onTap,
}: {
  nums: number[]; row: string; tier: TicketTier; color: string; seat: number; gap: number;
  booked: Set<string>; picked: Map<string, number>; onTap: (s: SeatTap) => void;
}) {
  if (!nums.length) return null;
  return (
    <View style={{ flexDirection: "row", gap }}>
      {nums.map((n) => {
        const id = seatId(row, n);
        return (
          <Seat
            key={id}
            id={id}
            row={row}
            num={n}
            tier={tier}
            size={seat}
            color={color}
            isBooked={booked.has(id)}
            order={picked.get(id) || 0}
            onTap={onTap}
          />
        );
      })}
    </View>
  );
});

/** A chair: rounded back, flatter base. Springs on pick, fills with the pick colour. */
const Seat = memo(function Seat({
  id, row, num, tier, size, color, isBooked, order, onTap,
}: { id: string; row: string; num: number; tier: TicketTier; size: number; color: string; isBooked: boolean; order: number; onTap: (s: SeatTap) => void }) {
  const on = order > 0;
  const fill = useSharedValue(on ? 1 : 0);

  useEffect(() => {
    fill.set(withTiming(on ? 1 : 0, { duration: 170, easing: Easing.out(Easing.quad) }));
  }, [on, fill]);

  const fillStyle = useAnimatedStyle(() => ({ opacity: fill.value }));

  const shape = {
    width: size,
    height: size * 0.92,
    borderTopLeftRadius: size * 0.36,
    borderTopRightRadius: size * 0.36,
    borderBottomLeftRadius: size * 0.16,
    borderBottomRightRadius: size * 0.16,
  };

  return (
    <Pressable
      onPress={() => {
        if (isBooked) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          return;
        }
        Haptics.selectionAsync().catch(() => {});
        onTap({ id, row, num, tier });
      }}
      hitSlop={2}
      accessibilityRole="button"
      accessibilityLabel={`Seat ${id}${isBooked ? ", booked" : on ? ", selected" : ""}`}
    >
      <View
        style={[
          shape,
          {
            borderWidth: isBooked ? 0 : 1.2,
            borderColor: color + "B3",
            backgroundColor: isBooked ? BOOKED_FILL : color + "14",
            alignItems: "center",
            justifyContent: "center",
          },
        ]}
      >
        {isBooked ? <View style={{ width: size * 0.34, height: 1.5, borderRadius: 1, backgroundColor: "#3A3D48", transform: [{ rotate: "-45deg" }] }} /> : null}
        <Animated.View style={[StyleSheet.absoluteFill, shape, { backgroundColor: PICK, alignItems: "center", justifyContent: "center", margin: -1.2 }, fillStyle]}>
          {on ? <Text style={{ color: "#fff", fontSize: Math.max(6.5, size * 0.42), fontWeight: "800" }}>{num}</Text> : null}
        </Animated.View>
      </View>
    </Pressable>
  );
});

/** The curved stage, glowing towards the audience. */
function Stage({ width }: { width: number }) {
  const h = 46;
  return (
    <Animated.View entering={FadeIn.duration(600)} style={{ alignItems: "center", paddingTop: 10 }}>
      <Svg width={width} height={h}>
        <Defs>
          <SvgGradient id="stageGlow" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={PICK} stopOpacity="0.38" />
            <Stop offset="1" stopColor={PICK} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        <Path d={`M ${width * 0.08} 8 Q ${width / 2} 34 ${width * 0.92} 8 L ${width * 0.92} ${h} L ${width * 0.08} ${h} Z`} fill="url(#stageGlow)" />
        <Path d={`M ${width * 0.08} 8 Q ${width / 2} 34 ${width * 0.92} 8`} stroke={PICK} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      </Svg>
      <Text style={st.stageTxt}>STAGE THIS WAY</Text>
    </Animated.View>
  );
}

function CamBtn({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={({ pressed }) => [st.cam, { transform: [{ scale: pressed ? 0.9 : 1 }] }]}
    >
      {children}
    </Pressable>
  );
}

const st = StyleSheet.create({
  zoneTxt: { fontSize: 10.5, fontWeight: "800", letterSpacing: 1.6 },
  rowTxt: { fontSize: 9.5, fontWeight: "700", textAlign: "center" },
  stageTxt: { marginTop: -16, fontSize: 9.5, fontWeight: "800", letterSpacing: 3, color: "rgba(255,255,255,0.55)" },
  controls: { position: "absolute", right: 10, bottom: 10, gap: 8 },
  cam: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16,17,24,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
});
