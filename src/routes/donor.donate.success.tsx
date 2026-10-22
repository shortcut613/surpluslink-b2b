import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader, donorNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { donorSidebarNav } from "@/lib/nav";

import { useAuth } from "@/hooks/useAuth";

function formatBatchId(id: number) {
  return `#${id.toString().padStart(3, "0")}`;
}

export const Route = createFileRoute("/donor/donate/success")({
  validateSearch: (search: Record<string, unknown>): { batchId: number | null } => {
    const parsed = Number(search.batchId);
    return { batchId: Number.isFinite(parsed) ? parsed : null };
  },
  head: () => ({ meta: [{ title: "Donation Submitted — SurplusLink" }] }),
  component: SuccessPage,
});

function SuccessPage() {
  const { batchId } = Route.useSearch();
  const { initials } = useAuth();

  return (
    <>
      <main className="mx-auto max-w-2xl px-6 py-16">
        {/* Success card */}
        <div className="rounded-xl border bg-card p-10 text-center shadow-sm">
          {/* Icon */}
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-8 w-8 text-[color:var(--success)]"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm13.36-1.814a.75.75 0 1 0-1.06-1.06l-4.3 4.3-1.72-1.72a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.83-4.83Z"
                clipRule="evenodd"
              />
            </svg>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-semibold tracking-tight">Donation Successfully Submitted</h1>

          {/* Batch ID pill */}
          {batchId !== null && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--success)]" />
              Batch {formatBatchId(batchId)}
            </div>
          )}

          {/* Description */}
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Your donation has been added to our network. Verified NGOs nearby have been notified and
            can now claim it.
          </p>

          {/* Divider */}
          <div className="my-8 border-t" />

          {/* What happens next */}
          <div className="mb-8 space-y-3 text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              What happens next
            </p>
            {[
              {
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                    <path
                      fillRule="evenodd"
                      d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ),
                text: "Nearby verified NGOs can see and claim your batch.",
              },
              {
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-13a.75.75 0 0 0-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 0 0 0-1.5h-3.25V5Z"
                      clipRule="evenodd"
                    />
                  </svg>
                ),
                text: "Once claimed, you'll see the status update in your dashboard and history.",
              },
              {
                icon: (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                  >
                    <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.208-7.154.75.75 0 0 0 0-1.115A28.897 28.897 0 0 0 3.105 2.288Z" />
                  </svg>
                ),
                text: "The NGO will arrange collection within 2–24 hours of claiming and confirm delivery when done.",
              },
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg bg-secondary/60 px-4 py-3">
                <span className="mt-0.5 shrink-0 text-muted-foreground">{step.icon}</span>
                <p className="text-sm text-foreground">{step.text}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              to="/donor/donate/consent"
              className="inline-flex h-10 items-center justify-center rounded-md border px-5 text-sm font-medium hover:bg-secondary transition-colors"
            >
              Log Another Donation
            </Link>
            <Link
              to="/donor/dashboard"
              className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
