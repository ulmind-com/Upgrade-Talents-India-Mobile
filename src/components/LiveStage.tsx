import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Animated, Easing } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Radio, Mic, ListOrdered, MapPin } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { competeApi, publicCompetitionsApi, safe } from "@/lib/api";
import { Txt } from "@/components/ui";
import { Avatar } from "@/components/Avatar";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { Pulse } from "@/components/motion";
import { DiagonalStripes } from "@/components/patterns";

const STAGE = ["#2a0a1b", "#1a0a2e", "#0a0a1f"];
const SPOT = "#f0407e";

const email = (s: any) => String(s ?? "").toLowerCase().trim();
const pName = (p: any) => p?.participant_name || p?.user_name || p?.name || "Contestant";

/**
 * The live on-stage view for a running competition: who is performing right
 * now, the running order, and where the viewer sits in the queue. Polls while
 * mounted; renders nothing until there is an active performer or a lineup, so
 * it never leaves a dead section on a competition that isn't live.
 */
export function LiveStage({ compId, live }: { compId: string; live?: boolean }) {
  const { c } = useTheme();
  const { user } = useSession();
  const [stage, setStage] = useState<any | null>(null);

  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const d = user
        ? await safe(competeApi.liveStage(compId), null)
        : await safe(publicCompetitionsApi.liveStage(compId), null);
      if (alive && d) setStage(d);
    };
    pull();
    // A running stage changes by the minute — a light poll keeps it honest
    // without a socket (Expo Go has no persistent WS story here).
    const id = setInterval(pull, 12000);
    return () => { alive = false; clearInterval(id); };
  }, [compId, user?.email]);

  const lineup: any[] = Array.isArray(stage?.lineup) ? stage.lineup : [];
  const current = stage?.current_performer;
  const active = stage?.has_active_performer && current;

  const myQueue = useMemo(() => {
    if (!user?.email || !lineup.length) return null;
    const me = lineup.findIndex((p) => email(p.user_email) === email(user.email));
    if (me < 0) return null;
    const curEmail = email(current?.user_email);
    const curIdx = curEmail ? lineup.findIndex((p) => email(p.user_email) === curEmail) : -1;
    return { order: me + 1, total: lineup.length, ahead: curIdx >= 0 ? Math.max(0, me - curIdx) : null, onStage: me === curIdx };
  }, [user?.email, lineup, current]);

  if (!active && !(lineup.length && live)) return null;

  return (
    <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 16 }}>
      <LinearGradient colors={STAGE as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
        <DiagonalStripes color={SPOT} opacity={0.07} gap={20} w={6} />

        {/* header */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Pulse min={0.4} period={1100}><View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: SPOT }} /></Pulse>
          <Txt size={11} font="monoMed" tracking={2.5} uppercase style={{ color: SPOT }}>On stage now</Txt>
          <View style={{ flex: 1 }} />
          <Radio size={14} color={SPOT} />
        </View>

        {/* current performer — spotlit */}
        {active ? <Spotlight performer={current} /> : (
          <View style={{ alignItems: "center", paddingVertical: 18, gap: 6 }}>
            <Mic size={22} color="rgba(255,255,255,0.5)" />
            <Txt size={13.5} font="sansSemi" style={{ color: "#fff" }}>Next contestant being called</Txt>
            <Txt size={12} style={{ color: "rgba(255,255,255,0.6)" }} align="center">Hold tight — the stage is being set.</Txt>
          </View>
        )}

        {/* my queue position */}
        {myQueue ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: SPOT + "4d", padding: 12 }}>
            <MapPin size={15} color={SPOT} />
            <Txt size={12.5} lh={17} style={{ flex: 1, color: "#fff" }}>
              {myQueue.onStage ? "You're on stage — break a leg!"
                : myQueue.ahead === 0 ? "You're up next — head backstage."
                : myQueue.ahead != null ? `You're #${myQueue.order} of ${myQueue.total} — ${myQueue.ahead} ahead of you.`
                : `You're #${myQueue.order} of ${myQueue.total} in the running order.`}
            </Txt>
          </View>
        ) : null}

        {/* the lineup */}
        {lineup.length ? (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 }}>
              <ListOrdered size={13} color="rgba(255,255,255,0.7)" />
              <Txt size={10.5} font="monoMed" tracking={2} uppercase style={{ color: "rgba(255,255,255,0.7)" }}>Running order · {lineup.length}</Txt>
            </View>
            <View style={{ gap: 7 }}>
              {lineup.slice(0, 10).map((p, i) => {
                const onStage = email(p.user_email) === email(current?.user_email);
                const mine = user?.email && email(p.user_email) === email(user.email);
                return (
                  <View key={p.user_email || i} style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 8, backgroundColor: onStage ? SPOT + "26" : mine ? "rgba(255,255,255,0.09)" : "transparent", borderWidth: onStage ? 1 : 0, borderColor: SPOT + "66" }}>
                    <Txt size={12} font="display" style={{ width: 22, textAlign: "center", color: onStage ? SPOT : "rgba(255,255,255,0.55)" }}>{p.stage_order || i + 1}</Txt>
                    <Avatar name={pName(p)} photo={p.avatar || p.user_photo || p.profile_photo} size={30} />
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Txt size={13} font={onStage || mine ? "sansBold" : "sansMed"} numberOfLines={1} style={{ color: "#fff", flexShrink: 1 }}>
                        {pName(p)}{mine ? " (You)" : ""}
                      </Txt>
                      <VerifiedTick row={p} size={12} />
                    </View>
                    {onStage ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Pulse min={0.4} period={900}><View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: SPOT }} /></Pulse>
                        <Txt size={9.5} font="sansBold" style={{ color: SPOT, letterSpacing: 1 }}>LIVE</Txt>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}
      </LinearGradient>
    </View>
  );
}

/** The performer under the spotlight — a soft beam breathes behind them. */
function Spotlight({ performer }: { performer: any }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(a, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return (
    <View style={{ alignItems: "center", paddingVertical: 6 }}>
      <Animated.View style={{ position: "absolute", top: -6, width: 150, height: 150, borderRadius: 999, backgroundColor: SPOT, opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.12, 0.28] }), transform: [{ scale: a.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.15] }) }] }} />
      <View style={{ borderWidth: 2.5, borderColor: SPOT, borderRadius: 999, padding: 3, shadowColor: SPOT, shadowOpacity: 0.8, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }}>
        <Avatar name={pName(performer)} photo={performer.avatar || performer.user_photo || performer.profile_photo} size={84} />
      </View>
      <Txt size={10} font="monoMed" tracking={2} uppercase style={{ color: SPOT, marginTop: 10 }}>Order #{performer.stage_order || 1}</Txt>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 3, maxWidth: 260 }}>
        <Txt size={19} font="display" tracking={-0.5} numberOfLines={1} style={{ color: "#fff", flexShrink: 1 }}>{pName(performer)}</Txt>
        <VerifiedTick row={performer} size={16} />
      </View>
      {performer.entry_title ? <Txt size={12.5} numberOfLines={1} style={{ color: "rgba(255,255,255,0.7)", marginTop: 2, maxWidth: 260 }}>{performer.entry_title}</Txt> : null}
    </View>
  );
}
