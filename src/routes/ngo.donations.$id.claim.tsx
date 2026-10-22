import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { sendPushNotification } from "@/lib/notifications";
import { getFastCachedAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/ngo/donations/$id/claim")({
  head: () => ({ meta: [{ title: "Processing Claim — SurplusLink" }] }),
  component: ClaimProcessing,
});

const CHECKS = ["Verifying NGO account", "Checking donation availability", "Reserving your claim"];

function ClaimProcessing() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    async function processClaimTransaction() {
      try {
        const cachedAuth = getFastCachedAuth();
        let user = cachedAuth.user;

        if (!user) {
          const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 1000),
          );
          const {
            data: { session },
          } = await Promise.race([supabase.auth.getSession(), timeoutPromise]);
          user = session?.user ?? null;
        }
        if (!user) {
          throw new Error("You must be logged in to claim a donation batch.");
        }
        setStep(1);

        const batchRes = await supabase
          .from("donation_batches")
          .select("status, donor_id, batch_type, collection_datetime")
          .eq("id", id)
          .single();

        const batch = batchRes.data;
        if (batchRes.error || !batch) {
          throw new Error("This donation batch could not be found.");
        }

        if (batch.status?.toLowerCase() === "claimed") {
          navigate({
            to: "/ngo/donations/$id/unavailable",
            params: { id },
          });
          return;
        }

        const claimableStatuses = ["unclaimed", "pending", "second chance"];
        if (batch.status && !claimableStatuses.includes(batch.status.toLowerCase())) {
          throw new Error("This donation batch is not available to claim.");
        }

        setStep(2);

        const { data: claimedBatch, error: updateError } = await supabase
          .from("donation_batches")
          .update({
            status: "claimed",
            claimed_by: user.id,
            claimed_at: new Date().toISOString(),
          })
          .eq("id", id)
          .or(
            "status.ilike.unclaimed,status.ilike.pending,status.ilike.second chance,status.is.null",
          )
          .select("id")
          .maybeSingle();

        if (updateError || !claimedBatch) {
          throw new Error("Could not lock claim. Please try again.");
        }

        // Notify donor
        if (batch.donor_id) {
          sendPushNotification({
            data: {
              userId: batch.donor_id,
              payload: {
                title: "Donation Claimed!",
                body: `An NGO has claimed your ${batch.batch_type || "donation"}. A courier is being dispatched.`,
                url: "/donor/dashboard",
              },
            },
          }).catch((err: any) => console.error("Push failed:", err));
        }

        // Invalidate NGO dashboard stats
        const { queryClient } = await import("@/lib/query");
        queryClient.invalidateQueries({ queryKey: ["ngo", "dashboard", "stats"] });

        setTimeout(() => {
          navigate({
            to: "/ngo/donations/$id/success",
            params: { id },
          });
        }, 600);
      } catch (err: any) {
        setErrorMsg(err.message || "An unexpected error occurred processing your request.");
      }
    }

    processClaimTransaction();
  }, [id, navigate]);

  if (errorMsg) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-foreground/40 px-4">
        <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-xl">
          <p className="text-sm font-semibold text-destructive">Something went wrong</p>
          <p className="mt-2 text-xs text-muted-foreground">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-foreground/40 px-4 fixed inset-0 z-50 animate-fade-in backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-xl">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        <h1 className="mt-6 text-base font-semibold">Processing Your Claim</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Please wait while we verify and reserve this donation.
        </p>
        <ul className="mt-6 space-y-2 text-left text-sm">
          {CHECKS.map((c, i) => (
            <li key={c} className="flex items-center gap-2">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                  i <= step
                    ? "bg-success/20 text-[color:var(--success)]"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {i < step ? "✓" : i + 1}
              </span>
              <span className={i <= step ? "text-foreground" : "text-muted-foreground"}>{c}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
