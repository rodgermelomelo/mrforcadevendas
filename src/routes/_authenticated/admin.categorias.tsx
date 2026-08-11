import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminPage } from "@/components/admin/admin-page";
import { CategoriesAdminView } from "@/components/admin/categories-admin-view";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: AdminCategoriesPage,
  head: () => ({
    meta: [
      { title: "Gestão de Categorias · MR Força de Vendas" },
      { name: "description", content: "Revise e ajuste as categorias dos produtos importados do ERP." },
    ],
  }),
});

function AdminCategoriesPage() {
  return (
    <AdminPage
      title="Gestão de Categorias"
      description="Revise e ajuste manualmente as categorias sugeridas pelo importador ERP para cada produto."
      actions={
        <Button asChild variant="ghost" className="rounded-xl">
          <Link to="/admin/marcas">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar para Marcas
          </Link>
        </Button>
      }
    >
      <CategoriesAdminView />
    </AdminPage>
  );
}
