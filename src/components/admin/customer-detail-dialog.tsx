import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Customer } from "@/lib/domain/types";
import { MapPin, ShieldAlert, CreditCard, ShoppingBag, History, FileText, Edit2 } from "lucide-react";
import { maskTaxId, formatBRL } from "@/lib/pricing";
import { Badge } from "@/components/ui/badge";
import { canViewPriceTableDetails } from "@/lib/domain/roles";
import { useSales } from "@/lib/state/sales-store";
import { Button } from "@/components/ui/button";
import { EditCustomerDialog } from "./edit-customer-dialog";

interface CustomerDetailDialogProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailDialog({ customer, open, onOpenChange }: CustomerDetailDialogProps) {
  const { role } = useSales();
  const showPriceTableDetails = canViewPriceTableDetails(role);
  const isAdmin = role === "administrador";
  const [editOpen, setEditOpen] = useState(false);

  if (!customer) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl overflow-hidden rounded-3xl p-0">
        <div className="bg-brand-gradient p-6 text-primary-foreground">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <DialogTitle className="text-2xl font-bold">{customer.tradeName}</DialogTitle>
                <Badge variant="secondary" className="bg-white/20 text-white border-none">
                  {customer.erpCode}
                </Badge>
              </div>
              <p className="text-white/80 text-sm font-medium">{customer.legalName}</p>
            </div>
            {isAdmin && (
              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl bg-white/20 text-white border-none hover:bg-white/30"
                onClick={() => setEditOpen(true)}
              >
                <Edit2 className="mr-2 h-4 w-4" /> Editar Cliente
              </Button>
            )}
          </div>
        </div>

        <EditCustomerDialog 
          customer={customer}
          open={editOpen}
          onOpenChange={(v) => {
            setEditOpen(v);
            if (!v) onOpenChange(false); // Fecha o detalhe também após editar com sucesso/cancelar
          }}
        />

        <div className="grid gap-6 p-6 md:grid-cols-2">
          {/* Informações Básicas */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <MapPin className="h-4 w-4" /> Localização e Identificação
            </h3>
            <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">CNPJ / CPF</p>
                <p className="text-sm font-medium">{maskTaxId(customer.taxId)}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Cidade / UF</p>
                <p className="text-sm font-medium">{customer.city} / {customer.uf}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Segmento</p>
                <p className="text-sm font-medium">{customer.segment || "Não informado"}</p>
              </div>
            </div>
          </section>

          {/* Situação Comercial */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <CreditCard className="h-4 w-4" /> Financeiro e Crédito
            </h3>
            <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Limite de Crédito</p>
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    {formatBRL(customer.creditLimit)}
                  </p>
                </div>
                {customer.restricted && (
                   <Badge variant="destructive" className="animate-pulse">
                    Restrito
                   </Badge>
                )}
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Saldo em Aberto</p>
                <p className="text-sm font-medium text-destructive">
                  {formatBRL(customer.openBalance || 0)}
                </p>
              </div>
               <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Crédito Disponível</p>
                <p className="text-sm font-bold">
                  {formatBRL(Math.max(0, customer.creditLimit - (customer.openBalance || 0)))}
                </p>
              </div>
            </div>
          </section>

          {/* Regras de Pedido */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <ShoppingBag className="h-4 w-4" /> Configuração de Vendas
            </h3>
            <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
              {showPriceTableDetails && (
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Tabela de Preço</p>
                  <p className="text-sm font-medium">{customer.priceTableCode}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Condição de Pagamento</p>
                <p className="text-sm font-medium">{customer.paymentTerm}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Pedido Mínimo</p>
                <p className="text-sm font-medium">{formatBRL(customer.minOrderValue)}</p>
              </div>
            </div>
          </section>

          {/* Histórico e Status */}
          <section className="space-y-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              <History className="h-4 w-4" /> Atividade
            </h3>
            <div className="space-y-3 rounded-2xl bg-muted/50 p-4">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase font-bold">Último Pedido</p>
                <p className="text-sm font-medium">
                  {customer.lastOrderAt ? new Date(customer.lastOrderAt).toLocaleDateString('pt-BR') : "Nenhum pedido"}
                </p>
              </div>
              {customer.restricted && customer.restrictionReason && (
                <div className="flex gap-2 rounded-xl bg-destructive/10 p-3 text-destructive border border-destructive/20">
                  <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold uppercase">Motivo da Restrição</p>
                    <p className="text-xs">{customer.restrictionReason}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
