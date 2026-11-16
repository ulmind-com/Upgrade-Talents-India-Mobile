import React, { useMemo } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import QRCode from "react-native-qrcode-svg";
import { LinearGradient } from "expo-linear-gradient";
import { QrCode, Ticket as TicketIcon, LogIn, History, CalendarX } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { bookingsApi, publicApi, safe, type MyTicket } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { PageHeader } from "@/components/domain";
import { FadeInUp } from "@/components/FadeInUp";
import { DottedGrid } from "@/components/patterns";
import { TicketPass } from "@/components/TicketPass";
import { isEventExpired } from "@/lib/format";
import { Txt, Badge, Button, Card, Skeleton, EmptyState, ErrorState } from "@/components/ui";


export default function Tickets() {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useSession();

  const { data, loading, error, refreshing, refresh, reload } = useAsync(
    () => (user ? bookingsApi.myTickets() : Promise.resolve([])),
    [user?._id || user?.email],
    { refetchOnFocus: true }
  );

  const events = useAsync(() => (user ? safe(publicApi.upcomingEvents({ limit: 50 }), []) : Promise.resolve([])), [user?.email], { refetchOnFocus: true });
  const evMap = new Map((events.data || []).map((e: any) => [e._id, e]));

  /* A past event is not in the upcoming list, so a finished pass has to read
     the event off itself — which is also the only way it can know it expired. */
  const dressed = useMemo(
    () =>
      (data || []).map((t) => {
        const ev: any = evMap.get(t.event_id);
        const date = ev?.date ?? t.event_date;
        return {
          t,
          title: ev?.title ?? t.event_title,
          date,
          venue: ev?.venue ?? t.event_venue,
          price: ev?.price ?? t.price ?? t.base_price,
          expired: isEventExpired(date, ev?.time ?? t.event_time),
        };
      }),
    [data, events.data]
  );
  const live = dressed.filter((d) => !d.expired);
  const past = dressed.filter((d) => d.expired);

  const openTicket = (t: MyTicket) =>
    router.push({
      pathname: "/(more)/ticket/[ref]",
      params: { ref: t.ticket_ref, type: t.ticket_type, holder: t.holder_name, issued: t.issued_at, checked: t.is_checked_in ? "1" : "0", event_id: t.event_id },
    });

  if (!user) {
    return (
      <Screen>
        <PageHeader eyebrow="Your passes" title="My Tickets" />
        <Card style={{ alignItems: "center", gap: 14, paddingVertical: 36, marginTop: 10 }}>
          <View style={{ width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: c.surface2 }}>
            <LogIn size={26} color={c.accent} />
          </View>
          <Txt size={17} font="sansBold" align="center">Sign in to see your tickets</Txt>
          <Txt size={14} tone="muted" align="center" style={{ maxWidth: 280 }}>Your QR passes, bookings and certificates live here once you're signed in.</Txt>
          <Button label="Sign in" onPress={() => router.push("/(auth)/login")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <PageHeader eyebrow="Your passes" title="My Tickets" subtitle="Tap a pass for the QR, details & download." />

      {/* Digital wallet — District style */}
      <FadeInUp>
        <View style={{ borderRadius: 24, overflow: "hidden", marginBottom: 20, shadowColor: "#8B5CF6", shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 12 }, elevation: 10 }}>
          <LinearGradient colors={["#7C3AED", "#FF385C", "#08090C"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 20, minHeight: 172 }}>
            <DottedGrid color="rgba(255,255,255,0.22)" opacity={0.5} gap={18} />
            {/* top */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                {/* chip */}
                <View style={{ width: 38, height: 28, borderRadius: 7, backgroundColor: "rgba(255,255,255,0.85)", alignItems: "center", justifyContent: "center" }}>
                  <View style={{ width: 24, height: 16, borderRadius: 3, borderWidth: 1.5, borderColor: "rgba(200,90,20,0.6)" }} />
                </View>
                <Txt size={11} font="monoMed" tracking={2} uppercase style={{ color: "rgba(255,255,255,0.92)" }}>Digital wallet</Txt>
              </View>
              <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.22)", alignItems: "center", justifyContent: "center" }}>
                <QrCode size={20} color="#fff" />
              </View>
            </View>

            {/* count */}
            <View style={{ marginTop: 18 }}>
              <Txt size={44} font="display" tracking={-1} style={{ color: "#fff" }}>{live.length}</Txt>
              <Txt size={12} font="sansBold" tracking={2} uppercase style={{ color: "rgba(255,255,255,0.9)", marginTop: -4 }}>{live.length === 1 ? "Active pass" : "Active passes"}</Txt>
              {past.length ? (
                <View style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 5, marginTop: 8, borderRadius: 999, backgroundColor: "rgba(0,0,0,0.26)", paddingHorizontal: 9, paddingVertical: 4 }}>
                  <CalendarX size={11} color="rgba(255,255,255,0.9)" />
                  <Txt size={10} font="sansBold" tracking={1} style={{ color: "rgba(255,255,255,0.9)" }}>{past.length} EXPIRED</Txt>
                </View>
              ) : null}
            </View>

            {/* bottom */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: 18 }}>
              <View>
                <Txt size={9.5} font="monoMed" tracking={1.5} uppercase style={{ color: "rgba(255,255,255,0.7)" }}>Card holder</Txt>
                <Txt size={15} font="sansExt" style={{ color: "#fff", marginTop: 2 }} numberOfLines={1}>{user?.name || "Dancer"}</Txt>
              </View>
              <Txt size={11} font="display" style={{ color: "rgba(255,255,255,0.85)", letterSpacing: 1 }}>UPGRADE TALENTS</Txt>
            </View>
          </LinearGradient>
        </View>
      </FadeInUp>

      {loading ? (
        <View style={{ gap: 16 }}>{[0, 1].map((i) => <Skeleton key={i} h={150} radius={24} />)}</View>
      ) : error && !data?.length ? (
        <ErrorState message={error} onRetry={reload} />
      ) : dressed.length ? (
        <View style={{ gap: 16 }}>
          {live.map((d, idx) => (
            <FadeInUp key={d.t.ticket_ref} delay={Math.min(idx, 8) * 60}>
              <TicketPass ticket={d.t} eventTitle={d.title} eventDate={d.date} venue={d.venue} price={d.price} onPress={() => openTicket(d.t)} />
            </FadeInUp>
          ))}

          {!live.length ? (
            <EmptyState icon={<TicketIcon size={28} color={c.fgMuted} />} title="No active passes" subtitle="Every pass below belongs to an event that has already finished." />
          ) : null}

          {past.length ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10, marginBottom: -4 }}>
                <History size={14} color={c.fgSubtle} />
                <Txt size={11} font="monoMed" tone="subtle" tracking={2.5} uppercase>Expired · {past.length}</Txt>
                <View style={{ flex: 1, height: 1, backgroundColor: c.border }} />
              </View>
              <Txt size={12.5} tone="subtle" lh={18} style={{ marginBottom: 2 }}>
                These events are over, so the codes no longer scan. Kept here for your records.
              </Txt>
              {past.map((d, idx) => (
                <FadeInUp key={d.t.ticket_ref} delay={Math.min(idx, 8) * 50}>
                  <TicketPass ticket={d.t} eventTitle={d.title} eventDate={d.date} venue={d.venue} price={d.price} onPress={() => openTicket(d.t)} />
                </FadeInUp>
              ))}
            </>
          ) : null}
        </View>
      ) : (
        <EmptyState icon={<TicketIcon size={28} color={c.fgMuted} />} title="No tickets yet" subtitle="Book an event and your QR passes will appear here." />
      )}
    </Screen>
  );
}
