import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Save, ImageOff } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { listProducts, updateProduct, listRegistries, type AdminProduct } from "@/lib/admin-data.functions";

export const Route = createFileRoute("/_authenticated/admin/produtos")({
  component: ProductsPage,
  head: () => ({
    meta: [
      { title: "Produtos · MR Força de Vendas" },
      { name: "description", content: "Libere produtos no catálogo, marque lançamentos e enriqueça nome e imagem." },
      { property: "og:title", content: "Produtos · MR Força de Vendas" },
      { property: "og:description", content: "Gestão do catálogo comercial e do enriquecimento de produtos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SIZE = 25;

function ProductsPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listProducts);
  const save = useServerFn(updateProduct);
  const loadRegistries = useServerFn(listRegistries);

  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [openCode, setOpenCode] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["admin", "products", term, page],
    queryFn: () => load({ data: { term, page } }),
  });
  const registriesQuery = useQuery({ queryKey: ["admin", "registries"], queryFn: () => loadRegistries() });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof save>[0]["data"]) => save({ data: input }),
    onSuccess: async () => {
      toast.success("Produto atualizado.");
      setOpenCode(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminPage
      title="Produtos"
      description="O catálogo comercial nasce dos produtos liberados pelo ERP. Aqui você ajusta visibilidade, lançamentos e o enriquecimento (nunca apagado pela importação)."
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(0);
          }}
          placeholder="Buscar por código ou nome"
          className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {(query.data?.rows ?? []).map((product) => (
            <div key={product.erpCode} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <button
                type="button"
                onClick={() => setOpenCode(openCode === product.erpCode ? null : product.erpCode)}
                className="flex w-full items-center gap-3 text-left"
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
                    {product.erpCode} · {product.unit} ·{" "}
                    <Link
                      to="/admin/estoque"
                      search={{ term: product.erpCode }}
                      className="text-primary hover:underline"
                    >
                      estoque {product.stock.toLocaleString("pt-BR")} (qnt. disponível)
                    </Link>{" "}
                    · {product.priceTables} tabelas com preço
                  </span>
                </span>
                <span className="flex shrink-0 gap-1.5">
                  {product.isLaunch && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                      Lançamento
                    </span>
                  )}
                  {!product.released && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      Fora do catálogo
                    </span>
                  )}
                </span>
              </button>

              {openCode === product.erpCode && (
                <ProductForm
                  product={product}
                  saving={mutation.isPending}
                  groups={(registriesQuery.data?.groups ?? []).map((g) => ({ code: g.code, label: `${g.code} · ${g.label}` }))}
                  onSave={(patch) => mutation.mutate({ erpCode: product.erpCode, ...patch })}
                />
              )}
            </div>
          ))}
          <Pager page={page} total={query.data?.total ?? 0} size={SIZE} onChange={setPage} />
        </div>
      )}
    </AdminPage>
  );
}

function ProductForm({
  product,
  saving,
  groups,
  onSave,
}: {
  product: AdminProduct;
  saving: boolean;
  groups: { code: string; label: string }[];
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    released: product.released,
    isLaunch: product.isLaunch,
    active: product.active,
    groupCode: product.groupCode ?? "",
    unit: product.unit,
    displayName: product.displayName ?? "",
    imageUrl: product.imageUrl ?? "",
  });

  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  const labelCls = "text-xs font-medium text-muted-foreground";

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">Descrição oficial do ERP: {product.name}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={labelCls}>Nome de exibição</span>
          <input
            className={field}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
            placeholder={product.name}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>URL da imagem</span>
          <input
            className={field}
            value={form.imageUrl}
            onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            placeholder="https://..."
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Grupo</span>
          <select className={field} value={form.groupCode} onChange={(e) => setForm({ ...form, groupCode: e.target.value })}>
            <option value="">Sem grupo</option>
            {groups.map((g) => (
              <option key={g.code} value={g.code}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Unidade</span>
          <input className={field} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.released}
            onChange={(e) => setForm({ ...form, released: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Liberado no catálogo
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isLaunch}
            onChange={(e) => setForm({ ...form, isLaunch: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Lançamento
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Ativo
        </label>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => onSave(form)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar produto
      </button>
    </div>
  );
}
