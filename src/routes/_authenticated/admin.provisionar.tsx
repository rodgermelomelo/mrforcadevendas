import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, ShieldAlert, UserPlus, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { getIsAdmin } from "@/lib/admin.functions";
import { listSellers } from "@/lib/admin-data.functions";
import {
  validateProvisioning,
  provisionSellerUsers,
  APP_ROLES,
  type ProvisionResult,
} from "@/lib/provisioning.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/provisionar")({
  component: ProvisionarView,
  head: () => ({
    meta: [
      { title: "Provisionar acessos · MR Força de Vendas" },
      { name: "description", content: "Crie usuários de autenticação para os representantes, com perfil e validação." },
    ],
  }),
});

const ROLE_LABEL: Record<string, string> = {
  vendedor_externo: "Vendedor externo",
  vendedor_interno: "Vendedor interno",
  supervisor: "Supervisor",
  gerente_comercial: "Gerente comercial",
  administrador: "Administrador",
  operador_integracao: "Operador de integração",
};

interface RowState {
  email: string;
  role: string;
  fullName: string;
  selected: boolean;
}
interface RowValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function ProvisionarView() {
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => getIsAdmin() });
  const sellersQ = useQuery({ queryKey: ["admin", "sellers"], queryFn: () => listSellers() });
  const validateFn = useServerFn(validateProvisioning);
  const provisionFn = useServerFn(provisionSellerUsers);

  const [onlyWithCustomers, setOnlyWithCustomers] = useState(true);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [validation, setValidation] = useState<Record<string, RowValidation>>({});
  const [results, setResults] = useState<ProvisionResult[] | null>(null);

  const sellersWithoutUser = useMemo(() => {
    return (sellersQ.data ?? []).filter(
      (s) => s.users.length === 0 && (!onlyWithCustomers || s.customerCount > 0),
    );
  }, [sellersQ.data, onlyWithCustomers]);

  const rowFor = (code: string, name: string): RowState =>
    rows[code] ?? { email: "", role: "vendedor_externo", fullName: name, selected: false };

  const patchRow = (code: string, name: string, patch: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [code]: { ...rowFor(code, name), ...patch } }));

  const selectedItems = useMemo(
    () =>
      sellersWithoutUser
        .map((s) => ({ s, r: rowFor(s.erpCode, s.name) }))
        .filter(({ r }) => r.selected)
        .map(({ s, r }) => ({
          sellerErpCode: s.erpCode,
          email: r.email.trim().toLowerCase(),
          fullName: (r.fullName || s.name).trim(),
          role: r.role,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sellersWithoutUser, rows],
  );

  const validateMut = useMutation({
    mutationFn: () => validateFn({ data: { items: selectedItems } }),
    onSuccess: (res) => {
      const map: Record<string, RowValidation> = {};
      for (const r of res.results) map[r.sellerErpCode] = { ok: r.ok, errors: r.errors, warnings: r.warnings };
      setValidation(map);
      toast[res.validCount === res.total ? "success" : "warning"](
        `${res.validCount}/${res.total} válidos para provisionar.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const provisionMut = useMutation({
    mutationFn: () => provisionFn({ data: { items: selectedItems } }),
    onSuccess: (res) => {
      setResults(res.results);
      void sellersQ.refetch();
      setRows({});
      setValidation({});
      toast.success(`${res.createdCount} acesso(s) criado(s).`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (adminQ.isLoading) return <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />;
  if (!adminQ.data) {
    return (
      <div className="surface-card mx-auto max-w-md p-10 text-center">
        <ShieldAlert className="mx-auto h-8 w-8 text-warning" />
        <h1 className="mt-3 text-lg font-semibold">Acesso restrito</h1>
        <p className="mt-2 text-sm text-muted-foreground">Somente administradores podem provisionar acessos.</p>
      </div>
    );
  }

  const selectedCount = selectedItems.length;
  const allValid = selectedCount > 0 && selectedItems.every((it) => validation[it.sellerErpCode]?.ok);

  return (
    <div className="w-full space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          Crie o usuário de cada representante, atribua o perfil e valide antes de salvar.
          {" "}Só aparecem representantes <strong>sem usuário</strong>.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyWithCustomers}
            onChange={(e) => setOnlyWithCustomers(e.target.checked)}
          />
          Só com clientes na carteira
        </label>
        <span className="text-sm text-muted-foreground">
          {sellersWithoutUser.length} representante(s) sem acesso
        </span>
        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            className="rounded-xl"
            disabled={selectedCount === 0 || validateMut.isPending}
            onClick={() => validateMut.mutate()}
          >
            {validateMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1 h-4 w-4" />}
            Validar ({selectedCount})
          </Button>
          <Button
            className="rounded-xl bg-brand-gradient"
            disabled={!allValid || provisionMut.isPending}
            onClick={() => provisionMut.mutate()}
          >
            {provisionMut.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}
            Provisionar selecionados
          </Button>
        </div>
      </div>

      {!allValid && selectedCount > 0 && Object.keys(validation).length > 0 && (
        <p className="text-xs text-warning">Corrija os itens marcados e valide novamente antes de provisionar.</p>
      )}

      {results && (
        <div className="surface-card border-success/30 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-success">
            <CheckCircle2 className="h-5 w-5" /> Resultado do provisionamento
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Anote as senhas provisórias e repasse aos representantes — eles devem trocá-la no primeiro acesso.
          </p>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {results.map((r) => (
                  <tr key={r.sellerErpCode} className="border-b border-border/50">
                    <td className="py-2 pr-3 font-medium">{r.sellerErpCode}</td>
                    <td className="py-2 pr-3">{r.email}</td>
                    <td className="py-2 pr-3">
                      {r.ok ? (
                        <span className="font-mono text-xs">{r.tempPassword}</span>
                      ) : (
                        <span className="text-xs text-destructive">{r.message}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {sellersQ.isLoading ? (
        <div className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
      ) : sellersWithoutUser.length === 0 ? (
        <div className="surface-card p-10 text-center text-sm text-muted-foreground">
          Todos os representantes {onlyWithCustomers ? "com clientes " : ""}já possuem acesso. 🎉
        </div>
      ) : (
        <div className="space-y-2">
          {sellersWithoutUser.map((s) => {
            const r = rowFor(s.erpCode, s.name);
            const v = validation[s.erpCode];
            return (
              <div
                key={s.erpCode}
                className={cn(
                  "surface-card grid grid-cols-1 items-center gap-2 p-3 sm:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,1.6fr)_minmax(0,1fr)]",
                  r.selected && "border-primary/30 ring-1 ring-primary/20",
                )}
              >
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={r.selected}
                    onChange={(e) => patchRow(s.erpCode, s.name, { selected: e.target.checked })}
                  />
                  <span className="text-sm font-semibold">{s.erpCode}</span>
                  <span className="text-xs text-muted-foreground">· {s.customerCount} cli.</span>
                </label>
                <Input
                  value={r.fullName}
                  onChange={(e) => patchRow(s.erpCode, s.name, { fullName: e.target.value })}
                  placeholder="Nome do representante"
                  className="h-10 rounded-lg"
                />
                <Input
                  type="email"
                  value={r.email}
                  onChange={(e) => patchRow(s.erpCode, s.name, { email: e.target.value })}
                  placeholder="email@dominio.com"
                  className={cn("h-10 rounded-lg", v && !v.ok && "border-destructive")}
                />
                <Select value={r.role} onValueChange={(val) => patchRow(s.erpCode, s.name, { role: val })}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APP_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_LABEL[role] ?? role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {v && (v.errors.length > 0 || v.warnings.length > 0) && (
                  <div className="sm:col-span-4">
                    {v.errors.map((err, i) => (
                      <p key={i} className="flex items-center gap-1 text-[11px] text-destructive">
                        <AlertTriangle className="h-3 w-3" /> {err}
                      </p>
                    ))}
                    {v.warnings.map((w, i) => (
                      <p key={i} className="text-[11px] text-warning">{w}</p>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
