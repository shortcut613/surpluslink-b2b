import { useEffect, useState, useMemo, useRef } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, Filter, ArrowUpDown, Clock, MapPin, Package, Heart } from "lucide-react";

import { ngoSidebarNav } from "@/lib/nav";
import { StatusBadge } from "@/components/ui/status-badge";

import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";

export const getAvailableDonations = createServerFn({ method: "GET" }).handler(async () => {
  const supabaseServer = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabaseServer.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const [ngoProfileRes, batchesRes] = await Promise.all([
    supabaseServer
      .from("ngos")
      .select("id, organization_name, address")
      .eq("id", user.id)
      .maybeSingle(),
    supabaseServer
      .from("donation_batches")
      .select(
        `
        id,
        donor_id,
        batch_type,
        collection_datetime,
        status,
        claimed_by,
        donors!donor_id (
          organization_name,
          address
        ),
        donation_items (
          quantity,
          unit,
          expiry
        )
      `,
      )
      .or("status.ilike.unclaimed,status.ilike.pending,status.ilike.second chance")
      .limit(50),
  ]);

  const ngoProfile = ngoProfileRes.data;
  const data = batchesRes.data;

  if (batchesRes.error) throw batchesRes.error;

  const now = Date.now();
  for (const batch of data || []) {
    const statusLower = (batch.status || "").toLowerCase();
    if (
      batch.collection_datetime &&
      !["claimed", "delivered", "collected", "in transit"].includes(statusLower)
    ) {
      const collectionTime = new Date(batch.collection_datetime).getTime();
      if (now > collectionTime) {
        const items = batch.donation_items ?? [];
        const expiries = items
          .map((it: any) => (it.expiry ? new Date(it.expiry).getTime() : NaN))
          .filter((t: number) => !isNaN(t));
        const earliestExpiry = expiries.length > 0 ? Math.min(...expiries) : null;
        const isStillFresh = earliestExpiry !== null && earliestExpiry > now;
        const targetStatus = isStillFresh ? "Second Chance" : "Unclaimed";

        if (batch.status !== targetStatus) {
          batch.status = targetStatus;
          supabaseServer
            .from("donation_batches")
            .update({ status: targetStatus })
            .eq("id", batch.id)
            .then(({ error }: any) => {
              if (error) console.warn("Could not sync batch status in DB:", error.message);
            });
        }
      }
    }
  }

  const formattedData: DonationUI[] = (data || []).map((batch: any) => {
    const donorInfo = Array.isArray(batch.donors) ? batch.donors[0] : batch.donors;
    const donorAddress = donorInfo?.address || "";
    const donorName = donorInfo?.organization_name || "Anonymous Donor";

    const itemQuantities = (batch.donation_items ?? [])
      .map((item: any) => {
        if (item.quantity === null || item.quantity === undefined) return null;
        const quantity = String(item.quantity).trim();
        const unit = item.unit ? String(item.unit).trim() : "items";
        if (!quantity) return null;
        return unit ? `${quantity} ${unit}` : quantity;
      })
      .filter(Boolean) as string[];

    const quantityText = itemQuantities.length > 0 ? itemQuantities.join(" • ") : "1 Batch";

    return {
      id: batch.id,
      title: batch.batch_type || "General Batch",
      quantity: quantityText,
      pickup: donorAddress || "Location not specified",
      donor: donorName,
      distance: "Calculating...",
      status: batch.status || "Unclaimed",
      created_at: batch.created_at,
      collection_datetime: batch.collection_datetime,
    };
  });

  return {
    ngoAddress: ngoProfile?.address || "",
    ngoName: ngoProfile?.organization_name || "Hope Shelter",
    donations: formattedData,
  };
});

export const exploreQueryOptions = queryOptions({
  queryKey: ["donations", "available"],
  queryFn: () => getAvailableDonations(),
  staleTime: 1000 * 60 * 5,
});

export const Route = createFileRoute("/ngo/explore")({
  loader: ({ context }) => context.queryClient.ensureQueryData(exploreQueryOptions),
  head: () => ({ meta: [{ title: "Explore Donations — SurplusLink" }] }),
  component: ExplorePage,
});

interface DonationUI {
  id: string;
  title: string;
  quantity: string;
  pickup: string;
  donor: string;
  distance: string;
  status: string;
  created_at?: string;
  collection_datetime: string | null;
}

// useGoogleMaps is now imported from @/hooks/useGoogleMaps

export async function getBatchDrivingDistances(
  origin: string,
  destinations: string[],
): Promise<string[]> {
  const globalWin = window as any;
  if (!globalWin.google?.maps?.routes || !origin || destinations.length === 0) {
    return destinations.map(() => "Distance unavailable");
  }

  const validDestinations = destinations.map((d) => (d.trim() === "" ? "Unknown Location" : d));

  try {
    const request = {
      origins: [origin],
      destinations: validDestinations,
      travelMode: "DRIVING",
      fields: ["distanceMeters", "condition"],
    };

    const response = await globalWin.google.maps.routes.RouteMatrix.computeRouteMatrix(request);

    let matrixItems: any[] = [];
    if (Array.isArray(response)) {
      matrixItems = response;
    } else if (Array.isArray(response?.matrix?.rows?.[0]?.items)) {
      matrixItems = response.matrix.rows[0].items;
    } else if (Array.isArray(response?.[0]?.elements)) {
      matrixItems = response[0].elements;
    }

    if (matrixItems.length > 0) {
      return matrixItems.map((element: any) => {
        if (element && (element.condition === "ROUTE_EXISTS" || !element.status)) {
          const meters = element.distanceMeters;
          if (typeof meters === "number" && !isNaN(meters)) {
            if (meters === 0) return "Same location";
            if (meters < 100) return "< 0.1 km away";
            const km = (meters / 1000).toFixed(1);
            return `${km} km away`;
          }
        }
        return "Distance unknown";
      });
    }

    console.error(
      "Route Matrix execution did not produce an array structure inside output container:",
      response,
    );
    return destinations.map(() => "Distance error");
  } catch (e) {
    console.error("Failed executing modern route matrix operation:", e);
    return destinations.map(() => "Distance error");
  }
}

function ExplorePage() {
  const { initials } = useAuth();
  const isMapsReady = useGoogleMaps("routes");

  const { data: queryData } = useSuspenseQuery(exploreQueryOptions);

  const [rawDonations, setRawDonations] = useState<DonationUI[]>(queryData.donations);
  const [ngoAddress] = useState<string>(queryData.ngoAddress);
  const [ngoName] = useState<string>(queryData.ngoName);

  const [distancesMap, setDistancesMap] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showSort, setShowSort] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [showUnclaimed, setShowUnclaimed] = useState(false);

  // Click-outside refs for the sort/filter dropdowns
  const sortRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) setShowFilters(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Keep raw donations in sync if queryData changes (e.g. after manual invalidation)
  useEffect(() => {
    setRawDonations(queryData.donations);
  }, [queryData.donations]);

  useEffect(() => {
    if (!isMapsReady || rawDonations.length === 0 || !ngoAddress) return;

    async function appendDistances() {
      const destinationsList = rawDonations.map((d) =>
        d.pickup !== "Location not specified" ? d.pickup : "",
      );

      const calculatedDistances = await getBatchDrivingDistances(ngoAddress, destinationsList);

      const newDistancesMap: Record<string, string> = {};
      rawDonations.forEach((donation, index) => {
        newDistancesMap[donation.id] = destinationsList[index]
          ? calculatedDistances[index]
          : "Distance unknown";
      });

      setDistancesMap(newDistancesMap);
    }

    appendDistances();
  }, [isMapsReady, rawDonations, ngoAddress]);

  function parseDistance(dist: string) {
    if (!dist || dist.includes("error") || dist.includes("unknown") || dist.includes("Calculating"))
      return Infinity;
    const match = dist.match(/([\d.]+)/);
    return match ? parseFloat(match[1]) : Infinity;
  }

  const now = new Date();

  const filteredDonations = rawDonations.filter((donation) => {
    const matchesCategory = selectedCategory
      ? donation.title.toLowerCase().includes(selectedCategory.toLowerCase())
      : true;

    const cleanQuery = searchQuery.toLowerCase().trim();
    const matchesSearch =
      cleanQuery === "" ||
      donation.title.toLowerCase().includes(cleanQuery) ||
      donation.donor.toLowerCase().includes(cleanQuery) ||
      donation.pickup.toLowerCase().includes(cleanQuery);

    // A batch is "unclaimed" if its collection deadline has passed and it is not Second Chance
    const isSecondChance = donation.status === "Second Chance";
    const isUnclaimed =
      !isSecondChance && donation.collection_datetime
        ? new Date(donation.collection_datetime) < now
        : false;

    const matchesExpiry = showUnclaimed ? true : !isUnclaimed;

    return matchesCategory && matchesSearch && matchesExpiry;
  });

  const sortedDonations = [...filteredDonations].sort((a, b) => {
    // Sort Second Chance rescue batches first for highest visibility
    const aSecond = a.status === "Second Chance" ? 1 : 0;
    const bSecond = b.status === "Second Chance" ? 1 : 0;
    if (aSecond !== bSecond) {
      return bSecond - aSecond;
    }

    if (!sortBy || sortBy === "Nearest") {
      const distA = parseDistance(distancesMap[a.id] || "");
      const distB = parseDistance(distancesMap[b.id] || "");
      return distA - distB;
    }

    if (sortBy === "Deadline (Soonest)") {
      const dateA = a.collection_datetime ? new Date(a.collection_datetime).getTime() : Infinity;
      const dateB = b.collection_datetime ? new Date(b.collection_datetime).getTime() : Infinity;
      return dateA - dateB;
    }

    if (sortBy === "Recently Added") {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    }

    return 0;
  });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 w-full flex-1">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Explore Donations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Discover surplus food from verified donors near you.
          </p>
        </div>
      </div>

      <div className="relative mt-8 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search donations by title, donor or pickup location..."
            className="w-full rounded-xl border bg-white/50 px-10 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative" ref={sortRef}>
            <button
              type="button"
              onClick={() => {
                setShowSort(!showSort);
                setShowFilters(false);
              }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all shadow-sm ${showSort || sortBy ? "bg-primary/5 border-primary/20 text-primary" : "bg-white/50 hover:bg-white"}`}
            >
              <ArrowUpDown className="h-4 w-4" />
              Sort {sortBy ? `(${sortBy})` : ""}
            </button>
            {showSort && (
              <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-xl border glass p-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="mb-1 block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Sort By
                </label>
                <div className="flex flex-col gap-0.5">
                  {["Nearest", "Deadline (Soonest)", "Recently Added"].map((sortOption) => (
                    <button
                      key={sortOption}
                      type="button"
                      onClick={() => setSortBy(sortBy === sortOption ? null : sortOption)}
                      className={`w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors ${sortBy === sortOption ? "bg-primary text-primary-foreground" : "hover:bg-black/5 text-foreground"}`}
                    >
                      {sortOption}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => {
                setShowFilters(!showFilters);
                setShowSort(false);
              }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all shadow-sm ${showFilters || selectedCategory || showUnclaimed ? "bg-primary/5 border-primary/20 text-primary" : "bg-white/50 hover:bg-white"}`}
            >
              <Filter className="h-4 w-4" />
              Filters {selectedCategory || showUnclaimed ? "(Active)" : ""}
            </button>
            {showFilters && (
              <div className="absolute right-0 top-full z-10 mt-2 w-56 rounded-xl border glass p-2 shadow-xl animate-in fade-in slide-in-from-top-2 duration-200">
                <label className="mb-1 block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Category
                </label>
                <div className="flex flex-col gap-0.5">
                  {["Produce", "Bakery", "Dairy", "Meat", "Prepared", "Beverages", "Snacks"].map(
                    (catOption) => (
                      <button
                        key={catOption}
                        type="button"
                        onClick={() =>
                          setSelectedCategory(selectedCategory === catOption ? null : catOption)
                        }
                        className={`w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors ${selectedCategory === catOption ? "bg-primary text-primary-foreground" : "hover:bg-black/5 text-foreground"}`}
                      >
                        {catOption}
                      </button>
                    ),
                  )}
                </div>
                <div className="mt-2 border-t pt-2">
                  <label className="mb-1 block px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Availability
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowUnclaimed((v) => !v)}
                    className={`w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium transition-colors ${showUnclaimed ? "bg-primary text-primary-foreground" : "hover:bg-black/5 text-foreground"}`}
                  >
                    {showUnclaimed ? "✓ " : ""}Show unclaimed listings
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-bold tracking-tight">
          {showUnclaimed ? "All Donations" : "Active Donations"}
          <span className="ml-2 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
            {sortedDonations.length}
          </span>
        </h2>
      </div>

      <div className="mt-6">
        {sortedDonations.length === 0 ? (
          <div className="rounded-2xl border border-dashed glass py-16 text-center shadow-sm">
            <Package className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              No donations found
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {searchQuery || selectedCategory
                ? "Try adjusting your search or filters."
                : showUnclaimed
                  ? "There are no past donations recorded."
                  : 'No active donations right now. Check back later or enable "Show unclaimed".'}
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
            {sortedDonations.map((d) => (
              <Link
                key={d.id}
                to="/ngo/donations/$id"
                params={{ id: d.id }}
                className={`group relative flex flex-col rounded-2xl glass p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 ${
                  d.status === "Second Chance" ? "border-amber-400/50 ring-1 ring-amber-400/30" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h3 className="font-bold text-lg leading-tight capitalize text-foreground group-hover:text-primary transition-colors line-clamp-1">
                    {d.title}
                  </h3>
                  {(() => {
                    if (d.status === "Second Chance") {
                      return (
                        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold bg-amber-500/15 text-amber-700 border border-amber-300 dark:text-amber-400 dark:border-amber-700 animate-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Second Chance Rescue
                        </span>
                      );
                    }
                    const isUnclaimed = d.collection_datetime
                      ? new Date(d.collection_datetime) < now
                      : false;
                    return isUnclaimed ? (
                      <span className="shrink-0 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold bg-neutral-100 text-neutral-500">
                        Unclaimed
                      </span>
                    ) : (
                      <StatusBadge status={d.status} />
                    );
                  })()}
                </div>

                <div className="flex-1 space-y-2.5 text-sm text-muted-foreground mt-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4 shrink-0 text-primary/60" />
                      Quantity
                    </span>
                    <span className="font-medium text-foreground text-right">{d.quantity}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0 text-primary/60" />
                      Pickup at
                    </span>
                    <span className="truncate max-w-[50%] text-right font-medium text-foreground">
                      {d.pickup}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2.5 border-t border-border/40 pt-4 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Heart className="h-4 w-4 shrink-0 text-primary/60" />
                      Donor
                    </span>
                    <span className="truncate max-w-[50%] font-medium text-foreground text-right">
                      {d.donor}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Distance</span>
                    <div className="shrink-0 rounded-md bg-secondary px-2.5 py-1 text-xs font-semibold text-foreground">
                      {distancesMap[d.id] || "Calculating..."}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
