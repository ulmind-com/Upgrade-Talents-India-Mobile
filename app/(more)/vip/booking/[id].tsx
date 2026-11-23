import React from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Receipt, QrCode, ChevronRight, Clock, User } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { Txt, Skeleton, EmptyState } from "@/components/ui";
import { Chip } from "@/components/vip/VipCard";
import { userVipApi, safe, type VipPass } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatEventDate } from "@/lib/format";
import { countdownText } from "@/lib/live";
import { useTick } from "@/components/live/LiveBits";
import { bookingTone, money, passTone, useVipCheckout, MUTED, WARN, type VipResult } from "@/lib/vip";

const SURFACE = "#11131A";
const HAIR = "rgba(255,255,255,0.08)";

/** One VIP booking: what was bought, its payment state, and the passes it issued. */
export default function VipBookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const q = useAsync(async () => {
    const [booking, mine] = await Promise.all([userVipApi.myBooking(String(id)), safe(userVipApi.myPasses({ limit: 100 }), null)]);
    const passes: VipPass[] = (mine?.passes || []).filter(
      (p) => p.booking_id === booking.booking_id || (booking.issued_pass_ids || []).includes(p.pass_id)
    );
    return { booking, passes };
  }, [id]);

  const co = useVipCheckout({
    onConfirmed: (r: VipResult) => {
      q.refresh();
      if (r.passIds.length === 1) router.push(`/(more)/vip/pass/${r.passIds[0]}`);
    },
  });

  const b = q.data?.booking;
  const pending = b && String(b.booking_status).toUpperCase() === "PENDING_PAYMENT";
  useTick(pending ? 1000 : 60000);
  const holdLeft = pending && b?.expires_at ? countdownText(b.expires_at) : null;
  const t = b ? bookingTone(b.booking_status) : null;

  return (
    <SubScreen eyebrow="VIP booking" title={b?.pass_name || (q.loading ? "Loading…" : "Booking")} refreshing={q.refreshing} onRefresh={q.refresh}>
      {q.loading ? (
        <View style={{ gap: 12 }}>
          <Skeleton h={180} radius={22} />
          <Skeleton h={140} radius={20} />
        </View>
      ) : !b || !t ? (
        <EmptyState icon={<Receipt size={26} color={MUTED} />} title="Booking not found" subtitle={q.error || "It may belong to another account."} />
      ) : (
        <View style={{ gap: 16 }}>
          {/* summary */}
          <View style={s.card}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt size={13} numberOfLines={1} style={{ color: MUTED }}>{b.event_title}</Txt>
                <Txt size={26} font="display" style={{ color: "#fff", marginTop: 6 }}>{money(b.total_amount, b.currency)}</Txt>
                <Txt size={12.5} style={{ color: MUTED, marginTop: 2 }}>
                  {b.quantity} × {money(b.unit_price, b.currency)}
                </Txt>
              </View>
              <Chip label={pending && !holdLeft ? "Hold expired" : t.label} color={pending && !holdLeft ? MUTED : t.color} />
            </View>

            {pending ? (
              <View style={s.hold}>
                <Clock size={15} color={WARN} />
                <Txt size={12.5} lh={18} style={{ color: WARN, flex: 1 }}>
                  {holdLeft ? `Held for ${holdLeft} — pay to confirm your passes.` : "The hold has expired. Book again to get passes."}
                </Txt>
              </View>
            ) : null}

            {pending && holdLeft ? (
              <Pressable onPress={() => co.resume(b)} disabled={co.busy} style={({ pressed }) => [s.pay, { opacity: pressed || co.busy ? 0.75 : 1 }]}>
                <Txt size={15} font="sansBold" style={{ color: "#fff" }}>
                  {co.busy ? "Opening payment…" : `Pay ${money(b.total_amount, b.currency)}`}
                </Txt>
              </Pressable>
            ) : null}
            {co.error ? (
              <View style={s.error}>
                <Txt size={12.5} lh={18} style={{ color: "#FFB3C0" }}>{co.error}</Txt>
              </View>
            ) : null}
          </View>

          {/* holders */}
          {b.holder_names?.length ? (
            <View style={s.card}>
              <Txt size={11} font="sansBold" tracking={1.4} style={{ color: MUTED, marginBottom: 10 }}>NAMES ON THE PASSES</Txt>
              <View style={{ gap: 10 }}>
                {b.holder_names.map((n, i) => (
                  <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <User size={15} color={MUTED} />
                    <Txt size={14} font="sansSemi" style={{ color: "#fff" }}>{n}</Txt>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* issued passes */}
          {q.data!.passes.length ? (
            <View style={{ gap: 10 }}>
              <Txt size={11} font="sansBold" tracking={1.4} style={{ color: MUTED }}>YOUR PASSES</Txt>
              {q.data!.passes.map((p) => {
                const pt = passTone(p);
                return (
                  <Pressable key={p.pass_id} onPress={() => router.push(`/(more)/vip/pass/${p.pass_id}`)} style={({ pressed }) => [s.passRow, { opacity: pressed ? 0.85 : 1 }]}>
                    <View style={s.qrIcon}>
                      <QrCode size={20} color="#0B0B0E" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Txt size={14} font="sansBold" style={{ color: "#fff" }}>{p.holder_name}</Txt>
                      <Txt size={11.5} style={{ color: MUTED, marginTop: 2 }}>{p.pass_reference}</Txt>
                    </View>
                    <Chip label={pt.label} color={pt.color} />
                    <ChevronRight size={16} color={MUTED} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {/* references */}
          <View style={[s.card, { gap: 10 }]}>
            <Ref label="Booking" value={b.booking_reference} />
            <Ref label="Booked" value={formatEventDate(b.booked_at)} />
            <Ref label="Payment" value={b.payment_status ? String(b.payment_status).replace(/_/g, " ").toLowerCase() : "—"} />
            {b.payment_reference ? <Ref label="Payment ID" value={b.payment_reference} /> : null}
          </View>
        </View>
      )}
      {co.sheet}
    </SubScreen>
  );
}

function Ref({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
      <Txt size={12.5} style={{ color: MUTED }}>{label}</Txt>
      <Txt size={12.5} font="sansBold" style={{ color: "#fff", flexShrink: 1, textAlign: "right", textTransform: label === "Payment" ? "capitalize" : "none" }}>
        {value}
      </Txt>
    </View>
  );
}

const s = StyleSheet.create({
  card: { padding: 16, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
  hold: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: "rgba(245,181,68,0.1)" },
  pay: { marginTop: 12, height: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#FF385C" },
  error: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,56,92,0.1)", borderWidth: 1, borderColor: "rgba(255,56,92,0.3)" },
  passRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 18, backgroundColor: SURFACE, borderWidth: 1, borderColor: "rgba(245,197,66,0.18)" },
  qrIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
});
