import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader, donorNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { donorSidebarNav } from "@/lib/nav";
import { useEffect, useState } from "react";
import { MapPin, ChevronRight, X, HeartHandshake, Loader2 } from "lucide-react";
import CommunityMap from "@/components/CommunityMap";
import { supabase } from "@/lib/supabase";
import { useGoogleMaps, getBatchDrivingDistances, parseDistance } from "@/lib/distance";

import { useAuth, getFastCachedAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/donor/network")({
  head: () => ({
    meta: [{ title: "Community Network — Developing digital projects" }],
  }),
  component: DonorNetwork,
});

// ---- Types matching live data ------------------------------------------

type NetworkRow = {
  donor_id: string;
  donor_name: string;
  ngo_id: string;
  ngo_name: string;
  ngo_latitude: number | null;
  ngo_longitude: number | null;
  ngo_address: string | null;
};

type ItemAgg = {
  category: string;
  totalQuantity: number;
  unit: string | null;
  itemCount: number;
};

type NGO = {
  id: string;
  name: string;
  address: string | null;
  needs: string[]; // top categories claimed by this NGO from this donor
  impactStory: string;
  impactMetric: string;
};

// ---- Helpers -------------------------------------------------------------

function buildNeedsAndImpact(items: ItemAgg[]): {
  needs: string[];
  impactStory: string;
  impactMetric: string;
} {
  if (items.length === 0) {
    return {
      needs: [],
      impactStory: "No completed donations from you have reached this partner yet.",
      impactMetric: "0 items delivered",
    };
  }

  const sorted = [...items].sort((a, b) => b.totalQuantity - a.totalQuantity);
  const needs = sorted.slice(0, 3).map((i) => i.category);

  const totalItemCount = items.reduce((sum, i) => sum + i.itemCount, 0);
  const topCategory = sorted[0];

  const impactStory =
    `Your donations of ${needs.join(", ").toLowerCase()} have been claimed by this partner, ` +
    `with ${topCategory.category.toLowerCase()} making up the largest share ` +
    `(${topCategory.totalQuantity}${topCategory.unit ? " " + topCategory.unit : ""}).`;

  const impactMetric = `${totalItemCount} item${totalItemCount === 1 ? "" : "s"} delivered`;

  return { needs, impactStory, impactMetric };
}

// ---- Component -------------------------------------------------------------

function DonorNetwork() {
  const isMapsReady = useGoogleMaps();
  const { initials } = useAuth();

  const [selectedNgo, setSelectedNgo] = useState<NGO | null>(null);
  const [ngos, setNgos] = useState<NGO[]>([]);
  const [distancesMap, setDistancesMap] = useState<Record<string, string>>({});
  const [donorAddress, setDonorAddress] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loggedInDonorId, setLoggedInDonorId] = useState<string | null>(null);

  // Fetch partner directory + donor address + delivered items concurrently
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

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

        const userId = user?.id;

        if (!userId) {
          if (!cancelled) {
            setError("You need to be logged in to view this page.");
            setLoading(false);
          }
          return;
        }

        if (!cancelled) setLoggedInDonorId(userId);

        // Fetch networkRows, donor address, and delivered batches concurrently
        const [networkRes, donorRes, batchesRes] = await Promise.all([
          supabase.from("donor_community_network").select("*").eq("donor_id", userId),
          supabase.from("donors").select("address").eq("id", userId).maybeSingle(),
          supabase
            .from("donation_batches")
            .select("claimed_by, donation_items(category, quantity, unit)")
            .eq("donor_id", userId)
            .in("status", ["Delivered", "Collected"]),
        ]);

        if (networkRes.error) throw networkRes.error;
        if (donorRes.error) throw donorRes.error;
        if (batchesRes.error) throw batchesRes.error;

        const networkRows = networkRes.data;
        const donorRow = donorRes.data;
        const batches = batchesRes.data;

        // Aggregate items per ngo_id -> per category
        const aggByNgo = new Map<string, Map<string, ItemAgg>>();
        for (const batch of batches ?? []) {
          const ngoId = batch.claimed_by as string;
          const items = (batch as any).donation_items as
            { category: string; quantity: number; unit: string | null }[] | null;
          if (!items) continue;

          if (!aggByNgo.has(ngoId)) aggByNgo.set(ngoId, new Map());
          const catMap = aggByNgo.get(ngoId)!;

          for (const item of items) {
            const key = item.category ?? "Uncategorized";
            const existing = catMap.get(key);
            if (existing) {
              existing.totalQuantity += Number(item.quantity) || 0;
              existing.itemCount += 1;
            } else {
              catMap.set(key, {
                category: key,
                totalQuantity: Number(item.quantity) || 0,
                unit: item.unit ?? null,
                itemCount: 1,
              });
            }
          }
        }

        const built: NGO[] = (networkRows as NetworkRow[]).map((row) => {
          const catMap = aggByNgo.get(row.ngo_id);
          const itemAggs = catMap ? Array.from(catMap.values()) : [];
          const { needs, impactStory, impactMetric } = buildNeedsAndImpact(itemAggs);

          return {
            id: row.ngo_id,
            name: row.ngo_name,
            address: row.ngo_address,
            needs,
            impactStory,
            impactMetric,
          };
        });

        if (!cancelled) {
          setNgos(built);
          setDonorAddress(donorRow?.address || "");
        }
      } catch (e: any) {
        console.error("[DonorNetwork] Failed to load live network data:", e);
        if (!cancelled) setError(e?.message ?? "Failed to load community network.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [loggedInDonorId]);

  // Once maps are ready and we have NGOs + a donor address, compute driving
  // distances in a single batched call — same pattern as ngo/explore.tsx.
  useEffect(() => {
    if (!isMapsReady || ngos.length === 0 || !donorAddress) return;
    let cancelled = false;

    async function appendDistances() {
      const destinations = ngos.map((n) => n.address || "");
      const calculated = await getBatchDrivingDistances(donorAddress, destinations);

      const next: Record<string, string> = {};
      ngos.forEach((ngo, i) => {
        next[ngo.id] = destinations[i] ? calculated[i] : "Distance unavailable";
      });

      if (!cancelled) setDistancesMap(next);
    }

    appendDistances();
    return () => {
      cancelled = true;
    };
  }, [isMapsReady, ngos, donorAddress]);

  const sortedNgos = [...ngos].sort(
    (a, b) => parseDistance(distancesMap[a.id]) - parseDistance(distancesMap[b.id]),
  );

  return (
    <>
      <main className="mx-auto flex-1 w-full max-w-7xl px-6 py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Community Network</h1>
          <p className="mt-2 text-muted-foreground">
            See exactly where your surplus goes and the lives it touches in real-time.
          </p>
        </div>

        <div className="flex h-[600px] flex-col overflow-hidden rounded-xl border bg-card shadow-sm lg:flex-row">
          {/* LIVE MAP INTERFACE */}
          <div className="relative flex-1 bg-muted/30 overflow-hidden flex items-center justify-center p-2">
            <div className="w-full h-full overflow-hidden rounded-lg bg-white">
              {loggedInDonorId ? (
                <CommunityMap loggedInDonorId={loggedInDonorId} donorAddress={donorAddress} />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  {error ?? "Loading…"}
                </div>
              )}
            </div>
          </div>

          {/* Directory / Detail Panel Container */}
          <div className="relative w-full border-l bg-card lg:w-[400px] overflow-hidden">
            {/* NGO Directory List */}
            <div
              className={`absolute inset-0 flex flex-col transition-transform duration-300 ease-in-out ${
                selectedNgo ? "-translate-x-full opacity-0" : "translate-x-0 opacity-100"
              }`}
            >
              <div className="border-b p-5 bg-muted/20">
                <h2 className="font-semibold">Local Partner Directory</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Select a partner to view impact details.
                </p>
              </div>

              <div className="flex-1 overflow-y-auto divide-y">
                {loading && (
                  <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading partners…
                  </div>
                )}

                {!loading && error && <div className="p-5 text-sm text-destructive">{error}</div>}

                {!loading && !error && ngos.length === 0 && (
                  <div className="p-5 text-sm text-muted-foreground">
                    No partners linked to your donations yet.
                  </div>
                )}

                {!loading &&
                  !error &&
                  sortedNgos.map((ngo) => (
                    <button
                      key={ngo.id}
                      onClick={() => setSelectedNgo(ngo)}
                      className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-muted/50 group"
                    >
                      <div>
                        <div className="font-medium group-hover:text-primary transition-colors">
                          {ngo.name}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground flex items-center">
                          <MapPin className="h-3 w-3 mr-1" />
                          {distancesMap[ngo.id] || "Calculating…"}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                  ))}
              </div>
            </div>

            {/* Detail Panel */}
            <div
              className={`absolute inset-0 flex flex-col bg-card transition-transform duration-300 ease-in-out shadow-[-10px_0_15px_-3px_rgba(0,0,0,0.05)] ${
                selectedNgo ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"
              }`}
            >
              {selectedNgo && (
                <>
                  <div className="border-b p-4 flex items-center justify-between sticky top-0 bg-card/95 backdrop-blur z-10">
                    <button
                      onClick={() => setSelectedNgo(null)}
                      className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 mr-1 rotate-180" />
                      Back to list
                    </button>
                    <button
                      onClick={() => setSelectedNgo(null)}
                      className="rounded-full p-1.5 hover:bg-muted text-muted-foreground transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold tracking-tight">{selectedNgo.name}</h2>
                      <p className="text-sm text-muted-foreground flex items-center mt-2">
                        <MapPin className="h-3.5 w-3.5 mr-1" />
                        {distancesMap[selectedNgo.id] ||
                          selectedNgo.address ||
                          "Address unavailable"}
                      </p>
                    </div>

                    <div className="mb-8 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40 p-5 border border-emerald-100/50 dark:border-emerald-900/50 shadow-sm relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-10">
                        <HeartHandshake className="h-24 w-24 text-emerald-600" />
                      </div>
                      <div className="relative z-10">
                        <div className="flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-400 mb-3">
                          <HeartHandshake className="h-5 w-5" />
                          Impact Story
                        </div>
                        <p className="text-sm text-emerald-800/90 dark:text-emerald-300/90 italic leading-relaxed">
                          "{selectedNgo.impactStory}"
                        </p>
                        <div className="mt-4 inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 px-3 py-1 text-xs font-bold text-emerald-800 dark:text-emerald-300 shadow-sm">
                          {selectedNgo.impactMetric}
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold mb-3">Primary Needs</h3>
                      <div className="flex flex-wrap gap-2">
                        {selectedNgo.needs.length === 0 && (
                          <span className="text-xs text-muted-foreground">
                            No claimed categories yet.
                          </span>
                        )}
                        {selectedNgo.needs.map((need) => (
                          <span
                            key={need}
                            className="inline-flex items-center rounded-md bg-secondary px-3 py-1.5 text-xs font-medium text-secondary-foreground border"
                          >
                            {need}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 border-t bg-muted/10">
                    <Link
                      to="/donor/funds"
                      className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow"
                    >
                      Direct Donation
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
