import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Check, ChevronRight, Trophy } from "lucide-react-native";
import { publicApi, safe, type RoundInfo } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt } from "@/components/ui";
import { Pulse } from "@/components/motion";

const LIVE = "#FF385C";
const DONE = "#22C55E";
const GOLD = "#F5C542";
const MUTED = "#8A90A6";

const status = (r: RoundInfo) => String(r.status || "").toUpperCase();
const shortDate = (d?: string | null) => {
  if (!d) return null;
  const t = new Date(d);
  return Number.isFinite(t.getTime()) ? t.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
};

/**
 * The competition's round progression (`/rounds`) as a vertical timeline:
 * which round is live, which are done, how many are in each and how many go
 * through. Tapping a round opens its standings. Hidden for single-round
 * competitions — there's no journey to show.
 */
export function RoundsJourney({ compId }: { compId: string }) {
  const router = useRouter();
  const q = useAsync(() => safe(publicApi.rounds(compId), null), [compId]);
  const rounds = q.data?.rounds ?? [];
  if (rounds.length < 2) return null;

  const done = rounds.filter((r) => status(r) === "COMPLETED").length;

  return (
    <View style={s.card}>
      <View style={s.head}>
        <View style={{ flex: 1 }}>
          <Txt size={11} font="sansBold" tracking={1.6} style={{ color: MUTED }}>ROAD TO THE FINAL</Txt>
          <Txt size={17} font="sansBold" style={{ color: "#fff", marginTop: 4 }}>
            {rounds.length} rounds · {done} completed
          </Txt>
        </View>
      </View>

      {rounds.map((r, i) => {
        const st = status(r);
        const live = st === "ACTIVE";
        const finished = st === "COMPLETED";
        const color = live ? LIVE : finished ? DONE : r.is_final_round ? GOLD : MUTED;
        const last = i === rounds.length - 1;
        const dates = [shortDate(r.start_date), shortDate(r.end_date)].filter(Boolean).join(" – ");
        const meta = [
          r.qualified_contestant_count != null ? `${r.qualified_contestant_count} contestants` : null,
          r.is_final_round ? "Final" : r.advancing_count ? `Top ${r.advancing_count} advance` : null,
          dates || null,
        ].filter(Boolean);

        return (
          <Pressable
            key={r.round_number}
            onPress={() =>
              router.push({
                pathname: "/(more)/leaderboard",
                params: { competition: compId, round: String(r.round_number) },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`${r.name || `Round ${r.round_number}`}, ${live ? "live" : finished ? "completed" : "upcoming"}`}
            style={({ pressed }) => [s.row, { opacity: pressed ? 0.8 : 1 }]}
          >
            {/* node + connector */}
            <View style={s.rail}>
              <View style={[s.node, { borderColor: color, backgroundColor: finished ? DONE : live ? LIVE + "22" : "transparent" }]}>
                {finished ? (
                  <Check size={13} color="#0B0C12" strokeWidth={3.2} />
                ) : live ? (
                  <Pulse min={0.35} period={1000}>
                    <View style={[s.dot, { backgroundColor: LIVE }]} />
                  </Pulse>
                ) : r.is_final_round ? (
                  <Trophy size={12} color={GOLD} />
                ) : (
                  <Txt size={11} font="sansExt" style={{ color: MUTED }}>{r.round_number}</Txt>
                )}
              </View>
              {!last ? <View style={[s.line, { backgroundColor: finished ? DONE + "66" : "rgba(255,255,255,0.1)" }]} /> : null}
            </View>

            {/* body */}
            <View style={[s.body, live && s.bodyLive, !last && { marginBottom: 12 }]}>
              <View style={{ flex: 1 }}>
                <View style={s.titleLine}>
                  <Txt size={14.5} font="sansBold" style={{ color: "#fff", flexShrink: 1 }}>
                    {r.name || `Round ${r.round_number}`}
                  </Txt>
                  {live ? (
                    <View style={s.liveTag}>
                      <Txt size={10} font="sansExt" tracking={1} style={{ color: "#fff" }}>LIVE</Txt>
                    </View>
                  ) : null}
                </View>
                {meta.length ? <Txt size={12} style={{ color: MUTED, marginTop: 3 }}>{meta.join(" · ")}</Txt> : null}
                {r.description ? (
                  <Txt size={12} lh={17} numberOfLines={2} style={{ color: "#C5CAD6", marginTop: 6 }}>{r.description}</Txt>
                ) : null}
              </View>
              <ChevronRight size={16} color={MUTED} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#11131A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  head: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  row: { flexDirection: "row", gap: 12 },
  rail: { width: 28, alignItems: "center" },
  node: {
    width: 28,
    height: 28,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  line: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1 },
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  bodyLive: { backgroundColor: LIVE + "12", borderColor: LIVE + "55" },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveTag: { paddingHorizontal: 6, height: 18, justifyContent: "center", borderRadius: 6, backgroundColor: LIVE },
});
