import { Link, useRouterState } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Menu, X, User, HeartHandshake, Settings, LogOut, Moon, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { NotificationCenter } from "@/components/NotificationCenter";
import { CommunityWalletForm } from "@/components/CommunityWalletForm";
import { Logo } from "@/components/Logo";

type NavItem = { to: string; label: string };

interface AppHeaderProps {
  nav?: NavItem[];
  userLabel?: string;
}

export function AppHeader({ nav = [] }: AppHeaderProps) {
  const { user, signOut, displayName, role, initials } = useAuth();
  const { isSubscribed, toggleSubscription, loading: pushLoading } = usePushSubscription();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!dropdownRef.current) return;
      // Use composedPath which is more reliable than Node.contains, especially for SVGs
      const path = event.composedPath();
      const target = event.target as HTMLElement;

      // Ignore clicks on Radix UI popovers and dialogs (which render in portals)
      const isRadixContent =
        target.closest("[data-radix-popper-content-wrapper]") ||
        target.closest("[data-radix-portal]") ||
        target.closest('[role="dialog"]');

      if (!path.includes(dropdownRef.current) && !isRadixContent) {
        setProfileOpen(false);
      }
    }
    // Listen on capture phase to ensure we evaluate before any bubbling stops
    document.addEventListener("mousedown", handleClickOutside, { capture: true });
    return () => document.removeEventListener("mousedown", handleClickOutside, { capture: true });
  }, []);

  return (
    <header className="relative z-[100] sticky top-0 glass-nav">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        {/* Logo */}
        <div className="flex flex-1 justify-start">
          <Link to="/" className="flex items-center shrink-0">
            <Logo className="h-10" />
          </Link>
        </div>

        {/* Desktop nav */}
        <nav className="hidden items-center justify-center gap-6 text-sm text-muted-foreground md:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`transition-colors hover:text-foreground ${
                pathname.startsWith(n.to) ? "font-medium text-foreground" : ""
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
          {/* Avatar Dropdown Container */}
          {user && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground hover:ring-2 hover:ring-primary/30 transition-all focus:outline-none"
              >
                {initials}
              </button>

              {/* Dropdown Menu */}
              {profileOpen && (
                <div
                  className="absolute right-0 mt-2 w-64 origin-top-right rounded-2xl border border-black/8 bg-white/95 backdrop-blur-xl p-1.5 animate-in fade-in zoom-in-95 duration-100 z-[110]"
                  style={{
                    boxShadow:
                      "0 20px 60px oklch(0.18 0.16 264 / 0.18), 0 4px 16px oklch(0.18 0.16 264 / 0.10)",
                  }}
                >
                  {/* Profile Header Block */}
                  <div className="flex flex-col items-center justify-center py-5 px-4 pb-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg mb-3">
                      {initials}
                    </div>
                    <h3 className="text-[15px] font-semibold text-popover-foreground tracking-tight">
                      {displayName}
                    </h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {role === "ngo" ? "NGO" : role === "donor" ? "Donor" : "User"} Account
                    </p>
                  </div>

                  <div className="h-px bg-border mx-2 mb-1.5"></div>

                  {/* Menu Items */}
                  <div className="flex flex-col gap-0.5">
                    <Link
                      to={role === "donor" ? "/donor/profile" : "/ngo/profile"}
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted"
                    >
                      <User className="h-4 w-4" />
                      My Profile
                    </Link>

                    {role === "donor" && (
                      <button
                        onClick={() => {
                          setProfileOpen(false);
                          setWalletModalOpen(true);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted text-left"
                      >
                        <HeartHandshake className="h-4 w-4" />
                        Community Wallet
                      </button>
                    )}

                    <NotificationCenter>
                      <button className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-muted text-left">
                        <div className="flex items-center gap-3 text-sm text-primary">
                          <Bell className="h-4 w-4" />
                          Notifications
                        </div>
                      </button>
                    </NotificationCenter>

                    <button
                      onClick={signOut}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-popover-foreground transition-colors hover:bg-muted text-left"
                    >
                      <LogOut className="h-4 w-4" />
                      Log Out
                    </button>
                  </div>

                  {/* Footer Links */}
                  <div className="mt-3 mb-2 flex flex-wrap justify-center gap-x-2 gap-y-1 px-2 text-[10px] text-muted-foreground text-center">
                    <Link
                      to="/privacy"
                      className="hover:text-foreground hover:underline transition-colors"
                    >
                      Privacy Policy
                    </Link>
                    <span>·</span>
                    <Link
                      to="/terms"
                      className="hover:text-foreground hover:underline transition-colors"
                    >
                      Terms of Service
                    </Link>
                    <span>·</span>
                    <Link
                      to="/cookies"
                      className="hover:text-foreground hover:underline transition-colors"
                    >
                      Cookie Policy
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Hamburger — mobile only */}
          {nav.length > 0 && (
            <button
              onClick={() => setOpen((o) => !o)}
              aria-label="Toggle menu"
              className="md:hidden flex items-center justify-center rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile drawer */}
      {open && nav.length > 0 && (
        <div className="glass-nav border-t border-black/5 px-4 pb-4 pt-3 md:hidden">
          <nav className="flex flex-col gap-1">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  pathname.startsWith(n.to)
                    ? "bg-primary/10 text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Community Wallet Modal */}
      {walletModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/70 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
          <div className="relative w-full max-w-4xl my-auto animate-in fade-in zoom-in-95">
            <button
              onClick={() => setWalletModalOpen(false)}
              className="absolute -top-4 -right-4 sm:-right-6 sm:-top-6 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background border border-border shadow-md hover:bg-muted text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="w-full">
              <CommunityWalletForm onSuccess={() => setWalletModalOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export const donorNav: NavItem[] = [
  { to: "/donor/dashboard", label: "Dashboard" },
  { to: "/donor/history", label: "History" },
  { to: "/donor/impact", label: "Impact & Records" },
  { to: "/donor/network", label: "Community Network" },
];

export const ngoNav: NavItem[] = [
  { to: "/ngo/dashboard", label: "Dashboard" },
  { to: "/ngo/explore", label: "Explore Donations" },
  { to: "/ngo/claims", label: "My Claims" },
];
