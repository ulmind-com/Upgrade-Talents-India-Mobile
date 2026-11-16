import React, { useMemo, useState } from "react";
import { View, Pressable, Animated, Easing } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Trophy, Crown, Medal, Vote, Gavel, Hourglass, ShieldCheck, MessageSquareQuote, Play, Pause } from "lucide-react-native";
import { useAudioPlayer } from "expo-audio";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { competeApi, publicCompetitionsApi, assetUrl, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Skeleton, EmptyState, Badge } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { DottedGrid } from "@/components/patterns";
import { Intro, useIntro } from "@/components/motion";
import { formatDateTime } from "@/lib/format";

/* The competitions chapter runs pink/magenta; results keep that identity but
   crown it in gold so the winners read as winners. */
const PINK = "#f0407e";
const DEEP = "#7a1340";
const GOLD = "#ffd166";
const PODIUM = ["#ffd166", "#dfe6ef", "#f0a56a"]; // gold / silver / bronze

type Row = Record<string, any>;
const rowName = (r: Row) => r.name || r.user_name || r.email || r.user_email || "Contestant";
const rowScore = (r: Row) => Number(r.final_score ?? r.total_score ?? r.score ?? 0);

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

  const snap: any = res.data || {};
  const rows: Row[] = useMemo(() => {
    const lb = Array.isArray(snap.leaderboard) ? snap.leaderboard : Array.isArray(snap.standings) ? snap.standings : [];
    return [...lb].sort((a, b) => Number(a.rank ?? 99) - Number(b.rank ?? 99));
  }, [snap]);
  const published = snap.is_published !== false && rows.length > 0;
  const title = comp.data?.title || comp.data?.name || "Competition";

  const [first, second, third] = rows;
  const rest = rows.slice(3);

  // The signed-in member's own row → their judge feedback, if any.
  const myRow = useMemo(() => {
    if (!user?.email) return null;
    const me = String(user.email).toLowerCase();
    return rows.find((r) => String(r.user_email || r.email || "").toLowerCase() === me) || null;
  }, [rows, user?.email]);
  const fb = useAsync(
    () => (myRow?.submission_id ? safe(publicCompetitionsApi.feedbacks(String(id), String(myRow.submission_id)), []) : Promise.resolve([])),
    [id, myRow?.submission_id]
  );
  const feedbacks: any[] = Array.isArray(fb.data) ? fb.data : [];

  return (
    <SubScreen
      eyebrow="Official results"
      title={title}
      refreshing={res.refreshing}
      onRefresh={() => { res.refresh(); comp.refresh(); }}
    >
      {res.loading ? (
        <View style={{ gap: 14 }}>
          <Skeleton h={220} radius={24} />
          {[0, 1, 2].map((i) => <Skeleton key={i} h={64} radius={16} />)}
        </View>
      ) : !published ? (
        <EmptyState
          icon={<Hourglass size={26} color={c.fgMuted} />}
          title="Results not out yet"
          subtitle="The final standings will appear here the moment judging closes and results are published."
        />
      ) : (
        <View style={{ gap: 18 }}>
          {/* ── The podium ── */}
          <Intro t={intro} at={0} span={0.5} y={20}>
            <View style={{ borderRadius: 26, overflow: "hidden" }}>
              <LinearGradient colors={[PINK, DEEP, "#120512"] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18, paddingTop: 20 }}>
                <DottedGrid color="rgba(255,255,255,0.18)" opacity={0.4} gap={20} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "center", marginBottom: 16 }}>
                  <Trophy size={14} color={GOLD} />
                  <Txt size={11} font="monoMed" tracking={2.5} uppercase style={{ color: GOLD }}>Winners' circle</Txt>
                </View>

                <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "center", gap: 10 }}>
                  {second ? <PodiumSpot row={second} place={2} /> : null}
                  {first ? <PodiumSpot row={first} place={1} /> : null}
                  {third ? <PodiumSpot row={third} place={3} /> : null}
                </View>
              </LinearGradient>
            </View>
          </Intro>

          {/* ── Certified banner ── */}
          <Intro t={intro} at={0.12} span={0.4} y={16}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: c.success + "40", backgroundColor: c.success + "12", padding: 13 }}>
              <ShieldCheck size={17} color={c.success} />
              <Txt size={12.5} lh={17} style={{ flex: 1 }}>
                <Txt size={12.5} font="sansBold" tone="success">Certified final.</Txt>{" "}
                {snap.ranking_mode ? `Ranked by ${String(snap.ranking_mode).replace(/_/g, " ")}. ` : ""}
                {snap.calculated_at ? `Declared ${formatDateTime(snap.calculated_at)}.` : ""}
              </Txt>
            </View>
          </Intro>

          {/* ── Your judge feedback ── */}
          {feedbacks.length ? (
            <Intro t={intro} at={0.16} span={0.42} y={18}>
              <View style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <MessageSquareQuote size={14} color={PINK} />
                  <Txt size={12.5} font="monoMed" tracking={2} uppercase style={{ color: PINK }}>Your judge feedback</Txt>
                </View>
                {feedbacks.map((f, i) => <FeedbackCard key={f._id || i} fb={f} />)}
              </View>
            </Intro>
          ) : null}

          {/* ── The rest of the field ── */}
          {rest.length ? (
            <View style={{ gap: 10 }}>
              <Txt size={12.5} font="monoMed" tone="subtle" tracking={2} uppercase style={{ marginLeft: 2 }}>Full standings</Txt>
              {rest.map((r, i) => (
                <Intro key={r.participant_id || r.user_email || i} t={intro} at={Math.min(0.2 + i * 0.05, 0.7)} span={0.4} y={18}>
                  <RankRow row={r} />
                </Intro>
              ))}
            </View>
          ) : null}

          <Pressable
            onPress={() => router.push("/(more)/leaderboard")}
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, alignSelf: "center", marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6 })}
          >
            <Vote size={14} color={c.accent} />
            <Txt size={13} font="sansBold" tone="accent">See the live leaderboard</Txt>
          </Pressable>
        </View>
      )}
    </SubScreen>
  );
}

/** One judge's feedback — text, and a play button when there's an audio note. */
function FeedbackCard({ fb }: { fb: any }) {
  const { c } = useTheme();
  const audioUrl = assetUrl(fb.audio_feedback_url);
  const player = useAudioPlayer(audioUrl ? { uri: audioUrl } : null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    if (!audioUrl) return;
    try {
      if (playing) { player.pause(); setPlaying(false); }
      else { player.seekTo(0); player.play(); setPlaying(true); }
    } catch {}
  };

  return (
    <View style={{ borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 14, gap: 10 }}>
      {fb.feedback_text ? (
        <Txt size={13.5} lh={20} style={{ fontStyle: "italic" }}>“{fb.feedback_text}”</Txt>
      ) : null}
      {audioUrl ? (
        <Pressable onPress={toggle} style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1, flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "flex-start", borderRadius: 999, backgroundColor: PINK + "18", paddingHorizontal: 13, paddingVertical: 8 })}>
          {playing ? <Pause size={15} color={PINK} /> : <Play size={15} color={PINK} fill={PINK} />}
          <Txt size={12.5} font="sansBold" style={{ color: PINK }}>{playing ? "Playing voice note" : "Play voice note"}</Txt>
        </Pressable>
      ) : null}
      {fb.judge_email ? <Txt size={11} font="mono" tone="subtle">— {fb.judge_email}</Txt> : null}
    </View>
  );
}

/** A spot on the 1-2-3 podium; first place is raised and crowned. */
function PodiumSpot({ row, place }: { row: Row; place: 1 | 2 | 3 }) {
  const color = PODIUM[place - 1];
  const top = place === 1;
  const size = top ? 76 : 60;
  const barH = place === 1 ? 70 : place === 2 ? 52 : 40;

  const rise = useRef0to1(place);

  return (
    <Animated.View style={{ alignItems: "center", width: top ? 104 : 92, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }], opacity: rise }}>
      {top ? <Crown size={22} color={color} style={{ marginBottom: 2 }} /> : null}
      <View style={{ borderWidth: 2.5, borderColor: color, borderRadius: 999, padding: 2, shadowColor: color, shadowOpacity: 0.7, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } }}>
        <Avatar name={rowName(row)} photo={row.profile_photo} size={size} border={{ width: 0, color }} />
      </View>
      <View style={{ marginTop: -11, width: 24, height: 24, borderRadius: 999, backgroundColor: color, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#120512" }}>
        <Txt size={12} font="display" style={{ color: "#120512" }}>{place}</Txt>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 5, maxWidth: top ? 100 : 88 }}>
        <Txt size={12.5} font="sansBold" numberOfLines={1} style={{ color: "#fff", flexShrink: 1 }}>{rowName(row)}</Txt>
        <VerifiedTick row={row} size={13} />
      </View>
      <Txt size={11} font="monoMed" style={{ color }}>{rowScore(row).toFixed(1)} pts</Txt>
      <View style={{ width: top ? 54 : 44, height: barH, marginTop: 6, borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: "hidden" }}>
        <LinearGradient colors={[color, color + "33"] as any} style={{ flex: 1 }} />
      </View>
    </Animated.View>
  );
}

function RankRow({ row }: { row: Row }) {
  const { c } = useTheme();
  const judge = row.judge_score ?? row.raw_judge_score;
  const votes = row.audience_votes ?? row.raw_audience_votes;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 12 }}>
      <View style={{ width: 30, alignItems: "center" }}>
        <Txt size={17} font="display" tone="muted">{row.rank ?? "–"}</Txt>
      </View>
      <Avatar name={rowName(row)} photo={row.profile_photo} size={40} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
          <Txt size={14.5} font="sansSemi" numberOfLines={1} style={{ flexShrink: 1 }}>{rowName(row)}</Txt>
          <VerifiedTick row={row} size={14} />
        </View>
        <View style={{ flexDirection: "row", gap: 10, marginTop: 2 }}>
          {judge != null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Gavel size={10} color={c.fgSubtle} />
              <Txt size={10.5} tone="subtle">{Number(judge).toFixed(1)}</Txt>
            </View>
          ) : null}
          {votes != null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
              <Vote size={10} color={c.fgSubtle} />
              <Txt size={10.5} tone="subtle">{Number(votes).toLocaleString("en-IN")}</Txt>
            </View>
          ) : null}
        </View>
      </View>
      <Txt size={16} font="display" tone="accent">{rowScore(row).toFixed(1)}</Txt>
    </View>
  );
}

/** A small staggered rise per podium place. */
function useRef0to1(place: number) {
  const v = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration: 520,
      delay: 180 + (place === 1 ? 0 : place === 2 ? 140 : 280),
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    }).start();
  }, []);
  return v;
}
