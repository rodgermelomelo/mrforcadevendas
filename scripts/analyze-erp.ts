/**
 * Análise local (sanitizada) de um dados.txt. NÃO grava nada, NÃO conecta ao banco.
 * Uso: npm run analyze:erp -- "<caminho/dados.txt>"
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { parseDadosV4 } from "../src/lib/erp/parser/dados-v4";
import { diagnoseCatalog } from "../src/lib/erp/catalog-diagnosis";

const fmt = (n: number) => n.toLocaleString("pt-BR");

const path = process.argv[2];
if (!path) {
  console.error('Uso: npm run analyze:erp -- "<caminho/dados.txt>"');
  process.exit(1);
}
const bytes = readFileSync(path);
const hash = createHash("sha256").update(bytes).digest("hex");
const { report, records, errors } = parseDadosV4(bytes);

console.log(`\n═══ Análise ERP (parser ${report.parserVersion}) ═══`);
console.log(`  Arquivo   : ${path.split("/").pop()} · hash ${hash.slice(0, 12)}…`);
console.log(`  Versão    : ${report.layoutVersion} · gerado ${report.generatedDate} ${report.generatedTime}`);
console.log(`  Lógicos   : ${fmt(report.logicalCount)} · trailer ${report.trailerCount ? fmt(report.trailerCount) : "?"} · confere ${report.countsMatch ? "SIM ✓" : "NÃO ✗"}`);
console.log(`  Reconstr. : ${report.reconstructedRecords} · vazias ${report.emptyLines}`);
console.log(`  STATUS    : ${report.ok ? "VÁLIDO ✓" : "INVÁLIDO ✗"}`);
console.log("  Por tipo:");
for (const tc of report.typeCounts) console.log(`    ${tc.type} ${tc.label.padEnd(32)} ${fmt(tc.count).padStart(8)}`);
const d = diagnoseCatalog(records);
console.log(`  Catálogo: ${fmt(d.inCatalog)} (pos ${fmt(d.catalogPositiveStock)}/zero ${fmt(d.catalogZeroStock)}/neg ${fmt(d.catalogNegativeStock)}) · só-estoque ${fmt(d.stockOnly)} · só-preço ${fmt(d.priceOnly)}`);
if (errors.length) {
  console.log(`  Erros (${errors.length}, sanitizados):`);
  for (const e of errors.slice(0, 10)) console.log(`    ✗ [${e.line}] ${e.code}: ${e.message}`);
}
console.log("");
process.exit(report.ok ? 0 : 2);
