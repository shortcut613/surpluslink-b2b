import { createFileRoute, Link } from "@tanstack/react-router";
import React, { useEffect, useRef, useState } from "react";
import { AppHeader, ngoNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { ngoSidebarNav } from "@/lib/nav";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/ui/status-badge";
import { sendPushNotification } from "@/lib/notifications";
import {
  Package,
  Navigation,
  Star,
  Car,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MapPin,
} from "lucide-react";
import {
  getSimulatedDriver,
  getDeliveryProgress,
  type DeliveryPhase,
  type SimulatedDriver,
} from "@/lib/delivery-sim";
import { useDeliveryMap } from "@/lib/useDeliveryMap";

import { useAuth, getFastCachedAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/ngo/track/$id")({
  head: () => ({ meta: [{ title: "Track Delivery — SurplusLink" }] }),
  component: TrackDelivery,
});

interface BatchInfo {
  id: string;
  batch_type: string;
  status: string;
  collection_datetime: string | null;
  claimed_at: string | null;
  // needed for push notifications
  claimed_by: string | null;
  donor_id: string | null;
  donor: string;
  pickup: string;
}

// ─────────────────────────────────────────────────────────────────────────────

function TrackDelivery() {
  const { id } = Route.useParams();
  const { initials } = useAuth();

  const [batch, setBatch] = useState<BatchInfo | null>(null);
  const [ngoAddress, setNgoAddress] = useState("");
  const [ngoName, setNgoName] = useState("NGO");
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Simulation state — driven by a 5-second interval
  const [progress, setProgress] = useState(0);
  const [etaMinutes, setEtaMinutes] = useState(45);
  const [phase, setPhase] = useState<DeliveryPhase>("preparing");

  // Ensure each DB status update fires only once per session
  const updatedRef = useRef<Set<string>>(new Set());

  // The <div> the map will be rendered into
  const mapRef = useRef<HTMLDivElement>(null);

  // ── 1. Fetch batch data + current NGO's address ───────────────────────────
  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      try {
        setLoading(true);

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

        // Fetch NGO profile and donation batch concurrently
        const [ngoRes, batchRes] = await Promise.all([
          user
            ? supabase
                .from("ngos")
                .select("organization_name, address")
                .eq("id", user.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from("donation_batches")
            .select(
              `
              id,
              batch_type,
              status,
              collection_datetime,
              claimed_at,
              claimed_by,
              donor_id,
              donors!donor_id (
                organization_name,
                address
              )
            `,
            )
            .eq("id", id)
            .single(),
        ]);

        if (ngoRes.data && isMounted) {
          if (ngoRes.data.address) setNgoAddress(ngoRes.data.address);
          if (ngoRes.data.organization_name) setNgoName(ngoRes.data.organization_name);
        }

        const data = batchRes.data;
        const error = batchRes.error;

        if (!isMounted) return;

        if (error || !data) {
          setNotFound(true);
        } else {
          const raw = data as any;
          setBatch({
            id: raw.id,
            batch_type: raw.batch_type || "Surplus Food",
            status: raw.status || "Claimed",
            collection_datetime: raw.collection_datetime,
            claimed_at: raw.claimed_at,
            claimed_by: raw.claimed_by ?? null,
            donor_id: raw.donor_id ?? null,
            donor: raw.donors?.organization_name || "Anonymous Donor",
            pickup: raw.donors?.address || "Location not specified",
          });
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching delivery tracking details:", err);
          setNotFound(true);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [id]);

  // ── 2. Progress interval (ticks every 1 s) ────────────────────────────────
  useEffect(() => {
    if (!batch) return;

    // If already delivered, snap to final state immediately
    if (batch.status.toLowerCase() === "delivered") {
      setProgress(1);
      setEtaMinutes(0);
      setPhase("delivered");
      return;
    }

    const tick = () => {
      const result = getDeliveryProgress(batch.claimed_at, batch.collection_datetime);
      setProgress(result.progress);
      setEtaMinutes(result.etaMinutes);
      setPhase(result.phase);
    };

    tick(); // calculate immediately on mount / batch change
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [batch?.id, batch?.status]);

  // ── 3. Auto-advance DB status when phase thresholds are crossed ───────────
  useEffect(() => {
    if (!batch) return;
    if (batch.status.toLowerCase() === "delivered") return;

    async function maybeUpdate() {
      if (
        (phase === "en_route" || phase === "nearby") &&
        batch!.status.toLowerCase() === "claimed" &&
        !updatedRef.current.has("in_transit")
      ) {
        updatedRef.current.add("in_transit");
        const { error } = await supabase
          .from("donation_batches")
          .update({ status: "In Transit" })
          .eq("id", batch!.id);
        if (!error) {
          setBatch((b) => (b ? { ...b, status: "In Transit" } : b));
          // Notify NGO that it's on the way
          if (batch!.claimed_by) {
            sendPushNotification({
              data: {
                userId: batch!.claimed_by,
                payload: {
                  title: "Courier En Route",
                  body: "The driver has picked up the donation and is heading your way.",
                  url: `/ngo/track/${batch!.id}`,
                },
              },
            }).catch(console.error);
          }
        }
      }

      if (phase === "delivered" && !updatedRef.current.has("delivered")) {
        updatedRef.current.add("delivered");
        const { error } = await supabase
          .from("donation_batches")
          .update({ status: "Delivered" })
          .eq("id", batch!.id);
        if (!error) {
          setBatch((b) => (b ? { ...b, status: "Delivered" } : b));

          // Notify NGO that the donation was delivered
          if (batch!.claimed_by) {
            sendPushNotification({
              data: {
                userId: batch!.claimed_by,
                payload: {
                  title: "Donation Delivered",
                  body: "The courier has arrived with your donation.",
                  url: `/ngo/track/${batch!.id}`,
                },
              },
            }).catch(console.error);
          }

          // Notify Donor
          if (batch!.donor_id) {
            sendPushNotification({
              data: {
                userId: batch!.donor_id,
                payload: {
                  title: "Donation Delivered",
                  body: "Your donation has successfully reached the NGO. Thank you!",
                  url: "/donor/dashboard",
                },
              },
            }).catch(console.error);
          }
        }
      }
    }
    maybeUpdate();
  }, [phase, batch?.id]);

  // ── 4. Map hook ────────────────────────────────────────────────────────────
  const effectiveProgress = batch?.status.toLowerCase() === "delivered" ? 1 : progress;

  const { routeReady, distanceText, durationText, geocodeError } = useDeliveryMap(
    mapRef as React.RefObject<HTMLDivElement | null>,
    batch?.pickup ?? "",
    ngoAddress,
    effectiveProgress,
    batch?.claimed_at ?? null,
    batch?.collection_datetime ?? null,
  );

  // Driver card data (deterministic from batch ID)
  const driver: SimulatedDriver | null = batch ? getSimulatedDriver(batch.id) : null;

  // 4) Render -------------------------------------------------------------------

  if (loading) {
    return (
      <>
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="h-5 w-40 rounded bg-muted animate-pulse" />
          <div className="mt-6 grid gap-6 md:grid-cols-[1fr_1.4fr]">
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 rounded-xl border bg-card animate-pulse" />
              ))}
            </div>
            <div className="h-96 rounded-xl border bg-card animate-pulse" />
          </div>
        </main>
      </>
    );
  }

  // ── Render: not found ──────────────────────────────────────────────────────
  if (notFound || !batch) {
    return (
      <>
        <main className="mx-auto max-w-3xl px-6 py-10 text-center">
          <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 text-sm font-medium">Donation not found</p>
          <Link to="/ngo/claims" className="mt-3 inline-block text-sm text-primary hover:underline">
            ← Back to Claims
          </Link>
        </main>
      </>
    );
  }

  // ── Render: main ───────────────────────────────────────────────────────────
  return (
    <>
      <main className="mx-auto max-w-5xl px-6 py-10">
        {/* Back link */}
        <Link
          to="/ngo/claims"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back to Claims
        </Link>

        {/* Page header */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Track Delivery</h1>
            <p className="mt-1 text-sm text-muted-foreground capitalize">
              {batch.batch_type} · Batch #{batch.id.toUpperCase().slice(0, 8)} · from{" "}
              <span className="font-medium text-foreground">{batch.donor}</span>
            </p>
          </div>
          <StatusBadge status={batch.status} />
        </div>

        {/* ETA banner */}
        {phase !== "delivered" ? (
          <div
            className={`mt-6 flex items-center gap-3 rounded-2xl px-5 py-4 shadow-sm transition-all ${
              phase === "preparing"
                ? "glass border-blue-200/50 text-blue-900"
                : phase === "nearby"
                  ? "glass border-orange-200/50 text-orange-900"
                  : "glass border-amber-200/50 text-amber-900"
            }`}
          >
            <Navigation
              className={`h-5 w-5 shrink-0 ${
                phase !== "preparing" ? "animate-pulse text-amber-600" : "text-blue-600"
              }`}
            />
            <span className="text-sm font-bold tracking-wide">
              {phase === "preparing"
                ? "Courier is preparing your delivery…"
                : phase === "nearby"
                  ? `Courier is nearby — arriving in ${etaMinutes} min`
                  : `En route to your organisation — arriving in ${etaMinutes} min`}
            </span>
            {distanceText && (
              <span className="ml-auto shrink-0 text-xs font-semibold opacity-70">
                {distanceText}
              </span>
            )}
          </div>
        ) : (
          <div className="mt-6 flex items-center gap-3 rounded-2xl glass border-emerald-200/50 px-5 py-4 text-emerald-900 shadow-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <span className="text-sm font-bold tracking-wide">Delivery complete — thank you!</span>
          </div>
        )}

        {/* Main 2-column grid */}
        <div className="mt-8 grid gap-8 md:grid-cols-[1fr_1.4fr]">
          {/* ── Left column: status rail + driver card ── */}
          <div className="space-y-6">
            <div className="rounded-3xl glass p-6 shadow-sm">
              <p className="mb-5 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Delivery Progress
              </p>
              <DeliveryRail phase={phase} />
            </div>

            {driver && <DriverCard driver={driver} />}
          </div>

          {/* ── Right column: live map + batch info ── */}
          <div className="space-y-6">
            {/* Map card */}
            <div className="overflow-hidden rounded-3xl glass shadow-sm">
              <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
                <p className="text-sm font-bold tracking-tight">Live Delivery Map</p>
                <span className="text-xs font-semibold text-muted-foreground">
                  {!routeReady && !geocodeError && (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading…
                    </span>
                  )}
                  {routeReady && distanceText && durationText && (
                    <>
                      {distanceText} · {durationText}
                    </>
                  )}
                </span>
              </div>

              {geocodeError ? (
                /* Graceful fallback when geocoding fails */
                <div className="flex h-[380px] flex-col items-center justify-center gap-4 px-8 text-center bg-white/20">
                  <AlertCircle className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-medium text-muted-foreground">{geocodeError}</p>
                  <div className="mt-2 space-y-2 text-xs font-medium text-muted-foreground">
                    {batch.pickup && batch.pickup !== "Location not specified" && (
                      <p className="flex items-center justify-center gap-1.5">
                        <MapPin className="h-4 w-4 text-emerald-600" />
                        Pickup: {batch.pickup}
                      </p>
                    )}
                    {ngoAddress && (
                      <p className="flex items-center justify-center gap-1.5">
                        <MapPin className="h-4 w-4 text-blue-600" />
                        Destination: {ngoAddress}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                /* The map div — Google Maps renders directly into this */
                <div ref={mapRef} style={{ height: "380px" }} className="w-full" />
              )}
            </div>

            {/* Batch info table */}
            <div className="rounded-3xl glass p-6 text-sm shadow-sm">
              <InfoRow label="Batch Type" value={batch.batch_type} />
              <InfoRow label="Donor" value={batch.donor} />
              <InfoRow
                label="Collect By"
                value={
                  batch.collection_datetime
                    ? new Date(batch.collection_datetime).toLocaleString("en-ZA", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Not specified"
                }
              />
              <InfoRow
                label="Pickup Address"
                value={batch.pickup}
                href={
                  batch.pickup && batch.pickup !== "Location not specified"
                    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(batch.pickup)}`
                    : undefined
                }
              />
              {ngoAddress && (
                <InfoRow
                  label="Your Address"
                  value={ngoAddress}
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ngoAddress)}`}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DeliveryRail({ phase }: { phase: DeliveryPhase }) {
  type S = "done" | "active" | "pending";

  const stages: { label: string; detail: string; state: S }[] = [
    {
      label: "Order Claimed",
      detail: "Donation successfully claimed",
      state: "done", // always done once we're on this page
    },
    {
      label: "Courier En Route",
      detail: "Heading to donor pickup location",
      state: phase === "preparing" ? "pending" : phase === "en_route" ? "active" : "done",
    },
    {
      label: "Courier Nearby",
      detail: "Approaching your organisation",
      state: phase === "delivered" ? "done" : phase === "nearby" ? "active" : "pending",
    },
    {
      label: "Delivered",
      detail: "Donation received",
      state: phase === "delivered" ? "done" : "pending",
    },
  ];

  return (
    <div>
      {stages.map((s, i) => (
        <RailStage key={s.label} {...s} isLast={i === stages.length - 1} />
      ))}
    </div>
  );
}

function RailStage({
  label,
  detail,
  state,
  isLast,
}: {
  label: string;
  detail: string;
  state: "done" | "active" | "pending";
  isLast: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {/* Icon column */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${
            state === "done"
              ? "bg-emerald-500 text-white"
              : state === "active"
                ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                : "border-2 border-muted bg-background text-muted-foreground"
          }`}
        >
          {state === "done" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : state === "active" ? (
            <Navigation className="h-3.5 w-3.5 animate-pulse" />
          ) : (
            <span className="block h-2 w-2 rounded-full bg-muted-foreground/30" />
          )}
        </div>
        {!isLast && (
          <div
            className={`my-0.5 w-0.5 ${state === "done" ? "h-9 bg-emerald-400" : "h-9 bg-muted"}`}
          />
        )}
      </div>

      {/* Text column */}
      <div className={isLast ? "pb-0" : "pb-1"}>
        <p
          className={`text-sm font-semibold leading-snug ${
            state === "active"
              ? "text-primary"
              : state === "done"
                ? "text-foreground"
                : "text-muted-foreground"
          }`}
        >
          {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

function DriverCard({ driver }: { driver: SimulatedDriver }) {
  return (
    <div className="rounded-3xl glass p-6 shadow-sm">
      <p className="mb-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        Your Driver
      </p>

      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary shadow-inner">
          {driver.initials}
        </div>
        <div>
          <p className="text-base font-bold tracking-tight">{driver.name}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Car className="h-4 w-4" />
            {driver.vehicle}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border/40 pt-4">
        <div className="flex items-center gap-1.5">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="text-sm font-bold">{driver.rating.toFixed(1)}</span>
          <span className="text-xs font-medium text-muted-foreground">rating</span>
        </div>
        <span className="rounded-lg bg-secondary/80 px-2.5 py-1 font-mono text-xs font-semibold tracking-wider text-foreground">
          {driver.plate}
        </span>
      </div>
    </div>
  );
}

function InfoRow({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-border/40 py-2.5 last:border-0">
      <span className="shrink-0 text-muted-foreground font-medium">{label}</span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="max-w-[60%] truncate text-right font-semibold text-primary hover:underline hover:text-primary/80"
        >
          {value}
        </a>
      ) : (
        <span className="max-w-[60%] truncate text-right font-semibold text-foreground capitalize">
          {value}
        </span>
      )}
    </div>
  );
}
