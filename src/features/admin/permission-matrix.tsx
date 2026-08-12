import { Fragment, useMemo, useState } from "react";
import { Info, Search, ShieldCheck } from "lucide-react";
import {
  ACCESS_LEVEL_HINT,
  ACCESS_LEVEL_LABEL,
  PERMISSION_GROUPS,
  PERMISSION_MATRIX,
  type AccessLevel,
} from "@/lib/domain/permissions";
import { ROLE_OPTIONS } from "@/lib/domain/roles";

const LEVEL_STYLE: Record<AccessLevel, string> = {
  none: "border-border bg-muted/50 text-muted-foreground",
  own: "border-primary/25 bg-primary/10 text-primary",
  team: "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  full: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

export function PermissionMatrix() {
  const [term, setTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const roles = useMemo(
    () =>
      roleFilter === "all" ? ROLE_OPTIONS : ROLE_OPTIONS.filter((r) => r.value === roleFilter),
    [roleFilter],
  );

  const modules = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return PERMISSION_MATRIX;
    return PERMISSION_MATRIX.filter(
      (m) => m.name.toLowerCase().includes(q) || m.description.toLowerCase().includes(q),
    );
  }, [term]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Buscar módulo"
            className="w-full rounded-xl border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        >
          <option value="all">Todos os perfis</option>
          {ROLE_OPTIONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        {(Object.keys(ACCESS_LEVEL_LABEL) as AccessLevel[]).map((level) => (
          <span
            key={level}
            title={ACCESS_LEVEL_HINT[level]}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${LEVEL_STYLE[level]}`}
          >
            {ACCESS_LEVEL_LABEL[level]}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-semibold">
                Módulo
              </th>
              {roles.map((r) => (
                <th key={r.value} className="px-3 py-3 text-center text-xs font-semibold">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => {
              const rows = modules.filter((m) => m.group === group);
              if (rows.length === 0) return null;
              return (
                <Fragment key={group}>
                  <tr className="bg-background/60">
                    <td
                      colSpan={roles.length + 1}
                      className="sticky left-0 px-4 py-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground"
                    >
                      {group}
                    </td>
                  </tr>
                  {rows.map((m) => (
                    <tr key={m.key} className="border-t border-border/70">
                      <td className="sticky left-0 z-10 bg-card px-4 py-3">
                        <p className="font-medium">{m.name}</p>
                        <p className="text-xs text-muted-foreground">{m.description}</p>
                      </td>
                      {roles.map((r) => {
                        const level = m.access[r.value];
                        return (
                          <td key={r.value} className="px-3 py-3 text-center">
                            <span
                              title={ACCESS_LEVEL_HINT[level]}
                              className={`inline-block rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${LEVEL_STYLE[level]}`}
                            >
                              {ACCESS_LEVEL_LABEL[level]}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {modules.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nenhum módulo encontrado para “{term}”.
        </p>
      )}

      <div className="flex gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Para <strong className="text-foreground">ajustar</strong> o que uma pessoa enxerga, altere
          o perfil em Usuários e Papéis. Para supervisores e gerentes, o alcance de “Equipe” é
          definido pela visibilidade de representantes — só aparecem as carteiras liberadas, nunca
          todas automaticamente.
        </p>
      </div>

      <div className="flex gap-3 rounded-2xl border border-dashed border-border p-4 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Esta matriz reflete as regras de segurança aplicadas no banco de dados. Menus escondidos
          são apenas a camada visual: mesmo em acesso direto, os dados fora do alcance do perfil
          continuam bloqueados.
        </p>
      </div>
    </div>
  );
}
