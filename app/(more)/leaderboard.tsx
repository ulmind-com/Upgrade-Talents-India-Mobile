import React, { useEffect, useState } from "react";
import { View, Pressable, ScrollView } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Trophy, Medal, Crown, Heart } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Skeleton, EmptyState, Divider } from "@/components/ui";
import { VerifiedTick } from "@/components/VerifiedBadge";
import { AppImage } from "@/components/AppImage";
import { FadeInUp } from "@/components/FadeInUp";
import { DottedGrid } from "@/components/patterns";

const PODIUM = ["#ffd56b", "#cfd8e3", "#e8a87c"]; // gold / silver / bronze

export default function Leaderboard() {
  const { c } = useTheme();
  const comps = useAsync(() => safe(publicApi.competitions(), []), []);
  const list = toRows(comps.data);
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => { if (!sel && list.length) setSel(list[0]._id || list[0].id); }, [list.length]);

  const lb = useAsync(() => (sel ? safe(publicApi.leaderboard(sel), { leaderboard: [] } as any) : Promise.resolve({ leaderboard: [] } as any)), [sel]);
  const rows: any[] = (lb.data as any)?.leaderboard || toRows(lb.data);
  const top = rows.slice(0, 3);
  const rest = rows.slice(3);

  return (
    <SubScreen eyebrow="Who's winning" title="Leaderboard" refreshing={lb.refreshing} onRefresh={lb.refresh}>
      {/* Gold hero */}
      <FadeInUp>
        <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 18 }}>
          <LinearGradient colors={["#ffd56b", "#f0a000", "#c97a00"] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
            <DottedGrid color="rgba(255,255,255,0.3)" opacity={0.5} gap={18} />
            <Txt size={70} font="display" style={{ position: "absolute", top: -4, right: -4, color: "rgba(255,255,255,0.2)", letterSpacing: -3 }}>TOP</Txt>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center" }}>
              <Trophy size={22} color="#fff" />
            </View>
            <Txt size={25} font="display" tracking={-0.5} lh={28} style={{ color: "#fff", marginTop: 12 }}>Rankings live.{"\n"}Every vote counts.</Txt>
          </LinearGradient>
        </View>
      </FadeInUp>

      {/* Competition chips */}
      {list.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }} style={{ marginBottom: 18 }}>
          {list.map((cp: any) => {
            const id = cp._id || cp.id;
            const on = sel === id;
            return (
              <Pressable key={id} onPress={() => setSel(id)} style={{ paddingHorizontal: 14, height: 38, justifyContent: "center", borderRadius: 999, borderWidth: on ? 0 : 1, borderColor: c.border, backgroundColor: on ? "#f0a000" : c.surface }}>
                <Txt size={12.5} font="sansBold" style={{ color: on ? "#fff" : c.fgMuted }} numberOfLines={1}>{cp.title || cp.name}</Txt>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {lb.loading ? (
        <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={72} radius={18} />)}</View>
      ) : rows.length ? (
        <View style={{ gap: 14 }}>
          {/* Podium */}
          {top.map((r, i) => (
            <FadeInUp key={r.participant_id || r.email || i} delay={i * 70}>
              <View style={{ borderRadius: 22, overflow: "hidden", borderWidth: 2, borderColor: PODIUM[i] }}>
                <LinearGradient colors={[PODIUM[i] + "33", c.surface] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}>
                  <View style={{ width: 42, height: 42, borderRadius: 999, backgroundColor: PODIUM[i], alignItems: "center", justifyContent: "center" }}>
                    {i === 0 ? <Crown size={20} color="#7a5600" /> : <Medal size={19} color="#55606e" />}
                  </View>
                  <View style={{ width: 46, height: 46, borderRadius: 999, overflow: "hidden", backgroundColor: c.surface2 }}>
                    <AppImage uri={r.profile_photo} seed={i} style={{ width: "100%", height: "100%" }} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><Txt size={16} font="sansExt" numberOfLines={1} style={{ flexShrink: 1 }}>{r.name || "Participant"}</Txt><VerifiedTick row={r} size={14} /></View>
                    <Txt size={12} tone="subtle">{typeof r.final_score === "number" ? `Score ${r.final_score}` : `${(r.raw_audience_votes ?? r.audience_votes ?? 0)} votes`}</Txt>
                  </View>
                  <Txt size={28} font="display" style={{ color: PODIUM[i] }}>#{r.rank || i + 1}</Txt>
                </LinearGradient>
              </View>
            </FadeInUp>
          ))}

          {/* Rest */}
          {rest.length ? (
            <Card padding={0}>
              {rest.map((r, i) => (
                <View key={r.participant_id || r.email || i}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 13 }}>
                    <Txt size={15} font="display" tone="subtle" style={{ width: 28 }}>{r.rank || i + 4}</Txt>
                    <View style={{ width: 36, height: 36, borderRadius: 999, overflow: "hidden", backgroundColor: c.surface2 }}>
                      <AppImage uri={r.profile_photo} seed={i + 3} style={{ width: "100%", height: "100%" }} />
                    </View>
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 4 }}><Txt size={14.5} font="sansBold" numberOfLines={1} style={{ flexShrink: 1 }}>{r.name || "Participant"}</Txt><VerifiedTick row={r} size={13} /></View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Heart size={13} color={c.accent} />
                      <Txt size={12.5} font="sansBold">{typeof r.final_score === "number" ? r.final_score : (r.raw_audience_votes ?? r.audience_votes ?? 0)}</Txt>
                    </View>
                  </View>
                  {i < rest.length - 1 ? <Divider style={{ marginLeft: 13 }} /> : null}
                </View>
              ))}
            </Card>
          ) : null}
        </View>
      ) : (
        <EmptyState icon={<Trophy size={26} color={c.fgMuted} />} title="No rankings yet" subtitle="Scores appear once judging or voting starts." />
      )}
    </SubScreen>
  );
}
