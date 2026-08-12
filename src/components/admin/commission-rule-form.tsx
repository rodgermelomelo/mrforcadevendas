import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CommissionOptions, CommissionRuleDraft } from "@/lib/commissions.functions";

export interface CommissionRuleFormProps {
  initial: CommissionRuleDraft;
  options: CommissionOptions;
  saving: boolean;
  onCancel: () => void;
  onSave: (rule: CommissionRuleDraft) => void;
}

const field =
  "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";
const label = "text-xs font-medium text-muted-foreground";

function toNumber(value: string, fallback = 0) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function CommissionRuleForm({
  initial,
  options,
  saving,
  onCancel,
  onSave,
}: CommissionRuleFormProps) {
  const [form, setForm] = useState<CommissionRuleDraft>(initial);
  const [sellerTerm, setSellerTerm] = useState("");
  const selected = new Set(form.sellerErpCodes);

  const categories = useMemo(() => {
    if (!form.brand) {
      const grouped = new Map<string, { name: string; brand: string | null; productCount: number }>();
      for (const category of options.categories) {
        const current = grouped.get(category.name) ?? { name: category.name, brand: null, productCount: 0 };
        current.productCount += category.productCount;
        grouped.set(category.name, current);
      }
      return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    return options.categories.filter((category) => category.brand === form.brand);
  }, [form.brand, options.categories]);

  const sellers = useMemo(() => {
    const term = sellerTerm.trim().toLowerCase();
    const rows = options.sellers.filter((seller) => {
      if (!term) return true;
      return `${seller.erpCode} ${seller.name}`.toLowerCase().includes(term);
    });
    return rows.slice(0, 30);
  }, [options.sellers, sellerTerm]);

  const toggleSeller = (erpCode: string) => {
    const next = new Set(form.sellerErpCodes);
    if (next.has(erpCode)) next.delete(erpCode);
    else next.add(erpCode);
    setForm({ ...form, sellerErpCodes: [...next] });
  };

  const productListId = `commission-products-${form.id ?? "new"}`;

  return (
    <form
      className="mt-4 space-y-4 border-t border-border pt-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1 sm:col-span-2">
          <span className={label}>Nome da regra</span>
          <Input
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value })}
            placeholder="Ex.: Dailus Boca"
            className="rounded-xl"
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Comissão (%)</span>
          <Input
            value={form.percent}
            onChange={(event) => setForm({ ...form, percent: toNumber(event.target.value) })}
            inputMode="decimal"
            className="rounded-xl"
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Prioridade</span>
          <Input
            value={form.priority}
            onChange={(event) => setForm({ ...form, priority: toNumber(event.target.value, 100) })}
            inputMode="numeric"
            className="rounded-xl"
          />
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className={label}>Marca</span>
          <select
            value={form.brand ?? ""}
            onChange={(event) => setForm({ ...form, brand: event.target.value || null, category: null })}
            className={field}
          >
            <option value="">Todas</option>
            {options.brands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={label}>Categoria</span>
          <select
            value={form.category ?? ""}
            onChange={(event) => setForm({ ...form, category: event.target.value || null })}
            className={field}
          >
            <option value="">Todas</option>
            {categories.map((category) => (
              <option key={`${category.brand ?? "all"}-${category.name}`} value={category.name}>
                {category.name} ({category.productCount})
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={label}>Produto específico</span>
          <Input
            list={productListId}
            value={form.productErpCode ?? ""}
            onChange={(event) => setForm({ ...form, productErpCode: event.target.value || null })}
            placeholder="Opcional: código ERP do produto"
            className="rounded-xl"
          />
          <datalist id={productListId}>
            {options.products.map((product) => (
              <option key={product.erpCode} value={product.erpCode}>
                {product.name}
              </option>
            ))}
          </datalist>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="space-y-1">
          <span className={label}>Vigência inicial</span>
          <Input
            type="date"
            value={form.validFrom}
            onChange={(event) => setForm({ ...form, validFrom: event.target.value })}
            className="rounded-xl"
          />
        </label>
        <label className="space-y-1">
          <span className={label}>Vigência final</span>
          <Input
            type="date"
            value={form.validTo ?? ""}
            onChange={(event) => setForm({ ...form, validTo: event.target.value || null })}
            className="rounded-xl"
          />
        </label>
        <label className="space-y-1 sm:col-span-2">
          <span className={label}>Observações</span>
          <Input
            value={form.notes}
            onChange={(event) => setForm({ ...form, notes: event.target.value })}
            placeholder="Opcional"
            className="rounded-xl"
          />
        </label>
      </div>

      <section className="rounded-xl border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Users className="h-4 w-4 text-primary" /> Representantes
            </p>
            <p className="text-xs text-muted-foreground">
              Sem seleção, a regra vale para todos os representantes.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
              className="h-4 w-4 accent-[hsl(var(--primary))]"
            />
            Ativa
          </label>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={sellerTerm}
            onChange={(event) => setSellerTerm(event.target.value)}
            placeholder="Buscar representante"
            className="rounded-xl pl-9"
          />
        </div>

        <div className="mt-3 grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
          {sellers.map((seller) => (
            <label
              key={seller.erpCode}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                checked={selected.has(seller.erpCode)}
                onChange={() => toggleSeller(seller.erpCode)}
                className="h-4 w-4 accent-[hsl(var(--primary))]"
              />
              <span className="min-w-0">
                <span className="block truncate font-medium">{seller.name}</span>
                <span className="block text-xs text-muted-foreground">
                  {seller.erpCode}
                  {!seller.active && " · inativo"}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" className="rounded-xl" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={saving} className="rounded-xl bg-brand-gradient">
          Salvar regra
        </Button>
      </div>
    </form>
  );
}
