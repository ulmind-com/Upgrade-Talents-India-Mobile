import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Trophy, Flame, Users, ArrowUpRight, CalendarDays, Lock, Gavel, History, Medal } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { publicApi, publicCompetitionsApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Skeleton, EmptyState, SearchField } from "@/components/ui";
import { AppImage, PosterFill } from "@/components/AppImage";
import { FadeInUp } from "@/components/FadeInUp";
import { DottedGrid } from "@/components/patterns";
import { ExpiredStamp } from "@/components/TicketPass";
import { LiveVotingBand } from "@/components/LiveVoting";
import { genz } from "@/theme/tokens";
import { formatEventDate, titleCase, endedAgo } from "@/lib/format";
import { compId, compDeadline, shelveComps, liveVotingIds, liveVotingRows, type CompRow } from "@/lib/competition";

export default function Competitions() {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useSession();

  const { data, loading, refreshing, refresh } = useAsync(() => safe(publicApi.competitions(), []), []);
  /* The only trustworthy answer to "is the poll open?" — the list payload
     carries no voting_status at all. Signed out it stays undefined, and
     compState() falls back to its own honest read. */
  const lv = useAsync(
    () => (user ? safe(publicCompetitionsApi.liveVoting(), null) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );

  const [q, setQ] = useState("");
  const [catSel, setCatSel] = useState("all");

  const rows: CompRow[] = toRows(data);
  const cats = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => { const cat = (r as any).category; if (cat) s.add(String(cat)); });
    return ["all", ...Array.from(s)];
  }, [rows]);
  const fRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => {
      const cat = String((r as any).category || "");
      if (catSel !== "all" && cat.toLowerCase() !== catSel.toLowerCase()) return false;
      if (!s) return true;
      return [(r as any).title, (r as any).name, (r as any).prize, cat, (r as any).description]
        .filter(Boolean).some((v: any) => String(v).toLowerCase().includes(s));
    });
  }, [rows, q, catSel]);

  const liveIds = useMemo(() => liveVotingIds(lv.data), [lv.data]);
  const shelf = useMemo(() => shelveComps(fRows, liveIds), [fRows, liveIds]);

  /* The live endpoint knows the poll; the list knows the prize and category.
     Merge so the hero card has both. */
  const liveCards = useMemo(() => {
    const byId = new Map(rows.map((r) => [compId(r), r]));
    const fromServer = liveVotingRows(lv.data).map((r) => ({ ...(byId.get(compId(r)) || {}), ...r }));
    return fromServer.length ? fromServer : shelf.live;
  }, [lv.data, rows, shelf.live]);

  const open = (id: string) => router.push(`/(more)/competitions/${id}`);
  const openResults = (id: string) => router.push(`/(more)/competitions/${id}/results`);
  /* A finished competition with published results opens straight to the podium;
     everything else opens its detail. */
  const hasResults = (comp: CompRow) => comp.results_published === true || String(comp.result_status || "").toUpperCase() === "FINAL";
  const openComp = (comp: CompRow) => (hasResults(comp) ? openResults(compId(comp)) : open(compId(comp)));

  return (
    <SubScreen
      eyebrow="Take the stage"
      title="Competitions"
      refreshing={refreshing}
      onRefresh={() => { refresh(); lv.refresh(); }}
    >
      {/* Hero — District Gen-Z Violet to Coral */}
      <FadeInUp>
        <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 20 }}>
          <LinearGradient colors={["#7C3AED", "#FF385C", "#08090C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
            <DottedGrid color="rgba(255,255,255,0.24)" opacity={0.5} gap={18} />
            <Txt size={72} font="display" style={{ position: "absolute", top: -6, right: -4, color: "rgba(255,255,255,0.15)", letterSpacing: -3 }}>WIN</Txt>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
              <Trophy size={22} color="#fff" />
            </View>
            <Txt size={25} font="display" tracking={-0.5} lh={28} style={{ color: "#fff", marginTop: 12 }}>Enter. Perform.{"\n"}Take the crown.</Txt>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 }}>
              <Stat label="Open" value={shelf.open.length} />
              {liveCards.length ? <Stat label="Voting live" value={liveCards.length} highlight /> : null}
              {shelf.over.length ? <Stat label="Finished" value={shelf.over.length} /> : null}
            </View>
          </LinearGradient>
        </View>
      </FadeInUp>

      {!loading && rows.length ? (
        <View style={{ gap: 12, marginBottom: 18 }}>
          <SearchField value={q} onChangeText={setQ} placeholder="Search competitions" />
          {cats.length > 1 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {cats.map((x, i) => {
                const on = catSel === x;
                const [g1] = genz(i);
                return (
                  <Pressable key={x} onPress={() => setCatSel(x)} style={{ paddingHorizontal: 14, height: 36, justifyContent: "center", borderRadius: 999, borderWidth: on ? 0 : 1, borderColor: c.border, backgroundColor: on ? g1 : c.surface }}>
                    <Txt size={12.5} font="sansBold" style={{ color: on ? "#fff" : c.fgMuted }}>{titleCase(x)}</Txt>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <View style={{ gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} h={210} radius={24} />)}</View>
      ) : fRows.length ? (
        <View>
          {/* ══ 1. polls open right now — straight to the top ══ */}
          <LiveVotingBand rows={liveCards} onOpen={open} />

          {/* ══ 2. still taking entries ══ */}
          {shelf.open.length ? (
            <View style={{ gap: 16 }}>
              {liveCards.length ? <Heading icon={<Flame size={14} color={c.accent} />} tone={c.accent} label={`Open now · ${shelf.open.length}`} /> : null}
              {shelf.open.map((comp, i) => (
                <FadeInUp key={compId(comp) || i} delay={Math.min(i, 6) * 60}>
                  <CompCard comp={comp} i={i} onPress={() => open(compId(comp))} />
                </FadeInUp>
              ))}
            </View>
          ) : null}

          {/* ══ 3. over — the bottom of the shelf, stamped ══ */}
          {shelf.over.length ? (
            <View style={{ gap: 16, marginTop: shelf.open.length || liveCards.length ? 26 : 0 }}>
              <Heading icon={<History size={14} color={c.fgSubtle} />} tone={c.fgSubtle} label={`Expired · ${shelf.over.length}`} />
              <Txt size={12.5} tone="subtle" lh={18} style={{ marginTop: -6 }}>
                These are done — entries are closed and the results are in. Kept here to look back on.
              </Txt>
              {shelf.over.map((comp, i) => (
                <FadeInUp key={compId(comp) || i} delay={Math.min(i, 6) * 50}>
                  <CompCard comp={comp} i={i} over onPress={() => openComp(comp)} />
                </FadeInUp>
              ))}
            </View>
          ) : null}
        </View>
      ) : rows.length ? (
        <EmptyState icon={<Trophy size={26} color={c.fgMuted} />} title="Nothing matches" subtitle="Try a different search or category." />
      ) : (
        <EmptyState icon={<Trophy size={26} color={c.fgMuted} />} title="No open competitions" subtitle="New competitions are announced every season." />
      )}
    </SubScreen>
  );
}

function Heading({ icon, label, tone }: { icon: React.ReactNode; label: string; tone: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
      {icon}
      <Txt size={11} font="monoMed" tracking={2.5} uppercase style={{ color: tone }}>{label}</Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
    </View>
  );
}

function CompCard({ comp, i, over, onPress }: { comp: CompRow; i: number; over?: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const [g1, g2] = genz(i + 2);
  const id = compId(comp);
  const deadline = compDeadline(comp);
  const ended = over ? endedAgo(deadline) : null;
  const resultOut = comp.results_published === true || String(comp.result_status || "").toUpperCase() === "FINAL";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, shadowColor: over ? "#000" : g2, shadowOpacity: over ? 0.18 : 0.25, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 6 }}>
        {/* banner */}
        <View style={{ aspectRatio: 16 / 10 }}>
          <PosterFill uri={comp.image_url || comp.banner_url} seed={id || i} />
          <LinearGradient colors={["rgba(0,0,0,0.18)", "transparent", "rgba(0,0,0,0.82)"] as any} locations={[0, 0.42, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />
          <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, backgroundColor: over ? c.fgSubtle : g1 }} />

          <View style={{ position: "absolute", top: 12, left: 12, right: 12, flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {over ? null : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.42)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                <Lock size={10} color="#fff" />
                <Txt size={9.5} font="sansBold" style={{ color: "#fff", letterSpacing: 1 }}>
                  {deadline ? `ENTRIES TILL ${formatEventDate(deadline).toUpperCase()}` : "ENTRIES OPEN"}
                </Txt>
              </View>
            )}
            {resultOut ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.42)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                <Medal size={10} color="#ffd166" />
                <Txt size={9.5} font="sansBold" style={{ color: "#ffd166", letterSpacing: 1 }}>RESULTS OUT</Txt>
              </View>
            ) : null}
          </View>

          <View style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
            <Txt size={20} font="display" tracking={-0.5} lh={23} numberOfLines={2} style={{ color: "#fff" }}>{comp.title || comp.name}</Txt>
          </View>

          {/* Over: the colour drains and the stamp lands. */}
          {over ? (
            <>
              <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, backgroundColor: "rgba(6,8,16,0.52)" }} />
              <ExpiredStamp size={18} style={{ position: "absolute", top: 16, right: 10 }} />
            </>
          ) : null}
        </View>

        {/* body */}
        <View style={{ padding: 14, gap: 11, opacity: over ? 0.78 : 1 }}>
          {ended ? (
            <Txt size={12} font="sansSemi" style={{ color: "#ff9b9b" }}>{ended}</Txt>
          ) : comp.description ? (
            <Txt size={13} tone="muted" lh={19} numberOfLines={2}>{comp.description}</Txt>
          ) : null}

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {comp.prize ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: (over ? c.fgSubtle : g1) + "22", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Flame size={12} color={over ? c.fgMuted : g1} />
                <Txt size={11.5} font="sansExt" style={{ color: over ? c.fgMuted : g1 }}>{comp.prize}</Txt>
              </View>
            ) : null}
            {deadline ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                <CalendarDays size={11} color={c.fgSubtle} />
                <Txt size={11.5} font="sansSemi" tone="muted">{formatEventDate(deadline)}</Txt>
              </View>
            ) : null}
            {comp.judging_criteria?.length ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Gavel size={11} color={c.fgSubtle} />
                <Txt size={11.5} font="sansSemi" tone="muted">{comp.judging_criteria.length} criteria</Txt>
              </View>
            ) : null}
            {comp.max_participants ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: c.surface2, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                <Users size={11} color={c.fgSubtle} />
                <Txt size={11.5} font="sansSemi" tone="muted">{comp.max_participants} slots</Txt>
              </View>
            ) : null}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 }}>
            <Txt size={11} font="monoMed" tone="subtle" tracking={1.5} uppercase>
              {titleCase(comp.result_status || comp.status) || (comp.is_published ? "Open" : "Draft")}
            </Txt>
            {over ? (
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 999, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface2, paddingHorizontal: 14, height: 36 }}>
                <Txt size={12.5} font="sansBold" tone="muted" uppercase tracking={0.5}>{resultOut ? "See results" : "View"}</Txt>
                <ArrowUpRight size={15} color={c.fgMuted} />
              </View>
            ) : (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, overflow: "hidden", paddingHorizontal: 14, height: 36 }}>
                <LinearGradient colors={[g1, g2] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
                <Txt size={12.5} font="sansBold" style={{ color: "#fff" }} uppercase tracking={0.5}>Compete</Txt>
                <ArrowUpRight size={15} color="#fff" />
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <View style={{ backgroundColor: highlight ? "rgba(201, 242, 74, 0.2)" : "rgba(255,255,255,0.18)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8, borderWidth: highlight ? 1 : 0, borderColor: "#C9F24A" }}>
      <Txt size={18} font="display" style={{ color: highlight ? "#C9F24A" : "#fff" }}>{value}</Txt>
      <Txt size={9.5} font="sansBold" style={{ color: highlight ? "#C9F24A" : "rgba(255,255,255,0.88)", letterSpacing: 1 }} uppercase>{label}</Txt>
    </View>
  );
}
