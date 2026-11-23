import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, Linking, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Radio, Trophy } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { Txt, Skeleton, EmptyState } from "@/components/ui";
import { liveApi, safe, type LiveBroadcast, type LiveCompetition, type LiveFeed, type LiveSummary } from "@/lib/api";
import { BroadcastCard, LiveCompCard, StatTile, RED, OK, MUTED, SURFACE, HAIR } from "@/components/live/LiveBits";
import { playNavFeedback } from "@/lib/sound";

type Tab = "ALL" | "STREAMS" | "COMPS";
type Status = "ANY" | "VOTING" | "JUDGING";
const PAGE = 20;

/**
 * Live now — everything on air at this moment (`/live/*`): broadcasts and
 * running competitions, with the server's own counts and filters.
 */
export default function LiveHub() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("ALL");
  const [status, setStatus] = useState<Status>("ANY");
  const [category, setCategory] = useState<string | null>(null);

  const [summary, setSummary] = useState<LiveSummary | null>(null);
  const [feed, setFeed] = useState<LiveFeed | null>(null);
  const [streams, setStreams] = useState<{ items: LiveBroadcast[]; total: number } | null>(null);
  const [comps, setComps] = useState<{ items: LiveCompetition[]; total: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const req = useRef(0);

  const filters = useMemo(
    () => ({
      category: category || undefined,
      voting_open: status === "VOTING" ? true : undefined,
      judging_open: status === "JUDGING" ? true : undefined,
    }),
    [category, status]
  );

  /** Pull the current tab's list (page 1) plus the headline counts. */
  const load = useCallback(
    async (quiet = false) => {
      const id = ++req.current;
      if (!quiet) setLoading(true);
      const [sum, data] = await Promise.all([
        safe(liveApi.summary(), null),
        tab === "ALL"
          ? safe(liveApi.feed(), null)
          : tab === "STREAMS"
          ? safe(liveApi.events({ limit: PAGE }), null)
          : safe(liveApi.competitions({ ...filters, limit: PAGE }), null),
      ]);
      if (id !== req.current) return;
      if (sum) setSummary(sum);
      if (tab === "ALL") setFeed(data as LiveFeed | null);
      else if (tab === "STREAMS") setStreams(data ? { items: (data as any).items ?? [], total: (data as any).total ?? 0 } : null);
      else setComps(data ? { items: (data as any).items ?? [], total: (data as any).total ?? 0 } : null);
      setLoading(false);
    },
    [tab, filters]
  );

  useEffect(() => {
    load();
  }, [load]);

  // keep the counts and the list honest while the screen is open
  useEffect(() => {
    const t = setInterval(() => load(true), 30000);
    return () => clearInterval(t);
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  };

  const loadMore = async () => {
    if (more) return;
    setMore(true);
    if (tab === "STREAMS" && streams) {
      const r = await safe(liveApi.events({ skip: streams.items.length, limit: PAGE }), null);
      if (r) setStreams({ items: [...streams.items, ...(r.items ?? [])], total: r.total ?? streams.total });
    } else if (tab === "COMPS" && comps) {
      const r = await safe(liveApi.competitions({ ...filters, skip: comps.items.length, limit: PAGE }), null);
      if (r) setComps({ items: [...comps.items, ...(r.items ?? [])], total: r.total ?? comps.total });
    }
    setMore(false);
  };

  /* Categories come off every running competition, so the chips don't vanish
     when a filter narrows the list. */
  const [allCats, setAllCats] = useState<string[]>([]);
  useEffect(() => {
    const src = feed?.live_competitions ?? comps?.items ?? [];
    const set = new Set(allCats);
    src.forEach((c) => c.category && set.add(String(c.category)));
    if (set.size !== allCats.length) setAllCats(Array.from(set));
  }, [feed, comps]);

  const watch = (ev: LiveBroadcast) => {
    if (ev.public_url && /^https?:/i.test(ev.public_url)) Linking.openURL(ev.public_url).catch(() => {});
  };
  const openEvent = (ev: LiveBroadcast) => router.push(`/(more)/live/event/${ev._id}`);
  const openComp = (c: LiveCompetition) => router.push(`/(more)/live/competition/${c._id}`);

  const pick = (t: Tab) => {
    playNavFeedback();
    setTab(t);
  };

  const events = tab === "ALL" ? feed?.live_events ?? [] : streams?.items ?? [];
  const compList = tab === "ALL" ? feed?.live_competitions ?? [] : comps?.items ?? [];
  const hasMore =
    (tab === "STREAMS" && streams && streams.items.length < streams.total) ||
    (tab === "COMPS" && comps && comps.items.length < comps.total);
  const nothing = !loading && !events.length && !compList.length;

  return (
    <SubScreen eyebrow="Happening now" title="Live" refreshing={refreshing} onRefresh={refresh}>
      {/* headline counts — straight from /live/summary */}
      <View style={s.tiles}>
        <StatTile
          value={summary?.live_events_count ?? "–"}
          label="Streams"
          color={RED}
          active={tab === "STREAMS"}
          onPress={() => pick("STREAMS")}
        />
        <StatTile
          value={summary?.live_competitions_count ?? "–"}
          label="Competitions"
          active={tab === "COMPS" && status === "ANY"}
          onPress={() => {
            setStatus("ANY");
            pick("COMPS");
          }}
        />
        <StatTile
          value={summary?.voting_open_count ?? "–"}
          label="Voting open"
          color={OK}
          active={tab === "COMPS" && status === "VOTING"}
          onPress={() => {
            setStatus("VOTING");
            pick("COMPS");
          }}
        />
      </View>

      {/* tabs */}
      <View style={s.track}>
        {(
          [
            ["ALL", "All"],
            ["STREAMS", "Streams"],
            ["COMPS", "Competitions"],
          ] as [Tab, string][]
        ).map(([k, label]) => {
          const on = tab === k;
          return (
            <Pressable
              key={k}
              onPress={() => pick(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              style={[s.seg, on && s.segOn]}
            >
              <Txt size={13} font="sansBold" style={{ color: on ? "#fff" : MUTED }}>{label}</Txt>
            </Pressable>
          );
        })}
      </View>

      {/* competition filters — the backend's voting_open / judging_open / category */}
      {tab === "COMPS" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips} style={{ marginHorizontal: -20 }}>
          {(
            [
              ["ANY", "Any status"],
              ["VOTING", "Voting open"],
              ["JUDGING", "Judging open"],
            ] as [Status, string][]
          ).map(([k, label]) => (
            <Chip key={k} label={label} on={status === k} onPress={() => setStatus(k)} />
          ))}
          {allCats.length ? <View style={s.chipDivider} /> : null}
          {allCats.map((c) => (
            <Chip key={c} label={c} on={category === c} onPress={() => setCategory(category === c ? null : c)} />
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <View style={{ gap: 12, marginTop: 8 }}>
          <Skeleton h={250} radius={22} />
          <Skeleton h={108} radius={20} />
          <Skeleton h={108} radius={20} />
        </View>
      ) : nothing ? (
        <EmptyState
          icon={<Radio size={26} color={MUTED} />}
          title={tab === "COMPS" && (status !== "ANY" || category) ? "Nothing matches" : "Nothing is live right now"}
          subtitle={
            tab === "COMPS" && (status !== "ANY" || category)
              ? "Try another filter."
              : "Streams and running competitions show up here the moment they go live."
          }
        />
      ) : (
        <View style={{ gap: 24, marginTop: 8 }}>
          {tab !== "COMPS" && events.length ? (
            <View style={{ gap: 12 }}>
              {tab === "ALL" ? <SectionTitle icon={<Radio size={14} color={RED} />} title="On air" count={feed?.live_events_count} /> : null}
              {events.map((ev) => (
                <BroadcastCard key={ev._id} ev={ev} onPress={() => openEvent(ev)} onWatch={() => watch(ev)} />
              ))}
            </View>
          ) : null}

          {tab !== "STREAMS" && compList.length ? (
            <View style={{ gap: 10 }}>
              {tab === "ALL" ? (
                <SectionTitle icon={<Trophy size={14} color={RED} />} title="Competitions running" count={feed?.live_competitions_count} />
              ) : null}
              {compList.map((c) => (
                <LiveCompCard key={c._id} comp={c} onPress={() => openComp(c)} />
              ))}
            </View>
          ) : null}

          {hasMore ? (
            <Pressable onPress={loadMore} style={({ pressed }) => [s.more, { opacity: pressed || more ? 0.7 : 1 }]}>
              <Txt size={13.5} font="sansBold" style={{ color: "#fff" }}>{more ? "Loading…" : "Show more"}</Txt>
            </Pressable>
          ) : null}
        </View>
      )}
    </SubScreen>
  );
}

function SectionTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {icon}
      <Txt size={13} font="sansBold" tracking={1.2} style={{ color: "#fff" }}>{title.toUpperCase()}</Txt>
      {count != null ? <Txt size={12} font="sansSemi" style={{ color: MUTED }}>{count}</Txt> : null}
    </View>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={() => {
        playNavFeedback();
        onPress();
      }}
      style={[s.chip, on && s.chipOn]}
    >
      <Txt size={12} font="sansBold" style={{ color: on ? RED : "#C5CAD6" }}>{label}</Txt>
    </Pressable>
  );
}

const s = StyleSheet.create({
  tiles: { flexDirection: "row", gap: 8, marginBottom: 16 },
  track: { flexDirection: "row", padding: 4, gap: 4, borderRadius: 999, backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR, marginBottom: 12 },
  seg: { flex: 1, height: 38, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: "rgba(255,255,255,0.12)" },
  chips: { gap: 8, paddingHorizontal: 20, paddingBottom: 12, alignItems: "center" },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
  chipOn: { backgroundColor: RED + "1F", borderColor: RED },
  chipDivider: { width: 1, height: 20, backgroundColor: HAIR },
  more: { height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
});
