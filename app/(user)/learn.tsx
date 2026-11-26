import React, { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { View, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { GraduationCap, Sparkles, BookOpen, Zap } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { PromoHeroBanner } from "@/components/PromoHeroBanner";
import { publicApi, profileApi, safe } from "@/lib/api";
import { useSession } from "@/context/Session";
import { useTheme } from "@/theme/ThemeProvider";
import { useAsync } from "@/lib/useAsync";
import { CourseCard } from "@/components/domain";
import { Txt, Skeleton, EmptyState, ErrorState, SearchField } from "@/components/ui";
import { FadeInUp } from "@/components/FadeInUp";

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
    <SubScreen
      eyebrow="Upgrade yourself"
      title="Academy"
      refreshing={active.refreshing}
      onRefresh={active.refresh}
    >
      {/* 3D Character Promo Banner — Zomato District Style */}
      <FadeInUp>
        <PromoHeroBanner
          tag="Upgrade Academy"
          title="Learn from the Masters"
          subtitle="World-class choreography & training workshops"
          characterSource={require("../../assets/banners/3d_academy_char.png")}
          glowColor="rgba(0, 245, 212, 0.16)"
        />
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
    </SubScreen>
  );
}
