import { redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "./supabase-server";
import type { User } from "@supabase/supabase-js";

export interface AuthContext {
  user: User | null;
  role: "donor" | "ngo" | "admin" | undefined;
}

/**
 * Server function to securely retrieve the current user from cookies.
 * During SSR, this runs directly on the server. During CSR, it acts as an RPC.
 */
export const getSessionServer = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { user };
});

/**
 * Use inside a route's `beforeLoad` to enforce a specific role.
 * Throws a redirect to /login if the user is unauthenticated or has a
 * different role. Returns { user, role } on success.
 */
export function requireRole(required: "donor" | "ngo", auth?: AuthContext) {
  if (!auth?.user) {
    throw redirect({ to: "/login" });
  }

  if (auth.role !== required) {
    throw redirect({ to: "/login" });
  }

  return auth;
}

/**
 * Use inside a route's `beforeLoad` to enforce any authenticated session
 * without caring about role (e.g. shared pages).
 */
export function requireAuth(auth?: AuthContext) {
  if (!auth?.user) {
    throw redirect({ to: "/login" });
  }

  return auth;
}

/**
 * Use inside the admin layout's `beforeLoad` to enforce admin access.
 * Throws a redirect to /admin/login if not logged in.
 * Throws a redirect to /admin/unauthorized if logged in but not admin.
 */
export function requireAdmin(auth?: AuthContext) {
  if (!auth?.user) {
    throw redirect({ to: "/admin/login" });
  }

  if (auth.role !== "admin") {
    throw redirect({ to: "/admin/unauthorized" });
  }

  return auth;
}

/**
 * Use inside /login and /register `beforeLoad` to redirect already-authenticated
 * users straight to their dashboard.
 */
export function redirectIfAuthenticated(auth?: AuthContext) {
  if (!auth?.user) return; // Not logged in — allow through.

  if (auth.role === "donor") throw redirect({ to: "/donor/dashboard" });
  if (auth.role === "ngo") throw redirect({ to: "/ngo/dashboard" });
}
