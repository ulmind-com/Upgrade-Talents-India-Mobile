import React from "react";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { cmsApi } from "@/lib/api";
import { formatDateTime, titleCase } from "@/lib/format";

export default function AdminAudit() {
  return (
    <AdminCrud
      config={{
        title: "Audit Log",
        singular: "Entry",
        subtitle: "Every administrative action, newest first.",
        load: () => cmsApi.auditLogs({ limit: 200 }),
        searchKeys: ["action", "actor", "actor_email", "entity"],
        primary: (r) => titleCase(r.action) || r.event || "Action",
        secondary: (r) => r.actor_email || r.actor || r.entity,
        meta: (r) => [{ label: "When", value: formatDateTime(r.created_at || r.timestamp) }],
      }}
    />
  );
}
