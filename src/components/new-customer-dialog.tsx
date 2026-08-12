import { useMemo, useState, type ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSales } from "@/lib/state/sales-store";
import { createCustomer } from "@/lib/customers.functions";
import { cn } from "@/lib/utils";
import { isRepresentativeRole } from "@/lib/domain/roles";

interface FormState {
  tradeName: string;
  legalName: string;
  taxId: string;
  city: string;
  uf: string;
  sellerErpCode: string;
  priceTableCode: string;
  paymentTerm: string;
}

function emptyForm(defaultSeller: string): FormState {
  return {
    tradeName: "",
    legalName: "",
    taxId: "",
    city: "",
    uf: "",
    sellerErpCode: defaultSeller,
    priceTableCode: "",
    paymentTerm: "",
  };
}

/**
 * Cadastro rápido de cliente. Só lista tabelas COM nível mapeado (senão o
 * catálogo fica indisponível). Ao criar, opcionalmente já inicia o atendimento.
 */
export function NewCustomerDialog({
  onCreated,
  triggerLabel = "Novo cliente",
  triggerVariant = "outline",
  triggerClassName,
}: {
  onCreated?: (customerId: string) => void;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline" | "ghost";
  triggerClassName?: string;
}) {
  const { sellers, priceTables, role } = useSales();
  const qc = useQueryClient();
  const create = useServerFn(createCustomer);
  const hidePriceTableDetails = role ? isRepresentativeRole(role) : true;

  const defaultSeller = sellers.length === 1 ? sellers[0]!.code : "";
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaultSeller));

  const mappedTables = useMemo(() => priceTables.filter((t) => t.mappedLevel !== null), [priceTables]);
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const mut = useMutation({
    mutationFn: () => create({ data: form }),
    onSuccess: async (res) => {
      await qc.invalidateQueries({ queryKey: ["workspace"] });
      toast.success("Cliente cadastrado.");
      setOpen(false);
      setForm(emptyForm(defaultSeller));
      onCreated?.(res.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit =
    (form.tradeName.trim() || form.legalName.trim()) && form.sellerErpCode && form.priceTableCode;

  return (
    <>
      <Button
        variant={triggerVariant}
        className={cn("rounded-xl", triggerClassName)}
        onClick={() => {
          setForm(emptyForm(defaultSeller));
          setOpen(true);
        }}
      >
        <UserPlus className="mr-1 h-4 w-4" /> {triggerLabel}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogTitle>Novo cliente</DialogTitle>
          <p className="text-sm text-muted-foreground">
            O cliente já entra na carteira do representante e na{" "}
            {hidePriceTableDetails ? "política comercial selecionada" : "tabela de preço escolhida"}.
          </p>

          <div className="mt-4 space-y-3">
            <Field label="Nome fantasia">
              <Input value={form.tradeName} onChange={(e) => set({ tradeName: e.target.value })} placeholder="Como o cliente é conhecido" />
            </Field>
            <Field label="Razão social">
              <Input value={form.legalName} onChange={(e) => set({ legalName: e.target.value })} placeholder="Razão social (opcional)" />
            </Field>
            <div className="grid grid-cols-[1fr_auto] gap-3">
              <Field label="CNPJ / CPF">
                <Input value={form.taxId} onChange={(e) => set({ taxId: e.target.value })} placeholder="Somente números (opcional)" inputMode="numeric" />
              </Field>
              <Field label="UF">
                <Input value={form.uf} onChange={(e) => set({ uf: e.target.value.toUpperCase().slice(0, 2) })} placeholder="SP" className="w-16 text-center" />
              </Field>
            </div>
            <Field label="Cidade">
              <Input value={form.city} onChange={(e) => set({ city: e.target.value })} placeholder="Cidade" />
            </Field>

            <Field label="Representante (carteira)">
              <Select value={form.sellerErpCode} onValueChange={(v) => set({ sellerErpCode: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o representante" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {sellers.length === 0 && <SelectItem value="__none" disabled>Nenhum representante disponível</SelectItem>}
                  {sellers.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.code} · {s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={hidePriceTableDetails ? "Política comercial" : "Tabela de preço"}>
                <Select value={form.priceTableCode} onValueChange={(v) => set({ priceTableCode: v })}>
                  <SelectTrigger><SelectValue placeholder={hidePriceTableDetails ? "Política" : "Tabela"} /></SelectTrigger>
                  <SelectContent>
                    {mappedTables.length === 0 && (
                      <SelectItem value="__none" disabled>
                        {hidePriceTableDetails ? "Nenhuma política configurada" : "Nenhuma tabela configurada"}
                      </SelectItem>
                    )}
                    {mappedTables.map((t, index) => (
                      <SelectItem key={t.code} value={t.code}>
                        {hidePriceTableDetails ? `Política comercial ${index + 1}` : `${t.code} · ${t.name}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Condição de pagamento">
                <Input value={form.paymentTerm} onChange={(e) => set({ paymentTerm: e.target.value })} placeholder="Ex.: 28/35/42" />
              </Field>
            </div>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" className="rounded-xl" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              className="rounded-xl bg-brand-gradient"
              disabled={!canSubmit || mut.isPending}
              onClick={() => mut.mutate()}
            >
              {mut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}
              Cadastrar cliente
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      {children}
    </label>
  );
}
