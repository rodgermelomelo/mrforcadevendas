import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { 
  Plus, 
  Trash2, 
  Tag, 
  Bookmark, 
  Loader2, 
  AlertCircle,
  Search
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listTaxonomyOverrides,
  deleteTaxonomyOverride,
} from "@/lib/admin-data.functions";
import { AddOverrideDialog } from "./add-override-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function TaxonomyList() {
  const queryClient = useQueryClient();
  const list = useServerFn(listTaxonomyOverrides);
  const remove = useServerFn(deleteTaxonomyOverride);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["admin", "taxonomy-overrides"],
    queryFn: () => list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Regra removida.");
      clearBrandHierarchyCache();
      queryClient.invalidateQueries({ queryKey: ["admin", "taxonomy-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setDeletingId(null),
  });

  const filtered = (overrides ?? []).filter(o => 
    o.categoryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    o.targetBrandName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por categoria ou marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 rounded-xl"
          />
        </div>
        <Button 
          onClick={() => setIsAddOpen(true)}
          className="rounded-xl bg-brand-gradient text-white shadow-sm"
        >
          <Plus className="mr-2 h-4 w-4" /> Nova Regra
        </Button>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <h3 className="mt-4 font-semibold text-foreground">Nenhuma regra encontrada</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchTerm ? "Tente outro termo de busca." : "Crie sua primeira regra de hierarquia."}
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((override) => (
            <div 
              key={override.id}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition-all hover:shadow-md"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Tag className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Categoria
                  </span>
                </div>
                <h4 className="mt-0.5 font-bold text-foreground">{override.categoryName}</h4>
                
                <div className="mt-3 flex items-center gap-2">
                  <Bookmark className="h-3 w-3 text-emerald-500" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Mover para Marca
                  </span>
                </div>
                <p className="mt-0.5 text-sm font-semibold text-emerald-600">{override.targetBrandName}</p>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeletingId(override.id)}
                className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <AddOverrideDialog 
        open={isAddOpen} 
        onOpenChange={setIsAddOpen} 
      />

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra?</AlertDialogTitle>
            <AlertDialogDescription>
              A hierarquia para esta categoria voltará a ser definida pelo padrão do ERP ou heurísticas de importação.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}