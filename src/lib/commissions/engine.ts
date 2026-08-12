export interface CommissionRuleEngineRow {
  id: string;
  name: string;
  percent: number;
  brand: string | null;
  category: string | null;
  productErpCode: string | null;
  priority: number;
  validFrom: string;
  validTo: string | null;
  active: boolean;
  sellerErpCodes: string[];
}

export interface CommissionProductContext {
  erpCode: string;
  brand: string | null;
  category: string | null;
}

export interface CommissionLineInput {
  erpCode: string;
  total: number;
}

export interface CommissionLineResult {
  productErpCode: string;
  commissionPercent: number;
  commissionBase: number;
  commissionValue: number;
  commissionRuleId: string | null;
  commissionRuleName: string | null;
  commissionScope: string;
}

interface ResolveResult {
  rule: CommissionRuleEngineRow | null;
  score: number;
  scope: string;
}

function normalized(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function cents(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function resolveRule(
  rules: CommissionRuleEngineRow[],
  product: CommissionProductContext,
  sellerErpCode: string,
): ResolveResult {
  const productBrand = normalized(product.brand);
  const productCategory = normalized(product.category);
  const sellerCode = normalized(sellerErpCode);
  let best: ResolveResult = { rule: null, score: 0, scope: "sem_regra" };

  for (const rule of rules) {
    if (!rule.active) continue;
    const sellerSpecific = rule.sellerErpCodes.length > 0;
    if (sellerSpecific && !rule.sellerErpCodes.some((code) => normalized(code) === sellerCode)) continue;

    const ruleProduct = normalized(rule.productErpCode);
    const ruleBrand = normalized(rule.brand);
    const ruleCategory = normalized(rule.category);

    if (ruleProduct && ruleProduct !== normalized(product.erpCode)) continue;
    if (!ruleProduct && ruleBrand && ruleBrand !== productBrand) continue;
    if (!ruleProduct && ruleCategory && ruleCategory !== productCategory) continue;

    const scopeScore = ruleProduct
      ? 400
      : ruleBrand && ruleCategory
        ? 300
        : ruleCategory
          ? 220
          : ruleBrand
            ? 200
            : 100;
    const sellerScore = sellerSpecific ? 50 : 0;
    const score = scopeScore + sellerScore + rule.priority / 1000;
    if (score <= best.score) continue;

    const scope = ruleProduct
      ? "produto"
      : ruleBrand && ruleCategory
        ? "marca_categoria"
        : ruleCategory
          ? "categoria"
          : ruleBrand
            ? "marca"
            : "geral";
    best = { rule, score, scope };
  }

  return best;
}

export function calculateCommissionLines(input: {
  items: CommissionLineInput[];
  products: CommissionProductContext[];
  rules: CommissionRuleEngineRow[];
  sellerErpCode: string;
  orderDiscountPercent: number;
  isBonus: boolean;
}): CommissionLineResult[] {
  const productByCode = new Map(input.products.map((p) => [normalized(p.erpCode), p]));
  const orderFactor = input.isBonus ? 0 : 1 - Math.min(100, Math.max(0, input.orderDiscountPercent)) / 100;

  return input.items.map((item) => {
    const product = productByCode.get(normalized(item.erpCode)) ?? {
      erpCode: item.erpCode,
      brand: null,
      category: null,
    };
    const resolved = resolveRule(input.rules, product, input.sellerErpCode);
    const percent = resolved.rule?.percent ?? 0;
    const base = cents(item.total * orderFactor);
    const value = cents(base * (percent / 100));
    return {
      productErpCode: item.erpCode,
      commissionPercent: percent,
      commissionBase: base,
      commissionValue: value,
      commissionRuleId: resolved.rule?.id ?? null,
      commissionRuleName: resolved.rule?.name ?? null,
      commissionScope: resolved.scope,
    };
  });
}
