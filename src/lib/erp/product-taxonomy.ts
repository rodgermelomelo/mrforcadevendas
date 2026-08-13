import type { ProductRecord, CodeLabelRecord } from "./parser/records";

export interface ProductTaxonomySuggestion {
  brand: string;
  category: string;
  segment: string;
}

const BRAND_ALIASES: Record<string, string> = {
  DAILUS: "DAILUS",
  ACEMAR: "ACEMAR",
  "AGUA DE CHEIRO": "ÁGUA DE CHEIRO",
  "ÁGUA DE CHEIRO": "ÁGUA DE CHEIRO",
  "DIVINA FLORA": "DIVINA FLORA",
  CUCCIO: "CUCCIO",
  VERNISSAGE: "VERNISSAGE",
  FOX: "FOX",
};

const CATEGORY_ALIASES: Record<string, string> = {
  AMACIANTE: "AMACIANTE",
  AMOLECEDOR: "AMOLECEDOR",
  BASE: "BASE",
  BATOM: "BATOM",
  BLUSH: "BLUSH",
  ESMALTE: "ESMALTE",
  PINCEL: "PINCEL",
  "PO COMPACTO": "PÓ COMPACTO",
  "PÓ COMPACTO": "PÓ COMPACTO",
  CORRETIVO: "CORRETIVO",
  ILUMINADOR: "ILUMINADOR",
  MASCARA: "MÁSCARA",
  MÁSCARA: "MÁSCARA",
  DELINEADOR: "DELINEADOR",
  SOMBRA: "SOMBRA",
  REMOVEDOR: "REMOVEDOR",
  HIDRATANTE: "HIDRATANTE",
  SABONETE: "SABONETE",
  PERFUME: "PERFUME",
  COLONIA: "COLÔNIA",
  COLÔNIA: "COLÔNIA",
  "BODY SPLASH": "BODY SPLASH",
  OLEO: "ÓLEO",
  ÓLEO: "ÓLEO",
  SHAMPOO: "SHAMPOO",
  CONDICIONADOR: "CONDICIONADOR",
  LAPIS: "LAPIS",
  LÁPIS: "LAPIS",
  LENCO: "LENÇO",
  LENÇO: "LENÇO",
  MANTEIGA: "MANTEIGA",
  TOALHA: "TOALHA",
  LAPISEIRA: "LAPISEIRA",
  BABADO: "BABADO",
  GOTA: "GOTA",
  SECANTE: "SECANTE",
  SOLUCAO: "SOLUÇÃO",
  SOLUÇÃO: "SOLUÇÃO",
  BASE: "BASE",
  BATOM: "BATOM",
  BLUSH: "BLUSH",
  BODY: "BODY",
  CANETA: "CANETA",
  CHOCO: "CHOCO",
  CONTORNO: "CONTORNO",
};

/**
 * Mapeamento manual de categorias para marcas (Curadoria Admin).
 * Quando uma categoria deve SEMPRE pertencer a uma marca específica.
 */
const CATEGORY_TO_BRAND_OVERRIDE: Record<string, string> = {
  AMACIANTE: "ACEMAR",
  AMOLECEDOR: "ACEMAR",
  GOTA: "ACEMAR",
  MANTEIGA: "ACEMAR",
  OLEO: "ACEMAR",
  SECANTE: "ACEMAR",
  SOLUCAO: "ACEMAR",
  TOALHA: "ACEMAR",
  BABADO: "DAILUS",
  BASE: "DAILUS",
  BATOM: "DAILUS",
  BLUSH: "DAILUS",
  BODY: "DAILUS",
  CANETA: "DAILUS",
  CHOCO: "DAILUS",
  CONTORNO: "DAILUS",
};

function normalizeTaxonomyText(value: string) {
  return value
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstKnownBrand(value: string): string | null {
  const normalized = normalizeTaxonomyText(value);
  for (const [alias, canonical] of Object.entries(BRAND_ALIASES)) {
    if (normalized.includes(normalizeTaxonomyText(alias))) return canonical;
  }
  return null;
}

function firstKnownCategory(value: string): string | null {
  const normalized = normalizeTaxonomyText(value);
  for (const [alias, canonical] of Object.entries(CATEGORY_ALIASES)) {
    if (normalized.includes(normalizeTaxonomyText(alias))) return canonical;
  }
  return null;
}

function categoryFromGroupLabel(groupLabel: string | undefined, brand: string | null): string | null {
  if (!groupLabel) return null;
  const parts = groupLabel.split(/\s*-\s*/);
  if (parts.length > 1) return normalizeTaxonomyText(parts.slice(1).join(" - "));

  const normalized = normalizeTaxonomyText(groupLabel);
  const brandNormalized = brand ? normalizeTaxonomyText(brand) : "";
  const withoutBrand = brandNormalized ? normalized.replace(brandNormalized, "").replace(/^-/, "").trim() : normalized;
  return withoutBrand || null;
}

export function inferProductTaxonomy(product: ProductRecord, groupLabel: string | undefined): ProductTaxonomySuggestion {
  const description = product.officialDescription || "";
  
  const category = normalizeTaxonomyText(
    firstKnownCategory(description) ??
    firstKnownCategory(groupLabel ?? "") ??
    categoryFromGroupLabel(groupLabel, null) ??
    "DIVERSOS"
  );

  // Se a categoria tem um override de marca, use-o.
  const forcedBrand = CATEGORY_TO_BRAND_OVERRIDE[category];
  
  const brandFromDescription = firstKnownBrand(description);
  const brandFromGroup = firstKnownBrand(groupLabel ?? "");
  const brand = forcedBrand ?? brandFromDescription ?? brandFromGroup ?? "OUTROS";

  // Bloqueio de marcas/produtos indesejados (ex: VEÍCULOS)
  if (brand === "VEICULOS" || brand === "VEÍCULOS") {
    return {
      brand: "OUTROS",
      category: "DIVERSOS",
      segment: "GERAL",
    };
  }

  // Inferência de segmento baseada na descrição e histórico do ERP
  let segment = "GERAL";
  const descNorm = normalizeTaxonomyText(description);
  const groupNorm = groupLabel ? normalizeTaxonomyText(groupLabel) : "";
  const combined = `${descNorm} ${groupNorm}`;

  if (combined.includes("FARMACIA") || combined.includes("MEDICAM") || combined.includes("DROGARIA")) segment = "FARMÁCIA";
  else if (combined.includes("MERCADO") || combined.includes("ALIMENT") || combined.includes("SUPERMERCADO") || combined.includes("MERCEARIA")) segment = "MERCADO";
  else if (combined.includes("COSMETICO") || combined.includes("BELEZA") || combined.includes("PERFUMARIA")) segment = "COSMÉTICOS";
  else if (combined.includes("SALÃO") || combined.includes("CABELEIREIRO")) segment = "PROFISSIONAL";

  return {
    brand,
    category,
    segment,
  };
}

export function productGroupLabelMap(groups: CodeLabelRecord[]) {
  return new Map(groups.map((group) => [group.erpCode, group.label]));
}
