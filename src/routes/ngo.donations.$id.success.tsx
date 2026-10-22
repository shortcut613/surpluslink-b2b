import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CheckCircle2, Truck, MapPin, Check } from "lucide-react";
import { AppHeader, ngoNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { ngoSidebarNav } from "@/lib/nav";
import { supabase } from "@/lib/supabase";

import { useAuth } from "@/hooks/useAuth";
import { sendClaimNotificationEmail } from "@/lib/email";
import { sendPushNotification } from "@/lib/notifications";

export const Route = createFileRoute("/ngo/donations/$id/success")({
  head: () => ({
    meta: [{ title: "Donation Claimed — SurplusLink" }],
  }),
  component: ClaimSuccess,
});

interface BatchSummary {
  batch_type: string;
  donor: string;
  donorEmail?: string;
  pickupAddress?: string;
  collection_datetime: string | null;
}

function ClaimSuccess() {
  const { id } = Route.useParams();
  const { initials } = useAuth();
  const navigate = useNavigate();

  const [batch, setBatch] = useState<BatchSummary | null>(null);
  const [method, setMethod] = useState<"pickup" | "delivery" | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  async function loadBatchData(): Promise<BatchSummary | null> {
    const { data: batchData, error: batchError } = await supabase
      .from("donation_batches")
      .select("*, donors!donor_id(organization_name, email, address)")
      .eq("id", id)
      .maybeSingle();

    if (batchError || !batchData) {
      console.error("Error fetching batch:", batchError);
      return null;
    }

    const raw = batchData as any;
    const donorInfo = Array.isArray(raw.donors) ? raw.donors[0] : raw.donors;
    const donorName = donorInfo?.organization_name || donorInfo?.name || "Anonymous Donor";
    const donorEmail = donorInfo?.email || "";

    return {
      batch_type: raw.batch_type || "Surplus Food",
      donor: donorName,
      donorEmail: donorEmail,
      pickupAddress: raw.pickup_address || raw.address || donorInfo?.address || "",
      collection_datetime: raw.collection_datetime,
    };
  }

  useEffect(() => {
    async function init() {
      const data = await loadBatchData();
      if (data) setBatch(data);
    }
    if (id) init();
  }, [id]);

  const deadlineLabel = batch?.collection_datetime
    ? new Date(batch.collection_datetime).toLocaleString("en-ZA", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  async function handleConfirm() {
    if (!method || isSubmitting) return;
    setIsSubmitting(true);

    try {
      let activeBatch = batch;
      if (!activeBatch || !activeBatch.donorEmail) {
        activeBatch = await loadBatchData();
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      let ngoName = user?.user_metadata?.organization_name || user?.user_metadata?.name || "";
      let ngoAddress = "";

      if (user?.id) {
        const { data: ngoData, error: ngoErr } = await supabase
          .from("ngos")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (ngoErr) {
          console.error("NGO table lookup error:", ngoErr);
        } else if (ngoData) {
          ngoName = ngoData.organization_name || ngoData.name || ngoName;
          ngoAddress = ngoData.address || ngoAddress;
        }
      }

      if (!ngoName || ngoName === "Claiming NGO") {
        ngoName = user?.email ? user.email.split("@")[0] : "Claiming NGO";
      }

      // Check if verification_pin already exists in DB
      const { data: latestBatch } = await supabase
        .from("donation_batches")
        .select("verification_pin, collection_type")
        .eq("id", id)
        .maybeSingle();

      const existingPin = latestBatch?.verification_pin;
      const verificationPin = existingPin || Math.floor(1000 + Math.random() * 9000).toString();

      const updatePayload: Record<string, any> = { collection_type: method };
      if (method === "pickup") {
        updatePayload.verification_pin = verificationPin;
      }

      const { error: updateError } = await supabase
        .from("donation_batches")
        .update(updatePayload)
        .eq("id", id);

      if (updateError) {
        console.error("Error updating batch collection method:", updateError);
        return;
      }

      if (!activeBatch?.donorEmail) {
        console.error("ERROR: Donor email is empty.");
      } else {
        await sendClaimNotificationEmail({
          donorEmail: activeBatch.donorEmail,
          donorName: activeBatch.donor,
          ngoName: ngoName,
          donationDescription: activeBatch.batch_type,
          collectionDate: deadlineLabel,
          fulfillmentType: method === "pickup" ? "Pick-up" : "Delivery",
          pickupAddress: activeBatch.pickupAddress,
          deliveryAddress: ngoAddress,
          verificationPin: method === "pickup" ? verificationPin : undefined,
        });
      }

      if (method === "delivery" && user?.id) {
        // Import sendPushNotification dynamically or ensure it's imported at the top
        sendPushNotification({
          data: {
            userId: user.id,
            payload: {
              title: "Delivery Confirmed 🚚",
              body: `You selected Delivery for batch ${activeBatch?.batch_type || id}. The donor has been notified.`,
              url: `/ngo/track/${id}`,
            },
          },
        }).catch((err) => console.error("NGO Delivery push failed", err));
      }

      if (method === "pickup") {
        navigate({
          to: "/ngo/collection/instructions/$id",
          params: { id },
          search: {},
        });
        return;
      }

      if (method === "delivery") {
        navigate({ to: "/ngo/claims" });
      }
    } catch (err) {
      console.error("Error in handleConfirm:", err);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isClient) {
    return (
      <>
        <div />
      </>
    );
  }

  return (
    <>
      <main className="page-transition mx-auto max-w-2xl px-6 py-16 pb-24">
        <div className="mb-8 flex items-center gap-4 rounded-xl border bg-card px-5 py-4 shadow-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15 text-[color:var(--success)]">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Donation Successfully Claimed</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your organisation has successfully reserved this donation.
            </p>
          </div>
        </div>

        <section className="mb-6 rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Donation Details</h2>
          </div>
          <div className="grid gap-px bg-border sm:grid-cols-2">
            {[
              { label: "Batch ID", value: `#${id.toUpperCase().slice(0, 8)}` },
              { label: "Batch Type", value: batch?.batch_type ?? "Loading…" },
              { label: "Donor", value: batch?.donor ?? "Loading…" },
              { label: "Pickup Deadline", value: deadlineLabel },
            ].map(({ label, value }) => (
              <div key={label} className="bg-card px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-6 rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Collection Method</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Choose how your organisation will receive this donation.
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMethod("pickup")}
              className={[
                "rounded-xl border p-4 text-left transition-all duration-150 hover:shadow-sm",
                method === "pickup"
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-secondary/40 hover:bg-secondary",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold">We Will Pick It Up</span>
                </div>
                {method === "pickup" && (
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Your organisation will collect using its own vehicle. Arrive before the pickup
                deadline.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMethod("delivery")}
              className={[
                "rounded-xl border p-4 text-left transition-all duration-150 hover:shadow-sm",
                method === "delivery"
                  ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                  : "border-border bg-secondary/40 hover:bg-secondary",
              ].join(" ")}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold">Request Delivery</span>
                </div>
                {method === "delivery" && (
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Request doorstep delivery to your organisation via our logistics network.
              </p>
            </button>
          </div>
        </section>

        <div className="flex gap-3">
          <Link
            to="/ngo/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-secondary transition-colors"
          >
            ← Dashboard
          </Link>
          <button
            type="button"
            disabled={!method || isSubmitting}
            onClick={handleConfirm}
            className="flex-1 inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isSubmitting ? "Processing…" : "Confirm →"}
          </button>
        </div>
      </main>
    </>
  );
}
