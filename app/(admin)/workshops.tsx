import React from "react";
import { AdminCrud } from "@/components/admin/AdminCrud";
import { learnConfig } from "@/components/admin/learnConfig";
import { useTheme } from "@/theme/ThemeProvider";

export default function AdminWorkshops() {
  const { c } = useTheme();
  return <AdminCrud config={learnConfig("workshop", c)} />;
}
