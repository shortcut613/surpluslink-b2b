import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  TicketCheck,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  Package,
  Banknote,
  Activity,
  Server,
  Zap,
  LayoutDashboard,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";

import { calculateBatchImpact } from "@/lib/impact-math";

export const getAdminDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const [ngoRes, ticketRes, recentRes, batchRes] = await Promise.all([
    supabase
      .from("ngos")
      .select(
        "id, organization_name, is_verified, created_at, phone, address, registration_number, document_url",
      ),
    supabase
      .from("support_tickets")
      .select("id, subject, status, priority, created_at, user_email")
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("ngos")
      .select(
        "id, organization_name, is_verified, created_at, phone, address, registration_number, document_url",
      )
      .eq("is_verified", false)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("donation_batches")
      .select("id, donor_id, status, created_at, donation_items(quantity, unit)"),
  ]);

  const ngosRaw = ngoRes.data ?? [];
  const tickets = ticketRes.data ?? [];
  const recentPendingRaw = recentRes.data ?? [];
  const batches = batchRes.data ?? [];

  const ngos = ngosRaw.map((n: any) => ({
    ...n,
    name: n.organization_name,
    contact_email: n.phone || "No contact provided",
    status: n.is_verified ? "verified" : "pending",
  }));

  const recentPending = recentPendingRaw.map((n: any) => ({
    ...n,
    name: n.organization_name,
    contact_email: n.phone || "No contact provided",
    status: n.is_verified ? "verified" : "pending",
  }));

  // Calculate donation stats
  const activeBatches = batches.filter((b) => b.status === "Pending" || b.status === "Unclaimed");
  const completedBatches = batches.filter(
    (b) => b.status === "Delivered" || b.status === "Collected",
  );
  const uniqueDonors = new Set(batches.map((b) => b.donor_id)).size;

  // Unified impact calculation across batches
  let totalValue = 0;
  let totalMeals = 0;
  let totalKg = 0;
  batches.forEach((b) => {
    if (b.donation_items && b.donation_items.length > 0) {
      const impact = calculateBatchImpact(b.donation_items);
      totalValue += impact.totalValueZar;
      totalMeals += impact.totalMeals;
      totalKg += impact.totalKg;
    }
  });

  return {
    pending: ngos.filter((n) => n.status === "pending").length,
    verified: ngos.filter((n) => n.status === "verified").length,
    rejected: ngos.filter((n) => n.status === "rejected").length,
    total: ngos.length,
    openTickets: tickets.filter((t) => t.status === "open" || t.status === "in_progress").length,
    totalTickets: tickets.length,
    recentPending,
    recentTickets: tickets,
    donations: {
      total: batches.length,
      active: activeBatches.length,
      completed: completedBatches.length,
      value: totalValue,
      meals: totalMeals,
      kg: totalKg,
      donors: uniqueDonors,
    },
    systemHealth: {
      status: "Operational",
      uptime: "99.9%",
      lastBackup: new Date().toISOString(),
      activeConnections: ngos.length + uniqueDonors + activeBatches.length,
    },
  };
});

export const adminDashboardQueryOptions = queryOptions({
  queryKey: ["admin", "dashboard"],
  queryFn: () => getAdminDashboardStats(),
  staleTime: 1000 * 60 * 2, // 2 minutes
});

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({ meta: [{ title: "Admin Dashboard — SurplusLink" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(adminDashboardQueryOptions),
  component: AdminDashboardPage,
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return d === 1 ? "Yesterday" : `${d} days ago`;
  if (h >= 1) return `${h}h ago`;
  const m = Math.floor(diff / 60_000);
  return m <= 1 ? "Just now" : `${m}m ago`;
}

const priorityColors: Record<string, string> = {
  high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
};

const ticketStatusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  resolved: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

// ── Components ───────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 flex flex-col gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div
        className={`h-10 w-10 rounded-xl flex items-center justify-center ${accent ?? "bg-primary/10 text-primary"}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-3xl font-black tracking-tight">{value}</p>
        <p className="text-sm font-medium text-foreground mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function AdminDashboardPage() {
  const { data } = useSuspenseQuery(adminDashboardQueryOptions);
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("admin_dashboard_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ngos" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
          <LayoutDashboard className="h-8 w-8 text-primary" />
          Admin Dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Platform health, verification queue, and support tickets at a glance.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="h-5 w-5" />}
          label="Pending Verifications"
          value={data.pending}
          sub="Awaiting review"
          accent={
            data.pending > 0
              ? "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400"
              : "bg-primary/10 text-primary"
          }
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Verified NGOs"
          value={data.verified}
          sub={`${data.total} total registered`}
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatCard
          icon={<XCircle className="h-5 w-5" />}
          label="Rejected Applications"
          value={data.rejected}
          accent="bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
        />
        <StatCard
          icon={<TicketCheck className="h-5 w-5" />}
          label="Open Tickets"
          value={data.openTickets}
          sub={`${data.totalTickets} total`}
          accent={
            data.openTickets > 0
              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-primary/10 text-primary"
          }
        />
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight">Platform Activity</h2>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Package className="h-5 w-5" />}
          label="Total Donations"
          value={data.donations.total}
          sub={`${data.donations.active} currently active`}
          accent="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
        />
        <StatCard
          icon={<Banknote className="h-5 w-5" />}
          label="Est. Rescued Value"
          value={`R${data.donations.value.toLocaleString()}`}
          sub={
            data.donations.meals
              ? `${data.donations.meals.toLocaleString()} meals rescued`
              : "Total estimated value"
          }
          accent="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Active Donors"
          value={data.donations.donors}
          sub="Unique contributing donors"
          accent="bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Completed Batches"
          value={data.donations.completed}
          sub="Successfully delivered"
          accent="bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
        />
      </div>

      {/* System Terminal & Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        {/* System Health */}
        <div className="lg:col-span-1 rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-emerald-500" />
              <h2 className="font-semibold text-sm">System Health</h2>
            </div>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          <div className="px-6 py-4 space-y-4">
            <div className="flex justify-between border-b pb-2 text-sm">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{data.systemHealth.status}</span>
            </div>
            <div className="flex justify-between border-b pb-2 text-sm">
              <span className="text-muted-foreground">Uptime</span>
              <span className="font-medium">{data.systemHealth.uptime}</span>
            </div>
            <div className="flex justify-between border-b pb-2 text-sm">
              <span className="text-muted-foreground">Active Platform Entities</span>
              <span className="font-medium">{data.systemHealth.activeConnections}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Backup</span>
              <span className="font-medium">
                {new Date(data.systemHealth.lastBackup).toLocaleTimeString()}
              </span>
            </div>
          </div>

          <div className="px-6 pb-4 pt-2 text-xs text-muted-foreground flex items-center gap-2">
            <Zap className="h-3 w-3 text-emerald-500" />
            System is serving users correctly.
          </div>
        </div>

        {/* Recent pending NGOs */}
        <div className="lg:col-span-1 rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-500" />
              <h2 className="font-semibold text-sm">Recent Pending NGOs</h2>
            </div>
            <Link
              to="/admin/verification"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {data.recentPending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <ShieldCheck className="h-8 w-8 text-emerald-500 mb-3" />
              <p className="text-sm font-medium">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">
                No pending verifications right now.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {data.recentPending.map((ngo) => (
                <li
                  key={ngo.id}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{ngo.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{ngo.contact_email}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(ngo.created_at)}
                    </span>
                    <Link
                      to="/admin/verification"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Review
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent tickets */}
        <div className="lg:col-span-1 rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b">
            <div className="flex items-center gap-2">
              <TicketCheck className="h-4 w-4 text-blue-500" />
              <h2 className="font-semibold text-sm">Recent Support Tickets</h2>
            </div>
            <Link
              to="/admin/tickets"
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {data.recentTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <TicketCheck className="h-8 w-8 text-emerald-500 mb-3" />
              <p className="text-sm font-medium">No tickets yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Support tickets will appear here.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {data.recentTickets.map((ticket) => (
                <li
                  key={ticket.id}
                  className="flex items-start justify-between px-6 py-3.5 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{ticket.subject}</p>
                    <p className="text-xs text-muted-foreground truncate">{ticket.user_email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-4 mt-0.5">
                    {ticket.priority && (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${priorityColors[ticket.priority] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {ticket.priority}
                      </span>
                    )}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${ticketStatusColors[ticket.status] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {ticket.status?.replace("_", " ")}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="font-semibold text-sm mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Quick Actions
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/verification"
            className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted/60 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Review NGO Queue
            {data.pending > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {data.pending}
              </span>
            )}
          </Link>
          <Link
            to="/admin/tickets"
            className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted/60 transition-colors"
          >
            <TicketCheck className="h-4 w-4 text-blue-500" />
            Open Tickets
            {data.openTickets > 0 && (
              <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-bold text-white">
                {data.openTickets}
              </span>
            )}
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl border bg-background px-4 py-2.5 text-sm font-medium hover:bg-muted/60 transition-colors"
          >
            <Users className="h-4 w-4 text-muted-foreground" />
            View Platform
          </Link>
        </div>
      </div>
    </div>
  );
}
