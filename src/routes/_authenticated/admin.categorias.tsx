import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  Loader2, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  Tag
} from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { listProducts, updateProduct } from "@/lib/admin-data.functions";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/categorias")({
  component: AdminCategoriesPage,
  head: () => ({
    meta: [
      { title: "Gestão de Categorias · MR Força de Vendas" },
      { name: "description", content: "Revise e ajuste as categorias dos produtos importados do ERP." },
    ],
  }),
});

const PAGE_SIZE = 25;

function AdminCategoriesPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listProducts);
  const updateFn = useServerFn(updateProduct);
  
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [filterBrand, setFilterBrand] = useState("todos");
  
  const COMMON_CATEGORIES = [
    "AMACIANTE", "AMOLECEDOR", "BASE", "BATOM", "BLUSH", "ESMALTE", 
    "PINCEL", "PÓ COMPACTO", "CORRETIVO", "ILUMINADOR", "MÁSCARA", 
    "DELINEADOR", "SOMBRA", "REMOVEDOR", "HIDRATANTE", "SABONETE",
    "PERFUME", "COLÔNIA", "BODY SPLASH", "ÓLEO", "SHAMPOO", "CONDICIONADOR",
    "DIVERSOS"
  ].sort();

  const query = useQuery({
    queryKey: ["admin", "products", "categories", term, page, filterBrand],
    queryFn: () => listFn({ data: { term, page, sort: "nome" } }),
  });

  const mutation = useMutation({
    mutationFn: (data: { erpCode: string; category: string }) => 
      updateFn({ data: { erpCode: data.erpCode, category: data.category } as any }),
    onSuccess: () => {
      toast.success("Categoria atualizada com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["admin", "products"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const products = useMemo(() => {
    let list = query.data?.rows ?? [];
    if (filterBrand !== "todos") {
      list = list.filter(p => p.brand === filterBrand);
    }
    return list;
  }, [query.data, filterBrand]);

  const brands = useMemo(() => {
    const all = (query.data?.rows ?? []).map(p => p.brand).filter(Boolean) as string[];
    return Array.from(new Set(all)).sort();
  }, [query.data]);

  return (
    <AdminPage
      title="Gestão de Categorias"
      description="Revise e ajuste manualmente as categorias sugeridas pelo importador ERP para cada produto."
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome..."
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(0);
            }}
            className="pl-9 rounded-xl"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterBrand} onValueChange={setFilterBrand}>
            <SelectTrigger className="w-[180px] rounded-xl">
              <SelectValue placeholder="Filtrar por Marca" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as Marcas</SelectItem>
              {brands.map(b => (
                <SelectItem key={b} value={b}>{b}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : products.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h3 className="mt-4 font-semibold text-foreground">Nenhum produto encontrado</h3>
          <p className="mt-2 text-sm text-muted-foreground">Tente ajustar seus filtros de busca.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map((p) => (
            <div 
              key={p.erpCode}
              className="group flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {p.erpCode}
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-4 bg-primary/10 text-primary border-none">
                    {p.brand || "SEM MARCA"}
                  </Badge>
                </div>
                <h3 className="mt-1 truncate font-semibold text-foreground">{p.displayName || p.name}</h3>
                <div className="mt-2 flex items-center gap-1.5">
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    Categoria atual: <span className="font-bold text-foreground">{(p as any).category || "DIVERSOS"}</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Select 
                  defaultValue={(p as any).category || "DIVERSOS"}
                  onValueChange={(val) => mutation.mutate({ erpCode: p.erpCode, category: val })}
                >
                  <SelectTrigger className="w-[200px] rounded-xl bg-muted/50 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {mutation.isPending && mutation.variables?.erpCode === p.erpCode ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <div className="h-4 w-4">
                    <CheckCircle2 className="h-4 w-4 text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <Pager 
            page={page} 
            total={query.data?.total ?? 0} 
            size={PAGE_SIZE} 
            onChange={setPage} 
          />
        </div>
      )}
    </AdminPage>
  );
}
