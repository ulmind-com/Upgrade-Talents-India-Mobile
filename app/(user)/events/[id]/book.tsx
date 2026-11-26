import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Pressable, ScrollView, useWindowDimensions, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import ConfettiCannon from "react-native-confetti-cannon";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import LottieView from "lottie-react-native";
import { useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import {
  ArrowLeft, ArrowRight, Banknote, ImageDown, Check, Clock, CreditCard, MapPin, Ticket as TicketIcon, X, CalendarDays,
} from "lucide-react-native";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { activitiesApi, bookingsApi, paymentsApi, safe, ApiError, type TicketTier } from "@/lib/api";
import { getEventById } from "@/lib/events";
import { useRealtime } from "@/lib/realtime";
import { buildTiers, rowsForTier, zoneFor, MAX_SEATS, type PickedSeat, type SeatRow } from "@/lib/seating";
import { SeatMap, PICK, type SeatMapHandle, type SeatTap } from "@/components/booking/SeatMap";
import { Txt, Button, Input, Skeleton, GradientText, Glow } from "@/components/ui";
import { AppImage } from "@/components/AppImage";
import { ShareImageSheet } from "@/components/share/ShareImageSheet";
import { SeatShareCard } from "@/components/share/SeatShareCard";
import { useAlert } from "@/components/Popup";
import {
  RazorpayCheckout, DEFAULT_RAZORPAY_KEY, isValidRazorpayOrderId, type RazorpayOptions, type RazorpaySuccess,
} from "@/components/RazorpayCheckout";
import { formatINR, formatEventDate, isBookable, isPastEvent } from "@/lib/format";

/* ──────────────────────────────────────────────────────────────────────────
   Event booking — the website's three steps, built for a phone:

     1 Choose your place   live arena, pinch-zoom, 5-minute seat hold
     2 Payment             a name for every seat · online or cash at venue
     3 Ticket              confirmation, straight into My Tickets

   Same backend contract as the website: seats are held with a per-visit
   hold token (POST hold-seats / release-seats), the map refreshes on the
   event's realtime channel, and the booking carries seats + category +
   payment_method ("ONLINE" → Razorpay, "CASH" → confirmed, pay at the gate).
   ────────────────────────────────────────────────────────────────────────── */

const STEPS = ["Choose your place", "Payment", "Ticket"] as const;
/** One hold token per event for this app session, so coming back keeps your seats. */
const HOLD_TOKENS = new Map<string, string>();

type Result = { ref: string; bookingId?: string; method: "ONLINE" | "CASH" | "FREE"; seats: string[]; total: number; verified: boolean };

export default function Book() {
  const { c } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = String(id);
  const { user } = useSession();
  const alert = useAlert();
  const fail = (title: string, m: string) => alert("error", title, m);

  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [event, setEvent] = useState<any | null>(null);
  const [tiers, setTiers] = useState<TicketTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<PickedSeat[]>([]);
  const [nameBy, setNameBy] = useState<Record<string, string>>({});
  const [method, setMethod] = useState<"ONLINE" | "CASH">("ONLINE");
  const [holdExp, setHoldExp] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pay, setPay] = useState<{ options: RazorpayOptions; bookingId: string; reference?: string } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const mapRef = useRef<SeatMapHandle>(null);
  const [shareMap, setShareMap] = useState(false);
  const done = useRef(false);
  const player = useAudioPlayer(require("../../../../assets/sounds/success.wav"));

  const holdToken = useMemo(() => {
    let t = HOLD_TOKENS.get(eventId);
    if (!t) {
      t = Crypto.randomUUID();
      HOLD_TOKENS.set(eventId, t);
    }
    return t;
  }, [eventId]);

  const closed = !!event && !isBookable(event);
  const closedLabel = event && isPastEvent(event) ? "This event has ended" : "Registration is closed";

  /* ── load: fresh event + tiers ── */
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [fresh, basic, list] = await Promise.all([
          safe(activitiesApi.eventById(eventId), null),
          getEventById(eventId),
          safe(activitiesApi.tickets(eventId, { limit: 100 }), [] as TicketTier[]),
        ]);
        // the single-event route and the listing don't always carry the same
        // fields (images especially) — merge, fresh values winning
        const ev = fresh || basic ? { ...(basic || {}), ...(fresh || {}) } : null;
        if (!live) return;
        if (!ev) throw new Error("This event couldn't be found.");
        setEvent(ev);
        setTiers(buildTiers(ev, list || []));
      } catch (e: any) {
        if (live) setLoadError(e?.message || "Could not load this event.");
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [eventId]);

  const rows = useMemo(() => {
    const m = new Map<string, SeatRow[]>();
    tiers.forEach((t, i) => m.set(t._id, rowsForTier(t, i, tiers)));
    return m;
  }, [tiers]);

  /* ── picked seats live in a ref too, so taps in quick succession never read stale state ── */
  const pickedRef = useRef<PickedSeat[]>([]);
  /* An online booking that's created but not paid yet. It reserves the seats
     server-side, so a dismissed Razorpay sheet must not lose them: "Pay"
     reopens checkout on the same booking; changing seats or switching to
     cash cancels it first. */
  const pendingRef = useRef<{ id: string; ref?: string; key: string } | null>(null);
  const commitPicked = useCallback((next: PickedSeat[]) => {
    pickedRef.current = next;
    setPicked(next);
  }, []);

  /* ── live seat state ── */
  const fetchBooked = useCallback(async () => {
    const r = await safe(activitiesApi.bookedSeats(eventId, holdToken), null);
    if (!r?.booked_seats) return;
    const set = new Set(r.booked_seats.map((x) => String(x).toUpperCase()));
    setBooked(set);
    // someone else got a seat you were eyeing first — drop it quietly
    const mine = pickedRef.current;
    if (!pendingRef.current && mine.some((x) => set.has(x.id))) commitPicked(mine.filter((x) => !set.has(x.id)));
  }, [eventId, holdToken, commitPicked]);

  useEffect(() => {
    const t = setTimeout(fetchBooked, 0);
    return () => clearTimeout(t);
  }, [fetchBooked]);
  useRealtime([`event:${eventId}`, "admin:events"], () => fetchBooked(), 3000);

  // a name per seat (kept by seat id), the first pre-filled with yours
  const names = picked.map((p, i) => nameBy[p.id] ?? (i === 0 ? user?.name || "" : ""));

  /* ── seat holds (5 minutes, renewed on every change) ── */
  const email = user?.email;
  const syncHold = useCallback(
    async (list: PickedSeat[]) => {
      if (!list.length) {
        setHoldExp(null);
        await safe(activitiesApi.releaseSeats(eventId, { hold_token: holdToken }), null);
        return;
      }
      try {
        const r = await activitiesApi.holdSeats(eventId, { seats: list.map((x) => x.id), hold_token: holdToken, user_email: email });
        if (r?.expires_in) setHoldExp(Date.now() + r.expires_in * 1000);
      } catch (e: any) {
        alert("error", "Seat just got taken", e?.message || "Someone else reserved that seat a moment ago. Pick another one.");
        fetchBooked();
      }
    },
    [eventId, holdToken, email, fetchBooked, alert]
  );

  // countdown: a clock that ticks only while a hold is running
  const [now, setNow] = useState(() => Date.now());
  const left = holdExp && step !== 2 ? Math.max(0, Math.round((holdExp - now) / 1000)) : null;
  useEffect(() => {
    if (!holdExp || step === 2) return;
    const t = setInterval(() => {
      const ts = Date.now();
      setNow(ts);
      if (ts >= holdExp && !done.current) {
        setHoldExp(null);
        commitPicked([]);
        setStep(0);
        safe(activitiesApi.releaseSeats(eventId, { hold_token: holdToken }), null);
        fetchBooked();
        alert("warning", "Seats released", "Your 5-minute hold ran out. Pick your seats again.");
      }
    }, 1000);
    return () => clearInterval(t);
  }, [holdExp, step, eventId, holdToken, commitPicked, fetchBooked, alert]);

  // leaving without booking frees the seats for everyone else
  useEffect(
    () => () => {
      if (done.current) return;
      if (pickedRef.current.length) safe(activitiesApi.releaseSeats(eventId, { hold_token: holdToken }), null);
      if (pendingRef.current) safe(bookingsApi.cancel(pendingRef.current.id), null);
    },
    [eventId, holdToken]
  );

  const onTap = useCallback(
    (t: SeatTap) => {
      if (closed) return;
      const prev = pickedRef.current;
      let next: PickedSeat[];
      if (prev.some((x) => x.id === t.id)) next = prev.filter((x) => x.id !== t.id);
      else {
        if (prev.length >= MAX_SEATS) {
          alert("info", "That's the limit", `You can book up to ${MAX_SEATS} seats at a time.`);
          return;
        }
        const z = zoneFor(t.tier.type, t.tier.price);
        next = [...prev, { id: t.id, row: t.row, num: t.num, tierId: t.tier._id, tierName: t.tier.type, price: Number(t.tier.price || 0), color: z.color }];
      }
      setNow(Date.now());
      commitPicked(next);
      syncHold(next);
    },
    [closed, syncHold, commitPicked, alert]
  );

  const mapBooked = useMemo(() => {
    if (!picked.length) return booked;
    const out = new Set(booked);
    picked.forEach((p) => out.delete(p.id));
    return out;
  }, [booked, picked]);

  const pickedOrder = useMemo(() => new Map(picked.map((p, i) => [p.id, i + 1])), [picked]);
  const total = picked.reduce((a, p) => a + p.price, 0);
  const lines = useMemo(() => {
    const m = new Map<string, { name: string; price: number; count: number; color: string }>();
    picked.forEach((p) => {
      const k = p.tierId;
      const cur = m.get(k) || { name: p.tierName, price: p.price, count: 0, color: p.color };
      cur.count++;
      m.set(k, cur);
    });
    return [...m.values()];
  }, [picked]);

  /* ── step 1 → 2 ── */
  const toPayment = () => {
    if (closed) return;
    if (!picked.length) {
      alert("info", "Pick a seat", "Tap any open seat on the map to choose your place.");
      return;
    }
    if (!user) {
      router.push({ pathname: "/(auth)/login", params: { next: `/(user)/events/${eventId}/book` } });
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setStep(1);
  };

  /* ── booking ── */
  const finish = (r: Result) => {
    done.current = true;
    pendingRef.current = null;
    setSubmitting(false);
    setResult(r);
    setStep(2);
    fetchBooked();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    try {
      player.seekTo(0);
      player.play();
    } catch {}
  };

  const book = async () => {
    if (!user) {
      router.push({ pathname: "/(auth)/login", params: { next: `/(user)/events/${eventId}/book` } });
      return;
    }
    if (closed) {
      fail("Booking closed", isPastEvent(event) ? "This event has already taken place." : `Registration closed on ${formatEventDate(event?.registration_deadline)}.`);
      return;
    }
    const missing = names.findIndex((n) => !(n || "").trim());
    if (missing !== -1) {
      fail("Add every name", `Seat ${picked[missing]?.id} needs the attendee's full name — the QR admits each guest by name at the gate.`);
      return;
    }
    const mode: "ONLINE" | "CASH" = total > 0 ? method : "ONLINE";
    const seats = picked.map((p) => p.id);
    const key = seats.join(",");
    setSubmitting(true);
    try {
      const pend = pendingRef.current;
      if (pend && pend.key === key && mode === "ONLINE") {
        await openCheckout(pend.id, pend.ref, null, seats);
        return;
      }
      if (pend) {
        await safe(bookingsApi.cancel(pend.id), null);
        pendingRef.current = null;
      }

      const booking = await bookingsApi.create({
        event_id: eventId,
        category: picked[0]?.tierName || tiers[0]?.type || "General",
        quantity: picked.length,
        holder_names: names.map((n) => n.trim()),
        seats,
        payment_method: mode,
      });

      if (!booking?.payment_info || booking?.booking_status === "CONFIRMED" || mode === "CASH") {
        finish({
          ref: booking?.booking_reference || booking?.booking_id || "CONFIRMED",
          bookingId: booking?.booking_id,
          method: total === 0 ? "FREE" : mode,
          seats,
          total,
          verified: true,
        });
        return;
      }

      pendingRef.current = { id: booking.booking_id, ref: booking.booking_reference, key };
      await openCheckout(booking.booking_id, booking.booking_reference, booking.payment_info, seats);
    } catch (e: any) {
      setSubmitting(false);
      const msg = e instanceof ApiError ? e.message : e?.message || "";
      if (/insufficient|409|reserved|taken/i.test(msg)) {
        fail("Seat conflict", "One of your seats was just claimed by someone else. The map has been refreshed — pick again.");
        fetchBooked();
        setStep(0);
      } else fail("Booking failed", msg || "Something went wrong while booking your seats.");
    }
  };

  /** Open Razorpay on a booking's order (a fresh order each time, so it's never stale). */
  const openCheckout = async (bookingId: string, reference: string | undefined, info: any, seats: string[]) => {
    try {
      const fresh = await paymentsApi.createOrder(bookingId);
      if (fresh?.order_id) info = fresh;
    } catch {}
    info = info || {};
    const k = info.key_id || info.checkout_data?.key || DEFAULT_RAZORPAY_KEY;
    if (!k) {
      setSubmitting(false);
      fail("Payments unavailable", "Online payments aren't configured yet. Choose cash at venue or contact support.");
      return;
    }
    const rawOrderId = info.checkout_data?.order_id || info.order_id || info.provider_order_id;
    setPay({
      bookingId,
      reference,
      options: {
        key: k,
        amount: info.amount_paise ?? Math.round(total * 100),
        currency: info.currency || "INR",
        name: info.checkout_data?.name || "Upgrade Talents India",
        description: info.checkout_data?.description || `Seats ${seats.join(", ")} — ${event?.title || "Event"}`,
        order_id: isValidRazorpayOrderId(rawOrderId) ? String(rawOrderId) : undefined,
        prefill: { name: user?.name || "", email: user?.email || "", contact: user?.phone_number || "" },
        notes: { booking_reference: String(reference || "") },
        theme: { color: PICK },
      },
    });
  };

  /* Razorpay's result is only a claim; the backend checks the signature. */
  const onPaid = async (r: RazorpaySuccess) => {
    const ctx = pay;
    setPay(null);
    if (!ctx) return;
    const base = { ref: ctx.reference || ctx.bookingId, bookingId: ctx.bookingId, method: "ONLINE" as const, seats: picked.map((p) => p.id), total };
    try {
      await paymentsApi.verifyRazorpay({
        booking_id: ctx.bookingId,
        razorpay_order_id: r.razorpay_order_id || "",
        razorpay_payment_id: r.razorpay_payment_id,
        razorpay_signature: r.razorpay_signature || "",
      });
      finish({ ...base, verified: true });
    } catch {
      // money was captured; the payment webhook confirms the booking server-side
      finish({ ...base, verified: false });
    }
  };

  /* ── layout ── */
  const HEADER = insets.top + 108;
  const BAR = insets.bottom + (picked.length ? 150 : 96);
  const CHIPS = 76;
  const mapH = Math.max(280, winH - HEADER - CHIPS - BAR);

  if (step === 2 && result) return <Confirmed result={result} event={event} onTickets={() => router.replace("/(user)/tickets")} onOrder={() => router.replace(`/(more)/bookings/${result.ref}`)} onEvents={() => router.replace("/(user)/events")} />;

  return (
    <View style={{ flex: 1, backgroundColor: "#07080E" }}>
      <StatusBar style="light" />
      <Glow color="rgba(255,56,92,0.12)" size={300} top={-160} left={-90} />

      {/* ── header: back · title · stepper ── */}
      <View style={{ paddingTop: insets.top + 6, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace(`/(user)/events/${eventId}`))}
            hitSlop={10}
            accessibilityLabel="Back"
            style={({ pressed }) => [s.round, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
          >
            <ArrowLeft size={20} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            {loading ? (
              <Skeleton h={18} w="70%" />
            ) : (
              <>
                <Txt size={16} font="sansBold" numberOfLines={1} style={{ color: "#fff" }}>{event?.title || "Event"}</Txt>
                <Txt size={13} font="sansMed" numberOfLines={1} style={{ marginTop: 3, color: "rgba(255,255,255,0.72)" }}>
                  {[event?.date ? formatEventDate(event.date) : null, event?.time, event?.venue].filter(Boolean).join(" · ")}
                </Txt>
              </>
            )}
          </View>
          {step === 0 && !loading && tiers.length ? (
            <Pressable
              onPress={() => { Haptics.selectionAsync().catch(() => {}); setShareMap(true); }}
              hitSlop={10}
              accessibilityLabel="Share seat map"
              style={({ pressed }) => [s.round, { transform: [{ scale: pressed ? 0.92 : 1 }] }]}
            >
              <ImageDown size={18} color="#fff" />
            </Pressable>
          ) : null}
        </View>
        <Stepper step={step} onBack={step === 1 ? () => setStep(0) : undefined} />
      </View>

      {loadError ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
          <Txt size={15} tone="muted" align="center">{loadError}</Txt>
          <Button label="Go back" variant="outline" onPress={() => router.back()} />
        </View>
      ) : step === 0 ? (
        /* ─────────────── STEP 1 · CHOOSE YOUR PLACE ─────────────── */
        <Animated.View key="s0" entering={FadeIn.duration(260)} exiting={FadeOut.duration(160)} style={{ flex: 1 }}>
          {/* zone chips → fly the camera to that zone */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingVertical: 10 }} style={{ flexGrow: 0 }}>
            {loading
              ? [0, 1, 2].map((i) => <Skeleton key={i} h={44} w={104} radius={12} />)
              : tiers.map((t, i) => {
                  const z = zoneFor(t.type, t.price);
                  const soldOut = (t.available ?? 0) <= 0;
                  const mine = picked.filter((p) => p.tierId === t._id).length;
                  return (
                    <Animated.View key={t._id} entering={FadeIn.delay(i * 50).duration(260)}>
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          mapRef.current?.focusTier(t._id);
                        }}
                        style={({ pressed }) => [s.chip, { borderColor: mine ? z.color : "rgba(255,255,255,0.09)", opacity: soldOut ? 0.5 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
                      >
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: z.color }} />
                          <Txt size={12} font="sansSemi" numberOfLines={1} style={{ color: "#fff", maxWidth: 92 }}>{t.type}</Txt>
                          <Txt size={12} font="sansBold" style={{ color: z.color }}>{t.price > 0 ? formatINR(t.price) : "Free"}</Txt>
                          {mine ? (
                            <View style={{ minWidth: 16, height: 16, borderRadius: 999, backgroundColor: z.color, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}>
                              <Txt size={10} font="sansBold" style={{ color: "#0B0C10" }}>{mine}</Txt>
                            </View>
                          ) : null}
                        </View>
                        <Txt size={10.5} style={{ color: soldOut ? PICK : "rgba(255,255,255,0.5)", marginTop: 2 }}>{soldOut ? "Sold out" : `${t.available} left`}</Txt>
                      </Pressable>
                    </Animated.View>
                  );
                })}
          </ScrollView>

          {loading ? (
            <View style={{ paddingHorizontal: 16, gap: 10 }}>
              <Skeleton h={46} radius={14} />
              {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={18} radius={6} />)}
            </View>
          ) : (
            <View style={{ marginHorizontal: 8, borderRadius: 24, overflow: "hidden", backgroundColor: "#0C0D14", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)" }}>
              <SeatMap ref={mapRef} tiers={tiers} rows={rows} booked={mapBooked} picked={pickedOrder} onTap={onTap} height={mapH} />
            </View>
          )}

          {/* legend */}
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, paddingTop: 12 }}>
            <Legend label="Available"><View style={[s.legendSeat, { borderWidth: 1.2, borderColor: "rgba(255,255,255,0.55)" }]} /></Legend>
            <Legend label="Selected"><View style={[s.legendSeat, { backgroundColor: PICK }]} /></Legend>
            <Legend label="Booked"><View style={[s.legendSeat, { backgroundColor: "#1C1E26" }]} /></Legend>
          </View>

          {/* bottom bar */}
          <View style={[s.bar, { paddingBottom: insets.bottom + 12 }]}>
            {picked.length ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ flex: 1 }}>
                  {picked.map((p) => (
                    <Animated.View key={p.id} entering={FadeIn.duration(180)} exiting={FadeOut.duration(140)} layout={LinearTransition.duration(220).easing(Easing.out(Easing.cubic))}>
                      <Pressable
                        onPress={() => onTap({ id: p.id, row: p.row, num: p.num, tier: tiers.find((t) => t._id === p.tierId)! })}
                        style={[s.seatChip, { borderColor: p.color + "88" }]}
                        accessibilityLabel={`Remove seat ${p.id}`}
                      >
                        <Txt size={12.5} font="monoMed" style={{ color: "#fff" }}>{p.id}</Txt>
                        <X size={12} color="rgba(255,255,255,0.6)" />
                      </Pressable>
                    </Animated.View>
                  ))}
                </ScrollView>
                {left != null ? <HoldPill seconds={left} /> : null}
              </View>
            ) : null}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
              <View style={{ flex: 1 }}>
                {picked.length ? (
                  <>
                    <Txt size={22} font="sansBold" style={{ color: "#fff" }}>{total > 0 ? formatINR(total) : "Free"}</Txt>
                    <Txt size={12} tone="subtle">{picked.length} {picked.length === 1 ? "seat" : "seats"} selected</Txt>
                  </>
                ) : (
                  <Txt size={13.5} tone="muted" lh={19}>{closed ? closedLabel : "Tap a seat to choose your place. Pinch to zoom."}</Txt>
                )}
              </View>
              <Button
                label={closed ? "Closed" : "Continue"}
                size="lg"
                disabled={closed || !picked.length}
                onPress={toPayment}
                iconRight={<ArrowRight size={17} color={c.onAccent} />}
              />
            </View>
          </View>
        </Animated.View>
      ) : (
        /* ─────────────── STEP 2 · PAYMENT ─────────────── */
        <Animated.View key="s1" entering={FadeIn.duration(260)} style={{ flex: 1 }}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 140, gap: 16 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {left != null ? (
                <Animated.View entering={FadeInDown.duration(300)} style={[s.card, { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderColor: left < 60 ? "rgba(255,56,92,0.45)" : "rgba(255,255,255,0.07)" }]}>
                  <Clock size={17} color={left < 60 ? PICK : "#F5C542"} />
                  <Txt size={13} tone="muted" style={{ flex: 1 }}>Your seats are held for you</Txt>
                  <HoldPill seconds={left} />
                </Animated.View>
              ) : null}

              {/* event */}
              <Animated.View entering={FadeInDown.delay(40).duration(320)} style={[s.card, { flexDirection: "row", gap: 14 }]}>
                <View style={{ width: 64, height: 84, borderRadius: 12, overflow: "hidden", backgroundColor: "#1A1B23" }}>
                  <AppImage uri={posterOf(event)} seed={3} style={{ width: "100%", height: "100%" }} />
                </View>
                <View style={{ flex: 1, gap: 6 }}>
                  <Txt size={16} font="sansBold" numberOfLines={2} style={{ color: "#fff" }}>{event?.title}</Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <CalendarDays size={13} color={c.fgSubtle} />
                    <Txt size={12.5} tone="muted" numberOfLines={1}>{[event?.date ? formatEventDate(event.date) : null, event?.time].filter(Boolean).join(" · ") || "Date to be announced"}</Txt>
                  </View>
                  {event?.venue ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <MapPin size={13} color={c.fgSubtle} />
                      <Txt size={12.5} tone="muted" numberOfLines={1} style={{ flex: 1 }}>{event.venue}</Txt>
                    </View>
                  ) : null}
                </View>
              </Animated.View>

              {/* guests */}
              <Animated.View entering={FadeInDown.delay(90).duration(320)} style={s.card}>
                <Txt size={15} font="sansBold" style={{ color: "#fff" }}>{"Who's coming"}</Txt>
                <Txt size={12.5} tone="subtle" lh={18} style={{ marginTop: 4, marginBottom: 14 }}>
                  One QR admits everyone below by name at the gate.
                </Txt>
                <View style={{ gap: 10 }}>
                  {picked.map((p, i) => (
                    <View key={p.id} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                      <View style={[s.seatTag, { borderColor: p.color + "88" }]}>
                        <Txt size={12} font="monoMed" style={{ color: p.color }}>{p.id}</Txt>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          value={names[i] ?? ""}
                          onChangeText={(v) => setNameBy((prev) => ({ ...prev, [p.id]: v }))}
                          placeholder={i === 0 ? "Your full name" : `Guest ${i + 1} full name`}
                          autoCapitalize="words"
                          autoComplete={i === 0 ? "name" : "off"}
                        />
                      </View>
                    </View>
                  ))}
                </View>
              </Animated.View>

              {/* payment method */}
              {total > 0 ? (
                <Animated.View entering={FadeInDown.delay(140).duration(320)} style={{ gap: 10 }}>
                  <Txt size={15} font="sansBold" style={{ color: "#fff", marginLeft: 4 }}>Pay with</Txt>
                  <MethodCard
                    active={method === "ONLINE"}
                    onPress={() => setMethod("ONLINE")}
                    icon={<CreditCard size={20} color={method === "ONLINE" ? PICK : "#fff"} />}
                    title="Pay online"
                    sub="UPI, cards, net banking · instant confirmation"
                  />
                  <MethodCard
                    active={method === "CASH"}
                    onPress={() => setMethod("CASH")}
                    icon={<Banknote size={20} color={method === "CASH" ? PICK : "#fff"} />}
                    title="Cash at venue"
                    sub={`Pay ${formatINR(total)} at the gate · pass issued now`}
                  />
                </Animated.View>
              ) : (
                <Animated.View entering={FadeInDown.delay(140).duration(320)} style={[s.card, { borderColor: "rgba(52,211,153,0.4)", backgroundColor: "rgba(52,211,153,0.07)" }]}>
                  <Txt size={15} font="sansBold" style={{ color: "#34D399" }}>Free entry</Txt>
                  <Txt size={12.5} tone="muted" style={{ marginTop: 4 }}>No payment needed — your pass is issued the moment you confirm.</Txt>
                </Animated.View>
              )}

              {/* bill */}
              <Animated.View entering={FadeInDown.delay(190).duration(320)} style={s.card}>
                <Txt size={15} font="sansBold" style={{ color: "#fff", marginBottom: 12 }}>Bill summary</Txt>
                <View style={{ gap: 10 }}>
                  {lines.map((l) => (
                    <View key={l.name} style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}>
                      <View style={{ flex: 1 }}>
                        <Txt size={14} style={{ color: "#fff" }}>{l.name}</Txt>
                        <Txt size={12} tone="subtle">{l.count} × {l.price > 0 ? formatINR(l.price) : "Free"}</Txt>
                      </View>
                      <Txt size={14} font="sansSemi" style={{ color: "#fff" }}>{l.price > 0 ? formatINR(l.price * l.count) : "Free"}</Txt>
                    </View>
                  ))}
                </View>
                <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 14 }} />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                  <Txt size={15} font="sansBold" style={{ color: "#fff" }}>{method === "CASH" && total > 0 ? "Pay at venue" : "Total"}</Txt>
                  <Txt size={20} font="sansBold" style={{ color: "#fff" }}>{total > 0 ? formatINR(total) : "Free"}</Txt>
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>

          <View style={[s.bar, { paddingBottom: insets.bottom + 12, flexDirection: "row", alignItems: "center", gap: 14 }]}>
            <View style={{ flex: 1 }}>
              <Txt size={22} font="sansBold" style={{ color: "#fff" }}>{total > 0 ? formatINR(total) : "Free"}</Txt>
              <Txt size={12} tone="subtle">{picked.length} {picked.length === 1 ? "seat" : "seats"} · {picked.map((p) => p.id).join(", ")}</Txt>
            </View>
            <Button
              label={submitting ? "Processing" : total === 0 ? "Get free pass" : method === "CASH" ? "Confirm booking" : `Pay ${formatINR(total)}`}
              size="lg"
              loading={submitting}
              disabled={closed}
              onPress={book}
              icon={<TicketIcon size={17} color={c.onAccent} />}
            />
          </View>
        </Animated.View>
      )}

      <ShareImageSheet visible={shareMap} onClose={() => setShareMap(false)} cta="Share seat map" dialogTitle={`${event?.title || "Event"} — seat map`}>
        <SeatShareCard event={event} tiers={tiers} rows={rows} booked={mapBooked} picked={new Set(picked.map((p) => p.id))} />
      </ShareImageSheet>

      <RazorpayCheckout
        visible={!!pay}
        options={pay?.options || null}
        onSuccess={onPaid}
        onFailure={(m) => {
          setPay(null);
          setSubmitting(false);
          fail("Payment failed", m || "No amount was charged. Please try again.");
        }}
        onDismiss={() => {
          setPay(null);
          setSubmitting(false);
          alert("info", "Payment not completed", "Your seats are still reserved for you — tap Pay to finish, or switch to cash at venue.");
        }}
      />
    </View>
  );
}

/* ── three-step progress: one segment per step, the current one fills in ── */
function Stepper({ step, onBack }: { step: number; onBack?: () => void }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, marginTop: 16, marginBottom: 4 }}>
      {STEPS.map((label, i) => (
        <Pressable
          key={label}
          disabled={!(onBack && i === 0)}
          onPress={onBack}
          hitSlop={8}
          accessibilityRole={onBack && i === 0 ? "button" : undefined}
          accessibilityLabel={onBack && i === 0 ? "Back to seat selection" : undefined}
          style={{ flex: 1 }}
        >
          <Segment state={i < step ? "done" : i === step ? "now" : "next"} />
          <Txt
            size={11.5}
            font={i === step ? "sansBold" : "sansMed"}
            numberOfLines={1}
            style={{ marginTop: 7, color: i === step ? "#fff" : i < step ? "rgba(255,255,255,0.62)" : "rgba(255,255,255,0.32)" }}
          >
            {label}
          </Txt>
        </Pressable>
      ))}
    </View>
  );
}

function Segment({ state }: { state: "done" | "now" | "next" }) {
  const p = useSharedValue(state === "next" ? 0 : 1);
  useEffect(() => {
    p.set(withTiming(state === "next" ? 0 : 1, { duration: 380, easing: Easing.out(Easing.cubic) }));
  }, [state, p]);
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: p.value }] }));
  return (
    <View style={{ height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
      <Animated.View style={[{ height: "100%", width: "100%", borderRadius: 2, backgroundColor: state === "done" ? "rgba(255,56,92,0.55)" : PICK, transformOrigin: "left center" }, fill]} />
    </View>
  );
}

/** Best poster for an event — every field the backend has used for one. */
function posterOf(ev: any): string | undefined {
  return ev?.card_image_url || ev?.image_url || ev?.poster_url || ev?.banner_url || ev?.banner_image_url || ev?.cover_image || undefined;
}

function HoldPill({ seconds }: { seconds: number }) {
  const urgent = seconds < 60;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, height: 28, borderRadius: 999, backgroundColor: urgent ? "rgba(255,56,92,0.16)" : "rgba(245,197,66,0.12)" }}>
      <Clock size={12} color={urgent ? PICK : "#F5C542"} />
      <Txt size={12.5} font="monoMed" style={{ color: urgent ? PICK : "#F5C542" }}>
        {String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}
      </Txt>
    </View>
  );
}

function Legend({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
      {children}
      <Txt size={11.5} tone="subtle">{label}</Txt>
    </View>
  );
}

function MethodCard({ active, onPress, icon, title, sub }: { active: boolean; onPress: () => void; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        s.card,
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
          borderColor: active ? PICK : "rgba(255,255,255,0.07)",
          backgroundColor: active ? "rgba(255,56,92,0.07)" : "#11121A",
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
      ]}
    >
      <View style={{ width: 42, height: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: active ? "rgba(255,56,92,0.14)" : "rgba(255,255,255,0.06)" }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Txt size={15} font="sansBold" style={{ color: "#fff" }}>{title}</Txt>
        <Txt size={12.5} tone="subtle" style={{ marginTop: 2 }}>{sub}</Txt>
      </View>
      <View style={{ width: 22, height: 22, borderRadius: 999, borderWidth: 2, borderColor: active ? PICK : "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }}>
        {active ? <Animated.View entering={FadeIn.duration(160)} style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: PICK }} /> : null}
      </View>
    </Pressable>
  );
}

/* ─────────────── STEP 3 · TICKET ─────────────── */
function Confirmed({ result, event, onTickets, onOrder, onEvents }: { result: Result; event: any; onTickets: () => void; onOrder: () => void; onEvents: () => void }) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const status =
    result.method === "CASH"
      ? { text: `Pay ${formatINR(result.total)} in cash at the gate`, color: "#F5C542" }
      : result.method === "FREE"
        ? { text: "Free entry · confirmed", color: "#34D399" }
        : result.verified
          ? { text: "Paid · confirmed", color: "#34D399" }
          : { text: "Payment received · confirming", color: "#F5C542" };

  return (
    <View style={{ flex: 1, backgroundColor: "#07080E" }}>
      <StatusBar style="light" />
      <Glow color={c.spot1} size={360} top={-60} left={-80} />
      <Glow color={c.spot2} size={300} top={140} right={-100} />
      <ConfettiCannon count={130} origin={{ x: width / 2, y: -20 }} autoStart fadeOut explosionSpeed={360} fallSpeed={2900} colors={[PICK, "#F9862B", "#F5C542", "#ffffff", "#C084FC"]} />
      <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <LottieView source={require("../../../../assets/Lottie/Success.json")} autoPlay loop={false} style={{ width: 190, height: 190 }} />
        <GradientText size={40} tracking={-1} style={{ textAlign: "center" }}>{"YOU'RE IN!"}</GradientText>
        <Txt size={14.5} tone="muted" align="center" lh={21} style={{ marginTop: 8, maxWidth: 300 }}>
          Your QR pass is ready in My Tickets.
        </Txt>

        <Animated.View entering={FadeInDown.delay(250).duration(420).easing(Easing.out(Easing.cubic))} style={[s.card, { width: "100%", marginTop: 26, gap: 14 }]}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Txt size={11} font="monoMed" tone="subtle" tracking={1.6} uppercase>Booking</Txt>
            <Txt size={13} font="monoMed" style={{ color: "#fff" }}>{result.ref}</Txt>
          </View>
          <Txt size={17} font="sansBold" numberOfLines={2} style={{ color: "#fff" }}>{event?.title}</Txt>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {result.seats.map((sid) => (
              <View key={sid} style={[s.seatTag, { borderColor: "rgba(255,255,255,0.16)" }]}>
                <Txt size={12} font="monoMed" style={{ color: "#fff" }}>{sid}</Txt>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: status.color }} />
            <Txt size={13} font="sansSemi" style={{ color: status.color }}>{status.text}</Txt>
          </View>
        </Animated.View>

        <View style={{ width: "100%", gap: 10, marginTop: 24 }}>
          <Button label="View my tickets" full size="lg" onPress={onTickets} icon={<TicketIcon size={17} color={c.onAccent} />} />
          {result.ref !== "CONFIRMED" ? <Button label="Order details" variant="outline" full onPress={onOrder} /> : null}
          <Button label="Back to events" variant="ghost" full onPress={onEvents} />
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  round: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  chip: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "#11121A",
  },
  legendSeat: { width: 14, height: 13, borderTopLeftRadius: 5, borderTopRightRadius: 5, borderBottomLeftRadius: 2.5, borderBottomRightRadius: 2.5 },
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: "rgba(12,13,20,0.97)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  seatChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 32,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  seatTag: { paddingHorizontal: 9, height: 30, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center", minWidth: 58 },
  card: {
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#11121A",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
});
