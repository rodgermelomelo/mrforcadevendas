/**
 * Decodificação Latin-1 (ISO-8859-1) e utilitários de campo largura-fixa.
 * Puro, sem dependências — funciona em Node, Edge e navegador.
 */

/** Decodifica bytes ISO-8859-1 → string, preservando espaços significativos. */
export function decodeLatin1(bytes: Uint8Array): string {
  // Latin-1 é um mapeamento 1:1 byte→code point (0x00–0xFF). Rápido e exato.
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, i + CHUNK);
    out += String.fromCharCode.apply(null, Array.from(slice) as number[]);
  }
  return out;
}

/** Extrai um campo por offset [start, end) e faz trim (para texto). */
export function field(line: string, start: number, end: number): string {
  return line.slice(start, end).trim();
}

/** Extrai um campo preservando espaços (para reconstrução de descrição em 2 partes). */
export function rawField(line: string, start: number, end: number): string {
  return line.slice(start, end);
}

/**
 * Converte um campo numérico do ERP em número.
 * O ERP usa ponto decimal e pode embutir o sinal "-" à direita
 * (ex.: "000-1.000" == -1.000, "00000.000" == 0).
 * Retorna null se não parseável.
 */
export function parseErpNumber(raw: string): number | null {
  const s = raw.trim();
  if (s === "") return null;
  const negative = s.includes("-");
  const cleaned = s.replace(/-/g, "");
  if (!/^\d*\.?\d*$/.test(cleaned) || cleaned === "" || cleaned === ".") return null;
  const value = Number(cleaned);
  if (Number.isNaN(value)) return null;
  return negative ? -value : value;
}

/** Normaliza unidade (ex.: "Un", "un", "UN" → "UN"). */
export function normalizeUnit(raw: string): string {
  return raw.trim().toUpperCase();
}
