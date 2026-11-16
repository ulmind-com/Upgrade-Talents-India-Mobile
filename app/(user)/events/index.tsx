import React, { useMemo, useState } from "react";
import { View, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Search, CalendarX } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi } from "@/lib/api";
import { isPastEvent } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { PageHeader, EventCard } from "@/components/domain";
import { Chip, Skeleton, EmptyState, ErrorState, Txt } from "@/components/ui";
import { FadeInUp } from "@/components/FadeInUp";
import { StageBand, type GalleryItem } from "@/components/StageBand";
import { DiagonalStripes, TextTicker } from "@/components/patterns";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Past" },
];

export default function Events() {
  const { c } = useTheme();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, loading, error, refreshing, refresh, reload } = useAsync(() => publicApi.upcomingEvents({ limit: 50 }), []);

  const rows = useMemo(() => {
    let list = data || [];

    // "Past" means the date has gone by, whatever the stored status says.
    if (filter === "completed") list = list.filter((e) => isPastEvent(e));
    else if (filter === "upcoming") list = list.filter((e) => !isPastEvent(e) && e.event_status !== "live");
    else if (filter !== "all") list = list.filter((e) => (e.event_status || "upcoming") === filter);

    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((e) => e.title?.toLowerCase().includes(s) || e.venue?.toLowerCase().includes(s));
    }

    // Live first, then what is still to come, with finished events last.
    const rank = (e: any) => (e.event_status === "live" ? 0 : isPastEvent(e) ? 2 : 1);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [data, filter, q]);

  const galleryItems: GalleryItem[] = (data || []).slice(0, 8).map((e) => ({ uri: e.image_url, label: e.title }));
  const GEN = ["Live on stage", "The crowd", "Backstage", "Centre spotlight"];
  while (galleryItems.length < 3) galleryItems.push({ uri: null, label: GEN[galleryItems.length % GEN.length] });

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader eyebrow="Book your stage" title="Events" subtitle="Tickets to India's most electric dance events." />

      {/* Energetic ticker strip */}
      <View style={{ marginHorizontal: -20, marginBottom: 18, backgroundColor: c.accent, overflow: "hidden", transform: [{ rotate: "-1.5deg" }, { scale: 1.04 }] }}>
        <DiagonalStripes color="rgba(0,0,0,0.12)" opacity={1} />
        <TextTicker text="LIVE EVENTS   •   BOOK YOUR STAGE   •   LIMITED SEATS   •" color={c.onAccent} size={18} font="street" style={{ paddingVertical: 11 }} />
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.bgElevated, borderRadius: 16, borderWidth: 1, borderColor: c.borderStrong, paddingHorizontal: 14, height: 50, marginBottom: 14 }}>
        <Search size={18} color={c.fgSubtle} />
        <TextInput value={q} onChangeText={setQ} placeholder="Search events or venues" placeholderTextColor={c.fgSubtle} style={{ flex: 1, color: c.fg, fontSize: 15 }} />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
        {FILTERS.map((f) => (
          <Chip key={f.key} label={f.label} active={filter === f.key} onPress={() => setFilter(f.key)} />
        ))}
      </View>

      {loading ? (
        <View style={{ gap: 14 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={260} radius={24} />)}</View>
      ) : error && !rows.length ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length ? (
        <View style={{ gap: 14 }}>
          {rows.map((ev, i) => (
            <FadeInUp key={ev._id} delay={Math.min(i, 8) * 55}>
              <EventCard ev={ev} index={i} onPress={() => router.push(`/(user)/events/${ev._id}`)} />
            </FadeInUp>
          ))}
        </View>
      ) : (
        <EmptyState icon={<CalendarX size={28} color={c.fgMuted} />} title="No events found" subtitle="Try a different search or filter." />
      )}

      {/* Signature gallery band */}
      {!loading && (data?.length || 0) > 0 ? (
        <View style={{ marginHorizontal: -20, marginTop: 30 }}>
          <StageBand items={galleryItems} onExplore={() => router.push("/(more)/gallery")} />
        </View>
      ) : null}
    </Screen>
  );
}
