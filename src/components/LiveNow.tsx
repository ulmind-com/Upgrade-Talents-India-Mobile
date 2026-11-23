import React, { useEffect, useReducer, useRef } from "react";
import { View, Pressable, ScrollView, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Play, Radio, Clock } from "lucide-react-native";
import { Txt, Glow } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { Scanlines, WaveBand } from "@/components/patterns";
import { airState, countdownText, startsInText, type AirState } from "@/lib/live";
import { formatDateTime } from "@/lib/format";
import type { LiveEventItem } from "@/lib/api";

// Live is always red — never theme-tinted (blue theme's streetRed is blue).
const RED = "#ff2d46";
const BAND_TOP = "#2a070e";
const WAVE = 28;   // height of the wavy top edge

function useLoop(duration: number, delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return v;
}

function Equalizer({ color }: { color: string }) {
  const bars = [useLoop(360), useLoop(520, 90), useLoop(300, 50), useLoop(440, 140)];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2.5, height: 15 }}>
      {bars.map((b, i) => (
        <Animated.View key={i} style={{ width: 3, height: 15, borderRadius: 2, backgroundColor: color, transform: [{ scaleY: b.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }] }} />
      ))}
    </View>
  );
}

function PlayPulse({ color }: { color: string }) {
  const p = useLoop(1300);
  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={{ position: "absolute", width: 56, height: 56, borderRadius: 999, borderWidth: 2, borderColor: "#fff", transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }], opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }) }} />
      <View style={{ width: 54, height: 54, borderRadius: 999, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: color, shadowOpacity: 0.6, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8 }}>
        <Play size={22} color={color} fill={color} style={{ marginLeft: 3 }} />
      </View>
    </View>
  );
}

function LiveCard({ ev, onPress, red, state }: { ev: LiveEventItem; onPress: () => void; red: string; state: AirState }) {
  const border = useLoop(850);
  const live = state === "live";
  /* Only a running countdown needs a per-second re-render. */
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    if (live) return;
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [live]);
  const soon = live ? null : countdownText(ev.start_time);
  // not on air yet → quiet neutral, no warning colour
  const SOFT = "rgba(255,255,255,0.78)";
  const tone = live ? red : SOFT;

  return (
    <Pressable onPress={onPress}>
      <View style={{ width: 272, height: 192, borderRadius: 22, overflow: "hidden", backgroundColor: "#000", shadowColor: live ? red : "#000", shadowOpacity: live ? 0.55 : 0.4, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 12 }}>
        <AppImage uri={ev.image_url} seed={ev._id} style={{ width: "100%", height: "100%" }} />
        <LinearGradient colors={["rgba(0,0,0,0.35)", "transparent", "rgba(0,0,0,0.85)"] as any} locations={[0, 0.4, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />

        {/* The border only pulses while it is actually on air. */}
        {live ? (
          <Animated.View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, borderWidth: 2, borderColor: red, opacity: border.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }} />
        ) : (
          <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 22, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" }} />
        )}

        {/* status pill — LIVE, or the clock until it starts */}
        <View style={{ position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {live ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: red, borderRadius: 999, paddingHorizontal: 9, height: 24 }}>
              <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: "#fff" }} />
              <Txt size={10.5} font="sansBold" style={{ color: "#fff", letterSpacing: 1 }}>LIVE</Txt>
            </View>
          ) : soon ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.55)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", borderRadius: 999, paddingHorizontal: 9, height: 24 }}>
              <Clock size={11} color="#fff" />
              <Txt size={10.5} font="sansBold" style={{ color: "#fff", letterSpacing: 0.4, fontVariant: ["tabular-nums"] }}>{soon}</Txt>
            </View>
          ) : <View />}
          {live ? (
            <View style={{ backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999, paddingHorizontal: 9, height: 24, justifyContent: "center" }}>
              <Equalizer color={red} />
            </View>
          ) : null}
        </View>

        {/* play button — only when there is something to play */}
        {live ? (
          <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 24, alignItems: "center", justifyContent: "center" }}>
            <PlayPulse color={red} />
          </View>
        ) : null}

        {/* title */}
        <View style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
          <Txt size={15.5} font="heroSemi" numberOfLines={1} style={{ color: "#fff" }}>{ev.title}</Txt>
          <Txt size={11} font="sansBold" style={{ color: tone, letterSpacing: 1, marginTop: 2 }} uppercase numberOfLines={1}>
            {live
              ? ev.public_url ? "Tap to watch" : "On air now"
              : startsInText(ev.start_time) || formatDateTime(ev.start_time)}
          </Txt>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * OP "Live now" broadcast strip.
 *
 * `onOpen` receives the row so the caller can follow its own `public_url`;
 * nothing here assumes where a stream lives.
 */
export function LiveNow({ events, onOpen }: { events: LiveEventItem[]; onOpen: (ev: LiveEventItem) => void }) {
  const dot = useLoop(700);

  /* Anything already finished is dropped, and a stream that has not started
     shows its countdown rather than pretending to be on air. */
  const rows = events
    .map((ev) => ({ ev, state: airState(ev.start_time, ev.end_time) }))
    .filter((r) => r.state !== "ended");
  const onAir = rows.filter((r) => r.state === "live");
  if (!rows.length) return null;
  const anyLive = onAir.length > 0;

  /* No band, no scanlines, no watermark: live content is urgent on its own,
     and the home page now speaks one visual language. The only loud thing
     left is the pulsing red dot, which is the part that actually means
     something. */
  return (
    <View style={{ marginTop: 32 }}>
      <View style={{ paddingHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 14 }}>
        <Animated.View
          style={{
            width: 9,
            height: 9,
            borderRadius: 999,
            backgroundColor: anyLive ? RED : "rgba(255,255,255,0.7)",
            opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
          }}
        />
        <Txt size={20} font="sansBold" tracking={-0.3} style={{ color: "#fff" }}>
          {anyLive ? "Live now" : "Going live soon"}
        </Txt>
        {anyLive ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: RED, borderRadius: 999, paddingHorizontal: 9, height: 22 }}>
            <Radio size={10} color="#fff" />
            <Txt size={10} font="sansBold" style={{ color: "#fff", letterSpacing: 0.8 }}>{onAir.length} ON AIR</Txt>
          </View>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}>
        {rows.map(({ ev, state }) => <LiveCard key={ev._id} ev={ev} red={RED} state={state} onPress={() => onOpen(ev)} />)}
      </ScrollView>
    </View>
  );
}
