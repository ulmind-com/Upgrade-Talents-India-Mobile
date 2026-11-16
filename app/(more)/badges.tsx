import React from "react";
import { View } from "react-native";
import { Award, Sparkles, Coins } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { extrasApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Badge, Skeleton, EmptyState } from "@/components/ui";
import { FadeInUp } from "@/components/FadeInUp";
import { formatEventDate, titleCase } from "@/lib/format";
import { genz } from "@/theme/tokens";

/** Achievements the member has earned across the platform. */
export default function MyBadges() {
  const { c } = useTheme();
  const { user } = useSession();

  const q = useAsync(
    () => (user ? safe(extrasApi.myBadges(), null as any) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );

  const rows: any[] = q.data?.badges || q.data?.items || [];

  if (!user) {
    return (
      <SubScreen eyebrow="Achievements" title="My badges">
        <EmptyState icon={<Award size={26} color={c.fgMuted} />} title="Sign in to see your badges" subtitle="Badges are earned on your account." />
      </SubScreen>
    );
  }

  return (
    <SubScreen eyebrow="Achievements" title="My badges" refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? (
        <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={92} radius={20} />)}</View>
      ) : !rows.length ? (
        <EmptyState
          icon={<Sparkles size={26} color={c.fgMuted} />}
          title="No badges yet"
          subtitle="Book events, finish courses and enter competitions — badges land here automatically."
        />
      ) : (
        <>
          <Txt size={13} tone="muted" lh={19} style={{ marginBottom: 16 }}>
            {rows.length} earned{q.data?.total && q.data.total !== rows.length ? ` of ${q.data.total}` : ""}.
          </Txt>
          <View style={{ gap: 12 }}>
            {rows.map((b, i) => {
              const [g0, g1] = genz(i);
              const revoked = b.is_revoked || b.status === "REVOKED";
              return (
                <FadeInUp key={b._id || b.award_id || i} delay={i * 50}>
                  <Card style={{ flexDirection: "row", alignItems: "center", gap: 14, opacity: revoked ? 0.55 : 1 }}>
                    <View style={{ width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: g1 + "22", borderWidth: 1, borderColor: g0 + "55" }}>
                      <Award size={24} color={g1} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt size={15.5} font="sansBold" numberOfLines={1}>{b.badge_name || b.name || b.title || "Badge"}</Txt>
                      {b.description ? <Txt size={12.5} tone="muted" lh={18} numberOfLines={2} style={{ marginTop: 2 }}>{b.description}</Txt> : null}
                      <Txt size={11} font="monoMed" tone="subtle" tracking={1.2} uppercase style={{ marginTop: 6 }}>
                        {formatEventDate(b.awarded_at || b.created_at)}
                      </Txt>
                    </View>
                    {revoked ? <Badge label="Revoked" tone="danger" /> : b.tier ? <Badge label={titleCase(b.tier)} tone="brand" /> : null}
                  </Card>
                </FadeInUp>
              );
            })}
          </View>
        </>
      )}
    </SubScreen>
  );
}
