import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ImageOff,
  Loader2,
  Search,
  Package,
  Bookmark,
  Tag,
  Box,
  Plus,
  Trash2,
  ArrowRight,
  AlertCircle,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProductDetailDialog, HealthBadge } from "@/components/admin/product-detail-dialog";
import {
  listProducts,
  listRegistries,
  updateRegistry,
  bulkUpdateProductBrand,
  type CodeLabelRow,
} from "@/lib/admin-data.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoriesAdminView } from "@/components/admin/categories-admin-view";
import { resolveProductImage } from "@/lib/product-images";

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
  const queryClient = useQueryClient();
  const loadProducts = useServerFn(listProducts);
  const loadRegistries = useServerFn(listRegistries);
  const saveRegistry = useServerFn(updateRegistry);
  const bulkUpdate = useServerFn(bulkUpdateProductBrand);

  const [activeTab, setActiveTab] = useState("produtos");
  const [productTerm, setProductTerm] = useState("");
  const [brandTerm, setBrandTerm] = useState("");
  const [page, setPage] = useState(0);
  const [openProductCode, setOpenProductCode] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [newBrand, setNewBrand] = useState("");

  // States from admin.marcas
  const [viewingBrandProducts, setViewingBrandProducts] = useState<string | null>(null);
  const [viewingBrandCategories, setViewingBrandCategories] = useState<string | null>(null);

  const productsQuery = useQuery({
    queryKey: ["admin", "products", productTerm, page],
    queryFn: () => loadProducts({ data: { term: productTerm, page } }),
    enabled: activeTab === "produtos",
  });

  const registriesQuery = useQuery({
    queryKey: ["admin", "registries"],
    queryFn: () => loadRegistries(),
  });

  const registryMutation = useMutation({
    mutationFn: (input: {
      kind: "brands";
      code: string;
      label: string;
      active: boolean;
      metadata?: Record<string, unknown> | undefined;
    }) => saveRegistry({ data: input }),
    onSuccess: async () => {
      toast.success("Marca atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "registries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkMutation = useMutation({
    mutationFn: (brand: string) => bulkUpdate({ data: { erpCodes: selectedCodes, brand } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "registries"] });
      toast.success(`${selectedCodes.length} produtos atualizados.`);
      setSelectedCodes([]);
      setBulkDialogOpen(false);
      setNewBrand("");
    },
    onError: (err) => toast.error(err.message),
  });

  const groups = (registriesQuery.data?.groups ?? []).map((g) => ({
    code: g.code,
    label: `${g.code} · ${g.label}`,
  }));
  const brands = registriesQuery.data?.brands ?? [];
  const mainBrands = brands.filter((b) => !b.metadata?.isCategory);
  const categories = brands.filter((b) => b.metadata?.isCategory);

  const filteredBrands = mainBrands
    .filter((b) => b.code.toLowerCase().includes(brandTerm.trim().toLowerCase()))
    .sort((a, b) => a.code.localeCompare(b.code))
    .slice(0, 100);

  return (
    <AdminPage
      title="Estoque e Produtos"
      description="Gestão unificada de catálogo, estoque, preços e classificação de marcas e categorias."
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted p-1">
          <TabsTrigger
            value="produtos"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Package className="h-4 w-4" /> Produtos e Estoque
          </TabsTrigger>
          <TabsTrigger
            value="marcas"
            className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Bookmark className="h-4 w-4" /> Marcas e Categorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={productTerm}
                onChange={(e) => {
                  setProductTerm(e.target.value);
                  setPage(0);
                }}
                placeholder="Buscar produtos por código ou nome..."
                className="pl-10 rounded-2xl border-border bg-card shadow-sm transition-all focus:border-primary"
              />
            </div>
            <Button
              asChild
              variant="outline"
              className="rounded-xl border-primary/20 text-primary hover:bg-primary/5"
            >
              <Link to="/catalogo">Ver no catálogo</Link>
            </Button>
          </div>

          {productsQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : (productsQuery.data?.rows ?? []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
                <Checkbox
                  checked={
                    selectedCodes.length > 0 &&
                    selectedCodes.length === (productsQuery.data?.rows?.length ?? 0)
                  }
                  onCheckedChange={() => {
                    if (selectedCodes.length === (productsQuery.data?.rows?.length ?? 0))
                      setSelectedCodes([]);
                    else setSelectedCodes(productsQuery.data?.rows?.map((r) => r.erpCode) ?? []);
                  }}
                />
                <span className="text-sm font-medium text-muted-foreground">
                  Selecionar todos nesta página
                </span>
              </div>

              {(productsQuery.data?.rows ?? []).map((product) => (
                <div
                  key={product.erpCode}
                  className="group relative flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="flex h-full items-center pr-1">
                    <Checkbox
                      checked={selectedCodes.includes(product.erpCode)}
                      onCheckedChange={() =>
                        setSelectedCodes((prev) =>
                          prev.includes(product.erpCode)
                            ? prev.filter((c) => c !== product.erpCode)
                            : [...prev, product.erpCode],
                        )
                      }
                    />
                  </div>
                  <button
                    className="flex flex-1 items-center gap-3 text-left"
                    onClick={() => setOpenProductCode(product.erpCode)}
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
                        {product.erpCode} · {product.unit}
                        {product.brand ? ` · ${product.brand}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <HealthBadge
                          tone={product.stock > 0 ? "ok" : product.stock < 0 ? "bad" : "muted"}
                          label={`Estoque ${product.stock.toLocaleString("pt-BR")}`}
                        />
                        <HealthBadge
                          tone={
                            !product.hasPrice ? "bad" : product.hasUnmappedTable ? "warn" : "ok"
                          }
                          label={!product.hasPrice ? "Sem preço" : `${product.priceTables} tabelas`}
                        />
                      </div>
                    </div>
                  </button>
                </div>
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

        <TabsContent value="marcas" className="space-y-6">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={brandTerm}
              onChange={(e) => setBrandTerm(e.target.value)}
              placeholder="Buscar marcas..."
              className="pl-10 rounded-2xl border-border bg-card shadow-sm transition-all focus:border-primary"
            />
          </div>

          {registriesQuery.isLoading ? (
            <div className="grid place-items-center py-16">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredBrands.map((brand) => (
                <div
                  key={brand.code}
                  onClick={() => setViewingBrandProducts(brand.code)}
                  className={`group flex flex-col gap-4 rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md cursor-pointer ${
                    brand.active
                      ? "border-border bg-card"
                      : "border-border/50 bg-muted/30 opacity-75"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-foreground">{brand.code}</h3>
                      <p className="text-xs text-muted-foreground">{brand.productCount} produtos</p>
                    </div>
                    <div
                      className="flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-border p-1 transition-colors data-[active=true]:bg-primary"
                      data-active={brand.active}
                      onClick={(e) => {
                        e.stopPropagation();
                        registryMutation.mutate({
                          kind: "brands",
                          code: brand.code,
                          label: brand.code,
                          active: !brand.active,
                          metadata: brand.metadata,
                        });
                      }}
                    >
                      <div
                        className={`h-4 w-4 rounded-full bg-white transition-transform ${brand.active ? "translate-x-4" : "translate-x-0"}`}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Categorias Vinculadas
                        </label>
                        <span className="text-[10px] font-medium text-primary">
                          {categories.filter((c) => c.metadata?.parentBrand === brand.code).length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {categories
                          .filter((c) => c.metadata?.parentBrand === brand.code)
                          .map((cat) => (
                            <div
                              key={cat.code}
                              className="flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-foreground"
                            >
                              <Tag className="h-2.5 w-2.5 text-primary/70" />
                              {cat.code}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  registryMutation.mutate({
                                    kind: "brands",
                                    code: cat.code,
                                    label: cat.code,
                                    active: cat.active ?? true,
                                    metadata: {
                                      ...cat.metadata,
                                      parentBrand: null,
                                      isCategory: false,
                                    },
                                  });
                                }}
                                className="ml-1 text-muted-foreground hover:text-destructive"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/50 pt-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewingBrandCategories(brand.code);
                      }}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
                    >
                      <Tag className="h-3.5 w-3.5" /> Gerenciar Categorias
                    </button>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider ${brand.active ? "text-emerald-600" : "text-muted-foreground"}`}
                    >
                      {brand.active ? "Ativa" : "Inativa"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Floating Action Bar for Products */}
      {selectedCodes.length > 0 && activeTab === "produtos" && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border border-primary/20 bg-white/90 p-2 shadow-2xl backdrop-blur-md dark:bg-zinc-900/90 md:gap-6 md:p-3">
          <div className="flex items-center gap-2 pl-3 pr-2 md:pl-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
              {selectedCodes.length}
            </span>
            <span className="hidden text-sm font-medium text-foreground md:inline">
              selecionados
            </span>
          </div>
          <div className="h-8 w-px bg-border" />
          <Button
            onClick={() => setBulkDialogOpen(true)}
            className="h-10 rounded-full bg-brand-gradient px-4 font-semibold text-white shadow-lg transition hover:scale-105 active:scale-95 md:px-6"
          >
            <Tag className="mr-2 h-4 w-4" /> Editar Marca
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedCodes([])}
            className="h-10 w-10 rounded-full hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      )}

      {/* Dialogs */}
      <ProductDetailDialog
        erpCode={openProductCode}
        groups={groups}
        onOpenChange={(open) => !open && setOpenProductCode(null)}
      />

      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Editar marca em lote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 rounded-xl bg-primary/5 p-3 text-sm text-primary">
              <AlertCircle className="h-4 w-4" />
              Esta ação atualizará {selectedCodes.length} produtos simultaneamente.
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Nova Marca</Label>
              <Input
                id="brand"
                value={newBrand}
                onChange={(e) => setNewBrand(e.target.value)}
                placeholder="Ex: Dailus, Acemar..."
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setBulkDialogOpen(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => bulkMutation.mutate(newBrand)}
              disabled={bulkMutation.isPending}
              className="rounded-xl bg-brand-gradient text-white"
            >
              {bulkMutation.isPending ? "Salvando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!viewingBrandCategories}
        onOpenChange={(open) => !open && setViewingBrandCategories(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col rounded-2xl">
          <DialogHeader>
            <DialogTitle>Gestão de Categorias: {viewingBrandCategories}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 py-4">
            <CategoriesAdminView filterBrand={viewingBrandCategories ?? undefined} />
          </div>
        </DialogContent>
      </Dialog>

      <BrandProductsDialog
        brandName={viewingBrandProducts}
        onOpenChange={(open) => !open && setViewingBrandProducts(null)}
        onOpenProduct={setOpenProductCode}
      />
    </AdminPage>
  );
}

function BrandProductsDialog({
  brandName,
  onOpenChange,
  onOpenProduct,
}: {
  brandName: string | null;
  onOpenChange: (open: boolean) => void;
  onOpenProduct: (code: string) => void;
}) {
  const load = useServerFn(listProducts);
  const query = useQuery({
    queryKey: ["admin", "brand-products", brandName],
    queryFn: () => load({ data: { term: brandName ?? "", page: 0 } }),
    enabled: !!brandName,
  });

  const products = (query.data?.rows ?? []).filter(
    (p) => p.brand === brandName || p.erpCode === brandName,
  );

  return (
    <Dialog open={!!brandName} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col rounded-2xl">
        <DialogHeader>
          <DialogTitle>Produtos da Marca: {brandName}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto pr-2 pt-4">
          {query.isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhum produto encontrado.
            </div>
          ) : (
            <div className="grid gap-2">
              {products.map((product) => (
                <button
                  key={product.erpCode}
                  onClick={() => onOpenProduct(product.erpCode)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
                >
                  <div className="h-10 w-10 shrink-0 rounded-lg bg-muted flex items-center justify-center overflow-hidden">
                    {resolveProductImage(product) ? (
                      <img
                        src={resolveProductImage(product) ?? ""}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Box className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {product.displayName || product.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {product.erpCode} · {product.unit}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-semibold">{product.stock} em estoque</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
