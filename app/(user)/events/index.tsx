import React, { useMemo, useState } from "react";
import { View, TextInput, ScrollView, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Search, CalendarX, ChevronRight, Sparkles, MapPin } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi } from "@/lib/api";
import { isPastEvent } from "@/lib/format";
import { useAsync } from "@/lib/useAsync";
import { EventCard } from "@/components/domain";
import { Skeleton, EmptyState, ErrorState, Txt } from "@/components/ui";
import { FadeInUp } from "@/components/FadeInUp";

const FILTERS = [
  { key: "all", label: "All Events" },
  { key: "live", label: "Live Now" },
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Past" },
];

export default function Events() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const { data, loading, error, refreshing, refresh, reload } = useAsync(
    () => publicApi.upcomingEvents({ limit: 50 }),
    []
  );

  const rows = useMemo(() => {
    let list = data || [];

    if (filter === "completed") list = list.filter((e) => isPastEvent(e));
    else if (filter === "upcoming") list = list.filter((e) => !isPastEvent(e) && e.event_status !== "live");
    else if (filter !== "all") list = list.filter((e) => (e.event_status || "upcoming") === filter);

    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((e) => e.title?.toLowerCase().includes(s) || e.venue?.toLowerCase().includes(s));
    }

    const rank = (e: any) => (e.event_status === "live" ? 0 : isPastEvent(e) ? 2 : 1);
    return [...list].sort((a, b) => rank(a) - rank(b));
  }, [data, filter, q]);

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {/* District Header */}
      <View style={{ paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Txt size={22} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.4 }}>
            Upcoming events
          </Txt>
          <ChevronRight size={18} color="#ffffff" strokeWidth={2.4} />
        </View>
        <Txt size={13} style={{ color: "#9ea3b8" }}>
          Book stages, live shows & exclusive entry passes
        </Txt>
      </View>

      {/* District Search Bar */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          backgroundColor: "#14161E",
          borderRadius: 14,
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.1)",
          paddingHorizontal: 14,
          height: 48,
          marginBottom: 16,
        }}
      >
        <Search size={18} color="#6b728a" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search events, venues, choreographers…"
          placeholderTextColor="#6b728a"
          style={{ flex: 1, color: "#ffffff", fontSize: 14.5 }}
        />
      </View>

      {/* Horizontal Category / Status Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
        style={{ marginBottom: 18 }}
      >
        {FILTERS.map((f) => {
          const on = filter === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setFilter(f.key);
              }}
              style={{
                paddingHorizontal: 16,
                height: 36,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: on ? "#FF385C" : "#14161E",
                borderWidth: 1,
                borderColor: on ? "#FF385C" : "rgba(255, 255, 255, 0.1)",
              }}
            >
              <Txt size={12.5} font="sansBold" style={{ color: on ? "#ffffff" : "#9ea3b8" }}>
                {f.label}
              </Txt>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Event Cards Grid / List */}
      {loading ? (
        <View style={{ gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={260} radius={22} />
          ))}
        </View>
      ) : error && !rows.length ? (
        <ErrorState message={error} onRetry={reload} />
      ) : rows.length ? (
        <View style={{ gap: 16 }}>
          {rows.map((ev, i) => (
            <FadeInUp key={ev._id} delay={Math.min(i, 6) * 50}>
              <EventCard ev={ev} index={i} onPress={() => router.push(`/(user)/events/${ev._id}`)} />
            </FadeInUp>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<CalendarX size={28} color="#6b728a" />}
          title="No events found"
          subtitle="Try a different search term or filter."
        />
      )}
    </Screen>
  );
}
