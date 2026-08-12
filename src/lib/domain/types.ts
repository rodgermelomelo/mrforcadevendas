// Tipos de domínio — MR Força de Vendas (Fase 1: modo demo).

export type CommercialStatus =
  | "draft"
  | "validating"
  | "pending_approval"
  | "changes_requested"
  | "rejected"
  | "auto_approved"
  | "approved"
  | "confirmed"
  | "cancelled";

export type IntegrationStatus =
  | "not_ready"
  | "awaiting_erp_integration"
  | "sending"
  | "accepted_by_erp"
  | "integration_error";

export type Authority =
  | "vendedor_externo"
  | "vendedor_interno"
  | "supervisor"
  | "gerente_comercial"
  | "administrador"
  | "operador_integracao";

export interface PriceTable {
  code: string;
  name: string;
  /** Índice 0-5 do valor aplicável. null = mapeamento pendente (bloqueia preço). */
  mappedLevel: number | null;
  levelLabel: string | null;
}

export interface Customer {
  id: string;
  erpCode: string;
  legalName: string;
  tradeName: string;
  taxId: string;
  city: string;
  uf: string;
  segment: string;
  priceTableCode: string;
  paymentTerm: string;
  restricted: boolean;
  restrictionReason?: string | undefined;
  sellerErpCode?: string;

  creditLimit: number;
  openBalance: number;
  minOrderValue: number;
  lastOrderAt: string | null;
}

export interface Product {
  id: string;
  erpCode: string;
  name: string;
  group: string;
  category?: string | undefined;
  brand?: string | undefined;
  segment?: string | undefined;
  unit: string;
  stock: number;
  isLaunch: boolean;
  imageUrl: string | null;
  /** 6 valores por tabela de preço (chave = código da tabela). */
  prices: Record<string, number[]>;
}

export interface CartItem {
  productId: string;
  quantity: number;
  discountPercent: number;
}

export type ExceptionType =
  | "discount_item"
  | "discount_order"
  | "insufficient_stock"
  | "non_standard_terms"
  | "below_minimum"
  | "restricted_customer"
  | "credit_limit_exceeded"
  | "bonus_order"
  | "acordo_financeiro";

/** Acordo financeiro no pedido (impacta faturamento/cobrança → sempre vai à análise). */
export interface FinancialAgreement {
  /** Percentual concedido na nota fiscal. */
  nfPercent: number;
  /** Percentual concedido somente no boleto. */
  boletoPercent: number;
  /** Observação do acordo. */
  note: string;
}

export interface CommercialException {
  type: ExceptionType;
  label: string;
  detail: string;
  authority: Authority;
}

export interface BlockingError {
  code: string;
  label: string;
  detail: string;
}

export interface OrderItemSnapshot {
  productId: string;
  erpCode: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  total: number;
  commissionPercent?: number;
  commissionBase?: number;
  commissionValue?: number;
  commissionRuleId?: string | null;
  commissionRuleName?: string | null;
  commissionScope?: string;
}

export interface Order {
  id: string;
  number: string;
  createdAt: string;
  customerId: string;
  customerName: string;
  priceTableCode: string;
  priceLevelLabel: string;
  paymentTerm: string;
  sellerName: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  discountTotal: number;
  total: number;
  commissionTotal: number;
  commissionCalculatedAt: string | null;
  orderDiscountPercent: number;
  isBonus: boolean;
  notes: string;
  exceptions: CommercialException[];
  status: CommercialStatus;
  integrationStatus: IntegrationStatus;
  requiredAuthority: Authority | null;
  contentHash: string;
  history: { at: string; label: string; detail?: string | undefined }[];
}
