import React from "react";
import { AButton } from "@/components/admin/ui";
import { Eye, EyeOff } from "lucide-react-native";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { useTheme } from "@/theme/ThemeProvider";
import { cmsApi } from "@/lib/api";
import { rowId, formatEventDate, formatINR, titleCase } from "@/lib/format";

const STATUS = ["upcoming", "live", "completed", "cancelled"].map((v) => ({ value: v, label: titleCase(v) }));

export default function AdminEvents() {
  const { c } = useTheme();
  return (
    <AdminCrud
      config={{
        title: "Events",
        singular: "Event",
        subtitle: "Everything published here appears on the public app immediately.",
        emptyBody: "Create your first event to start selling tickets.",
        load: () => cmsApi.listEvents({ limit: 200 }),
        create: (b) => cmsApi.createEvent(b),
        update: (id, b) => cmsApi.updateEvent(id, b),
        remove: (id) => cmsApi.deleteEvent(id),
        searchKeys: ["title", "venue"],
        primary: (r) => r.title,
        secondary: (r) => r.venue || "Venue TBA",
        badge: (r) => ({ label: r.is_published ? "Live" : "Draft", tone: r.is_published ? "success" : "neutral" }),
        meta: (r) => [
          { label: "Date", value: formatEventDate(r.date) },
          { label: "Price", value: formatINR(r.price) },
          { label: "Status", value: titleCase(r.event_status) || "—" },
        ],
        rowActions: (row, { reload }) => (
          <AButton
            label={row.is_published ? "Unpublish" : "Publish"}
            size="sm"
            variant={row.is_published ? "secondary" : "primary"}
            icon={row.is_published ? <EyeOff size={14} color={c.fg} /> : <Eye size={14} color={"#fff"} />}
            onPress={async () => { try { await cmsApi.publishEvent(rowId(row), { publish: !row.is_published }); reload(); } catch {} }}
          />
        ),
        fields: [
          { name: "title", label: "Title", required: true, placeholder: "Neon Nights Battle" },
          { name: "description", label: "Description", type: "textarea", required: true },
          { name: "image_url", label: "Cover image URL", type: "url", hint: "Shown on the app hero and cards." },
          { name: "venue", label: "Venue", required: true },
          { name: "date", label: "Date", type: "date", required: true },
          { name: "time", label: "Time", placeholder: "7:30 PM" },
          { name: "price", label: "Base price (₹)", type: "number", defaultValue: 0 },
          { name: "capacity", label: "Capacity", type: "number", defaultValue: 100 },
          { name: "registration_deadline", label: "Registration deadline", type: "date" },
          { name: "display_order", label: "Display order", type: "number", defaultValue: 0 },
          { name: "event_status", label: "Status", type: "select", defaultValue: "upcoming", options: STATUS },
          { name: "registration_enabled", label: "Registration enabled", type: "toggle", defaultValue: true },
          { name: "ticket_enabled", label: "Ticketing enabled", type: "toggle", defaultValue: true },
          { name: "is_visible", label: "Visible on app", type: "toggle", defaultValue: true },
          { name: "is_published", label: "Published", type: "toggle", defaultValue: false },
        ],
      }}
    />
  );
}
