import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Gift, Users as UsersIcon, TrendingUp, Save, Zap, ArrowDownUp } from "lucide-react-native";
import { AdminShell } from "@/components/admin/Shell";
import { AAction, AButton, ACard, AEmpty, AGrid, AHatchBars, ALoading, ANum, APanel, ARecord, AStatTile, ATabs, ATag, AToggleRow, T } from "@/components/admin/ui";
import { useTheme } from "@/theme/ThemeProvider";
import { rewardsApi, safe, toRows } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useAlert } from "@/components/Popup";
import { formatEventDate, titleCase } from "@/lib/format";

type Tab = "overview" | "referrals" | "ledger" | "config";

export default function AdminRewards() {
  const { c } = useTheme();
  const [tab, setTab] = useState<Tab>("overview");

  const analytics = useAsync(() => safe(rewardsApi.analytics(), null as any), []);
  const referrals = useAsync(() => safe(rewardsApi.referrals({ limit: 200 }), [] as any), []);
  const txns = useAsync(() => safe(rewardsApi.transactions({ limit: 200 }), [] as any), []);

  const an = analytics.data || {};
  const refRows = toRows(referrals.data);
  const txRows = toRows(txns.data);

  const breakdown: { label: string; value: number }[] = (() => {
    const src = an.by_source || an.sources || an.by_type || an.breakdown;
    if (Array.isArray(src)) return src.map((x: any) => ({ label: titleCase(x.source || x.type || x.label || "—"), value: Number(x.count ?? x.total ?? 0) }));
    if (src && typeof src === "object") return Object.entries(src).map(([k, v]) => ({ label: titleCase(k), value: Number(v) || 0 }));
    return [];
  })();

  const active = tab === "referrals" ? referrals : tab === "ledger" ? txns : analytics;

  return (
    <AdminShell  title="Rewards & Referrals" refreshing={active.refreshing} onRefresh={active.refresh}>
      <ATabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "referrals", label: "Referrals" },
          { key: "ledger", label: "Ledger" },
          { key: "config", label: "Settings" },
        ]}
      />

      {tab === "overview" ? (
        analytics.loading ? <ALoading rows={2} /> : (
          <>
            <AGrid>
              <AStatTile label="Referrals" value={Number(an.total_referrals ?? refRows.length)} Icon={UsersIcon} />
              <AStatTile label="Converted" value={Number(an.successful_referrals ?? an.converted ?? 0)} Icon={TrendingUp} tone={c.success} />
              <AStatTile label="Points issued" value={Number(an.total_points_issued ?? an.points_issued ?? 0)} Icon={Gift} />
              <AStatTile label="Points redeemed" value={Number(an.total_points_redeemed ?? an.points_redeemed ?? 0)} Icon={ArrowDownUp} />
            </AGrid>
            {breakdown.length ? <APanel title="Where points come from"><AHatchBars data={breakdown} /></APanel> : null}
          </>
        )
      ) : tab === "referrals" ? (
        referrals.loading ? <ALoading /> : !refRows.length ? (
          <AEmpty icon={<UsersIcon size={26} color={c.fgMuted} />} title="No referrals yet" subtitle="They appear once members start inviting." />
        ) : (
          <View style={{ gap: 12 }}>
            {refRows.map((r: any, i: number) => (
              <ARecord
                key={r._id || i}
                title={r.referrer_name || r.referrer_email || "Member"}
                subtitle={`Invited ${r.referred_name || r.referred_email || "someone"}`}
                right={<ATag label={titleCase(r.status) || "Pending"} tone={r.status === "COMPLETED" || r.status === "SUCCESS" ? "success" : "warning"} />}
                meta={[
                  { label: "Points", value: String(r.points_awarded ?? r.points ?? 0) },
                  { label: "When", value: formatEventDate(r.created_at) },
                ]}
              />
            ))}
          </View>
        )
      ) : tab === "ledger" ? (
        txns.loading ? <ALoading /> : !txRows.length ? (
          <AEmpty icon={<Gift size={26} color={c.fgMuted} />} title="No transactions yet" />
        ) : (
          <View style={{ gap: 12 }}>
            {txRows.map((t: any, i: number) => {
              const pts = Number(t.points ?? t.amount ?? 0);
              const credit = pts >= 0 && t.type !== "REDEEM" && t.type !== "DEBIT";
              return (
                <ACard key={t._id || i}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <T size={14} font="bold" numberOfLines={1}>{t.user_name || t.user_email || "Member"}</T>
                      <T size={12} mut numberOfLines={1} style={{ marginTop: 2 }}>{titleCase(t.reason || t.type || t.source) || "Adjustment"} · {formatEventDate(t.created_at)}</T>
                    </View>
                    <T size={16} font="extra" style={{ color: credit ? c.success : c.danger }}>
                      {credit ? "+" : ""}{pts}
                    </T>
                  </View>
                </ACard>
              );
            })}
          </View>
        )
      ) : (
        <ConfigTab />
      )}
    </AdminShell>
  );
}

/* ── The three config blocks the web admin exposes, as editable panels ── */
function ConfigTab() {
  const alert = useAlert();
  const [busy, setBusy] = useState<string | null>(null);

  const referral = useAsync(() => safe(rewardsApi.referralConfig(), null as any), []);
  const rewards = useAsync(() => safe(rewardsApi.rewardsConfig(), null as any), []);
  const expiry = useAsync(() => safe(rewardsApi.expiryConfig(), null as any), []);

  const [ref, setRef] = useState<any>({});
  const [rew, setRew] = useState<any>({});
  const [exp, setExp] = useState<any>({});

  useEffect(() => { if (referral.data) setRef({ ...referral.data }); }, [referral.data]);
  useEffect(() => { if (rewards.data) setRew({ ...rewards.data }); }, [rewards.data]);
  useEffect(() => { if (expiry.data) setExp({ ...expiry.data }); }, [expiry.data]);

  const save = async (key: string, fn: () => Promise<any>, ok: string) => {
    setBusy(key);
    try { await fn(); alert("success", "Saved", ok); }
    catch (e: any) { alert("error", "Couldn't save", e?.message || "Please try again."); }
    finally { setBusy(null); }
  };

  const num = (v: any) => (v === "" || v == null ? 0 : Number(v) || 0);

  if (referral.loading || rewards.loading || expiry.loading) return <ALoading rows={3} />;

  return (
    <>
      <APanel
        title="Referrals"
        subtitle="What a member earns when someone joins with their code."
        action={<AButton label="Save" size="sm" loading={busy === "ref"} icon={<Save size={13} color="#fff" />} onPress={() => save("ref", () => rewardsApi.updateReferralConfig({ ...ref, referrer_points: num(ref.referrer_points), referee_points: num(ref.referee_points), min_purchase_amount: num(ref.min_purchase_amount) }), "Referral settings updated.")} />}
      >
        <AToggleRow label="Referrals enabled" value={!!ref.is_enabled} onChange={(v) => setRef((s: any) => ({ ...s, is_enabled: v }))} />
        <ANum label="Points to the referrer" value={ref.referrer_points} onChange={(v) => setRef((s: any) => ({ ...s, referrer_points: v }))} suffix="pts" />
        <ANum label="Points to the new member" value={ref.referee_points} onChange={(v) => setRef((s: any) => ({ ...s, referee_points: v }))} suffix="pts" />
        <ANum label="Minimum purchase to qualify" value={ref.min_purchase_amount} onChange={(v) => setRef((s: any) => ({ ...s, min_purchase_amount: v }))} suffix="₹" />
      </APanel>

      <APanel
        title="Earning & redemption"
        subtitle="How points are earned on spend and what they are worth."
        action={<AButton label="Save" size="sm" loading={busy === "rew"} icon={<Save size={13} color="#fff" />} onPress={() => save("rew", () => rewardsApi.updateRewardsConfig({ ...rew, points_per_rupee: num(rew.points_per_rupee), redemption_rate: num(rew.redemption_rate), min_redemption_points: num(rew.min_redemption_points), max_redemption_percent: num(rew.max_redemption_percent) }), "Reward settings updated.")} />}
      >
        <AToggleRow label="Rewards enabled" value={!!rew.is_enabled} onChange={(v) => setRew((s: any) => ({ ...s, is_enabled: v }))} />
        <ANum label="Points earned per ₹1" value={rew.points_per_rupee} onChange={(v) => setRew((s: any) => ({ ...s, points_per_rupee: v }))} suffix="pts" />
        <ANum label="₹ value of one point" value={rew.redemption_rate} onChange={(v) => setRew((s: any) => ({ ...s, redemption_rate: v }))} suffix="₹" />
        <ANum label="Minimum points to redeem" value={rew.min_redemption_points} onChange={(v) => setRew((s: any) => ({ ...s, min_redemption_points: v }))} suffix="pts" />
        <ANum label="Max share of a bill" value={rew.max_redemption_percent} onChange={(v) => setRew((s: any) => ({ ...s, max_redemption_percent: v }))} suffix="%" />
      </APanel>

      <APanel
        title="Expiry"
        subtitle="When unused points lapse, and the warning members get first."
        action={<AButton label="Save" size="sm" loading={busy === "exp"} icon={<Save size={13} color="#fff" />} onPress={() => save("exp", () => rewardsApi.updateExpiryConfig({ ...exp, expiry_days: num(exp.expiry_days), warning_days: num(exp.warning_days) }), "Expiry settings updated.")} />}
      >
        <AToggleRow label="Points expire" value={!!exp.is_enabled} onChange={(v) => setExp((s: any) => ({ ...s, is_enabled: v }))} />
        <ANum label="Lifetime of a point" value={exp.expiry_days} onChange={(v) => setExp((s: any) => ({ ...s, expiry_days: v }))} suffix="days" />
        <ANum label="Warn this many days before" value={exp.warning_days} onChange={(v) => setExp((s: any) => ({ ...s, warning_days: v }))} suffix="days" />
        <AAction
          label="Run expiry now"
          hint="Expires everything already past its date, instead of waiting for the nightly job."
          cta="Run"
          tone="danger"
          Icon={Zap}
          busy={busy === "trig"}
          onPress={() => save("trig", () => rewardsApi.triggerExpiry(), "Expiry sweep finished.")}
        />
      </APanel>
    </>
  );
}
