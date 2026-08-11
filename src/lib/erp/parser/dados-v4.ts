/**
 * Parser dados-v4 — layout ERP v004.0 (largura fixa, Latin-1, CRLF).
 * Núcleo puro e determinístico. Ver docs/ERP_FILE_ANALYSIS.md e DATA_DICTIONARY.md.
 *
 * Garantias:
 *  - decodifica Latin-1; divide por CRLF; ignora linhas vazias;
 *  - normaliza quebra interna (LF isolado) → espaço e reconstrói o registro;
 *  - valida tipo e comprimento; valida header e trailer;
 *  - reconcilia contagem lógica com o trailer;
 *  - REJEIÇÃO TOTAL em qualquer inconsistência (nunca publicação parcial);
 *  - relatório sanitizado (sem PII).
 */
import { decodeLatin1 } from "./latin1";
import {
  PARSER_VERSION,
  ERP_LAYOUT_VERSION,
  EXPECTED_LENGTHS,
  TYPE_LABELS,
  isKnownType,
} from "./layout";
import {
  extractHeader,
  extractTrailer,
  extractSeller,
  extractCustomer,
  extractProduct,
  extractInventory,
  extractPrice,
  extractCodeLabel,
  type HeaderRecord,
  type TrailerRecord,
  type SellerRecord,
  type CustomerRecord,
  type ProductRecord,
  type InventoryRecord,
  type PriceRecord,
  type CodeLabelRecord,
  type RawRecord,
} from "./records";
import { safeSnippet, sanitizeMessage } from "./sanitize";

export interface ParseError {
  line: number; // índice do registro lógico (1-based)
  type: string;
  code: string;
  message: string; // já sanitizada
}
export interface ParseWarning {
  code: string;
  message: string;
}
export interface TypeCount {
  type: string;
  label: string;
  count: number;
  expectedLength: number;
}
export interface ParsedRecords {
  header: HeaderRecord | null;
  trailer: TrailerRecord | null;
  sellers: SellerRecord[];
  customers: CustomerRecord[];
  products: ProductRecord[];
  inventory: InventoryRecord[];
  prices: PriceRecord[];
  priceTables: CodeLabelRecord[];
  segments: CodeLabelRecord[];
  billingMethods: CodeLabelRecord[];
  productGroups: CodeLabelRecord[];
  additionalTypes: CodeLabelRecord[];
  raw: RawRecord[];
}
export interface ParseReport {
  ok: boolean;
  parserVersion: string;
  layoutVersion: string | null;
  generatedDate: string | null;
  generatedTime: string | null;
  fileBytes: number;
  totalSegments: number;
  emptyLines: number;
  reconstructedRecords: number;
  logicalCount: number;
  trailerCount: number | null;
  countsMatch: boolean;
  typeCounts: TypeCount[];
  errorsCount: number;
  warningsCount: number;
}
export interface ParseResult {
  report: ParseReport;
  records: ParsedRecords;
  errors: ParseError[];
  warnings: ParseWarning[];
}

const CRLF = /\r\n/;
const INTERNAL_BREAK = /[\r\n]/g;
const MAX_REPORTED_ERRORS = 200;

function emptyRecords(): ParsedRecords {
  return {
    header: null,
    trailer: null,
    sellers: [],
    customers: [],
    products: [],
    inventory: [],
    prices: [],
    priceTables: [],
    segments: [],
    billingMethods: [],
    productGroups: [],
    additionalTypes: [],
    raw: [],
  };
}

/** Ponto de entrada: recebe bytes do arquivo. */
export function parseDadosV4(bytes: Uint8Array): ParseResult {
  const fileBytes = bytes.length;
  const text = decodeLatin1(bytes);
  const segments = text.split(CRLF);

  const errors: ParseError[] = [];
  const warnings: ParseWarning[] = [];
  const records = emptyRecords();
  const counts = new Map<string, number>();

  let emptyLines = 0;
  let reconstructedRecords = 0;
  let logicalIndex = 0; // 1-based contador de registros lógicos

  const pushError = (line: number, type: string, code: string, message: string) => {
    if (errors.length < MAX_REPORTED_ERRORS) {
      errors.push({ line, type, code, message: sanitizeMessage(message) });
    }
  };

  for (const seg of segments) {
    if (seg === "") {
      emptyLines += 1;
      continue;
    }

    // Reconstrução: normaliza quebra interna (LF/CR isolado) → espaço.
    let line = seg;
    if (seg.indexOf("\n") !== -1 || seg.indexOf("\r") !== -1) {
      line = seg.replace(INTERNAL_BREAK, " ");
      reconstructedRecords += 1;
    }

    logicalIndex += 1;
    const type = line.slice(0, 2);

    if (!isKnownType(type)) {
      pushError(logicalIndex, type, "UNKNOWN_TYPE", `Tipo de registro desconhecido (${safeSnippet(line)})`);
      continue;
    }

    const expected = EXPECTED_LENGTHS[type]!;
    if (line.length !== expected) {
      pushError(
        logicalIndex,
        type,
        "BAD_LENGTH",
        `Comprimento inválido: esperado ${expected}, obtido ${line.length} (${safeSnippet(line)})`,
      );
      // ainda contamos para reconciliação, mas o arquivo será rejeitado
    }

    counts.set(type, (counts.get(type) ?? 0) + 1);

    // Extração dos tipos confirmados (defensiva: só se comprimento ok).
    if (line.length === expected) {
      classify(type, line, records, pushError, logicalIndex);
    }
  }

  // ---- Validações estruturais ----
  const header = records.header;
  const trailer = records.trailer;

  if (!header) {
    pushError(0, "01", "MISSING_HEADER", "Cabeçalho (tipo 01) ausente.");
  } else if (header.version !== ERP_LAYOUT_VERSION) {
    pushError(
      1,
      "01",
      "VERSION_MISMATCH",
      `Versão do layout ${header.version} não é suportada por ${PARSER_VERSION} (esperado ${ERP_LAYOUT_VERSION}).`,
    );
  }

  if (!trailer) {
    pushError(logicalIndex, "99", "MISSING_TRAILER", "Trailer (tipo 99) ausente.");
  } else if (!trailer.eofValid) {
    pushError(logicalIndex, "99", "BAD_EOF", `Marcador EOF inválido: "${trailer.eofMarker}".`);
  }

  const trailerCount = trailer ? trailer.logicalCount : null;
  const countsMatch = trailerCount !== null && trailerCount === logicalIndex;
  if (trailerCount !== null && !countsMatch) {
    pushError(
      logicalIndex,
      "99",
      "COUNT_MISMATCH",
      `Contagem lógica (${logicalIndex}) diferente do trailer (${trailerCount}).`,
    );
  }

  const typeCounts: TypeCount[] = Object.keys(EXPECTED_LENGTHS)
    .map((type) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      count: counts.get(type) ?? 0,
      expectedLength: EXPECTED_LENGTHS[type]!,
    }))
    .filter((tc) => tc.count > 0);

  const ok = errors.length === 0;

  const report: ParseReport = {
    ok,
    parserVersion: PARSER_VERSION,
    layoutVersion: header ? header.version : null,
    generatedDate: header ? header.generatedDate : null,
    generatedTime: header ? header.generatedTime : null,
    fileBytes,
    totalSegments: segments.length,
    emptyLines,
    reconstructedRecords,
    logicalCount: logicalIndex,
    trailerCount,
    countsMatch,
    typeCounts,
    errorsCount: errors.length,
    warningsCount: warnings.length,
  };

  return { report, records, errors, warnings };
}

function classify(
  type: string,
  line: string,
  records: ParsedRecords,
  pushError: (line: number, type: string, code: string, message: string) => void,
  idx: number,
): void {
  try {
    switch (type) {
      case "01":
        records.header = extractHeader(line);
        break;
      case "99":
        records.trailer = extractTrailer(line);
        break;
      case "05":
        records.sellers.push(extractSeller(line));
        break;
      case "10":
        records.customers.push(extractCustomer(line));
        break;
      case "22":
        records.products.push(extractProduct(line));
        break;
      case "27":
        records.inventory.push(extractInventory(line));
        break;
      case "28":
        records.prices.push(extractPrice(line));
        break;
      case "30":
        records.priceTables.push(extractCodeLabel("30", line));
        break;
      case "40":
        records.segments.push(extractCodeLabel("40", line));
        break;
      case "43":
        records.billingMethods.push(extractCodeLabel("43", line));
        break;
      case "44":
        records.productGroups.push(extractCodeLabel("44", line));
        break;
      case "45":
        records.additionalTypes.push(extractCodeLabel("45", line));
        break;
      default:
        records.raw.push({ type, raw: line });
    }
  } catch (err) {
    pushError(idx, type, "EXTRACT_ERROR", `Falha ao extrair registro tipo ${type}.`);
  }
}

export { PARSER_VERSION };
