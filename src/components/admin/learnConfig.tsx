import React from "react";
import { Eye, EyeOff } from "lucide-react-native";
import { AButton } from "@/components/admin/ui";
import type { AdminCrudConfig } from "./AdminCrud";
import { adminCoursesApi, adminWorkshopsApi } from "@/lib/api";
import { rowId, formatINR } from "@/lib/format";
import type { Palette } from "@/theme/tokens";

export function learnConfig(kind: "course" | "workshop", c: Palette): AdminCrudConfig {
  const api = kind === "course" ? adminCoursesApi : adminWorkshopsApi;
  const label = kind === "course" ? "Course" : "Workshop";
  return {
    title: kind === "course" ? "Courses" : "Workshops",
    singular: label,
    subtitle: `${label}s published here appear in the app's Learn tab.`,
    load: () => api.list({ limit: 100 }),
    create: (b) => api.create(b),
    update: (id, b) => api.update(id, b),
    remove: (id) => api.remove(id),
    searchKeys: ["title", "instructor_name"],
    primary: (r) => r.title,
    secondary: (r) => `with ${r.instructor_name || "—"}`,
    badge: (r) => ({ label: r.is_published ? "Live" : "Draft", tone: r.is_published ? "success" : "neutral" }),
    meta: (r) => [
      { label: "Fee", value: formatINR(r.price) },
      { label: "Seats", value: String(r.available_seats ?? "—") },
    ],
    rowActions: (row, { reload }) => (
      <AButton
        label={row.is_published ? "Unpublish" : "Publish"}
        size="sm"
        variant={row.is_published ? "secondary" : "primary"}
        icon={row.is_published ? <EyeOff size={14} /> : <Eye size={14} color="#fff" />}
        onPress={async () => { try { await api.publish(rowId(row), { publish: !row.is_published }); reload(); } catch {} }}
      />
    ),
    toBody: (v) => ({
      title: v.title,
      description: v.description,
      thumbnail: v.thumbnail || undefined,
      instructor_name: v.instructor_name,
      instructor_info: v.instructor_info || undefined,
      price: Number(v.price) || 0,
      available_seats: v.available_seats === "" ? undefined : Number(v.available_seats),
      start_date: v.start_date || undefined,
      end_date: v.end_date || undefined,
      registration_start_at: v.registration_start_at || undefined,
      registration_end_at: v.registration_end_at || undefined,
      display_order: Number(v.display_order) || 0,
      course_type: kind,
      is_visible: !!v.is_visible,
      is_published: !!v.is_published,
    }),
    fields: [
      { name: "title", label: "Title", required: true },
      { name: "description", label: "Description", type: "textarea", required: true },
      { name: "thumbnail", label: "Thumbnail URL", type: "url" },
      { name: "instructor_name", label: "Instructor", required: true },
      { name: "instructor_info", label: "Instructor bio", type: "textarea" },
      { name: "price", label: "Fee (₹)", type: "number", defaultValue: 0 },
      { name: "available_seats", label: "Available seats", type: "number", defaultValue: 50 },
      { name: "start_date", label: "Start date", type: "date" },
      { name: "end_date", label: "End date", type: "date" },
      { name: "registration_start_at", label: "Registration opens", type: "datetime", required: true },
      { name: "registration_end_at", label: "Registration closes", type: "datetime", required: true },
      { name: "display_order", label: "Display order", type: "number", defaultValue: 0 },
      { name: "is_visible", label: "Visible", type: "toggle", defaultValue: true },
      { name: "is_published", label: "Published", type: "toggle", defaultValue: false },
    ],
  };
}
