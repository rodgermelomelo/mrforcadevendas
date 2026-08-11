import type {
  Authority,
  BlockingError,
  CommercialException,
  Customer,
  ExceptionType,
  PriceTable,
  Product,
} from "@/lib/domain/types";

/**
 * Matriz de aprovação configurável (Fase 1: configuração em memória,
 * Fase 2: tabela approval_rules no banco). Nenhum valor fixo no motor.
 */
export interface ApprovalRule {
  exception: ExceptionType;
  /** Faixa de % de desconto (quando aplicável). */
  minPercent?: number;
  maxPercent?: number;
  /** Faixa de valor total do pedido (quando aplicável). */
  minAmount?: number;
  maxAmount?: number;
  authority: Authority;
}

export const approvalMatrix: ApprovalRule[] = [
  { exception: "discount_item", minPercent: 0.01, maxPercent: 5, authority: "supervisor" },
  { exception: "discount_item", minPercent: 5.01, maxPercent: 12, authority: "gerente_comercial" },
  { exception: "discount_item", minPercent: 12.01, authority: "administrador" },
  { exception: "discount_order", minPercent: 0.01, maxPercent: 5, authority: "supervisor" },
  { exception: "discount_order", minPercent: 5.01, maxPercent: 12, authority: "gerente_comercial" },
  { exception: "discount_order", minPercent: 12.01, authority: "administrador" },
  { exception: "insufficient_stock", authority: "supervisor" },
  { exception: "non_standard_terms", authority: "gerente_comercial" },
  { exception: "below_minimum", authority: "supervisor" },
  { exception: "restricted_customer", authority: "gerente_comercial" },
  { exception: "credit_limit_exceeded", authority: "administrador" },
  { exception: "bonus_order", authority: "gerente_comercial" },
];

/** Substitui a matriz em memória pela versão configurada no banco (approval_rules). */
export function setApprovalMatrix(rules: ApprovalRule[]): void {
  if (rules.length === 0) return;
  approvalMatrix.splice(0, approvalMatrix.length, ...rules);
}

const authorityRank: Record<Authority, number> = {
  vendedor_externo: 0,
  vendedor_interno: 0,
  operador_integracao: 0,
  supervisor: 1,
  gerente_comercial: 2,
  administrador: 3,
};

export const authorityLabel: Record<Authority, string> = {
  vendedor_externo: "Vendedor externo",
  vendedor_interno: "Vendedor interno",
  operador_integracao: "Operador de integração",
  supervisor: "Supervisor",
  gerente_comercial: "Gerente comercial",
  administrador: "Administrador",
};

export function resolveAuthority(
  exception: ExceptionType,
  ctx: { percent?: number; amount?: number },
): Authority {
  const candidates = approvalMatrix.filter((rule) => {
    if (rule.exception !== exception) return false;
    const p = ctx.percent ?? 0;
    const a = ctx.amount ?? 0;
    if (rule.minPercent !== undefined && p < rule.minPercent) return false;
    if (rule.maxPercent !== undefined && p > rule.maxPercent) return false;
    if (rule.minAmount !== undefined && a < rule.minAmount) return false;
    if (rule.maxAmount !== undefined && a > rule.maxAmount) return false;
    return true;
  });
  if (candidates.length === 0) return "gerente_comercial";
  return candidates.reduce((acc, r) => (authorityRank[r.authority] > authorityRank[acc] ? r.authority : acc),
    candidates[0]!.authority);
}

/** Múltiplas exceções → maior autoridade direto (não cascateia). */
export function highestAuthority(exceptions: CommercialException[]): Authority | null {
  if (exceptions.length === 0) return null;
  return exceptions.reduce<Authority>(
    (acc, e) => (authorityRank[e.authority] > authorityRank[acc] ? e.authority : acc),
    exceptions[0]!.authority,
  );
}

export interface ValidationInput {
  customer: Customer | null;
  table: PriceTable | undefined;
  lines: {
    product: Product;
    quantity: number;
    discountPercent: number;
    unitPrice: number | null;
    priceError: string | null;
  }[];
  orderDiscountPercent: number;
  isBonus: boolean;
  nonStandardTerms: boolean;
  subtotal: number;
  total: number;
}

export interface ValidationResult {
  errors: BlockingError[];
  exceptions: CommercialException[];
  requiredAuthority: Authority | null;
}

export function validateOrder(input: ValidationInput): ValidationResult {
  const errors: BlockingError[] = [];
  const exceptions: CommercialException[] = [];

  if (!input.customer) {
    errors.push({ code: "invalid_customer", label: "Cliente inválido", detail: "Selecione um cliente da sua carteira." });
  }
  if (!input.table || input.table.mappedLevel === null) {
    errors.push({
      code: "table_unmapped",
      label: "Tabela sem mapeamento de nível",
      detail: "Configuração de preço pendente para a tabela do cliente.",
    });
  }
  if (input.lines.length === 0) {
    errors.push({ code: "empty_order", label: "Pedido sem itens", detail: "Adicione ao menos um produto." });
  }

  for (const line of input.lines) {
    if (line.priceError) {
      errors.push({
        code: "product_without_price",
        label: `Produto sem preço · ${line.product.erpCode}`,
        detail: line.priceError,
      });
    }
    if (!Number.isInteger(line.quantity) || line.quantity <= 0) {
      errors.push({
        code: "invalid_quantity",
        label: `Quantidade inválida · ${line.product.erpCode}`,
        detail: "A quantidade deve ser um inteiro maior que zero.",
      });
    }
    if (line.discountPercent > 0) {
      exceptions.push({
        type: "discount_item",
        label: "Desconto por produto",
        detail: `${line.product.name}: ${line.discountPercent}% de desconto.`,
        authority: resolveAuthority("discount_item", { percent: line.discountPercent, amount: input.total }),
      });
    }
    if (line.quantity > line.product.stock) {
      exceptions.push({
        type: "insufficient_stock",
        label: "Estoque insuficiente",
        detail: `${line.product.name}: pedido ${line.quantity}, estoque ${line.product.stock}.`,
        authority: resolveAuthority("insufficient_stock", { amount: input.total }),
      });
    }
  }

  if (input.orderDiscountPercent > 0) {
    exceptions.push({
      type: "discount_order",
      label: "Desconto no pedido",
      detail: `${input.orderDiscountPercent}% sobre o total.`,
      authority: resolveAuthority("discount_order", {
        percent: input.orderDiscountPercent,
        amount: input.total,
      }),
    });
  }
  if (input.isBonus) {
    exceptions.push({
      type: "bonus_order",
      label: "Bonificação",
      detail: "Pedido marcado como bonificação.",
      authority: resolveAuthority("bonus_order", { amount: input.total }),
    });
  }
  if (input.nonStandardTerms) {
    exceptions.push({
      type: "non_standard_terms",
      label: "Condição fora do padrão",
      detail: "Condição de pagamento diferente da condição do cliente.",
      authority: resolveAuthority("non_standard_terms", { amount: input.total }),
    });
  }
  if (input.customer && input.lines.length > 0 && input.total < input.customer.minOrderValue) {
    exceptions.push({
      type: "below_minimum",
      label: "Abaixo do valor mínimo",
      detail: `Total abaixo do mínimo do cliente.`,
      authority: resolveAuthority("below_minimum", { amount: input.total }),
    });
  }
  if (input.customer?.restricted) {
    exceptions.push({
      type: "restricted_customer",
      label: "Cliente com restrição",
      detail: input.customer.restrictionReason ?? "Cliente com restrição comercial.",
      authority: resolveAuthority("restricted_customer", { amount: input.total }),
    });
  }
  if (input.customer && input.customer.openBalance + input.total > input.customer.creditLimit) {
    exceptions.push({
      type: "credit_limit_exceeded",
      label: "Limite de crédito excedido",
      detail: "Saldo em aberto somado ao pedido ultrapassa o limite.",
      authority: resolveAuthority("credit_limit_exceeded", { amount: input.total }),
    });
  }

  return { errors, exceptions, requiredAuthority: highestAuthority(exceptions) };
}
