import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    // Redireciona para /_authenticated/ que é onde reside o dashboard
    throw redirect({ to: "/_authenticated/", replace: true });
  },
});
