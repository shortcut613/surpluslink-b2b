import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, ExternalLink, MessageSquare, MapPin, CheckCircle2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/ngo/collection/instructions/$id")({
  head: () => ({
    meta: [{ title: "Collection Instructions — SurplusLink" }],
  }),
  validateSearch: (search: Record<string, unknown>): { from?: string } => ({
    from: (search.from as string | undefined) ?? undefined,
  }),
  component: CollectionInstructions,
});

interface BatchSummary {
  batch_type: string;
  donor: string;
  collection_datetime: string | null;
}

function CollectionInstructions() {
  const { id } = Route.useParams();
  const { from } = Route.useSearch();
  const { initials } = useAuth();
  const navigate = useNavigate();
  const showConfirmButton = from !== "claims";

  const batchId = `#${id.toUpperCase().slice(0, 8)}`;

  const [batch, setBatch] = useState<BatchSummary | null>(null);
  const [status, setStatus] = useState<string>("Claimed");
  const [verificationPin, setVerificationPin] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(true);
  const [copied, setCopied] = useState("");

  const isCollected = status.toLowerCase() === "collected" || status.toLowerCase() === "delivered";

  useEffect(() => {
    let mounted = true;

    async function fetchBatch() {
      const { data, error } = await supabase
        .from("donation_batches")
        .select(
          `
          batch_type,
          collection_datetime,
          verification_pin,
          status,
          donors!donor_id (
            organization_name
          )
        `,
        )
        .eq("id", id)
        .single();

      if (!mounted) return;

      if (!error && data) {
        const raw = data as any;
        setBatch({
          batch_type: raw.batch_type || "Surplus Food",
          donor: raw.donors?.organization_name || "Anonymous Donor",
          collection_datetime: raw.collection_datetime,
        });

        if (raw.status) {
          setStatus(raw.status);
        }

        if (raw.verification_pin) {
          // A PIN already exists in the DB — use it
          setVerificationPin(raw.verification_pin);
          setPinLoading(false);
        } else {
          // No PIN yet — generate one and persist it to the database
          const newPin = Math.floor(1000 + Math.random() * 9000).toString();
          const { error: updateError } = await supabase
            .from("donation_batches")
            .update({ verification_pin: newPin })
            .eq("id", id);

          if (mounted) {
            if (!updateError) {
              setVerificationPin(newPin);
            } else {
              console.error("Failed to save verification PIN:", updateError.message);
            }
            setPinLoading(false);
          }
        }
      } else {
        setPinLoading(false);
      }
    }

    fetchBatch();

    // Realtime subscription so when donor verifies PIN, NGO stepper advances
    const channel = supabase
      .channel(`donation_batch_channel_${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "donation_batches",
          filter: `id=eq.${id}`,
        },
        (payload: any) => {
          if (!mounted) return;
          if (payload.new) {
            if (payload.new.status) {
              setStatus(payload.new.status);
            }
            if (payload.new.verification_pin) {
              setVerificationPin(payload.new.verification_pin);
            }
          }
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [id]);

  // Format the pickup window using the database collection_datetime
  const pickupWindow = batch?.collection_datetime
    ? new Date(batch.collection_datetime).toLocaleString("en-ZA", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    });
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  }

  function openMaps() {
    window.open("https://maps.google.com", "_blank");
  }

  function sendDriver() {
    const pin = verificationPin ?? "(loading…)";
    const message = `Collection Instructions\n\nBatch: ${batchId}\nPickup Window: ${pickupWindow}\nVerification PIN: ${pin}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  return (
    <>
      <main className="mx-auto flex-1 w-full max-w-4xl px-6 py-10">
        <Link
          to="/ngo/claims"
          className="mb-6 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          &larr; Back to Claims
        </Link>

        {/* Page header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Collection Instructions</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Batch <span className="font-bold text-foreground">{batchId}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={sendDriver}
              className="inline-flex h-10 items-center gap-2 rounded-xl glass px-5 text-sm font-bold text-foreground shadow-sm hover:bg-white/40 transition-all"
            >
              <MessageSquare className="h-4 w-4" />
              Send to Driver
            </button>
            <button
              type="button"
              onClick={openMaps}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
            >
              <MapPin className="h-4 w-4" />
              Open in Maps
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </button>
          </div>
        </div>

        {/* Summary strip */}
        <section className="mb-8 rounded-3xl glass shadow-sm">
          <div className="grid divide-y divide-border/40 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {[
              { label: "Batch ID", value: batchId },
              { label: "Donor", value: batch?.donor ?? "Loading…" },
              { label: "Food Type", value: batch?.batch_type ?? "Loading…" },
              { label: "Pickup Window", value: pickupWindow },
            ].map(({ label, value }) => (
              <div key={label} className="px-6 py-5">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1.5 text-sm font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Realtime Completion Banner */}
        {isCollected && (
          <div className="mb-8 flex items-center gap-4 rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-5 shadow-sm text-emerald-950 dark:text-emerald-200">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-100">
                Collection Verified &amp; Completed!
              </h3>
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                The donor has successfully verified the 4-digit PIN. This donation is now marked as
                Collected.
              </p>
            </div>
          </div>
        )}

        {/* Main grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Donor Info */}
          <section className="rounded-3xl glass shadow-sm">
            <div className="border-b border-border/40 px-6 py-5">
              <h2 className="text-base font-bold tracking-tight">Donor Details</h2>
            </div>
            <div className="space-y-4 p-6">
              {/* Donor name */}
              <div className="rounded-2xl glass bg-white/40 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Donor Organisation
                </p>
                <p className="mt-3 text-sm font-bold">{batch?.donor ?? "Loading…"}</p>
              </div>

              {/* Batch type */}
              <div className="rounded-2xl glass bg-white/40 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Food Type
                </p>
                <p className="mt-3 text-sm font-bold capitalize">
                  {batch?.batch_type ?? "Loading…"}
                </p>
              </div>

              {/* Pickup window */}
              <div className="rounded-2xl glass bg-white/40 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Pickup Window
                </p>
                <p className="mt-3 text-sm font-bold">{pickupWindow}</p>
              </div>
            </div>
          </section>

          {/* Collection Progress */}
          <section className="rounded-3xl glass shadow-sm">
            <div className="border-b border-border/40 px-6 py-5">
              <h2 className="text-base font-bold tracking-tight">Collection Progress</h2>
            </div>
            <div className="p-6">
              <ol className="space-y-2">
                {[
                  {
                    step: 1,
                    label: "En Route",
                    desc: "Driver is travelling to the pickup location.",
                    active: !isCollected,
                    completed: isCollected,
                  },
                  {
                    step: 2,
                    label: "At Site",
                    desc: "Meet the donor contact and verify collection.",
                    active: !isCollected,
                    completed: isCollected,
                  },
                  {
                    step: 3,
                    label: "Loaded & Verified",
                    desc: isCollected
                      ? "Collection verified by donor PIN confirmation."
                      : "Confirm collection after loading is complete.",
                    active: isCollected,
                    completed: isCollected,
                  },
                ].map(({ step, label, desc, active, completed }, i, arr) => (
                  <li key={step}>
                    <div className="flex items-start gap-4 py-3">
                      <div
                        className={[
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm transition-colors",
                          completed
                            ? "bg-emerald-600 text-white ring-4 ring-emerald-500/20"
                            : active
                              ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                              : "border bg-white text-muted-foreground",
                        ].join(" ")}
                      >
                        {completed ? <Check className="h-4 w-4" /> : step}
                      </div>
                      <div>
                        <p
                          className={`text-sm font-bold ${completed ? "text-emerald-700 dark:text-emerald-400" : active ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {label}
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                    {i < arr.length - 1 && (
                      <div
                        className={`ml-[17px] h-6 w-[3px] rounded-full ${completed ? "bg-emerald-500/50" : "bg-border/60"}`}
                      />
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* Pickup Information */}
          <section className="rounded-3xl glass shadow-sm lg:col-span-2">
            <div className="border-b border-border/40 px-6 py-5">
              <h2 className="text-base font-bold tracking-tight">
                Pickup Information &amp; Verification PIN
              </h2>
            </div>
            <div className="grid gap-6 p-6 sm:grid-cols-2">
              {/* Pickup window */}
              <div className="rounded-2xl glass bg-white/40 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Pickup Window
                </p>
                <p className="mt-3 text-base font-bold tracking-tight">{pickupWindow}</p>
              </div>

              {/* Verification PIN */}
              <div className="rounded-2xl glass bg-primary/5 border border-primary/10 p-5 shadow-sm">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary/80">
                  Verification PIN
                </p>
                <p className="mb-2 mt-1 text-xs font-medium text-muted-foreground">
                  Provide this to the donor before collecting.
                </p>
                <div className="flex items-center justify-between">
                  {pinLoading ? (
                    <div className="h-10 w-28 animate-pulse rounded-lg bg-primary/10" />
                  ) : verificationPin ? (
                    <p className="text-4xl font-black tracking-[0.5rem] text-primary">
                      {verificationPin}
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-destructive">Failed to load PIN</p>
                  )}
                  <div className="flex items-center gap-3">
                    {copied === "PIN copied!" && (
                      <span className="text-xs font-bold text-emerald-600">✓ Copied</span>
                    )}
                    <button
                      type="button"
                      onClick={() => verificationPin && copy(verificationPin, "PIN copied!")}
                      disabled={!verificationPin}
                      className="rounded-xl border border-border/40 bg-white p-2 hover:bg-secondary hover:shadow-sm transition-all text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                      title="Copy PIN"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Confirm collection CTA — hidden when opened from the claims list */}
        {showConfirmButton && (
          <div className="mt-10 flex justify-end">
            <button
              type="button"
              onClick={() => navigate({ to: "/ngo/claims" })}
              className="inline-flex h-12 items-center gap-2.5 rounded-2xl bg-primary px-8 text-sm font-bold tracking-wide text-primary-foreground shadow-md hover:bg-primary/90 hover:-translate-y-0.5 transition-all"
            >
              <CheckCircle2 className="h-5 w-5" />
              Confirm Collection
            </button>
          </div>
        )}
      </main>
    </>
  );
}
