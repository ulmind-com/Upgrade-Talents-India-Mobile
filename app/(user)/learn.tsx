import React, { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { GraduationCap, Sparkles, BookOpen, Zap } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { publicApi, profileApi, safe } from "@/lib/api";
import { useSession } from "@/context/Session";
import { useTheme } from "@/theme/ThemeProvider";
import { useAsync } from "@/lib/useAsync";
import { CourseCard } from "@/components/domain";
import { Txt, Skeleton, EmptyState, ErrorState, SearchField } from "@/components/ui";
import { FadeInUp } from "@/components/FadeInUp";
import { DottedGrid } from "@/components/patterns";

export default function Learn() {
  const router = useRouter();
  const { c } = useTheme();
  const { user } = useSession();
  const [tab, setTab] = useState<"courses" | "workshops">("courses");
  const [q, setQ] = useState("");

  const courses = useAsync(() => publicApi.courses({ limit: 50 }), []);
  const workshops = useAsync(() => publicApi.workshops({ limit: 50 }), []);
  const active = tab === "courses" ? courses : workshops;

  const mine = useAsync(
    () => (user ? safe(profileApi.dashboard(), null as any) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );

  const enrolledIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of (mine.data?.my_courses || []) as any[]) {
      if (r.status !== "CANCELLED") set.add(String(r.activity_id));
    }
    return set;
  }, [mine.data]);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const rows = (active.data || []) as any[];
    if (!s) return rows;
    return rows.filter((it) =>
      [it.title, it.name, it.instructor, it.instructor_name, it.level, it.category]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(s))
    );
  }, [active.data, q]);

  return (
    <Screen refreshing={active.refreshing} onRefresh={active.refresh}>
      {/* Hero — District Gen-Z */}
      <FadeInUp>
        <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 18, marginTop: 4 }}>
          <LinearGradient colors={["#7C3AED", "#FF385C", "#08090C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
            <DottedGrid color="rgba(255,255,255,0.22)" opacity={0.5} gap={18} />
            <Txt size={70} font="display" style={{ position: "absolute", top: -4, right: -4, color: "rgba(255,255,255,0.14)", letterSpacing: -3 }}>LEARN</Txt>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
              <Sparkles size={14} color="#C9F24A" />
              <Txt size={10.5} font="monoMed" tracking={2.5} uppercase style={{ color: "#C9F24A" }}>Upgrade yourself</Txt>
            </View>
            <Txt size={25} font="display" tracking={-0.5} lh={28} style={{ color: "#fff", marginTop: 12 }}>Academy &{"\n"}workshops.</Txt>
            <Txt size={13} lh={19} style={{ color: "rgba(255,255,255,0.9)", marginTop: 8, maxWidth: 250 }}>
              Masterclasses from world-class choreographers.
            </Txt>
          </LinearGradient>
        </View>
      </FadeInUp>

      {/* Search */}
      <View style={{ marginBottom: 14 }}>
        <SearchField value={q} onChangeText={setQ} placeholder="Search courses & workshops" />
      </View>

      {/* Segmented toggle */}
      <View style={{ flexDirection: "row", backgroundColor: c.surface, borderRadius: 999, padding: 4, borderWidth: 1, borderColor: c.border, marginBottom: 18 }}>
        {([["courses", BookOpen], ["workshops", Zap]] as const).map(([t, Icon]) => {
          const on = tab === t;
          return (
            <Pressable key={t} onPress={() => { Haptics.selectionAsync().catch(() => {}); setTab(t); }} style={{ flex: 1 }}>
              {on ? (
                <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 40, borderRadius: 999 }}>
                  <Icon size={15} color={c.onAccent} />
                  <Txt size={13} font="sansBold" style={{ color: c.onAccent, textTransform: "capitalize" }}>{t}</Txt>
                </LinearGradient>
              ) : (
                <View style={{ flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center", height: 40 }}>
                  <Icon size={15} color={c.fgMuted} />
                  <Txt size={13} font="sansSemi" tone="muted" style={{ textTransform: "capitalize" }}>{t}</Txt>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      {/* Cards */}
      {active.loading ? (
        <View style={{ gap: 14 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={220} radius={22} />)}</View>
      ) : active.error && !active.data?.length ? (
        <ErrorState message={active.error} onRetry={active.reload} />
      ) : list.length ? (
        <View style={{ gap: 16 }}>
          {list.map((it, i) => (
            <FadeInUp key={it._id || i} delay={Math.min(i, 6) * 50}>
              <CourseCard
                item={it}
                index={i}
                enrolled={enrolledIds.has(String(it._id))}
                onPress={() => router.push(`/(more)/learn/${it._id}?kind=${tab === "workshops" ? "workshop" : "course"}`)}
              />
            </FadeInUp>
          ))}
        </View>
      ) : q ? (
        <EmptyState icon={<GraduationCap size={28} color={c.fgMuted} />} title={`No ${tab} match "${q}"`} subtitle="Try a different search." />
      ) : (
        <EmptyState icon={<GraduationCap size={28} color={c.fgMuted} />} title={`No ${tab} available right now`} subtitle="New masterclasses and programmes are added every season." />
      )}
    </Screen>
  );
}
