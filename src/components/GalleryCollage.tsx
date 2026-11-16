import React, { useEffect, useRef } from "react";
import { View, Pressable, Animated, Easing, Dimensions } from "react-native";
import { useRouter } from "expo-router";
import { Sparkles, ArrowUpRight } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Button, SectionLabel, Glow } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import type { EventItem } from "@/lib/api";

const BOX_W = Dimensions.get("window").width - 40;
const BOX_H = BOX_W * 1.14;

type Slot = { t: string; l: string; w: string; rot: number; delay: number; amp: number; dur: number };
const SLOTS: Slot[] = [
  { t: "5%", l: "27%", w: "46%", rot: -4, delay: 0, amp: 7, dur: 3400 },
  { t: "0%", l: "0%", w: "31%", rot: -9, delay: 120, amp: 9, dur: 3900 },
  { t: "43%", l: "3%", w: "34%", rot: 6, delay: 240, amp: 8, dur: 4200 },
  { t: "4%", l: "73%", w: "27%", rot: 9, delay: 180, amp: 6, dur: 3700 },
  { t: "53%", l: "65%", w: "35%", rot: -6, delay: 300, amp: 9, dur: 4400 },
  { t: "68%", l: "33%", w: "34%", rot: 3, delay: 420, amp: 7, dur: 4000 },
];

function FloatCard({ slot, uri, seed, onPress }: { slot: Slot; uri?: string | null; seed: number; onPress: () => void }) {
  const { c } = useTheme();
  const enter = useRef(new Animated.Value(0)).current;
  const floatV = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 650, delay: slot.delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatV, { toValue: 1, duration: slot.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatV, { toValue: 0, duration: slot.dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const w = (parseFloat(slot.w) / 100) * BOX_W;
  const enterY = enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] });
  const floatY = floatV.interpolate({ inputRange: [0, 1], outputRange: [-slot.amp, slot.amp] });

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: slot.t as any,
        left: slot.l as any,
        width: w,
        opacity: enter,
        transform: [{ translateY: Animated.add(enterY, floatY) }, { rotate: `${slot.rot}deg` }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] }) }],
      }}
    >
      <Pressable onPress={onPress}>
        <View style={{ width: "100%", aspectRatio: 0.82, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface2, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 20, shadowOffset: { width: 0, height: 16 }, elevation: 12 }}>
          <AppImage uri={uri} seed={seed} style={{ width: "100%", height: "100%" }} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/** "A stage worth watching" — scattered collage that reveals + floats. */
export function GalleryCollage({ events, showCta = true }: { events: EventItem[]; showCta?: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  const imgs: (string | undefined)[] = events.map((e) => e.image_url);
  while (imgs.length < SLOTS.length) imgs.push(undefined);

  return (
    <View style={{ marginTop: 30, overflow: "hidden" }}>
      <Glow color={c.spot2} size={360} top={40} left={BOX_W / 2 - 160} />
      <View style={{ paddingHorizontal: 20 }}>
        <SectionLabel>In motion</SectionLabel>
        <Txt size={28} font="display" lh={30} tracking={-0.5} style={{ marginTop: 10 }}>A stage worth{"\n"}watching</Txt>
        <Txt size={14} tone="muted" lh={21} style={{ marginTop: 10, maxWidth: 320 }}>
          Every performance, workshop and showdown — captured and brought to life.
        </Txt>
        {showCta ? (
          <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
            <Button label="Explore gallery" onPress={() => router.push("/(more)/gallery")} icon={<Sparkles size={16} color={c.onAccent} />} />
            <Button label="Events" variant="ghost" onPress={() => router.push("/(user)/events")} iconRight={<ArrowUpRight size={16} color={c.fgMuted} />} />
          </View>
        ) : null}
      </View>

      <View style={{ width: BOX_W, height: BOX_H, alignSelf: "center", marginTop: 20 }}>
        {SLOTS.map((s, i) => (
          <FloatCard key={i} slot={s} uri={imgs[i]} seed={i * 5 + 2} onPress={() => router.push("/(user)/events")} />
        ))}
      </View>
    </View>
  );
}
