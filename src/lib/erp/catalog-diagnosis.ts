/**
 * Diagnóstico do Catálogo (prompt seção 22).
 * Classifica códigos de produto a partir dos registros do ERP.
 * Puro/testável. Estados de workflow (pendente/inativo/liberado-manual) vivem no
 * banco e NÃO são derivados do arquivo — aqui computamos apenas o que o arquivo revela.
 */
import type { ParsedRecords } from "./parser/dados-v4";

export interface CatalogDiagnosis {
  inCatalog: number; // presente no tipo 22
  stockOnly: number; // em 27, não em 22
  priceOnly: number; // em 28, não em 22
  catalogNoStockRow: number; // catálogo sem linha de estoque
  catalogNegativeStock: number; // catálogo com estoque negativo
  catalogZeroStock: number; // catálogo com estoque zero
  catalogPositiveStock: number; // catálogo com estoque positivo
  catalogNoPriceAnywhere: number; // catálogo sem preço em nenhuma tabela
  unknownGroup: number; // grupo do produto não existe no tipo 44
  totalDistinctProductCodes: number; // universo (22 ∪ 27 ∪ 28)
}

export function diagnoseCatalog(records: ParsedRecords): CatalogDiagnosis {
  const catalog = new Set(records.products.map((p) => p.erpCode));
  const stockByCode = new Map<string, number | null>();
  for (const inv of records.inventory) stockByCode.set(inv.erpProductCode, inv.quantity);
  const priceCodes = new Set(records.prices.map((p) => p.erpProductCode));
  const knownGroups = new Set(records.productGroups.map((g) => g.erpCode));

  let catalogNoStockRow = 0;
  let catalogNegativeStock = 0;
  let catalogZeroStock = 0;
  let catalogPositiveStock = 0;
  let catalogNoPriceAnywhere = 0;
  let unknownGroup = 0;

  for (const p of records.products) {
    const q = stockByCode.has(p.erpCode) ? stockByCode.get(p.erpCode)! : undefined;
    if (q === undefined || q === null) catalogNoStockRow += 1;
    else if (q < 0) catalogNegativeStock += 1;
    else if (q === 0) catalogZeroStock += 1;
    else catalogPositiveStock += 1;

    if (!priceCodes.has(p.erpCode)) catalogNoPriceAnywhere += 1;
    if (p.erpGroupCode !== "" && !knownGroups.has(p.erpGroupCode)) unknownGroup += 1;
  }

  const stockCodes = new Set(stockByCode.keys());
  const stockOnly = [...stockCodes].filter((c) => !catalog.has(c)).length;
  const priceOnly = [...priceCodes].filter((c) => !catalog.has(c)).length;

  const universe = new Set<string>([...catalog, ...stockCodes, ...priceCodes]);

  return {
    inCatalog: catalog.size,
    stockOnly,
    priceOnly,
    catalogNoStockRow,
    catalogNegativeStock,
    catalogZeroStock,
    catalogPositiveStock,
    catalogNoPriceAnywhere,
    unknownGroup,
    totalDistinctProductCodes: universe.size,
  };
}
