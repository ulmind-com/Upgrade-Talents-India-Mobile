import React, { useMemo, useState } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, QrCode, Receipt, CalendarDays, ChevronRight, Clock } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { Txt, Skeleton, EmptyState } from "@/components/ui";
import { useSession } from "@/context/Session";
import { publicApi, userVipApi, safe, type VipBooking, type VipConfig, type VipPass } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatEventDate } from "@/lib/format";
import { VipCard, Chip } from "@/components/vip/VipCard";
import { VipBookSheet } from "@/components/vip/VipBookSheet";
import { FadeInUp } from "@/components/FadeInUp";
import { PromoHeroBanner } from "@/components/PromoHeroBanner";
import { bookingTone, money, passTone, useVipCheckout, VIP_GOLD, MUTED, WARN, type VipResult } from "@/lib/vip";

type Tab = "browse" | "passes" | "bookings";
const SURFACE = "#11131A";
const HAIR = "rgba(255,255,255,0.08)";

/**
 * VIP — browse every event's VIP tiers (live capacity), and everything the
 * member holds: issued passes (with gate QR) and bookings (with payment state).
 */
export default function VipHub() {
  const router = useRouter();
  const { user } = useSession();
  const params = useLocalSearchParams<{ tab?: Tab; event?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "passes" || params.tab === "bookings" ? params.tab : "browse");
  const [booking, setBooking] = useState<VipConfig | null>(null);

  /* every upcoming event that actually has VIP tiers on sale */
  const browse = useAsync(async () => {
    const events = await safe(publicApi.upcomingEvents({ limit: 20 }), []);
    const groups = await Promise.all(
      events.map(async (e: any) => ({ event: e, configs: await safe(userVipApi.forEvent(e._id), [] as VipConfig[]) }))
    );
    return groups.filter((g) => g.configs.length);
  }, []);

  const passes = useAsync(() => (user ? safe(userVipApi.myPasses(), null) : Promise.resolve(null)), [user?.email], { refetchOnFocus: true });
  const bookings = useAsync(() => (user ? safe(userVipApi.myBookings(), null) : Promise.resolve(null)), [user?.email], { refetchOnFocus: true });

  const reloadMine = () => {
    passes.reload();
    bookings.reload();
  };

  const onConfirmed = (r: VipResult) => {
    reloadMine();
    browse.refresh();
    if (r.passIds.length === 1) router.push(`/(more)/vip/pass/${r.passIds[0]}`);
    else setTab("passes");
  };

  // "Pay now" on a pending booking re-opens its order
  const resumeCo = useVipCheckout({ onConfirmed });

  /* the event a deep link asked for comes first */
  const groups = useMemo(() => {
    const g = browse.data || [];
    if (!params.event) return g;
    return [...g].sort((a, b) => (a.event._id === params.event ? -1 : b.event._id === params.event ? 1 : 0));
  }, [browse.data, params.event]);

  const passRows: VipPass[] = passes.data?.passes || [];
  const bookingRows: VipBooking[] = bookings.data?.bookings || [];
  const pendingCount = bookingRows.filter((b) => String(b.booking_status).toUpperCase() === "PENDING_PAYMENT").length;

  const refresh = () => {
    browse.refresh();
    reloadMine();
  };

  const book = (cfg: VipConfig) => {
    if (!user) return router.push("/(auth)/login");
    setBooking(cfg);
  };

  return (
    <SubScreen eyebrow="Backstage access" title="VIP passes" refreshing={browse.refreshing} onRefresh={refresh}>
      {/* 3D VIP Character Promo Banner — Zomato District Style */}
      <FadeInUp>
        <PromoHeroBanner
          tag="Backstage VIP Access"
          title="Skip The Queue. Own The Night."
          subtitle="Exclusive lounge access, backstage entry & VIP gate pass"
          characterSource={require("../../../assets/banners/3d_vip_char.png")}
          glowColor="rgba(245, 197, 66, 0.18)"
        />
      </FadeInUp>

      {/* tabs */}
      <View style={s.track}>
        {(
          [
            ["browse", "Browse", Crown, null],
            ["passes", "My passes", QrCode, passRows.length || null],
            ["bookings", "Bookings", Receipt, pendingCount || null],
          ] as [Tab, string, any, number | null][]
        ).map(([k, label, Icon, n]) => {
          const on = tab === k;
          return (
            <Pressable key={k} onPress={() => setTab(k)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[s.seg, on && s.segOn]}>
              <Icon size={14} color={on ? "#fff" : MUTED} />
              <Txt size={12.5} font="sansBold" style={{ color: on ? "#fff" : MUTED }}>{label}</Txt>
              {n ? (
                <View style={[s.badge, k === "bookings" && { backgroundColor: WARN }]}>
                  <Txt size={10} font="sansExt" style={{ color: "#0B0B0E" }}>{n}</Txt>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {tab === "browse" ? (
        browse.loading ? (
          <View style={{ gap: 14 }}>{[0, 1].map((i) => <Skeleton key={i} h={300} radius={22} />)}</View>
        ) : groups.length ? (
          <View style={{ gap: 28 }}>
            {groups.map((g) => (
              <View key={g.event._id} style={{ gap: 12 }}>
                <Pressable onPress={() => router.push(`/(user)/events/${g.event._id}`)} style={s.eventHead}>
                  <View style={s.eventIcon}>
                    <CalendarDays size={16} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Txt size={15.5} font="sansBold" numberOfLines={1} style={{ color: "#fff" }}>{g.event.title}</Txt>
                    <Txt size={12} numberOfLines={1} style={{ color: MUTED, marginTop: 1 }}>
                      {[g.event.date ? formatEventDate(g.event.date) : null, g.event.venue].filter(Boolean).join(" · ")}
                    </Txt>
                  </View>
                  <ChevronRight size={16} color={MUTED} />
                </Pressable>
                {g.configs.map((cfg) => (
                  <VipCard key={String(cfg._id || cfg.id)} cfg={{ ...cfg, event_title: cfg.event_title || g.event.title }} onBook={() => book({ ...cfg, event_title: cfg.event_title || g.event.title })} />
                ))}
              </View>
            ))}
          </View>
        ) : (
          <EmptyState icon={<Crown size={26} color={MUTED} />} title="No VIP passes on sale" subtitle="VIP tiers appear here as soon as an event opens them." />
        )
      ) : !user ? (
        <EmptyState
          icon={<Crown size={26} color={MUTED} />}
          title="Sign in to see yours"
          subtitle="Your VIP passes and bookings live with your account."
        />
      ) : tab === "passes" ? (
        passes.loading ? (
          <View style={{ gap: 12 }}>{[0, 1].map((i) => <Skeleton key={i} h={120} radius={20} />)}</View>
        ) : passRows.length ? (
          <View style={{ gap: 12 }}>
            {passRows.map((p) => (
              <PassRow key={p.pass_id} p={p} onPress={() => router.push(`/(more)/vip/pass/${p.pass_id}`)} />
            ))}
          </View>
        ) : (
          <EmptyState icon={<QrCode size={26} color={MUTED} />} title="No VIP passes yet" subtitle="Book a tier from Browse — your pass and its gate QR land here." />
        )
      ) : bookings.loading ? (
        <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={96} radius={20} />)}</View>
      ) : bookingRows.length ? (
        <View style={{ gap: 12 }}>
          {resumeCo.error ? (
            <View style={s.error}>
              <Txt size={12.5} lh={18} style={{ color: "#FFB3C0" }}>{resumeCo.error}</Txt>
            </View>
          ) : null}
          {bookingRows.map((b) => (
            <BookingRow
              key={b.booking_id}
              b={b}
              busy={resumeCo.busy}
              onPress={() => router.push(`/(more)/vip/booking/${b.booking_id}`)}
              onPay={() => resumeCo.resume(b)}
            />
          ))}
        </View>
      ) : (
        <EmptyState icon={<Receipt size={26} color={MUTED} />} title="No VIP bookings yet" subtitle="Every VIP purchase and its payment status shows up here." />
      )}

      <VipBookSheet cfg={booking} onClose={() => setBooking(null)} onConfirmed={onConfirmed} />
      {resumeCo.sheet}
    </SubScreen>
  );
}

function PassRow({ p, onPress }: { p: VipPass; onPress: () => void }) {
  const t = passTone(p);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.passRow, !t.usable && { opacity: 0.6 }, { opacity: pressed ? 0.85 : undefined }]}>
      <View style={s.passQr}>
        <QrCode size={26} color={t.usable ? "#0B0B0E" : MUTED} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt size={15} font="sansBold" numberOfLines={1} style={{ color: "#fff" }}>{p.pass_name}</Txt>
        <Txt size={12} numberOfLines={1} style={{ color: MUTED, marginTop: 2 }}>{p.event_title}</Txt>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 }}>
          <Chip label={t.label} color={t.color} />
          <Txt size={11.5} numberOfLines={1} style={{ color: "#C5CAD6", flexShrink: 1 }}>{p.holder_name}</Txt>
        </View>
      </View>
      <ChevronRight size={18} color={MUTED} />
    </Pressable>
  );
}

function BookingRow({ b, busy, onPress, onPay }: { b: VipBooking; busy: boolean; onPress: () => void; onPay: () => void }) {
  const t = bookingTone(b.booking_status);
  const pending = String(b.booking_status).toUpperCase() === "PENDING_PAYMENT";
  const expired = pending && b.expires_at && new Date(b.expires_at).getTime() < Date.now();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.bRow, { opacity: pressed ? 0.85 : 1 }]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt size={15} font="sansBold" numberOfLines={1} style={{ color: "#fff" }}>{b.pass_name}</Txt>
          <Txt size={12} numberOfLines={1} style={{ color: MUTED, marginTop: 2 }}>{b.event_title}</Txt>
        </View>
        <Chip label={expired ? "Hold expired" : t.label} color={expired ? MUTED : t.color} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginTop: 12 }}>
        <Txt size={12} style={{ color: "#C5CAD6" }}>{b.quantity} × {money(b.unit_price, b.currency)}</Txt>
        <Txt size={14} font="sansExt" style={{ color: "#fff" }}>{money(b.total_amount, b.currency)}</Txt>
        <View style={{ flex: 1 }} />
        <Txt size={11.5} style={{ color: MUTED }}>{formatEventDate(b.booked_at)}</Txt>
      </View>
      {pending && !expired ? (
        <View style={s.payRow}>
          <Clock size={13} color={WARN} />
          <Txt size={12} style={{ color: WARN, flex: 1 }}>
            {b.expires_at ? `Held until ${new Date(b.expires_at).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "Awaiting payment"}
          </Txt>
          <Pressable onPress={onPay} disabled={busy} hitSlop={6} style={({ pressed }) => [s.payBtn, { opacity: pressed || busy ? 0.7 : 1 }]}>
            <Txt size={12.5} font="sansBold" style={{ color: "#fff" }}>{busy ? "Opening…" : "Pay now"}</Txt>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 22, padding: 18, marginBottom: 16, overflow: "hidden", backgroundColor: SURFACE, borderWidth: 1, borderColor: "rgba(245,197,66,0.2)" },
  heroIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(245,197,66,0.14)", alignItems: "center", justifyContent: "center" },
  track: { flexDirection: "row", padding: 4, gap: 4, borderRadius: 999, backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR, marginBottom: 18 },
  seg: { flex: 1, height: 40, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segOn: { backgroundColor: "rgba(255,255,255,0.12)" },
  badge: { minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 999, backgroundColor: VIP_GOLD, alignItems: "center", justifyContent: "center" },
  eventHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  eventIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: "rgba(255,255,255,0.07)", alignItems: "center", justifyContent: "center" },
  passRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 14, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: "rgba(245,197,66,0.18)" },
  passQr: { width: 56, height: 56, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  bRow: { padding: 14, borderRadius: 20, backgroundColor: SURFACE, borderWidth: 1, borderColor: HAIR },
  payRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: HAIR },
  payBtn: { height: 34, paddingHorizontal: 14, borderRadius: 10, backgroundColor: "#FF385C", justifyContent: "center" },
  error: { padding: 12, borderRadius: 14, backgroundColor: "rgba(255,56,92,0.1)", borderWidth: 1, borderColor: "rgba(255,56,92,0.3)" },
});
