import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Target, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateSellerGoal } from "@/lib/admin-data.functions";

interface Props {
  erpCode: string;
  sellerName: string;
  currentGoal: number;
}

export function SellerGoalsDialog({ erpCode, sellerName, currentGoal }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentGoal.toString());
  const queryClient = useQueryClient();
  const updateGoal = useServerFn(updateSellerGoal);

  const mutation = useMutation({
    mutationFn: (input: { sellerErpCode: string; month: string; targetValue: number }) => updateGoal({ data: input }),
    onSuccess: async () => {
      toast.success("Meta atualizada com sucesso!");
      await queryClient.invalidateQueries({ queryKey: ["admin", "seller-detail", erpCode] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSave = () => {
    mutation.mutate({
      sellerErpCode: erpCode,
      month: new Date().toISOString().slice(0, 7) + "-01",
      targetValue: Number(value),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-xl gap-2">
          <Target className="h-4 w-4" /> Definir Meta
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Metas: {sellerName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Meta para este mês</Label>
            <Input 
              type="number" 
              value={value} 
              onChange={e => setValue(e.target.value)}
              className="rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={mutation.isPending} className="rounded-xl bg-brand-gradient">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
