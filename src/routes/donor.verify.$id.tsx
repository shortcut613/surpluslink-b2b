import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, CheckCircle2, AlertCircle, XCircle, Lock, Package, User } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/notifications";

export const Route = createFileRoute("/donor/verify/$id")({
  head: () => ({ meta: [{ title: "Verify Pickup — SurplusLink" }] }),
  component: VerifyPickup,
});

// ── constants ─────────────────────────────────────────────────────────────────
const PIN_LENGTH = 4;
const MAX_ATTEMPTS = 5;

interface BatchVerifyInfo {
  id: string;
  batch_type: string;
  verification_pin: string | null;
  collection_type: string | null;
  claimed_by: string | null;
  donor_id: string | null;
  ngoName: string;
}

// ── component ─────────────────────────────────────────────────────────────────
function VerifyPickup() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const storageKey = `pin_attempts_${id}`;

  // data
  const [batch, setBatch] = useState<BatchVerifyInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // PIN input state
  const [digits, setDigits] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [attempts, setAttempts] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`pin_attempts_${id}`);
      return saved ? parseInt(saved, 10) || 0 : 0;
    }
    return 0;
  });
  const [shaking, setShaking] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phase, setPhase] = useState<"entry" | "success" | "locked">(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(`pin_attempts_${id}`);
      const count = saved ? parseInt(saved, 10) || 0 : 0;
      if (count >= MAX_ATTEMPTS) return "locked";
    }
    return "entry";
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // ── fetch batch ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const { data, error } = await supabase
          .from("donation_batches")
          .select(
            `
            id,
            batch_type,
            verification_pin,
            collection_type,
            claimed_by,
            donor_id
          `,
          )
          .eq("id", id)
          .single();

        if (!mounted) return;
        if (error || !data) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        const raw = data as any;

        // Resolve NGO name from claimed_by
        let ngoName = "NGO";
        if (raw.claimed_by) {
          const { data: ngo } = await supabase
            .from("ngos")
            .select("organization_name")
            .eq("id", raw.claimed_by)
            .maybeSingle();
          if (ngo?.organization_name) ngoName = ngo.organization_name;
        }

        if (mounted) {
          setBatch({
            id: raw.id,
            batch_type: raw.batch_type || "Surplus Food",
            verification_pin: raw.verification_pin ?? null,
            collection_type: raw.collection_type ?? null,
            claimed_by: raw.claimed_by ?? null,
            donor_id: raw.donor_id ?? null,
            ngoName,
          });
        }
      } catch (err) {
        if (mounted) setNotFound(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id]);

  // ── PIN input helpers ────────────────────────────────────────────────────────
  const handleDigitChange = useCallback((index: number, value: string) => {
    const clean = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < PIN_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }, []);

  const handleKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace" && !digits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    },
    [digits],
  );

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, PIN_LENGTH);
    if (!pasted) return;
    const next = Array(PIN_LENGTH).fill("");
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    const focusIdx = Math.min(pasted.length, PIN_LENGTH - 1);
    inputRefs.current[focusIdx]?.focus();
  }, []);

  const enteredPin = digits.join("");
  const pinComplete = enteredPin.length === PIN_LENGTH;

  // ── shake animation ──────────────────────────────────────────────────────────
  function triggerShake() {
    setShaking(true);
    setTimeout(() => setShaking(false), 600);
  }

  // ── verify ───────────────────────────────────────────────────────────────────
  async function handleVerify() {
    if (!pinComplete || verifying || phase !== "entry" || !batch) return;

    setVerifying(true);
    setErrorMsg(null);

    const newAttempts = attempts + 1;

    if (enteredPin.trim() !== String(batch.verification_pin || "").trim()) {
      setAttempts(newAttempts);
      if (typeof window !== "undefined") {
        sessionStorage.setItem(storageKey, String(newAttempts));
      }
      triggerShake();
      setDigits(Array(PIN_LENGTH).fill(""));
      inputRefs.current[0]?.focus();

      if (newAttempts >= MAX_ATTEMPTS) {
        setPhase("locked");
      } else {
        setErrorMsg(
          `Incorrect PIN. ${MAX_ATTEMPTS - newAttempts} attempt${MAX_ATTEMPTS - newAttempts === 1 ? "" : "s"} remaining.`,
        );
      }

      setVerifying(false);
      return;
    }

    // ✅ Correct — update status + notify both parties
    try {
      await supabase.from("donation_batches").update({ status: "Collected" }).eq("id", id);

      if (typeof window !== "undefined") {
        sessionStorage.removeItem(storageKey);
      }

      // Invalidate React Query caches
      queryClient.invalidateQueries({ queryKey: ["donor", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["donor", "impact"] });
      queryClient.invalidateQueries({ queryKey: ["ngo", "dashboard", "stats"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });

      // Notify donor (self)
      if (batch.donor_id) {
        sendPushNotification({
          data: {
            userId: batch.donor_id,
            payload: {
              title: "Collection Verified ✅",
              body: `Your ${batch.batch_type} donation was successfully picked up by ${batch.ngoName}.`,
              url: "/donor/history",
            },
          },
        }).catch(console.error);
      }

      // Notify NGO
      if (batch.claimed_by) {
        sendPushNotification({
          data: {
            userId: batch.claimed_by,
            payload: {
              title: "Pickup Confirmed ✅",
              body: `The donor has verified your collection for the ${batch.batch_type} batch. Safe travels!`,
              url: "/ngo/claims",
            },
          },
        }).catch(console.error);
      }

      setPhase("success");
    } catch (err) {
      setErrorMsg("Verification failed. Please try again.");
    } finally {
      setVerifying(false);
    }
  }

  // ── loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <>
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="h-16 w-16 mx-auto rounded-full bg-muted animate-pulse mb-6" />
          <div className="h-6 w-48 mx-auto rounded bg-muted animate-pulse mb-3" />
          <div className="h-4 w-64 mx-auto rounded bg-muted animate-pulse" />
        </main>
      </>
    );
  }

  if (notFound || !batch) {
    return (
      <>
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium">Batch not found</p>
          <Link
            to="/donor/dashboard"
            className="mt-3 inline-block text-sm text-primary hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </main>
      </>
    );
  }

  // No PIN set (batch wasn't a pickup, or pin not stored)
  if (!batch.verification_pin) {
    return (
      <>
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" />
          <p className="mt-4 text-sm font-medium">No verification PIN for this batch</p>
          <p className="mt-1 text-xs text-muted-foreground">
            This batch may have requested delivery, or the PIN hasn't been generated yet.
          </p>
          <Link
            to="/donor/dashboard"
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            ← Back to Dashboard
          </Link>
        </main>
      </>
    );
  }

  // ── success state ─────────────────────────────────────────────────────────────
  if (phase === "success") {
    return (
      <>
        <main className="mx-auto max-w-md px-6 py-16">
          <div className="flex flex-col items-center text-center">
            {/* Animated success ring */}
            <div className="relative flex h-24 w-24 items-center justify-center">
              <div
                className="absolute inset-0 rounded-full bg-emerald-500/15 animate-ping"
                style={{ animationDuration: "1.5s", animationIterationCount: 3 }}
              />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="h-10 w-10 text-white" />
              </div>
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground">
              Collection Verified!
            </h1>
            <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
              <span className="font-semibold text-foreground">{batch.ngoName}</span> has
              successfully collected your{" "}
              <span className="font-semibold text-foreground">{batch.batch_type}</span> donation.
              Both you and the NGO have been notified.
            </p>

            {/* Summary card */}
            <div className="mt-8 w-full rounded-2xl glass p-5 text-left shadow-sm space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Batch Type</span>
                <span className="font-semibold capitalize">{batch.batch_type}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border/40 pt-3">
                <span className="text-muted-foreground font-medium">Collected By</span>
                <span className="font-semibold">{batch.ngoName}</span>
              </div>
              <div className="flex items-center justify-between text-sm border-t border-border/40 pt-3">
                <span className="text-muted-foreground font-medium">Status</span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  Collected
                </span>
              </div>
            </div>

            <div className="mt-6 flex gap-3 w-full">
              <Link
                to="/donor/history"
                className="flex-1 inline-flex h-10 items-center justify-center rounded-xl border text-sm font-medium hover:bg-secondary transition-colors"
              >
                View History
              </Link>
              <Link
                to="/donor/dashboard"
                className="flex-1 inline-flex h-10 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Dashboard →
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ── locked state ──────────────────────────────────────────────────────────────
  if (phase === "locked") {
    return (
      <>
        <main className="mx-auto max-w-md px-6 py-16 text-center">
          <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
          <h1 className="mt-6 text-xl font-bold tracking-tight">Too Many Attempts</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
            Verification has been locked after {MAX_ATTEMPTS} failed attempts. Please ask the NGO
            representative to confirm the correct PIN.
          </p>
          <Link
            to="/donor/dashboard"
            className="mt-8 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Back to Dashboard
          </Link>
        </main>
      </>
    );
  }

  // ── main entry state ──────────────────────────────────────────────────────────
  return (
    <>
      <main className="mx-auto max-w-md px-6 py-10">
        <Link
          to="/donor/dashboard"
          className="mb-8 inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 shadow-inner mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Verify Self-Collection</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-xs leading-relaxed">
            Ask the NGO representative for the 4-digit code shown on their Collection Instructions
            screen.
          </p>
        </div>

        {/* Batch + NGO info */}
        <div className="mb-8 rounded-2xl glass p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Batch
              </p>
              <p className="text-sm font-semibold capitalize">{batch.batch_type}</p>
            </div>
          </div>
          <div className="border-t border-border/40 pt-3 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <User className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Collecting Organisation
              </p>
              <p className="text-sm font-semibold">{batch.ngoName}</p>
            </div>
          </div>
        </div>

        {/* PIN digit boxes */}
        <div className="mb-4">
          <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Enter Verification PIN
          </p>
          <div
            className={`flex justify-center gap-3 ${shaking ? "animate-[shake_0.6s_ease-in-out]" : ""}`}
            style={
              shaking
                ? {
                    animation: "shake 0.6s ease-in-out",
                  }
                : {}
            }
          >
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputRefs.current[i] = el;
                }}
                id={`pin-digit-${i}`}
                type="text"
                inputMode="numeric"
                maxLength={2}
                value={digit}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                onPaste={i === 0 ? handlePaste : undefined}
                disabled={verifying}
                className={[
                  "h-16 w-14 rounded-2xl border-2 text-center text-2xl font-bold tracking-widest outline-none transition-all duration-200",
                  "focus:ring-4 focus:ring-primary/20",
                  digit
                    ? "border-primary bg-primary/5 text-primary shadow-sm"
                    : "border-border bg-background text-foreground",
                  errorMsg && !shaking ? "border-destructive/60 bg-destructive/5" : "",
                  verifying ? "opacity-60 cursor-not-allowed" : "",
                ].join(" ")}
              />
            ))}
          </div>
        </div>

        {/* Attempt indicator dots */}
        {attempts > 0 && (
          <div className="mb-2 flex justify-center gap-1.5">
            {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i < attempts ? "bg-destructive" : "bg-border"
                }`}
              />
            ))}
          </div>
        )}

        {/* Error message */}
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
            <p className="text-xs font-medium text-destructive">{errorMsg}</p>
          </div>
        )}

        {/* Submit */}
        <button
          id="verify-pin-btn"
          type="button"
          onClick={handleVerify}
          disabled={!pinComplete || verifying}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-bold tracking-wide shadow-md shadow-primary/25 hover:bg-primary/90 hover:-translate-y-0.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:translate-y-0"
        >
          <Lock className="h-4 w-4" />
          {verifying ? "Verifying…" : "Verify Collection"}
        </button>

        <p className="mt-4 text-center text-[11px] text-muted-foreground leading-relaxed">
          The PIN is displayed on the NGO's Collection Instructions screen. Only verify when the
          representative is physically present.
        </p>
      </main>

      {/* Inline CSS for shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15%       { transform: translateX(-8px); }
          30%       { transform: translateX(8px); }
          45%       { transform: translateX(-6px); }
          60%       { transform: translateX(6px); }
          75%       { transform: translateX(-4px); }
          90%       { transform: translateX(4px); }
        }
      `}</style>
    </>
  );
}
