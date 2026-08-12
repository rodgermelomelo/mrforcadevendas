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
  const brandFromDescription = firstKnownBrand(description);
  const brandFromGroup = firstKnownBrand(groupLabel ?? "");
  const brand = brandFromDescription ?? brandFromGroup ?? "OUTROS";

  const category =
    firstKnownCategory(description) ??
    firstKnownCategory(groupLabel ?? "") ??
    categoryFromGroupLabel(groupLabel, brand) ??
    "DIVERSOS";

  return {
    brand,
    category: normalizeTaxonomyText(category),
  };
}

export function productGroupLabelMap(groups: CodeLabelRecord[]) {
  return new Map(groups.map((group) => [group.erpCode, group.label]));
}
