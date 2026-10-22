import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, Outlet, useLocation } from "@tanstack/react-router";
import { AppHeader, ngoNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { ngoSidebarNav } from "@/lib/nav";
import { supabase } from "@/lib/supabase";
import { StatusBadge } from "@/components/ui/status-badge";

import { useAuth, getFastCachedAuth } from "@/hooks/useAuth";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

import imgBeverages from "@/assets/images/beverages.jpeg";
import imgCannedGoods from "@/assets/images/canned-goods.jpeg";
import imgDairy from "@/assets/images/dairy.jpeg";
import imgMeat from "@/assets/images/meat.jpeg";
import imgMixed from "@/assets/images/mixed-donation.jpg";
import imgPreparedGoods from "@/assets/images/prepared-goods.jpeg";
import imgSnacks from "@/assets/images/snacks.jpeg";
import imgBakery from "@/assets/images/bakery.png";

function getImageForCategory(typeOrCategories: string | string[]) {
  const types = Array.isArray(typeOrCategories) ? typeOrCategories : [typeOrCategories];
  const combined = types.join(" ").toLowerCase();

  if (combined.includes("beverage") || combined.includes("drink")) return imgBeverages;
  if (combined.includes("can")) return imgCannedGoods;
  if (combined.includes("dairy") || combined.includes("milk") || combined.includes("cheese"))
    return imgDairy;
  if (combined.includes("meat") || combined.includes("poultry") || combined.includes("fish"))
    return imgMeat;
  if (combined.includes("prepared") || combined.includes("meal")) return imgPreparedGoods;
  if (combined.includes("snack") || combined.includes("chip") || combined.includes("candy"))
    return imgSnacks;
  if (combined.includes("bakery") || combined.includes("bread") || combined.includes("pastry"))
    return imgBakery;
  return imgMixed; // Fallback
}

export const Route = createFileRoute("/ngo/donations/$id")({
  head: () => ({ meta: [{ title: "Donation Details — SurplusLink" }] }),
  component: DonationDetail,
});

interface DonationDetailState {
  id: string;
  quantity: string;
  collection_datetime: string;
  donor: string;
  pickup: string;
  batch_type: string;
  status: string;
}

export async function getRealDrivingDistance(origin: string, destination: string): Promise<string> {
  const globalWin = window as any;
  if (!globalWin.google?.maps || !origin || !destination) {
    return "Distance unavailable";
  }

  // Primary calculation attempt via modern RouteMatrix API with safety timeout
  try {
    if (globalWin.google.maps.routes?.RouteMatrix) {
      const request = {
        origins: [origin],
        destinations: [destination],
        travelMode: "DRIVING",
        fields: ["distanceMeters", "condition"],
      };

      const modernCall = globalWin.google.maps.routes.RouteMatrix.computeRouteMatrix(request);
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("RouteMatrix stream timeout")), 3000),
      );

      const response: any = await Promise.race([modernCall, timeout]);
      const element =
        response?.matrix?.rows?.[0]?.items?.[0] ||
        response?.[0]?.elements?.[0] ||
        (Array.isArray(response) ? response[0] : null);

      if (element && (element.condition === "ROUTE_EXISTS" || !element.status)) {
        const meters = element.distanceMeters;
        if (typeof meters === "number" && !isNaN(meters)) {
          if (meters === 0) return "Same location";
          if (meters < 100) return "< 0.1 km away";
          const km = (meters / 1000).toFixed(1);
          return `${km} km away`;
        }
      }
    }
  } catch (e) {
    console.warn(
      "Modern Route Matrix execution timed out or failed. Attempting fallback to DistanceMatrixService...",
      e,
    );
  }

  // Fallback to legacy DistanceMatrixService
  return new Promise((resolve) => {
    try {
      const service = new globalWin.google.maps.DistanceMatrixService();
      service.getDistanceMatrix(
        {
          origins: [origin],
          destinations: [destination],
          travelMode: globalWin.google.maps.TravelMode.DRIVING,
        },
        (response: any, status: string) => {
          if (status === "OK" && response?.rows?.[0]?.elements?.[0]?.status === "OK") {
            const element = response.rows[0].elements[0];
            resolve(element.distance.text);
          } else {
            resolve("Distance unknown");
          }
        },
      );
    } catch (fallbackErr) {
      console.error("Distance Matrix fallback failed:", fallbackErr);
      resolve("Distance unavailable");
    }
  });
}

function DonationDetail() {
  const { id } = Route.useParams();
  const { initials } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMapsReady = useGoogleMaps();

  const [batch, setBatch] = useState<DonationDetailState | null>(null);
  const [ngoAddress, setNgoAddress] = useState<string>("");
  const [ngoName, setNgoName] = useState<string>("NGO");
  const [loading, setLoading] = useState<boolean>(true);
  const [distance, setDistance] = useState<string>("Calculating distance...");
  const [itemCategories, setItemCategories] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    async function fetchBatchDetailAndProfile() {
      let authenticatedUserId: string | null = null;

      try {
        setLoading(true);

        // 1. Retrieve session directly from local memory/storage with timeout protection
        const cachedAuth = getFastCachedAuth();
        let currentUser = cachedAuth.user;

        if (!currentUser) {
          const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
            setTimeout(() => resolve({ data: { session: null } }), 1000),
          );
          const {
            data: { session },
          } = await Promise.race([supabase.auth.getSession(), timeoutPromise]);
          currentUser = session?.user ?? null;
        }
        authenticatedUserId = currentUser?.id ?? null;

        // 2. Fetch NGO profile and batch details concurrently
        const [ngoProfileRes, batchRes] = await Promise.all([
          currentUser
            ? supabase
                .from("ngos")
                .select("organization_name, address")
                .eq("id", currentUser.id)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
          supabase
            .from("donation_batches")
            .select(
              `
              id,
              batch_type,
              collection_datetime,
              status,
              donors!donor_id (
                organization_name,
                address
              ),
              donation_items (
                quantity,
                unit,
                category,
                expiry
              )
            `,
            )
            .eq("id", id)
            .single(),
        ]);

        if (ngoProfileRes.data && isMounted) {
          setNgoAddress(ngoProfileRes.data.address || "");
          setNgoName(ngoProfileRes.data.organization_name || "Hope Shelter");
        }

        if (batchRes.error) throw batchRes.error;

        if (batchRes.data && isMounted) {
          const rawBatch = batchRes.data as any;

          // REAL-TIME EXPIRY & SECOND CHANCE SYNC WITH DATABASE
          if (
            rawBatch.collection_datetime &&
            !["claimed", "delivered", "collected", "in transit"].includes(
              rawBatch.status?.toLowerCase(),
            )
          ) {
            const expiryTime = new Date(rawBatch.collection_datetime).getTime();
            const now = Date.now();

            if (now > expiryTime) {
              const items = rawBatch.donation_items ?? [];
              const expiries = items
                .map((it: any) => (it.expiry ? new Date(it.expiry).getTime() : NaN))
                .filter((t: number) => !isNaN(t));
              const earliestExpiry = expiries.length > 0 ? Math.min(...expiries) : null;
              const isStillFresh = earliestExpiry !== null && earliestExpiry > now;
              const newStatus = isStillFresh ? "Second Chance" : "Unclaimed";

              if (rawBatch.status !== newStatus) {
                rawBatch.status = newStatus;
                (async () => {
                  try {
                    await supabase
                      .from("donation_batches")
                      .update({ status: newStatus })
                      .eq("id", id);
                  } catch (writeErr) {
                    console.warn("Could not sync donation status to remote database:", writeErr);
                  }
                })();
              }
            }
          }

          const donorInfo = Array.isArray(rawBatch.donors) ? rawBatch.donors[0] : rawBatch.donors;

          const itemQuantities = (rawBatch.donation_items ?? [])
            .map((item: any) => {
              if (item.quantity === null || item.quantity === undefined) return null;
              const quantity = String(item.quantity).trim();
              const unit = item.unit ? String(item.unit).trim() : "items";

              if (!quantity) return null;

              return unit ? `${quantity} ${unit}` : quantity;
            })
            .filter(Boolean) as string[];

          const formattedQuantityText =
            itemQuantities.length > 0 ? itemQuantities.join(" • ") : "1 Batch";

          setBatch({
            id: rawBatch.id,
            quantity: formattedQuantityText,
            collection_datetime: rawBatch.collection_datetime
              ? new Date(rawBatch.collection_datetime).toLocaleString()
              : "N/A",
            donor: donorInfo?.organization_name || "Anonymous Donor",
            pickup: donorInfo?.address || "Location not specified",
            batch_type: rawBatch.batch_type || "Surplus Food",
            status: rawBatch.status || "Unclaimed",
          });


          const extracted: string[] = (rawBatch.donation_items ?? []).flatMap(
            (item: { category?: string | null }) =>
              item.category ? item.category.split(", ").map((c: string) => c.trim()) : [],
          );
          setItemCategories(
            Array.from(new Set(extracted)).filter((category): category is string =>
              Boolean(category),
            ),
          );
        }
      } catch (err) {
        if (isMounted) {
          console.error("Error fetching donation details:", err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchBatchDetailAndProfile();

    return () => {
      isMounted = false;
    };
  }, [id]);


  useEffect(() => {
    const pickupLocation = batch?.pickup;
    if (
      !isMapsReady ||
      !pickupLocation ||
      !ngoAddress ||
      pickupLocation === "Location not specified"
    ) {
      if (pickupLocation === "Location not specified") setDistance("Distance unknown");
      return;
    }

    async function computeDistance() {
      const realDistance = await getRealDrivingDistance(ngoAddress || "", pickupLocation || "");
      setDistance(realDistance);
    }

    computeDistance();
  }, [isMapsReady, batch?.pickup, ngoAddress]);

  const isChildRoute = location.pathname !== `/ngo/donations/${id}`;

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10 text-sm text-muted-foreground">
        Loading donation details...
      </main>
    );
  }

  if (!batch) {
    return (
      <main className="mx-auto max-w-4xl px-6 py-10 text-center text-muted-foreground">
        Donation batch not found.
        <div className="mt-4">
          <Link to="/ngo/explore" className="text-primary hover:underline">
            ← Back to Explore
          </Link>
        </div>
      </main>
    );
  }

  const isClaimable =
    batch.status.toLowerCase() === "unclaimed" || batch.status.toLowerCase() === "second chance";
  const canClaim = isClaimable;

  return (
    <>
      {!isChildRoute && (
        <main className="mx-auto max-w-4xl px-6 py-10 w-full flex-1">
          <Link
            to="/ngo/explore"
            className="inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground mb-6"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mr-2"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back to Available Donations
          </Link>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="aspect-square rounded-3xl glass p-3 shadow-xl shadow-primary/5 overflow-hidden">
              <img
                src={getImageForCategory([batch?.batch_type || "", ...itemCategories])}
                alt={batch?.batch_type || "Donation"}
                className="h-full w-full object-cover rounded-2xl"
              />
            </div>

            <div className="flex flex-col">
              <div className="flex items-start justify-between gap-4 mb-6">
                <h1 className="text-3xl font-bold tracking-tight capitalize leading-tight">
                  {batch?.batch_type}
                </h1>
                <div className="mt-1">
                  <StatusBadge status={batch.status} />
                </div>
              </div>

              <div className="rounded-2xl glass p-6 shadow-sm flex-1">
                <dl className="space-y-4 text-sm">
                  <Row label="Quantity" value={batch?.quantity} />
                  <Row label="Expiry Time" value={batch?.collection_datetime || "N/A"} />
                  <Row label="Donor" value={batch?.donor || "Anonymous Donor"} />
                  <Row label="Distance" value={distance} />
                  <Row
                    label="Location"
                    value={batch?.pickup || "Location not specified"}
                    highlight
                    href={
                      batch?.pickup && batch.pickup !== "Location not specified"
                        ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(batch.pickup)}`
                        : undefined
                    }
                  />
                </dl>
              </div>
            </div>
          </div>

          <section className="mt-8 rounded-3xl glass p-8 shadow-md">
            <h2 className="text-lg font-bold tracking-tight">About This Donation</h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              This donation includes{" "}
              {itemCategories.length > 0 ? itemCategories.join(", ") : batch?.batch_type}. Quality
              checked and ready for distribution.
            </p>
            {itemCategories.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {itemCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </section>

          <button
            type="button"
            disabled={!canClaim}
            onClick={() => {
              navigate({ to: `/ngo/donations/${id}/claim` });
            }}
            className={`mt-8 w-full rounded-2xl py-4 text-sm font-bold uppercase tracking-widest transition-all shadow-lg hover:shadow-xl ${
              !canClaim
                ? "bg-muted text-muted-foreground cursor-not-allowed shadow-none hover:shadow-none"
                : "bg-primary text-primary-foreground hover:bg-primary/90 hover:-translate-y-0.5 active:translate-y-0"
            }`}
          >
            {isClaimable ? "Claim Donation" : `Donation ${batch.status}`}
          </button>
        </main>
      )}
      <Outlet />
    </>
  );
}

function Row({
  label,
  value,
  highlight,
  href,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  href?: string;
}) {
  return (
    <div className="flex justify-between border-b border-border/40 py-2.5 gap-4">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd
        className={
          highlight
            ? "rounded-lg border border-primary/20 bg-primary/5 px-3 py-1 font-semibold text-primary truncate max-w-[70%]"
            : "font-medium text-foreground text-right truncate max-w-[70%]"
        }
      >
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline hover:text-primary/80 block truncate text-left"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
