import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Search } from "lucide-react";
import { toast } from "sonner";
import { AdminPage } from "@/components/admin/admin-page";
import {
  listUsers,
  setUserRole,
  setUserVisibility,
  listSellers,
  type AppRole,
  type AdminUser,
} from "@/lib/admin-data.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsersPage,
  head: () => ({
    meta: [
      { title: "Usuários e papéis · MR Força de Vendas" },
      { name: "description", content: "Defina papéis de acesso e a visibilidade de carteiras para supervisores e gerentes." },
      { property: "og:title", content: "Usuários e papéis · MR Força de Vendas" },
      { property: "og:description", content: "Controle de perfis e visibilidade configurável de equipe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ROLES: { value: AppRole; label: string }[] = [
  { value: "vendedor_externo", label: "Vendedor externo" },
  { value: "vendedor_interno", label: "Vendedor interno" },
  { value: "supervisor", label: "Supervisor" },
  { value: "gerente_comercial", label: "Gerente comercial" },
  { value: "administrador", label: "Administrador" },
  { value: "operador_integracao", label: "Operador de integração" },
];

function UsersPage() {
  const queryClient = useQueryClient();
  const load = useServerFn(listUsers);
  const loadSellers = useServerFn(listSellers);
  const saveRole = useServerFn(setUserRole);
  const saveVisibility = useServerFn(setUserVisibility);

  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: () => load() });
  const sellersQuery = useQuery({ queryKey: ["admin", "sellers"], queryFn: () => loadSellers() });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin", "users"] });

  const roleMutation = useMutation({
    mutationFn: (input: { userId: string; role: AppRole }) => saveRole({ data: input }),
    onSuccess: async () => {
      toast.success("Papel atualizado.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const visibilityMutation = useMutation({
    mutationFn: (input: { userId: string; sellerCodes: string[] }) => saveVisibility({ data: input }),
    onSuccess: async () => {
      toast.success("Visibilidade atualizada.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AdminPage
      title="Usuários e papéis"
      description="Vendedores enxergam apenas a própria carteira. Supervisores e gerentes só veem as carteiras escolhidas explicitamente aqui. Implementar um fluxo para eu criar automaticamente um usuário de autenticação para cada representante, com atribuição de perfil e validação antes de salvar."
    >
      {usersQuery.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {(usersQuery.data ?? []).map((user) => (
            <UserCard
              key={user.id}
              user={user}
              sellers={(sellersQuery.data ?? []).map((s) => ({ code: s.erpCode, label: `${s.erpCode} · ${s.name}` }))}
              savingRole={roleMutation.isPending}
              savingVisibility={visibilityMutation.isPending}
              onRole={(role) => roleMutation.mutate({ userId: user.id, role })}
              onVisibility={(codes) => visibilityMutation.mutate({ userId: user.id, sellerCodes: codes })}
            />
          ))}
        </div>
      )}
    </AdminPage>
  );
}

function UserCard({
  user,
  sellers,
  savingRole,
  savingVisibility,
  onRole,
  onVisibility,
}: {
  user: AdminUser;
  sellers: { code: string; label: string }[];
  savingRole: boolean;
  savingVisibility: boolean;
  onRole: (role: AppRole) => void;
  onVisibility: (codes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string[]>(user.visibilityCodes);
  const currentRole = user.roles[0] ?? "vendedor_externo";
  const supervisory = currentRole === "supervisor" || currentRole === "gerente_comercial";

  const filtered = sellers.filter((s) => s.label.toLowerCase().includes(term.trim().toLowerCase())).slice(0, 40);

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">
            {user.email ?? "sem e-mail"} · carteira: {user.sellerCodes.join(", ") || "nenhuma"}
            {supervisory && ` · visibilidade: ${user.visibilityCodes.length} representante(s)`}
          </p>
        </div>
        <select
          disabled={savingRole}
          value={currentRole}
          onChange={(e) => onRole(e.target.value as AppRole)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        >
          {ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </div>

      {supervisory && (
        <div className="mt-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="text-xs font-semibold text-primary"
          >
            {open ? "Fechar visibilidade de equipe" : "Configurar visibilidade de equipe"}
          </button>

          {open && (
            <div className="mt-3 space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Buscar representante"
                  className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
                {filtered.map((seller) => {
                  const on = selected.includes(seller.code);
                  return (
                    <button
                      key={seller.code}
                      type="button"
                      onClick={() =>
                        setSelected(on ? selected.filter((c) => c !== seller.code) : [...selected, seller.code])
                      }
                      className={`rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                        on ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      {seller.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={savingVisibility}
                onClick={() => onVisibility(selected)}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-gradient px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {savingVisibility ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar visibilidade ({selected.length})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
