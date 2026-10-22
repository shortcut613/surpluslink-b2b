import { createFileRoute, Link } from "@tanstack/react-router";
import { ngoSidebarNav } from "@/lib/nav";

export const Route = createFileRoute("/ngo/not-verified")({
  head: () => ({ meta: [{ title: "Account Not Verified — SurplusLink" }] }),
  component: NotVerified,
});

function NotVerified() {
  return (
    <>
      <main className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
          <span className="text-2xl">⊘</span>
        </div>
        <h1 className="mt-6 text-xl font-semibold">Account Not Verified</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your NGO account is not verified yet. Please complete the verification process before
          claiming donations.
        </p>
        <Link
          to="/ngo/verification"
          className="mt-6 block w-full rounded-md bg-primary py-2 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Go to Verification
        </Link>
        <Link
          to="/ngo/dashboard"
          className="mt-3 block text-xs text-muted-foreground hover:text-foreground"
        >
          Back to Dashboard
        </Link>
      </main>
    </>
  );
}
