import React, { useEffect, useState } from "react";
import { compImage, COMP_POSTER_RATIO } from "@/lib/competition";
import { View, Pressable, StyleSheet, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Trophy, MapPin, ChevronRight, Vote, ClipboardList, Upload, Gavel, Flag as FlagIcon } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { Txt, Skeleton, EmptyState } from "@/components/ui";
import { AppImage, RatioImage } from "@/components/AppImage";
import { LiveStage } from "@/components/LiveStage";
import { liveApi, safe, type LiveCompetitionDetail } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatEventDate, titleCase } from "@/lib/format";
import { PhaseChip, StatTile, RED, OK, AMBER, MUTED, SURFACE, HAIR } from "@/components/live/LiveBits";

const W = Dimensions.get("window").width;
const up = (v: any) => String(v || "").toUpperCase();

/**
 * A running competition as it happens (`/live/competitions/{id}`): its phase,
 * live counts, what's open right now, and the stage. Counts refresh on their own.
 */
export default function LiveCompetitionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useAsync(() => liveApi.competition(String(id)), [id]);

  // live counters — a silent poll (no skeleton, no pull-to-refresh spinner)
  const [polled, setPolled] = useState<LiveCompetitionDetail | null>(null);
  useEffect(() => {
    setPolled(null);
    let alive = true;
    const t = setInterval(async () => {
      const d = await safe(liveApi.competition(String(id)), null);
      if (alive && d) setPolled(d);
    }, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  const c = polled ?? q.data;
  const stats = c?.live_stats || {};
  const votingOpen = !!c?.audience_voting_enabled && up(c?.voting_status) === "OPEN";
  const judgingOpen = !!c?.judge_scoring_enabled && up(c?.judging_status) === "OPEN";
  const title = c?.title || c?.name || "Competition";
  const openFull = () => router.push(`/(more)/competitions/${id}`);
  const openBoard = () => router.push({ pathname: "/(more)/leaderboard", params: { competition: String(id) } });

  return (
    <SubScreen eyebrow="Live competition" title={c ? title : q.loading ? "Loading…" : "Competition"} refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? (
        <View style={{ gap: 12 }}>
          <Skeleton h={W * 0.5} radius={22} />
          <Skeleton h={84} radius={16} />
          <Skeleton h={200} radius={20} />
        </View>
      ) : !c ? (
        <View style={{ gap: 16 }}>
          {/* the API says why: not started yet, or ended with results out */}
          <EmptyState icon={<Trophy size={26} color={MUTED} />} title="Not live right now" subtitle={q.error || "This competition isn't running at the moment."} />
          <Pressable onPress={openFull} style={({ pressed }) => [s.ghost, { opacity: pressed ? 0.8 : 1 }]}>
            <Txt size={14} font="sansBold" style={{ color: "#fff" }}>Open the competition page</Txt>
          </Pressable>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {/* artwork + phase */}
          <View style={s.hero}>
            {/* the whole 4:5 poster — the box takes its shape, nothing cropped */}
            <RatioImage uri={compImage(c)} seed={c._id} fallbackRatio={COMP_POSTER_RATIO} />
            <LinearGradient colors={["rgba(11,11,14,0)", "rgba(11,11,14,0.85)"]} style={StyleSheet.absoluteFill} />
            <View style={s.heroBody}>
              <PhaseChip phase={c.live_phase} solid />
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, marginTop: 10 }}>
                {c.category ? <Txt size={12} font="sansBold" style={{ color: "rgba(255,255,255,0.8)" }}>{c.category}</Txt> : null}
                {c.venue ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <MapPin size={12} color="rgba(255,255,255,0.8)" />
                    <Txt size={12} style={{ color: "rgba(255,255,255,0.8)" }}>{c.venue}</Txt>
                  </View>
                ) : null}
                {c.prize ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                    <Trophy size={12} color="#F5C542" />
                    <Txt size={12} font="sansBold" style={{ color: "#F5C542" }}>{String(c.prize)}</Txt>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* live counts */}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <StatTile value={(stats.total_registrations ?? 0).toLocaleString("en-IN")} label="Registered" />
            <StatTile value={(stats.total_submissions ?? 0).toLocaleString("en-IN")} label="Entries" />
            <StatTile value={(stats.total_audience_votes ?? 0).toLocaleString("en-IN")} label="Vote points" color={OK} />
          </View>

          {/* the next step that actually applies */}
          {votingOpen ? (
            <Primary icon={<Vote size={18} color="#fff" />} label="Vote on the leaderboard" onPress={openBoard} />
          ) : c.can_register ? (
            <Primary icon={<ClipboardList size={18} color="#fff" />} label="Register now" onPress={openFull} />
          ) : null}

          {/* what's open */}
          <View style={s.card}>
            <Txt size={11} font="sansBold" tracking={1.6} style={{ color: MUTED }}>RIGHT NOW</Txt>
            <StatusRow
              icon={<ClipboardList size={16} color={c.registration_open ? OK : MUTED} />}
              label="Registration"
              value={c.registration_open ? "Open" : titleCase(String(c.registration_status || "Closed").replace(/_/g, " "))}
              hint={!c.registration_open ? c.registration_reason : undefined}
              on={!!c.registration_open}
            />
            <StatusRow
              icon={<Upload size={16} color={c.submissions_open ? OK : MUTED} />}
              label="Submissions"
              value={c.submissions_open ? "Open" : "Closed"}
              hint={c.submission_deadline ? `Deadline ${formatEventDate(c.submission_deadline)}` : undefined}
              on={!!c.submissions_open}
            />
            {c.audience_voting_enabled ? (
              <StatusRow
                icon={<Vote size={16} color={votingOpen ? OK : MUTED} />}
                label="Audience voting"
                value={votingOpen ? "Open" : titleCase(String(c.voting_status || "Closed"))}
                on={votingOpen}
              />
            ) : null}
            {c.judge_scoring_enabled ? (
              <StatusRow
                icon={<Gavel size={16} color={judgingOpen ? AMBER : MUTED} />}
                label="Judging"
                value={judgingOpen ? "In progress" : titleCase(String(c.judging_status || "Not started"))}
                on={judgingOpen}
                onColor={AMBER}
              />
            ) : null}
            {c.current_round ? (
              <StatusRow icon={<FlagIcon size={16} color={RED} />} label="Round" value={`Round ${c.current_round}`} on onColor={RED} />
            ) : null}
          </View>

          {/* stage — who's performing, who's next (live-stage endpoint) */}
          <LiveStage compId={String(id)} live />

          {c.description ? (
            <View>
              <Txt size={11} font="sansBold" tracking={1.6} style={{ color: MUTED, marginBottom: 8 }}>ABOUT</Txt>
              <Txt size={14} lh={21} numberOfLines={6} style={{ color: "#E2E8F0" }}>{c.description}</Txt>
            </View>
          ) : null}

          <Pressable onPress={openFull} style={({ pressed }) => [s.link, { opacity: pressed ? 0.8 : 1 }]}>
            <Txt size={14} font="sansBold" style={{ color: "#fff", flex: 1 }}>Full competition details</Txt>
            <ChevronRight size={18} color={MUTED} />
          </Pressable>
          {!votingOpen ? (
            <Pressable onPress={openBoard} style={({ pressed }) => [s.link, { opacity: pressed ? 0.8 : 1 }]}>
              <Txt size={14} font="sansBold" style={{ color: "#fff", flex: 1 }}>Leaderboard</Txt>
              <ChevronRight size={18} color={MUTED} />
            </Pressable>
          ) : null}
        </View>
      )}
    </SubScreen>
  );
}

function Primary({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.primary, { opacity: pressed ? 0.85 : 1 }]}>
      {icon}
      <Txt size={15} font="sansBold" style={{ color: "#fff" }}>{label}</Txt>
    </Pressable>
  );
}

function StatusRow({
  icon,
  label,
  value,
  hint,
  on,
  onColor = OK,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string | null;
  on: boolean;
  onColor?: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
      <View style={[s.rowIcon, { backgroundColor: (on ? onColor : "#ffffff") + "14" }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Txt size={13.5} font="sansSemi" style={{ color: "#fff" }}>{label}</Txt>
        {hint ? <Txt size={11.5} lh={16} style={{ color: MUTED, marginTop: 2 }}>{hint}</Txt> : null}
      </View>
      <Txt size={13} font="sansBold" style={{ color: on ? onColor : MUTED }}>{value}</Txt>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 22, overflow: "hidden", backgroundColor: "#1A1C24" },
  heroBody: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16 },
  card: { padding: 16, gap: 14, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
  rowIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  primary: { height: 52, borderRadius: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: RED },
  ghost: { height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
  link: { flexDirection: "row", alignItems: "center", height: 52, paddingHorizontal: 16, borderRadius: 16, backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
});
