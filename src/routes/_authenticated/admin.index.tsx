import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Upload,
  Tags,
  Users,
  Building2,
  Package,
  UserCog,
  ListChecks,
  Bookmark,
  Scale,
  Stethoscope,
  ScrollText,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AdminPage } from "@/components/admin/admin-page";
import { listBaseCounts } from "@/lib/admin-data.functions";
import { formatDateTimeBR } from "@/lib/pricing";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminIndexPage,
  head: () => ({
    meta: [
      { title: "Administração · MR Força de Vendas" },
      { name: "description", content: "Central administrativa: tabelas de preço, representantes, clientes, produtos, usuários e regras comerciais." },
      { property: "og:title", content: "Administração · MR Força de Vendas" },
      { property: "og:description", content: "Gerencie os dados oficiais do ERP e as regras comerciais da operação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const areas = [
  {
    to: "/admin/tabelas-preco",
    icon: Tags,
    title: "Tabelas de preço",
    text: "Defina qual dos 6 valores é o preço aplicável em cada tabela. Sem esse mapeamento o pedido é bloqueado.",
    critical: true,
  },
  { to: "/admin/representantes", icon: Users, title: "Representantes", text: "quero gerenciar os representantes também, ver lista da carteira de cliente, analisar pedidos, e etc..." },
  { to: "/admin/clientes", icon: Building2, title: "Clientes", text: "Tabela, condição, restrição, limite e valor mínimo." },
  { to: "/admin/produtos", icon: Package, title: "Produtos, estoque e preços", text: "Implemente edição em lote de marca nos produtos para eu corrigir rapidamente a marca de vários itens de uma vez." },
  { to: "/admin/usuarios", icon: UserCog, title: "Usuários e papéis", text: "Implementar um fluxo para eu criar automaticamente um usuário de autenticação para cada representante, com atribuição de perfil e validação antes de salvar." },
  { to: "/admin/marcas", icon: Bookmark, title: "Marcas", text: "Gerencie a visibilidade das marcas no catálogo. Ative ou desative para filtrar produtos automaticamente." },
  { to: "/admin/cadastros", icon: ListChecks, title: "Cadastros gerais", text: "Implemente para que o catálogo e a busca mostrem apenas marcas ativas e ocultem automaticamente as marcas desativadas." },
  { to: "/admin/regras", icon: Scale, title: "Regras comerciais", text: "Matriz de aprovação por exceção, faixa e autoridade." },
  { to: "/admin/diagnostico", icon: Stethoscope, title: "Diagnóstico do catálogo", text: "Classificação dos códigos vindos do ERP." },
  { to: "/admin/importacoes", icon: Upload, title: "Central de Importações", text: "Upload e publicação atômica do dados.txt." },
  { to: "/admin/auditoria", icon: ScrollText, title: "Auditoria", text: "Registro sanitizado das alterações administrativas." },
] as const;

function AdminIndexPage() {
  const load = useServerFn(listBaseCounts);
  const counts = useQuery({ queryKey: ["admin", "base-counts"], queryFn: () => load() });

  return (
    <AdminPage
      backTo={false}
      title="Administração"
      description="Gestão dos dados oficiais recebidos do ERP e das regras que governam os pedidos."
    >
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Bases recebidas do ERP</h2>
          <span className="text-xs text-muted-foreground">
            {counts.data?.lastImport
              ? `Última publicação em ${formatDateTimeBR(counts.data.lastImport)}`
              : "Nenhuma importação publicada ainda"}
          </span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {counts.isLoading
            ? Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)
            : (counts.data?.counts ?? []).map((c) => (
                <div key={c.key} className="rounded-xl border border-border px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
                  <p className="text-lg font-semibold">{c.count.toLocaleString("pt-BR")}</p>
                </div>
              ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => (
          <Link
            key={area.to}
            to={area.to}
            className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-gradient text-primary-foreground">
              <area.icon className="h-5 w-5" />
            </span>
            <h2 className="mt-4 font-semibold">{area.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{area.text}</p>
            {"critical" in area && area.critical && (
              <span className="mt-3 inline-block rounded-full bg-destructive/10 px-2.5 py-0.5 text-[11px] font-semibold text-destructive">
                Crítico para pedidos
              </span>
            )}
          </Link>
        ))}
      </div>
    </AdminPage>
  );
}
