import React, { useMemo } from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { QrCode, Ticket as TicketIcon, LogIn, History, CalendarX, ChevronRight, ShieldCheck } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/theme/ThemeProvider";
import { useSession } from "@/context/Session";
import { bookingsApi, publicApi, safe, type MyTicket } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { FadeInUp } from "@/components/FadeInUp";
import { TicketPass } from "@/components/TicketPass";
import { isEventExpired } from "@/lib/format";
import { Txt, Button, Card, Skeleton, EmptyState, ErrorState } from "@/components/ui";

export default function Tickets() {
  const router = useRouter();
  const { user } = useSession();

  const { data, loading, error, refreshing, refresh, reload } = useAsync(
    () => (user ? bookingsApi.myTickets() : Promise.resolve([])),
    [user?._id || user?.email],
    { refetchOnFocus: true }
  );

  const events = useAsync(
    () => (user ? safe(publicApi.upcomingEvents({ limit: 50 }), []) : Promise.resolve([])),
    [user?.email],
    { refetchOnFocus: true }
  );
  const evMap = new Map((events.data || []).map((e: any) => [e._id, e]));

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
      params: {
        ref: t.ticket_ref,
        type: t.ticket_type,
        holder: t.holder_name,
        issued: t.issued_at,
        checked: t.is_checked_in ? "1" : "0",
        event_id: t.event_id,
      },
    });

  if (!user) {
    return (
      <Screen>
        <View style={{ paddingTop: 8, paddingBottom: 16 }}>
          <Txt size={22} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.4 }}>
            My Passes
          </Txt>
        </View>
        <Card style={{ alignItems: "center", gap: 14, paddingVertical: 36, marginTop: 10, backgroundColor: "#14161E", borderColor: "rgba(255,255,255,0.08)" }}>
          <View style={{ width: 64, height: 64, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "#1f2230" }}>
            <LogIn size={26} color="#FF385C" />
          </View>
          <Txt size={17} font="sansBold" style={{ color: "#ffffff" }} align="center">
            Sign in to see your tickets
          </Txt>
          <Txt size={14} style={{ color: "#9ea3b8", maxWidth: 280 }} align="center">
            Your QR passes, bookings and certificates live here once you're signed in.
          </Txt>
          <Button label="Sign in" onPress={() => router.push("/(auth)/login")} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      {/* District Header */}
      <View style={{ paddingTop: 8, paddingBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <Txt size={22} font="sansBold" style={{ color: "#ffffff", letterSpacing: -0.4 }}>
            My Passes
          </Txt>
          <ChevronRight size={18} color="#ffffff" strokeWidth={2.4} />
        </View>
        <Txt size={13} style={{ color: "#9ea3b8" }}>
          Digital QR entry tickets ready for instant gate check-in
        </Txt>
      </View>

      {/* District Wallet Overview Card */}
      <FadeInUp>
        <View
          style={{
            borderRadius: 22,
            backgroundColor: "#14161E",
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
            padding: 18,
            marginBottom: 20,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Txt size={11} font="monoMed" style={{ color: "#C9F24A", letterSpacing: 2 }} uppercase>
              Pass wallet
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 }}>
              <Txt size={32} font="sansBold" style={{ color: "#ffffff" }}>
                {live.length}
              </Txt>
              <Txt size={13} style={{ color: "#9ea3b8" }}>
                {live.length === 1 ? "active pass" : "active passes"}
              </Txt>
            </View>
            {past.length > 0 && (
              <Txt size={11.5} style={{ color: "#6b728a", marginTop: 2 }}>
                {past.length} past / expired records
              </Txt>
            )}
          </View>

          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              backgroundColor: "rgba(255, 56, 92, 0.12)",
              borderWidth: 1,
              borderColor: "rgba(255, 56, 92, 0.3)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <QrCode size={26} color="#FF385C" />
          </View>
        </View>
      </FadeInUp>

      {/* Ticket Cards */}
      {loading ? (
        <View style={{ gap: 16 }}>
          {[0, 1].map((i) => (
            <Skeleton key={i} h={150} radius={22} />
          ))}
        </View>
      ) : error && !data?.length ? (
        <ErrorState message={error} onRetry={reload} />
      ) : dressed.length ? (
        <View style={{ gap: 16 }}>
          {live.map((d, idx) => (
            <FadeInUp key={d.t.ticket_ref} delay={Math.min(idx, 6) * 50}>
              <TicketPass
                ticket={d.t}
                eventTitle={d.title}
                eventDate={d.date}
                venue={d.venue}
                price={d.price}
                onPress={() => openTicket(d.t)}
              />
            </FadeInUp>
          ))}

          {!live.length && (
            <EmptyState
              icon={<TicketIcon size={28} color="#6b728a" />}
              title="No active passes"
              subtitle="All previous passes belong to events that have concluded."
            />
          )}

          {past.length > 0 && (
            <View style={{ marginTop: 12 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <History size={14} color="#6b728a" />
                <Txt size={11} font="monoMed" style={{ color: "#6b728a", letterSpacing: 2 }} uppercase>
                  Past passes · {past.length}
                </Txt>
                <View style={{ flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.08)" }} />
              </View>

              <View style={{ gap: 14 }}>
                {past.map((d, idx) => (
                  <FadeInUp key={d.t.ticket_ref} delay={Math.min(idx, 6) * 40}>
                    <TicketPass
                      ticket={d.t}
                      eventTitle={d.title}
                      eventDate={d.date}
                      venue={d.venue}
                      price={d.price}
                      onPress={() => openTicket(d.t)}
                    />
                  </FadeInUp>
                ))}
              </View>
            </View>
          )}
        </View>
      ) : (
        <EmptyState
          icon={<TicketIcon size={28} color="#6b728a" />}
          title="No tickets yet"
          subtitle="Book an event or workshop and your passes will appear right here."
        />
      )}
    </Screen>
  );
}
