import React, { useState } from "react";
import { X, Send, Loader2, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { useLocation } from "@tanstack/react-router";

interface LogTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSubject?: string;
  defaultMessage?: string;
  defaultCategory?: string;
}

export function LogTicketModal({
  isOpen,
  onClose,
  defaultSubject = "",
  defaultMessage = "",
  defaultCategory = "Bug Report",
}: LogTicketModalProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState(defaultSubject);
  const [category, setCategory] = useState(defaultCategory);
  const [message, setMessage] = useState(defaultMessage);
  const [loading, setLoading] = useState(false);

  const pathname = useLocation({ select: (s) => s.pathname });

  // Auto-populate user details if they are logged in
  React.useEffect(() => {
    if (isOpen) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          if (user.email && !email) setEmail(user.email);
          const userName =
            user.user_metadata?.organization_name ||
            user.user_metadata?.business_name ||
            user.user_metadata?.full_name;
          if (userName && !name) setName(userName);
        }
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Get current user if any
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 2. Capture session details
      const sessionDetails = `
--- Session Details ---
URL: ${window.location.origin}${pathname}
Browser: ${navigator.userAgent}
Viewport: ${window.innerWidth}x${window.innerHeight}
Time: ${new Date().toISOString()}
`;

      const finalMessage = `${message}\n\n${sessionDetails}`;
      const finalEmail = user?.email || email;
      const finalName =
        user?.user_metadata?.organization_name ||
        user?.user_metadata?.business_name ||
        name ||
        "Anonymous User";

      if (!finalEmail) {
        toast.error("Please provide an email address so we can reach you.");
        setLoading(false);
        return;
      }

      // 3. Insert into Supabase
      const { error } = await supabase.from("support_tickets").insert({
        user_id: user?.id || null,
        user_email: finalEmail,
        user_name: finalName,
        subject,
        category,
        priority: category === "System Outage" || category === "Bug Report" ? "high" : "medium",
        message: finalMessage,
      });

      if (error) throw error;

      toast.success("Message sent! Our team will look into it.");
      onClose();
      // Reset form
      setSubject("");
      setMessage("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm pointer-events-auto">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-card shadow-2xl animate-in zoom-in-95 duration-200 border">
        <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Report an Issue</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Optional if logged in"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Your Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Required if not logged in"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-medium">Subject</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief description of the issue"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="Bug Report">Bug Report</option>
                <option value="Account Issue">Account Issue</option>
                <option value="General Support">General Support</option>
                <option value="Feature Request">Feature Request</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium">Message</label>
            <textarea
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Please describe the issue in detail..."
              className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              * Your browser details and current URL will be automatically attached to help us
              debug.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send to Support Team
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
