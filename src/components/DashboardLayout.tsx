import { AppSidebar, type SidebarNavItem } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { PageTransition } from "@/components/PageTransition";

interface DashboardLayoutProps {
  nav: SidebarNavItem[];
  children: React.ReactNode;
}

/**
 * Layout for authenticated dashboard pages.
 *
 * Desktop (md+): collapsible AppSidebar on the left + scrollable content area.
 * Mobile (<md):  AppSidebar is hidden; the AppHeader with hamburger menu takes over.
 *
 * The `layout-transition` class on the root div fades the entire layout in when
 * first mounted (i.e. when navigating from a public page to a dashboard page).
 * The `PageTransition` inside the main area fades + slides the page content on
 * every subsequent route change within the dashboard.
 */
export function DashboardLayout({ nav, children }: DashboardLayoutProps) {
  const headerNav = nav.map(({ to, label }) => ({ to, label }));

  return (
    <div className="flex h-screen overflow-hidden bg-background layout-transition">
      {/* Sidebar — desktop only, slides in from left on mount */}
      <AppSidebar nav={nav} />

      {/* Right-hand shell */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden">
          <AppHeader nav={headerNav} />
        </div>

        {/* Page content — fades + slides up on every route change */}
        <main className="flex-1 overflow-y-auto">
          <PageTransition className="min-h-full">{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
