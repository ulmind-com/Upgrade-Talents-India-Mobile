import React, { useEffect, useRef, useState } from "react";
import { View, Pressable, Animated, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MapPin, Ticket } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt, Badge } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { formatINR, splitDate } from "@/lib/format";
import type { EventItem } from "@/lib/api";

const W = Dimensions.get("window").width;
const CW = Math.min(W * 0.64, 280);
const CH = CW * 1.32;

/* Glassy 3D coverflow — centre card flat & crisp, neighbours recede in
   perspective (rotateY + scale + dim). Auto-advances; tap a side card to
   bring it forward, tap the centre to open. */
export function Coverflow({ events, onOpen }: { events: EventItem[]; onOpen: (id: string) => void }) {
  const { c } = useTheme();
  const n = events.length;
  const [active, setActive] = useState(0);
  const pos = useRef(new Animated.Value(0)).current;
  const paused = useRef(false);

  useEffect(() => {
    Animated.spring(pos, { toValue: active, useNativeDriver: true, speed: 12, bounciness: 6 }).start();
  }, [active]);

  useEffect(() => {
    if (n < 2) return;
    const id = setInterval(() => { if (!paused.current) setActive((a) => (a + 1) % n); }, 3600);
    return () => clearInterval(id);
  }, [n]);

  const go = (i: number, ev: EventItem) => {
    paused.current = true;
    if (i === active) onOpen(ev._id);
    else setActive(i);
    setTimeout(() => (paused.current = false), 6000);
  };

  return (
    <View>
      <View style={{ height: CH + 24, justifyContent: "center" }}>
        {events.map((ev, i) => {
          const ir = [i - 3, i - 2, i - 1, i, i + 1, i + 2, i + 3];
          const tx = pos.interpolate({ inputRange: ir, outputRange: [-1.5 * CW, -CW, -0.52 * CW, 0, 0.52 * CW, CW, 1.5 * CW], extrapolate: "clamp" });
          const ry = pos.interpolate({ inputRange: ir, outputRange: ["48deg", "42deg", "34deg", "0deg", "-34deg", "-42deg", "-48deg"], extrapolate: "clamp" });
          const sc = pos.interpolate({ inputRange: [i - 1, i, i + 1], outputRange: [0.82, 1, 0.82], extrapolate: "clamp" });
          const op = pos.interpolate({ inputRange: ir, outputRange: [0, 0.32, 0.72, 1, 0.72, 0.32, 0], extrapolate: "clamp" });
          const d = splitDate(ev.date);
          const z = Math.round(100 - Math.abs(i - active));
          return (
            <Animated.View
              key={ev._id || i}
              style={{ position: "absolute", left: (W - 40 - CW) / 2, width: CW, height: CH, zIndex: z, opacity: op, transform: [{ perspective: 1200 }, { translateX: tx }, { rotateY: ry }, { scale: sc }] }}
            >
              <Pressable onPress={() => go(i, ev)} style={{ flex: 1 }}>
                <View style={{ flex: 1, borderRadius: 26, overflow: "hidden", borderWidth: 1, borderColor: c.borderStrong, backgroundColor: c.surface2, shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 14 }}>
                  <AppImage uri={ev.image_url} seed={ev._id || i} style={{ width: "100%", height: "100%" }} />
                  <LinearGradient colors={["rgba(4,5,12,0.1)", "transparent", "rgba(4,5,12,0.92)"] as any} locations={[0, 0.4, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />
                  <View style={{ position: "absolute", top: 12, left: 12, flexDirection: "row", gap: 6 }}>
                    {ev.event_status === "live" ? <Badge label="Live" tone="live" /> : <Badge label={`${d.day} ${d.month}`} tone="brand" />}
                  </View>
                  <View style={{ position: "absolute", bottom: 14, left: 14, right: 14 }}>
                    <Txt size={18} font="heroSemi" lh={22} numberOfLines={2} style={{ color: "#fff" }}>{ev.title}</Txt>
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                      {ev.venue ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: 1 }}>
                          <MapPin size={12} color="rgba(255,255,255,0.8)" />
                          <Txt size={11.5} style={{ color: "rgba(255,255,255,0.8)" }} numberOfLines={1}>{ev.venue}</Txt>
                        </View>
                      ) : <View style={{ flex: 1 }} />}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#FF385C", borderRadius: 999, paddingHorizontal: 12, height: 30 }}>
                        <Ticket size={13} color="#ffffff" />
                        <Txt size={12} font="sansBold" style={{ color: "#ffffff" }}>{formatINR(ev.price)}</Txt>
                      </View>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {n > 1 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 16 }}>
          {events.map((_, i) => (
            <Pressable key={i} onPress={() => go(i, events[i])} hitSlop={6}>
              <View style={{ width: i === active ? 20 : 7, height: 7, borderRadius: 999, backgroundColor: i === active ? c.accent : c.border }} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
