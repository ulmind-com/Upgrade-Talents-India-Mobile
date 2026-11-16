import React, { useState } from "react";
import { useRouter } from "expo-router";
import { View, Pressable } from "react-native";
import * as Haptics from "expo-haptics";
import { GraduationCap, ChevronRight, Sparkles } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { publicApi, profileApi, safe } from "@/lib/api";
import { useSession } from "@/context/Session";
import { useAsync } from "@/lib/useAsync";
import { CourseCard } from "@/components/domain";
import { Txt, Skeleton, EmptyState, ErrorState } from "@/components/ui";
import { FadeInUp } from "@/components/FadeInUp";

export default function Learn() {
  const router = useRouter();
  const { user } = useSession();
  const [tab, setTab] = useState<"courses" | "workshops">("courses");
  const courses = useAsync(() => publicApi.courses({ limit: 50 }), []);
  const workshops = useAsync(() => publicApi.workshops({ limit: 50 }), []);
  const active = tab === "courses" ? courses : workshops;

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
    <Screen refreshing={active.refreshing} onRefresh={active.refresh}>
      {/* District Section Header */}
      <View style={{ paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Txt size={22} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.4 }}>
            Academy & Workshops
          </Txt>
          <ChevronRight size={18} color="#ffffff" strokeWidth={2.4} />
        </View>
        <Txt size={13} style={{ color: "#9ea3b8" }}>
          Level up with masterclasses from world-class choreographers
        </Txt>
      </View>

      {/* District Segmented Pill Toggle */}
      <View
        style={{
          flexDirection: "row",
          backgroundColor: "#14161E",
          borderRadius: 999,
          padding: 4,
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.1)",
          marginBottom: 18,
        }}
      >
        {(["courses", "workshops"] as const).map((t) => {
          const on = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setTab(t);
              }}
              style={{
                flex: 1,
                height: 40,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: on ? "#FF385C" : "transparent",
              }}
            >
              <Txt
                size={13}
                font="sansBold"
                style={{
                  color: on ? "#ffffff" : "#9ea3b8",
                  textTransform: "capitalize",
                }}
              >
                {t}
              </Txt>
            </Pressable>
          );
        })}
      </View>

      {/* Cards List */}
      {active.loading ? (
        <View style={{ gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} h={220} radius={22} />
          ))}
        </View>
      ) : active.error && !active.data?.length ? (
        <ErrorState message={active.error} onRetry={active.reload} />
      ) : active.data?.length ? (
        <View style={{ gap: 16 }}>
          {active.data.map((it, i) => (
            <FadeInUp key={it._id} delay={Math.min(i, 6) * 50}>
              <CourseCard
                item={it}
                index={i}
                enrolled={enrolledIds.has(String(it._id))}
                onPress={() =>
                  router.push(
                    `/(more)/learn/${it._id}?kind=${tab === "workshops" ? "workshop" : "course"}`
                  )
                }
              />
            </FadeInUp>
          ))}
        </View>
      ) : (
        <EmptyState
          icon={<GraduationCap size={28} color="#6b728a" />}
          title={`No ${tab} available right now`}
          subtitle="New masterclasses and programmes are added every season."
        />
      )}
    </Screen>
  );
}
