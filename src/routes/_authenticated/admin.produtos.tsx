import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageOff, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { ProductDetailDialog, HealthBadge } from "@/components/admin/product-detail-dialog";
import { listProducts, listRegistries, bulkUpdateProductBrand } from "@/lib/admin-data.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { AlertCircle, Tag, X } from "lucide-react";


export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: ProductsPage,
  head: () => ({
    meta: [
      { title: "Produtos, estoque e preços · MR Força de Vendas" },
      {
        name: "description",
        content: "Central única de produtos: catálogo, quantidade em estoque e os 6 valores por tabela de preço.",
      },
      { property: "og:title", content: "Produtos, estoque e preços · MR Força de Vendas" },
      {
        property: "og:description",
        content: "Gestão unificada do catálogo comercial, estoque do ERP e preços por tabela.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SIZE = 25;

const STOCK_FILTERS = [
  { key: "todos", label: "Estoque: todos" },
  { key: "com_estoque", label: "Com estoque" },
  { key: "sem_estoque", label: "Sem estoque" },
  { key: "negativo", label: "Negativo" },
];

const PRICE_FILTERS = [
  { key: "todos", label: "Preço: todos" },
  { key: "com_preco", label: "Com preço" },
  { key: "sem_preco", label: "Sem preço" },
  { key: "sem_nivel", label: "Tabela sem nível" },
];

const CATALOG_FILTERS = [
  { key: "todos", label: "Catálogo: todos" },
  { key: "liberado", label: "Liberado" },
  { key: "fora", label: "Fora do catálogo" },
  { key: "lancamento", label: "Lançamento" },
  { key: "inativo", label: "Inativo" },
];

const SORTS = [
  { key: "codigo", label: "Código" },
  { key: "nome", label: "Nome" },
  { key: "estoque_desc", label: "Maior estoque" },
  { key: "estoque_asc", label: "Menor estoque" },
];

function ProductsPage() {
  const load = useServerFn(listProducts);
  const loadRegistries = useServerFn(listRegistries);
  const bulkUpdate = useServerFn(bulkUpdateProductBrand);
  const queryClient = useQueryClient();

  const [term, setTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("todos");
  const [priceFilter, setPriceFilter] = useState("todos");
  const [catalogFilter, setCatalogFilter] = useState("todos");
  const [groupCode, setGroupCode] = useState("");
  const [sort, setSort] = useState("codigo");
  const [page, setPage] = useState(0);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [newBrand, setNewBrand] = useState("");


  const reset = () => setPage(0);

  const query = useQuery({
    queryKey: ["admin", "products", term, stockFilter, priceFilter, catalogFilter, groupCode, sort, page],
    queryFn: () => load({ data: { term, page, stockFilter, priceFilter, catalogFilter, groupCode, sort } }),
  });
  const registriesQuery = useQuery({ queryKey: ["admin", "registries"], queryFn: () => loadRegistries() });
  const groups = (registriesQuery.data?.groups ?? []).map((g) => ({ code: g.code, label: `${g.code} · ${g.label}` }));

  const select = "rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary";

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
    onError: (err) => {
      toast.error(err.message || "Erro ao atualizar produtos.");
    },
  });

  const toggleAll = () => {
    if (selectedCodes.length === (query.data?.rows?.length ?? 0)) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(query.data?.rows?.map((r) => r.erpCode) ?? []);
    }
  };

  const toggleOne = (code: string) => {
    setSelectedCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };


  return (
    <AdminPage
      title="Produtos, estoque e preços"
      description="Uma única tela para o catálogo: cada produto mostra a quantidade em estoque (registro 27) e os preços por tabela (registro 28). Clique em um produto para ver o detalhe completo e editar."
      actions={
        <Button asChild variant="outline" className="rounded-xl border-primary/20 text-primary hover:bg-primary/5">
          <Link to="/catalogo">Ver no catálogo</Link>
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              reset();
            }}
            placeholder="Buscar por código ou nome"
            className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            className={select}
            value={stockFilter}
            onChange={(e) => {
              setStockFilter(e.target.value);
              reset();
            }}
          >
            {STOCK_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={priceFilter}
            onChange={(e) => {
              setPriceFilter(e.target.value);
              reset();
            }}
          >
            {PRICE_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={catalogFilter}
            onChange={(e) => {
              setCatalogFilter(e.target.value);
              reset();
            }}
          >
            {CATALOG_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={groupCode}
            onChange={(e) => {
              setGroupCode(e.target.value);
              reset();
            }}
          >
            <option value="">Todos os grupos</option>
            {groups.map((g) => (
              <option key={g.code} value={g.code}>
                {g.label}
              </option>
            ))}
          </select>
          <select
            className={select}
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              reset();
            }}
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key}>
                Ordenar: {s.label}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-muted-foreground">
          {query.isLoading ? "Carregando…" : `${(query.data?.total ?? 0).toLocaleString("pt-BR")} produtos`}
        </p>
      </div>

      {query.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : (query.data?.rows ?? []).length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          Nenhum produto encontrado com esses filtros.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
            <Checkbox
              checked={
                selectedCodes.length > 0 && selectedCodes.length === (query.data?.rows?.length ?? 0)
              }
              onCheckedChange={toggleAll}
            />
            <span className="text-sm font-medium text-muted-foreground">Selecionar todos nesta página</span>
          </div>

          {(query.data?.rows ?? []).map((product) => (
            <div
              key={product.erpCode}
              className="group relative flex items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex h-full items-center pr-1">
                <Checkbox
                  checked={selectedCodes.includes(product.erpCode)}
                  onCheckedChange={() => toggleOne(product.erpCode)}
                />
              </div>
              <button
                type="button"
                onClick={() => setOpenCode(product.erpCode)}
                className="flex flex-1 items-center gap-3 text-left"
              >

              <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-muted">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <ImageOff className="h-4 w-4 text-muted-foreground" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{product.displayName || product.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {product.erpCode} · {product.unit}
                  {product.brand ? ` · ${product.brand}` : ""}
                </span>
                <span className="mt-1.5 flex flex-wrap gap-1.5">
                  <HealthBadge
                    tone={product.stock > 0 ? "ok" : product.stock < 0 ? "bad" : "muted"}
                    label={`Estoque ${product.stock.toLocaleString("pt-BR")}`}
                  />
                  <HealthBadge
                    tone={!product.hasPrice ? "bad" : product.hasUnmappedTable ? "warn" : "ok"}
                    label={
                      !product.hasPrice
                        ? "Sem preço"
                        : product.hasUnmappedTable
                          ? "Tabela sem nível"
                          : `${product.priceTables} tabelas`
                    }
                  />
                  {!product.active ? (
                    <HealthBadge tone="muted" label="Inativo" />
                  ) : !product.released ? (
                    <HealthBadge tone="muted" label="Fora do catálogo" />
                  ) : null}
                  {product.isLaunch && <HealthBadge tone="brand" label="Lançamento" />}
                </span>
              </span>
            </button>
          ))}
          <Pager page={page} total={query.data?.total ?? 0} size={SIZE} onChange={setPage} />
        </div>
      )}

      {query.isFetching && !query.isLoading && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Atualizando…
        </p>
      )}

      <ProductDetailDialog
        erpCode={openCode}
        groups={groups}
        onOpenChange={(open) => {
          if (!open) setOpenCode(null);
        }}
      />
    </AdminPage>
  );
}
