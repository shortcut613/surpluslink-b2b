import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { ShieldAlert, Loader2 } from "lucide-react";

export const Route = createFileRoute("/admin_/login")({
  beforeLoad: ({ context }) => {
    if (context.auth?.user && context.auth?.role === "admin") {
      throw redirect({ to: "/admin/dashboard" });
    }
  },
  head: () => ({ meta: [{ title: "Admin Login — SurplusLink" }] }),
  component: AdminLoginPage,
});

function AdminLoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accessCode, setAccessCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    if (mode === "register") {
      if (accessCode !== "admin123") {
        toast.error("Invalid Admin Access Code.");
        setLoading(false);
        return;
      }

      // Try to sign in first in case they already have a donor/NGO account
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInData.user) {
        // They exist! Upgrade their account to admin
        await supabase.auth.updateUser({
          data: { role: "admin", full_name: name, access_code: accessCode },
        });
        // Ensure they are in the public.admins table
        await supabase
          .from("admins")
          .upsert({ id: signInData.user.id, email: signInData.user.email, full_name: name });

        setLoading(false);
        toast.success("Account upgraded to Admin! Welcome to the dashboard.");
        navigate({ to: "/admin/dashboard" });
        return;
      }

      // If sign in failed, proceed with normal sign up
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            role: "admin",
            full_name: name,
            access_code: accessCode,
          },
        },
      });

      setLoading(false);

      if (error) {
        toast.error(error.message);
        return;
      }

      if (data.user && !data.session) {
        toast.success("Confirmation email sent! Please check your inbox.");
      } else {
        toast.success("Admin account created! Welcome to the dashboard.");
        navigate({ to: "/admin/dashboard" });
      }
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const role = data.user?.user_metadata?.role;
    if (role !== "admin") {
      toast.error("Unauthorized access. Admin privileges required.");
      navigate({ to: "/admin/unauthorized" });
      return;
    }

    toast.success("Welcome to the Admin Dashboard");
    navigate({ to: "/admin/dashboard" });
  }

  return (
    <main className="page-transition relative flex min-h-screen items-center justify-center bg-background overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute top-0 -left-1/4 h-[500px] w-[500px] animate-pulse rounded-full bg-primary/10 blur-[120px] [animation-duration:8s]" />
      <div className="pointer-events-none absolute bottom-0 -right-1/4 h-[600px] w-[600px] animate-pulse rounded-full bg-blue-500/10 blur-[150px] [animation-duration:12s]" />

      <div className="relative w-full max-w-sm rounded-3xl glass-lg p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "login" ? "Admin Login" : "Admin Registration"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login" ? "Sign in to manage the platform" : "Create a new master account"}
          </p>
        </div>

        {/* Mode Toggle */}
        <div className="mb-6 flex rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setMode("login")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
              mode === "login"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode("register")}
            className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-all ${
              mode === "register"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:border-ring focus:ring-ring transition-colors"
                placeholder="Admin Name"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:border-ring focus:ring-ring transition-colors"
              placeholder="admin@surpluslink.co.za"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-foreground">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:border-ring focus:ring-ring transition-colors"
              placeholder="••••••••"
            />
          </div>

          {mode === "register" && (
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground flex items-center justify-between">
                <span>Access Code</span>
                <span className="text-[10px] text-muted-foreground">Required</span>
              </label>
              <input
                type="password"
                required
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:border-ring focus:ring-ring transition-colors"
                placeholder="Master Key"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full flex items-center justify-center rounded-xl bg-primary py-2.5 text-sm font-semibold text-primary-foreground shadow-md hover:bg-primary/90 transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              "Sign In"
            ) : (
              "Register Account"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}
