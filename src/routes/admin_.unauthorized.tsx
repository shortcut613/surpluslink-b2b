import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldAlert, Construction, MoveLeft } from "lucide-react";

export const Route = createFileRoute("/admin_/unauthorized")({
  head: () => ({ meta: [{ title: "Access Denied — SurplusLink" }] }),
  component: AdminUnauthorizedPage,
});

function AdminUnauthorizedPage() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(4);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          navigate({ to: "/" });
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 text-center">
      <div className="pointer-events-none absolute top-0 -left-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-destructive/10 blur-[120px] [animation-duration:8s]" />
      <div className="pointer-events-none absolute bottom-0 -right-1/4 h-[600px] w-[600px] animate-pulse rounded-full bg-amber-500/10 blur-[150px] [animation-duration:12s]" />

      <div className="relative z-10 mx-auto max-w-md">
        <div className="mb-8 flex justify-center space-x-[-1.5rem]">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-100 shadow-xl dark:bg-amber-900/40 z-10 animate-bounce [animation-delay:-0.2s]">
            <Construction className="h-10 w-10 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-destructive/10 shadow-xl dark:bg-destructive/30 animate-bounce">
            <span className="text-5xl">🛑</span>
          </div>
        </div>

        <h1 className="text-4xl font-black tracking-tight text-foreground">
          You're not supposed to be here!
        </h1>

        <p className="mt-4 text-base font-medium text-muted-foreground leading-relaxed">
          You've wandered into the admin restricted zone. <br />
          Nothing to see here unless you like staring at raw database logs.
        </p>

        <div className="mt-10 rounded-2xl border bg-card p-6 shadow-sm">
          <p className="text-sm font-semibold flex items-center justify-center gap-2">
            <MoveLeft className="h-4 w-4 animate-pulse text-primary" />
            Rerouting you back to safety in {countdown}...
          </p>
        </div>
      </div>
    </main>
  );
}
