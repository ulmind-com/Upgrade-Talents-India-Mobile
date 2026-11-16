import React, { useMemo, useState } from "react";
import { View, TextInput } from "react-native";
import { Search, BadgeCheck, RefreshCw, Ban, Users as UsersIcon, Trophy } from "lucide-react-native";
import { AdminShell } from "@/components/admin/Shell";
import { AAction, ACard, AEmpty, AGrid, AHatchBars, ALoading, APanel, AStatTile, ATabs, ATag, T } from "@/components/admin/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { badgesApi, safe, toRows, totalOf } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { formatEventDate, titleCase } from "@/lib/format";

type Tab = "awarded" | "insights";

export default function AdminBadges() {
  const { c } = useTheme();
  const alert = useAlert();
  const [tab, setTab] = useState<Tab>("awarded");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const list = useAsync(() => safe(badgesApi.list({ limit: 200 }), [] as any), []);
  const stats = useAsync(() => safe(badgesApi.analytics(), null as any), []);

  const rows = toRows(list.data);
  const total = totalOf(list.data, rows);
  const an = stats.data || {};

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((r: any) => [r.badge_name, r.name, r.user_name, r.user_email].some((v) => String(v || "").toLowerCase().includes(s)));
  }, [rows, q]);

  /* The analytics payload differs by deployment — read whichever shape came back. */
  const breakdown: { label: string; value: number }[] = (() => {
    const src = an.by_tier || an.tiers || an.by_badge || an.badges || an.breakdown;
    if (Array.isArray(src)) return src.map((x: any) => ({ label: titleCase(x.tier || x.name || x.label || "—"), value: Number(x.count ?? x.total ?? x.value ?? 0) }));
    if (src && typeof src === "object") return Object.entries(src).map(([k, v]) => ({ label: titleCase(k), value: Number(v) || 0 }));
    return [];
  })();

  const run = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); alert("success", "Done", ok); list.reload(); stats.reload(); }
    catch (e: any) { alert("error", "Action failed", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  return (
    <AdminShell  title="Badges" refreshing={list.refreshing} onRefresh={list.refresh}>
      <ATabs value={tab} onChange={setTab} tabs={[{ key: "awarded", label: "Awarded" }, { key: "insights", label: "Insights" }]} />

      {tab === "insights" ? (
        stats.loading ? (
          <ALoading rows={2} />
        ) : (
          <>
            <AGrid>
              <AStatTile label="Badges awarded" value={Number(an.total_awards ?? an.total ?? total ?? rows.length)} Icon={BadgeCheck} />
              <AStatTile label="Recipients" value={Number(an.unique_users ?? an.recipients ?? 0)} Icon={UsersIcon} tone={c.success} />
              <AStatTile label="Badge types" value={Number(an.badge_types ?? an.types ?? breakdown.length)} Icon={Trophy} wide />
            </AGrid>

            {breakdown.length ? (
              <APanel title="Breakdown" subtitle="How the awards are distributed.">
                <AHatchBars data={breakdown} />
              </APanel>
            ) : null}

            <APanel title="Maintenance" subtitle="Re-scan every account and award any badge that was earned but never issued.">
              <AAction
                label="Reconcile badges"
                hint="Safe to run at any time."
                cta="Run now"
                Icon={RefreshCw}
                busy={busy === "rec"}
                onPress={() => run("rec", () => badgesApi.reconcile(), "Reconciliation finished.")}
              />
            </APanel>
          </>
        )
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: c.bgElevated, borderRadius: 14, borderWidth: 1, borderColor: c.borderStrong, paddingHorizontal: 14, height: 46, marginBottom: 16 }}>
            <Search size={17} color={c.fgSubtle} />
            <TextInput value={q} onChangeText={setQ} placeholder="Search badge or recipient" placeholderTextColor={c.fgSubtle} style={{ flex: 1, color: c.fg, fontSize: 14.5 }} />
          </View>

          {list.loading ? (
            <ALoading />
          ) : !filtered.length ? (
            <AEmpty icon={<BadgeCheck size={26} color={c.fgMuted} />} title="No badges yet" subtitle="Badges appear here as members earn them." />
          ) : (
            <View style={{ gap: 12 }}>
              {filtered.map((r: any, i: number) => {
                const id = r._id || r.id || r.award_id;
                const revoked = r.is_revoked || r.status === "revoked";
                return (
                  <ACard key={id || i}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <T size={15} font="bold" numberOfLines={1}>{r.badge_name || r.name || r.title || "Badge"}</T>
                        <T size={12.5} mut numberOfLines={1} style={{ marginTop: 2 }}>{r.user_name || r.user_email || r.recipient_name || "—"}</T>
                      </View>
                      {revoked ? <ATag label="Revoked" tone="danger" /> : r.tier ? <ATag label={titleCase(r.tier)} tone="brand" /> : null}
                    </View>

                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
                      <View>
                        <T size={10} font="monoMed" sub track={1.5} upper>Awarded</T>
                        <T size={13} font="semi" style={{ marginTop: 1 }}>{formatEventDate(r.awarded_at || r.created_at)}</T>
                      </View>
                    </View>

                    {!revoked && id ? (
                      <AAction
                        label="Revoke badge"
                        hint="Removes it from the member's profile."
                        cta="Revoke"
                        tone="danger"
                        Icon={Ban}
                        busy={busy === id}
                        onPress={() => run(id, () => badgesApi.revoke(id), "Badge revoked.")}
                      />
                    ) : null}
                  </ACard>
                );
              })}
            </View>
          )}
        </>
      )}
    </AdminShell>
  );
}
