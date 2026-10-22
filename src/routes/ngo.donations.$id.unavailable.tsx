import { createFileRoute, Link } from "@tanstack/react-router";
import { AppHeader, ngoNav } from "@/components/AppHeader"; // kept for type compat — unused after migration

import { ngoSidebarNav } from "@/lib/nav";

import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/ngo/donations/$id/unavailable")({
  head: () => ({ meta: [{ title: "Donation Unavailable — SurplusLink" }] }),
  component: Unavailable,
});

function Unavailable() {
  const { initials } = useAuth();
  return (
    <>
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
          <span className="text-2xl text-destructive">✕</span>
        </div>
        <h1 className="mt-6 text-xl font-semibold">Donation Unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sorry, this donation has already been claimed by another NGO. Please explore other
          available donations.
        </p>
        <Link
          to="/ngo/explore"
          className="mt-6 inline-block rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Back to Donations List
        </Link>
      </main>
    </>
  );
}
