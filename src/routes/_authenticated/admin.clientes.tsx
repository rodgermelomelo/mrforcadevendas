import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Save, Filter, X } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import {
  listCustomers,
  updateCustomer,
  listPriceTables,
  listRegistries,
  listSellers,
  type AdminCustomer,
} from "@/lib/admin-data.functions";

export const Route = createFileRoute("/_authenticated/admin/clientes")({
  component: CustomersPage,
  head: () => ({
    meta: [
      { title: "Clientes · MR Força de Vendas" },
      { name: "description", content: "Ajuste tabela de preço, condição, restrição, limite e valor mínimo dos clientes." },
      { property: "og:title", content: "Clientes · MR Força de Vendas" },
      { property: "og:description", content: "Gestão comercial da base de clientes vinda do ERP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SIZE = 25;

function CustomersPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listCustomers);
  const save = useServerFn(updateCustomer);
  const loadTables = useServerFn(listPriceTables);
  const loadRegistries = useServerFn(listRegistries);
  const loadSellers = useServerFn(listSellers);

  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [sellerFilter, setSellerFilter] = useState("");
  const [restrictedFilter, setRestrictedFilter] = useState<boolean | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  const query = useQuery({
    queryKey: ["admin", "customers", term, page, sellerFilter, restrictedFilter, activeFilter],
    queryFn: () => load({ data: { 
      term: term || undefined, 
      page, 
      sellerErpCode: sellerFilter || undefined,
      restricted: restrictedFilter,
      active: activeFilter
    } }),
  });
  const tablesQuery = useQuery({ queryKey: ["admin", "price-tables"], queryFn: () => loadTables() });
  const registriesQuery = useQuery({ queryKey: ["admin", "registries"], queryFn: () => loadRegistries() });
  const sellersQuery = useQuery({ queryKey: ["admin", "sellers"], queryFn: () => loadSellers() });

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof save>[0]["data"]) => save({ data: input }),
    onSuccess: async () => {
      toast.success("Cliente atualizado.");
      setOpenCode(null);
      await queryClient.invalidateQueries({ queryKey: ["admin", "customers"] });
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminPage
      title="Clientes"
      description="Razão social, CNPJ e cidade vêm do ERP e não são editáveis. Os campos comerciais abaixo são gerenciados aqui."
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => {
              setTerm(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar por código, razão social, nome fantasia ou cidade"
            className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary shadow-sm"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <select
              value={sellerFilter}
              onChange={(e) => {
                setSellerFilter(e.target.value);
                setPage(0);
              }}
              className="bg-transparent text-sm outline-none"
            >
              <option value="">Todos Representantes</option>
              {(sellersQuery.data ?? []).map((s) => (
                <option key={s.erpCode} value={s.erpCode}>
                  {s.erpCode} · {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
            <select
              value={restrictedFilter === undefined ? "" : String(restrictedFilter)}
              onChange={(e) => {
                const val = e.target.value;
                setRestrictedFilter(val === "" ? undefined : val === "true");
                setPage(0);
              }}
              className="bg-transparent text-sm outline-none"
            >
              <option value="">Restrição: Todas</option>
              <option value="true">Com Restrição</option>
              <option value="false">Sem Restrição</option>
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 shadow-sm">
            <select
              value={activeFilter === undefined ? "" : String(activeFilter)}
              onChange={(e) => {
                const val = e.target.value;
                setActiveFilter(val === "" ? undefined : val === "true");
                setPage(0);
              }}
              className="bg-transparent text-sm outline-none"
            >
              <option value="">Status: Todos</option>
              <option value="true">Ativos</option>
              <option value="false">Inativos</option>
            </select>
          </div>

          {(sellerFilter || restrictedFilter !== undefined || activeFilter !== undefined) && (
            <button
              onClick={() => {
                setSellerFilter("");
                setRestrictedFilter(undefined);
                setActiveFilter(undefined);
                setPage(0);
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          )}
        </div>
      </div>

      {query.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {(query.data?.rows ?? []).map((customer) => {
            const rowKey = `${customer.erpCode}:${customer.sellerErpCode}`;
            return (
              <div key={rowKey} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <button
                  type="button"
                  onClick={() => setOpenCode(openCode === rowKey ? null : rowKey)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{customer.tradeName}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {customer.erpCode} · {customer.city}/{customer.uf} · Tabela {customer.priceTableCode} · Rep.{" "}
                      {customer.sellerErpCode}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    {customer.restricted && (
                      <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                        Restrito
                      </span>
                    )}
                    {!customer.active && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                        Inativo
                      </span>
                    )}
                  </div>
                </button>

                {openCode === rowKey && (
                  <CustomerForm
                    customer={customer}
                    saving={mutation.isPending}
                    tables={(tablesQuery.data ?? []).map((t) => ({ code: t.code, label: `${t.code} · ${t.name}` }))}
                    terms={(registriesQuery.data?.paymentTerms ?? []).map((t) => ({
                      code: t.code,
                      label: `${t.code} · ${t.label}`,
                    }))}
                    segments={(registriesQuery.data?.segments ?? []).map((s) => ({
                      code: s.code,
                      label: `${s.code} · ${s.label}`,
                    }))}
                    onSave={(patch) => mutation.mutate({ erpCode: customer.erpCode, ...patch })}
                  />
                )}
              </div>
            );
          })}
          <Pager page={page} total={query.data?.total ?? 0} size={SIZE} onChange={setPage} />
        </div>
      )}
    </AdminPage>
  );
}

interface Option {
  code: string;
  label: string;
}

function CustomerForm({
  customer,
  saving,
  tables,
  terms,
  segments,
  onSave,
}: {
  customer: AdminCustomer;
  saving: boolean;
  tables: Option[];
  terms: Option[];
  segments: Option[];
  onSave: (patch: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState({
    priceTableCode: customer.priceTableCode,
    paymentTerm: customer.paymentTerm,
    segmentCode: customer.segmentCode ?? "",
    sellerErpCode: customer.sellerErpCode,
    restricted: customer.restricted,
    restrictionReason: customer.restrictionReason ?? "",
    creditLimit: customer.creditLimit,
    minOrderValue: customer.minOrderValue,
    active: customer.active,
  });

  const field = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
  const labelCls = "text-xs font-medium text-muted-foreground";

  return (
    <div className="mt-4 space-y-4 border-t border-border pt-4">
      <p className="text-xs text-muted-foreground">
        {customer.legalName} — dados cadastrais são propriedade do ERP.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={labelCls}>Tabela de preço</span>
          <select
            className={field}
            value={form.priceTableCode}
            onChange={(e) => setForm({ ...form, priceTableCode: e.target.value })}
          >
            {tables.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Condição de pagamento</span>
          <select
            className={field}
            value={form.paymentTerm}
            onChange={(e) => setForm({ ...form, paymentTerm: e.target.value })}
          >
            <option value={form.paymentTerm}>{form.paymentTerm}</option>
            {terms
              .filter((t) => t.code !== form.paymentTerm)
              .map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Segmento</span>
          <select
            className={field}
            value={form.segmentCode}
            onChange={(e) => setForm({ ...form, segmentCode: e.target.value })}
          >
            <option value="">Sem segmento</option>
            {segments.map((s) => (
              <option key={s.code} value={s.code}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Representante da carteira</span>
          <div className={`${field} bg-muted text-muted-foreground`}>{form.sellerErpCode}</div>
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Limite de crédito (R$)</span>
          <input
            type="number"
            step="0.01"
            className={field}
            value={form.creditLimit}
            onChange={(e) => setForm({ ...form, creditLimit: Number(e.target.value) })}
          />
        </label>
        <label className="space-y-1">
          <span className={labelCls}>Valor mínimo do pedido (R$)</span>
          <input
            type="number"
            step="0.01"
            className={field}
            value={form.minOrderValue}
            onChange={(e) => setForm({ ...form, minOrderValue: Number(e.target.value) })}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.restricted}
            onChange={(e) => setForm({ ...form, restricted: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Cliente com restrição
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) => setForm({ ...form, active: e.target.checked })}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          Ativo
        </label>
      </div>

      {form.restricted && (
        <label className="block space-y-1">
          <span className={labelCls}>Motivo da restrição</span>
          <input
            className={field}
            value={form.restrictionReason}
            onChange={(e) => setForm({ ...form, restrictionReason: e.target.value })}
            placeholder="Ex.: títulos em atraso"
          />
        </label>
      )}

      <button
        type="button"
        disabled={saving}
        onClick={() => onSave(form)}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Salvar cliente
      </button>
    </div>
  );
}
