import type { AppRole } from "@/lib/provisioning.functions";

/** Níveis de acesso possíveis para cada módulo do sistema. */
export type AccessLevel = "none" | "own" | "team" | "full";

export const ACCESS_LEVEL_LABEL: Record<AccessLevel, string> = {
  none: "Sem acesso",
  own: "Própria carteira",
  team: "Equipe",
  full: "Total",
};

export const ACCESS_LEVEL_HINT: Record<AccessLevel, string> = {
  none: "O módulo não aparece e as operações são bloqueadas.",
  own: "Enxerga e opera apenas sobre os próprios clientes e pedidos.",
  team: "Enxerga os representantes liberados na visibilidade de equipe.",
  full: "Acesso completo, incluindo configurações administrativas.",
};

export type PermissionModule = {
  key: string;
  name: string;
  description: string;
  group: "Comercial" | "Gestão" | "Administração";
  access: Record<AppRole, AccessLevel>;
};

export const PERMISSION_GROUPS = ["Comercial", "Gestão", "Administração"] as const;

/**
 * Matriz base do sistema. Reflete as regras de segurança aplicadas no backend
 * (RLS + verificações de papel nas funções de servidor).
 */
export const PERMISSION_MATRIX: PermissionModule[] = [
  {
    key: "dashboard",
    name: "Painel comercial",
    description: "Metas, total vendido e pedidos em análise.",
    group: "Comercial",
    access: {
      vendedor_externo: "own",
      vendedor_interno: "own",
      supervisor: "team",
      gerente_comercial: "team",
      administrador: "full",
      operador_integracao: "own",
    },
  },
  {
    key: "carteira",
    name: "Minha carteira",
    description: "Clientes vinculados, situação financeira e histórico.",
    group: "Comercial",
    access: {
      vendedor_externo: "own",
      vendedor_interno: "own",
      supervisor: "team",
      gerente_comercial: "team",
      administrador: "full",
      operador_integracao: "none",
    },
  },
  {
    key: "catalogo",
    name: "Catálogo e preços",
    description: "Produtos, marcas e níveis de preço do cliente atendido.",
    group: "Comercial",
    access: {
      vendedor_externo: "own",
      vendedor_interno: "own",
      supervisor: "team",
      gerente_comercial: "team",
      administrador: "full",
      operador_integracao: "own",
    },
  },
  {
    key: "pedidos",
    name: "Pedidos",
    description: "Criar, revisar e acompanhar pedidos.",
    group: "Comercial",
    access: {
      vendedor_externo: "own",
      vendedor_interno: "own",
      supervisor: "team",
      gerente_comercial: "team",
      administrador: "full",
      operador_integracao: "team",
    },
  },
  {
    key: "aprovacoes",
    name: "Central de aprovações",
    description: "Decidir exceções comerciais que exigem autoridade.",
    group: "Gestão",
    access: {
      vendedor_externo: "none",
      vendedor_interno: "none",
      supervisor: "team",
      gerente_comercial: "team",
      administrador: "full",
      operador_integracao: "none",
    },
  },
  {
    key: "equipe",
    name: "Equipe",
    description: "Acompanhamento de representantes e desempenho.",
    group: "Gestão",
    access: {
      vendedor_externo: "none",
      vendedor_interno: "none",
      supervisor: "team",
      gerente_comercial: "team",
      administrador: "full",
      operador_integracao: "none",
    },
  },
  {
    key: "metas",
    name: "Metas",
    description: "Definir e editar metas mensais dos representantes.",
    group: "Gestão",
    access: {
      vendedor_externo: "none",
      vendedor_interno: "none",
      supervisor: "team",
      gerente_comercial: "team",
      administrador: "full",
      operador_integracao: "none",
    },
  },
  {
    key: "estoque",
    name: "Produtos, estoque e marcas",
    description: "Curadoria de catálogo, marcas e categorias.",
    group: "Administração",
    access: {
      vendedor_externo: "none",
      vendedor_interno: "none",
      supervisor: "none",
      gerente_comercial: "none",
      administrador: "full",
      operador_integracao: "full",
    },
  },
  {
    key: "importacao",
    name: "Importação do ERP",
    description: "Publicação atômica do arquivo dados-v4.",
    group: "Administração",
    access: {
      vendedor_externo: "none",
      vendedor_interno: "none",
      supervisor: "none",
      gerente_comercial: "none",
      administrador: "full",
      operador_integracao: "full",
    },
  },
  {
    key: "regras",
    name: "Regras de aprovação",
    description: "Matriz de autoridade para exceções comerciais.",
    group: "Administração",
    access: {
      vendedor_externo: "none",
      vendedor_interno: "none",
      supervisor: "none",
      gerente_comercial: "none",
      administrador: "full",
      operador_integracao: "none",
    },
  },
  {
    key: "usuarios",
    name: "Usuários e papéis",
    description: "Criar usuários, definir perfis e visibilidade.",
    group: "Administração",
    access: {
      vendedor_externo: "none",
      vendedor_interno: "none",
      supervisor: "none",
      gerente_comercial: "none",
      administrador: "full",
      operador_integracao: "none",
    },
  },
  {
    key: "diagnostico",
    name: "Diagnóstico e integração",
    description: "Fila de envio ao ERP, erros e reprocessamento.",
    group: "Administração",
    access: {
      vendedor_externo: "none",
      vendedor_interno: "none",
      supervisor: "none",
      gerente_comercial: "none",
      administrador: "full",
      operador_integracao: "full",
    },
  },
];

/** Níveis que um módulo aceita, do menor para o maior. */
export const ACCESS_LEVELS: AccessLevel[] = ["none", "own", "team", "full"];

export function nextAccessLevel(level: AccessLevel): AccessLevel {
  const i = ACCESS_LEVELS.indexOf(level);
  return ACCESS_LEVELS[(i + 1) % ACCESS_LEVELS.length]!;
}
