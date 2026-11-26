import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Animated, Easing, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Mic, MapPin, ChevronRight, Check, Clock, Users, ListOrdered } from "lucide-react-native";
import { useSession } from "@/context/Session";
import {
  competeApi,
  liveApi,
  publicCompetitionsApi,
  safe,
  type LiveStageData,
  type FinalLineup,
  type StagePerformer,
} from "@/lib/api";
import { Txt } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { VerifiedTick, isVerified, InlineTick } from "@/components/VerifiedBadge";
import { Pulse } from "@/components/motion";
import { LiveStageLineupModal } from "@/components/LiveStageLineupModal";
import { useRealtime } from "@/lib/realtime";

const SPOT = "#FF385C";
const OK = "#22C55E";
const MUTED = "rgba(255,255,255,0.58)";
const FAINT = "rgba(255,255,255,0.08)";

const email = (s: any) => String(s ?? "").toLowerCase().trim();
export const performerName = (p?: StagePerformer | null) => p?.participant_name || p?.user_name || "Contestant";
export const performerPhoto = (p?: StagePerformer | null) => p?.avatar || p?.user_photo || undefined;
const isPresent = (p: StagePerformer) => !!(p.is_present || p.attendance_status === "PRESENT");

/** "4m", "1h 12m" since an ISO time; null when unknown. */
function since(iso?: string, now = Date.now()): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const m = Math.max(0, Math.floor((now - t) / 60000));
  if (m < 1) return "just now";
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Live stage for a running competition (`/live-stage`): who is performing,
 * who just finished, who is up next, how far the show has got, and where the
 * signed-in member sits in the queue. Before the show — no one on stage yet —
 * it falls back to the official final lineup (`/final-participants`) so the
 * checked-in contestants are visible. Renders nothing when there's neither.
 */
export function LiveStage({ compId, live }: { compId: string; live?: boolean }) {
  const { user } = useSession();
  const [stage, setStage] = useState<LiveStageData | null>(null);
  const [final, setFinal] = useState<FinalLineup | null>(null);
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(Date.now());

  const pullRef = useRef<() => void>(() => {});
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const d = user
        ? await safe(competeApi.liveStage(compId), null)
        : await safe(liveApi.stage(compId).catch(() => publicCompetitionsApi.liveStage(compId)), null);
      if (!alive) return;
      if (d) setStage(d);
      // nobody on stage → the confirmed lineup is the interesting thing
      if (!d?.has_active_performer) {
        const f = await safe(publicCompetitionsApi.finalParticipants(compId), null);
        if (alive && f) setFinal(f);
      }
      setNow(Date.now());
    };
    pullRef.current = pull;
    pull();
    // the stage moves by the minute; a light poll keeps it honest (server caches 3s)
    const id = setInterval(pull, 12000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [compId, user?.email]);

  // the stage moves → the server says so on `competition:<id>`; re-read right away
  useRealtime([`competition:${compId}`], () => pullRef.current());

  const lineup: StagePerformer[] = Array.isArray(stage?.lineup) ? stage!.lineup! : [];
  const current = stage?.has_active_performer ? stage?.current_performer ?? null : null;
  const previous = stage?.previous_performer ?? null;
  const curEmail = email(current?.user_email);

  /* still to perform, in running order (present first, then waiting check-in) */
  const pending = useMemo(
    () => lineup.filter((p) => email(p.user_email) !== curEmail && p.stage_status !== "COMPLETED"),
    [lineup, curEmail]
  );
  const upNext = pending.filter(isPresent).slice(0, 3);

  const total = stage?.total_participants ?? lineup.length;
  const done = stage?.completed_count ?? lineup.filter((p) => p.stage_status === "COMPLETED").length;
  const present = stage?.present_count ?? 0;

  const mine = useMemo(() => {
    if (!user?.email) return null;
    const me = email(user.email);
    const row = lineup.find((p) => email(p.user_email) === me);
    if (!row) return null;
    if (curEmail === me) return { tone: "live" as const, text: "You're on stage — break a leg!" };
    if (row.stage_status === "COMPLETED") return { tone: "done" as const, text: "You've performed. Results follow once judging closes." };
    if (!isPresent(row)) return { tone: "wait" as const, text: "Check in at the venue to join the running order." };
    const ahead = pending.filter(isPresent).findIndex((p) => email(p.user_email) === me);
    if (ahead === 0) return { tone: "next" as const, text: "You're up next — head backstage." };
    return { tone: "queue" as const, text: `${ahead} ahead of you · you're #${row.order ?? ahead + 1} in the running order.` };
  }, [user?.email, lineup, curEmail, pending]);

  const showStage = !!current || (live && lineup.length > 0) || (stage?.stage_status && stage.stage_status !== "IDLE" && lineup.length > 0);
  const finalRows = final?.final_participants ?? [];
  const showFinal = !showStage && finalRows.length > 0;
  if (!showStage && !showFinal) return null;

  const venue = stage?.venue || final?.venue;

  return (
    <View style={s.card}>
      <LinearGradient colors={["#171923", "#0E1016", "#08090C"]} start={{ x: 0, y: 0 }} end={{ x: 0.6, y: 1 }} style={s.inner}>
        {/* header */}
        <View style={s.headRow}>
          {showStage ? (
            <View style={s.livePill}>
              <Pulse min={0.35} period={1100}>
                <View style={[s.dot, { backgroundColor: SPOT }]} />
              </Pulse>
              <Txt size={11} font="sansExt" tracking={1.6} style={{ color: SPOT }}>LIVE STAGE</Txt>
            </View>
          ) : (
            <View style={[s.livePill, { backgroundColor: OK + "1F" }]}>
              <Check size={12} color={OK} strokeWidth={3} />
              <Txt size={11} font="sansExt" tracking={1.6} style={{ color: OK }}>FINAL LINEUP</Txt>
            </View>
          )}
          <View style={{ flex: 1 }} />
          {venue ? (
            <View style={s.venue}>
              <MapPin size={12} color={MUTED} />
              <Txt size={11.5} numberOfLines={1} style={{ color: MUTED, maxWidth: 150 }}>{venue}</Txt>
            </View>
          ) : null}
        </View>

        {showStage ? (
          <>
            {current ? (
              <Spotlight performer={current} onFor={since(current.started_at, now)} />
            ) : (
              <View style={s.idle}>
                <View style={s.idleIcon}>
                  <Mic size={20} color={MUTED} />
                </View>
                <Txt size={15} font="sansBold" style={{ color: "#fff" }}>The stage is being set</Txt>
                <Txt size={12.5} style={{ color: MUTED }}>The next contestant will be called shortly.</Txt>
              </View>
            )}

            {/* progress through the running order */}
            {total > 0 ? (
              <View style={{ marginTop: 16 }}>
                <View style={s.progressHead}>
                  <Txt size={12} font="sansSemi" style={{ color: "#fff" }}>
                    {done} of {total} performed
                  </Txt>
                  {present ? (
                    <Txt size={12} style={{ color: MUTED }}>{present} waiting backstage</Txt>
                  ) : null}
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${Math.min(100, Math.round((done / total) * 100))}%` }]} />
                </View>
              </View>
            ) : null}

            {mine ? <QueueNote tone={mine.tone} text={mine.text} /> : null}

            {previous ? (
              <View style={[s.row, { marginTop: 16 }]}>
                <Avatar name={performerName(previous)} photo={performerPhoto(previous)} size={32} />
                <View style={{ flex: 1 }}>
                  <Txt size={11} style={{ color: MUTED }}>Just performed</Txt>
                  <View style={s.nameLine}>
                    <Txt size={13.5} font="sansBold" numberOfLines={1} style={{ color: "#fff", flexShrink: 1 }}>
                      {performerName(previous)}
                    </Txt>
                    <VerifiedTick row={previous} size={12} />
                  </View>
                </View>
                <View style={[s.tag, { backgroundColor: OK + "1A" }]}>
                  <Check size={11} color={OK} strokeWidth={3} />
                  <Txt size={11} font="sansBold" style={{ color: OK }}>Done</Txt>
                </View>
              </View>
            ) : null}

            {upNext.length ? (
              <View style={{ marginTop: 16, gap: 8 }}>
                <Txt size={11} font="sansBold" tracking={1.6} style={{ color: MUTED }}>UP NEXT</Txt>
                {upNext.map((p, i) => {
                  const me = !!user?.email && email(p.user_email) === email(user.email);
                  return (
                    <View key={p.registration_id || p.user_email || i} style={[s.row, me && s.rowMine]}>
                      <View style={[s.num, i === 0 && { backgroundColor: SPOT }]}>
                        <Txt size={12} font="sansExt" style={{ color: i === 0 ? "#fff" : MUTED }}>{p.order ?? i + 1}</Txt>
                      </View>
                      <Avatar name={performerName(p)} photo={performerPhoto(p)} size={32} />
                      <View style={{ flex: 1 }}>
                        <View style={s.nameLine}>
                          <Txt size={13.5} font="sansBold" numberOfLines={1} style={{ color: "#fff", flexShrink: 1 }}>
                            {performerName(p)}
                            {me ? "  · You" : ""}
                          </Txt>
                          <VerifiedTick row={p} size={12} />
                        </View>
                        {p.category ? <Txt size={11} style={{ color: MUTED }}>{p.category}</Txt> : null}
                      </View>
                      {i === 0 ? (
                        <Txt size={11} font="sansBold" style={{ color: SPOT }}>Next</Txt>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            ) : null}

            {lineup.length ? (
              <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [s.cta, { opacity: pressed ? 0.8 : 1 }]}>
                <ListOrdered size={15} color="#fff" />
                <Txt size={13} font="sansBold" style={{ color: "#fff" }}>Full running order · {lineup.length}</Txt>
                <ChevronRight size={15} color="#fff" />
              </Pressable>
            ) : null}
          </>
        ) : (
          /* pre-show: the confirmed, checked-in lineup */
          <View style={{ marginTop: 16 }}>
            <Txt size={17} font="sansBold" style={{ color: "#fff" }}>
              {final?.present_count ?? finalRows.length} contestants checked in
            </Txt>
            <Txt size={12.5} style={{ color: MUTED, marginTop: 4 }}>
              {final?.total_registered ? `of ${final.total_registered} registered · ` : ""}performing in arrival order
            </Txt>
            <View style={s.stack}>
              {finalRows.slice(0, 6).map((p, i) => (
                <View key={p.registration_id || i} style={[s.stackItem, { marginLeft: i ? -10 : 0, zIndex: 10 - i }]}>
                  <Avatar name={performerName(p)} photo={performerPhoto(p)} size={36} />
                </View>
              ))}
              {finalRows.length > 6 ? (
                <View style={[s.stackItem, s.more, { marginLeft: -10 }]}>
                  <Txt size={11.5} font="sansExt" style={{ color: "#fff" }}>+{finalRows.length - 6}</Txt>
                </View>
              ) : null}
            </View>
            <Pressable onPress={() => setOpen(true)} style={({ pressed }) => [s.cta, { opacity: pressed ? 0.8 : 1 }]}>
              <Users size={15} color="#fff" />
              <Txt size={13} font="sansBold" style={{ color: "#fff" }}>See the lineup</Txt>
              <ChevronRight size={15} color="#fff" />
            </Pressable>
          </View>
        )}
      </LinearGradient>

      <LiveStageLineupModal
        visible={open}
        stageData={showStage ? stage : null}
        finalData={showStage ? null : final}
        competitionId={compId}
        compTitle={stage?.competition_title || final?.competition_title}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

function QueueNote({ tone, text }: { tone: "live" | "next" | "queue" | "wait" | "done"; text: string }) {
  const color = tone === "done" ? OK : tone === "wait" ? "#F5B544" : SPOT;
  const Icon = tone === "done" ? Check : tone === "wait" ? Clock : MapPin;
  return (
    <View style={[s.note, { borderColor: color + "40", backgroundColor: color + "14" }]}>
      <Icon size={15} color={color} />
      <View style={{ flex: 1 }}>
        <Txt size={11} font="sansBold" tracking={1.4} style={{ color }}>YOUR SPOT</Txt>
        <Txt size={13} font="sansSemi" lh={18} style={{ color: "#fff", marginTop: 2 }}>{text}</Txt>
      </View>
    </View>
  );
}

/** The performer under the spotlight — a soft beam breathes behind them. */
function Spotlight({ performer, onFor }: { performer: StagePerformer; onFor: string | null }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  const meta = [performer.stage_order ? `#${performer.stage_order} in order` : null, onFor ? `on stage ${onFor}` : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <View style={s.spot}>
      <Animated.View
        style={[
          s.beam,
          {
            opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.1, 0.26] }),
            transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.12] }) }],
          },
        ]}
      />
      <View style={s.spotRing}>
        <Avatar name={performerName(performer)} photo={performerPhoto(performer)} size={88} />
      </View>
      <Txt size={11} font="sansBold" tracking={1.6} style={{ color: SPOT, marginTop: 12 }}>NOW PERFORMING</Txt>
      <View style={[s.nameLine, { marginTop: 4, maxWidth: 280 }]}>
        <Txt size={20} font="display" tracking={-0.4} numberOfLines={2} align="center" style={{ color: "#fff", flexShrink: 1 }}>
          {performerName(performer)}
          {isVerified(performer) ? "\u00A0" : ""}
          {isVerified(performer) ? <InlineTick fontSize={20} size={16} /> : null}
        </Txt>
      </View>
      {performer.entry_title ? (
        <Txt size={13} numberOfLines={2} align="center" style={{ color: "rgba(255,255,255,0.78)", marginTop: 4, maxWidth: 280 }}>
          {performer.entry_title}
        </Txt>
      ) : null}
      {meta ? <Txt size={12} style={{ color: MUTED, marginTop: 6 }}>{meta}</Txt> : null}
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 24, overflow: "hidden", marginBottom: 16, borderWidth: 1, borderColor: FAINT },
  inner: { padding: 16 },
  headRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    height: 26,
    borderRadius: 999,
    backgroundColor: SPOT + "1F",
  },
  dot: { width: 7, height: 7, borderRadius: 999 },
  venue: { flexDirection: "row", alignItems: "center", gap: 4 },
  idle: { alignItems: "center", paddingVertical: 24, gap: 4 },
  idleIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    backgroundColor: FAINT,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  spot: { alignItems: "center", paddingTop: 20, paddingBottom: 4 },
  beam: { position: "absolute", top: 4, width: 156, height: 156, borderRadius: 999, backgroundColor: SPOT },
  spotRing: {
    borderWidth: 2.5,
    borderColor: SPOT,
    borderRadius: 999,
    padding: 3,
    shadowColor: SPOT,
    shadowOpacity: 0.7,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  progressHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  track: { height: 6, borderRadius: 999, backgroundColor: FAINT, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999, backgroundColor: SPOT },
  note: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, borderRadius: 16, borderWidth: 1, padding: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 8 },
  rowMine: { backgroundColor: SPOT + "14", borderWidth: 1, borderColor: SPOT + "40" },
  num: {
    width: 26,
    height: 26,
    borderRadius: 999,
    backgroundColor: FAINT,
    alignItems: "center",
    justifyContent: "center",
  },
  tag: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, height: 24, borderRadius: 999 },
  cta: {
    marginTop: 16,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.09)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  stack: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  stackItem: { borderRadius: 999, borderWidth: 2, borderColor: "#0E1016" },
  more: {
    width: 40,
    height: 40,
    backgroundColor: "#22252F",
    alignItems: "center",
    justifyContent: "center",
  },
});
