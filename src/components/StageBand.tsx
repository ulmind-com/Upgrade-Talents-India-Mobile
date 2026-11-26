import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Dimensions, Animated } from "react-native";
import Svg, { Path } from "react-native-svg";
import { ArrowRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { AppImage } from "@/components/AppImage";

const { width: W } = Dimensions.get("window");

export type GalleryItem = { uri?: string | null; label: string };

/* Wavy (scalloped) top edge — the band colour fills below the wave, the crests
   are transparent so the page shows through, exactly like the reference. */
function WaveTop({ color, height = 26 }: { color: string; height?: number }) {
  const n = Math.max(5, Math.round(W / 56));
  const bw = W / n;
  let d = `M0 ${height}`;
  let up = true;
  for (let x = 0; x < W; x += bw) {
    const cx = x + bw / 2;
    const ex = x + bw;
    const cy = up ? -2 : height + 2;
    d += ` Q ${cx} ${cy} ${ex} ${height / 2}`;
    up = !up;
  }
  d += ` L ${W} ${height} L 0 ${height} Z`;
  return (
    <Svg width={W} height={height} style={{ marginBottom: -1 }}>
      <Path d={d} fill={color} />
    </Svg>
  );
}

/* Auto-shuffling stacked polaroid gallery. */
const CARD_W = Math.min(W * 0.58, 228);
const CARD_H = CARD_W * 1.18;
const SLOTS = [
  { x: -CARD_W * 0.2, y: 0, s: 1, r: -4, z: 3, o: 1 },
  { x: CARD_W * 0.28, y: 42, s: 0.9, r: 5, z: 2, o: 1 },
  { x: -CARD_W * 0.02, y: 22, s: 0.82, r: -9, z: 1, o: 0.6 },
];

function StageGallery({ items }: { items: GalleryItem[] }) {
  const { c } = useTheme();
  const n = items.length;
  const visible = Math.min(n, 3);
  const [top, setTop] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const animating = useRef(false);

  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => {
      if (animating.current) return;
      animating.current = true;
      Animated.timing(progress, { toValue: 1, duration: 620, useNativeDriver: true }).start(() => {
        setTop((t) => (t + 1) % n);
        progress.setValue(0);
        animating.current = false;
      });
    }, 3000);
    return () => clearInterval(id);
  }, [n]);

  return (
    <View style={{ height: CARD_H + 86, alignItems: "center", justifyContent: "center" }}>
      {Array.from({ length: visible }).map((_, p) => {
        const item = items[(top + p) % n];
        const from = SLOTS[p];
        const to = SLOTS[(p + 2) % 3];
        const i = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
        const tx = i.interpolate({ inputRange: [0, 1], outputRange: [from.x, to.x] });
        const ty = i.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] });
        const sc = i.interpolate({ inputRange: [0, 1], outputRange: [from.s, to.s] });
        const ro = i.interpolate({ inputRange: [0, 1], outputRange: [`${from.r}deg`, `${to.r}deg`] });
        const op = i.interpolate({ inputRange: [0, 1], outputRange: [from.o, to.o] });
        return (
          <Animated.View
            key={p}
            style={{
              position: "absolute",
              zIndex: from.z,
              opacity: op,
              transform: [{ translateX: tx }, { translateY: ty }, { scale: sc }, { rotate: ro }],
            }}
          >
            <View style={{ width: CARD_W, backgroundColor: "#14161E", borderRadius: 20, padding: 8, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 10 }}>
              <View style={{ height: CARD_H, borderRadius: 14, overflow: "hidden" }}>
                <AppImage uri={item.uri} seed={(top + p) * 7 + 1} style={{ width: "100%", height: "100%" }} />
              </View>
              <Txt size={15} font="sansExt" style={{ color: "#ffffff", marginTop: 8, marginBottom: 2, marginLeft: 2 }} numberOfLines={1}>{item.label}</Txt>
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** Full-bleed signature band: wavy top, faint wordmark, headline, auto gallery. */
export function StageBand({ items, onExplore, bottomBleed = 0 }: {
  items: GalleryItem[];
  onExplore: () => void;
  /** Extra band height for a following section to carve its wave into. */
  bottomBleed?: number;
}) {
  const { c } = useTheme();
  const band = c.theaterBg;
  if (!items.length) return null;

  return (
    <View style={{ marginTop: 10 }}>
      <WaveTop color={band} />
      <View style={{ backgroundColor: band, paddingTop: 10, paddingBottom: 34 + bottomBleed, overflow: "hidden" }}>
        {/* faint background wordmark */}
        <Txt size={96} font="display" style={{ position: "absolute", top: 20, left: -10, color: "rgba(255,255,255,0.045)", letterSpacing: -4 }} numberOfLines={1}>ON STAGE</Txt>

        <View style={{ paddingHorizontal: 20, marginTop: 6 }}>
          <Txt size={13} font="monoMed" tracking={3} uppercase style={{ color: c.theaterPink }}>Relive the nights</Txt>
          <Txt size={32} font="display" lh={34} tracking={-0.5} style={{ color: "#fff", marginTop: 8 }}>
            Moments that{"\n"}
            <Txt size={32} font="serifItalic" tone="accent" style={{ color: c.accent }}>stay with you</Txt>
          </Txt>
        </View>

        <StageGallery items={items} />

        <View style={{ paddingHorizontal: 20, marginTop: 6 }}>
          <Pressable
            onPress={onExplore}
            style={({ pressed }) => ({
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "rgba(255, 255, 255, 0.08)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.16)",
              borderRadius: 999,
              paddingHorizontal: 16,
              height: 38,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            })}
          >
            <Txt size={13} font="sansSemi" style={{ color: "#ffffff" }}>Open gallery</Txt>
            <ArrowRight size={14} color={c.accent} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
