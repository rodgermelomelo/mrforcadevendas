import { useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { roleLabel } from "@/lib/domain/roles";
import type { CommercialTeamsPayload, TeamSellerOption } from "@/lib/team.functions";

export interface TeamFormState {
  teamId?: string | undefined;
  name: string;
  description: string;
  leaderUserId: string;
  sellerCodes: string[];
  active: boolean;
}

export interface TeamFormDialogProps {
  form: TeamFormState | null;
  users: CommercialTeamsPayload["users"];
  sellers: TeamSellerOption[];
  saving: boolean;
  onChange: (form: TeamFormState | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function TeamFormDialog({
  form,
  users,
  sellers,
  saving,
  onChange,
  onClose,
  onSubmit,
}: TeamFormDialogProps) {
  const [term, setTerm] = useState("");
  const selected = useMemo(() => new Set(form?.sellerCodes ?? []), [form?.sellerCodes]);
  const filtered = sellers
    .filter((seller) =>
      `${seller.erpCode} ${seller.name}`.toLowerCase().includes(term.trim().toLowerCase()),
    )
    .slice(0, 80);

  const patch = (next: Partial<TeamFormState>) => form && onChange({ ...form, ...next });
  const toggleSeller = (code: string) => {
    if (!form) return;
    const next = new Set(form.sellerCodes);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    patch({ sellerCodes: [...next] });
  };

  return (
    <Dialog open={!!form} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>{form?.teamId ? "Editar equipe" : "Nova equipe"}</DialogTitle>
          <DialogDescription>
            O responsável selecionado passa a enxergar os representantes desta equipe.
          </DialogDescription>
        </DialogHeader>

        {form && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="team-name">Nome da equipe</Label>
                <Input
                  id="team-name"
                  value={form.name}
                  onChange={(event) => patch({ name: event.target.value })}
                  placeholder="Ex.: Time Edmilson"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Responsável / gerente</Label>
                <Select
                  value={form.leaderUserId}
                  onValueChange={(value) => patch({ leaderUserId: value })}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                        {user.roles.length > 0 && ` · ${user.roles.map(roleLabel).join(", ")}`}
                        {user.email ? ` · ${user.email}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="team-description">Descrição</Label>
              <Textarea
                id="team-description"
                value={form.description}
                onChange={(event) => patch({ description: event.target.value })}
                placeholder="Ex.: Carteira de perfumarias do interior"
                className="rounded-xl"
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.active}
                onCheckedChange={(checked) => patch({ active: checked === true })}
              />
              Equipe ativa
            </label>

            <SellerPicker
              sellers={filtered}
              selected={selected}
              selectedCount={form.sellerCodes.length}
              term={term}
              onTerm={setTerm}
              onToggle={toggleSeller}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" className="rounded-xl" onClick={onClose}>
            Voltar
          </Button>
          <Button type="button" disabled={saving} className="rounded-xl" onClick={onSubmit}>
            {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Salvar equipe
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SellerPicker({
  sellers,
  selected,
  selectedCount,
  term,
  onTerm,
  onToggle,
}: {
  sellers: TeamSellerOption[];
  selected: Set<string>;
  selectedCount: number;
  term: string;
  onTerm: (term: string) => void;
  onToggle: (code: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Label>Representantes da equipe</Label>
        <span className="text-xs font-medium text-muted-foreground">
          {selectedCount} selecionado(s)
        </span>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(event) => onTerm(event.target.value)}
          placeholder="Buscar representante"
          className="rounded-xl pl-9"
        />
      </div>
      <div className="grid max-h-72 gap-2 overflow-y-auto rounded-2xl border border-border p-3 md:grid-cols-2">
        {sellers.map((seller) => (
          <label
            key={seller.erpCode}
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 text-sm transition-colors hover:bg-muted/60"
          >
            <Checkbox
              checked={selected.has(seller.erpCode)}
              onCheckedChange={() => onToggle(seller.erpCode)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block truncate font-medium">{seller.name}</span>
              <span className="text-xs text-muted-foreground">
                {seller.erpCode} · {seller.customerCount.toLocaleString("pt-BR")} clientes
                {!seller.active && " · inativo"}
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
