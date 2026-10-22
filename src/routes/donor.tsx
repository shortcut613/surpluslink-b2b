import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { type SidebarNavItem } from "@/components/AppSidebar";
import { LayoutDashboard, History, BarChart2, Network, Wallet } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";

export const donorSidebarNav: SidebarNavItem[] = [
  { to: "/donor/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/donor/history", label: "History", icon: <History className="h-4 w-4" /> },
  { to: "/donor/impact", label: "Impact & Records", icon: <BarChart2 className="h-4 w-4" /> },
  { to: "/donor/network", label: "Community Network", icon: <Network className="h-4 w-4" /> },
  { to: "/donor/funds", label: "Community Wallet", icon: <Wallet className="h-4 w-4" /> },
];

export const Route = createFileRoute("/donor")({
  beforeLoad: ({ context }) => requireRole("donor", context.auth),
  component: DonorLayout,
});

function DonorLayout() {
  return (
    <DashboardLayout nav={donorSidebarNav}>
      <Outlet />
    </DashboardLayout>
  );
}
