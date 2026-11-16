import React, { useEffect, useRef } from "react";
import { View, Pressable, ScrollView, Animated, Easing, Dimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Vote, Radio, Trophy, ArrowUpRight, Timer } from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { Txt } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { DiagonalStripes, TextTicker } from "@/components/patterns";
import { Pulse } from "@/components/motion";
import { countdownParts } from "@/lib/format";
import { compId, type CompRow } from "@/lib/competition";

const SCREEN_W = Dimensions.get("window").width;

/* The poll runs acid-green into cyan — nothing else in the app uses this pair,
   so "voting is open right now" is its own colour and never reads as a
   generic promo card. */
const ACID = "#c6ff3d";
const CYAN = "#38bdf8";
const INK = ["#07140f", "#0a1f1a", "#06131f"];

/** Five bars reacting to the count coming in. */
function Meter({ color = ACID, bars = 5, h = 18 }: { color?: string; bars?: number; h?: number }) {
  const vals = useRef(Array.from({ length: bars }, () => new Animated.Value(0.25))).current;
  useEffect(() => {
    const loops = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 320 + i * 90, delay: i * 70, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.25, duration: 320 + i * 90, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, []);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: h }}>
      {vals.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3, height: h, borderRadius: 2, backgroundColor: color,
            transform: [{ scaleY: v }, { translateY: 0 }],
          }}
        />
      ))}
    </View>
  );
}

/** A broadcast beam crossing the card — the signal is on air. */
function Beam({ w, h }: { w: number; h: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(a, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.delay(900),
        Animated.timing(a, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: "absolute", left: 0, right: 0, height: 150, opacity: 0.5,
        transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [-150, h] }) }],
      }}
    >
      <LinearGradient
        colors={["transparent", ACID + "38", "transparent"]}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
        style={{ flex: 1 }}
      />
    </Animated.View>
  );
}

function Countdown({ to }: { to: string }) {
  const [, tick] = React.useReducer((n: number) => n + 1, 0);
  useEffect(() => {
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const p = countdownParts(to);
  if (!p || p.done) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 999, borderWidth: 1, borderColor: ACID + "55", backgroundColor: "rgba(0,0,0,0.42)", paddingHorizontal: 10, paddingVertical: 5 }}>
      <Timer size={12} color={ACID} />
      <Txt size={11.5} font="monoMed" tracking={1} style={{ color: ACID }}>
        {p.days ? `${p.days}d ` : ""}{pad(p.hours)}:{pad(p.minutes)}:{pad(p.seconds)} left
      </Txt>
    </View>
  );
}

/**
 * One competition whose poll is open right now.
 *
 * `compact` is the home-screen size; the full size is what tops the
 * competitions screen.
 */
export function LiveVoteCard({ comp, width, compact, onPress }: { comp: CompRow; width: number; compact?: boolean; onPress: () => void }) {
  const H = compact ? 230 : 268;
  const votes = Number(comp.total_votes ?? comp.vote_count ?? comp.votes ?? 0);
  const entries = Number(comp.contestant_count ?? comp.submission_count ?? comp.participant_count ?? 0);
  const endsAt = comp.voting_ends_at || comp.voting_end_date || comp.voting_deadline;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ width, height: H, borderRadius: 28, overflow: "hidden", shadowColor: ACID, shadowOpacity: 0.4, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 12 }}>
        <LinearGradient colors={INK as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
        <AppImage uri={comp.image_url || comp.banner_url} seed={compId(comp)} style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.3 }} />
        <LinearGradient colors={["rgba(4,12,10,0.25)", "rgba(4,12,10,0.86)"] as any} style={{ position: "absolute", width: "100%", height: "100%" }} />
        <DiagonalStripes color={ACID} opacity={0.08} gap={22} w={6} />
        <Beam w={width} h={H} />

        {/* a live wire along the top edge */}
        <LinearGradient colors={[ACID, CYAN, ACID] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3 }} />

        <View style={{ flex: 1, padding: 18, justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 999, borderWidth: 1, borderColor: ACID + "66", backgroundColor: "rgba(0,0,0,0.5)", paddingHorizontal: 10, paddingVertical: 5 }}>
              <Pulse min={0.4} period={1100}>
                <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: ACID }} />
              </Pulse>
              <Txt size={9.5} font="sansBold" tracking={1.6} style={{ color: ACID }}>VOTING LIVE</Txt>
            </View>
            <Meter />
          </View>

          <View>
            {comp.category ? (
              <Txt size={10} font="monoMed" tracking={2.2} uppercase style={{ color: CYAN, marginBottom: 6 }}>{String(comp.category)}</Txt>
            ) : null}
            <Txt size={compact ? 22 : 25} font="display" tracking={-0.7} lh={compact ? 25 : 28} numberOfLines={2} style={{ color: "#fff" }}>
              {comp.title || comp.name || "Live poll"}
            </Txt>

            <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 10 }}>
              {endsAt ? <Countdown to={String(endsAt)} /> : null}
              {comp.prize ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Trophy size={11} color="#ffd166" />
                  <Txt size={11} font="sansExt" style={{ color: "#ffd166" }}>{String(comp.prize)}</Txt>
                </View>
              ) : null}
              {votes > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Vote size={11} color="#fff" />
                  <Txt size={11} font="sansSemi" style={{ color: "#fff" }}>{votes.toLocaleString("en-IN")} votes</Txt>
                </View>
              ) : null}
              {entries > 0 ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 5 }}>
                  <Radio size={11} color="#fff" />
                  <Txt size={11} font="sansSemi" style={{ color: "#fff" }}>{entries} in the running</Txt>
                </View>
              ) : null}
            </View>
          </View>

          <Pressable onPress={onPress}>
            <LinearGradient colors={[ACID, "#7ee787", CYAN] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ height: 46, borderRadius: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Vote size={17} color="#06241a" />
              <Txt size={14} font="sansBold" tracking={0.3} style={{ color: "#06241a" }}>Cast your vote</Txt>
              <ArrowUpRight size={16} color="#06241a" />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/**
 * The live-voting shelf. Renders nothing at all when no poll is open, so it
 * never leaves an empty heading behind.
 */
export function LiveVotingBand({
  rows, onOpen, compact, title = "The floor is open",
}: {
  rows: CompRow[];
  onOpen: (id: string) => void;
  compact?: boolean;
  title?: string;
}) {
  const { c } = useTheme();
  if (!rows?.length) return null;
  const one = rows.length === 1;
  const CW = one ? SCREEN_W - 40 : SCREEN_W - 68;

  return (
    <View style={{ marginTop: compact ? 30 : 0, marginBottom: compact ? 0 : 22 }}>
      <View style={{ paddingHorizontal: compact ? 20 : 0, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
          <Pulse min={0.45} period={1200}>
            <View style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: ACID }} />
          </Pulse>
          <Txt size={11} font="monoMed" tracking={2.5} uppercase style={{ color: ACID }}>
            Voting live{rows.length > 1 ? ` · ${rows.length}` : ""}
          </Txt>
        </View>
        <Txt size={23} font="display" tracking={-0.5} style={{ marginTop: 8 }}>{title}</Txt>
        <Txt size={13} tone="muted" lh={19} style={{ marginTop: 4 }}>
          Your vote counts right now — polls close soon.
        </Txt>
      </View>

      {/* a running wire under the heading */}
      <View style={{ height: 22, marginHorizontal: compact ? 20 : 0, marginBottom: 10, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(198,255,61,0.1)", justifyContent: "center" }}>
        <TextTicker text="VOTE NOW" color={ACID} size={9.5} font="monoMed" gap={16} speed={30} />
      </View>

      {one ? (
        <View style={{ paddingHorizontal: compact ? 20 : 0 }}>
          <LiveVoteCard comp={rows[0]} width={compact ? SCREEN_W - 40 : CW} compact={compact} onPress={() => onOpen(compId(rows[0]))} />
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={CW + 12}
          decelerationRate="fast"
          contentContainerStyle={{ paddingHorizontal: compact ? 20 : 0, gap: 12 }}
        >
          {rows.map((r) => (
            <LiveVoteCard key={compId(r)} comp={r} width={CW} compact={compact} onPress={() => onOpen(compId(r))} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
