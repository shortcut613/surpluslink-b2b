import { useEffect, useState, useCallback } from "react";
import { useRouter } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  role: "donor" | "ngo" | null;
  displayName: string;
  initials: string;
  isLoading: boolean;
}

/** Resolve a human-readable display name from Supabase user metadata. */
function resolveDisplayName(user: User | null): string {
  if (!user) return "User";
  const m = user.user_metadata ?? {};
  return (
    m.business_name ||
    m.organization_name ||
    m.full_name ||
    m.name ||
    user.email?.split("@")[0] ||
    "User"
  );
}

function resolveInitials(name: string): string {
  if (!name) return "";
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return words[0][0].toUpperCase();
}

let globalAuthState: AuthState = {
  user: null,
  role: null,
  displayName: "User",
  initials: "US",
  isLoading: true,
};
const authSubscribers = new Set<(s: AuthState) => void>();
let isInitialized = false;

function broadcastAuthState(newState: AuthState) {
  globalAuthState = newState;
  authSubscribers.forEach((subscriber) => subscriber(newState));
}

export function getFastCachedAuth(): {
  user: User | null;
  role: "donor" | "ngo" | "admin" | undefined;
  displayName: string;
  initials: string;
  isLoading: boolean;
} {
  const user = globalAuthState.user;
  const role = (user?.user_metadata?.role || globalAuthState.role) as
    "donor" | "ngo" | "admin" | undefined;
  return {
    user,
    role,
    displayName: globalAuthState.displayName,
    initials: globalAuthState.initials,
    isLoading: globalAuthState.isLoading,
  };
}

export function initGlobalAuth() {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  // Listen to auth state changes from Supabase (runs on login, logout, token refresh)
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    const displayName = resolveDisplayName(user);
    broadcastAuthState({
      user,
      role: (user?.user_metadata?.role as "donor" | "ngo") ?? null,
      displayName,
      initials: resolveInitials(displayName),
      isLoading: false,
    });
  });

  // Fast session check protected by timeout to prevent hanging on Web Locks
  const timeoutPromise = new Promise<{ data: { session: null }; error: Error }>((resolve) =>
    setTimeout(
      () => resolve({ data: { session: null }, error: new Error("Session check timed out") }),
      800,
    ),
  );

  Promise.race([supabase.auth.getSession(), timeoutPromise])
    .then(({ data: { session } }) => {
      const user = session?.user ?? null;
      const displayName = resolveDisplayName(user);
      broadcastAuthState({
        user,
        role: (user?.user_metadata?.role as "donor" | "ngo") ?? null,
        displayName,
        initials: resolveInitials(displayName),
        isLoading: false,
      });
    })
    .catch((err) => {
      console.warn("[SurplusLink] Fast auth init fallback:", err);
      broadcastAuthState({
        user: null,
        role: null,
        displayName: "User",
        initials: "US",
        isLoading: false,
      });
    });
}

/**
 * Returns current client-side auth state instantly (0ms) if already initialized,
 * or awaits initial load with an 800ms safety timeout to guarantee it never hangs.
 */
export async function getOrInitClientAuth(): Promise<{
  user: User | null;
  role: "donor" | "ngo" | "admin" | undefined;
}> {
  if (typeof window === "undefined") {
    return { user: null, role: undefined };
  }

  // Fast path: already initialized and loaded in memory! (0ms)
  if (isInitialized && !globalAuthState.isLoading) {
    const cached = getFastCachedAuth();
    return { user: cached.user, role: cached.role };
  }

  initGlobalAuth();

  // If already ready immediately
  if (!globalAuthState.isLoading) {
    const cached = getFastCachedAuth();
    return { user: cached.user, role: cached.role };
  }

  // Await resolution with timeout
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const cached = getFastCachedAuth();
      resolve({ user: cached.user, role: cached.role });
    }, 800);

    const listener = (state: AuthState) => {
      if (!state.isLoading) {
        clearTimeout(timer);
        authSubscribers.delete(listener);
        const role = (state.user?.user_metadata?.role || state.role) as
          "donor" | "ngo" | "admin" | undefined;
        resolve({ user: state.user, role });
      }
    };
    authSubscribers.add(listener);
  });
}

/**
 * Core auth hook managing user session, roles, and derived profile info.
 */
export function useAuth(requiredRole?: "donor" | "ngo") {
  const router = useRouter();

  if (typeof window !== "undefined") {
    initGlobalAuth();
  }

  const [state, setState] = useState<AuthState>(globalAuthState);

  useEffect(() => {
    authSubscribers.add(setState);
    if (globalAuthState !== state) {
      setState(globalAuthState);
    }
    return () => {
      authSubscribers.delete(setState);
    };
  }, []);

  // Enforce role guard if explicitly requested by a component
  useEffect(() => {
    if (!state.isLoading && requiredRole) {
      if (!state.user || state.role !== requiredRole) {
        router.navigate({ to: "/login" });
      }
    }
  }, [state.isLoading, state.user, state.role, requiredRole, router]);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out:", error);
    } finally {
      broadcastAuthState({
        user: null,
        role: null,
        displayName: "User",
        initials: "US",
        isLoading: false,
      });
      // Fallback: clear cookies manually if SSR cookies persist
      document.cookie.split(";").forEach((c) => {
        document.cookie = c
          .replace(/^ +/, "")
          .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
      });
      // Force navigation
      router.navigate({ to: "/login" });
    }
  }, [router]);

  return { ...state, signOut };
}
