import { createFileRoute, redirect } from "@tanstack/react-router";

/** Preços foram unificados em /admin/produtos (aba Preços no detalhe do produto). */
export const Route = createFileRoute("/_authenticated/admin/precos")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/produtos" });
  },
});
