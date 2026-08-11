# Dicionário de Dados — `dados-v4` (layout ERP v004.0)

Mapeamento **registro ERP → campo normalizado no Força de Vendas**.
Confiança: ✅ confirmado · 🟡 inferido · ❓ desconhecido (preservar bruto).

> Offsets são **0-based, fim-exclusivo** (`[início, fim)`), sobre a string Latin-1 já decodificada. Campos texto devem sofrer `.trim()`. Campos numéricos usam ponto decimal; sinal `-` pode vir embutido à direita.

---

## Tipo 01 — Header ✅
| Campo | Offset | Tipo | Confiança |
|---|---|---|---|
| record_type | [0,2) `"01"` | str | ✅ |
| version | [2,8) → `"0004.0"` | str | ✅ |
| generated_date | [8,18) `DD/MM/AAAA` | date | ✅ |
| generated_time | [18,23) `HH:mm` | time | ✅ |

## Tipo 99 — Trailer ✅
| Campo | Offset | Confiança |
|---|---|---|
| record_type | [0,2) `"99"` | ✅ |
| logical_count | [2,11) int (`000109454`) | ✅ |
| eof_marker | [11,20) `"###EOF###"` | ✅ |

---

## Tipo 05 → `erp_sellers` ✅ (estrutura)
| Campo | Offset | DB | Confiança |
|---|---|---|---|
| erp_seller_code | [2,8) | `erp_sellers.erp_code` | ✅ |
| name | [8,~40) | `erp_sellers.name` | ✅ |
| trailing_value | [~40,47) | `raw.trailing` | ❓ |
| is_inactive (heurística `Z*`/`[INATIVO]`) | derivado do name | `erp_sellers.inactive_hint` | 🟡 |

> **Regra:** representantes **não** viram usuários automaticamente. Admin vincula manualmente (`user_erp_seller_links`).

## Tipo 10 → `customers` ✅ chave / 🟡 detalhes
| Campo | Offset | DB | Confiança |
|---|---|---|---|
| erp_seller_code | [2,5) | `customers.erp_seller_code` | ✅ |
| erp_customer_code | [5,11) | `customers.erp_code` | ✅ |
| razao_social | 🟡 | `customers.legal_name` | 🟡 |
| nome_fantasia | 🟡 | `customers.trade_name` | 🟡 |
| doc_type / cnpj_cpf | 🟡 | `customers.doc_type` / `customers.tax_id` | 🟡 |
| inscricao_estadual | 🟡 | `customers.state_registration` | 🟡 |
| endereço/número/compl/bairro/cep/cidade/uf | 🟡 | colunas de endereço | 🟡 |
| telefones/contato | 🟡 | `customers.phones` / `contact` | 🟡 |
| segmento (→ tipo 40) | 🟡 | `customers.erp_segment_code` | 🟡 |
| forma_cobranca (→ tipo 43) | 🟡 | `customers.erp_billing_code` | 🟡 |
| limite | 🟡 | `customers.credit_limit` (numeric) | 🟡 |
| erp_price_table_code (→ tipo 30) | 🟡 | `customers.erp_price_table_code` | 🟡 |
| raw_line | [0,432) | `customers.raw_line` (staging) | ✅ |

> Offsets internos 🟡 serão fixados com **amostras sintéticas** que reproduzem o layout, nunca a partir de PII real. Até lá, `raw_line` é preservada.

## Tipo 12 → `customer_financial_snapshots` 🟡
Resumo financeiro/crédito por cliente. Estrutura 49B confirmada; semântica interna 🟡. Preservar `raw_line`.

## Tipo 15 → `receivables` 🟡
Títulos/parcelas (132B). Preservar bruto; **não** exibir valores sem confirmação (permissão financeira).

## Tipo 22 → `products` ✅
| Campo | Offset | DB | Confiança |
|---|---|---|---|
| erp_product_code | [5,11) | `products.erp_code` | ✅ |
| description_part1 | [11,51) | (interno) | ✅ |
| erp_group_code (→ tipo 44) | [51,55) | `products.erp_group_code` | ✅ |
| description_part2 | [55,75) | (interno) | ✅ |
| **official_description** | `(part1+part2).trim()` | `products.official_description` | ✅ |
| unit | [75,77) → upper | `products.unit` | ✅ |
| raw_tail | [77,101) | `products.raw_tail` | ❓ |
| erp_additional_type (→ 45) | [101,105) | `products.erp_additional_type_code` | 🟡 |

## Tipo 27 → `inventory_snapshots` ✅
| Campo | Offset | DB | Confiança |
|---|---|---|---|
| erp_branch_code | [5,11) (const 000001) | `inventory_snapshots.erp_branch_code` | ✅ |
| erp_product_code | [11,17) | `inventory_snapshots.erp_product_code` | ✅ |
| quantity | [17,26) signed | `inventory_snapshots.quantity` (numeric) | ✅ |

## Tipo 28 → `product_prices` ✅
| Campo | Offset | DB | Confiança |
|---|---|---|---|
| erp_price_table_code (→ 30) | [5,8) | `product_prices.erp_price_table_code` | ✅ |
| erp_product_code | [8,14) | `product_prices.erp_product_code` | ✅ |
| value_1 | [14,22) | `product_prices.value_1` (numeric) | ✅ |
| value_2 | [22,30) | `value_2` | ✅ |
| value_3 | [30,38) | `value_3` | ✅ |
| value_4 | [38,46) | `value_4` | ✅ |
| value_5 | [46,54) | `value_5` | ✅ |
| value_6 | [54,62) | `value_6` | ✅ |

> Os 6 valores são armazenados **todos**. O "nível de preço" aplicável (qual dos 6) é **configuração administrativa** por tabela — ver OPEN_QUESTIONS Q1. **Sem esse mapeamento, o pedido é bloqueado.**

## Tipo 30 → `price_tables` ✅
| Campo | Offset | DB | Confiança |
|---|---|---|---|
| erp_code | [5,8) | `price_tables.erp_code` | ✅ |
| label | [8,38) | `price_tables.label` | ✅ |

## Tipo 40 → `segments` (ref) ✅
`erp_code` [5,8) · `label` [8,33).

## Tipo 41 → `billing_info` 🟡 (44B) — preservar bruto.

## Tipo 42 → `payment_terms` 🟡 (33B)
Condição de pagamento (cabeçalho). `erp_code` 🟡 + rótulo 🟡. Detalhe em tipo 62.

## Tipo 43 → `billing_methods` ✅
`erp_code` [5,8) · `label` [8,23). Heurística inativo `Z*`/`Z ` 🟡.

## Tipo 44 → `product_groups` ✅
`erp_code` [5,9) · `label` [9,29).

## Tipo 45 → `product_additional_types` ✅
`erp_code` [5,9) · `label` [9,29).

## Tipo 47 → `cities` 🟡 (53B) — cidade/UF/IBGE 🟡. Preservar bruto.

## Tipo 62 → `payment_term_details` 🟡 (71B)
Detalhes das condições (parcelas/prazos) 🟡. Preservar bruto; validar antes de usar em regra.

## Tipos 80 / 82 → `erp_movements_raw` 🟡
Cabeçalho (117B) e itens (94B) de pedidos/movimentações do ERP. **Preservados brutos, isolados do motor de pedidos novo.** Contêm 2 datas, valores e códigos 🟡.

---

## Regras de normalização do parser `dados-v4`

1. **Decodificar** bytes como Latin-1 (nunca UTF-8).
2. **Dividir** por CRLF exclusivamente.
3. **Ignorar** segmentos vazios.
4. **Normalizar** `\n` isolado interno → espaço (recupera 432B do tipo 10).
5. **Tipo** = `[0,2)`; validar contra tabela de comprimentos esperados.
6. **Rejeitar** o arquivo inteiro se: header inválido, trailer inválido, ou `contagem lógica ≠ trailer`, ou qualquer registro com comprimento fora do esperado (após reconstrução).
7. **Texto** → `.trim()`; **unidade** → upper; **números** → decimal com sinal embutido.
8. Preservar `raw_line`/`raw_tail` para todo campo 🟡/❓.
