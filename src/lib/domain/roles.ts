import type { AppRole } from "@/lib/provisioning.functions";

/** Rótulos oficiais dos perfis de acesso, usados em toda a aplicação. */
export const ROLE_LABEL: Record<string, string> = {
  vendedor_externo: "Vendedor externo",
  vendedor_interno: "Vendedor interno",
  supervisor: "Supervisor",
  gerente_comercial: "Gerente comercial",
  administrador: "Administrador",
  operador_integracao: "Operador de integração",
};

/** Opções ordenadas para selects de perfil. */
export const ROLE_OPTIONS: { value: AppRole; label: string }[] = [
  { value: "vendedor_externo", label: ROLE_LABEL["vendedor_externo"]! },
  { value: "vendedor_interno", label: ROLE_LABEL["vendedor_interno"]! },
  { value: "supervisor", label: ROLE_LABEL["supervisor"]! },
  { value: "gerente_comercial", label: ROLE_LABEL["gerente_comercial"]! },
  { value: "administrador", label: ROLE_LABEL["administrador"]! },
  { value: "operador_integracao", label: ROLE_LABEL["operador_integracao"]! },
];

export function roleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

/** Perfis com poder de supervisão sobre carteiras de terceiros. */
export const SUPERVISORY_ROLES = ["supervisor", "gerente_comercial"] as const;

export function isSupervisoryRole(role: string): boolean {
  return (SUPERVISORY_ROLES as readonly string[]).includes(role);
}
