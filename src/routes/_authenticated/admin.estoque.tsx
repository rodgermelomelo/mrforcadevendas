import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Package,
  Bookmark,
  ChevronRight,
  Settings2,
  Tags,
} from "lucide-react";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductDetailDialog } from "@/components/admin/product-detail-dialog";
import {
  listProducts,
  listRegistries,
} from "@/lib/admin-data.functions";
import { Input } from "@/components/ui/input";
import { CategoriesAdminView } from "@/components/admin/categories-admin-view";
import { TaxonomyList } from "@/components/admin/taxonomy-admin/taxonomy-list";
import { resolveProductImage } from "@/lib/product-images";
import { ImageOff, Box } from "lucide-react";
import { HealthBadge } from "@/components/admin/product-detail-dialog";

export const Route = createFileRoute("/_authenticated/admin/estoque")({
  component: UnifiedEstoquePage,
  head: () => ({
    meta: [
      { title: "Estoque e Produtos · MR Força de Vendas" },
      {
        name: "description",
        content:
          "Gestão unificada de catálogo, estoque, preços e classificação de marcas e categorias.",
      },
      { property: "og:title", content: "Estoque e Produtos · MR Força de Vendas" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SIZE = 25;

function UnifiedEstoquePage() {
  const loadProducts = useServerFn(listProducts);
  const loadRegistries = useServerFn(listRegistries);

  const [activeTab, setActiveTab] = useState("produtos");
  const [productTerm, setProductTerm] = useState("");
  const [page, setPage] = useState(0);
  const [openProductCode, setOpenProductCode] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["admin", "products", productTerm, page],
    queryFn: () => loadProducts({ data: { term: productTerm, page } }),
    enabled: activeTab === "produtos",
  });

  const registriesQuery = useQuery({
    queryKey: ["admin", "registries"],
    queryFn: () => loadRegistries(),
  });

  const groups = (registriesQuery.data?.groups ?? []).map((g) => ({
    code: g.code,
    label: `${g.code} · ${g.label}`,
  }));

  return (
    <AdminPage
      title="Estoque e Produtos"
      description="Gestão unificada de catálogo, estoque, preços e classificação de marcas e categorias."
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted p-1 w-full sm:w-auto overflow-x-auto justify-start flex-nowrap">
          <TabsTrigger
            value="produtos"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Package className="h-4 w-4" /> Produtos
          </TabsTrigger>
          <TabsTrigger
            value="marcas"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Bookmark className="h-4 w-4" /> Marcas ERP
          </TabsTrigger>
          <TabsTrigger
            value="categorias"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Tags className="h-4 w-4" /> Categorias
          </TabsTrigger>
          <TabsTrigger
            value="taxonomia"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Settings2 className="h-4 w-4" /> Regras de Hierarquia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4">
          <div className="relative">
            <Input
              value={productTerm}
              onChange={(e) => {
                setProductTerm(e.target.value);
                setPage(0);
              }}
              placeholder="Buscar produtos por código ou nome..."
              className="rounded-xl border-border bg-card shadow-sm"
            />
          </div>

          {productsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(productsQuery.data?.rows ?? []).map((product) => (
                <button
                  key={product.erpCode}
                  onClick={() => setOpenProductCode(product.erpCode)}
                  className="flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40"
                >
                  <div className="h-12 w-12 shrink-0 rounded-xl bg-muted flex items-center justify-center overflow-hidden">
                    {resolveProductImage(product) ? (
                      <img
                        src={resolveProductImage(product) ?? ""}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageOff className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">
                      {product.displayName || product.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {product.erpCode} · {product.unit} · {product.brand || "Sem Marca"}
                    </p>
                    <div className="mt-1 flex gap-2">
                      <HealthBadge
                        tone={product.stock > 0 ? "ok" : "muted"}
                        label={`Estoque ${product.stock}`}
                      />
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </button>
              ))}
              <Pager
                page={page}
                total={productsQuery.data?.total ?? 0}
                size={SIZE}
                onChange={setPage}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="marcas">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(registriesQuery.data?.brands ?? []).map((brand) => (
              <div
                key={brand.code}
                className="rounded-2xl border border-border bg-card p-5 shadow-sm"
              >
                <h3 className="font-semibold">{brand.code}</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {brand.productCount} produtos vinculados originalmente no ERP
                </p>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="categorias">
          <CategoriesAdminView />
        </TabsContent>

        <TabsContent value="taxonomia" className="space-y-4">
          <div className="rounded-2xl border border-info/20 bg-info/5 p-4 text-sm text-info-foreground mb-4">
            <p className="font-semibold flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Sobre as Regras de Hierarquia
            </p>
            <p className="mt-1 opacity-90">
              Estas regras forçam o agrupamento de produtos de uma determinada **Categoria** dentro de uma **Marca** específica no catálogo comercial. 
              Útil quando o ERP envia categorias genéricas que pertencem a uma marca principal.
            </p>
          </div>
          <TaxonomyList />
        </TabsContent>
      </Tabs>

      <ProductDetailDialog
        erpCode={openProductCode}
        groups={groups}
        onOpenChange={(open) => !open && setOpenProductCode(null)}
      />
    </AdminPage>
  );
}