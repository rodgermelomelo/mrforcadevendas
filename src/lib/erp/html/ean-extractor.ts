/**
 * Extrator de EAN do romaneio FastReport (prompt seção 25).
 * Extrai SOMENTE a relação `código do produto → EAN → descrição`.
 * NÃO importa clientes, CNPJ, pedidos ou financeiro. Origem: erp_fastreport_html.
 *
 * O HTML é fonte COMPLEMENTAR de enriquecimento, não sincronização operacional.
 */

export interface EanRelation {
  /** Código do produto no ERP, normalizado para 6 dígitos (zero-padded). */
  productErpCode: string;
  ean: string;
  descriptionHint: string;
  source: "erp_fastreport_html";
}

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Normaliza um código do HTML (sem zeros à esquerda) para 6 dígitos do ERP. */
export function normalizeProductCode(code: string): string {
  const digits = code.replace(/\D/g, "");
  return digits.padStart(6, "0").slice(-6);
}

/**
 * Extrai as relações produto→EAN→descrição de um HTML FastReport.
 * Heurística: cada célula com exatamente 13 dígitos é um EAN; buscamos o código
 * (3–6 dígitos) nas células anteriores e a descrição na célula textual seguinte.
 */
export function extractEanRelations(html: string): EanRelation[] {
  const cells = (html.match(/>([^<>]{1,200})</g) ?? [])
    .map((m) => unescapeHtml(m.slice(1, -1)).trim())
    .filter((c) => c.length > 0);

  const seen = new Set<string>();
  const out: EanRelation[] = [];

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    if (!/^\d{13}$/.test(cell)) continue;
    const ean = cell;
    if (seen.has(ean)) continue;

    // O código é a célula de dígitos mais próxima ANTES do EAN (layout: código, EAN, descrição, qtd).
    // 1–6 dígitos (códigos pequenos como "80" existem); 13+ dígitos (EAN/CNPJ) nunca casam.
    let code: string | null = null;
    for (let j = Math.max(0, i - 4); j < i; j++) {
      if (/^\d{1,6}$/.test(cells[j]!)) code = cells[j]!;
    }
    let desc = "";
    for (let j = i + 1; j < Math.min(cells.length, i + 4); j++) {
      if (/[A-Za-zÀ-ÿ]{3,}/.test(cells[j]!)) {
        desc = cells[j]!;
        break;
      }
    }
    if (!code) continue;
    seen.add(ean);
    out.push({
      productErpCode: normalizeProductCode(code),
      ean,
      descriptionHint: desc,
      source: "erp_fastreport_html",
    });
  }
  return out;
}
