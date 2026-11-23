import React, { useMemo, useState } from "react";
import { View, Pressable, TextInput, ScrollView, StyleSheet, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  Trophy, Vote, Hourglass, ShieldCheck, Play, Pause, Award, Search, Heart, Share2, MessageSquareQuote,
} from "lucide-react-native";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { competeApi, publicCompetitionsApi, publicApi, extrasApi, assetUrl, safe, type ShareLinkData } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Skeleton, EmptyState, Button } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { Intro, useIntro } from "@/components/motion";
import { Podium, RankLaurel, type PodiumEntry } from "@/components/Podium";
import { formatDateTime } from "@/lib/format";
import { ShareSheet } from "@/components/ShareSheet";

/* Results share the live leaderboard's look: the gold-lit 3D podium, laurel
   medals for the top three and a dark standings table below. */
const PINK = "#FF385C";
const GOLD = "#F5C542";
const EMERALD = "#10B981";
const PAGE_BG = "#08090C"; // SubScreen's background — the podium fades into it
const { width: SCREEN_W } = Dimensions.get("window");

type Row = Record<string, any>;
const rowName = (r: Row) => r.name || r.user_name || r.email || r.user_email || "Contestant";
const rowScore = (r: Row) => Number(r.final_score ?? r.total_score ?? r.score ?? 0);
const fmtScore = (n: number) => (Number.isInteger(n) ? n.toLocaleString("en-IN") : n.toFixed(1));

export default function CompetitionResults() {
  const { c } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const intro = useIntro();

  const comp = useAsync(() => safe(publicCompetitionsApi.detail(String(id)), null), [id]);
  const res = useAsync(
    () => (user ? safe(competeApi.results(String(id)), null) : safe(publicCompetitionsApi.results(String(id)), null)),
    [id, user?.email],
    { refetchOnFocus: true }
  );

  const certsQ = useAsync(
    () => (user ? safe(extrasApi.myCertificates(), []) : Promise.resolve([])),
    [user?.email]
  );

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  const snap: any = res.data || {};
  const allRows: Row[] = useMemo(() => {
    const lb = Array.isArray(snap.leaderboard) ? snap.leaderboard : Array.isArray(snap.standings) ? snap.standings : [];
    return [...lb].sort((a, b) => Number(a.rank ?? 99) - Number(b.rank ?? 99));
  }, [snap]);

  const categories: string[] = useMemo(() => {
    const set = new Set<string>();
    allRows.forEach((r) => { if (r.category) set.add(r.category); });
    if (Array.isArray(snap.categories)) {
      snap.categories.forEach((cat: string) => { if (cat) set.add(cat); });
    }
    return set.size > 0 ? ["ALL", ...Array.from(set)] : [];
  }, [allRows, snap.categories]);

  const rows: Row[] = useMemo(() => {
    let list = allRows;
    if (selectedCategory !== "ALL") {
      // the backend ranks each division on its own — use that when it's there
      const byCat = snap.category_leaderboards?.[selectedCategory];
      list = Array.isArray(byCat) && byCat.length ? byCat : list.filter((r) => r.category === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r) => rowName(r).toLowerCase().includes(q) || String(r.user_email || r.email || "").toLowerCase().includes(q));
    }
    return list;
  }, [allRows, selectedCategory, search, snap.category_leaderboards]);

  const published = snap.is_published !== false && allRows.length > 0;
  const title = comp.data?.title || comp.data?.name || "Competition";

  const [first, second, third] = rows;
  const rest = rows.slice(3);

  // The signed-in member's own row → their judge feedback & certificate, if any.
  const myRow = useMemo(() => {
    if (!user?.email) return null;
    const me = String(user.email).toLowerCase();
    return allRows.find((r) => String(r.user_email || r.email || "").toLowerCase() === me) || null;
  }, [allRows, user?.email]);

  const myCert = useMemo(() => {
    const raw = certsQ.data;
    const list = Array.isArray(raw) ? raw : Array.isArray((raw as any)?.certificates) ? (raw as any).certificates : [];
    return (
      list.find(
        (c: any) =>
          String(c.activity_id || c.competition_id) === String(id) ||
          String(c.activity_title || "").toLowerCase().trim() === String(title || "").toLowerCase().trim()
      ) || null
    );
  }, [certsQ.data, id, title]);

  const fb = useAsync(
    () => (myRow?.submission_id ? safe(publicCompetitionsApi.feedbacks(String(id), String(myRow.submission_id)), []) : Promise.resolve([])),
    [id, myRow?.submission_id]
  );
  const feedbacks: any[] = Array.isArray(fb.data) ? fb.data : [];

  /* Share — the message is built from the published results themselves:
     the member's own placing when they're in it, otherwise the top three. */
  const [shareOpen, setShareOpen] = useState(false);
  const [shareData, setShareData] = useState<ShareLinkData | null>(null);
  // The site's results page, off the backend's page_url (honours its FRONTEND_URL).
  const shareUrl = shareData?.page_url
    ? `${shareData.page_url.replace(/\/$/, "")}/results`
    : `https://upgradetalentsindia.in/competitions/${id}/results`;
  const shareMessage = (() => {
    // overall top three — not whatever category filter happens to be on
    const podium = allRows
      .slice(0, 3)
      .map((r, i) => `${["🥇", "🥈", "🥉"][i]} ${rowName(r)}`)
      .join("\n");
    const myRank = Number(myRow?.rank);
    const mine =
      myRow && Number.isFinite(myRank) && myRank > 0
        ? `I placed ${ordinal(myRank)} in ${title} on Upgrade Talents India! 🎉`
        : `The official results of ${title} on Upgrade Talents India are out! 🏆`;
    return podium ? `${mine}\n\n${podium}` : mine;
  })();

  /** A podium slot from a real results row. */
  const toEntry = (r?: Row): PodiumEntry =>
    r
      ? {
          key: String(r.participant_id || r.user_email || r.email || rowName(r)),
          name: rowName(r),
          renderAvatar: (sz) => <Avatar name={rowName(r)} photo={r.profile_photo} size={sz} />,
          score: fmtScore(rowScore(r)),
          badge: <VerifiedTick row={r} size={12} />,
        }
      : null;

  return (
    <SubScreen
      eyebrow="Official results"
      title={title}
      refreshing={res.refreshing}
      onRefresh={() => { res.refresh(); comp.refresh(); certsQ.refresh(); }}
      right={
        published ? (
          <Pressable
            onPress={() => {
              setShareOpen(true);
              publicApi.shareCompetition(String(id)).then(setShareData).catch(() => {});
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share results"
            style={({ pressed }) => [sx.shareBtn, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}
          >
            <Share2 size={17} color="#FFFFFF" />
          </Pressable>
        ) : null
      }
      overlay={
        <ShareSheet
          visible={shareOpen}
          title="Share results"
          subtitle={title}
          message={shareMessage}
          url={shareUrl}
          card={{
            image: shareData?.image_url || comp.data?.image_url || comp.data?.banner_url,
            title: `${title} — Official results`,
            meta: first ? `Winner: ${rowName(first)}` : null,
          }}
          onClose={() => setShareOpen(false)}
        />
      }
    >
      {res.loading ? (
        <View style={{ gap: 14 }}>
          <Skeleton h={300} radius={24} />
          {[0, 1, 2].map((i) => <Skeleton key={i} h={64} radius={16} />)}
        </View>
      ) : !published ? (
        <View style={{ gap: 20 }}>
          <EmptyState
            icon={<Hourglass size={26} color={c.fgMuted} />}
            title="Results pending publication"
            subtitle="The official rankings and scores are currently being reviewed and finalized by the judging panel."
          />
          <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
            <Button
              label="Back to Competition"
              variant="outline"
              size="sm"
              onPress={() => router.push(`/(more)/competitions/${id}`)}
            />
            <Button
              label="Provisional Leaderboard"
              size="sm"
              onPress={() => router.push({ pathname: "/(more)/leaderboard", params: { competition: String(id) } })}
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: 18 }}>
          {/* ── The signed-in member's own result ── */}
          {myRow ? (
            <Intro t={intro} at={0.04} span={0.4} y={16}>
              <MyResultCard
                row={myRow}
                name={user?.name || rowName(myRow)}
                hasCert={!!myCert}
                onCert={() => router.push("/(more)/certificates")}
              />
            </Intro>
          ) : null}

          {/* ── Podium: the same 3D blocks as the live leaderboard, rising in ── */}
          <View style={{ marginHorizontal: -20 }}>
            {rows.length ? (
              <Podium
                width={SCREEN_W}
                bg={PAGE_BG}
                first={toEntry(first)}
                second={toEntry(second)}
                third={toEntry(third)}
                replayKey={selectedCategory}
              />
            ) : null}
            <View style={{ alignItems: "center", marginTop: rows.length ? -Math.round(SCREEN_W * 0.1) : 0 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Trophy size={13} color={GOLD} />
                <Txt size={11.5} font="sansExt" tracking={2.2} uppercase style={{ color: GOLD }}>
                  Winners' circle
                </Txt>
              </View>
              <Txt size={28} font="display" style={{ color: "#FFFFFF", marginTop: 6, letterSpacing: -0.5 }}>
                Final Standings
              </Txt>
              {!rows.length ? (
                <Txt size={12.5} tone="subtle" style={{ marginTop: 6 }}>
                  No contestant matches this filter.
                </Txt>
              ) : null}
            </View>
          </View>

          {/* ── Certified banner ── */}
          <Intro t={intro} at={0.12} span={0.4} y={16}>
            <View style={sx.certified}>
              <ShieldCheck size={17} color={EMERALD} />
              <Txt size={12.5} lh={17} style={{ flex: 1, color: "#CBD5E1" }}>
                <Txt size={12.5} font="sansBold" style={{ color: EMERALD }}>Certified final.</Txt>{" "}
                {snap.ranking_mode ? `Ranked by ${String(snap.ranking_mode).replace(/_/g, " ")}. ` : ""}
                {snap.calculated_at ? `Declared ${formatDateTime(snap.calculated_at)}.` : ""}
              </Txt>
            </View>
          </Intro>

          {/* ── Category filters & search ── */}
          {categories.length > 0 || allRows.length > 4 ? (
            <View style={{ gap: 10 }}>
              {categories.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {categories.map((cat) => {
                    const active = selectedCategory === cat;
                    return (
                      <Pressable
                        key={cat}
                        onPress={() => setSelectedCategory(cat)}
                        style={[sx.catPill, active && sx.catPillOn]}
                      >
                        <Txt size={12} font="sansBold" style={{ color: active ? PINK : "#9EA3B8" }}>
                          {cat}
                        </Txt>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : null}

              {allRows.length > 4 ? (
                <View style={sx.search}>
                  <Search size={15} color="#64748B" />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search contestants…"
                    placeholderTextColor="#64748B"
                    style={{ flex: 1, color: "#ffffff", fontSize: 13.5, paddingVertical: 0 }}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {/* ── Your judge feedback ── */}
          {feedbacks.length ? (
            <Intro t={intro} at={0.16} span={0.42} y={18}>
              <View style={{ gap: 10 }}>
                <Txt size={11} font="sansBold" tracking={2} uppercase style={{ color: "#64748B" }}>
                  Your judge feedback
                </Txt>
                {feedbacks.map((f, i) => <FeedbackCard key={f._id || i} fb={f} />)}
              </View>
            </Intro>
          ) : null}

          {/* ── The rest of the field ── */}
          {rest.length ? (
            <View style={{ marginHorizontal: -20 }}>
              <Txt size={11} font="sansBold" tracking={2} uppercase style={{ color: "#64748B", marginLeft: 20, marginBottom: 8 }}>
                Full standings
              </Txt>
              <View style={sx.tableHead}>
                <Txt size={10.5} font="sansBold" style={[sx.headLabel, { width: 44, textAlign: "center" }]}>RANK</Txt>
                <Txt size={10.5} font="sansBold" style={[sx.headLabel, { flex: 1, paddingLeft: 8 }]}>USER</Txt>
                <Txt size={10.5} font="sansBold" style={[sx.headLabel, { width: 64, textAlign: "right", paddingRight: 10 }]}>SCORE</Txt>
                <Txt size={10.5} font="sansBold" style={[sx.headLabel, { width: 60, textAlign: "right" }]}>VOTES</Txt>
              </View>
              {rest.map((r, i) => (
                <Intro key={r.participant_id || r.user_email || i} t={intro} at={Math.min(0.2 + i * 0.05, 0.7)} span={0.4} y={18}>
                  <StandingRow row={r} rank={Number(r.rank ?? i + 4)} />
                </Intro>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push({ pathname: "/(more)/leaderboard", params: { competition: String(id) } })}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, alignSelf: "center", marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 })}
          >
            <Vote size={14} color={PINK} />
            <Txt size={13} font="sansBold" style={{ color: PINK }}>See the live leaderboard</Txt>
          </Pressable>
        </View>
      )}
    </SubScreen>
  );
}

const mmss = (sec: number) => {
  const t = Math.max(0, Math.floor(sec || 0));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/**
 * One judge's feedback. The backend stores it as `text_feedback` +
 * `audio_feedback_url`, signed with `judge_name` and `submitted_at`.
 */
function FeedbackCard({ fb }: { fb: any }) {
  const text = fb.text_feedback || fb.feedback_text || fb.feedback || "";
  const judge = fb.judge_name || "Judge";
  const audioUrl = assetUrl(fb.audio_feedback_url);
  const player = useAudioPlayer(audioUrl ? { uri: audioUrl } : null);
  const status = useAudioPlayerStatus(player);
  const playing = !!status?.playing;
  const dur = status?.duration || 0;
  const pos = status?.currentTime || 0;
  const ended = dur > 0 && pos >= dur - 0.25;

  const toggle = () => {
    if (!audioUrl) return;
    try {
      if (playing) player.pause();
      else {
        if (ended) player.seekTo(0);
        player.play();
      }
    } catch {}
  };

  return (
    <View style={sx.fbCard}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Avatar name={judge} size={36} />
        <View style={{ flex: 1 }}>
          <Txt size={13.5} font="sansBold" style={{ color: "#FFFFFF" }}>{judge}</Txt>
          <Txt size={11} style={{ color: "#8A90A6" }}>
            Judge{fb.submitted_at ? ` · ${formatDateTime(fb.submitted_at)}` : ""}
          </Txt>
        </View>
        <MessageSquareQuote size={18} color="rgba(255,255,255,0.25)" />
      </View>

      {text ? (
        <Txt size={14} lh={21} style={{ color: "#E2E8F0", marginTop: 12 }}>{text}</Txt>
      ) : null}

      {audioUrl ? (
        <View style={sx.voice}>
          <Pressable
            onPress={toggle}
            accessibilityRole="button"
            accessibilityLabel={playing ? "Pause voice note" : "Play voice note"}
            style={({ pressed }) => [sx.playBtn, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
          >
            {playing ? <Pause size={16} color="#FFFFFF" fill="#FFFFFF" /> : <Play size={16} color="#FFFFFF" fill="#FFFFFF" style={{ marginLeft: 2 }} />}
          </Pressable>
          <View style={{ flex: 1, gap: 6 }}>
            <Txt size={12} font="sansSemi" style={{ color: "#FFFFFF" }}>Voice note</Txt>
            <View style={sx.voiceTrack}>
              <View style={[sx.voiceFill, { width: `${dur ? Math.min(100, (pos / dur) * 100) : 0}%` }]} />
            </View>
          </View>
          <Txt size={11.5} font="sansSemi" style={{ color: "#8A90A6", minWidth: 64, textAlign: "right" }}>
            {dur ? `${mmss(pos)} / ${mmss(dur)}` : "—"}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}

const ordinal = (n: number) => {
  const v = n % 100;
  const suf = v >= 11 && v <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th";
  return `${n}${suf}`;
};

/** Your rank, your three numbers, and the certificate if one was issued. */
function MyResultCard({ row, name, hasCert, onCert }: { row: Row; name: string; hasCert: boolean; onCert: () => void }) {
  const rank = Number(row.rank);
  const hasRank = Number.isFinite(rank) && rank > 0;
  return (
    <View style={sx.myCard}>
      <LinearGradient
        colors={["rgba(245,197,66,0.16)", "rgba(20,22,30,0.92)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        {hasRank && rank <= 3 ? (
          <RankLaurel rank={rank} size={54} medal />
        ) : (
          <View style={sx.rankTile}>
            <Txt size={17} font="display" style={{ color: "#FFFFFF" }}>{hasRank ? `#${rank}` : "—"}</Txt>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Txt size={9.5} font="sansExt" tracking={2} uppercase style={{ color: GOLD }}>Your result</Txt>
          <Txt size={15} font="sansBold" style={{ color: "#FFFFFF", marginTop: 2 }}>{name}</Txt>
          <Txt size={11} style={{ color: "#8A90A6", marginTop: 1 }}>
            {[row.category, hasRank ? `${ordinal(rank)} place` : null].filter(Boolean).join(" · ")}
          </Txt>
        </View>
        {hasCert ? (
          <Pressable onPress={onCert} style={({ pressed }) => [sx.certBtn, { opacity: pressed ? 0.85 : 1 }]}>
            <Award size={13} color="#1A1200" />
            <Txt size={11.5} font="sansBold" style={{ color: "#1A1200" }}>Certificate</Txt>
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <Stat value={fmtScore(rowScore(row))} label="Final score" color={GOLD} />
        <Stat value={Number(row.judge_score ?? row.raw_judge_score ?? 0).toFixed(1)} label="Judge score" />
        <Stat value={Number(row.audience_votes ?? row.raw_audience_votes ?? 0).toLocaleString("en-IN")} label="Votes" />
      </View>
    </View>
  );
}

function Stat({ value, label, color = "#FFFFFF" }: { value: string; label: string; color?: string }) {
  return (
    <View style={sx.stat}>
      <Txt size={17} font="sansExt" style={{ color }}>{value}</Txt>
      <Txt size={9.5} font="sansSemi" tracking={1} uppercase style={{ color: "#8A90A6", marginTop: 2 }}>{label}</Txt>
    </View>
  );
}

/** One row of the standings table — full name, never truncated. */
function StandingRow({ row, rank }: { row: Row; rank: number }) {
  const votes = Number(row.audience_votes ?? row.raw_audience_votes ?? 0);
  const judge = row.judge_score ?? row.raw_judge_score;
  const sub = [row.category, judge != null ? `Judge ${Number(judge).toFixed(1)}` : null].filter(Boolean).join(" · ");
  return (
    <View style={sx.row}>
      <View style={{ width: 44, alignItems: "center" }}>
        {rank <= 3 ? (
          <RankLaurel rank={rank} size={42} medal />
        ) : (
          <View style={sx.numCircle}>
            <Txt size={12.5} font="sansBold" style={{ color: "#E2E8F0" }}>{rank}</Txt>
          </View>
        )}
      </View>
      <View style={{ marginLeft: 8 }}>
        <Avatar name={rowName(row)} photo={row.profile_photo} size={38} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 4 }}>
          <Txt size={13.5} font="sansBold" style={{ color: "#FFFFFF", flexShrink: 1, lineHeight: 18 }}>
            {rowName(row)}
          </Txt>
          <View style={{ marginTop: 3 }}>
            <VerifiedTick row={row} size={11} />
          </View>
        </View>
        {sub ? <Txt size={10} tone="subtle" style={{ marginTop: 1 }}>{sub}</Txt> : null}
      </View>
      <Txt size={13.5} font="sansExt" style={{ color: "#FFFFFF", width: 64, textAlign: "right", paddingRight: 10 }}>
        {fmtScore(rowScore(row))}
      </Txt>
      <View style={{ width: 60, alignItems: "flex-end" }}>
        <View style={sx.votePill}>
          <Heart size={11} color={EMERALD} />
          <Txt size={11.5} font="sansBold" style={{ color: EMERALD }}>{votes.toLocaleString("en-IN")}</Txt>
        </View>
      </View>
    </View>
  );
}

const sx = StyleSheet.create({
  fbCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "#10121B",
    padding: 16,
  },
  voice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    padding: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,56,92,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,56,92,0.2)",
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: PINK,
    alignItems: "center",
    justifyContent: "center",
  },
  voiceTrack: { height: 4, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  voiceFill: { height: "100%", backgroundColor: PINK, borderRadius: 999 },
  shareBtn: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    backgroundColor: "rgba(20, 22, 30, 0.9)",
  },
  myCard: {
    borderRadius: 20,
    padding: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(245,197,66,0.35)",
  },
  rankTile: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#151824",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  certBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: GOLD,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  stat: {
    flex: 1,
    backgroundColor: "#0B0C14",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  certified: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.3)",
    backgroundColor: "rgba(16,185,129,0.08)",
    padding: 12,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  catPillOn: {
    backgroundColor: "rgba(255,56,92,0.2)",
    borderColor: PINK,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 40,
    borderRadius: 12,
    paddingHorizontal: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  headLabel: {
    color: "#64748B",
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)",
  },
  numCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#151824",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  votePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(16,185,129,0.12)",
    borderWidth: 1,
    borderColor: "rgba(16,185,129,0.25)",
  },
});
