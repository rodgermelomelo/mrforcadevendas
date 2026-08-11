# Fluxo do Pedido — análise completa (caminho ponta a ponta)

> Base para construir offline. Mapeia o **caminho que o pedido deve seguir** (o que
> você descreveu), confronta com o **estado atual do sistema** e define **o que falta**
> (dados, telas, status). Números conferidos direto no banco em 11/08/2026.

---

## 0. Diagnóstico dos 2 pontos que você levantou

### 0.1 "Nenhum cliente está alocado a uma tabela → catálogo indisponível"
**Não é bem isso.** A alocação de tabela dos clientes está quase toda correta:

| Tabela | Nível | Clientes |
|---|---|---|
| 012 SN | 1 | 3.588 |
| 033 LCRP | 1 | 955 |
| 055 SM | 2 | 330 |
| 061 / 053 / T01 / T02 | ok | ~13 |
| **000 (sem tabela)** | — | **29** |
| **T07 (sem nível)** | — | **1** |

→ **4.886 de 4.916 clientes JÁ têm tabela com nível mapeado.** Só **30** ficam sem preço
(tabela `000` ou tabela sem nível). O "indisponível" que você viu é, na maioria,
**estoque real zerado**: dos **960** produtos, só **~404 têm estoque** (o ERP traz 393
positivos / 397 zerados / 156 negativos no catálogo). Já ordenei o catálogo para mostrar
**disponíveis primeiro** e há o filtro "Com estoque".

**O que realmente falta aqui:**
1. **Alocar/trocar a tabela de um cliente** pela tela (hoje só vem do ERP; não dá para editar no fluxo).
2. **Cliente novo** (criado na hora) precisa **obrigatoriamente** receber uma tabela com nível — senão cai no mesmo "indisponível".

### 0.2 "Preciso poder adicionar um cliente novo (não existe hoje)"
Correto — **não há cadastro de cliente** no app. É o **primeiro bloqueio do caminho**:
ao clicar em "Novo pedido" e o cliente não existir, é preciso um **"+ Novo cliente"**
(na Carteira e dentro do seletor de cliente do Novo pedido).

---

## 1. O CAMINHO COMPLETO (alvo)

```
┌─ COMERCIAL (Força de Vendas) ─────────────────────────────────────────────┐
│ 1. Novo pedido                                                             │
│    → selecionar cliente  ── OU ──  [+ Novo cliente] (cadastro rápido)      │
│       (cliente precisa ter TABELA DE PREÇO com nível)                      │
│ 2. Catálogo  → preços da tabela do cliente, estoque, disponíveis primeiro  │
│ 3. Carrinho / seleção de itens (qtd, desconto por item)                    │
│ 4. Revisar pedido                                                          │
│    → desconto total                                                        │
│    → ACORDO FINANCEIRO (novo): "X% na nota fiscal" e/ou "Y% só no boleto"  │
│    → "Lançar pedido":                                                       │
│        • SEM acordo/exceção  → auto-aprovado → CONFIRMADO                   │
│        • COM acordo financeiro/exceção → EM ANÁLISE → GESTOR aprova →       │
│          CONFIRMADO   (reprova = encerrado / devolve = corrige e recalcula) │
└────────────────────────────────────────────────────────────────────────────┘
                                   │  (só pedido CONFIRMADO segue)
┌─ FULFILLMENT (ERP / Logística) ─▼─────────────────────────────────────────┐
│ 5. Envio ao ERP (integração)  → pedido entra no ERP                        │
│ 6. EM SEPARAÇÃO (picking na empresa)                                       │
│ 7. CONCILIAÇÃO                                                             │
│    • O ERP/logística pode gerar um PEDIDO ATUALIZADO por RUPTURA de estoque │
│      (itens em falta → nova quantidade → novo valor).                       │
│    • Guardamos o PEDIDO ORIGINAL (FV) e o PEDIDO ATUALIZADO (ERP).          │
│    • O ATUALIZADO é o que vale. Concilia-se original × atualizado.          │
│ 8. NOTA FISCAL (faturamento)                                               │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Estágios detalhados

| # | Estágio | Quem | O que acontece | Estado do pedido |
|---|---|---|---|---|
| 1 | Novo pedido / cliente | Vendedor | Escolhe cliente da carteira ou **cadastra um novo** (razão, fantasia, CNPJ, cidade/UF, **tabela de preço**, condição). | — |
| 2 | Catálogo | Vendedor | Preço = tabela do cliente × nível. Sem tabela/nível → bloqueado. Disponíveis primeiro. | `draft` |
| 3 | Carrinho | Vendedor | Itens, qtd, desconto por item. | `draft` |
| 4 | Revisar | Vendedor | Desconto total + **acordo financeiro** (% NF / % boleto) + observações. Ao "Lançar": validação completa. | `validating` |
| 4a | Auto-aprovado | Sistema | Sem exceção e **sem acordo financeiro** → confirma direto. | `auto_approved`→`confirmed` |
| 4b | Análise | Gestor | Com **acordo financeiro** ou exceção (desconto, estoque, condição fora do padrão, abaixo do mínimo, restrição, limite, bonificação) → vai para o gestor de maior alçada. | `pending_approval` |
| 4c | Decisão | Gestor | Aprova (→confirma) · Reprova (motivo, encerra) · Devolve (orientação, volta a corrigir e **recalcula tudo**). | `approved`/`rejected`/`changes_requested` |
| 5 | Integração ERP | Operador/sistema | Só **confirmado** entra na `erp_outbox` → enviado ao ERP. | integração: `awaiting`→`sending`→`accepted_by_erp` |
| 6 | Separação | Empresa/ERP | Picking físico. | fulfillment: **`em_separacao`** |
| 7 | Conciliação | Operador | Compara **pedido original (FV)** × **pedido atualizado (ERP/logística por ruptura)**. Registra diferenças de item/qtd/valor. O atualizado passa a valer. | fulfillment: **`conciliacao`** |
| 8 | Nota fiscal | ERP | Faturamento do pedido conciliado. | fulfillment: **`faturado`** |

> **Acordo financeiro** (novo conceito): diferente do desconto comercial de item/pedido.
> É uma condição **financeira** ("X% na NF", "Y% só no boleto") que **sempre** manda o
> pedido para análise do gestor (não lança sozinho), porque impacta faturamento/cobrança.

---

## 3. Estado atual × alvo (o que já existe e o que falta)

### Já existe ✅
- Status comercial: `draft → validating → pending_approval → changes_requested → rejected → auto_approved → approved → confirmed`.
- Status de integração: `not_ready → awaiting_erp_integration → sending → accepted_by_erp → integration_error`.
- Exceções comerciais: desconto item/pedido, estoque insuficiente, condição fora do padrão, abaixo do mínimo, cliente com restrição, limite excedido, bonificação.
- Motor de aprovação por autoridade (gestor de maior alçada), snapshot imutável + hash, outbox.
- Catálogo com preço por tabela/nível, carrinho, desconto por item/total, bonificação.

### Falta 🔲 (o que este caminho pede)
1. **Cadastro de cliente** (criar/editar) + **alocação de tabela de preço** ao cliente. *(desbloqueia o início do fluxo)*
2. **Acordo financeiro** no "Revisar pedido": campos "% na NF" e "% no boleto" → nova **exceção `acordo_financeiro`** que força análise.
3. **Papel de "gestor"** explícito para aprovação (hoje é `supervisor`/`gerente_comercial` por alçada — ok, só precisa amarrar a exceção financeira à alçada certa).
4. **Dimensão de fulfillment pós-confirmação**: `em_separacao → conciliacao → faturado` (separado do status comercial e do de integração técnica).
5. **Conciliação**: guardar **pedido original × pedido atualizado (ERP)**, vincular ao **nº do pedido no ERP**, registrar itens com **ruptura** (qtd/valor novos). O romaneio FastReport que você me enviou É exatamente o documento pós-ERP dessa etapa — dá para ingerir por arquivo até a API existir.
6. **Nota fiscal**: registrar o faturamento do pedido conciliado (nº NF, data, valor).

---

## 4. Modelo de dados (proposta de evolução)

- **customers**: já tem `price_table_code`. Adicionar edição via tela + validação (tabela precisa existir e ter `mapped_level`). Cadastro de novo cliente com esses campos obrigatórios.
- **orders**: adicionar
  - `financial_agreement` jsonb → `[{ tipo: 'nota_fiscal' | 'boleto', percent: number }]`
  - `fulfillment_status` enum → `pendente | em_separacao | conciliacao | faturado | cancelado`
  - `erp_order_number` text (nº do pedido no ERP, quando integrar/conciliar)
- **order_reconciliation** (nova tabela) → 1:1 com o pedido:
  - `order_id`, `erp_order_number`, `original_snapshot` jsonb, `updated_snapshot` jsonb,
    `has_ruptura` bool, `diff` jsonb (itens que mudaram: qtd/valor), `reconciled_at`, `reconciled_by`.
- **invoices** (nova tabela) → `order_id`, `nf_number`, `issued_at`, `amount`, `source` ('erp').
- **exception_type**: adicionar `acordo_financeiro` (financeiro → análise obrigatória).

---

## 5. Plano de implementação (offline → depois sobe ao GitHub)

**Fase A — desbloquear o início (prioridade 1)**
1. Cadastro de cliente (server fn `createCustomer` + form) na Carteira e no seletor de "Novo pedido".
2. Editar tabela de preço do cliente (na tela do cliente / admin.clientes), com validação de nível.

**Fase B — acordo financeiro + análise**
3. Campos "% NF" e "% boleto" no Revisar pedido; exceção `acordo_financeiro`; rota para gestor.
4. Central de Aprovações já contempla aprovar/reprovar/devolver — amarrar a exceção financeira.

**Fase C — pós-confirmação (fulfillment)**
5. `fulfillment_status` + telas "Em separação" e "Conciliação".
6. Conciliação: ingestão do pedido atualizado do ERP (por arquivo/romaneio até a API), diff original × atualizado, marcação de ruptura, registro da NF.

> Regra que se mantém: **só pedido `confirmed` entra na outbox/ERP**; e o **atualizado (ERP)**
> é a fonte de verdade a partir da separação — o original fica preservado para auditoria.
