import React, { useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, Check, Sparkles, CalendarDays, QrCode, Receipt } from "lucide-react-native";
import QRCode from "react-native-qrcode-svg";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { publicApi, userVipApi, safe, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Button, Skeleton, EmptyState, Badge, Card } from "@/components/ui";
import { useAlert } from "@/components/Popup";
import { FadeInUp } from "@/components/FadeInUp";
import { DottedGrid } from "@/components/patterns";
import { formatINR, formatEventDate } from "@/lib/format";
import { RazorpayCheckout, type RazorpayOptions, type RazorpaySuccess } from "@/components/RazorpayCheckout";

export default function Vip() {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<"browse" | "passes" | "bookings">("browse");
  const [pay, setPay] = useState<{ options: RazorpayOptions; reference: string } | null>(null);
  const alert = useAlert();

  const { data, loading, refreshing, refresh } = useAsync(async () => {
    const events = await safe(publicApi.upcomingEvents({ limit: 10 }), []);
    const groups = await Promise.all(events.map(async (e) => ({ event: e, configs: await safe(userVipApi.forEvent(e._id), []) })));
    return groups.filter((g) => (g.configs || []).length > 0);
  }, [user?.email]);

  const myPasses = useAsync(
    () => (user ? safe(userVipApi.myPasses(), null as any) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );
  const myBookings = useAsync(
    () => (user ? safe(userVipApi.myBookings(), null as any) : Promise.resolve(null)),
    [user?.email],
    { refetchOnFocus: true }
  );

  const flash = (tone: "success" | "error", text: string) => alert(tone, tone === "success" ? "Done" : "Something went wrong", text);

  const reloadMine = () => { myPasses.reload(); myBookings.reload(); };

  /* VIP checkout has its own order and its own verifier. */
  const onPaid = async (r: RazorpaySuccess) => {
    const ctx = pay;
    setPay(null);
    if (!ctx) return;
    try {
      await userVipApi.verifyPayment({
        booking_reference: ctx.reference,
        razorpay_order_id: r.razorpay_order_id,
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_signature: r.razorpay_signature,
      });
      flash("success", "VIP pass confirmed. It is in My passes.");
      setTab("passes");
      reloadMine();
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : `Payment went through but we could not confirm it. Quote ${ctx.reference} to support.`);
    }
  };

  const book = async (eventId: string, cfg: any) => {
    if (!user) { router.push("/(auth)/login"); return; }
    const key = `${eventId}:${cfg._id || cfg.id}`;
    setBusy(key);
    try {
      const res = await userVipApi.book(eventId, cfg._id || cfg.id, 1);
      const info = res?.payment_info || {};
      const key2 = info.key_id || info.checkout_data?.key;
      const reference = res?.booking_reference || res?.booking?.booking_reference;

      // Free or already-settled tiers skip the gateway entirely.
      if (!res?.payment_info || res?.status === "CONFIRMED" || res?.booking_status === "CONFIRMED") {
        flash("success", "VIP pass booked. It is in My passes.");
        setTab("passes");
        reloadMine();
        return;
      }
      if (!key2 || !reference) {
        flash("error", "Payments are not configured on the server yet. Please contact support.");
        return;
      }
      setPay({
        reference,
        options: {
          key: key2,
          amount: info.amount_paise ?? Math.round(Number(cfg.price || 0) * 100),
          currency: info.currency || "INR",
          name: info.checkout_data?.name || "Upgrade Talents India",
          description: info.checkout_data?.description || `${cfg.name || "VIP"} — ${eventId}`,
          order_id: info.order_id,
          prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone_number || "" },
          notes: { booking_reference: String(reference) },
          theme: { color: c.accent },
        },
      });
    } catch (e) {
      flash("error", e instanceof ApiError ? e.message : "Could not book this pass.");
    } finally { setBusy(null); }
  };

  const groups = data || [];

  return (
    <SubScreen eyebrow="Backstage access" title="VIP Passes" refreshing={refreshing} onRefresh={refresh}>

      {/* Hero band — District Gen-Z style */}
      <FadeInUp>
        <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 22 }}>
          <LinearGradient colors={["#7C3AED", "#FF385C", "#08090C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20 }}>
            <DottedGrid color="rgba(255,255,255,0.22)" opacity={0.5} gap={18} />
            <Txt size={74} font="display" style={{ position: "absolute", top: -6, right: -4, color: "rgba(255,255,255,0.14)", letterSpacing: -3 }}>VIP</Txt>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.24)", alignItems: "center", justifyContent: "center" }}>
              <Crown size={23} color="#C9F24A" />
            </View>
            <Txt size={25} font="display" tracking={-0.5} lh={28} style={{ color: "#fff", marginTop: 14 }}>Skip the queue.{"\n"}Own the night.</Txt>
            <Txt size={13} lh={19} style={{ color: "rgba(255,255,255,0.9)", marginTop: 8, maxWidth: 270 }}>Front-row views, lounge access and backstage perks.</Txt>
          </LinearGradient>
        </View>
      </FadeInUp>

      {/* Browse what is on sale, or what you already own */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 18 }}>
        {([
          { k: "browse", label: "Browse", Icon: Crown },
          { k: "passes", label: "My passes", Icon: QrCode },
          { k: "bookings", label: "My bookings", Icon: Receipt },
        ] as const).map((t) => {
          const on = tab === t.k;
          return (
            <Pressable
              key={t.k}
              onPress={() => setTab(t.k)}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 38, paddingHorizontal: 13, borderRadius: 999, borderWidth: 1, borderColor: on ? "#FF385C" : "rgba(255,255,255,0.12)", backgroundColor: on ? "#FF385C" : "#14161E" }}
            >
              <t.Icon size={14} color={on ? "#fff" : c.fgMuted} />
              <Txt size={12.5} font="sansBold" style={{ color: on ? "#fff" : c.fgMuted }}>{t.label}</Txt>
            </Pressable>
          );
        })}
      </View>

      {tab === "passes" ? (
        <MyPasses q={myPasses} signedIn={!!user} />
      ) : tab === "bookings" ? (
        <MyBookings q={myBookings} signedIn={!!user} />
      ) : loading ? (
        <View style={{ gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} h={190} radius={22} />)}</View>
      ) : groups.length ? (
        <View style={{ gap: 26 }}>
          {groups.map((g, gi) => (
            <View key={g.event._id} style={{ gap: 12 }}>
              {/* event header */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.accent + "1f", alignItems: "center", justifyContent: "center" }}>
                  <CalendarDays size={16} color={c.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={16} font="sansExt" numberOfLines={1}>{g.event.title}</Txt>
                  <Txt size={11.5} tone="subtle" numberOfLines={1}>{formatEventDate(g.event.date)} · {g.event.venue}</Txt>
                </View>
              </View>

              {(g.configs || []).map((cfg: any, ci: number) => {
                const key = `${g.event._id}:${cfg._id || cfg.id}`;
                const left = cfg.available ?? cfg.remaining;
                const soldOut = typeof left === "number" && left <= 0;
                const perks: string[] = Array.isArray(cfg.perks) ? cfg.perks : [];
                return (
                  <FadeInUp key={key} delay={ci * 60}>
                    <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, opacity: soldOut ? 0.6 : 1 }}>
                      {/* top strip */}
                      <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16 }}>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 9, flex: 1 }}>
                            <View style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }}>
                              <Crown size={17} color="#fff" />
                            </View>
                            <Txt size={17} font="sansExt" style={{ color: "#fff", flex: 1 }} numberOfLines={1}>{cfg.name || cfg.tier || "VIP"}</Txt>
                          </View>
                          <Txt size={24} font="display" style={{ color: "#fff" }}>{formatINR(cfg.price)}</Txt>
                        </View>
                      </LinearGradient>

                      <View style={{ padding: 16, gap: 12 }}>
                        {cfg.description ? <Txt size={13.5} tone="muted" lh={20} numberOfLines={2}>{cfg.description}</Txt> : null}

                        {perks.length ? (
                          <View style={{ gap: 8 }}>
                            {perks.slice(0, 4).map((pk, i) => (
                              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 9 }}>
                                <View style={{ width: 20, height: 20, borderRadius: 999, backgroundColor: c.accent + "22", alignItems: "center", justifyContent: "center" }}>
                                  <Check size={12} color={c.accent} />
                                </View>
                                <Txt size={13.5} font="sansMed" style={{ flex: 1 }} numberOfLines={1}>{pk}</Txt>
                              </View>
                            ))}
                          </View>
                        ) : null}

                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                          {typeof left === "number" ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: soldOut ? c.danger + "1f" : c.warning + "1f", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                              <Sparkles size={12} color={soldOut ? c.danger : c.warning} />
                              <Txt size={11} font="sansBold" tone={soldOut ? "danger" : "warning"} tracking={0.5}>{soldOut ? "SOLD OUT" : `ONLY ${left} LEFT`}</Txt>
                            </View>
                          ) : <View />}
                          <Button label={soldOut ? "Sold out" : "Book VIP"} disabled={soldOut} size="sm" loading={busy === key} onPress={() => book(g.event._id, cfg)} icon={<Crown size={14} color={c.onAccent} />} />
                        </View>
                      </View>
                    </View>
                  </FadeInUp>
                );
              })}
            </View>
          ))}
        </View>
      ) : (
        <EmptyState icon={<Crown size={26} color={c.fgMuted} />} title="No VIP passes available" subtitle="VIP experiences will open for upcoming events." />
      )}
      <RazorpayCheckout
        visible={!!pay}
        options={pay?.options || null}
        onSuccess={onPaid}
        onFailure={(m) => { setPay(null); flash("error", m); }}
        onDismiss={() => { setPay(null); flash("error", "Payment cancelled. Your pass is held briefly — book again to finish."); }}
      />
    </SubScreen>
  );
}

/* ── What the member already holds ── */

function MyPasses({ q, signedIn }: { q: any; signedIn: boolean }) {
  const { c } = useTheme();
  const router = useRouter();
  if (!signedIn) return <EmptyState icon={<Crown size={26} color={c.fgMuted} />} title="Sign in to see your passes" subtitle="Your VIP passes live with your account." />;
  if (q.loading) return <View style={{ gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} h={150} radius={22} />)}</View>;

  const rows: any[] = q.data?.passes || q.data?.items || [];
  if (!rows.length) return <EmptyState icon={<QrCode size={26} color={c.fgMuted} />} title="No VIP passes yet" subtitle="Book one from Browse and it appears here with its gate QR." />;

  return (
    <View style={{ gap: 14 }}>
      {rows.map((p, i) => {
        const used = p.is_checked_in || p.status === "USED";
        const revoked = p.is_revoked || p.status === "REVOKED";
        const ref = p.pass_reference || p.pass_id;
        return (
          <FadeInUp key={p.pass_id || i} delay={i * 60}>
            <View style={{ borderRadius: 24, overflow: "hidden", backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, opacity: revoked ? 0.6 : 1 }}>
              <LinearGradient colors={c.gradBrand as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View style={{ width: 34, height: 34, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }}>
                  <Crown size={17} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Txt size={16} font="sansExt" style={{ color: "#fff" }} numberOfLines={1}>{p.tier_name || p.configuration_name || "VIP Pass"}</Txt>
                  <Txt size={11.5} style={{ color: "rgba(255,255,255,0.85)" }} numberOfLines={1}>{p.event_title || p.event_name || ""}</Txt>
                </View>
                <Badge label={revoked ? "Revoked" : used ? "Used" : "Valid"} tone={revoked ? "danger" : used ? "neutral" : "success"} />
              </LinearGradient>

              <View style={{ padding: 18, alignItems: "center", gap: 12 }}>
                {!revoked && ref ? (
                  <View style={{ backgroundColor: "#fff", padding: 12, borderRadius: 16 }}>
                    <QRCode value={String(p.qr_token || ref)} size={150} backgroundColor="#fff" color="#0b0b10" />
                  </View>
                ) : null}
                <Txt size={12.5} font="monoMed" tone="muted" tracking={1.5}>{ref}</Txt>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, justifyContent: "center" }}>
                  {p.holder_name ? <Cell label="Holder" value={p.holder_name} /> : null}
                  {p.issued_at ? <Cell label="Issued" value={formatEventDate(p.issued_at)} /> : null}
                </View>
              </View>
            </View>
          </FadeInUp>
        );
      })}
    </View>
  );
}

function MyBookings({ q, signedIn }: { q: any; signedIn: boolean }) {
  const { c } = useTheme();
  if (!signedIn) return <EmptyState icon={<Crown size={26} color={c.fgMuted} />} title="Sign in to see your bookings" subtitle="VIP bookings live with your account." />;
  if (q.loading) return <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={96} radius={20} />)}</View>;

  const rows: any[] = q.data?.bookings || q.data?.items || [];
  if (!rows.length) return <EmptyState icon={<Receipt size={26} color={c.fgMuted} />} title="No VIP bookings yet" subtitle="Every VIP purchase and its payment status shows up here." />;

  return (
    <View style={{ gap: 12 }}>
      {rows.map((b, i) => {
        const paid = b.payment_status === "PAID" || b.payment_status === "NOT_REQUIRED";
        const cancelled = b.booking_status === "CANCELLED" || b.status === "CANCELLED";
        return (
          <FadeInUp key={b.booking_id || i} delay={i * 50}>
            <Card>
              <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Txt size={15} font="sansBold" numberOfLines={1}>{b.tier_name || b.configuration_name || "VIP booking"}</Txt>
                  <Txt size={12.5} tone="muted" numberOfLines={1} style={{ marginTop: 2 }}>{b.event_title || b.event_name || b.booking_reference}</Txt>
                </View>
                <Badge
                  label={cancelled ? "Cancelled" : paid ? "Confirmed" : "Payment pending"}
                  tone={cancelled ? "danger" : paid ? "success" : "warning"}
                />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: 12 }}>
                <Cell label="Reference" value={b.booking_reference || "—"} />
                <Cell label="Qty" value={String(b.quantity ?? 1)} />
                <Cell label="Amount" value={formatINR(b.total_amount ?? b.amount ?? 0)} />
                <Cell label="Booked" value={formatEventDate(b.booked_at || b.created_at)} />
              </View>
            </Card>
          </FadeInUp>
        );
      })}
    </View>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Txt size={10} font="monoMed" tone="subtle" tracking={1.5} uppercase>{label}</Txt>
      <Txt size={13} font="sansSemi" style={{ marginTop: 1 }} numberOfLines={1}>{value}</Txt>
    </View>
  );
}
