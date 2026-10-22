import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppHeader } from "@/components/AppHeader";
import { CommunityWalletForm } from "@/components/CommunityWalletForm";
import { requireAuth } from "@/lib/auth-guard";

export const Route = createFileRoute("/community-wallet")({
  component: CommunityWalletPage,
});

function CommunityWalletPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />

      <main className="relative flex min-h-[calc(100vh-56px)] flex-col items-center justify-start overflow-hidden px-4 py-12 sm:py-20">
        {/* Animated Background Blobs */}
        <div className="pointer-events-none absolute -top-1/4 left-0 h-[600px] w-[600px] animate-pulse rounded-full bg-primary/5 blur-[150px] [animation-duration:15s]" />
        <div className="pointer-events-none absolute bottom-0 -right-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-secondary/5 blur-[120px] [animation-duration:10s]" />

        <div className="relative z-10 w-full max-w-4xl">
          <Link
            to="/"
            className="mb-8 inline-flex items-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            &larr; Back to Home
          </Link>
          <header className="mb-10 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Community Wallet</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Fund the logistics that rescue the food
            </p>
          </header>

          <CommunityWalletForm onSuccess={() => navigate({ to: "/" })} />
        </div>
      </main>
    </div>
  );
}
