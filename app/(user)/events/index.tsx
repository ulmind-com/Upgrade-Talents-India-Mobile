import React, { useCallback, useMemo, useState } from "react";
import { View, TextInput, ScrollView, Pressable, Dimensions } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { noteEventsListSeen } from "@/lib/tabOrigin";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Search, CalendarX, MapPin, Users, Clock } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi } from "@/lib/api";
import { isPastEvent, formatEventDate, formatINR, splitDate } from "@/lib/format";
import { startsInText } from "@/lib/live";
import { useAsync } from "@/lib/useAsync";
import { Skeleton, EmptyState, ErrorState, Txt, Dot } from "@/components/ui";
import { AppImage, PosterFill, RatioImage } from "@/components/AppImage";
import { DateChip } from "@/components/InfoRows";
import { FadeInUp } from "@/components/FadeInUp";
import { PromoHeroBanner } from "@/components/PromoHeroBanner";

const { width: SCREEN_W } = Dimensions.get("window");
const CUR_W = Math.min(300, SCREEN_W * 0.82);

const FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Going on" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Past" },
];

/* ─────────── Free / Paid badge ─────────── */
function PriceTag({ price, dark }: { price?: number | null; dark?: boolean }) {
  const free = !price;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4, backgroundColor: free ? "rgba(34,197,94,0.92)" : "rgba(255,56,92,0.92)" }}>
      <Txt size={10.5} font="sansExt" style={{ color: "#fff" }}>{free ? "Free" : `₹${price}`}</Txt>
    </View>
  );
}

/* ─────────── status pill — Going on (live) / In 25 min (upcoming) ─────────── */
function StatusPill({ ev }: { ev: any }) {
  const { c } = useTheme();
  const live = ev.event_status === "live";
  const soon = !live && startsInText(ev.date);
  if (live) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, paddingHorizontal: 10, height: 24, backgroundColor: c.danger + "1f", borderWidth: 1, borderColor: c.danger + "55" }}>
        <Dot color={c.danger} pulse size={6} />
        <Txt size={10.5} font="sansExt" tracking={0.3} style={{ color: "#ff6a84" }}>Going on</Txt>
      </View>
    );
  }
  if (soon) {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, paddingHorizontal: 10, height: 24, backgroundColor: c.surface2, borderWidth: 1, borderColor: c.border }}>
        <Clock size={11} color={c.accent} />
        <Txt size={10.5} font="sansBold" tone="muted">{soon}</Txt>
      </View>
    );
  }
  return null;
}

function MetaLine({ ev }: { ev: any }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      <StatusPill ev={ev} />
      <Txt size={12} tone="muted" numberOfLines={1} style={{ flex: 1 }}>
        {ev.time ? `${ev.time}` : ""}{ev.time && ev.venue ? "  ·  " : ""}{ev.venue || ""}
      </Txt>
    </View>
  );
}

/* ─────────── Current event — horizontal card ─────────── */
function CurrentCard({ ev, onPress }: { ev: any; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ width: CUR_W, transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ borderRadius: 22, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border }}>
        {/* the whole poster at its own proportions — the card grows to fit it */}
        <RatioImage uri={ev.image_url} seed={ev._id}>
          <LinearGradient colors={["rgba(0,0,0,0.2)", "transparent", "rgba(0,0,0,0.5)"] as any} style={{ position: "absolute", width: "100%", height: "100%" }} pointerEvents="none" />
          <View style={{ position: "absolute", top: 10, right: 10 }}><PriceTag price={ev.price} /></View>
        </RatioImage>
        <View style={{ padding: 14, gap: 9 }}>
          <MetaLine ev={ev} />
          <Txt size={16} font="sansBold" lh={21} numberOfLines={2}>{ev.title}</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View style={{ width: 20, height: 20, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.accent + "22" }}>
              <MapPin size={11} color={c.accent} />
            </View>
            <Txt size={12} tone="subtle" numberOfLines={1} style={{ flex: 1 }}>{ev.category || ev.venue || "Upgrade Talents India"}</Txt>
            {typeof ev.registered_count === "number" && ev.registered_count > 0 ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Users size={11} color={c.fgSubtle} />
                <Txt size={11.5} font="sansBold" tone="subtle">{ev.registered_count}</Txt>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/* ─────────── Upcoming event — date-chip + image row ─────────── */
function UpcomingRow({ ev, onPress }: { ev: any; onPress: () => void }) {
  const { c } = useTheme();
  const d = splitDate(ev.date);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      {/* date chip floats on the bg (no card); image + ALL text sit in the right column */}
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <DateChip day={d.day} month={d.month} />
        <View style={{ flex: 1, gap: 9 }}>
          <View style={{ borderRadius: 18, overflow: "hidden", backgroundColor: "#090a10" }}>
            <RatioImage uri={ev.image_url} seed={ev._id}>
              <View style={{ position: "absolute", top: 8, right: 8 }}><PriceTag price={ev.price} /></View>
            </RatioImage>
          </View>
          <MetaLine ev={ev} />
          <Txt size={16} font="sansBold" lh={21} numberOfLines={2}>{ev.title}</Txt>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <View style={{ width: 20, height: 20, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.accent + "22" }}>
              <MapPin size={11} color={c.accent} />
            </View>
            <Txt size={12} tone="subtle" numberOfLines={1}>{ev.category || "Upgrade Talents India"}</Txt>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function SectionHead({ label, count }: { label: string; count?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12, marginTop: 4 }}>
      <Txt size={19} font="display" tracking={-0.4}>{label}</Txt>
      {count ? <Txt size={12.5} font="monoMed" tone="subtle" tracking={1}>{count}</Txt> : null}
    </View>
  );
}

export default function Events() {
  const { c } = useTheme();
  const router = useRouter();
  // the list is actually on screen → an event opened from here should "back" to it
  useFocusEffect(useCallback(() => { noteEventsListSeen(); }, []));
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, loading, error, refreshing, refresh, reload } = useAsync(() => publicApi.upcomingEvents({ limit: 50 }), []);

  const rows = useMemo(() => {
    let list = data || [];
    if (filter === "completed") list = list.filter((e) => isPastEvent(e));
    else if (filter === "upcoming") list = list.filter((e) => !isPastEvent(e) && e.event_status !== "live");
    else if (filter === "live") list = list.filter((e) => e.event_status === "live");
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((e) => e.title?.toLowerCase().includes(s) || e.venue?.toLowerCase().includes(s) || (e as any).category?.toLowerCase().includes(s));
    }
    return list;
  }, [data, filter, q]);

  // "Current" = going on now (live) OR happening today. Everything else ahead is Upcoming.
  const isToday = (iso?: string | null) => {
    if (!iso) return false;
    const x = new Date(iso);
    return !Number.isNaN(x.getTime()) && x.toDateString() === new Date().toDateString();
  };
  const isCurrent = (e: any) => e.event_status === "live" || (isToday(e.date) && !isPastEvent(e));
  const live = useMemo(() => rows.filter(isCurrent), [rows]);
  const upcoming = useMemo(() => rows.filter((e) => !isCurrent(e) && !isPastEvent(e)), [rows]);
  const past = useMemo(() => rows.filter((e) => isPastEvent(e) && !isCurrent(e)), [rows]);

  const open = (id: string) => router.push(`/(user)/events/${id}` as any);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {/* Header */}
      <View style={{ paddingTop: 8, paddingBottom: 14 }}>
        <Txt size={26} font="display" tracking={-0.6} style={{ color: "#fff" }}>Events</Txt>
        <Txt size={13} tone="muted" style={{ marginTop: 2 }}>Live shows, stages &amp; exclusive entry passes</Txt>
      </View>

      {/* 3D Character Promo Banner — Zomato District Style */}
      <FadeInUp>
        <PromoHeroBanner
          tag="Live Stage Passes"
          title="Exclusive Shows & Concerts"
          subtitle="Book VIP backstage entry & live stage passes"
          characterSource={require("../../../assets/banners/3d_event_char.png")}
          glowColor="rgba(255, 56, 92, 0.16)"
        />
      </FadeInUp>

      {/* Search */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, height: 50, marginBottom: 14 }}>
        <Search size={18} color={c.fgSubtle} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search events, venues…" placeholderTextColor={c.fgSubtle} autoCapitalize="none" style={{ flex: 1, color: c.fg, fontSize: 14.5 }} />
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginBottom: 18 }}>
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable key={f.key} onPress={() => { Haptics.selectionAsync().catch(() => {}); setFilter(f.key); }}
              style={{ paddingHorizontal: 16, height: 36, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.accent : c.surface, borderWidth: 1, borderColor: on ? c.accent : c.border }}>
              <Txt size={12.5} font="sansBold" style={{ color: on ? c.onAccent : c.fgMuted }}>{f.label}</Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={{ gap: 16 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={240} radius={22} />)}</View>
      ) : error && !rows.length ? (
        <ErrorState message={error} onRetry={reload} />
      ) : !rows.length ? (
        <EmptyState icon={<CalendarX size={28} color={c.fgMuted} />} title="No events found" subtitle="Try a different search term or filter." />
      ) : (
        <View style={{ gap: 6 }}>
          {/* Current events — horizontal */}
          {live.length ? (
            <View style={{ marginBottom: 8 }}>
              <SectionHead label="Current events" count={live.length} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 8, paddingBottom: 4 }} style={{ marginHorizontal: -2 }}>
                {live.map((ev, i) => (
                  <FadeInUp key={ev._id} delay={Math.min(i, 5) * 55}><CurrentCard ev={ev} onPress={() => open(ev._id)} /></FadeInUp>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* Upcoming — vertical date-chip rows */}
          {upcoming.length ? (
            <View style={{ marginBottom: 8 }}>
              <SectionHead label="Upcoming events" count={upcoming.length} />
              <View style={{ gap: 24 }}>
                {upcoming.map((ev, i) => (
                  <FadeInUp key={ev._id} delay={Math.min(i, 6) * 45}><UpcomingRow ev={ev} onPress={() => open(ev._id)} /></FadeInUp>
                ))}
              </View>
            </View>
          ) : null}

          {/* Past */}
          {past.length ? (
            <View>
              <SectionHead label="Past events" count={past.length} />
              <View style={{ gap: 14 }}>
                {past.map((ev, i) => (
                  <FadeInUp key={ev._id} delay={Math.min(i, 6) * 40}>
                    <Pressable onPress={() => open(ev._id)} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 0.72 })}>
                      <View style={{ flexDirection: "row", gap: 12, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, padding: 10 }}>
                        <View style={{ width: 72, height: 72, borderRadius: 14, overflow: "hidden", backgroundColor: c.surface2 }}>
                          <AppImage uri={ev.image_url} seed={ev._id} style={{ width: "100%", height: "100%" }} />
                        </View>
                        <View style={{ flex: 1, justifyContent: "center", gap: 3 }}>
                          <Txt size={14.5} font="sansBold" numberOfLines={2}>{ev.title}</Txt>
                          <Txt size={12} tone="subtle" numberOfLines={1}>{formatEventDate(ev.date)}{ev.venue ? ` · ${ev.venue}` : ""}</Txt>
                        </View>
                      </View>
                    </Pressable>
                  </FadeInUp>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
