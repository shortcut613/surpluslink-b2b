import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { loadCurrentBatch, clearCurrentBatch } from "@/lib/donations";

export const Route = createFileRoute("/donor/donate/consent")({
  head: () => ({ meta: [{ title: "Donation Consent — SurplusLink" }] }),
  component: ConsentPage,
});

function ConsentPage() {
  const [agreed, setAgreed] = useState(false);
  const [showResumeModal, setShowResumeModal] = useState(false);
  const navigate = useNavigate();
  const { displayName } = useAuth();

  useEffect(() => {
    const saved = loadCurrentBatch();
    if (saved && saved.length > 0) {
      setShowResumeModal(true);
    }
  }, []);

  function handleStartNew() {
    clearCurrentBatch();
    setShowResumeModal(false);
  }

  function handleResume() {
    // Navigate directly to the batch page since they already have items in it.
    // This saves them from re-checking the consent box if they are just resuming work.
    navigate({ to: "/donor/donate/batch" });
  }

  return (
    <>
      <div className="flex min-h-screen items-center justify-center bg-foreground/40 px-4 py-10">
        <div className="w-full max-w-lg rounded-xl border bg-card p-8 shadow-xl">
          <Link
            to="/donor/dashboard"
            className="mb-6 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; Back to Dashboard
          </Link>
          <div className="mb-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">SurplusLink</p>
            <h1 className="mt-1 text-lg font-semibold">Welcome, {displayName}</h1>
          </div>

          <h2 className="text-base font-semibold">Donation Consent & Declaration Form</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            By proceeding to log a donation, your affiliate confirms that:
          </p>

          <ul className="mt-4 space-y-2.5 text-sm">
            {[
              "The food being donated is safe for human consumption.",
              "Pre-weight, category and expiry information is accurate.",
              "Your business / your organization is protected from liability.",
              "I have read and agree to the donation terms.",
            ].map((t, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-0.5 text-[color:var(--success)]">✓</span>
                <span className="text-foreground">{t}</span>
              </li>
            ))}
          </ul>

          <label className="mt-5 flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1"
            />
            <span className="select-none">I have read and agree to the declaration above.</span>
          </label>

          <div className="mt-6 flex justify-end gap-3">
            <Link
              to="/donor/dashboard"
              className="rounded-md border px-4 py-2 text-sm hover:bg-secondary"
            >
              Cancel
            </Link>
            <button
              disabled={!agreed}
              onClick={() => navigate({ to: "/donor/donate/batch" })}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              Continue to Donation
            </button>
          </div>
        </div>
      </div>

      {showResumeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-semibold text-foreground">Resume Batch?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We noticed you have a donation batch in progress. Would you like to resume adding to
              it, or start a fresh one?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={handleStartNew}
                className="rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                Start New
              </button>
              <button
                onClick={handleResume}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Resume Batch
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
