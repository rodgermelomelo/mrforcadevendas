/**
 * Layout do arquivo ERP versão 004.0 (parser "dados-v4").
 * Comprimentos CONFIRMADOS byte a byte no arquivo real (ver docs/ERP_FILE_ANALYSIS.md).
 * Novos layouts do ERP entram como um novo módulo (dados-v5), preservando este.
 */

export const PARSER_VERSION = "dados-v4" as const;
/** Valor bruto do campo versão no header (offset [2,8)). Humanamente = "004.0". */
export const ERP_LAYOUT_VERSION = "0004.0" as const;

/** Comprimento esperado (bytes/chars) por tipo de registro. */
export const EXPECTED_LENGTHS: Readonly<Record<string, number>> = {
  "01": 23,
  "05": 47,
  "06": 56,
  "10": 432,
  "12": 49,
  "15": 132,
  "22": 105,
  "27": 26,
  "28": 62,
  "30": 38,
  "40": 33,
  "41": 44,
  "42": 33,
  "43": 23,
  "44": 29,
  "45": 29,
  "47": 53,
  "62": 71,
  "80": 117,
  "82": 94,
  "99": 20,
};

/** Rótulo humano por tipo (para relatórios/UI). */
export const TYPE_LABELS: Readonly<Record<string, string>> = {
  "01": "Cabeçalho",
  "05": "Representantes",
  "06": "Empresa",
  "10": "Clientes / carteira",
  "12": "Resumo financeiro",
  "15": "Títulos e parcelas",
  "22": "Catálogo de produtos",
  "27": "Estoque",
  "28": "Preços por tabela",
  "30": "Tabelas de preço",
  "40": "Segmentos",
  "41": "Informações de cobrança",
  "42": "Condições de pagamento",
  "43": "Formas de cobrança",
  "44": "Grupos de produto",
  "45": "Tipos adicionais",
  "47": "Cidades",
  "62": "Detalhes de condição de pagamento",
  "80": "Cabeçalhos de movimentações",
  "82": "Itens de movimentações",
  "99": "Fechamento",
};

/** Tipos cujos campos internos foram CONFIRMADOS e são extraídos pelo parser. */
export const CONFIRMED_FIELD_TYPES = new Set([
  "01",
  "05",
  "22",
  "27",
  "28",
  "30",
  "40",
  "43",
  "44",
  "45",
  "99",
]);

/**
 * Tipos com dados pessoais/financeiros cujos offsets internos ainda são inferidos:
 * extraímos apenas chaves confirmadas + linha bruta preservada.
 */
export const RAW_ONLY_TYPES = new Set([
  "06",
  "10",
  "12",
  "15",
  "41",
  "42",
  "47",
  "62",
  "80",
  "82",
]);

export type KnownRecordType = keyof typeof EXPECTED_LENGTHS;

export function isKnownType(t: string): boolean {
  return Object.prototype.hasOwnProperty.call(EXPECTED_LENGTHS, t);
}
