/**
 * Sanitização para relatórios/logs de importação.
 * NUNCA emitir CNPJ/CPF, endereço ou dados financeiros completos.
 */

/** Mascara sequências longas de dígitos (CPF/CNPJ/CEP/telefone/valores). */
export function maskDigits(input: string): string {
  return input.replace(/\d/g, (_d, offset: number, s: string) => {
    // preserva blocos curtos (ex.: código de 2 dígitos do tipo), mascara o resto
    return "•";
  });
}

/**
 * Gera um trecho SEGURO de um registro para diagnóstico:
 * mostra apenas tipo, comprimento e um preview mascarado curto.
 */
export function safeSnippet(line: string, previewLen = 8): string {
  const type = line.slice(0, 2);
  const preview = line
    .slice(0, previewLen)
    .replace(/[^\x20-\x7E]/g, "·")
    .replace(/\d/g, "•");
  return `tipo=${type} len=${line.length} preview="${preview}…"`;
}

/** Remove qualquer conteúdo potencialmente sensível de uma mensagem livre. */
export function sanitizeMessage(msg: string): string {
  // mascara qualquer sequência de 5+ dígitos
  return msg.replace(/\d{5,}/g, (m) => "•".repeat(m.length));
}
