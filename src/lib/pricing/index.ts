import type { PriceTable, Product } from "@/lib/domain/types";

export type PriceResolution =
  | { ok: true; value: number; levelLabel: string }
  | { ok: false; reason: "table_unmapped" | "no_price"; message: string };

/**
 * Preço = product_prices[tabela do cliente].value[nível mapeado].
 * Sem mapeamento de nível → bloqueio (nunca exibir preço nem gerar pedido).
 */
export function resolvePrice(product: Product, table: PriceTable | undefined): PriceResolution {
  if (!table || table.mappedLevel === null || table.levelLabel === null) {
    return {
      ok: false,
      reason: "table_unmapped",
      message: "Configuração de preço pendente: a tabela do cliente não tem nível mapeado.",
    };
  }
  const values = product.prices[table.code];
  const value = values?.[table.mappedLevel];
  if (!values || value === undefined || value <= 0) {
    return {
      ok: false,
      reason: "no_price",
      message: `Produto sem preço válido na tabela ${table.code}.`,
    };
  }
  return { ok: true, value, levelLabel: table.levelLabel };
}

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function formatDateTimeBR(iso: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(iso));
}

export function maskTaxId(taxId: string): string {
  const digits = taxId.replace(/\D/g, "");
  if (digits.length !== 14) return taxId;
  return `${digits.slice(0, 2)}.***.***/${digits.slice(8, 12)}-**`;
}
