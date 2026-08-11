import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Link2, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { AdminPage, Pager } from "@/components/admin/admin-page";
import { listSellers, updateSeller, setSellerLink, listUsers } from "@/lib/admin-data.functions";

export const Route = createFileRoute("/_authenticated/admin/representantes")({
  component: SellersPage,
  head: () => ({
    meta: [
      { title: "Representantes · MR Força de Vendas" },
      { name: "description", content: "Gerencie os representantes do ERP e vincule usuários às carteiras de clientes." },
      { property: "og:title", content: "Representantes · MR Força de Vendas" },
      { property: "og:description", content: "Ative representantes e defina a carteira de cada vendedor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const SIZE = 20;

function SellersPage() {
  const queryClient = useQueryClient();
  const loadSellers = useServerFn(listSellers);
  const loadUsers = useServerFn(listUsers);
  const saveSeller = useServerFn(updateSeller);
  const saveLink = useServerFn(setSellerLink);

  const [term, setTerm] = useState("");
  const [page, setPage] = useState(0);

  const sellersQuery = useQuery({ queryKey: ["admin", "sellers"], queryFn: () => loadSellers() });
  const usersQuery = useQuery({ queryKey: ["admin", "users"], queryFn: () => loadUsers() });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "sellers"] });
    await queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  };

  const activeMutation = useMutation({
    mutationFn: (input: { erpCode: string; active: boolean }) => saveSeller({ data: input }),
    onSuccess: async () => {
      toast.success("Representante atualizado.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMutation = useMutation({
    mutationFn: (input: { sellerErpCode: string; userId: string; linked: boolean }) => saveLink({ data: input }),
    onSuccess: async () => {
      toast.success("Vínculo atualizado.");
      await invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    const t = term.trim().toLowerCase();
    const rows = sellersQuery.data ?? [];
    if (!t) return rows;
    return rows.filter((s) => s.erpCode.toLowerCase().includes(t) || s.name.toLowerCase().includes(t));
  }, [sellersQuery.data, term]);

  const pageRows = filtered.slice(page * SIZE, page * SIZE + SIZE);

  return (
    <AdminPage
      title="Representantes"
      description="Os representantes vêm do ERP. Aqui você ativa/desativa e define quais usuários enxergam cada carteira."
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={term}
          onChange={(e) => {
            setTerm(e.target.value);
            setPage(0);
          }}
          placeholder="Buscar por código ou nome"
          className="w-full rounded-2xl border border-border bg-card py-3 pl-10 pr-4 text-sm outline-none focus:border-primary"
        />
      </div>

      {sellersQuery.isLoading ? (
        <div className="grid place-items-center py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {pageRows.map((seller) => (
            <div key={seller.erpCode} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {seller.erpCode} · {seller.name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {seller.customerCount.toLocaleString("pt-BR")} clientes na carteira
                    {seller.users.length > 0 && ` · ${seller.users.map((u) => u.label).join(", ")}`}
                  </p>
                </div>
                <label className="flex shrink-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={seller.active}
                    onChange={(e) => activeMutation.mutate({ erpCode: seller.erpCode, active: e.target.checked })}
                    className="h-4 w-4 accent-[hsl(var(--primary))]"
                  />
                  Ativo
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {(usersQuery.data ?? []).map((user) => {
                  const linked = seller.users.some((u) => u.userId === user.id);
                  return (
                    <button
                      key={user.id}
                      type="button"
                      disabled={linkMutation.isPending}
                      onClick={() =>
                        linkMutation.mutate({ sellerErpCode: seller.erpCode, userId: user.id, linked: !linked })
                      }
                      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-medium transition-colors ${
                        linked ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                      }`}
                    >
                      {linked ? <Link2 className="h-3.5 w-3.5" /> : <Link2Off className="h-3.5 w-3.5" />}
                      {user.name}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <Pager page={page} total={filtered.length} size={SIZE} onChange={setPage} />
        </div>
      )}
    </AdminPage>
  );
}
