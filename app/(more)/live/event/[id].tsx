import React, { useState } from "react";
import { View, Pressable, Linking, StyleSheet, Dimensions } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Radio, Share2, CalendarClock, Clock, Tv } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { Txt, Skeleton, EmptyState } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { ShareSheet } from "@/components/ShareSheet";
import { liveApi } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { airState, countdownText } from "@/lib/live";
import { formatEventDate } from "@/lib/format";
import { AirChip, clock, startOf, endOf, useTick, RED, MUTED, SURFACE, HAIR } from "@/components/live/LiveBits";

const W = Dimensions.get("window").width;

const minutesSince = (iso?: string | null) => {
  if (!iso) return null;
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(m) || m < 0) return null;
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};

/** One broadcast (`/live/events/{id}`): what it is, when it airs, where to watch. */
export default function LiveEventScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useAsync(() => liveApi.event(String(id)), [id]);
  const [share, setShare] = useState(false);
  useTick(1000);

  const ev = q.data;
  const err = q.error;
  const st = ev ? airState(startOf(ev), endOf(ev)) : null;
  const url = ev?.public_url && /^https?:/i.test(ev.public_url) ? ev.public_url : null;

  const cta =
    st === "live" ? "Watch live" : st === "upcoming" ? "Open stream page" : "Watch the replay";

  return (
    <SubScreen
      eyebrow="Live stream"
      title={ev?.title || (q.loading ? "Loading…" : "Live event")}
      refreshing={q.refreshing}
      onRefresh={q.refresh}
      right={
        ev ? (
          <Pressable onPress={() => setShare(true)} hitSlop={8} accessibilityLabel="Share stream" style={s.headBtn}>
            <Share2 size={17} color="#fff" />
          </Pressable>
        ) : null
      }
      overlay={
        ev ? (
          <ShareSheet
            visible={share}
            onClose={() => setShare(false)}
            title="Share this stream"
            subtitle={ev.title}
            message={`${ev.title} is ${st === "live" ? "live now" : st === "upcoming" ? "coming up" : "on"} on Upgrade Talents India.`}
            url={url || undefined}
            card={{ image: ev.image_url, title: ev.title, meta: startOf(ev) ? formatEventDate(startOf(ev)!) : null }}
          />
        ) : null
      }
    >
      {q.loading ? (
        <View style={{ gap: 12 }}>
          <Skeleton h={W * 0.56} radius={22} />
          <Skeleton h={120} radius={18} />
        </View>
      ) : !ev ? (
        <EmptyState
          icon={<Tv size={26} color={MUTED} />}
          title="This stream isn't available"
          subtitle={err || "It may have been unpublished or hidden."}
        />
      ) : (
        <View style={{ gap: 16 }}>
          {/* artwork */}
          <View style={s.hero}>
            <AppImage uri={ev.image_url} seed={ev._id} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={["rgba(11,11,14,0)", "rgba(11,11,14,0.7)"]} style={StyleSheet.absoluteFill} />
            <View style={{ position: "absolute", left: 14, top: 14 }}>
              <AirChip ev={ev} />
            </View>
          </View>

          {/* the one thing to do */}
          {url ? (
            <Pressable
              onPress={() => Linking.openURL(url).catch(() => {})}
              style={({ pressed }) => [s.cta, st !== "live" && s.ctaQuiet, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Radio size={18} color="#fff" />
              <Txt size={15} font="sansBold" style={{ color: "#fff" }}>{cta}</Txt>
            </Pressable>
          ) : (
            <View style={s.note}>
              <Txt size={12.5} lh={18} style={{ color: MUTED }}>The watch link appears here as soon as it's published.</Txt>
            </View>
          )}

          {/* when */}
          <View style={s.card}>
            {st === "upcoming" ? (
              <Big label="Starts in" value={countdownText(startOf(ev)) || "soon"} color={RED} />
            ) : st === "live" && minutesSince(startOf(ev)) ? (
              <Big label="On air for" value={minutesSince(startOf(ev))!} color={RED} />
            ) : (
              <Big label="Status" value="Ended" color={MUTED} />
            )}
            <View style={s.rule} />
            <Row icon={<CalendarClock size={16} color={MUTED} />} label="Starts" value={when(startOf(ev))} />
            {endOf(ev) ? <Row icon={<Clock size={16} color={MUTED} />} label="Ends" value={when(endOf(ev))} /> : null}
          </View>

          {ev.description ? (
            <View>
              <Txt size={11} font="sansBold" tracking={1.6} style={{ color: MUTED, marginBottom: 8 }}>ABOUT</Txt>
              <Txt size={14} lh={21} style={{ color: "#E2E8F0" }}>{ev.description}</Txt>
            </View>
          ) : null}
        </View>
      )}
    </SubScreen>
  );
}

const when = (iso?: string | null) => (iso ? [formatEventDate(iso), clock(iso)].filter(Boolean).join(" · ") : "—");

function Big({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View>
      <Txt size={11} font="sansBold" tracking={1.6} style={{ color: MUTED }}>{label.toUpperCase()}</Txt>
      <Txt size={26} font="display" style={{ color, marginTop: 4, fontVariant: ["tabular-nums"] }}>{value}</Txt>
    </View>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {icon}
      <Txt size={13} style={{ color: MUTED, width: 56 }}>{label}</Txt>
      <Txt size={13.5} font="sansSemi" style={{ color: "#fff", flex: 1 }}>{value}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  headBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(20,22,30,0.9)",
  },
  hero: { height: W * 0.56, borderRadius: 22, overflow: "hidden", backgroundColor: "#1A1C24" },
  cta: { height: 52, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: RED },
  ctaQuiet: { backgroundColor: "rgba(255,255,255,0.1)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  note: { padding: 14, borderRadius: 14, backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
  card: { padding: 16, gap: 12, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
  rule: { height: 1, backgroundColor: HAIR },
});
