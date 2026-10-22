import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { sendPushNotification } from "@/lib/notifications";
import { invalidateNgoVerificationCache } from "@/hooks/useNgoVerification";
import {
  ShieldCheck,
  ShieldX,
  Search,
  ExternalLink,
  Building2,
  Mail,
  Hash,
  Calendar,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  FileText,
  Loader2,
  Maximize2,
} from "lucide-react";

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/verification")({
  head: () => ({ meta: [{ title: "NGO Verification — SurplusLink Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(adminVerificationQueryOptions),
  component: AdminVerificationPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type NGOStatus = "pending" | "verified" | "rejected" | "all";

interface NGO {
  id: string;
  name: string;
  npo_number?: string;
  contact_email?: string;
  status: string;
  created_at: string;
  address?: string;
  phone?: string;
  website?: string;
  description?: string;
  document_url?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: {
    label: "Pending",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: <Clock className="h-3 w-3" />,
  },
  verified: {
    label: "Verified",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  rejected: {
    label: "Rejected",
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    icon: <XCircle className="h-3 w-3" />,
  },
};

// ── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? {
    label: status,
    color: "bg-muted text-muted-foreground",
    icon: null,
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.color}`}
    >
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function NGODetailDrawer({
  ngo,
  onClose,
  onApprove,
  onReject,
  isLoading,
}: {
  ngo: NGO | null;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  isLoading: string | null;
}) {
  const [showDocModal, setShowDocModal] = useState(false);
  if (!ngo) return null;

  const isImage = (url?: string) => {
    if (!url) return false;
    return url.startsWith("data:image/") || /\.(png|jpe?g|webp|gif|svg)(\?.*)?$/i.test(url);
  };

  const isPdf = (url?: string) => {
    if (!url) return false;
    return url.startsWith("data:application/pdf") || /\.pdf(\?.*)?$/i.test(url);
  };

  const handleOpenDocument = (url: string) => {
    if (url.startsWith("data:")) {
      const win = window.open();
      if (win) {
        if (url.startsWith("data:image/")) {
          win.document.write(
            `<title>Registration Certificate</title><body style="margin:0;display:flex;justify-content:center;align-items:center;background:#111;"><img src="${url}" style="max-width:100%;max-height:100vh;" /></body>`,
          );
        } else {
          win.document.write(
            `<title>Registration Certificate</title><body style="margin:0;"><iframe src="${url}" style="border:none;width:100%;height:100vh;"></iframe></body>`,
          );
        }
      } else {
        setShowDocModal(true);
      }
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h2 className="font-bold text-lg">{ngo.name}</h2>
            <StatusBadge status={ngo.status} />
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-muted transition-colors text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
          {/* Details grid */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
            <DetailRow
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={ngo.contact_email ?? "—"}
            />
            <DetailRow
              icon={<Hash className="h-4 w-4" />}
              label="NPO Number"
              value={ngo.npo_number ?? "—"}
              mono
            />
            <DetailRow
              icon={<Calendar className="h-4 w-4" />}
              label="Registered"
              value={formatDate(ngo.created_at)}
            />
            {ngo.phone && (
              <DetailRow icon={<Building2 className="h-4 w-4" />} label="Phone" value={ngo.phone} />
            )}
            {ngo.address && (
              <DetailRow
                icon={<Building2 className="h-4 w-4" />}
                label="Address"
                value={ngo.address}
              />
            )}
            {ngo.website && (
              <DetailRow
                icon={<ExternalLink className="h-4 w-4" />}
                label="Website"
                value={
                  <a
                    href={ngo.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline break-all"
                  >
                    {ngo.website}
                  </a>
                }
              />
            )}
          </div>

          {/* Description */}
          {ngo.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
                About
              </p>
              <p className="text-sm text-foreground leading-relaxed">{ngo.description}</p>
            </div>
          )}

          {/* Document Section */}
          {ngo.document_url ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Registration Certificate
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Document Uploaded
                </span>
              </div>

              {/* Prominent View Uploaded Certificate Card */}
              <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Official Certificate</p>
                      <p className="text-xs text-muted-foreground">Uploaded by organisation</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenDocument(ngo.document_url!)}
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors text-primary"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open
                  </button>
                </div>

                {/* Inline Preview for Image or PDF */}
                {isImage(ngo.document_url) ? (
                  <div
                    className="relative rounded-xl border bg-black/5 dark:bg-white/5 overflow-hidden max-h-60 flex items-center justify-center cursor-pointer group"
                    onClick={() => setShowDocModal(true)}
                  >
                    <img
                      src={ngo.document_url}
                      alt="Certificate Preview"
                      className="max-h-60 w-full object-contain transition-transform group-hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                      <Eye className="h-4 w-4" /> Click to Enlarge
                    </div>
                  </div>
                ) : isPdf(ngo.document_url) ? (
                  <div className="rounded-xl border bg-muted/20 overflow-hidden h-60 relative group">
                    <iframe
                      src={ngo.document_url}
                      title="PDF Certificate Preview"
                      className="w-full h-full border-0 pointer-events-none"
                    />
                    <div
                      onClick={() => setShowDocModal(true)}
                      className="absolute inset-0 bg-transparent hover:bg-black/20 transition-colors flex items-center justify-center cursor-pointer"
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDocModal(true);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-black/80 px-3 py-1.5 text-xs font-bold text-white shadow-lg flex items-center gap-1.5"
                      >
                        <Maximize2 className="h-3.5 w-3.5" /> Inspect Full PDF
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-2">Certificate preview ready</p>
                    <button
                      type="button"
                      onClick={() => handleOpenDocument(ngo.document_url!)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" /> View Uploaded Certificate
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">No document uploaded yet</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Organisation has not submitted registration documents.
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        {ngo.status === "pending" && (
          <div className="border-t px-6 py-4 flex gap-3">
            <button
              onClick={() => onApprove(ngo.id)}
              disabled={isLoading === ngo.id}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {isLoading === ngo.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Approve
            </button>
            <button
              onClick={() => onReject(ngo.id)}
              disabled={isLoading === ngo.id}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/20 disabled:opacity-60 transition-colors"
            >
              {isLoading === ngo.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldX className="h-4 w-4" />
              )}
              Reject
            </button>
          </div>
        )}
        {ngo.status === "verified" && (
          <div className="border-t px-6 py-4">
            <button
              onClick={() => onReject(ngo.id)}
              disabled={isLoading === ngo.id}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-destructive bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive hover:bg-destructive/20 disabled:opacity-60 transition-colors"
            >
              {isLoading === ngo.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldX className="h-4 w-4" />
              )}
              Revoke Verification
            </button>
          </div>
        )}
        {ngo.status === "rejected" && (
          <div className="border-t px-6 py-4">
            <button
              onClick={() => onApprove(ngo.id)}
              disabled={isLoading === ngo.id}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
            >
              {isLoading === ngo.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              Approve Anyway
            </button>
          </div>
        )}
      </div>

      {/* Full Document Inspection Modal */}
      {showDocModal && ngo.document_url && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-background rounded-2xl shadow-2xl overflow-hidden flex flex-col border">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <h3 className="font-bold text-base">{ngo.name} — Registration Certificate</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="rounded-full p-2 hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-muted/20 min-h-[400px]">
              {isImage(ngo.document_url) ? (
                <img
                  src={ngo.document_url}
                  alt="Official Certificate"
                  className="max-h-[75vh] w-auto max-w-full rounded-lg object-contain shadow-md"
                />
              ) : isPdf(ngo.document_url) ? (
                <iframe
                  src={ngo.document_url}
                  title="Official Certificate PDF"
                  className="w-full h-[75vh] rounded-lg border bg-white"
                />
              ) : (
                <iframe
                  src={ngo.document_url}
                  title="Official Certificate"
                  className="w-full h-[75vh] rounded-lg border bg-white"
                />
              )}
            </div>
            <div className="px-6 py-3 border-t bg-muted/10 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => handleOpenDocument(ngo.document_url!)}
                className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-4 py-2 text-xs font-semibold hover:bg-muted transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Open in New Tab
              </button>
              <button
                type="button"
                onClick={() => setShowDocModal(false)}
                className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DetailRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium break-all ${mono ? "font-mono" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";

export const getAdminVerificationNGOs = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ngos")
    .select(
      "id, organization_name, registration_number, created_at, is_verified, phone, address, document_url",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  return (data || []).map((n: any) => ({
    ...n,
    name: n.organization_name,
    contact_email: "—",
    npo_number: n.registration_number,
    status: n.is_verified ? "verified" : "pending",
  })) as NGO[];
});

export const adminVerificationQueryOptions = queryOptions({
  queryKey: ["admin", "verification"],
  queryFn: () => getAdminVerificationNGOs(),
  staleTime: 1000 * 60 * 5,
});

function AdminVerificationPage() {
  const { data: ngos } = useSuspenseQuery(adminVerificationQueryOptions);
  const queryClient = useQueryClient();

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<NGOStatus>("pending");
  const [selectedNGO, setSelectedNGO] = useState<NGO | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("admin_verification_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "ngos" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin", "verification"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // When NGOs update, update the selected NGO
  useEffect(() => {
    if (selectedNGO) {
      const updated = ngos.find((n) => n.id === selectedNGO.id);
      if (updated) setSelectedNGO(updated);
    }
  }, [ngos]);

  const handleReview = async (id: string, newStatus: "verified" | "rejected") => {
    setActionLoading(id);
    try {
      const isApproved = newStatus === "verified";
      const { error } = await supabase
        .from("ngos")
        .update({ is_verified: isApproved })
        .eq("id", id);
      if (error) throw error;

      // Send in-app and push notification to the NGO
      try {
        await sendPushNotification({
          data: {
            userId: id,
            payload: {
              title: isApproved ? "Organization Approved! 🎉" : "Verification Status Update",
              body: isApproved
                ? "Your NGO has been verified by the SurplusLink administration. You now have full access to claim surplus food."
                : "Your NGO verification application could not be approved at this time. Please check your details or re-upload your registration certificate.",
              url: "/ngo/dashboard",
            },
          },
        });
      } catch (pushErr) {
        console.warn("Could not dispatch verification push notification:", pushErr);
      }

      // Update React Query cache immediately
      queryClient.setQueryData(["admin", "verification"], (prev: NGO[] | undefined) =>
        prev?.map((n) => (n.id === id ? { ...n, status: newStatus } : n)),
      );
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "verification"] });
      invalidateNgoVerificationCache();

      if (selectedNGO?.id === id) {
        setSelectedNGO((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      toast.success(`NGO ${isApproved ? "approved" : "rejected"} successfully.`);
    } catch {
      toast.error("Failed to update NGO status. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  // Filter
  const filtered = ngos.filter((n) => {
    const matchesStatus = statusFilter === "all" || n.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      n.name?.toLowerCase().includes(q) ||
      n.contact_email?.toLowerCase().includes(q) ||
      n.npo_number?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const counts = {
    all: ngos.length,
    pending: ngos.filter((n) => n.status === "pending").length,
    verified: ngos.filter((n) => n.status === "verified").length,
    rejected: ngos.filter((n) => n.status === "rejected").length,
  };

  const tabs: { key: NGOStatus; label: string }[] = [
    { key: "pending", label: `Pending (${counts.pending})` },
    { key: "verified", label: `Verified (${counts.verified})` },
    { key: "rejected", label: `Rejected (${counts.rejected})` },
    { key: "all", label: `All (${counts.all})` },
  ];

  return (
    <>
      <NGODetailDrawer
        ngo={selectedNGO}
        onClose={() => setSelectedNGO(null)}
        onApprove={(id) => handleReview(id, "verified")}
        onReject={(id) => handleReview(id, "rejected")}
        isLoading={actionLoading}
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <ShieldCheck className="h-8 w-8 text-primary" />
            NGO Verification
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, approve, or reject NGO registration applications.
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email, or NPO number…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border bg-background pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          {/* Status dropdown (mobile) */}
          <div className="relative sm:hidden">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as NGOStatus)}
              className="w-full appearance-none rounded-xl border bg-background px-4 py-2.5 pr-8 text-sm outline-none"
            >
              {tabs.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground" />
          </div>
        </div>

        {/* Tab bar (desktop) */}
        <div className="hidden sm:flex items-center gap-1 rounded-xl border bg-muted/30 p-1 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${statusFilter === t.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <ShieldCheck className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-semibold text-sm">No NGOs found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search
                  ? "Try a different search query."
                  : statusFilter === "pending"
                    ? "No pending applications — you're all caught up!"
                    : "No records match this filter."}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <table className="hidden md:table w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="px-5 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Organisation
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      NPO Number
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Submitted
                    </th>
                    <th className="px-5 py-3 text-left font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Status
                    </th>
                    <th className="px-5 py-3 text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((ngo) => (
                    <tr key={ngo.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-5 py-4">
                        <p className="font-semibold">{ngo.name}</p>
                        <p className="text-xs text-muted-foreground">{ngo.contact_email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span className="font-mono text-xs">{ngo.npo_number ?? "—"}</span>
                      </td>
                      <td className="px-5 py-4 text-muted-foreground text-xs">
                        {formatDate(ngo.created_at)}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={ngo.status} />
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setSelectedNGO(ngo)}
                            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted/60 transition-colors"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Details
                          </button>
                          {ngo.status === "pending" && (
                            <>
                              <button
                                onClick={() => handleReview(ngo.id, "verified")}
                                disabled={actionLoading === ngo.id}
                                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                              >
                                {actionLoading === ngo.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ShieldCheck className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </button>
                              <button
                                onClick={() => handleReview(ngo.id, "rejected")}
                                disabled={actionLoading === ngo.id}
                                className="flex items-center gap-1.5 rounded-lg border border-destructive bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-60 transition-colors"
                              >
                                {actionLoading === ngo.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <ShieldX className="h-3.5 w-3.5" />
                                )}
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile cards */}
              <ul className="md:hidden divide-y">
                {filtered.map((ngo) => (
                  <li key={ngo.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{ngo.name}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {ngo.contact_email}
                        </p>
                      </div>
                      <StatusBadge status={ngo.status} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => setSelectedNGO(ngo)}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium hover:bg-muted/60 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Details
                      </button>
                      {ngo.status === "pending" && (
                        <>
                          <button
                            onClick={() => handleReview(ngo.id, "verified")}
                            disabled={actionLoading === ngo.id}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Approve
                          </button>
                          <button
                            onClick={() => handleReview(ngo.id, "rejected")}
                            disabled={actionLoading === ngo.id}
                            className="flex items-center gap-1.5 rounded-lg border border-destructive bg-destructive/10 px-3 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/20 disabled:opacity-60 transition-colors"
                          >
                            <ShieldX className="h-3.5 w-3.5" />
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </>
  );
}
