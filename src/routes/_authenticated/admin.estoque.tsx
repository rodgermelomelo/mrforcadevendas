import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageOff, Loader2, Search, Package, Bookmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CategoriesAdminView } from "@/components/admin/categories-admin-view";

export const Route = createFileRoute("/_authenticated/admin/estoque")({
  component: UnifiedEstoquePage,
});

const SIZE = 25;

function UnifiedEstoquePage() {
  const load = useServerFn(listProducts);
  const loadRegistries = useServerFn(listRegistries);
  const bulkUpdate = useServerFn(bulkUpdateProductBrand);
  const queryClient = useQueryClient();

  const [term, setTerm] = useState("");
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [newBrand, setNewBrand] = useState("");
  const [viewingBrandCategories, setViewingBrandCategories] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const query = useQuery({
    queryKey: ["admin", "products", term, page],
    queryFn: () => load({ data: { term, page } }),
  });
  
  const registriesQuery = useQuery({ queryKey: ["admin", "registries"], queryFn: () => loadRegistries() });
  const groups = (registriesQuery.data?.groups ?? []).map((g) => ({ code: g.code, label: `${g.code} · ${g.label}` }));

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
  });

  return (
    <AdminPage
      title="Estoque e Produtos"
      description="Gestão unificada de catálogo, estoque, preços e classificação de marcas e categorias."
    >
      <Tabs defaultValue="produtos" className="space-y-6">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="produtos" className="flex items-center gap-2">
            <Package className="h-4 w-4" /> Produtos e Estoque
          </TabsTrigger>
          <TabsTrigger value="marcas" className="flex items-center gap-2">
            <Bookmark className="h-4 w-4" /> Marcas e Categorias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Buscar produtos..."
              className="pl-10 rounded-2xl"
            />
          </div>
          
          {query.isLoading ? (
            <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>
          ) : (
            <div className="space-y-2">
              {(query.data?.rows ?? []).map(product => (
                <div key={product.erpCode} className="flex items-center gap-3 p-4 bg-card rounded-2xl border">
                  <Checkbox 
                    checked={selectedCodes.includes(product.erpCode)}
                    onCheckedChange={() => setSelectedCodes(prev => prev.includes(product.erpCode) ? prev.filter(c => c !== product.erpCode) : [...prev, product.erpCode])}
                  />
                  <button className="flex-1 flex items-center gap-3 text-left" onClick={() => setOpenCode(product.erpCode)}>
                    <div className="h-12 w-12 rounded-xl bg-muted overflow-hidden flex items-center justify-center">
                      {product.imageUrl ? <img src={product.imageUrl} className="h-full w-full object-cover" /> : <ImageOff className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div>
                      <p className="font-semibold">{product.displayName || product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.erpCode} · {product.brand}</p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="marcas">
          {/* Mover conteúdo de admin.marcas aqui */}
          <div className="p-8 rounded-2xl border border-dashed text-center text-muted-foreground">
            A interface de Marcas e Categorias está sendo movida para cá.
          </div>
        </TabsContent>
      </Tabs>

      <ProductDetailDialog
        erpCode={openCode}
        groups={groups}
        onOpenChange={(open) => !open && setOpenCode(null)}
      />
    </AdminPage>
  );
}
