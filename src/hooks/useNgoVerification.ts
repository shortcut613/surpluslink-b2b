import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { supabase } from "@/lib/supabase";
import { getFastCachedAuth } from "@/hooks/useAuth";

interface NgoVerificationCache {
  userId: string;
  isAuthorized: boolean;
  isVerified: boolean;
  user: any;
  timestamp: number;
}

let verificationCache: NgoVerificationCache | null = null;
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export function invalidateNgoVerificationCache() {
  verificationCache = null;
}

export function useNgoVerification() {
  const navigate = useNavigate();
  const location = useLocation();

  const cached =
    verificationCache && Date.now() - verificationCache.timestamp < CACHE_TTL_MS
      ? verificationCache
      : null;

  const [isAuthorized, setIsAuthorized] = useState(cached ? cached.isAuthorized : false);
  const [isVerified, setIsVerified] = useState(cached ? cached.isVerified : false);
  const [isChecking, setIsChecking] = useState(!cached);
  const [user, setUser] = useState<any>(cached ? cached.user : null);

  useEffect(() => {
    if (verificationCache && Date.now() - verificationCache.timestamp < CACHE_TTL_MS) {
      return;
    }

    let isMounted = true;

    const verifyAccess = async () => {
      try {
        const cachedAuth = getFastCachedAuth();
        let currentUser = cachedAuth.user;

        if (!currentUser) {
          const sessionTimeout = new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 1000),
          );
          const {
            data: { session },
          } = await Promise.race([supabase.auth.getSession(), sessionTimeout]);
          currentUser = session?.user ?? null;
        }

        if (!currentUser) {
          if (isMounted) {
            setIsChecking(false);
            navigate({ to: "/login" });
          }
          return;
        }

        const metadata = currentUser.user_metadata || {};
        const isNgo = metadata.role === "ngo";

        if (!isNgo) {
          if (isMounted) {
            setIsChecking(false);
            navigate({ to: "/login" });
          }
          return;
        }

        let verified = Boolean(metadata.is_verified);

        // Fetch verification status with safety timeout so it never blocks the UI
        try {
          const dbPromise = supabase
            .from("ngos")
            .select("is_verified")
            .eq("id", currentUser.id)
            .maybeSingle();

          const dbTimeout = new Promise<{ data: null; error: Error }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: new Error("DB timeout") }), 2000),
          );

          const { data, error } = await Promise.race([dbPromise, dbTimeout]);

          if (!error && data) {
            verified = Boolean(data.is_verified) || Boolean(metadata.is_verified);
          }
        } catch (dbErr) {
          console.warn("[useNgoVerification] DB check fallback to metadata:", dbErr);
        }

        verificationCache = {
          userId: currentUser.id,
          isAuthorized: true,
          isVerified: verified,
          user: currentUser,
          timestamp: Date.now(),
        };

        if (isMounted) {
          setUser(currentUser);
          setIsVerified(verified);
          setIsAuthorized(true);
          setIsChecking(false);
        }
      } catch (error) {
        console.error("Verification check failed:", error);
        if (isMounted) {
          setIsChecking(false);
          navigate({ to: "/login" });
        }
      }
    };

    verifyAccess();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // Route access guard for unverified NGOs without triggering network waterfalls
  useEffect(() => {
    if (
      !isChecking &&
      !isVerified &&
      location.pathname !== "/ngo/dashboard" &&
      location.pathname !== "/ngo/verification" &&
      location.pathname !== "/ngo/profile"
    ) {
      navigate({ to: "/ngo/dashboard" });
    }
  }, [isChecking, isVerified, location.pathname, navigate]);

  return { isAuthorized, isVerified, isChecking, user };
}
