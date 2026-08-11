/**
 * Shapes tipados dos registros extraídos e seus extratores.
 * Só extraímos campos CONFIRMADOS. Campos inferidos/desconhecidos ficam em `raw`.
 */
import { field, rawField, parseErpNumber, normalizeUnit } from "./latin1";

export interface HeaderRecord {
  type: "01";
  version: string; // "004.0"
  generatedDate: string; // DD/MM/AAAA
  generatedTime: string; // HH:mm
}

export interface TrailerRecord {
  type: "99";
  logicalCount: number;
  eofMarker: string; // "###EOF###"
  eofValid: boolean;
}

export interface SellerRecord {
  type: "05";
  erpCode: string;
  name: string;
  inactiveHint: boolean;
  raw: string;
}

export interface CustomerRecord {
  type: "10";
  erpSellerCode: string; // [2,5) CONFIRMADO (representante, 3 díg)
  erpCode: string; // [5,11) CONFIRMADO (cliente, 6 díg)
  // Campos internos decodificados por análise de layout (🟡 pendente confirmação ERP):
  legalName: string; // razão social [11,54)
  tradeName: string; // nome fantasia [54,101)
  docType: string; // [101,102) J=jurídica, F=física
  taxId: string; // CNPJ/CPF [102,116)
  stateRegistration: string; // inscrição estadual [116,135)
  city: string; // [264,289)
  uf: string; // [289,291)
  creditLimit: number | null; // valor \d{9}\.\d{2} na cauda (🟡 financeiro, ver Q6)
  priceTableCode: string; // [429,432)
  raw: string; // linha bruta preservada
}

export interface ProductRecord {
  type: "22";
  erpCode: string;
  officialDescription: string; // parte1 + parte2 (grupo fica no meio)
  erpGroupCode: string;
  unit: string;
  erpAdditionalTypeCode: string;
  rawTail: string; // offsets 77–100: significado pendente (Q4)
}

export interface InventoryRecord {
  type: "27";
  erpBranchCode: string;
  erpProductCode: string;
  quantity: number | null;
}

export interface PriceRecord {
  type: "28";
  erpPriceTableCode: string;
  erpProductCode: string;
  values: [number | null, number | null, number | null, number | null, number | null, number | null];
}

export interface CodeLabelRecord {
  type: "30" | "40" | "43" | "44" | "45";
  erpCode: string;
  label: string;
}

export interface RawRecord {
  type: string;
  raw: string;
}

const INACTIVE_RE = /(^z\*|^z\s|\[inativo\])/i;

export function extractHeader(line: string): HeaderRecord {
  return {
    type: "01",
    version: field(line, 2, 8),
    generatedDate: field(line, 8, 18),
    generatedTime: field(line, 18, 23),
  };
}

export function extractTrailer(line: string): TrailerRecord {
  const marker = field(line, 11, 20);
  return {
    type: "99",
    logicalCount: Number(field(line, 2, 11)),
    eofMarker: marker,
    eofValid: marker === "###EOF###",
  };
}

export function extractSeller(line: string): SellerRecord {
  const name = field(line, 8, 41);
  return {
    type: "05",
    erpCode: field(line, 2, 8),
    name,
    inactiveHint: INACTIVE_RE.test(name),
    raw: line,
  };
}

const CREDIT_LIMIT_RE = /(\d{9})\.(\d{2})/;

export function extractCustomer(line: string): CustomerRecord {
  // limite: exatamente 9 dígitos + ".NN" na cauda (exclui o prefixo de 3 díg anterior)
  const lm = CREDIT_LIMIT_RE.exec(line.slice(330, 349));
  const creditLimit = lm ? Number(`${lm[1]}.${lm[2]}`) : null;
  return {
    type: "10",
    erpSellerCode: field(line, 2, 5),
    erpCode: field(line, 5, 11),
    legalName: field(line, 11, 54),
    tradeName: field(line, 54, 101),
    docType: field(line, 101, 102),
    taxId: field(line, 102, 116),
    stateRegistration: field(line, 116, 135),
    city: field(line, 264, 289),
    uf: field(line, 289, 291),
    creditLimit,
    priceTableCode: field(line, 429, 432),
    raw: line,
  };
}

export function extractProduct(line: string): ProductRecord {
  // Descrição em 2 partes NÃO contíguas: [11,51) + [55,75), com o grupo [51,55) no meio.
  const part1 = rawField(line, 11, 51);
  const part2 = rawField(line, 55, 75);
  return {
    type: "22",
    erpCode: field(line, 5, 11),
    officialDescription: (part1 + part2).replace(/\s+/g, " ").trim(),
    erpGroupCode: field(line, 51, 55),
    unit: normalizeUnit(rawField(line, 75, 77)),
    erpAdditionalTypeCode: field(line, 101, 105),
    rawTail: rawField(line, 77, 101),
  };
}

export function extractInventory(line: string): InventoryRecord {
  return {
    type: "27",
    erpBranchCode: field(line, 5, 11),
    erpProductCode: field(line, 11, 17),
    quantity: parseErpNumber(rawField(line, 17, 26)),
  };
}

export function extractPrice(line: string): PriceRecord {
  return {
    type: "28",
    erpPriceTableCode: field(line, 5, 8),
    erpProductCode: field(line, 8, 14),
    values: [
      parseErpNumber(rawField(line, 14, 22)),
      parseErpNumber(rawField(line, 22, 30)),
      parseErpNumber(rawField(line, 30, 38)),
      parseErpNumber(rawField(line, 38, 46)),
      parseErpNumber(rawField(line, 46, 54)),
      parseErpNumber(rawField(line, 54, 62)),
    ],
  };
}

const CODE_LABEL_OFFSETS: Record<string, [number, number, number]> = {
  // type: [codeStart, codeEnd, labelEnd]  (label começa em codeEnd)
  "30": [5, 8, 38],
  "40": [5, 8, 33],
  "43": [5, 8, 23],
  "44": [5, 9, 29],
  "45": [5, 9, 29],
};

export function extractCodeLabel(type: "30" | "40" | "43" | "44" | "45", line: string): CodeLabelRecord {
  const spec = CODE_LABEL_OFFSETS[type];
  if (!spec) throw new Error(`Sem offsets para tipo ${type}`);
  const [cs, ce, le] = spec;
  return { type, erpCode: field(line, cs, ce), label: field(line, ce, le) };
}
