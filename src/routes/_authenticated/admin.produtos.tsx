import { createFileRoute, redirect } from "@tanstack/react-router";

/** Produtos foram unificados em /admin/estoque. */
export const Route = createFileRoute("/_authenticated/admin/produtos")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/estoque" });
  },
});


