import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { ShieldCheck, LayoutDashboard, TicketCheck } from "lucide-react";

import { requireAdmin } from "@/lib/auth-guard";

export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context }) => requireAdmin(context.auth),
  component: AdminLayout,
});

const adminNav = [
  {
    to: "/admin/dashboard" as const,
    label: "Overview",
    icon: <LayoutDashboard className="h-4 w-4" />,
  },
  {
    to: "/admin/verification" as const,
    label: "NGO Verification",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    to: "/admin/tickets" as const,
    label: "Support Tickets",
    icon: <TicketCheck className="h-4 w-4" />,
  },
];

function AdminLayout() {
  return (
    <DashboardLayout nav={adminNav}>
      <Outlet />
    </DashboardLayout>
  );
}
