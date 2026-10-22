import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Forgot Password — SurplusLink" }],
  }),
  component: ForgotPassword,
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

function ForgotPassword() {
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function handleResetPassword(data: ForgotPasswordForm) {
    setErrorMsg("");
    setSuccessMsg("");

    const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    setSuccessMsg("Password reset link sent! Check your inbox for further instructions.");
  }

  return (
    <main className="page-transition flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 shadow-sm space-y-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">SurplusLink</h1>
          <h2 className="text-sm text-muted-foreground mt-1">Reset Your Password</h2>
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

        <form onSubmit={handleSubmit(handleResetPassword)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Email Address</label>
            <input
              type="email"
              placeholder="name@example.com"
              {...register("email")}
              className={`w-full rounded-md border bg-background p-2 text-sm outline-none focus:ring-1 transition-colors ${
                errors.email
                  ? "border-destructive focus:ring-destructive focus:border-destructive"
                  : "border-input focus:border-ring focus:ring-ring"
              }`}
            />
            {errors.email && (
              <p className="mt-1 text-[11px] text-destructive leading-tight">
                {errors.email.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? "Sending link..." : "Send Reset Link"}
          </button>
        </form>

        <div className="text-center text-xs text-muted-foreground pt-2">
          Remembered your password?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Back to Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
