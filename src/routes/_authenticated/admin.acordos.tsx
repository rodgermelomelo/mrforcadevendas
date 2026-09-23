import { createFileRoute, redirect } from "@tanstack/react-router";

/** Acordos virou uma aba da página unificada de Descontos & Acordos. */
export const Route = createFileRoute("/_authenticated/admin/acordos")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/descontos" });
  },
});
