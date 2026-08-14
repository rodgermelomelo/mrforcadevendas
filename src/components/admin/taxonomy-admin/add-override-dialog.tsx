import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateTaxonomyOverride } from "@/lib/admin-data.functions";
import { clearBrandHierarchyCache } from "@/features/catalog/use-brand-hierarchy";

export function AddOverrideDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateTaxonomyOverride);
  
  const [categoryName, setCategoryName] = useState("");
  const [targetBrandName, setTargetBrandName] = useState("");

  const mutation = useMutation({
    mutationFn: () => update({ data: { categoryName, targetBrandName } }),
    onSuccess: () => {
      toast.success("Regra de taxonomia criada.");
      clearBrandHierarchyCache();
      queryClient.invalidateQueries({ queryKey: ["admin", "taxonomy-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      setCategoryName("");
      setTargetBrandName("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName || !targetBrandName) {
      toast.error("Preencha todos os campos.");
      return;
    }
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] rounded-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nova Regra de Hierarquia</DialogTitle>
            <DialogDescription>
              Defina para qual marca os produtos de uma categoria específica devem ser agrupados no catálogo.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="category">Nome da Categoria</Label>
              <Input
                id="category"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Ex: BABADO, ESMALTE, AMACIANTE..."
                className="rounded-xl uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Marca Destino</Label>
              <Input
                id="brand"
                value={targetBrandName}
                onChange={(e) => setTargetBrandName(e.target.value)}
                placeholder="Ex: DAILUS, ACEMAR..."
                className="rounded-xl uppercase"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className="rounded-xl bg-brand-gradient text-white"
            >
              {mutation.isPending ? "Salvando..." : "Criar Regra"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}