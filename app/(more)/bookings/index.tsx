import React, { useMemo, useState } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { Receipt, CalendarDays, MapPin, Ticket as TicketIcon, ChevronRight, ScanLine, Wallet, Layers } from "lucide-react-native";
import { SubScreen } from "@/components/SubScreen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { bookingsApi, safe, type MyTicket } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { Txt, Card, Skeleton, EmptyState, Chip } from "@/components/ui";
import { SignInPrompt } from "@/components/SignInPrompt";
import { AppImage } from "@/components/AppImage";
import { DottedGrid, Perforation } from "@/components/patterns";
import { Intro, useIntro } from "@/components/motion";
import { formatINR, formatEventDate, titleCase } from "@/lib/format";
import {
  bookingId, bookingState, bookingWay, eventOf, ticketsOf,
  STATE_LABEL, STATE_TONE, type BookingRow, type BookingState,
} from "@/lib/booking";

/* The summary band runs deep violet: it is a ledger, not a ticket, so it
   deliberately sits outside the brand orange the cards below borrow. */
const LEDGER = ["#1b1038", "#2a1452", "#140d2e"];

type Filter = "all" | BookingState;
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "confirmed", label: "Confirmed" },
  { key: "pending", label: "Pending" },
  { key: "cancelled", label: "Cancelled" },
];

export default function Bookings() {
  const { c } = useTheme();
  const { user } = useSession();
  const router = useRouter();
  const intro = useIntro();
  const [filter, setFilter] = useState<Filter>("all");

  const { data, loading, refreshing, refresh } = useAsync(
    () => (user ? safe(bookingsApi.my(), [] as BookingRow[]) : Promise.resolve([] as BookingRow[])),
    [user?.email],
    { refetchOnFocus: true }
  );
  /* Tickets carry the event details and the scan state; joined in locally so
     the shelf needs no extra endpoint. */
  const tq = useAsync(
    () => (user ? safe(bookingsApi.myTickets(), [] as MyTicket[]) : Promise.resolve([] as MyTicket[])),
    [user?.email],
    { refetchOnFocus: true }
  );

  const rows: BookingRow[] = Array.isArray(data) ? data : [];
  const tickets: MyTicket[] = Array.isArray(tq.data) ? tq.data : [];

  const totals = useMemo(() => {
    const live = rows.filter((b) => bookingState(b) !== "cancelled");
    return {
      spent: live.reduce((n, b) => n + Number(b.total_amount ?? b.amount ?? 0), 0),
      count: rows.length,
      passes: tickets.length,
    };
  }, [rows, tickets]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: rows.length };
    for (const b of rows) {
      const s = bookingState(b);
      m[s] = (m[s] || 0) + 1;
    }
    return m;
  }, [rows]);

  const shown = filter === "all" ? rows : rows.filter((b) => bookingState(b) === filter);

  const open = (b: BookingRow) => {
    Haptics.selectionAsync().catch(() => {});
    router.push({ pathname: "/(more)/bookings/[id]", params: { id: bookingId(b) } });
  };

  return (
    <SubScreen
      eyebrow="Order history"
      title="My bookings"
      refreshing={refreshing}
      onRefresh={user ? () => { refresh(); tq.refresh(); } : undefined}
    >
      {!user ? (
        <SignInPrompt message="Sign in to view your bookings and order history." />
      ) : loading ? (
        <View style={{ gap: 14 }}>
          <Skeleton h={92} radius={22} />
          {[0, 1, 2].map((i) => <Skeleton key={i} h={158} radius={24} />)}
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {/* ── Ledger band ── */}
          {rows.length ? (
            <Intro t={intro} at={0} span={0.4} y={18}>
              <View style={{ borderRadius: 22, overflow: "hidden" }}>
                <LinearGradient colors={LEDGER as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 18 }}>
                  <DottedGrid color="#c4b5fd" opacity={0.1} gap={22} r={1} />
                  <View style={{ flexDirection: "row" }}>
                    <Stat icon={<Wallet size={14} color="#c4b5fd" />} label="Spent" value={formatINR(totals.spent)} />
                    <Rule />
                    <Stat icon={<Layers size={14} color="#c4b5fd" />} label="Bookings" value={String(totals.count)} />
                    <Rule />
                    <Stat icon={<TicketIcon size={14} color="#c4b5fd" />} label="Passes" value={String(totals.passes)} />
                  </View>
                </LinearGradient>
              </View>
            </Intro>
          ) : null}

          {/* ── Filters ── */}
          {rows.length > 1 ? (
            <Intro t={intro} at={0.1} span={0.4} y={14}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {FILTERS.filter((f) => f.key === "all" || counts[f.key]).map((f) => (
                  <Chip
                    key={f.key}
                    label={`${f.label}${counts[f.key] ? ` · ${counts[f.key]}` : ""}`}
                    active={filter === f.key}
                    onPress={() => setFilter(f.key)}
                  />
                ))}
              </View>
            </Intro>
          ) : null}

          {/* ── Shelf ── */}
          {shown.length ? (
            <View style={{ gap: 14 }}>
              {shown.map((b, i) => (
                <Intro key={bookingId(b) || i} t={intro} at={Math.min(0.2 + i * 0.07, 0.72)} span={0.42} y={26} from={0.96}>
                  <BookingCard b={b} tickets={ticketsOf(bookingId(b), tickets)} onPress={() => open(b)} />
                </Intro>
              ))}
            </View>
          ) : rows.length ? (
            <EmptyState
              icon={<Receipt size={26} color={c.fgMuted} />}
              title={`Nothing ${STATE_LABEL[filter as BookingState]?.toLowerCase() || "here"}`}
              subtitle="Try another filter."
            />
          ) : (
            <EmptyState
              icon={<Receipt size={26} color={c.fgMuted} />}
              title="No bookings yet"
              subtitle="Your event and course bookings will show up here."
            />
          )}
        </View>
      )}
    </SubScreen>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
        {icon}
        <Txt size={9.5} font="monoMed" tracking={1.6} uppercase style={{ color: "rgba(226,214,255,0.65)" }}>{label}</Txt>
      </View>
      <Txt size={19} font="display" numberOfLines={1} style={{ color: "#fff" }}>{value}</Txt>
    </View>
  );
}

const Rule = () => <View style={{ width: 1, marginHorizontal: 12, backgroundColor: "rgba(196,181,253,0.22)" }} />;

/**
 * One booking, drawn as a stub: a colour rail down the left that matches the
 * passes inside it, the event behind a scrim, and the money on the torn edge
 * below a perforation.
 */
function BookingCard({ b, tickets, onPress }: { b: BookingRow; tickets: MyTicket[]; onPress: () => void }) {
  const { c } = useTheme();
  const state = bookingState(b);
  const way = bookingWay(b, tickets);
  const ev = eventOf(b, tickets);
  const tone = STATE_TONE[state];
  const toneColor = tone === "success" ? c.success : tone === "warning" ? c.warning : tone === "danger" ? c.danger : c.cyan;

  const qty = Number(b.quantity ?? tickets.length ?? 1) || 1;
  const type = b.ticket_type || tickets[0]?.ticket_type || "Pass";
  const scanned = tickets.filter((t) => t.is_checked_in).length;
  const dim = state === "cancelled";

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}>
      <Card padding={0} style={{ overflow: "hidden", opacity: dim ? 0.62 : 1 }}>
        <View style={{ flexDirection: "row" }}>
          {/* colour rail — the passes inside wear the same two colours */}
          <LinearGradient colors={way.grad} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ width: 6 }} />

          <View style={{ flex: 1 }}>
            {/* ── top: the event ── */}
            <View style={{ padding: 15, paddingBottom: 13 }}>
              {ev.cover ? (
                <>
                  <AppImage uri={ev.cover} seed={ev.eventId} style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.16 }} />
                  <LinearGradient colors={[c.surface + "00", c.surface] as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ position: "absolute", width: "100%", height: "100%" }} />
                </>
              ) : null}

              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Txt size={16} font="sansBold" lh={21} numberOfLines={2}>{ev.title}</Txt>
                  <Txt size={11.5} font="mono" tone="subtle" style={{ marginTop: 4 }} numberOfLines={1}>
                    {b.booking_reference || bookingId(b)}
                  </Txt>
                </View>
                {/* status pill — tinted, never a solid orange block */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, borderWidth: 1, borderColor: toneColor + "55", backgroundColor: toneColor + "18", paddingHorizontal: 9, paddingVertical: 4 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: toneColor }} />
                  <Txt size={10} font="sansBold" style={{ color: toneColor, letterSpacing: 0.4 }}>{STATE_LABEL[state]}</Txt>
                </View>
              </View>

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 }}>
                {ev.date ? <Meta icon={<CalendarDays size={11} color={c.fgSubtle} />} text={formatEventDate(ev.date)} /> : null}
                {ev.venue ? <Meta icon={<MapPin size={11} color={c.fgSubtle} />} text={String(ev.venue)} /> : null}
                <Meta icon={<TicketIcon size={11} color={c.fgSubtle} />} text={`${qty} × ${titleCase(type)}`} />
              </View>
            </View>

            {/* ── perforation ── */}
            <Perforation color={c.border} bg={c.bg} />

            {/* ── bottom: the money ── */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 15, paddingTop: 11, paddingBottom: 14, gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Txt size={9.5} font="monoMed" tone="subtle" tracking={1.6} uppercase>
                  {state === "pending" ? "Amount due" : state === "refunded" ? "Refunded" : "Paid"}
                </Txt>
                <Txt size={20} font="display" style={{ marginTop: 1, color: state === "pending" ? c.warning : c.fg }}>
                  {formatINR(b.total_amount ?? b.amount)}
                </Txt>
              </View>

              {scanned ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 999, backgroundColor: c.success + "18", paddingHorizontal: 9, paddingVertical: 5 }}>
                  <ScanLine size={12} color={c.success} />
                  <Txt size={10.5} font="sansBold" style={{ color: c.success }}>{scanned}/{tickets.length} in</Txt>
                </View>
              ) : null}

              <View style={{ width: 30, height: 30, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
                <ChevronRight size={16} color={c.fgMuted} />
              </View>
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function Meta({ icon, text }: { icon: React.ReactNode; text: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 5, maxWidth: "100%", borderRadius: 8, backgroundColor: c.surface2, paddingHorizontal: 8, paddingVertical: 4 }}>
      {icon}
      <Txt size={11} font="sansMed" tone="muted" numberOfLines={1}>{text}</Txt>
    </View>
  );
}

