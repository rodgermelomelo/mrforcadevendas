import { createFileRoute, redirect } from "@tanstack/react-router";

/** Estoque foi unificado em /admin/produtos (aba Estoque no detalhe do produto). */
export const Route = createFileRoute("/_authenticated/admin/estoque")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/produtos" });
  },
});
