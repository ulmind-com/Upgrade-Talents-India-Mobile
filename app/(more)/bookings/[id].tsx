import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, Animated, Easing, Dimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  ArrowLeft, CalendarDays, MapPin, Clock, Ticket as TicketIcon, ChevronRight, Share2,
  CheckCircle2, CreditCard, XCircle, ScanLine, Receipt, ShieldCheck, RefreshCw,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { bookingsApi, paymentsApi, safe, type MyTicket } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useCheckout } from "@/lib/useCheckout";
import { Txt, Button, Skeleton, Glow, EmptyState } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { CopyCode } from "@/components/CopyCode";
import { ShareSheet } from "@/components/ShareSheet";
import { usePopup } from "@/components/Popup";
import { DottedGrid, Perforation } from "@/components/patterns";
import { Intro, useIntro } from "@/components/motion";
import { formatINR, formatEventDate, formatDateTime, titleCase } from "@/lib/format";
import {
  bookingId, bookingState, bookingWay, eventOf, ticketsOf, isCancellable,
  STATE_LABEL, type BookingRow,
} from "@/lib/booking";

const SCREEN_W = Dimensions.get("window").width;
const HERO = 268;

export default function BookingDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const popup = usePopup();
  const intro = useIntro();

  /* There is no single-booking endpoint, so the row comes out of the list and
     the tickets out of the wallet — both already cached by the shelf. */
  const q = useAsync(
    () => (user ? safe(bookingsApi.my(), [] as BookingRow[]) : Promise.resolve([] as BookingRow[])),
    [user?.email, id],
    { refetchOnFocus: true }
  );
  const tq = useAsync(
    () => (user ? safe(bookingsApi.myTickets(), [] as MyTicket[]) : Promise.resolve([] as MyTicket[])),
    [user?.email, id],
    { refetchOnFocus: true }
  );

  const b = useMemo(
    () => (Array.isArray(q.data) ? q.data : []).find((r) => bookingId(r) === String(id) || r.booking_reference === String(id)),
    [q.data, id]
  );
  const tickets = useMemo(() => ticketsOf(bookingId(b || {}), Array.isArray(tq.data) ? tq.data : []), [tq.data, b]);

  const [share, setShare] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<"pay" | "cancel" | "recheck" | null>(null);

  const checkout = useCheckout({
    onDone: () => { popup.show("success", "Payment received", "Your tickets are being issued."); q.reload(); tq.reload(); },
  });

  const loading = q.loading || tq.loading;

  if (!loading && !b) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, paddingTop: insets.top + 60, paddingHorizontal: 20 }}>
        <StatusBar style={c.barStyle === "light" ? "light" : "dark"} />
        <EmptyState icon={<Receipt size={26} color={c.fgMuted} />} title="Booking not found" subtitle="It may have been removed, or belongs to another account." />
        <View style={{ marginTop: 18 }}><Button label="Back to bookings" variant="outline" onPress={() => router.replace("/(more)/bookings")} /></View>
      </View>
    );
  }

  const row: BookingRow = b || {};
  const state = bookingState(row);
  const ev = eventOf(row, tickets);
  const way = bookingWay(row, tickets);
  const [A, B] = way.grad;
  const qty = Number(row.quantity ?? tickets.length ?? 1) || 1;
  const type = row.ticket_type || tickets[0]?.ticket_type || "Pass";
  const scanned = tickets.filter((t) => t.is_checked_in).length;
  const reference = String(row.booking_reference || bookingId(row) || "");

  const unit = Number(row.unit_price ?? row.ticket_price ?? tickets[0]?.base_price ?? tickets[0]?.price ?? 0);
  const total = Number(row.total_amount ?? row.amount ?? 0);
  const discount = Number(row.discount_amount ?? row.coin_discount ?? 0);
  const subtotal = unit ? unit * qty : total + discount;

  const pay = async () => {
    setBusy("pay");
    try {
      const info = await paymentsApi.createOrder(bookingId(row));
      const r = checkout.start({
        paymentInfo: info?.payment_details || info?.payment_info || info,
        amount: total,
        description: `Booking ${reference}`,
        context: { kind: "booking", bookingId: bookingId(row), reference },
      });
      if (!r.opened) popup.show("error", "Can't open checkout", r.reason);
    } catch (e: any) {
      popup.show("error", "Couldn't start payment", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const recheck = async () => {
    setBusy("recheck");
    try {
      await paymentsApi.reconcilePending();
      q.reload(); tq.reload();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      popup.show("success", "Payment rechecked", "If it was captured, your passes appear in a moment. Pull to refresh if needed.");
    } catch (e: any) {
      popup.show("error", "Couldn't recheck", e?.message || "Please try again in a moment.");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    try {
      await bookingsApi.cancel(bookingId(row));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      popup.show("success", "Booking cancelled", "Any amount paid will be refunded as per policy.");
      setConfirming(false);
      q.reload(); tq.reload();
    } catch (e: any) {
      popup.show("error", "Couldn't cancel", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const openTicket = (t: MyTicket) =>
    router.push({
      pathname: "/(more)/ticket/[ref]",
      params: { ref: t.ticket_ref, type: t.ticket_type, holder: t.holder_name, issued: t.issued_at, checked: t.is_checked_in ? "1" : "0", event_id: t.event_id },
    });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <StatusBar style="light" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 48 }}>
        {/* ══ Hero ══ */}
        <View style={{ height: HERO, overflow: "hidden" }}>
          <LinearGradient colors={[A, B] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
          <AppImage uri={ev.cover} seed={ev.eventId || reference} style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.35 }} />
          <LinearGradient
            colors={["rgba(0,0,0,0.42)", "rgba(0,0,0,0.12)", c.bg] as any}
            locations={[0, 0.45, 1]}
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />

          {/* Clean District status pill badge */}
          <Stamp state={state} />

          <View style={{ flex: 1, paddingTop: insets.top + 6, paddingHorizontal: 20, justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Pressable
                onPress={() => (router.canGoBack() ? router.back() : router.replace("/(more)/bookings"))}
                style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" }}
              >
                <ArrowLeft size={20} color="#fff" />
              </Pressable>
              <Pressable
                onPress={() => setShare(true)}
                style={{ width: 42, height: 42, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.35)", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)" }}
              >
                <Share2 size={18} color="#fff" />
              </Pressable>
            </View>

            <Intro t={intro} at={0.06} span={0.44} y={20}>
              <View style={{ paddingBottom: 20 }}>
                <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.38)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", paddingHorizontal: 10, paddingVertical: 4, marginBottom: 10 }}>
                  <TicketIcon size={11} color="#fff" />
                  <Txt size={10} font="sansBold" tracking={1.6} uppercase style={{ color: "#fff" }}>{qty} × {titleCase(type)}</Txt>
                </View>
                <Txt size={27} font="display" tracking={-0.8} lh={32} numberOfLines={3} style={{ color: "#fff" }}>{ev.title}</Txt>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 10 }}>
                  {ev.date ? <HeroMeta icon={<CalendarDays size={12} color="rgba(255,255,255,0.75)" />} text={formatEventDate(ev.date)} /> : null}
                  {ev.time ? <HeroMeta icon={<Clock size={12} color="rgba(255,255,255,0.75)" />} text={String(ev.time)} /> : null}
                  {ev.venue ? <HeroMeta icon={<MapPin size={12} color="rgba(255,255,255,0.75)" />} text={String(ev.venue)} /> : null}
                </View>
              </View>
            </Intro>
          </View>
        </View>

        <Glow color={A} size={300} top={HERO - 110} left={-120} />

        <View style={{ paddingHorizontal: 20, gap: 16, marginTop: 4 }}>
          {loading ? (
            <View style={{ gap: 12 }}>{[0, 1, 2].map((i) => <Skeleton key={i} h={110} radius={20} />)}</View>
          ) : (
            <>
              {/* ══ Reference ══ */}
              <Intro t={intro} at={0.16} span={0.42} y={22}>
                <CopyCode code={reference} label="Booking reference · tap to copy" />
              </Intro>

              {/* ══ Progress rail ══ */}
              <Intro t={intro} at={0.24} span={0.42} y={22}>
                <Timeline row={row} tickets={tickets} scanned={scanned} state={state} />
              </Intro>

              {/* ══ Receipt ══ */}
              <Intro t={intro} at={0.32} span={0.42} y={22}>
                <View style={{ borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, overflow: "hidden" }}>
                  <DottedGrid color={c.accent} opacity={0.07} gap={20} r={1} />
                  <View style={{ padding: 16, paddingBottom: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                      <Receipt size={14} color={c.accent} />
                      <Txt size={10.5} font="monoMed" tone="accent" tracking={2.2} uppercase>Receipt</Txt>
                    </View>
                    <View style={{ gap: 9, marginTop: 14 }}>
                      <Line label={`${titleCase(type)} × ${qty}`} value={formatINR(subtotal)} />
                      {discount > 0 ? <Line label="Coin discount" value={`− ${formatINR(discount)}`} tone="success" /> : null}
                      {row.convenience_fee ? <Line label="Convenience fee" value={formatINR(row.convenience_fee)} /> : null}
                      {row.tax_amount ? <Line label="GST" value={formatINR(row.tax_amount)} /> : null}
                    </View>
                  </View>
                  <Perforation color={c.border} bg={c.bg} />
                  <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", padding: 16, paddingTop: 12 }}>
                    <View>
                      <Txt size={9.5} font="monoMed" tone="subtle" tracking={1.8} uppercase>
                        {state === "pending" ? "Amount due" : state === "refunded" ? "Refunded" : "Total paid"}
                      </Txt>
                      <Txt size={13} tone="muted" style={{ marginTop: 3 }}>{row.payment_method ? titleCase(row.payment_method) : state === "free" ? "No payment needed" : "Razorpay"}</Txt>
                    </View>
                    <Txt size={27} font="display" tracking={-0.8} style={{ color: state === "pending" ? c.warning : c.fg }}>{formatINR(total)}</Txt>
                  </View>
                </View>
              </Intro>

              {/* ══ The passes ══ */}
              {tickets.length ? (
                <Intro t={intro} at={0.4} span={0.42} y={22}>
                  <View style={{ gap: 10 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Txt size={16} font="sansBold">{tickets.length === 1 ? "Your pass" : `Your ${tickets.length} passes`}</Txt>
                      {scanned ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 999, backgroundColor: c.success + "18", paddingHorizontal: 8, paddingVertical: 3 }}>
                          <ScanLine size={11} color={c.success} />
                          <Txt size={10} font="sansBold" style={{ color: c.success }}>{scanned} checked in</Txt>
                        </View>
                      ) : null}
                      <View style={{ flex: 1 }} />
                    </View>
                    {tickets.map((t, i) => <TicketRow key={t.ticket_ref || i} t={t} onPress={() => openTicket(t)} />)}
                  </View>
                </Intro>
              ) : state === "pending" ? (
                <Intro t={intro} at={0.4} span={0.42} y={22}>
                  <View style={{ flexDirection: "row", gap: 11, borderRadius: 18, borderWidth: 1, borderColor: c.warning + "55", backgroundColor: c.warning + "14", padding: 14 }}>
                    <Clock size={17} color={c.warning} />
                    <Txt size={13} lh={19} style={{ flex: 1 }}>Passes are issued the moment payment clears. Finish the payment below and they'll land here.</Txt>
                  </View>
                </Intro>
              ) : null}

              {/* ══ Actions ══ */}
              <Intro t={intro} at={0.48} span={0.42} y={22}>
                <View style={{ gap: 10, marginTop: 2 }}>
                  {state === "pending" ? (
                    <>
                      <Button
                        label={busy === "pay" ? "Opening checkout…" : `Pay with Razorpay · ${formatINR(total)}`}
                        onPress={pay}
                        disabled={!!busy}
                        icon={<CreditCard size={16} color={c.onAccent} />}
                      />
                      <Button
                        label={busy === "recheck" ? "Rechecking…" : "Already paid? Recheck payment"}
                        variant="ghost"
                        onPress={recheck}
                        disabled={!!busy}
                        icon={<RefreshCw size={15} color={c.fgMuted} />}
                      />
                    </>
                  ) : null}

                  {isCancellable(row) ? (
                    confirming ? (
                      <View style={{ borderRadius: 18, borderWidth: 1, borderColor: c.danger + "55", backgroundColor: c.danger + "12", padding: 14, gap: 12 }}>
                        <Txt size={13.5} lh={19}>Cancel this booking? Passes are voided immediately and this can't be undone.</Txt>
                        <View style={{ flexDirection: "row", gap: 10 }}>
                          <View style={{ flex: 1 }}><Button label="Keep it" variant="outline" size="sm" onPress={() => setConfirming(false)} /></View>
                          <View style={{ flex: 1 }}><DangerBtn label={busy === "cancel" ? "Cancelling…" : "Yes, cancel"} onPress={cancel} disabled={!!busy} solid /></View>
                        </View>
                      </View>
                    ) : (
                      <DangerBtn label="Cancel booking" onPress={() => { Haptics.selectionAsync().catch(() => {}); setConfirming(true); }} />
                    )
                  ) : null}

                  {ev.eventId ? (
                    <Button label="View event" variant="ghost" onPress={() => router.push(`/(user)/events/${ev.eventId}`)} />
                  ) : null}
                </View>
              </Intro>

              <Txt size={11.5} tone="subtle" lh={17} align="center" style={{ marginTop: 2 }}>
                Booked {formatDateTime(row.created_at || row.booked_at)}
              </Txt>
            </>
          )}
        </View>
      </ScrollView>

      {checkout.sheet}
      <ShareSheet
        visible={share}
        onClose={() => setShare(false)}
        title="Share booking"
        subtitle={ev.title}
        message={`I'm going to ${ev.title}${ev.date ? ` on ${formatEventDate(ev.date)}` : ""}! Booking ${reference}.`}
        url={ev.eventId ? `https://upgradetalents.in/events/${ev.eventId}` : undefined}
      />
    </View>
  );
}

/* Button has no danger variant, and one destructive action is not reason to
   add a tone to every button in the app. */
function DangerBtn({ label, onPress, disabled, solid }: { label: string; onPress: () => void; disabled?: boolean; solid?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={() => { if (!disabled) onPress(); }}
      style={({ pressed }) => ({
        height: solid ? 42 : 50, borderRadius: 999, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
        borderWidth: 1, borderColor: c.danger + (solid ? "" : "66"),
        backgroundColor: solid ? c.danger : c.danger + "12",
        opacity: disabled ? 0.55 : pressed ? 0.8 : 1,
      })}
    >
      {!solid ? <XCircle size={16} color={c.danger} /> : null}
      <Txt size={solid ? 13 : 14} font="sansBold" style={{ color: solid ? "#fff" : c.danger }}>{label}</Txt>
    </Pressable>
  );
}

function HeroMeta({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, maxWidth: SCREEN_W - 80 }}>
      {icon}
      <Txt size={12.5} font="sansMed" numberOfLines={1} style={{ color: "rgba(255,255,255,0.82)" }}>{text}</Txt>
    </View>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: "success" }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Txt size={13.5} tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>{label}</Txt>
      <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
      <Txt size={13.5} font="monoMed" style={{ color: tone === "success" ? c.success : c.fg }}>{value}</Txt>
    </View>
  );
}

/** Clean District status badge */
function Stamp({ state }: { state: ReturnType<typeof bookingState> }) {
  const map = {
    confirmed: { text: "CONFIRMED", color: "#4ade80", bg: "rgba(74, 222, 128, 0.18)" },
    free: { text: "FREE ENTRY", color: "#4ade80", bg: "rgba(74, 222, 128, 0.18)" },
    pending: { text: "UNPAID", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.18)" },
    cancelled: { text: "CANCELLED", color: "#f87171", bg: "rgba(248, 113, 113, 0.18)" },
    refunded: { text: "REFUNDED", color: "#7dd3fc", bg: "rgba(125, 211, 252, 0.18)" },
  } as const;
  const s = map[state];
  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 86,
        right: 18,
      }}
    >
      <View style={{ borderWidth: 1, borderColor: s.color + "66", backgroundColor: s.bg, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 }}>
        <Txt size={11} font="sansBold" tracking={1.5} style={{ color: s.color }}>{s.text}</Txt>
      </View>
    </View>
  );
}

/**
 * Booked → Paid → Issued → Checked in. The rail draws itself up to whichever
 * step the booking has actually reached, so progress is read at a glance.
 */
function Timeline({ row, tickets, scanned, state }: { row: BookingRow; tickets: MyTicket[]; scanned: number; state: ReturnType<typeof bookingState> }) {
  const { c } = useTheme();
  const cancelled = state === "cancelled";
  const steps = [
    { label: "Booked", at: row.created_at || row.booked_at, done: true },
    { label: state === "free" ? "No payment needed" : "Payment received", at: row.paid_at || row.payment_date, done: state === "confirmed" || state === "free" || state === "refunded" },
    { label: tickets.length ? `${tickets.length} pass${tickets.length > 1 ? "es" : ""} issued` : "Passes issued", at: tickets[0]?.issued_at, done: tickets.length > 0 },
    { label: scanned ? `Checked in (${scanned}/${tickets.length})` : "Checked in at the gate", at: null, done: scanned > 0 && scanned === tickets.length },
  ];
  const reached = cancelled ? 1 : steps.filter((s) => s.done).length;

  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 900, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [reached]);

  const ROW = 44;
  const railH = (steps.length - 1) * ROW;

  return (
    <View style={{ borderRadius: 22, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 16 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 14 }}>
        <ShieldCheck size={14} color={cancelled ? c.danger : c.success} />
        <Txt size={10.5} font="monoMed" tracking={2.2} uppercase style={{ color: cancelled ? c.danger : c.success }}>
          {cancelled ? "Cancelled" : "Progress"}
        </Txt>
      </View>

      <View style={{ flexDirection: "row" }}>
        {/* the rail */}
        <View style={{ width: 20, alignItems: "center" }}>
          <View style={{ position: "absolute", top: 7, width: 2, height: railH, backgroundColor: c.border, borderRadius: 2 }} />
          <Animated.View
            style={{
              position: "absolute", top: 7, width: 2, borderRadius: 2,
              backgroundColor: cancelled ? c.danger : c.success,
              height: a.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, (reached - 1) * ROW)] }),
            }}
          />
          {steps.map((s, i) => (
            <View key={i} style={{ height: i === steps.length - 1 ? 14 : ROW, justifyContent: "flex-start" }}>
              <View
                style={{
                  width: 14, height: 14, borderRadius: 999, alignItems: "center", justifyContent: "center",
                  borderWidth: 2,
                  borderColor: cancelled && i > 0 ? c.border : s.done ? (c.success) : c.border,
                  backgroundColor: cancelled && i > 0 ? c.surface : s.done ? c.success : c.surface,
                }}
              >
                {s.done && !(cancelled && i > 0) ? <View style={{ width: 4, height: 4, borderRadius: 999, backgroundColor: c.surface }} /> : null}
              </View>
            </View>
          ))}
        </View>

        {/* the labels */}
        <View style={{ flex: 1, marginLeft: 10 }}>
          {steps.map((s, i) => {
            const live = s.done && !(cancelled && i > 0);
            return (
              <View key={i} style={{ height: i === steps.length - 1 ? undefined : ROW }}>
                <Txt size={13.5} font={live ? "sansSemi" : "sans"} tone={live ? undefined : "subtle"} numberOfLines={1}>{s.label}</Txt>
                {s.at ? <Txt size={11} font="mono" tone="subtle" style={{ marginTop: 2 }}>{formatDateTime(s.at)}</Txt> : null}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

/** A pass in the booking — its own colourway, so it matches the wallet. */
function TicketRow({ t, onPress }: { t: MyTicket; onPress: () => void }) {
  const { c } = useTheme();
  const way = bookingWay({}, [t]);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, borderWidth: 1, borderColor: c.border, backgroundColor: c.surface, padding: 12, opacity: t.is_checked_in ? 0.75 : 1 }}>
        <LinearGradient colors={way.grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" }}>
          <TicketIcon size={19} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Txt size={14.5} font="sansSemi" numberOfLines={1}>{t.holder_name || "Guest"}</Txt>
          <Txt size={11} font="mono" tone="subtle" style={{ marginTop: 2 }} numberOfLines={1}>{t.ticket_ref}</Txt>
        </View>
        {t.is_checked_in ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <CheckCircle2 size={14} color={c.success} />
            <Txt size={10.5} font="sansBold" style={{ color: c.success }}>USED</Txt>
          </View>
        ) : null}
        <ChevronRight size={17} color={c.fgSubtle} />
      </View>
    </Pressable>
  );
}
