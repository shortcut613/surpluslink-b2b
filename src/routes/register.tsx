import { createFileRoute } from "@tanstack/react-router";
import { AuthPage } from "@/components/AuthPage";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [{ title: "Create Account — SurplusLink" }],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  return <AuthPage defaultMode="register" />;
}
