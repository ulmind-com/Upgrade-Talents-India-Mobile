import React, { useEffect, useReducer } from "react";
import { compImage } from "@/lib/competition";
import { View, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChevronRight, Play, Radio } from "lucide-react-native";
import { Txt } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { Pulse } from "@/components/motion";
import { airState, countdownText } from "@/lib/live";
import { formatEventDate } from "@/lib/format";
import { liveApi, type LiveBroadcast, type LiveCompetition, type LivePhase, type LiveSummary } from "@/lib/api";

export const RED = "#FF385C";
export const OK = "#22C55E";
export const AMBER = "#F5B544";
export const MUTED = "#8A90A6";
export const SURFACE = "#11131A";
export const HAIR = "rgba(255,255,255,0.08)";

/* ── time ─────────────────────────────────────────────────────────────── */

export const startOf = (e: LiveBroadcast) => e.scheduled_start || e.start_time;
export const endOf = (e: LiveBroadcast) => e.scheduled_end || e.end_time;

export const clock = (iso?: string | null) => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" }) : null;
};

/** Re-render every `ms` — for countdowns and "on air" states. */
export function useTick(ms = 1000) {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, ms);
    return () => clearInterval(id);
  }, [ms]);
}

/* ── phase ────────────────────────────────────────────────────────────── */

const PHASE: Record<string, { label: string; color: string; pulse?: boolean }> = {
  LIVE: { label: "Live", color: RED, pulse: true },
  VOTING: { label: "Voting open", color: OK, pulse: true },
  JUDGING: { label: "Judging", color: AMBER },
  UPCOMING: { label: "Upcoming", color: MUTED },
  ENDED: { label: "Ended", color: MUTED },
};

export const phaseOf = (p?: LivePhase) => PHASE[String(p || "").toUpperCase()] || { label: "Running", color: RED };

export function PhaseChip({ phase, solid }: { phase?: LivePhase; solid?: boolean }) {
  const t = phaseOf(phase);
  return (
    <View style={[s.chip, { backgroundColor: solid ? t.color : t.color + "1F" }]}>
      {t.pulse ? (
        <Pulse min={0.35} period={1000}>
          <View style={[s.dot, { backgroundColor: solid ? "#fff" : t.color }]} />
        </Pulse>
      ) : (
        <View style={[s.dot, { backgroundColor: solid ? "#fff" : t.color }]} />
      )}
      <Txt size={11} font="sansExt" tracking={0.6} style={{ color: solid ? "#fff" : t.color }}>
        {t.label.toUpperCase()}
      </Txt>
    </View>
  );
}

/** A broadcast's own clock: on air, starting soon, or over. */
export function AirChip({ ev }: { ev: LiveBroadcast }) {
  useTick(1000);
  const st = airState(startOf(ev), endOf(ev));
  if (st === "live") {
    return (
      <View style={[s.chip, { backgroundColor: RED }]}>
        <Pulse min={0.35} period={1000}>
          <View style={[s.dot, { backgroundColor: "#fff" }]} />
        </Pulse>
        <Txt size={11} font="sansExt" tracking={0.6} style={{ color: "#fff" }}>LIVE</Txt>
      </View>
    );
  }
  const label = st === "upcoming" ? `STARTS IN ${countdownText(startOf(ev)) || "SOON"}` : "ENDED";
  return (
    <View style={[s.chip, s.glass]}>
      <Txt size={11} font="sansExt" tracking={0.6} style={{ color: "#fff" }}>{label}</Txt>
    </View>
  );
}

/* ── small pieces ─────────────────────────────────────────────────────── */

export function StatTile({
  value,
  label,
  color = "#fff",
  active,
  onPress,
}: {
  value: number | string;
  label: string;
  color?: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [s.tile, active && { borderColor: color + "88", backgroundColor: color + "12" }, { opacity: pressed ? 0.8 : 1 }]}
    >
      <Txt size={22} font="display" style={{ color }}>{value}</Txt>
      <Txt size={11} font="sansSemi" numberOfLines={1} style={{ color: MUTED, marginTop: 2 }}>{label}</Txt>
    </Pressable>
  );
}

export function Flag({ on, label }: { on: boolean; label: string }) {
  return (
    <View style={s.flag}>
      <View style={[s.dot, { backgroundColor: on ? OK : "rgba(255,255,255,0.25)" }]} />
      <Txt size={11.5} font="sansSemi" style={{ color: on ? "#E2E8F0" : MUTED }}>{label}</Txt>
    </View>
  );
}

/* ── cards ────────────────────────────────────────────────────────────── */

/** A broadcast: artwork, its on-air state, when it runs, and a way to watch. */
export function BroadcastCard({ ev, onPress, onWatch }: { ev: LiveBroadcast; onPress: () => void; onWatch?: () => void }) {
  const from = clock(startOf(ev));
  const to = clock(endOf(ev));
  const when = from ? (to ? `${from} – ${to}` : `From ${from}`) : null;
  const day = startOf(ev) ? formatEventDate(startOf(ev)!) : null;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <View style={s.bCard}>
        <View style={s.bArt}>
          <AppImage uri={ev.image_url} seed={ev._id} style={StyleSheet.absoluteFill} />
          <LinearGradient colors={["rgba(11,11,14,0.1)", "rgba(11,11,14,0.75)"]} style={StyleSheet.absoluteFill} />
          <View style={{ position: "absolute", top: 12, left: 12 }}>
            <AirChip ev={ev} />
          </View>
          <View style={s.bPlay}>
            <Play size={18} color="#fff" fill="#fff" style={{ marginLeft: 2 }} />
          </View>
        </View>
        <View style={{ padding: 16 }}>
          <Txt size={17} font="sansBold" lh={22} numberOfLines={2} style={{ color: "#fff" }}>{ev.title}</Txt>
          {ev.description ? (
            <Txt size={12.5} lh={18} numberOfLines={2} style={{ color: MUTED, marginTop: 4 }}>{ev.description}</Txt>
          ) : null}
          <View style={s.bFoot}>
            <Txt size={12} font="sansSemi" style={{ color: "#C5CAD6", flex: 1 }} numberOfLines={1}>
              {[day, when].filter(Boolean).join("  ·  ")}
            </Txt>
            {ev.public_url && onWatch ? (
              <Pressable onPress={onWatch} hitSlop={6} style={({ pressed }) => [s.watch, { opacity: pressed ? 0.85 : 1 }]}>
                <Radio size={13} color="#fff" />
                <Txt size={12.5} font="sansBold" style={{ color: "#fff" }}>Watch</Txt>
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}

/** A running competition: phase, what's open right now, one tap to its live page. */
export function LiveCompCard({ comp, onPress }: { comp: LiveCompetition; onPress: () => void }) {
  const votingOpen = !!comp.audience_voting_enabled && String(comp.voting_status).toUpperCase() === "OPEN";
  const judgingOpen = !!comp.judge_scoring_enabled && String(comp.judging_status).toUpperCase() === "OPEN";
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.cCard, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={s.cThumb}>
        <AppImage uri={compImage(comp)} seed={comp._id} style={StyleSheet.absoluteFill} />
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <PhaseChip phase={comp.live_phase} />
          {comp.category ? (
            <Txt size={11} font="sansBold" numberOfLines={1} style={{ color: MUTED, flexShrink: 1 }}>{comp.category}</Txt>
          ) : null}
        </View>
        <Txt size={15} font="sansBold" lh={20} numberOfLines={2} style={{ color: "#fff" }}>
          {comp.title || comp.name || "Competition"}
        </Txt>
        <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 }}>
          {votingOpen ? <Flag on label="Voting" /> : null}
          {judgingOpen ? <Flag on label="Judging" /> : null}
          {comp.registration_open ? <Flag on label="Entries open" /> : null}
          {comp.submissions_open ? <Flag on label="Submissions" /> : null}
        </View>
      </View>
      <ChevronRight size={18} color={MUTED} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 24, paddingHorizontal: 9, borderRadius: 999, alignSelf: "flex-start" },
  glass: { backgroundColor: "rgba(11,11,14,0.65)", borderWidth: 1, borderColor: "rgba(255,255,255,0.18)" },
  dot: { width: 6, height: 6, borderRadius: 999 },
  tile: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: HAIR,
  },
  flag: { flexDirection: "row", alignItems: "center", gap: 5 },
  bCard: { borderRadius: 22, overflow: "hidden", backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
  bArt: { height: 180, backgroundColor: "#1A1C24" },
  bPlay: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: "rgba(11,11,14,0.6)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  bFoot: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12 },
  watch: { flexDirection: "row", alignItems: "center", gap: 6, height: 34, paddingHorizontal: 12, borderRadius: 12, backgroundColor: RED },
  cCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 20,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: HAIR,
  },
  cThumb: { width: 84, height: 105, borderRadius: 16, // 4:5, the competition poster shape
    overflow: "hidden", backgroundColor: "#1A1C24" },
});

/* ── home entry ───────────────────────────────────────────────────────── */

/**
 * "3 live now" — the home screen's door into the Live hub, off `/live/summary`.
 * Refreshes every minute; renders nothing while nothing is live.
 */
export function LiveNowBar({ onPress, style, refreshKey = 0 }: { onPress: () => void; style?: StyleProp<ViewStyle>; refreshKey?: number }) {
  const [sum, setSum] = React.useState<LiveSummary | null>(null);
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      try {
        const d = await liveApi.summary();
        if (alive) setSum(d);
      } catch {}
    };
    pull();
    const t = setInterval(pull, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [refreshKey]);
  if (!sum || !sum.total_live) return null;
  const parts = [
    sum.live_events_count ? `${sum.live_events_count} stream${sum.live_events_count > 1 ? "s" : ""}` : null,
    sum.live_competitions_count ? `${sum.live_competitions_count} competition${sum.live_competitions_count > 1 ? "s" : ""}` : null,
    sum.voting_open_count ? `${sum.voting_open_count} voting` : null,
  ].filter(Boolean);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${sum.total_live} live now`} style={({ pressed }) => [bar.wrap, style, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={bar.dotWrap}>
        <Pulse min={0.2} period={1300}>
          <View style={bar.halo} />
        </Pulse>
        <View style={bar.dot} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={14.5} font="sansBold" style={{ color: "#fff" }}>{sum.total_live} live now</Txt>
        {parts.length ? <Txt size={12} style={{ color: MUTED, marginTop: 1 }}>{parts.join("  ·  ")}</Txt> : null}
      </View>
      <Txt size={12.5} font="sansBold" style={{ color: RED }}>See all</Txt>
      <ChevronRight size={16} color={RED} />
    </Pressable>
  );
}

const bar = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    paddingHorizontal: 14,
    height: 60,
    borderRadius: 18,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: RED + "40",
  },
  dotWrap: { width: 28, height: 28, borderRadius: 999, backgroundColor: RED + "1F", alignItems: "center", justifyContent: "center" },
  halo: { position: "absolute", width: 18, height: 18, borderRadius: 999, backgroundColor: RED + "55", left: -9, top: -9 },
  dot: { width: 9, height: 9, borderRadius: 999, backgroundColor: RED },
});
