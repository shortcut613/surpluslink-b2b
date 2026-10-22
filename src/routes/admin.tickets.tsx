import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  TicketCheck,
  Search,
  X,
  Send,
  MessageCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Loader2,
  User,
  ShieldCheck,
  Calendar,
  Tag,
  Inbox,
} from "lucide-react";

// ── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/tickets")({
  head: () => ({ meta: [{ title: "Support Tickets — SurplusLink Admin" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(adminTicketsQueryOptions),
  component: AdminTicketsPage,
});

// ── Types ────────────────────────────────────────────────────────────────────

type TicketStatus = "open" | "in_progress" | "resolved" | "closed" | "all";
type TicketPriority = "low" | "medium" | "high" | "all";

interface TicketReply {
  id: string;
  ticket_id: string;
  content: string;
  is_admin: boolean;
  created_at: string;
  author_name?: string;
}

interface Ticket {
  id: string;
  subject: string;
  message: string;
  status: string;
  priority?: string;
  category?: string;
  user_email: string;
  user_name?: string;
  created_at: string;
  updated_at?: string;
  ticket_replies?: TicketReply[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function formatRelative(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(h / 24);
  if (d >= 1) return d === 1 ? "Yesterday" : `${d}d ago`;
  if (h >= 1) return `${h}h ago`;
  const m = Math.floor(diff / 60_000);
  return m <= 1 ? "Just now" : `${m}m ago`;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open: {
    label: "Open",
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    icon: <Inbox className="h-3 w-3" />,
  },
  in_progress: {
    label: "In Progress",
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    icon: <Clock className="h-3 w-3" />,
  },
  resolved: {
    label: "Resolved",
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  closed: {
    label: "Closed",
    color: "bg-muted text-muted-foreground",
    icon: <X className="h-3 w-3" />,
  },
};

const priorityConfig: Record<string, { color: string }> = {
  high: {
    color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  medium: {
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  low: {
    color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
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

function PriorityBadge({ priority }: { priority?: string }) {
  if (!priority) return null;
  const cfg = priorityConfig[priority] ?? {
    color: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${cfg.color}`}
    >
      {priority}
    </span>
  );
}

function TicketDrawer({
  ticket,
  onClose,
  onStatusChange,
  onPriorityChange,
  actionLoading,
}: {
  ticket: Ticket | null;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  onPriorityChange: (id: string, priority: string) => void;
  actionLoading: boolean;
}) {
  const [reply, setReply] = useState("");
  const [sendingReply, setSendingReply] = useState(false);
  const [replies, setReplies] = useState<TicketReply[]>([]);

  useEffect(() => {
    if (ticket) {
      setReplies(ticket.ticket_replies ?? []);
    }
  }, [ticket]);

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !ticket) return;
    setSendingReply(true);
    try {
      const { data, error } = await supabase
        .from("ticket_replies")
        .insert({
          ticket_id: ticket.id,
          content: reply.trim(),
          is_admin: true,
          author_name: "SurplusLink Admin",
        })
        .select()
        .single();
      if (error) throw error;
      setReplies((prev) => [...prev, data as TicketReply]);
      setReply("");
      // Auto-move to in_progress if open
      if (ticket.status === "open") {
        onStatusChange(ticket.id, "in_progress");
      }
      toast.success("Reply sent.");
    } catch {
      toast.error("Failed to send reply.");
    } finally {
      setSendingReply(false);
    }
  };

  if (!ticket) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-background shadow-2xl animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-start justify-between border-b px-6 py-4 gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {ticket.category && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  {ticket.category}
                </span>
              )}
            </div>
            <h2 className="font-bold text-base leading-tight">{ticket.subject}</h2>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <User className="h-3 w-3" />
              {ticket.user_name ?? ticket.user_email} · {formatRelative(ticket.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-muted transition-colors text-muted-foreground shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 border-b px-6 py-3 bg-muted/20">
          <div className="flex items-center gap-2 flex-1">
            <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Status
            </label>
            <div className="relative">
              <select
                value={ticket.status}
                disabled={actionLoading}
                onChange={(e) => onStatusChange(ticket.id, e.target.value)}
                className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-7 text-xs font-medium outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-muted-foreground" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
              Priority
            </label>
            <div className="relative">
              <select
                value={ticket.priority ?? "low"}
                disabled={actionLoading}
                onChange={(e) => onPriorityChange(ticket.id, e.target.value)}
                className="appearance-none rounded-lg border bg-background px-3 py-1.5 pr-7 text-xs font-medium outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-muted-foreground" />
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Original message */}
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
              <User className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2 mb-1">
                <p className="text-sm font-semibold">{ticket.user_name ?? ticket.user_email}</p>
                <p className="text-xs text-muted-foreground">{formatDateTime(ticket.created_at)}</p>
              </div>
              <div className="rounded-2xl rounded-tl-sm bg-muted/50 border px-4 py-3">
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{ticket.message}</p>
              </div>
            </div>
          </div>

          {/* Replies */}
          {replies.map((r) => (
            <div key={r.id} className={`flex gap-3 ${r.is_admin ? "flex-row-reverse" : ""}`}>
              <div
                className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                  r.is_admin
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {r.is_admin ? <ShieldCheck className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className={`flex-1 min-w-0 ${r.is_admin ? "items-end flex flex-col" : ""}`}>
                <div
                  className={`flex items-baseline gap-2 mb-1 ${r.is_admin ? "flex-row-reverse" : ""}`}
                >
                  <p className="text-sm font-semibold">
                    {r.author_name ?? (r.is_admin ? "Admin" : "User")}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatRelative(r.created_at)}</p>
                </div>
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[90%] ${
                    r.is_admin
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted/50 border"
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{r.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Reply box */}
        {ticket.status !== "closed" && ticket.status !== "resolved" ? (
          <div className="border-t bg-background/80 px-6 py-4">
            <form onSubmit={handleReply} className="flex gap-3 items-end">
              <div className="flex-1 rounded-xl border bg-background focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all overflow-hidden">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply…"
                  rows={3}
                  disabled={sendingReply}
                  className="w-full resize-none bg-transparent px-4 py-3 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={!reply.trim() || sendingReply}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
              >
                {sendingReply ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </form>
          </div>
        ) : (
          <div className="border-t px-6 py-4 text-center">
            <p className="text-sm text-muted-foreground">
              This ticket is {ticket.status}. Change status to reply.
            </p>
          </div>
        )}
      </div>
    </>
  );
}

import { createServerFn } from "@tanstack/react-start";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";

export const getAdminTickets = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("*, ticket_replies(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as Ticket[];
});

export const adminTicketsQueryOptions = queryOptions({
  queryKey: ["admin", "tickets"],
  queryFn: () => getAdminTickets(),
  staleTime: 1000 * 60 * 5,
});

function AdminTicketsPage() {
  const { data: tickets } = useSuspenseQuery(adminTicketsQueryOptions);
  const queryClient = useQueryClient();

  const [actionLoading, setActionLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<TicketStatus>("open");
  const [priorityFilter, setPriorityFilter] = useState<TicketPriority>("all");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    const channel = supabase
      .channel("admin_tickets_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] }),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "ticket_replies" }, () =>
        queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // When tickets update, update the selected ticket if it's open
  useEffect(() => {
    if (selectedTicket) {
      const updated = tickets.find((t) => t.id === selectedTicket.id);
      if (updated) setSelectedTicket(updated);
    }
  }, [tickets]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      queryClient.setQueryData(["admin", "tickets"], (prev: Ticket[] | undefined) =>
        prev?.map((t) => (t.id === id ? { ...t, status: newStatus } : t)),
      );
      if (selectedTicket?.id === id) {
        setSelectedTicket((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      toast.success(`Ticket marked as ${newStatus.replace("_", " ")}.`);
    } catch {
      toast.error("Failed to update ticket status.");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePriorityChange = async (id: string, priority: string) => {
    setActionLoading(true);
    try {
      const { error } = await supabase.from("support_tickets").update({ priority }).eq("id", id);
      if (error) throw error;
      queryClient.setQueryData(["admin", "tickets"], (prev: Ticket[] | undefined) =>
        prev?.map((t) => (t.id === id ? { ...t, priority } : t)),
      );
      if (selectedTicket?.id === id) {
        setSelectedTicket((prev) => (prev ? { ...prev, priority } : null));
      }
      toast.success("Priority updated.");
    } catch {
      toast.error("Failed to update priority.");
    } finally {
      setActionLoading(false);
    }
  };

  // Filter
  const filtered = tickets.filter((t) => {
    const matchesStatus = statusFilter === "all" || t.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      t.subject?.toLowerCase().includes(q) ||
      t.user_email?.toLowerCase().includes(q) ||
      t.message?.toLowerCase().includes(q);
    return matchesStatus && matchesPriority && matchesSearch;
  });

  const counts = {
    all: tickets.length,
    open: tickets.filter((t) => t.status === "open").length,
    in_progress: tickets.filter((t) => t.status === "in_progress").length,
    resolved: tickets.filter((t) => t.status === "resolved").length,
    closed: tickets.filter((t) => t.status === "closed").length,
  };

  const tabs: { key: TicketStatus; label: string }[] = [
    { key: "open", label: `Open (${counts.open})` },
    { key: "in_progress", label: `In Progress (${counts.in_progress})` },
    { key: "resolved", label: `Resolved (${counts.resolved})` },
    { key: "closed", label: `Closed (${counts.closed})` },
    { key: "all", label: `All (${counts.all})` },
  ];

  return (
    <>
      <TicketDrawer
        ticket={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onStatusChange={handleStatusChange}
        onPriorityChange={handlePriorityChange}
        actionLoading={actionLoading}
      />

      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <TicketCheck className="h-8 w-8 text-primary" />
            Support Tickets
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage and respond to user support requests.
          </p>
        </div>

        {/* Filters bar */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by subject, email, or message…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border bg-background pl-9 pr-4 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
          <div className="relative">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value as TicketPriority)}
              className="appearance-none rounded-xl border bg-background px-4 py-2.5 pr-8 text-sm outline-none"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground" />
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 rounded-xl border bg-muted/30 p-1 overflow-x-auto w-fit max-w-full">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatusFilter(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                statusFilter === t.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Ticket list */}
        <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <TicketCheck className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="font-semibold text-sm">No tickets found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {search ? "Try a different search term." : "No tickets match this filter."}
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {filtered.map((ticket) => {
                const replyCount = ticket.ticket_replies?.length ?? 0;
                return (
                  <li
                    key={ticket.id}
                    onClick={() => setSelectedTicket(ticket)}
                    className="flex items-start gap-4 px-6 py-4 cursor-pointer hover:bg-muted/20 transition-colors group"
                  >
                    {/* Priority indicator */}
                    <div
                      className={`mt-1 h-2.5 w-2.5 rounded-full shrink-0 ${
                        ticket.priority === "high"
                          ? "bg-red-500"
                          : ticket.priority === "medium"
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                      }`}
                    />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                            {ticket.subject}
                          </p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {ticket.user_name ?? ticket.user_email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StatusBadge status={ticket.status} />
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {ticket.message}
                      </p>

                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatRelative(ticket.created_at)}
                        </span>
                        {replyCount > 0 && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            {replyCount} {replyCount === 1 ? "reply" : "replies"}
                          </span>
                        )}
                        {ticket.category && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {ticket.category}
                          </span>
                        )}
                        <PriorityBadge priority={ticket.priority} />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
