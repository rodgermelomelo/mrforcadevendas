import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: Index,
});

function Index() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">MR Força de Vendas</h1>
      <p className="mt-4">Redirecionando para o painel...</p>
    </div>
  );
}
