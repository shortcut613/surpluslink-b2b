import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  Package,
  ArrowRight,
  CheckCircle2,
  Clock,
  Truck,
  MapPin,
  Eye,
  Navigation,
  Search,
  X,
  Boxes,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getFastCachedAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/ngo/claims")({
  head: () => ({ meta: [{ title: "My Claimed Donations — SurplusLink" }] }),
  component: MyClaims,
});

interface ClaimedBatch {
  id: string;
  batch_type: string;
  status: string;
  collection_datetime: string | null;
  claimed_at: string | null;
  collection_type: string | null;
  donor: string;
  pickup: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isActive(status: string) {
  const s = status.toLowerCase().replace(/-/g, "_");
  return s === "claimed" || s === "in_transit" || s === "in_progress" || s === "in progress";
}

function isCompleted(status: string) {
  const s = status.toLowerCase();
  return s === "delivered" || s === "cancelled" || s === "collected";
}

function statusMeta(status: string, isDelivery: boolean = false) {
  const s = status.toLowerCase().replace(/-/g, "_");
  switch (s) {
    case "claimed":
      return {
        label: isDelivery ? "Awaiting Delivery" : "Awaiting Collection",
        cls: "bg-secondary text-secondary-foreground border-border",
        dot: "bg-foreground/40",
      };
    case "in_transit":
    case "in_progress":
    case "in progress":
      return {
        label: isDelivery ? "In Transit" : "In Progress",
        cls: "bg-warning/15 text-warning-foreground border-warning/30",
        dot: "bg-warning",
      };
    case "delivered":
    case "collected":
      return {
        label: s === "collected" ? "Collected" : "Delivered",
        cls: "bg-success/10 text-success border-success/25",
        dot: "bg-success",
      };
    case "cancelled":
      return {
        label: "Cancelled",
        cls: "bg-destructive/10 text-destructive border-destructive/20",
        dot: "bg-destructive",
      };
    default:
      return {
        label: status,
        cls: "bg-secondary text-muted-foreground border-border",
        dot: "bg-muted-foreground/40",
      };
  }
}

function formatDateTime(dt: string | null) {
  if (!dt) return "No deadline set";
  return new Intl.DateTimeFormat("en-ZA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dt));
}

// ─── Tab definition ───────────────────────────────────────────────────────────

type TabId = "active-collection" | "active-delivery" | "done-collection" | "done-delivery";

const TABS: {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  emptyMsg: string;
}[] = [
  {
    id: "active-collection",
    label: "Active Collections",
    shortLabel: "Collections",
    icon: <Truck className="h-4 w-4" />,
    emptyMsg: "No active self-collections right now.",
  },
  {
    id: "active-delivery",
    label: "Active Deliveries",
    shortLabel: "Deliveries",
    icon: <MapPin className="h-4 w-4" />,
    emptyMsg: "No active deliveries right now.",
  },
  {
    id: "done-collection",
    label: "Completed Collections",
    shortLabel: "Done Collect.",
    icon: <CheckCircle2 className="h-4 w-4" />,
    emptyMsg: "No completed collections yet.",
  },
  {
    id: "done-delivery",
    label: "Completed Deliveries",
    shortLabel: "Done Deliver.",
    icon: <Boxes className="h-4 w-4" />,
    emptyMsg: "No completed deliveries yet.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

function MyClaims() {
  const [claims, setClaims] = useState<ClaimedBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("active-collection");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function fetchClaims() {
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
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("donation_batches")
          .select(
            `
            id,
            batch_type,
            status,
            collection_datetime,
            claimed_at,
            collection_type,
            donors!donor_id (
              organization_name,
              address
            )
          `,
          )
          .eq("claimed_by", user.id)
          .order("claimed_at", { ascending: false });

        if (error) console.error("[MyClaims] fetch error:", error);

        if (data) {
          setClaims(
            data.map((b: any) => ({
              id: b.id,
              batch_type: b.batch_type || "Surplus Food",
              status: b.status || "claimed",
              collection_datetime: b.collection_datetime,
              claimed_at: b.claimed_at,
              collection_type: b.collection_type || null,
              donor: b.donors?.organization_name || "Anonymous Donor",
              pickup: b.donors?.address || "Location not specified",
            })),
          );
        }
      } catch (err) {
        console.error("Error fetching claims:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchClaims();
  }, []);

  // ── Derived lists ────────────────────────────────────────────────────────────

  const activeCollections = useMemo(
    () => claims.filter((c) => isActive(c.status) && c.collection_type !== "delivery"),
    [claims],
  );
  const activeDeliveries = useMemo(
    () => claims.filter((c) => isActive(c.status) && c.collection_type === "delivery"),
    [claims],
  );
  const doneCollections = useMemo(
    () => claims.filter((c) => isCompleted(c.status) && c.collection_type !== "delivery"),
    [claims],
  );
  const doneDeliveries = useMemo(
    () => claims.filter((c) => isCompleted(c.status) && c.collection_type === "delivery"),
    [claims],
  );

  const listsByTab: Record<TabId, ClaimedBatch[]> = {
    "active-collection": activeCollections,
    "active-delivery": activeDeliveries,
    "done-collection": doneCollections,
    "done-delivery": doneDeliveries,
  };

  const counts: Record<TabId, number> = {
    "active-collection": activeCollections.length,
    "active-delivery": activeDeliveries.length,
    "done-collection": doneCollections.length,
    "done-delivery": doneDeliveries.length,
  };

  const currentList = listsByTab[activeTab];
  const q = search.trim().toLowerCase();
  const filtered = q
    ? currentList.filter(
        (c) =>
          c.donor.toLowerCase().includes(q) ||
          c.batch_type.toLowerCase().includes(q) ||
          c.pickup.toLowerCase().includes(q),
      )
    : currentList;

  const currentTab = TABS.find((t) => t.id === activeTab)!;
  const isActiveSection = activeTab === "active-collection" || activeTab === "active-delivery";

  return (
    <>
      <main className="relative mx-auto max-w-4xl px-4 sm:px-6 py-8 sm:py-10">
        {/* ── Page header ── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">My Claims</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track all collections and deliveries your organisation has claimed.
            </p>
          </div>
          <Link
            to="/ngo/explore"
            className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:-translate-y-0.5"
          >
            Explore Donations
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-2xl" />
            ))}
          </div>
        ) : claims.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* ── Tab bar ── */}
            <div className="mb-5 flex gap-1 rounded-xl border border-border/60 bg-muted/40 p-1">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                    setSearch("");
                  }}
                  className={[
                    "relative flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[11px] font-semibold transition-all sm:px-3 sm:text-sm",
                    activeTab === tab.id
                      ? "bg-background shadow-sm text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  <span className="hidden sm:inline-flex items-center gap-1.5">
                    {tab.icon} {tab.label}
                  </span>
                  <span className="sm:hidden inline-flex items-center gap-1">
                    {tab.icon} {tab.shortLabel}
                  </span>
                  {counts[tab.id] > 0 && (
                    <span
                      className={[
                        "inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                        activeTab === tab.id
                          ? tab.id.startsWith("active")
                            ? "bg-primary text-white"
                            : "bg-emerald-500 text-white"
                          : "bg-muted-foreground/20 text-muted-foreground",
                      ].join(" ")}
                    >
                      {counts[tab.id]}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* ── Section label + search ── */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-lg border",
                    activeTab === "active-collection"
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : activeTab === "active-delivery"
                        ? "bg-amber-50 border-amber-200 text-amber-600"
                        : "bg-emerald-50 border-emerald-200 text-emerald-600",
                  ].join(" ")}
                >
                  {currentTab.icon}
                </div>
                <div>
                  <p className="text-sm font-bold">{currentTab.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {currentList.length} {currentList.length === 1 ? "claim" : "claims"}
                    {q ? ` · ${filtered.length} matching` : ""}
                  </p>
                </div>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <input
                  id="claims-search"
                  type="text"
                  placeholder="Search by donor or food type…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-8 text-xs outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* ── Section divider ── */}
            <div className="mb-5 border-b border-border" />

            {/* ── List ── */}
            {filtered.length === 0 ? (
              <EmptySection
                message={q ? `No results matching "${search}".` : currentTab.emptyMsg}
              />
            ) : (
              <ul className="space-y-3">
                {filtered.map((c) => (
                  <ClaimCard key={c.id} claim={c} muted={!isActiveSection} />
                ))}
              </ul>
            )}
          </>
        )}
      </main>
    </>
  );
}

// ─── Claim card ───────────────────────────────────────────────────────────────

function ClaimCard({ claim, muted }: { claim: ClaimedBatch; muted?: boolean }) {
  const isPickup = claim.collection_type !== "delivery";
  const isDelivery = claim.collection_type === "delivery";
  const { label, cls, dot } = statusMeta(claim.status, isDelivery);
  const deadline = formatDateTime(claim.collection_datetime);
  const claimedOn = claim.claimed_at
    ? new Intl.DateTimeFormat("en-ZA", { month: "short", day: "numeric", year: "numeric" }).format(
        new Date(claim.claimed_at),
      )
    : null;

  return (
    <li
      className={[
        "overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-md",
        muted
          ? "opacity-60 hover:opacity-90 bg-card border-border/40"
          : "glass border-border shadow-sm",
      ].join(" ")}
    >
      <div className="flex items-stretch">
        {/* Left stripe — primary for collections, border-tone for deliveries */}
        <div
          className={`w-1 shrink-0 ${isPickup ? "bg-primary" : "bg-border"} ${muted ? "opacity-40" : ""}`}
        />

        <div className="flex flex-1 flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between min-w-0">
          {/* Left: icon + details */}
          <div className="flex items-start gap-4 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary text-secondary-foreground">
              {isPickup ? <Truck className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <p className="font-semibold capitalize text-foreground">{claim.batch_type}</p>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">
                  {isPickup ? "Self-collect" : "Delivery"}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                From <span className="font-semibold text-foreground">{claim.donor}</span>
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3 shrink-0" />
                  {isPickup ? "Pickup by" : "Delivery by"}:{" "}
                  <span className="font-medium text-foreground">{deadline}</span>
                </span>
                {claimedOn && (
                  <span className="flex items-center gap-1">
                    <Package className="h-3 w-3 shrink-0" />
                    Claimed: <span className="font-medium text-foreground">{claimedOn}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right: status + CTA */}
          <div className="flex items-center gap-3 shrink-0 sm:flex-col sm:items-end sm:gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cls}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {label}
            </span>
            {isPickup ? (
              <Link
                to="/ngo/collection/instructions/$id"
                params={{ id: claim.id }}
                search={{ from: "claims" }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg whitespace-nowrap"
              >
                <Eye className="h-3 w-3" />
                {muted ? "View Details" : "Collection Instructions"}
              </Link>
            ) : (
              <Link
                to="/ngo/track/$id"
                params={{ id: claim.id }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-semibold text-white shadow-md shadow-primary/20 transition-all hover:bg-primary/90 hover:shadow-lg whitespace-nowrap"
              >
                <Navigation className="h-3 w-3" />
                {muted ? "View Details" : "Track Delivery"}
              </Link>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

// ─── Empty states ─────────────────────────────────────────────────────────────

function EmptySection({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-muted/30 px-6 py-12 text-center">
      <Package className="h-8 w-8 text-muted-foreground/30" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="glass rounded-2xl py-20 text-center"
      style={{ boxShadow: "0 4px 16px oklch(0.18 0.16 264 / 0.07)" }}
    >
      <Package className="mx-auto h-10 w-10 text-muted-foreground/30" />
      <p className="mt-4 text-sm font-semibold">No claimed donations yet</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Explore available donations near your organisation.
      </p>
      <Link
        to="/ngo/explore"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90"
      >
        Explore Donations <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
