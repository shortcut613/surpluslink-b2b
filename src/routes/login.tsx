import { createFileRoute } from "@tanstack/react-router";
import { redirectIfAuthenticated } from "@/lib/auth-guard";
import { AuthPage } from "@/components/AuthPage";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ context }) => redirectIfAuthenticated(context.auth),
  component: LoginPage,
});

function LoginPage() {
  return <AuthPage defaultMode="login" />;
}
