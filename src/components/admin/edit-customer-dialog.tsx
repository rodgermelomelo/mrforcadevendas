import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, Save, X, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Customer } from "@/lib/domain/types";
import { 
  updateCustomer, 
  listPriceTables, 
  listSegments 
} from "@/lib/admin-data.functions";

interface EditCustomerDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditCustomerDialog({ customer, open, onOpenChange }: EditCustomerDialogProps) {
  const queryClient = useQueryClient();
  const update = useServerFn(updateCustomer);
  const getTables = useServerFn(listPriceTables);
  const getSegments = useServerFn(listSegments);

  const [formData, setFormData] = useState({
    priceTableCode: "",
    paymentTerm: "",
    segmentCode: "" as string | null,
    restricted: false,
    restrictionReason: "" as string | null,
    creditLimit: 0,
    minOrderValue: 0,
    active: true,
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        priceTableCode: customer.priceTableCode,
        paymentTerm: customer.paymentTerm,
        segmentCode: customer.segment || null,
        restricted: customer.restricted,
        restrictionReason: customer.restrictionReason || null,
        creditLimit: customer.creditLimit,
        minOrderValue: customer.minOrderValue,
        active: true, // A base Customer não tem active exposto no tipo Customer, mas a listCustomers admin tem. Como estamos editando um Customer da carteira/detail, assumimos active
      });
    }
  }, [customer]);

  const tablesQuery = useQuery({
    queryKey: ["admin", "price-tables"],
    queryFn: () => getTables(),
    enabled: open,
  });

  const segmentsQuery = useQuery({
    queryKey: ["admin", "segments"],
    queryFn: () => getSegments(),
    enabled: open,
  });

  const mutation = useMutation({
    mutationFn: (data: any) => update({ data }),
    onSuccess: () => {
      toast.success("Cliente atualizado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["workspace"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao atualizar cliente");
    },
  });

  if (!customer) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      erpCode: customer.erpCode,
      sellerErpCode: customer.sellerErpCode, // Mantém o vínculo
      ...formData,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader>
          <DialogTitle>Editar Cliente: {customer.tradeName}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tabela de Preço */}
            <div className="space-y-2">
              <Label>Tabela de Preço</Label>
              <Select 
                value={formData.priceTableCode} 
                onValueChange={(v) => setFormData(d => ({ ...d, priceTableCode: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione uma tabela" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {tablesQuery.data?.map(t => (
                    <SelectItem key={t.code} value={t.code}>{t.code} · {t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Segmento */}
            <div className="space-y-2">
              <Label>Segmento Comercial</Label>
              <Select 
                value={formData.segmentCode || "_none"} 
                onValueChange={(v) => setFormData(d => ({ ...d, segmentCode: v === "_none" ? null : v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione um segmento" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="_none">Não informado</SelectItem>
                  {segmentsQuery.data?.map(s => (
                    <SelectItem key={s.code} value={s.code}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Condição de Pagamento */}
            <div className="space-y-2">
              <Label>Condição de Pagamento (ERP)</Label>
              <Input 
                value={formData.paymentTerm} 
                onChange={e => setFormData(d => ({ ...d, paymentTerm: e.target.value }))}
                className="rounded-xl"
              />
            </div>

            {/* Pedido Mínimo */}
            <div className="space-y-2">
              <Label>Pedido Mínimo (R$)</Label>
              <Input 
                type="number"
                step="0.01"
                value={formData.minOrderValue} 
                onChange={e => setFormData(d => ({ ...d, minOrderValue: parseFloat(e.target.value) }))}
                className="rounded-xl"
              />
            </div>

            {/* Limite de Crédito */}
            <div className="space-y-2">
              <Label>Limite de Crédito (R$)</Label>
              <Input 
                type="number"
                step="0.01"
                value={formData.creditLimit} 
                onChange={e => setFormData(d => ({ ...d, creditLimit: parseFloat(e.target.value) }))}
                className="rounded-xl"
              />
            </div>

            {/* Status Ativo */}
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div className="space-y-0.5">
                <Label>Cliente Ativo</Label>
                <p className="text-[10px] text-muted-foreground">Define se o cliente aparece na carteira.</p>
              </div>
              <Switch 
                checked={formData.active} 
                onCheckedChange={v => setFormData(d => ({ ...d, active: v }))}
              />
            </div>
          </div>

          {/* Restrição */}
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <Label className="text-destructive">Restrição Financeira / Bloqueio</Label>
              </div>
              <Switch 
                checked={formData.restricted} 
                onCheckedChange={v => setFormData(d => ({ ...d, restricted: v }))}
              />
            </div>
            
            {formData.restricted && (
              <div className="space-y-2">
                <Label>Motivo da Restrição</Label>
                <Input 
                  value={formData.restrictionReason || ""} 
                  onChange={e => setFormData(d => ({ ...d, restrictionReason: e.target.value }))}
                  placeholder="Ex: Títulos vencidos há mais de 30 dias"
                  className="rounded-xl bg-background"
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
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
              className="rounded-xl bg-brand-gradient shadow-lift"
            >
              {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}