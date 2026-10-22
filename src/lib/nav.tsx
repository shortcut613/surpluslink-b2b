/**
 * Shared sidebar navigation definitions.
 * Import from this file to ensure all pages in a role show the same nav.
 */
import type { SidebarNavItem } from "@/components/AppSidebar";
import {
  LayoutDashboard,
  Search,
  ClipboardList,
  History,
  BarChart2,
  Network,
  Wallet,
} from "lucide-react";

export const ngoSidebarNav: SidebarNavItem[] = [
  { to: "/ngo/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/ngo/explore", label: "Explore Donations", icon: <Search className="h-4 w-4" /> },
  { to: "/ngo/claims", label: "My Claims", icon: <ClipboardList className="h-4 w-4" /> },
];

export const donorSidebarNav: SidebarNavItem[] = [
  { to: "/donor/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-4 w-4" /> },
  { to: "/donor/history", label: "History", icon: <History className="h-4 w-4" /> },
  { to: "/donor/impact", label: "Impact & Records", icon: <BarChart2 className="h-4 w-4" /> },
  { to: "/donor/network", label: "Community Network", icon: <Network className="h-4 w-4" /> },
  { to: "/donor/funds", label: "Community Wallet", icon: <Wallet className="h-4 w-4" /> },
];
