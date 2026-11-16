import React, { useState } from "react";
import { useRouter } from "expo-router";
import { View, Pressable } from "react-native";
import { GraduationCap } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { publicApi, profileApi, safe } from "@/lib/api";
import { useSession } from "@/context/Session";
import { useAsync } from "@/lib/useAsync";
import { PageHeader, CourseCard } from "@/components/domain";
import { LinearGradient } from "expo-linear-gradient";
import { Sparkles } from "lucide-react-native";
import { Txt, Skeleton, EmptyState, ErrorState, Glow } from "@/components/ui";
import { FadeInUp } from "@/components/FadeInUp";
import { DiagonalStripes } from "@/components/patterns";

export default function Learn() {
  const { c, fonts } = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const [tab, setTab] = useState<"courses" | "workshops">("courses");
  const courses = useAsync(() => publicApi.courses({ limit: 50 }), []);
  const workshops = useAsync(() => publicApi.workshops({ limit: 50 }), []);
  const active = tab === "courses" ? courses : workshops;

  // Which programmes the member is already in, so cards can flag them.
  const mine = useAsync(
    () => (user ? safe(profileApi.dashboard(), null as any) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );
  const enrolledIds = React.useMemo(() => {
    const set = new Set<string>();
    for (const r of (mine.data?.my_courses || []) as any[]) {
      if (r.status !== "CANCELLED") set.add(String(r.activity_id));
    }
    return set;
  }, [mine.data]);

  return (
    <Screen refreshing={active.refreshing} onRefresh={active.refresh} contentStyle={{ paddingTop: 10 }}>
      {/* Striped gradient hero band (unique to Learn) */}
      <View style={{ borderRadius: 26, overflow: "hidden", marginBottom: 20, marginTop: 4 }}>
        <LinearGradient colors={[c.theaterPink, c.theaterDeep] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22 }}>
          <DiagonalStripes color="rgba(255,255,255,0.08)" />
          <Glow color={c.stageBloom} size={170} top={10} right={-60} />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
            <Sparkles size={15} color="#fff" />
            <Txt size={11} font="monoMed" tracking={3} uppercase style={{ color: "rgba(255,255,255,0.9)" }}>Level up</Txt>
          </View>
          <Txt size={30} font="display" lh={32} tracking={-0.5} style={{ color: "#fff", marginTop: 12 }}>Learn from the{"\n"}best on the floor</Txt>
          <Txt size={13.5} lh={20} style={{ color: "rgba(255,255,255,0.82)", marginTop: 10, maxWidth: 300 }}>Courses & workshops from world-class choreographers.</Txt>
        </LinearGradient>
      </View>

      {/* Segmented */}
      <View style={{ flexDirection: "row", backgroundColor: c.surface, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: c.border, marginBottom: 20 }}>
        {(["courses", "workshops"] as const).map((t) => {
          const on = tab === t;
          return (
            <Pressable key={t} onPress={() => setTab(t)} style={{ flex: 1, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: on ? c.accent : "transparent" }}>
              <Txt size={13.5} font="sansBold" style={{ color: on ? c.onAccent : c.fgMuted, textTransform: "capitalize" }}>{t}</Txt>
            </Pressable>
          );
        })}
      </View>

      {active.loading ? (
        <View style={{ gap: 12 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={110} radius={24} />)}</View>
      ) : active.error && !active.data?.length ? (
        <ErrorState message={active.error} onRetry={active.reload} />
      ) : active.data?.length ? (
        <View style={{ gap: 12 }}>
          {active.data.map((it, i) => (
            <FadeInUp key={it._id} delay={Math.min(i, 8) * 55}>
              <CourseCard item={it} index={i} enrolled={enrolledIds.has(String(it._id))} onPress={() => router.push(`/(more)/learn/${it._id}?kind=${tab === "workshops" ? "workshop" : "course"}`)} />
            </FadeInUp>
          ))}
        </View>
      ) : (
        <EmptyState icon={<GraduationCap size={28} color={c.fgMuted} />} title={`No ${tab} yet`} subtitle="New programmes are added every season." />
      )}
    </Screen>
  );
}
