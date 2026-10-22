import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

export const Route = createFileRoute("/update-password")({
  head: () => ({
    meta: [{ title: "Update Password — SurplusLink" }],
  }),
  component: UpdatePassword,
});

const updatePasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

type UpdatePasswordForm = z.infer<typeof updatePasswordSchema>;

function UpdatePassword() {
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordForm>({
    resolver: zodResolver(updatePasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  useEffect(() => {
    // 1. Check URL hash for direct Supabase recovery errors (e.g., expired token)
    const hash = window.location.hash;
    if (hash.includes("error_description=")) {
      const params = new URLSearchParams(hash.replace("#", "?"));
      const description = params.get("error_description");
      if (description) {
        setErrorMsg(decodeURIComponent(description.replace(/\+/g, " ")));
        setLoadingSession(false);
        return;
      }
    }

    // 2. Listen for Supabase recovery auth event when the hash token is processed
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setIsSessionReady(true);
      } else {
        setIsSessionReady(false);
      }
      setLoadingSession(false);
    });

    // 3. Fallback check for existing session
    const timeoutPromise = new Promise<{ data: { session: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { session: null } }), 1000),
    );
    Promise.race([supabase.auth.getSession(), timeoutPromise])
      .then(({ data: { session } }) => {
        if (session) {
          setIsSessionReady(true);
        }
        setLoadingSession(false);
      })
      .catch(() => {
        setLoadingSession(false);
      });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleUpdatePassword(data: UpdatePasswordForm) {
    setErrorMsg("");
    setSuccessMsg("");

    // Verify session explicitly before submitting
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      setErrorMsg("Auth session missing or link expired. Please request a new reset link.");
      return;
    }

    const { error } = await supabase.auth.updateUser({
      password: data.password,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg("Password updated successfully! Redirecting to login...");

    setTimeout(async () => {
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    }, 2000);
  }

  if (loadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-sm text-muted-foreground">Verifying reset session...</div>
      </main>
    );
  }

  if (!isSessionReady && !errorMsg) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm space-y-4 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-destructive">
            Invalid or Expired Link
          </h1>
          <p className="text-xs text-muted-foreground">
            Your password reset link is invalid or has expired. Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-block text-xs font-medium text-primary hover:underline"
          >
            Request New Reset Link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-transition flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">SurplusLink</h1>
          <h2 className="text-sm text-muted-foreground mt-1">Set Your New Password</h2>
        </div>

        {errorMsg && (
          <div className="rounded-md bg-destructive/15 p-3 text-xs text-destructive">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div className="rounded-md bg-emerald-500/15 p-3 text-xs text-emerald-600 font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit(handleUpdatePassword)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">New Password</label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("password")}
              className={`w-full rounded-md border bg-background p-2 text-sm outline-none focus:ring-1 transition-colors ${
                errors.password
                  ? "border-destructive focus:ring-destructive focus:border-destructive"
                  : "border-input focus:border-ring focus:ring-ring"
              }`}
            />
            {errors.password && (
              <p className="mt-1 text-[11px] text-destructive leading-tight">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Confirm New Password
            </label>
            <input
              type="password"
              placeholder="••••••••"
              {...register("confirmPassword")}
              className={`w-full rounded-md border bg-background p-2 text-sm outline-none focus:ring-1 transition-colors ${
                errors.confirmPassword
                  ? "border-destructive focus:ring-destructive focus:border-destructive"
                  : "border-input focus:border-ring focus:ring-ring"
              }`}
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-[11px] text-destructive leading-tight">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !isSessionReady}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </div>
    </main>
  );
}
