import React, { useState } from "react";
import { useAdmin, T, ALoading, AEmptyState, card } from "@/components/admin/ui";
import { View, ScrollView, Pressable } from "react-native";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { AdminShell } from "@/components/admin/Shell";
import { cmsApi, safe } from "@/lib/api";
import { useAsync } from "@/lib/useAsync";
import { formatINR } from "@/lib/format";

export default function AdminTickets() {
  const c = useAdmin();
  const { data: events, loading } = useAsync(() => safe(cmsApi.listEvents({ limit: 200 }), []), []);
  const [eventId, setEventId] = useState<string | null>(null);
  const list = events || [];
  const selected = list.find((e: any) => e._id === eventId);

  if (eventId && selected) {
    return (
      <AdminCrud
        config={{
          eyebrow: selected.title,
          title: "Tickets",
          singular: "Ticket tier",
          subtitle: `Ticket tiers for ${selected.title}.`,
          load: () => cmsApi.listTickets({ event_id: eventId, limit: 100 }),
          create: (b) => cmsApi.createTicket(b),
          update: (id, b) => cmsApi.updateTicket(id, b),
          remove: (id) => cmsApi.deleteTicket(id),
          primary: (r) => r.type,
          secondary: (r) => `${r.available ?? r.total_quantity} of ${r.total_quantity} available`,
          badge: (r) => (r.is_visible === false ? { label: "Hidden", tone: "neutral" } : { label: "Visible", tone: "success" }),
          meta: (r) => [{ label: "Price", value: formatINR(r.price) }],
          toBody: (v, editing) => {
            const body: any = {
              type: v.type, price: Number(v.price) || 0,
              total_quantity: Number(v.total_quantity) || 0,
              available: v.available === "" ? undefined : Number(v.available),
              sale_start: v.sale_start || undefined, sale_end: v.sale_end || undefined,
              display_order: Number(v.display_order) || 0, is_visible: !!v.is_visible,
            };
            if (!editing) body.event_id = eventId;
            return body;
          },
          fields: [
            { name: "type", label: "Tier name", required: true, placeholder: "early_bird / general / vip" },
            { name: "price", label: "Price (₹)", type: "number", required: true, defaultValue: 0 },
            { name: "total_quantity", label: "Total quantity", type: "number", required: true, defaultValue: 100 },
            { name: "available", label: "Available now", type: "number", hint: "Leave blank to match total." },
            { name: "sale_start", label: "Sale starts", type: "datetime" },
            { name: "sale_end", label: "Sale ends", type: "datetime" },
            { name: "display_order", label: "Display order", type: "number", defaultValue: 0 },
            { name: "is_visible", label: "Visible on booking page", type: "toggle", defaultValue: true },
          ],
        }}
      />
    );
  }

  return (
    <AdminShell title="Tickets">
      {loading ? (
        <ALoading rows={3} />
      ) : list.length ? (
        <View style={{ gap: 10 }}>
          {list.map((e: any) => (
            <Pressable key={e._id} onPress={() => setEventId(e._id)}>
              <View style={[card(c), { padding: 16 }]}>
                <T size={15} font="bold" numberOfLines={1}>{e.title}</T>
                <T size={12.5} mut style={{ marginTop: 2 }}>{e.venue || "Venue TBA"}</T>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <AEmptyState title="No events" body="Create an event first to add ticket tiers." />
      )}
    </AdminShell>
  );
}
