import React from "react";
import { AButton } from "@/components/admin/ui";
import { Send } from "lucide-react-native";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { useTheme } from "@/theme/ThemeProvider";
import { judgesApi } from "@/lib/api";

export default function AdminJudges() {
  const { c } = useTheme();
  return (
    <AdminCrud
      config={{
        title: "Judges",
        singular: "Judge",
        subtitle: "Invite judges and manage competition panels.",
        load: () => judgesApi.list({ limit: 200 }),
        create: (b) => judgesApi.create(b),
        searchKeys: ["name", "email"],
        primary: (r) => r.name || r.email,
        secondary: (r) => r.email,
        meta: (r) => [{ label: "Expertise", value: r.expertise || "—" }],
        rowActions: (row) => (
          <AButton label="Invite" size="sm" variant="secondary" icon={<Send size={13} color={c.fg} />} onPress={async () => { try { await judgesApi.sendInvitation(row.email); } catch {} }} />
        ),
        toBody: (v) => ({ name: v.name, email: v.email, phone_number: v.phone_number || undefined, expertise: v.expertise || undefined, bio: v.bio || undefined }),
        fields: [
          { name: "name", label: "Full name", required: true },
          { name: "email", label: "Email", type: "email", required: true },
          { name: "phone_number", label: "Phone" },
          { name: "expertise", label: "Expertise", placeholder: "Hip hop, Contemporary" },
          { name: "bio", label: "Short bio", type: "textarea" },
        ],
      }}
    />
  );
}
