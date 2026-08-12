import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: async ({ context }) => {
    // Se estiver logado, vai direto para o catálogo que é a página principal de vendas
    if ((context as any).auth?.session) {
      throw redirect({ to: "/catalogo" });
    }
    // Senão, vai para o login
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});

