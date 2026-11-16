import React from "react";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { volunteersApi } from "@/lib/api";

export default function AdminVolunteers() {
  return (
    <AdminCrud
      config={{
        title: "Volunteers",
        singular: "Volunteer",
        subtitle: "Volunteers can sign in to the gate scanner.",
        load: () => volunteersApi.list({ limit: 200 }),
        create: (b) => volunteersApi.create(b),
        remove: (email) => volunteersApi.remove(email),
        idOf: (r) => r.email,
        searchKeys: ["name", "email"],
        primary: (r) => r.name || r.email,
        secondary: (r) => r.email,
        meta: (r) => (r.phone_number ? [{ label: "Phone", value: r.phone_number }] : []),
        toBody: (v) => ({ name: v.name, email: v.email, phone_number: v.phone_number || undefined, password: v.password }),
        fields: [
          { name: "name", label: "Full name", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "phone_number", label: "Phone" },
          { name: "password", label: "Access password", required: true, hint: "Used to sign in to the scanner." },
        ],
      }}
    />
  );
}
