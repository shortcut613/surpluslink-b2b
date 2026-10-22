import React from "react";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { SupportChat } from "@/components/SupportChat";
import { LogTicketModal } from "@/components/LogTicketModal";
import { ProductTour } from "@/components/ProductTour";
import { supabase } from "@/lib/supabase";
import { getSessionServer } from "@/lib/auth-guard";
import { getOrInitClientAuth } from "@/hooks/useAuth";
import type { User } from "@supabase/supabase-js";
import * as Sentry from "@sentry/react";

import appCss from "../styles.css?url";

// Initialize Error Tracking (Sentry Free Tier)
if (typeof window !== "undefined" && import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [Sentry.browserTracingIntegration(), Sentry.replayIntegration()],
    tracesSampleRate: 1.0, // Capture 100% of transactions for tracing
    replaysSessionSampleRate: 0.1, // Free tier: only record 10% of standard sessions
    replaysOnErrorSampleRate: 1.0, // Free tier: always record sessions where an error occurs
  });
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export interface MyRouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
  beforeLoad: async () => {
    try {
      if (typeof window !== "undefined") {
        // In browser: resolve session locally in 0ms without RPC network delay or Web Lock contention
        const auth = await getOrInitClientAuth();
        return { auth };
      }
      const { user } = await getSessionServer();
      return {
        auth: {
          user,
          role: user?.user_metadata?.role as "donor" | "ngo" | "admin" | undefined,
        },
      };
    } catch (e) {
      return { auth: { user: null, role: undefined } };
    }
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SurplusLink" },
      {
        name: "description",
        content: "Connect surplus food with verified NGOs. Reduce waste, feed communities.",
      },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "SurplusLink — Connecting Excess to Impact" },
      {
        property: "og:description",
        content: "Connect surplus food with verified NGOs. Reduce waste, feed communities.",
      },
      { property: "og:image", content: "/images/surpluslink1.png" },
      { property: "og:url", content: import.meta.env.VITE_APP_URL ?? "" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "/images/surpluslink1.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: RootErrorComponent,
});

function RootErrorComponent({ error }: { error: any }) {
  const [isTicketModalOpen, setIsTicketModalOpen] = React.useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We've encountered an unexpected error. Our systems have been notified, but you can also
          tell us what happened to help us investigate.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={() => setIsTicketModalOpen(true)}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-all hover:bg-primary/90"
          >
            Report this Issue
          </button>
          <button
            onClick={() => window.location.reload()}
            className="w-full rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-muted"
          >
            Reload Page
          </button>
        </div>
      </div>

      <LogTicketModal
        isOpen={isTicketModalOpen}
        onClose={() => setIsTicketModalOpen(false)}
        defaultCategory="System Outage"
        defaultSubject="Website Crash / Error"
        defaultMessage={`I encountered the following error:\n\n${error?.message || "Unknown error"}`}
      />
    </div>
  );
}

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap"
        />
      </head>
      <body>
        {children}
        <SupportChat />
        <ProductTour />
        <Toaster position="bottom-right" richColors />
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  );
}
