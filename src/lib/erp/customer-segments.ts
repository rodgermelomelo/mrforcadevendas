/**
 * Resolução do segmento comercial de cada cliente a partir do registro tipo 10.
 *
 * O layout do ERP não documenta o offset exato do campo "segmento" (marcado 🟡
 * em docs/DATA_DICTIONARY.md). Em vez de chutar uma posição, detectamos a coluna
 * por evidência: procuramos o offset cuja janela de 3 caracteres bate com o
 * catálogo de segmentos (tipo 40) na maior parte dos clientes.
 *
 * Tudo aqui é puro e sem PII: trabalhamos apenas com códigos, nunca com nome,
 * documento, endereço ou telefone do cliente.
 */
import type { CustomerRecord } from "./parser/records";

export const SEGMENT_CODE_WIDTH = 3;

/** Região do registro tipo 10 onde o campo de segmento pode estar (após UF). */
const SCAN_START = 291;
const SCAN_END = 429; // 429..432 é a tabela de preço (confirmada)

/** Confiança mínima da coluna detectada para aplicarmos os segmentos. */
const MIN_COLUMN_CONFIDENCE = 0.6;

export type SegmentAuditStatus = "updated" | "unchanged" | "skipped" | "failed";

export interface SegmentAuditEntry {
  customerErpCode: string;
  previousSegmentCode: string | null;
  newSegmentCode: string | null;
  status: SegmentAuditStatus;
  /** Motivo em código estável e sanitizado (sem PII). */
  reason: string;
}

export interface SegmentColumnDetection {
  offset: number | null;
  confidence: number;
  matched: number;
  scanned: number;
}

export interface SegmentResolutionResult {
  detection: SegmentColumnDetection;
  /** Segmento resolvido por código de cliente (apenas os reconhecidos). */
  resolved: Map<string, string>;
  entries: SegmentAuditEntry[];
  totals: Record<SegmentAuditStatus, number>;
}

function windowAt(raw: string, offset: number): string {
  return raw.slice(offset, offset + SEGMENT_CODE_WIDTH).trim();
}

/** Descobre em qual offset o código de segmento aparece, por taxa de acerto. */
export function detectSegmentColumn(
  customers: CustomerRecord[],
  validCodes: Set<string>,
): SegmentColumnDetection {
  const scanned = customers.length;
  if (scanned === 0 || validCodes.size === 0) {
    return { offset: null, confidence: 0, matched: 0, scanned };
  }

  let best: SegmentColumnDetection = { offset: null, confidence: 0, matched: 0, scanned };
  for (let offset = SCAN_START; offset + SEGMENT_CODE_WIDTH <= SCAN_END; offset += 1) {
    let matched = 0;
    for (const customer of customers) {
      const value = windowAt(customer.raw, offset);
      if (value && validCodes.has(value)) matched += 1;
    }
    const confidence = matched / scanned;
    if (confidence > best.confidence) best = { offset, confidence, matched, scanned };
  }
  return best;
}

/**
 * Monta o resultado da importação de segmentos + as linhas de auditoria.
 * `currentByCustomer` traz o segmento já gravado hoje (para detectar mudanças).
 */
export function resolveCustomerSegments(
  customers: CustomerRecord[],
  segmentCodes: Iterable<string>,
  currentByCustomer: Map<string, string | null>,
): SegmentResolutionResult {
  const validCodes = new Set<string>();
  for (const code of segmentCodes) {
    const clean = String(code ?? "").trim();
    if (clean) validCodes.add(clean);
  }

  const detection = detectSegmentColumn(customers, validCodes);
  const resolved = new Map<string, string>();
  const entries: SegmentAuditEntry[] = [];
  const totals: Record<SegmentAuditStatus, number> = { updated: 0, unchanged: 0, skipped: 0, failed: 0 };

  const seen = new Set<string>();
  const columnUsable = detection.offset !== null && detection.confidence >= MIN_COLUMN_CONFIDENCE;

  for (const customer of customers) {
    const code = customer.erpCode;
    if (!code || seen.has(code)) continue;
    seen.add(code);

    const previous = currentByCustomer.get(code) ?? null;

    if (validCodes.size === 0) {
      entries.push({
        customerErpCode: code,
        previousSegmentCode: previous,
        newSegmentCode: null,
        status: "skipped",
        reason: "catalogo_de_segmentos_vazio",
      });
      totals.skipped += 1;
      continue;
    }

    if (!columnUsable) {
      entries.push({
        customerErpCode: code,
        previousSegmentCode: previous,
        newSegmentCode: null,
        status: "skipped",
        reason: "coluna_de_segmento_nao_identificada",
      });
      totals.skipped += 1;
      continue;
    }

    const raw = windowAt(customer.raw, detection.offset!);
    if (!raw) {
      entries.push({
        customerErpCode: code,
        previousSegmentCode: previous,
        newSegmentCode: null,
        status: "failed",
        reason: "segmento_ausente_no_registro",
      });
      totals.failed += 1;
      continue;
    }

    if (!validCodes.has(raw)) {
      entries.push({
        customerErpCode: code,
        previousSegmentCode: previous,
        newSegmentCode: null,
        status: "failed",
        reason: "codigo_fora_do_catalogo",
      });
      totals.failed += 1;
      continue;
    }

    resolved.set(code, raw);
    if (previous === raw) {
      entries.push({
        customerErpCode: code,
        previousSegmentCode: previous,
        newSegmentCode: raw,
        status: "unchanged",
        reason: "sem_alteracao",
      });
      totals.unchanged += 1;
    } else {
      entries.push({
        customerErpCode: code,
        previousSegmentCode: previous,
        newSegmentCode: raw,
        status: "updated",
        reason: previous ? "segmento_substituido" : "segmento_definido",
      });
      totals.updated += 1;
    }
  }

  return { detection, resolved, entries, totals };
}

/** Rótulos amigáveis dos motivos técnicos usados na auditoria. */
export const SEGMENT_REASON_LABELS: Record<string, string> = {
  catalogo_de_segmentos_vazio: "Arquivo não trouxe a tabela de segmentos",
  coluna_de_segmento_nao_identificada: "Campo de segmento não localizado no layout do arquivo",
  segmento_ausente_no_registro: "Cliente sem segmento preenchido no ERP",
  codigo_fora_do_catalogo: "Código de segmento não existe no cadastro",
  sem_alteracao: "Já estava com este segmento",
  segmento_definido: "Segmento definido pela primeira vez",
  segmento_substituido: "Segmento alterado",
  erro_ao_gravar: "Falha ao gravar no banco",
};

export const SEGMENT_STATUS_LABELS: Record<SegmentAuditStatus, string> = {
  updated: "Atualizado",
  unchanged: "Sem alteração",
  skipped: "Ignorado",
  failed: "Falhou",
};
