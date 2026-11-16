import React from "react";
import { AButton } from "@/components/admin/ui";
import { Send, Ban } from "lucide-react-native";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { useTheme } from "@/theme/ThemeProvider";
import { notificationsApi } from "@/lib/api";
import { rowId, titleCase } from "@/lib/format";

const TYPES = ["ANNOUNCEMENT", "EVENT_REMINDER", "VOTING_REMINDER", "LEADERBOARD_UPDATE", "COMPETITION_RESULT"].map((v) => ({ value: v, label: titleCase(v) }));
const PRIORITY = ["LOW", "NORMAL", "HIGH", "URGENT"].map((v) => ({ value: v, label: titleCase(v) }));

export default function AdminNotifications() {
  const { c } = useTheme();
  return (
    <AdminCrud
      config={{
        title: "Notifications",
        singular: "Announcement",
        subtitle: "Broadcast announcements and reminders to users.",
        load: () => notificationsApi.list({ limit: 100 }),
        create: (b) => notificationsApi.create(b),
        update: (id, b) => notificationsApi.update(id, b),
        searchKeys: ["title"],
        primary: (r) => r.title,
        secondary: (r) => r.message,
        badge: (r) => ({ label: titleCase(r.status) || "Draft", tone: r.status === "PUBLISHED" || r.status === "SENT" ? "success" : r.status === "CANCELLED" ? "danger" : "neutral" }),
        meta: (r) => [{ label: "Priority", value: titleCase(r.priority) || "Normal" }],
        rowActions: (row, { reload }) => (
          <>
            <AButton label="Publish" size="sm" variant="primary" icon={<Send size={13} color={"#fff"} />} onPress={async () => { try { await notificationsApi.publish(rowId(row)); reload(); } catch {} }} />
            <AButton label="Cancel" size="sm" variant="ghost" icon={<Ban size={13} color={c.danger} />} onPress={async () => { try { await notificationsApi.cancel(rowId(row)); reload(); } catch {} }} />
          </>
        ),
        toBody: (v) => ({
          title: v.title, message: v.message,
          notification_type: v.notification_type || "ANNOUNCEMENT",
          priority: v.priority || "NORMAL",
          action_url: v.action_url || undefined,
          scheduled_at: v.scheduled_at || undefined,
        }),
        fields: [
          { name: "title", label: "Title", required: true },
          { name: "message", label: "Message", type: "textarea", required: true },
          { name: "notification_type", label: "Type", type: "select", defaultValue: "ANNOUNCEMENT", options: TYPES },
          { name: "priority", label: "Priority", type: "select", defaultValue: "NORMAL", options: PRIORITY },
          { name: "action_url", label: "Action link", placeholder: "/events/abc123" },
          { name: "scheduled_at", label: "Schedule for", type: "datetime", hint: "Leave blank to send manually." },
        ],
      }}
    />
  );
}
