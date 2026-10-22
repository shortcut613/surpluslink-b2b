import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "[SurplusLink] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in your .env file.",
  );
}

// Re-exported so server-side helpers (supabase-server.ts) can import the
// validated URL/key without duplicating the env-var lookup.
export { supabaseUrl, supabaseAnonKey };

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
