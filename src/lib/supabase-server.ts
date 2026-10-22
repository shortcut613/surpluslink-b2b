import { createServerClient } from "@supabase/ssr";
import { getCookies, setCookie } from "@tanstack/react-start/server";
import { supabaseUrl, supabaseAnonKey } from "./supabase";

export function createSupabaseServerClient() {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        const cookies = getCookies();
        return Object.entries(cookies).map(([name, value]) => ({
          name,
          value: value as string,
        }));
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => setCookie(name, value, options));
        } catch {
          // Ignore if called from a Server Component outside a mutation
        }
      },
    },
  });
}
