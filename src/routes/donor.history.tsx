import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader, donorNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { donorSidebarNav } from "@/lib/nav";
import { supabase } from "@/lib/supabase";
import {
  Package,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Search,
  SlidersHorizontal,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";

import { useAuth, getFastCachedAuth } from "@/hooks/useAuth";
import { relistDonationBatch } from "@/lib/donations";
import { toast } from "sonner";

export const Route = createFileRoute("/donor/history")({
  head: () => ({ meta: [{ title: "Donation History — SurplusLink" }] }),
  component: DonorHistory,
});

// Database TypeScript interfaces
interface DBItem {
  id: string;
  batch_id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  expiry: string | null;
}

interface DBBatch {
  id: string;
  display_id: number;
  batch_type: string;
  created_at: string;
  status:
    "Pending" | "Claimed" | "Delivered" | "Unclaimed" | "Cancelled" | "Collected" | "Second Chance";
  collection_datetime: string | null;
  collection_type?: string | null;
  donation_items: DBItem[];
}

function formatBatchId(id: number | string) {
  if (typeof id === "number") {
    return `#${id.toString().padStart(3, "0")}`;
  }
  return `#${id.slice(0, 8).toUpperCase()}`;
}

function formatDonationTime(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return dateStr || "—";
  }
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    claimed: "bg-blue-100 text-blue-700 border-blue-200",
    delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
    collected: "bg-emerald-100 text-emerald-700 border-emerald-200",
    unclaimed: "bg-neutral-100 text-neutral-500 border-neutral-200",
    cancelled: "bg-red-100 text-red-600 border-red-200",
    "second chance": "bg-amber-500/15 text-amber-700 border-amber-300 animate-pulse",
  };
  const cls = styles[normalized] ?? "bg-neutral-100 text-neutral-500 border-neutral-200";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

function DonationRow({ d, onRelist }: { d: DBBatch; onRelist?: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [isRelisting, setIsRelisting] = useState(false);

  const collectionLabel = d.collection_datetime ? formatDonationTime(d.collection_datetime) : "—";

  const formattedId = d.display_id ? formatBatchId(d.display_id) : formatBatchId(d.id);

  return (
    <div
      className="glass rounded-3xl overflow-hidden transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5 mb-4"
      style={{ boxShadow: "0 8px 32px oklch(0.18 0.16 264 / 0.05)" }}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left"
      >
        {/* Batch icon */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Package className="h-5 w-5" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{formattedId}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-sm text-muted-foreground truncate">{d.batch_type}</span>
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarClock className="h-3 w-3 shrink-0" />
            <span>Submitted {formatDonationTime(d.created_at)}</span>
          </div>
        </div>

        {/* Status + items count + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:block text-xs text-muted-foreground">
            {d.donation_items?.length || 0} item{(d.donation_items?.length || 0) !== 1 ? "s" : ""}
          </span>
          <StatusBadge status={d.status} />
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="border-t border-border/30 bg-secondary/20 px-6 py-5 space-y-5">
          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Meta label="Batch ID" value={formattedId} />
            <Meta label="Status" value={d.status} />
            <Meta label="Collect By" value={collectionLabel} />
            <Meta label="Total Items" value={String(d.donation_items?.length || 0)} />
          </div>

          {/* Items table */}
          {d.donation_items && d.donation_items.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Items in batch
              </p>
              <div
                className="overflow-hidden rounded-2xl glass shadow-sm"
                style={{ boxShadow: "0 4px 16px oklch(0.18 0.16 264 / 0.05)" }}
              >
                <table className="w-full text-sm">
                  <thead className="bg-secondary">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                        Item
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                        Qty
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">
                        Expiry
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {d.donation_items.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-muted/50">
                        <td className="px-4 py-3 font-medium">{item.name}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-1">
                            {item.category.split(", ").map((c) => (
                              <span
                                key={c}
                                className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {item.expiry ? item.expiry.replace("T", " ") : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Extend +24h Action for Unclaimed / Second Chance / Lapsed batches */}
          {(["unclaimed", "second chance"].includes(d.status.toLowerCase()) ||
            (d.collection_datetime &&
              new Date(d.collection_datetime).getTime() < Date.now() &&
              !["claimed", "delivered", "collected"].includes(d.status.toLowerCase()))) && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-500/10 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-amber-900">Extend Collection Window</p>
                <p className="mt-0.5 text-xs text-amber-700">
                  Relist this batch with a fresh 24-hour collection deadline and re-broadcast to
                  NGOs.
                </p>
              </div>
              <button
                type="button"
                disabled={isRelisting}
                onClick={async () => {
                  setIsRelisting(true);
                  try {
                    await relistDonationBatch(d.id, 24);
                    toast.success("Batch extended by 24 hours and re-broadcasted to NGOs!");
                    onRelist?.();
                  } catch (e: any) {
                    toast.error(e.message || "Failed to extend batch.");
                  } finally {
                    setIsRelisting(false);
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-500/20 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-500/30 transition-colors shadow-sm disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {isRelisting ? "Extending…" : "Extend +24h (Second Chance)"}
              </button>
            </div>
          )}

          {/* Verify Pickup CTA */}
          {d.status.toLowerCase() === "claimed" && d.collection_type !== "delivery" && (
            <div className="flex items-center justify-between rounded-2xl border border-primary/20 bg-primary/5 px-5 py-4">
              <div>
                <p className="text-sm font-bold text-foreground">
                  Self-Collection Pending Verification
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Verify the 4-digit PIN when the NGO arrives to collect.
                </p>
              </div>
              <Link
                to="/donor/verify/$id"
                params={{ id: d.id }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Verify Pickup
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

const STATUS_OPTIONS = [
  "All",
  "Pending",
  "Claimed",
  "Delivered",
  "Unclaimed",
  "Second Chance",
  "Cancelled",
];

function DonorHistory() {
  const { initials } = useAuth();
  const [donations, setDonations] = useState<DBBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  async function fetchDonorData() {
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

      if (!user) {
        setLoading(false);
        return;
      }

      // Fetch batches joined with their items in a single roundtrip
      const { data: batches, error: batchError } = await supabase
        .from("donation_batches")
        .select("*, donation_items(*)")
        .eq("donor_id", user.id);

      if (batchError) {
        console.error(
          "Supabase SELECT failed on donation_batches:",
          batchError.message,
          batchError.details,
        );
        throw batchError;
      }

      if (batches && batches.length > 0) {
        // Process, normalize, and sort batches on the client side
        const mapped: DBBatch[] = batches.map((batch: any) => {
          const batchType = batch.batch_type || batch.category || batch.type || "General Donation";
          const collectionDatetime =
            batch.collection_datetime || batch.collection_time || batch.collection_date || null;

          // Safe fallback for creation timestamp
          const createdAt =
            batch.created_at ||
            batch.created_date ||
            batch.date_submitted ||
            batch.timestamp ||
            new Date().toISOString();

          const items = batch.donation_items || [];

          return {
            id: batch.id,
            display_id: 0, // Assigned below after sorting
            batch_type: batchType,
            created_at: createdAt,
            status: batch.status || "Pending",
            collection_datetime: collectionDatetime,
            collection_type: batch.collection_type ?? null,
            donation_items: (items as any[]).map((item) => ({
              id: item.id,
              batch_id: batch.id,
              name: item.name,
              category: item.category || item.item_type || "Uncategorized",
              quantity: Number(item.quantity || 0),
              unit: item.unit || "units",
              expiry: item.expiry || item.expiry_date || null,
            })),
          };
        });

        // Sort descending by creation date in memory
        mapped.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        // Re-index clean UI sequential IDs from oldest to newest
        const fullyIndexed = mapped.map((batch, index, arr) => ({
          ...batch,
          display_id: arr.length - index,
        }));

        setDonations(fullyIndexed);
      } else {
        setDonations([]);
      }
    } catch (err) {
      console.error("Detailed donor history fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDonorData();
  }, []);

  const filtered = donations.filter((d) => {
    const matchesStatus = statusFilter === "All" || d.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      d.batch_type.toLowerCase().includes(q) ||
      (d.donation_items &&
        d.donation_items.some(
          (item) => item.name.toLowerCase().includes(q) || item.category.toLowerCase().includes(q),
        ));
    return matchesStatus && matchesSearch;
  });

  const total = donations.length;
  const delivered = donations.filter((d) => ["Delivered", "Collected"].includes(d.status)).length;
  const pending = donations.filter((d) => d.status === "Pending").length;

  return (
    <>
      <div className="relative min-h-[calc(100vh-56px)] overflow-hidden page-transition">
        {/* Background blobs */}
        <div className="pointer-events-none absolute -top-1/4 left-0 h-[600px] w-[600px] animate-pulse rounded-full bg-primary/5 blur-[150px] [animation-duration:15s]" />
        <div className="pointer-events-none absolute bottom-0 -right-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-secondary/5 blur-[120px] [animation-duration:10s]" />

        <main className="relative mx-auto max-w-4xl px-6 py-10 z-10">
          <div className="mb-10">
            <h1 className="text-3xl font-black tracking-tight text-foreground">Donation Records</h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground uppercase tracking-widest">
              Review your past contributions and their current status
            </p>
          </div>

          {/* Summary cards */}
          <div className="mb-8 grid grid-cols-3 gap-4">
            <div
              className="glass rounded-3xl p-6 text-center shadow-sm hover:-translate-y-1 transition-all"
              style={{ boxShadow: "0 4px 16px oklch(0.18 0.16 264 / 0.05)" }}
            >
              <p className="text-3xl font-black">{total}</p>
              <p className="mt-2 text-xs text-muted-foreground uppercase tracking-widest font-bold">
                Total Batches
              </p>
            </div>
            <div
              className="glass rounded-3xl p-6 text-center shadow-sm hover:-translate-y-1 transition-all"
              style={{ boxShadow: "0 4px 16px oklch(0.18 0.16 264 / 0.05)" }}
            >
              <p className="text-3xl font-black text-emerald-600">{delivered}</p>
              <p className="mt-2 text-xs text-muted-foreground uppercase tracking-widest font-bold">
                Delivered
              </p>
            </div>
            <div
              className="glass rounded-3xl p-6 text-center shadow-sm hover:-translate-y-1 transition-all"
              style={{ boxShadow: "0 4px 16px oklch(0.18 0.16 264 / 0.05)" }}
            >
              <p className="text-3xl font-black text-amber-600">{pending}</p>
              <p className="mt-2 text-xs text-muted-foreground uppercase tracking-widest font-bold">
                Pending
              </p>
            </div>
          </div>

          {/* Search + filter bar */}
          <div
            className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between glass rounded-3xl p-6"
            style={{ boxShadow: "0 8px 32px oklch(0.18 0.16 264 / 0.05)" }}
          >
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search batches or items..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-2xl border bg-background/50 pl-10 pr-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary backdrop-blur-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex gap-1 flex-wrap">
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all ${
                      statusFilter === s
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-background/50 border border-border/50 text-muted-foreground hover:text-foreground backdrop-blur-sm hover:bg-background"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-3xl glass animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-3xl glass py-20 text-center shadow-sm">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 text-sm font-medium">No donations found</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {donations.length === 0
                  ? "You haven't submitted any batches yet."
                  : "Try adjusting your search or filter."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((d) => (
                <DonationRow key={d.id} d={d} onRelist={fetchDonorData} />
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}
