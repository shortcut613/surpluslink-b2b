import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { ChevronsLeft, ChevronsRight, LogOut, User, Bell, Settings, ChevronUp } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { NotificationCenter } from "@/components/NotificationCenter";
import { Logo } from "@/components/Logo";

export type SidebarNavItem = {
  to: string;
  label: string;
  icon: React.ReactNode;
};

interface AppSidebarProps {
  nav: SidebarNavItem[];
}

const STORAGE_KEY = "sl_sidebar_collapsed";

export function AppSidebar({ nav }: AppSidebarProps) {
  const { signOut, displayName, role, initials } = useAuth();
  const { isSubscribed, toggleSubscription, loading: pushLoading } = usePushSubscription();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(collapsed));
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (!profileRef.current) return;

      const target = e.target as HTMLElement;
      // Ignore clicks on Radix UI popovers and dialogs (which render in portals)
      const isRadixContent =
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("[data-radix-portal]") ||
        target.closest('[role="dialog"]');

      if (!e.composedPath().includes(profileRef.current) && !isRadixContent) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside, { capture: true });
    return () => document.removeEventListener("mousedown", handleOutside, { capture: true });
  }, []);

  // Also close dropdown when sidebar collapses
  useEffect(() => {
    if (collapsed) setProfileOpen(false);
  }, [collapsed]);

  const isAdminRoute = pathname.startsWith("/admin");
  const roleLabel = isAdminRoute
    ? "Admin"
    : role === "ngo"
      ? "NGO"
      : role === "donor"
        ? "Donor"
        : "User";
  const profileTo = role === "donor" ? "/donor/profile" : "/ngo/profile";
  const adminInitials = isAdminRoute && !initials ? "AD" : initials;

  return (
    <aside
      className={`
        hidden md:flex flex-col shrink-0 h-screen sticky top-0 z-50
        border-r border-white/10 sidebar-transition
        transition-[width] duration-300 ease-in-out overflow-visible
        ${collapsed ? "w-16" : "w-[232px]"}
      `}
      style={{
        background: "oklch(1 0 0 / 0.72)",
        backdropFilter: "blur(20px) saturate(1.8)",
        WebkitBackdropFilter: "blur(20px) saturate(1.8)",
        boxShadow: "4px 0 24px oklch(0.18 0.16 264 / 0.07), 1px 0 0 oklch(0.88 0.015 255)",
      }}
    >
      {/* ── Top: Logo + Collapse toggle ──────────────────────────────── */}
      <div
        className={`flex items-center h-16 shrink-0 px-3 ${
          collapsed ? "justify-center" : "justify-between"
        }`}
        style={{ borderBottom: "1px solid oklch(0.88 0.015 255 / 0.7)" }}
      >
        {!collapsed && (
          <Link to="/" className="flex items-center min-w-0">
            <Logo className="h-8" />
          </Link>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground/40 hover:bg-primary/8 hover:text-primary transition-colors"
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Nav items ─────────────────────────────────────────────────── */}
      <nav className="flex flex-col flex-1 gap-1 overflow-y-auto py-5 px-3 pb-3 min-h-0">
        {!collapsed && (
          <p className="mb-3 px-2 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/35 select-none">
            Menu
          </p>
        )}

        {nav.map((item) => {
          const isActive = pathname.startsWith(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              title={collapsed ? item.label : undefined}
              className={`
                relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium
                transition-all duration-150 select-none group
                ${
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm shadow-primary/10"
                    : "text-foreground/60 hover:bg-primary/5 hover:text-foreground"
                }
                ${collapsed ? "justify-center" : ""}
              `}
            >
              {/* Active bar */}
              {isActive && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-primary" />
              )}

              {/* Icon */}
              <span
                className={`shrink-0 h-4 w-4 transition-colors ${
                  isActive ? "text-primary" : "text-foreground/50 group-hover:text-foreground/80"
                }`}
              >
                {item.icon}
              </span>

              {/* Label */}
              {!collapsed && <span className="truncate leading-normal">{item.label}</span>}

              {/* Dot indicator (collapsed + active) */}
              {collapsed && isActive && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom: Profile ───────────────────────────────────────────── */}
      <div
        className="shrink-0 px-3 py-4 relative"
        style={{ borderTop: "1px solid oklch(0.88 0.015 255 / 0.7)" }}
        ref={profileRef}
      >
        {/* Profile dropdown popover — appears ABOVE the trigger */}
        {profileOpen && !collapsed && (
          <div
            className="absolute bottom-full left-3 right-3 mb-2 rounded-2xl p-1.5 z-[200] animate-in fade-in slide-in-from-bottom-2 duration-150"
            style={{
              background: "oklch(1 0 0 / 0.92)",
              backdropFilter: "blur(24px) saturate(1.8)",
              WebkitBackdropFilter: "blur(24px) saturate(1.8)",
              border: "1px solid oklch(0.88 0.015 255)",
              boxShadow:
                "0 -8px 32px oklch(0.18 0.16 264 / 0.14), 0 -2px 8px oklch(0.18 0.16 264 / 0.08)",
            }}
          >
            {/* Profile header */}
            <div className="flex flex-col items-center py-4 px-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-base mb-2.5">
                {adminInitials}
              </div>
              <p className="text-[14px] font-semibold text-foreground tracking-tight">
                {displayName}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{roleLabel} Account</p>
            </div>

            <div className="h-px bg-border mx-1 mb-1.5" />

            <div className="flex flex-col gap-0.5">
              {/* Profile link */}
              {!isAdminRoute && (
                <Link
                  to={profileTo}
                  onClick={() => setProfileOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                >
                  <User className="h-4 w-4 shrink-0" />
                  My Profile
                </Link>
              )}

              {/* Notifications */}
              <NotificationCenter>
                <button className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-muted text-left">
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <Bell className="h-4 w-4 shrink-0" />
                    Notifications
                  </div>
                </button>
              </NotificationCenter>

              {/* Sign out */}
              <button
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted text-left"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Sign Out
              </button>
            </div>

            {/* Footer links */}
            <div className="mt-2 mb-1 flex flex-wrap justify-center gap-x-2 gap-y-1 px-2 text-[10px] text-muted-foreground">
              <Link
                to="/privacy"
                className="hover:text-foreground hover:underline transition-colors"
                onClick={() => setProfileOpen(false)}
              >
                Privacy
              </Link>
              <span>·</span>
              <Link
                to="/terms"
                className="hover:text-foreground hover:underline transition-colors"
                onClick={() => setProfileOpen(false)}
              >
                Terms
              </Link>
              <span>·</span>
              <Link
                to="/cookies"
                className="hover:text-foreground hover:underline transition-colors"
                onClick={() => setProfileOpen(false)}
              >
                Cookies
              </Link>
            </div>
          </div>
        )}

        {/* Profile trigger row */}
        <button
          onClick={() => !collapsed && setProfileOpen((o) => !o)}
          title={collapsed ? displayName : undefined}
          className={`w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-all hover:bg-primary/5 ${
            profileOpen ? "bg-primary/8" : ""
          } ${collapsed ? "justify-center cursor-default" : "cursor-pointer"}`}
        >
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold select-none ring-2 ring-primary/20">
            {adminInitials}
          </div>

          {!collapsed && (
            <>
              <div className="flex-1 min-w-0 text-left">
                <p className="truncate text-[13px] font-semibold text-foreground leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                  {roleLabel} Account
                </p>
              </div>
              <ChevronUp
                className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                  profileOpen ? "rotate-0" : "rotate-180"
                }`}
              />
            </>
          )}
        </button>

        {/* Sign out shortcut — collapsed only */}
        {collapsed && (
          <button
            onClick={signOut}
            title="Sign out"
            className="mt-2 flex w-full items-center justify-center rounded-xl py-2 text-foreground/40 hover:bg-primary/5 hover:text-destructive transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
