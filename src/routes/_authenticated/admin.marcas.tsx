import { createFileRoute, redirect } from "@tanstack/react-router";

/** Marcas foram unificadas em /admin/estoque. */
export const Route = createFileRoute("/_authenticated/admin/marcas")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/estoque" });
  },
});
