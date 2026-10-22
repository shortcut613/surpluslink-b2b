import { createFileRoute, Link } from "@tanstack/react-router";

import {
  LayoutDashboard,
  History,
  BarChart2,
  Network,
  Wallet,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { mapBatchRow, relistDonationBatch, type RecentDonation } from "@/lib/donations";
import { calculateBatchImpact } from "@/lib/impact-math";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { StatusBadge } from "@/components/ui/status-badge";

function formatBatchId(id: number) {
  return `#${id.toString().padStart(3, "0")}`;
}

export const getDonorDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const [profileRes, recentBatchesRes, allBatchesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("business_name, organization_name, name")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("donation_batches")
      .select("*, collection_type, donation_items(*)")
      .eq("donor_id", user.id)
      .order("submitted_at", { ascending: false })
      .limit(10),
    supabase
      .from("donation_batches")
      .select("status, donation_items(quantity, unit, category)")
      .eq("donor_id", user.id),
  ]);

  const profile = profileRes.data;
  const data = recentBatchesRes.data;
  const allBatches = allBatchesRes.data;

  if (recentBatchesRes.error) {
    console.error("Failed to load donations:", recentBatchesRes.error);
  }

  const resolvedName =
    profile?.business_name ||
    profile?.organization_name ||
    profile?.name ||
    user.user_metadata?.business_name ||
    user.user_metadata?.organization_name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Partner";

  const allItems: any[] = [];
  (allBatches || []).forEach((b) => {
    if (b.status === "Cancelled" || b.status === "Failed") return;
    if (b.donation_items) {
      allItems.push(...b.donation_items);
    }
  });

  const impact = calculateBatchImpact(allItems);

  return {
    displayName: resolvedName,
    recent: (data || []).map(mapBatchRow),
    totalMeals: impact.totalMeals.toLocaleString("en-ZA"),
    totalKg: impact.totalKg.toLocaleString("en-ZA"),
  };
});

export const donorDashboardQueryOptions = queryOptions({
  queryKey: ["donor", "dashboard"],
  queryFn: () => getDonorDashboardStats(),
  staleTime: 1000 * 60 * 2, // 2 minutes (realtime subscriptions invalidate automatically on changes)
});

export const Route = createFileRoute("/donor/dashboard")({
  head: () => ({
    meta: [{ title: "Donor Dashboard — SurplusLink" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(donorDashboardQueryOptions),
  component: DonorDashboard,
});

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

function DonorDashboard() {
  const {
    data: { displayName, recent, totalMeals, totalKg },
  } = useSuspenseQuery(donorDashboardQueryOptions);
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("donor_dashboard_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "donation_batches" }, () => {
        queryClient.invalidateQueries({ queryKey: ["donor", "dashboard"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <>
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Greeting */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {greeting}, {displayName} 👋
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Thank you for helping fight food waste in your community.
            </p>
          </div>
        </div>

        {/* Quick Impact Summary */}
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="rounded-2xl glass p-5 transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Estimated People Fed
            </p>
            <p className="mt-1.5 text-3xl font-bold tracking-tight text-foreground">{totalMeals}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">All time impact</p>
          </div>
          <div className="rounded-2xl glass p-5 transition-all hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-0.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              Kilos of Food Saved
            </p>
            <p className="mt-1.5 text-3xl font-bold tracking-tight text-foreground">{totalKg} kg</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">All time impact</p>
          </div>
        </div>

        {/* Log Donation Button */}
        <Link
          to="/donor/donate/consent"
          className="mb-6 inline-flex items-center gap-3 rounded-xl bg-primary px-5 py-3 text-primary-foreground shadow-md shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/35 hover:-translate-y-0.5"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg font-bold">
            +
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold">Donate Food</p>
          </div>
        </Link>

        {/* Recent Donations Table */}
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Recent Donations</h2>
          <div className="overflow-hidden rounded-2xl glass">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Batch ID</th>
                  <th className="px-4 py-3 text-left font-medium">Category</th>
                  <th className="px-4 py-3 text-left font-medium">Date &amp; Time</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-left font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                      No recent donations yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium">{formatBatchId(r.id)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.category}</td>
                      <td className="px-4 py-3 text-muted-foreground">{r.time}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {r.status.toLowerCase() === "claimed" &&
                            r.collectionType !== "delivery" && (
                              <Link
                                to="/donor/verify/$id"
                                params={{ id: r.batchId }}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
                              >
                                <ShieldCheck className="h-3.5 w-3.5" />
                                Verify Pickup
                              </Link>
                            )}
                          {(["unclaimed", "second chance"].includes(r.status.toLowerCase()) ||
                            (r.collectionDateTime &&
                              new Date(r.collectionDateTime).getTime() < Date.now() &&
                              !["claimed", "delivered", "collected"].includes(
                                r.status.toLowerCase(),
                              ))) && (
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await relistDonationBatch(r.batchId, 24);
                                  toast.success(
                                    "Batch extended by 24 hours and re-broadcasted to NGOs!",
                                  );
                                  queryClient.invalidateQueries({
                                    queryKey: ["donor", "dashboard"],
                                  });
                                } catch (e: any) {
                                  toast.error(e.message || "Failed to extend batch.");
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-500/10 px-2.5 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/20 transition-colors"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Extend +24h (Second Chance)
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
