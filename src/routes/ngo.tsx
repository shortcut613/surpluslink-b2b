import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { DashboardLayout } from "@/components/DashboardLayout";
import { type SidebarNavItem } from "@/components/AppSidebar";
import { LayoutDashboard, Search, ClipboardList } from "lucide-react";
import { requireRole } from "@/lib/auth-guard";
import { useNgoVerification } from "@/hooks/useNgoVerification";

export const ngoSidebarNav: SidebarNavItem[] = [
  { to: "/ngo/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/ngo/explore", label: "Explore Donations", icon: <Search className="h-4 w-4" /> },
  { to: "/ngo/claims", label: "My Claims", icon: <ClipboardList className="h-4 w-4" /> },
];

export const Route = createFileRoute("/ngo")({
  beforeLoad: ({ context }) => requireRole("ngo", context.auth),
  component: NgoLayout,
});

function NgoLayout() {
  const { isVerified, isChecking } = useNgoVerification();
  const location = useLocation();

  // Hide restricted tabs if not verified
  const navItems = isVerified
    ? ngoSidebarNav
    : ngoSidebarNav.filter((item) => item.to === "/ngo/dashboard" || item.to === "/ngo/profile");

  const isRestrictedRoute =
    location.pathname !== "/ngo/dashboard" &&
    location.pathname !== "/ngo/verification" &&
    location.pathname !== "/ngo/profile";

  if (isChecking) {
    return (
      <DashboardLayout nav={navItems}>
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  // Prevent optimistic UI flash on restricted routes
  if (!isVerified && isRestrictedRoute) {
    return (
      <DashboardLayout nav={navItems}>
        <div className="flex h-[50vh] items-center justify-center text-sm text-muted-foreground">
          Redirecting...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout nav={navItems}>
      <Outlet />
    </DashboardLayout>
  );
}
