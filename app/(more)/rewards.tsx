import React from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Gift, TrendingUp, Users, Hourglass } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { ReferralHub } from "@/components/ReferralHub";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { useRouter } from "expo-router";
import { extrasApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Skeleton, Divider } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { formatDateTime, titleCase } from "@/lib/format";

export default function Rewards() {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const { data, loading, refreshing, refresh } = useAsync(() => (user ? safe(extrasApi.rewards(), null) : Promise.resolve(null)), [user?.email]);
  const lotsQ = useAsync(() => (user ? safe(extrasApi.coinLots(), [] as any) : Promise.resolve([])), [user?.email]);
  const d: any = data || {};
  const balance = d.balance ?? d.points ?? d.total ?? 0;
  const txns: any[] = d.transactions || d.history || d.items || [];
  const refCode = user?.referral_code || d.referral_code;
  // Coin ledger entries carry their value as `coins`; fall back for safety.
  const amt = (t: any) => {
    const n = Number(t.coin_amount ?? t.coins ?? t.amount ?? t.points ?? 0);
    return t.direction === "DEBIT" ? -Math.abs(n) : n;
  };

  /* Coins inside 30 days are the ones worth warning about. */
  const lots: any[] = Array.isArray(lotsQ.data) ? lotsQ.data : (lotsQ.data as any)?.lots || [];
  const daysLeft = (iso?: string) => {
    if (!iso) return null;
    const d = new Date(iso).getTime();
    if (Number.isNaN(d)) return null;
    return Math.ceil((d - Date.now()) / 86400000);
  };
  const expiring = lots.filter((l) => { const d = daysLeft(l.expires_at); return d !== null && d <= 30 && d >= 0; });
  const expiringCoins = expiring.reduce((n, l) => n + Number(l.remaining_coins || 0), 0);

  return (
    <SubScreen eyebrow="Earn & refer" title="Rewards" refreshing={refreshing} onRefresh={user ? refresh : undefined}>
      {!user ? (
        <SignInPrompt message="Sign in to see your reward points and referral earnings." />
      ) : loading ? (
        <View style={{ gap: 12 }}><Skeleton h={140} radius={24} /><Skeleton h={80} radius={16} /></View>
      ) : (
        <View style={{ gap: 16 }}>
          <Card padding={0} style={{ overflow: "hidden" }}>
            <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 22 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Gift size={18} color="#fff" />
                <Txt size={12} font="monoMed" tracking={2} uppercase style={{ color: "rgba(255,255,255,0.9)" }}>Points balance</Txt>
              </View>
              <Txt size={52} font="display" style={{ color: "#fff", marginTop: 8 }}>{balance}</Txt>
              <Txt size={13} style={{ color: "rgba(255,255,255,0.9)", marginTop: 4 }}>Every friend who joins earns you points.</Txt>
            </LinearGradient>
          </Card>

          {refCode ? (
            <ReferralHub
              code={String(refCode)}
              link={d.referral_link}
              referrerCoins={100}
              welcomeCoins={50}
              onVip={() => router.push("/(more)/vip")}
            />
          ) : null}

          <View style={{ flexDirection: "row", gap: 12 }}>
            <Card style={{ flex: 1 }} padding={14}>
              <TrendingUp size={18} color={c.accent} />
              <Txt size={11} font="monoMed" tone="subtle" tracking={1.5} uppercase style={{ marginTop: 8 }}>Earned</Txt>
              <Txt size={22} font="display" style={{ marginTop: 2 }}>{d.total_earned ?? balance}</Txt>
            </Card>
            <Card style={{ flex: 1 }} padding={14}>
              <Users size={18} color={c.accent} />
              <Txt size={11} font="monoMed" tone="subtle" tracking={1.5} uppercase style={{ marginTop: 8 }}>Referrals</Txt>
              <Txt size={22} font="display" style={{ marginTop: 2 }}>{d.referral_count ?? 0}</Txt>
              {d.qualified_referrals || d.pending_referrals ? (
                <Txt size={11} tone="subtle" style={{ marginTop: 2 }}>{d.qualified_referrals ?? 0} joined · {d.pending_referrals ?? 0} pending</Txt>
              ) : null}
            </Card>
          </View>

          {expiringCoins > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 16, borderWidth: 1, borderColor: c.warning + "55", backgroundColor: c.warning + "14", padding: 14 }}>
              <Hourglass size={17} color={c.warning} />
              <Txt size={13} lh={18} style={{ flex: 1 }}>
                <Txt size={13} font="sansBold" tone="warning">{expiringCoins} coins</Txt> expire within 30 days — spend them on a course or ticket.
              </Txt>
            </View>
          ) : null}

          <Txt size={12.5} tone="muted" lh={18}>Redeemable value: ₹{balance} on ticket &amp; fee checkouts. Give friends 50 coins on signup and earn 50 when they join an event or competition.</Txt>

          {/* Only shown when there is real coin history — nothing to show otherwise. */}
          {txns.length ? (
            <View>
              <Txt size={16} font="sansBold" style={{ marginBottom: 10 }}>Recent activity</Txt>
              <Card padding={0}>
                {txns.slice(0, 20).map((t, i) => (
                  <View key={i}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 12, padding: 14 }}>
                      <View style={{ flex: 1 }}>
                        <Txt size={14} font="sansMed" lh={19} numberOfLines={2}>{t.description || t.reason || titleCase(String(t.transaction_type || t.type || "").replace(/_/g, " ")) || "Reward Points"}</Txt>
                        <Txt size={11.5} tone="subtle" style={{ marginTop: 2 }}>{formatDateTime(t.created_at || t.date)}</Txt>
                      </View>
                      <Txt size={15} font="sansBold" tone={amt(t) >= 0 ? "success" : "danger"}>
                        {amt(t) >= 0 ? "+" : ""}{amt(t)}
                      </Txt>
                    </View>
                    {i < Math.min(txns.length, 20) - 1 ? <Divider style={{ marginLeft: 14 }} /> : null}
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
        </View>
      )}
    </SubScreen>
  );
}
