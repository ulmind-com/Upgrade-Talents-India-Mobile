import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
  Alert as RNAlert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import QRCode from "react-native-qrcode-svg";
import {
  ArrowLeft,
  Share2,
  MoreVertical,
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  Clock,
  XCircle,
  RefreshCw,
  CreditCard,
  Ticket as TicketIcon,
  Download,
  CalendarDays,
  MapPin,
  CheckCircle2,
  Maximize2,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { bookingsApi, paymentsApi, safe, type MyTicket } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { useCheckout } from "@/lib/useCheckout";
import { Txt, Button, Skeleton, EmptyState } from "@/components/ui";
import { ShareSheet } from "@/components/ShareSheet";
import { usePopup } from "@/components/Popup";
import { formatINR, formatEventDate, parseDate, titleCase } from "@/lib/format";
import {
  bookingId,
  bookingState,
  bookingWay,
  eventOf,
  ticketsOf,
  isCancellable,
  type BookingRow,
} from "@/lib/booking";

const SCREEN_W = Dimensions.get("window").width;

function formatOrderDateTime(input?: string | null) {
  const d = parseDate(input);
  if (!d) return "Recently";
  const dateStr = d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr} at ${timeStr}`;
}

function getPaymentMethodLabel(method?: string, state?: string, provider?: string) {
  const m = String(method || provider || "").toUpperCase();
  if (state === "free") return "Free Pass Entry";
  if (m.includes("BHIM")) return "Paid via BHIM UPI";
  if (m.includes("RAZORPAY")) return "Paid via Razorpay UPI";
  if (m.includes("UPI")) return "Paid via UPI";
  if (m.includes("CASH")) return "Cash on Entry";
  if (m.includes("ONLINE")) return "Paid via Razorpay UPI";
  return "Paid via Razorpay UPI";
}

export default function BookingDetail() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  /* Parallax: the green glow and the confirmation hero drift slower than the
     page and fade, the mini pass lags a little, and the order sheet slides up
     over them. All on the native driver. */
  const scrollY = useRef(new Animated.Value(0)).current;
  const onScroll = useMemo(
    () => Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true }),
    [scrollY]
  );
  const glowY = scrollY.interpolate({ inputRange: [-200, 0, 400], outputRange: [0, 0, -200], extrapolate: "clamp" });
  const glowScale = scrollY.interpolate({ inputRange: [-200, 0], outputRange: [1.4, 1], extrapolateRight: "clamp" });
  const heroY = scrollY.interpolate({ inputRange: [0, 220], outputRange: [0, 110], extrapolate: "clamp" });
  const heroFade = scrollY.interpolate({ inputRange: [0, 150], outputRange: [1, 0], extrapolate: "clamp" });
  const heroScale = scrollY.interpolate({ inputRange: [0, 150], outputRange: [1, 0.9], extrapolate: "clamp" });
  const passY = scrollY.interpolate({ inputRange: [0, 260], outputRange: [0, 60], extrapolate: "clamp" });
  const passFade = scrollY.interpolate({ inputRange: [60, 260], outputRange: [1, 0.25], extrapolate: "clamp" });
  const { user } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const popup = usePopup();

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

  const b = useMemo(() => {
    const list = Array.isArray(q.data) ? q.data : [];
    const tList = Array.isArray(tq.data) ? tq.data : [];
    const target = String(id || "");

    // 1. Direct match on booking reference, id, or _id
    let found = list.find(
      (r) =>
        bookingId(r) === target ||
        r.booking_reference === target ||
        r._id === target ||
        r.id === target
    );
    if (found) return found;

    // 2. Match on any ticket in the booking row
    found = list.find((r) =>
      r.tickets?.some((t: any) => String(t.ticket_ref) === target)
    );
    if (found) return found;

    // 3. Match via myTickets list (if target was a ticket_ref)
    const matchedTicket = tList.find((t) => t.ticket_ref === target);
    if (matchedTicket) {
      found = list.find(
        (r) =>
          bookingId(r) === String(matchedTicket.booking_id) ||
          r.booking_reference === String(matchedTicket.booking_id) ||
          r.booking_reference === String((matchedTicket as any).booking_ref) ||
          r.booking_reference === String((matchedTicket as any).booking_reference) ||
          r._id === String(matchedTicket.booking_id)
      );
    }
    return found;
  }, [q.data, tq.data, id]);

  const tickets = useMemo(
    () => ticketsOf(bookingId(b || {}), Array.isArray(tq.data) ? tq.data : [], b?.booking_reference),
    [tq.data, b]
  );

  const [share, setShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [busy, setBusy] = useState<"pay" | "cancel" | "recheck" | "download" | null>(null);

  const checkout = useCheckout({
    onDone: () => {
      popup.show("success", "Payment received", "Your tickets are confirmed.");
      q.reload();
      tq.reload();
    },
  });

  const loading = q.loading || tq.loading;

  if (!loading && !b) {
    return (
      <View style={{ flex: 1, backgroundColor: "#08090C", paddingTop: insets.top + 60, paddingHorizontal: 20 }}>
        <StatusBar style="light" />
        <EmptyState
          icon={<TicketIcon size={28} color="#9EA3B8" />}
          title="Order not found"
          subtitle="This booking may belong to another account or was removed."
        />
        <View style={{ marginTop: 20 }}>
          <Button label="Back to bookings" variant="outline" onPress={() => router.replace("/(more)/bookings")} />
        </View>
      </View>
    );
  }

  const row: BookingRow = b || {};
  const state = bookingState(row);
  const ev = eventOf(row, tickets);
  const qty = Number(row.quantity ?? tickets.length ?? 1) || 1;
  const rawType = row.ticket_type || tickets[0]?.ticket_type || row.category || "PLATINUM";
  const typeUpper = String(rawType).toUpperCase();
  const reference = String(row.booking_reference || bookingId(row) || id || "");

  const unit = Number(row.unit_price ?? row.ticket_price ?? tickets[0]?.base_price ?? tickets[0]?.price ?? (row.total_amount ? Math.round(row.total_amount / qty) : 0));
  const total = Number(row.total_amount ?? row.amount ?? 0);
  const discount = Number(row.discount_amount ?? row.coin_discount ?? 0);
  const fee = Number(row.convenience_fee ?? row.booking_fee ?? (row.tax_amount ? Number(row.tax_amount) : 0));
  const subtotal = unit > 0 ? unit * qty : total + discount - fee;
  const originalTotal = subtotal + fee;

  const paymentMethodLabel = getPaymentMethodLabel(row.payment_method, state, row.payment_provider);
  const bookedDateStr = formatOrderDateTime(row.confirmed_at || row.booked_at || row.created_at);

  const copyOrderId = async () => {
    try {
      await Clipboard.setStringAsync(reference);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      popup.show("info", "Order ID", reference);
    }
  };

  const isCancelled = (e: any) =>
    /dismiss|cancel|did not complete|rejected/i.test(String(e?.message || ""));

  const handleDownloadSummary = async () => {
    setBusy("download");
    try {
      Haptics.selectionAsync().catch(() => {});
      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bill Summary - ${reference}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 32px 20px; background: #08090C; color: #FFFFFF; }
    .card-wrap { max-width: 520px; margin: 0 auto; background: #13141B; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); padding: 26px; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 18px; margin-bottom: 22px; }
    .brand { font-size: 20px; font-weight: 800; color: #FF385C; letter-spacing: -0.5px; }
    .subbrand { font-size: 11px; color: #9EA3B8; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 2px; }
    .badge { background: rgba(34, 197, 94, 0.18); border: 1px solid #22C55E; color: #22C55E; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; }
    .event-title { font-size: 19px; font-weight: 700; color: #FFFFFF; margin: 0 0 4px 0; }
    .event-sub { font-size: 13px; color: #9EA3B8; margin-bottom: 22px; }
    .section-box { background: #181920; border: 1px solid rgba(255,255,255,0.06); border-radius: 18px; padding: 18px; margin-bottom: 18px; }
    .sec-title { font-size: 14px; font-weight: 700; color: #FFFFFF; margin-bottom: 14px; text-transform: uppercase; letter-spacing: 0.8px; }
    .line { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; }
    .line-sub { color: #8E92A0; font-size: 12px; margin-top: -4px; margin-bottom: 12px; }
    .hr { height: 1px; background: rgba(255,255,255,0.08); margin: 14px 0; }
    .total-line { display: flex; justify-content: space-between; align-items: flex-start; }
    .total-title { font-size: 15px; font-weight: 700; color: #FFFFFF; }
    .total-val { text-align: right; }
    .strike { font-size: 13px; color: #71768A; text-decoration: line-through; margin-right: 6px; }
    .final-price { font-size: 19px; font-weight: 800; color: #FFFFFF; }
    .saved-pill { display: inline-block; background: rgba(192, 132, 252, 0.18); color: #C084FC; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; margin-top: 5px; }
    .footer { text-align: center; margin-top: 24px; font-size: 11px; color: #64748B; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 16px; }
  </style>
</head>
<body>
  <div class="card-wrap">
    <div class="header">
      <div>
        <div class="brand">UPGRADE TALENTS INDIA</div>
        <div class="subbrand">Official Bill Summary & Receipt</div>
      </div>
      <div class="badge">${state === "confirmed" ? "Confirmed" : state === "free" ? "Free Entry" : state.toUpperCase()}</div>
    </div>

    <div class="event-title">${ev.title}</div>
    <div class="event-sub">${ev.date ? formatEventDate(ev.date) + " · " : ""}${ev.venue || "Official Venue"}</div>

    <div class="section-box">
      <div class="sec-title">Order Information</div>
      <div class="line">
        <span style="color:#8E92A0">Order ID</span>
        <span style="font-weight:600;font-family:monospace">${reference}</span>
      </div>
      <div class="line">
        <span style="color:#8E92A0">Attendee</span>
        <span>${user?.name || row.user_name || "Primary Attendee"}</span>
      </div>
      <div class="line">
        <span style="color:#8E92A0">Booking Date</span>
        <span>${bookedDateStr}</span>
      </div>
    </div>

    <div class="section-box">
      <div class="sec-title">Bill Summary</div>
      <div class="line">
        <span style="font-weight:600">Tickets</span>
        <span style="font-weight:600">₹${subtotal.toFixed(2)}</span>
      </div>
      <div class="line-sub">${qty} x ${typeUpper} tickets @ ₹${unit} each</div>

      ${discount > 0 ? `
      <div class="line">
        <span style="color:#FFFFFF">Promo Code / Coin Discount</span>
        <span style="color:#C084FC;font-weight:700">- ₹${discount.toFixed(2)}</span>
      </div>` : ""}

      <div class="line">
        <span style="color:#D1D5DB">Booking charge (inc. of GST)</span>
        <span>₹${fee.toFixed(2)}</span>
      </div>

      <div class="hr"></div>

      <div class="total-line">
        <div class="total-title">Total Amount Paid</div>
        <div class="total-val">
          ${discount > 0 ? `<span class="strike">₹${originalTotal.toFixed(2)}</span>` : ""}
          <span class="final-price">₹${total.toFixed(2)}</span>
          ${discount > 0 ? `<br><span class="saved-pill">You saved ₹${discount.toFixed(2)}</span>` : ""}
        </div>
      </div>
    </div>

    <div class="section-box">
      <div class="sec-title">Payment Details</div>
      <div class="line">
        <span style="font-weight:600">${paymentMethodLabel}</span>
        <span style="font-weight:600">₹${total.toFixed(2)}</span>
      </div>
      <div style="font-size:12px;color:#8E92A0;margin-top:4px">${bookedDateStr}</div>
    </div>

    <div class="footer">
      Upgrade Talents India · GST Inclusive official invoice · support@upgradetalents.in
    </div>
  </div>
</body>
</html>
      `;

      const file = await Print.printToFileAsync({ html, base64: true });
      const safeRef = (reference || "order").replace(/[^a-zA-Z0-9-]/g, "");
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      let targetUri = file.uri;
      if (dir && file.base64) {
        const dest = `${dir}UTI_Bill_Summary_${safeRef}.pdf`;
        await FileSystem.writeAsStringAsync(dest, file.base64, { encoding: "base64" });
        targetUri = dest;
      }

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, {
          mimeType: "application/pdf",
          dialogTitle: `Bill Summary - ${reference}`,
        });
      } else {
        popup.show("success", "Summary generated", "File ready for download.");
      }
    } catch (e: any) {
      if (!isCancelled(e)) {
        popup.show("error", "Couldn't export summary", e?.message || "Please try again.");
      }
    } finally {
      setBusy(null);
    }
  };

  const showMoreOptions = () => {
    Haptics.selectionAsync().catch(() => {});
    RNAlert.alert(
      "Order Options",
      `Order ID: ${reference}`,
      [
        { text: "Copy Order ID", onPress: copyOrderId },
        { text: "Share Order", onPress: () => setShare(true) },
        ev.eventId ? { text: "View Event Details", onPress: () => router.push(`/(user)/events/${ev.eventId}`) } : { text: "Cancel", style: "cancel" },
        isCancellable(row) ? { text: "Cancel Booking", style: "destructive", onPress: () => setConfirmingCancel(true) } : { text: "Close", style: "cancel" },
      ].filter(Boolean) as any
    );
  };

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
      q.reload();
      tq.reload();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      popup.show("success", "Payment rechecked", "Your passes will update momentarily.");
    } catch (e: any) {
      popup.show("error", "Couldn't recheck", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy("cancel");
    try {
      await bookingsApi.cancel(bookingId(row));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      popup.show("success", "Booking cancelled", "Any refundable amount will be processed as per policy.");
      setConfirmingCancel(false);
      q.reload();
      tq.reload();
    } catch (e: any) {
      popup.show("error", "Couldn't cancel", e?.message || "Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const openTicket = (t: MyTicket) =>
    router.push({
      pathname: "/(more)/ticket/[ref]",
      params: {
        ref: t.ticket_ref,
        type: t.ticket_type || typeUpper,
        holder: t.holder_name || user?.name || row.user_name || "Guest",
        issued: t.issued_at || row.created_at || row.booked_at,
        checked: t.is_checked_in ? "1" : "0",
        event_id: t.event_id || row.event_id || ev.eventId,
        event_title: t.event_title || row.event_title || ev.title,
        event_date: t.event_date || row.event_date || ev.date,
        event_time: t.event_time || row.event_time || ev.time,
        event_venue: t.event_venue || row.event_venue || ev.venue,
        event_cover: t.event_cover || row.event_cover || ev.cover,
        price: String(t.total_amount ?? t.price ?? row.total_amount ?? ""),
      },
    });

  return (
    <View style={{ flex: 1, backgroundColor: "#0B0C10" }}>
      <StatusBar style="light" />

      {/* ── Rich Dark-Green Atmospheric Gradient at the top (matching SS 1) ── */}
      <Animated.View
        pointerEvents="none"
        style={{ position: "absolute", top: 0, left: 0, right: 0, height: 380, transform: [{ translateY: glowY }, { scale: glowScale }] }}
      >
        <LinearGradient
          colors={["#0c4224", "#082d18", "#061f12", "#0B0C10"]}
          locations={[0, 0.45, 0.8, 1]}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* ── Top Header Bar ── */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingHorizontal: 20,
          paddingBottom: 12,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          zIndex: 10,
        }}
      >
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(more)/bookings"))}
          hitSlop={12}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255,255,255,0.06)",
            transform: [{ scale: pressed ? 0.94 : 1 }],
          })}
        >
          <ArrowLeft size={22} color="#FFFFFF" />
        </Pressable>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <Pressable
            onPress={() => setShare(true)}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <Share2 size={20} color="#FFFFFF" />
          </Pressable>

          <Pressable
            onPress={showMoreOptions}
            hitSlop={12}
            style={({ pressed }) => ({
              width: 42,
              height: 42,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(255,255,255,0.06)",
              transform: [{ scale: pressed ? 0.94 : 1 }],
            })}
          >
            <MoreVertical size={20} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        scrollEventThrottle={16}
        onScroll={onScroll}
      >
        {/* ── Confirmation Hero (Smooth dark green atmosphere, skeleton on initial load) ── */}
        <Animated.View style={{ alignItems: "center", paddingTop: 18, paddingBottom: 22, opacity: heroFade, transform: [{ translateY: heroY }, { scale: heroScale }] }}>
          {loading ? (
            <View style={{ alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
              />
              <View
                style={{
                  width: 170,
                  height: 22,
                  borderRadius: 6,
                  backgroundColor: "rgba(255,255,255,0.08)",
                  marginTop: 4,
                }}
              />
            </View>
          ) : (
            <>
              {/* District Status Badge */}
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 999,
                  backgroundColor: state === "pending" ? "#F59E0B" : state === "cancelled" ? "#EF4444" : "#16A34A",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {state === "pending" ? (
                  <Clock size={26} color="#0B0C10" strokeWidth={2.6} />
                ) : state === "cancelled" ? (
                  <XCircle size={26} color="#FFFFFF" strokeWidth={2.6} />
                ) : (
                  <Check size={26} color="#0B0C10" strokeWidth={3} />
                )}
              </View>

              <Txt
                size={19}
                font="sansBold"
                style={{ color: "#FFFFFF", marginTop: 12, letterSpacing: -0.2 }}
              >
                {state === "pending" ? "Payment pending" : state === "cancelled" ? "Booking cancelled" : state === "refunded" ? "Booking refunded" : "Booking confirmed"}
              </Txt>
            </>
          )}
        </Animated.View>

        {/* ── Mini Pass Card (as shown in District screenshot SS 1) ── */}
        {!loading && b && tickets.length > 0 ? (
          <Animated.View style={{ paddingHorizontal: 20, marginBottom: 20, opacity: passFade, transform: [{ translateY: passY }] }}>
            <Pressable
              onPress={() => openTicket(tickets[0])}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#161720",
                borderRadius: 22,
                padding: 14,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.08)",
                gap: 14,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              })}
            >
              <View
                style={{
                  backgroundColor: "#ffffff",
                  padding: 6,
                  borderRadius: 12,
                  borderWidth: 1.5,
                  borderColor: "#A855F7",
                }}
              >
                <QRCode value={tickets[0]?.ticket_ref || reference} size={48} backgroundColor="#ffffff" color="#000000" />
              </View>

              <View style={{ flex: 1 }}>
                <Txt size={11} font="monoMed" style={{ color: "#9EA3B8" }}>
                  {qty} {qty > 1 ? "tickets" : "ticket"} • {ev.date ? formatEventDate(ev.date) : "Valid Pass"}
                </Txt>
                <Txt size={15} font="sansBold" style={{ color: "#ffffff", marginTop: 2 }} numberOfLines={1}>
                  {ev.title}
                </Txt>
                <Txt size={12} style={{ color: "#8E92A0", marginTop: 2 }} numberOfLines={1}>
                  {ev.venue || "Official Venue"}
                </Txt>
              </View>

              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Maximize2 size={14} color="#9EA3B8" />
              </View>
            </Pressable>
          </Animated.View>
        ) : null}

        {/* ── District Sheet Body ── */}
        <View
          style={{
            backgroundColor: "#13141B",
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.08)",
            paddingHorizontal: 20,
            paddingTop: 24,
            paddingBottom: 36,
          }}
        >
          {loading ? (
            <View style={{ gap: 14 }}>
              <Skeleton h={50} radius={14} />
              <Skeleton h={190} radius={20} />
              <Skeleton h={120} radius={20} />
            </View>
          ) : (
            <>
              {/* ── Order details Header & Copy Order ID ── */}
              <View style={{ marginBottom: 24 }}>
                <Txt size={21} font="sansBold" style={{ color: "#FFFFFF", letterSpacing: -0.4 }}>
                  Order details
                </Txt>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <Txt size={13.5} font="monoMed" style={{ color: "#9EA3B8" }}>
                    Order ID: {reference}
                  </Txt>
                  <Pressable
                    onPress={copyOrderId}
                    hitSlop={10}
                    style={({ pressed }) => ({
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      padding: 4,
                      borderRadius: 6,
                      backgroundColor: copied ? "rgba(34, 197, 94, 0.15)" : "transparent",
                      transform: [{ scale: pressed ? 0.92 : 1 }],
                    })}
                  >
                    {copied ? (
                      <Check size={14} color="#22C55E" strokeWidth={2.5} />
                    ) : (
                      <Copy size={14} color="#9EA3B8" />
                    )}
                    {copied ? (
                      <Txt size={11} font="sansBold" style={{ color: "#22C55E" }}>
                        Copied
                      </Txt>
                    ) : null}
                  </Pressable>
                </View>
              </View>

              {/* ── 1. Bill Summary ── */}
              <View style={{ marginBottom: 26 }}>
                <Txt size={16} font="sansBold" style={{ color: "#FFFFFF", marginBottom: 12 }}>
                  Bill Summary
                </Txt>

                <View
                  style={{
                    backgroundColor: "#181920",
                    borderRadius: 20,
                    padding: 18,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Tickets line */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Txt size={14.5} font="sansBold" style={{ color: "#FFFFFF" }}>
                      Tickets
                    </Txt>
                    <Txt size={14.5} font="sansBold" style={{ color: "#FFFFFF" }}>
                      {formatINR(subtotal)}
                    </Txt>
                  </View>
                  <Txt size={12.5} style={{ color: "#8E92A0", marginTop: 4 }}>
                    {qty} x {typeUpper} tickets @ {formatINR(unit)} each
                  </Txt>

                  {/* Promo Code / UTI Coins Discount */}
                  {discount > 0 ? (
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                      <Txt size={13.5} font="sansMed" style={{ color: "#FFFFFF" }}>
                        Promo Code: {row.promo_code || "RAMAYANA200"}
                      </Txt>
                      <Txt size={14} font="sansBold" style={{ color: "#C084FC" }}>
                        - {formatINR(discount)}
                      </Txt>
                    </View>
                  ) : null}

                  {/* Booking charge (inc. of GST) */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Txt size={13.5} style={{ color: "#D1D5DB" }}>
                        Booking charge(inc. of GST)
                      </Txt>
                      <ChevronDown size={14} color="#8E92A0" />
                    </View>
                    <Txt size={13.5} font="sansMed" style={{ color: "#FFFFFF" }}>
                      {fee > 0 ? formatINR(fee) : "₹0"}
                    </Txt>
                  </View>

                  {/* Hairline Divider */}
                  <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 16 }} />

                  {/* Total Amount Paid */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <Txt size={15} font="sansBold" style={{ color: "#FFFFFF" }}>
                      Total Amount Paid
                    </Txt>

                    <View style={{ alignItems: "flex-end" }}>
                      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                        {discount > 0 ? (
                          <Txt
                            size={14}
                            style={{
                              color: "#71768A",
                              textDecorationLine: "line-through",
                            }}
                          >
                            {formatINR(originalTotal)}
                          </Txt>
                        ) : null}
                        <Txt size={18} font="sansBold" style={{ color: "#FFFFFF" }}>
                          {formatINR(total)}
                        </Txt>
                      </View>

                      {discount > 0 ? (
                        <View
                          style={{
                            marginTop: 5,
                            backgroundColor: "rgba(192, 132, 252, 0.16)",
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 999,
                          }}
                        >
                          <Txt size={11} font="sansBold" style={{ color: "#C084FC" }}>
                            You saved {formatINR(discount)}
                          </Txt>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              </View>

              {/* ── 2. Payment Details ── */}
              <View style={{ marginBottom: 26 }}>
                <Txt size={16} font="sansBold" style={{ color: "#FFFFFF", marginBottom: 12 }}>
                  Payment Details
                </Txt>

                <View
                  style={{
                    backgroundColor: "#181920",
                    borderRadius: 20,
                    padding: 18,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.06)",
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Txt size={14.5} font="sansBold" style={{ color: "#FFFFFF" }}>
                      {paymentMethodLabel}
                    </Txt>
                    <Txt size={14.5} font="sansBold" style={{ color: "#FFFFFF" }}>
                      {formatINR(total)}
                    </Txt>
                  </View>

                  <Txt size={12.5} style={{ color: "#8E92A0", marginTop: 10 }}>
                    {bookedDateStr}
                  </Txt>
                </View>
              </View>

              {/* ── Pending Payment CTAs if unpaid ── */}
              {state === "pending" ? (
                <View style={{ gap: 10, marginBottom: 20 }}>
                  <Button
                    label={busy === "pay" ? "Opening checkout…" : `Pay with Razorpay · ${formatINR(total)}`}
                    onPress={pay}
                    disabled={!!busy}
                    icon={<CreditCard size={16} color="#0B0C10" />}
                  />
                  <Button
                    label={busy === "recheck" ? "Rechecking…" : "Already paid? Recheck payment"}
                    variant="ghost"
                    onPress={recheck}
                    disabled={!!busy}
                    icon={<RefreshCw size={15} color="#9EA3B8" />}
                  />
                </View>
              ) : null}

              {/* ── Cancellation warning box ── */}
              {confirmingCancel ? (
                <View
                  style={{
                    borderRadius: 18,
                    borderWidth: 1,
                    borderColor: "rgba(239, 68, 68, 0.4)",
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    padding: 16,
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  <Txt size={13.5} lh={19} style={{ color: "#FFFFFF" }}>
                    Cancel this booking? All digital entry passes will be permanently voided.
                  </Txt>
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Button label="Keep booking" variant="outline" size="sm" onPress={() => setConfirmingCancel(false)} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Pressable
                        onPress={cancel}
                        disabled={!!busy}
                        style={{
                          height: 40,
                          borderRadius: 999,
                          backgroundColor: "#EF4444",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Txt size={13} font="sansBold" style={{ color: "#FFFFFF" }}>
                          {busy === "cancel" ? "Cancelling…" : "Yes, cancel"}
                        </Txt>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>
      </Animated.ScrollView>

      {/* ── Bottom Fixed CTA: Download bill summary (Solid White Pill Button) ── */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 20,
          paddingTop: 14,
          paddingBottom: insets.bottom + 12,
          backgroundColor: "rgba(11, 12, 16, 0.95)",
          borderTopWidth: 1,
          borderTopColor: "rgba(255, 255, 255, 0.08)",
        }}
      >
        <Pressable
          onPress={handleDownloadSummary}
          disabled={busy === "download"}
          style={({ pressed }) => ({
            height: 52,
            borderRadius: 999,
            backgroundColor: "#FFFFFF",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "row",
            gap: 8,
            transform: [{ scale: pressed ? 0.98 : 1 }],
            opacity: busy === "download" ? 0.7 : 1,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 6,
          })}
        >
          <Download size={18} color="#0B0C10" />
          <Txt size={15} font="sansBold" style={{ color: "#0B0C10" }}>
            {busy === "download" ? "Generating summary…" : "Download bill summary"}
          </Txt>
        </Pressable>
      </View>

      {checkout.sheet}
      <ShareSheet
        visible={share}
        onClose={() => setShare(false)}
        title="Share booking"
        subtitle={ev.title}
        message={`I'm attending ${ev.title}! Booking ref: ${reference}. Book yours on Upgrade Talents India!`}
        url={ev.eventId ? `https://upgradetalents.in/events/${ev.eventId}` : undefined}
      />
    </View>
  );
}
