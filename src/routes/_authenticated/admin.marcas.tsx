import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Search, Plus, Trash2, Box } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listRegistries, updateRegistry, listProducts, type CodeLabelRow } from "@/lib/admin-data.functions";
import { ProductDetailDialog } from "@/components/admin/product-detail-dialog";

export const Route = createFileRoute("/_authenticated/admin/marcas")({
  component: BrandsAdminPage,
  head: () => ({
    meta: [
      { title: "Gestão de Marcas · MR Força de Vendas" },
      { name: "description", content: "Gerencie as marcas dos produtos, ative ou desative sua visibilidade no catálogo." },
      { property: "og:title", content: "Gestão de Marcas · MR Força de Vendas" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BrandsAdminPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listRegistries);
  const save = useServerFn(updateRegistry);
  const [term, setTerm] = useState("");
  const [viewingBrandProducts, setViewingBrandProducts] = useState<string | null>(null);
  const [openProductCode, setOpenProductCode] = useState<string | null>(null);


  const query = useQuery({ 
    queryKey: ["admin", "registries"], 
    queryFn: () => load() 
  });

  const mutation = useMutation({
    mutationFn: (input: { kind: "brands"; code: string; label: string; active: boolean; metadata?: any }) => 
      save({ data: input }),
    onSuccess: async () => {
      toast.success("Marca atualizada.");
      await queryClient.invalidateQueries({ queryKey: ["admin", "registries"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const brands: CodeLabelRow[] = query.data?.brands ?? [];
  const groups = (query.data?.groups ?? []).map(g => ({ code: g.code, label: g.label }));

  const filtered = brands
    .filter((b) => b.code.toLowerCase().includes(term.trim().toLowerCase()))
    .slice(0, 100);


  return (
    <AdminPage
      title="Gestão de Marcas"
      description="Controle a visibilidade das marcas no catálogo. Marcas desativadas ocultam todos os seus produtos para os vendedores."
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar marcas..."
          className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((brand) => (
            <div 
              key={brand.code}
              className={`group flex flex-col gap-4 rounded-2xl border p-5 shadow-sm transition-all hover:shadow-md ${
                brand.active ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-75"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-semibold text-foreground">{brand.code}</h3>
                  <p className="text-xs text-muted-foreground">{brand.label}</p>
                </div>
                <div className="flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full bg-border p-1 transition-colors data-[active=true]:bg-primary"
                     data-active={brand.active}
                     onClick={() => mutation.mutate({
                       kind: "brands",
                       code: brand.code,
                       label: brand.code,
                       active: !brand.active,
                       metadata: brand.metadata
                     })}
                >
                  <div className={`h-4 w-4 rounded-full bg-white transition-transform ${brand.active ? "translate-x-4" : "translate-x-0"}`} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={brand.metadata?.isCategory}
                    onChange={(e) => mutation.mutate({
                      kind: "brands",
                      code: brand.code,
                      label: brand.code,
                      active: brand.active ?? true,
                      metadata: { ...brand.metadata, isCategory: e.target.checked }
                    })}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                  <span className="text-xs font-medium text-muted-foreground">Esta marca é uma Categoria</span>
                </label>
                {brand.metadata?.isCategory && (
                  <p className="text-[10px] text-primary/70 leading-tight">
                    Itens desta "marca" serão tratados como uma categoria organizacional no catálogo.
                  </p>
                )}
              </div>
              
              <div className="flex items-center justify-between border-t border-border/50 pt-3">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${brand.active ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {brand.active ? "Ativa" : "Inativa"}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ERP: {brand.code}
                </span>
              </div>
            </div>
          ))}
          
          {filtered.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-border p-12 text-center">
              <p className="text-sm text-muted-foreground">Nenhuma marca encontrada.</p>
            </div>
          )}
        </div>
      )}
    </AdminPage>
  );
}
