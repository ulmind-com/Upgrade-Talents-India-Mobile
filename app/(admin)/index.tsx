import React from "react";
import { View, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  CalendarDays, Users, Ticket, Trophy, GraduationCap, ShoppingBag,
  Bell, TrendingUp, Plus, Download, ArrowUpRight, Clock, Radio,
} from "lucide-react-native";
import {
  cmsApi, usersApi, competitionsApi, adminCoursesApi, merchApi, notificationsApi,
  safe, toRows, totalOf,
} from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { AdminShell } from "@/components/admin/Shell";
import {
  useAdmin, T, AButton, APanel, ALoading, AErrorState, AStatusBadge,
  AStatCard, AHatchBars, AGauge, Hatch, card,
} from "@/components/admin/ui";
import { formatEventDate } from "@/lib/format";

const n = (v: number) => Number(v || 0).toLocaleString("en-IN");

export default function AdminDashboard() {
  const router = useRouter();
  const go = (href: string) => router.push(`/(admin)${href}` as any);

  const { data, loading, error, refreshing, refresh, reload } = useAsync(async () => {
    const [events, users, tickets, comps, courses, orders, announcements] = await Promise.all([
      safe(cmsApi.listEvents({ limit: 200 }), [] as any),
      safe(usersApi.list({ limit: 200 }), {} as any),
      safe(cmsApi.listTickets({ limit: 300 }), [] as any),
      safe(competitionsApi.list({ limit: 100 }), {} as any),
      safe(adminCoursesApi.list({ limit: 100 }), {} as any),
      safe(merchApi.listOrders({ limit: 100 }), {} as any),
      safe(notificationsApi.list({ limit: 10 }), {} as any),
    ]);
    return { events, users, tickets, comps, courses, orders, announcements };
  }, []);

  return (
    <AdminShell refreshing={refreshing} onRefresh={refresh}>
      {loading ? <ALoading rows={6} /> : error ? <AErrorState message={error} onRetry={reload} /> : <Body data={data} onGo={go} onReload={reload} />}
    </AdminShell>
  );
}

function Body({ data, onGo, onReload }: { data: any; onGo: (href: string) => void; onReload: () => void }) {
  const c = useAdmin();

  const events = toRows(data?.events);
  const users = toRows(data?.users);
  const tickets = toRows(data?.tickets);
  const comps = toRows(data?.comps);
  const courses = toRows(data?.courses);
  const orders = toRows(data?.orders);
  const announcements = toRows(data?.announcements);

  const published = events.filter((e: any) => e.is_published).length;
  const live = events.filter((e: any) => e.event_status === "live").length;
  const sold = tickets.reduce((s: number, t: any) => s + (Number(t.total_quantity ?? 0) - Number(t.available ?? 0)), 0);
  const stock = tickets.reduce((s: number, t: any) => s + Number(t.available ?? 0), 0);
  const revenue = tickets.reduce(
    (s: number, t: any) => s + (Number(t.total_quantity ?? 0) - Number(t.available ?? 0)) * Number(t.price ?? 0), 0
  );
  const capacity = sold + stock;
  const sellThrough = capacity ? (sold / capacity) * 100 : 0;

  /* Ticket sales per event — the busiest seven, real numbers only. */
  const chart = events
    .map((e: any) => {
      const ts = tickets.filter((t: any) => String(t.event_id) === String(e._id));
      return {
        label: String(e.title || "Untitled").slice(0, 8),
        value: ts.reduce((s: number, t: any) => s + (Number(t.total_quantity ?? 0) - Number(t.available ?? 0)), 0),
      };
    })
    .sort((a: any, b: any) => b.value - a.value)
    .slice(0, 7);

  const hasSales = chart.some((x: any) => x.value > 0);
  const nextEvent = events.find((e: any) => e.is_published) || events[0];

  const stats = [
    { label: "Total events", value: n(events.length), hint: `${published} published · ${live} live`, Icon: CalendarDays, href: "/events", accent: true },
    { label: "Registered users", value: n(totalOf(data?.users, users)), hint: "Across website and app", Icon: Users, href: "/users" },
    { label: "Tickets sold", value: n(sold), hint: `${n(stock)} still available`, Icon: Ticket, href: "/tickets" },
    { label: "Ticket revenue", value: `₹${n(Math.round(revenue))}`, hint: "From issued tiers", Icon: TrendingUp, href: "/tickets" },
  ];

  const secondary = [
    { label: "Competitions", value: n(totalOf(data?.comps, comps)), Icon: Trophy, href: "/competitions" },
    { label: "Courses & workshops", value: n(totalOf(data?.courses, courses)), Icon: GraduationCap, href: "/courses" },
    { label: "Merch orders", value: n(totalOf(data?.orders, orders)), Icon: ShoppingBag, href: "/merchandise" },
    { label: "Announcements", value: n(totalOf(data?.announcements, announcements)), Icon: Bell, href: "/notifications" },
  ];

  return (
    <View>
      {/* Page actions */}
      <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 10, marginBottom: 16 }}>
        <AButton label="Add event" size="sm" icon={<Plus size={15} color="#fff" />} onPress={() => onGo("/events")} style={{ borderRadius: 999, paddingHorizontal: 18 }} />
        <AButton label="Site content" size="sm" variant="secondary" icon={<Download size={15} color={c.fg} />} onPress={() => onGo("/website")} style={{ borderRadius: 999, paddingHorizontal: 18 }} />
      </View>

      {/* Headline metrics */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        {stats.map((s, i) => (
          <View key={s.label} style={{ width: "47.8%", flexGrow: 1 }}>
            <AStatCard label={s.label} value={s.value} hint={s.hint} Icon={s.Icon} accent={s.accent} index={i} onPress={() => onGo(s.href)} />
          </View>
        ))}
      </View>

      <APanel
        title="Ticket sales by event"
        subtitle="Issued tickets across published tiers"
        action={<AButton label="Refresh" variant="secondary" size="sm" onPress={onReload} />}
      >
        {hasSales ? (
          <AHatchBars data={chart} peakLabel={`${Math.round(sellThrough)}%`} />
        ) : (
          <T size={13} mut align="center" style={{ paddingVertical: 64 }}>No tickets sold yet. Sales appear here as bookings come in.</T>
        )}
      </APanel>

      <APanel title="Next up">
        {nextEvent ? (
          <View>
            <T size={19} font="bold" lh={25}>{nextEvent.title}</T>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Clock size={14} color={c.fgMuted} />
              <T size={12.5} mut>{formatEventDate(nextEvent.date)}{nextEvent.time ? ` · ${nextEvent.time}` : ""}</T>
            </View>
            {nextEvent.venue ? <T size={12.5} mut numberOfLines={1} style={{ marginTop: 4 }}>{nextEvent.venue}</T> : null}
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <AStatusBadge value={nextEvent.is_published ? "published" : "draft"} />
            </View>
            <AButton label="Manage tickets" full icon={<Ticket size={15} color="#fff" />} onPress={() => onGo("/tickets")} style={{ marginTop: 16 }} />
          </View>
        ) : (
          <T size={13} mut align="center" style={{ paddingVertical: 40 }}>No events created yet.</T>
        )}
      </APanel>

      {/* Secondary counts */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        {secondary.map((s) => (
          <Pressable key={s.label} onPress={() => onGo(s.href)} style={({ pressed }) => ({ width: "47.8%", flexGrow: 1, opacity: pressed ? 0.9 : 1 })}>
            <View style={[card(c), { padding: 16 }]}>
              <View style={{ width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: c.brandSoft, marginBottom: 10 }}>
                <s.Icon size={15} color={c.brand} />
              </View>
              <T size={24} font="bold" lh={26}>{s.value}</T>
              <T size={11.5} mut style={{ marginTop: 4 }} numberOfLines={1}>{s.label}</T>
            </View>
          </Pressable>
        ))}
      </View>

      <APanel title="Events" action={<Pressable onPress={() => onGo("/events")}><T size={12.5} font="semi" color={c.brand}>Manage</T></Pressable>}>
        {events.length ? (
          <View>
            {events.slice(0, 5).map((e: any, i: number) => (
              <View key={e._id || i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                <View style={{ width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: c.brandSoft }}>
                  <CalendarDays size={16} color={c.brand} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={13} font="semi" numberOfLines={1}>{e.title}</T>
                  <T size={11} mut numberOfLines={1}>{formatEventDate(e.date)}</T>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <T size={13} mut align="center" style={{ paddingVertical: 40 }}>Nothing scheduled.</T>
        )}
      </APanel>

      <APanel title="Latest announcements" action={<Pressable onPress={() => onGo("/notifications")}><T size={12.5} font="semi" color={c.brand}>Open</T></Pressable>}>
        {announcements.length ? (
          <View>
            {announcements.slice(0, 4).map((a: any, i: number) => (
              <View key={a._id || i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: c.border }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T size={13.5} font="semi" numberOfLines={1}>{a.title || a.subject || "Announcement"}</T>
                  <T size={11.5} mut numberOfLines={1} style={{ marginTop: 2 }}>{a.message || a.body || "—"}</T>
                </View>
                <AStatusBadge value={a.status} />
              </View>
            ))}
          </View>
        ) : (
          <T size={13} mut align="center" style={{ paddingVertical: 40 }}>No announcements sent yet.</T>
        )}
      </APanel>

      <APanel title="Sell-through" subtitle="Issued vs total capacity">
        <AGauge percent={sellThrough} caption="Tickets claimed" />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20, marginTop: 16 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: c.brand }} />
            <T size={11.5} mut>Sold {n(sold)}</T>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 999, borderWidth: 1, borderColor: c.borderStrong, overflow: "hidden" }}>
              <Hatch color={c.hatch} />
            </View>
            <T size={11.5} mut>Left {n(stock)}</T>
          </View>
        </View>
      </APanel>

      {/* Live right now */}
      <View style={{ borderRadius: 16, overflow: "hidden", backgroundColor: c.brand, padding: 20 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <T size={13.5} font="semi" color="rgba(255,255,255,0.9)">Live right now</T>
          <View style={{ width: 32, height: 32, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.15)" }}>
            <Radio size={16} color="#fff" />
          </View>
        </View>
        <T size={40} font="bold" lh={40} color="#fff" style={{ marginTop: 20 }}>{n(live)}</T>
        <T size={12} color="rgba(255,255,255,0.75)" style={{ marginTop: 8 }}>
          {live ? "Events are live on the public site" : "No event is live at the moment"}
        </T>
        <Pressable
          onPress={() => onGo("/check-in")}
          style={({ pressed }) => ({ marginTop: 20, minHeight: 42, borderRadius: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: pressed ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.15)" })}
        >
          <T size={12.5} font="semi" color="#fff">Open gate console</T>
          <ArrowUpRight size={15} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}
