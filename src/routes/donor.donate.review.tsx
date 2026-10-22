import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppHeader, donorNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { donorSidebarNav } from "@/lib/nav";
import {
  loadCurrentBatch,
  submitDonationBatch,
  getErrorMessage,
  type DonationItem,
} from "@/lib/donations";
import { DateTimePicker } from "@/components/ScrollPicker";

export const Route = createFileRoute("/donor/donate/review")({
  head: () => ({ meta: [{ title: "Review Batch — SurplusLink" }] }),
  component: ReviewBatch,
});

function ReviewBatch() {
  const navigate = useNavigate();
  const [items, setItems] = useState<DonationItem[]>([]);
  const [collectionDateTime, setCollectionDateTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setItems(loadCurrentBatch());
  }, []);

  // Derive a human-readable batch type from the items
  const batchType = (() => {
    const cats = Array.from(
      new Set(
        items.flatMap((item) =>
          item.category ? item.category.split(", ").map((c) => c.trim()) : [],
        ),
      ),
    ).filter(Boolean);
    if (cats.length === 0) return "Donation";
    if (cats.length === 1) return cats[0];
    return "Mixed Donation";
  })();

  const earliestExpiryDate =
    items
      .map((item) => item.expiry?.split("T")[0])
      .filter(Boolean)
      .sort()[0] ?? undefined;

  const handleSubmit = async () => {
    if (items.length === 0) return;
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Submit batch to database
      const result = await submitDonationBatch(
        items,
        batchType,
        collectionDateTime,
        new Date().toISOString(),
      );

      // Invalidate the dashboard query so the new donation shows up in "Recent Donations"
      const { queryClient } = await import("@/lib/query");
      queryClient.invalidateQueries({ queryKey: ["donor", "dashboard"] });

      // 2. Navigate to success page
      navigate({
        to: "/donor/donate/success",
        search: { batchId: result.id },
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Review Your Batch</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirm the items below and set a collection window before submitting.
          </p>
        </div>

        {/* Items summary */}
        <section className="mb-6 rounded-xl border bg-card">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">Items in Batch ({items.length})</h2>
          </div>
          {items.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">
              No items in your batch. Go back and add some items first.
            </p>
          ) : (
            <div className="overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Item</th>
                    <th className="px-4 py-3 text-left font-medium">Category</th>
                    <th className="px-4 py-3 text-left font-medium">Qty</th>
                    <th className="px-4 py-3 text-left font-medium">Expiry</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-secondary/40">
                      <td className="px-4 py-3 font-medium">{item.name}</td>
                      <td className="px-4 py-3">
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
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.quantity} {item.unit}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {item.expiry ? item.expiry.replace("T", " ") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Batch type display */}
        <section className="mb-6 rounded-xl border bg-card p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Batch Type
          </p>
          <p className="mt-1 text-sm font-medium">{batchType}</p>
        </section>

        {/* Collection window */}
        <section className="mb-8 rounded-xl border bg-card p-5">
          <h2 className="mb-1 text-sm font-semibold">Collection Window</h2>
          <p className="mb-1 text-xs text-muted-foreground">
            Set a final date and time by which an NGO must collect this batch.
          </p>
          <p className="mb-3 text-[11px] text-muted-foreground/80 leading-relaxed">
            After an NGO claims your donation, they typically arrange collection within{" "}
            <strong className="text-foreground">2–24 hours</strong>. Choose a deadline that gives
            enough time for pickup while the food is still fresh.
          </p>
          <DateTimePicker
            value={collectionDateTime}
            onChange={setCollectionDateTime}
            maxDate={earliestExpiryDate}
          />
        </section>

        {/* Error message */}
        {error && (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate({ to: "/donor/donate/batch" })}
            className="rounded-md border px-6 py-2 text-sm font-medium hover:bg-secondary transition-colors"
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={items.length === 0 || isSubmitting}
            className="flex-1 rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Submitting…" : "Submit Donation"}
          </button>
        </div>
      </main>
    </>
  );
}
