# Força de Vendas — Sistema de Autorização de Pedidos

> Visão: o Força de Vendas é o **pilar** da operação comercial da MR. O vendedor
> lança o pedido; o sistema **classifica automaticamente** (motor ao vivo, porte
> fiel do `importar_v2.py`) contra as fontes de desconto/acordo; pedidos **OK**
> descem para a **Logística** (faturamento); pedidos com pendência ficam numa
> **fila de aprovação** para Josi / gestores / administradores.
>
> Este documento é o desenho/plano. Substitui a planilha `2 - PEDIDOS 2026` e as
> abas de cadastro (`ACORDO COMERCIAL`, `CAMPANHAS`, `SELL OUT`, `SELOS`,
> `CONTA CORRENTE`, `NFD`) por telas próprias que alimentam o Supabase.

## 1. Papéis (permissões)

| Papel | O que faz |
|---|---|
| **Vendedor** | Cria pedidos (com observação de desconto/acordo). Vê o status do próprio pedido. |
| **Logística** | Recebe a fila de pedidos **OK** para conferir/faturar. |
| **Josi / Gestor** | Cadastra **acordos** e **campanhas**; aprova/ajusta pedidos travados. |
| **Administrador** | Tudo: cadastros, aprovações, importações, configurações. |

> Cadastro de acordos, campanhas e demais fontes: **somente Administrador e Josi/Gestor**
> (aplicado por RLS no Supabase + guardas de rota no app).

## 2. Páginas de cadastro (cada uma alimenta o banco)

Cada fonte de desconto vira uma página própria, com a sua sistemática:

### 2.1 Acordos Comerciais  `/admin/acordos`
- Lista de acordos por cliente. Botão **"Novo acordo comercial"**.
- Campos: cliente (código+nome), **percentual (%)**, forma/observação, vigência (opcional), status.
- Regra do motor: compara o **% do cadastro** com o **% citado na observação** do pedido → OK / DIVERGÊNCIA / VERIFICAR (quando há 2 percentuais).

### 2.2 Campanhas  `/admin/campanhas`
- **Campanha "mãe"** por período (ex.: **"Setembro"**). Botão **"Nova campanha"**.
- Dentro dela, as **campanhas/regras** (ex.: "MAKE 10%", "ACETONA 3%"), cada uma com:
  **nome, percentual (%), categoria, palavras-chave (gatilho na obs), período (de/até), status (ATIVA)**.
- Regra do motor: obs do pedido bate palavra-chave de campanha vigente → confere o % (na escala) → OK / DIVERGÊNCIA / VERIFICAR.

### 2.3 NFD (Notas de Devolução)  `/admin/nfd`
- **Importar** as NFDs (hoje vêm de PDF/XML no servidor) e/ou lançar manual.
- Por registro: **cliente, número, valor, status (PENDENTE/DESCONTADO)**.
- Regra do motor: casa pelo número citado na obs; confere se está **pendente** (crédito válido) e se é do cliente certo.

### 2.4 Sell Out  `/admin/sellout`
- Importar/preencher verba de sell out por cliente. Por registro: **cliente, valor, status**.
- Regra do motor: se há verba **pendente** → OK com o valor; senão VERIFICAR.

### 2.5 Selos  `/admin/selos`
- Igual ao Sell Out (verba por cliente, pendente/descontado).

### 2.6 Conta Corrente  `/admin/conta-corrente`
- Saldo a descontar por cliente. Regra do motor: mostra o saldo (VERIFICAR — sentido déb/cré confirmado no cadastro).

## 3. Fluxo do pedido (motor ao vivo)

```
Vendedor cria pedido (obs, cliente, itens, total)
        │
        ▼
  MOTOR classifica  → status por fonte: OK · VERIFICAR · DIVERGÊNCIA · BONIFICADO
        │              + etapa de aprovação (aguardando autorização/mostruário/…)
        ▼
   ┌─────────────┴──────────────┐
   │ tudo OK e sem aprovação    │  →  FILA DA LOGÍSTICA (conferir/faturar)
   │ pendência (VERIFICAR/      │
   │ DIVERGÊNCIA/aprovação)     │  →  FILA DE APROVAÇÃO (Josi / gestor / admin)
   └────────────────────────────┘        │
                                          ▼
                             aprova / ajusta / exclui  →  desce p/ Logística
```

- **Só cai na Logística o pedido OK.** O resto fica na tela de aprovação.
- A decisão manual (aprovar/excluir/ajustar %) é **preservada** por pedido (como a planilha guarda "OK/EXCLUIDO" e "APROVAÇÃO FINAL").

## 4. Modelo de dados (Supabase)

Tabelas novas (todas com RLS: leitura ampla p/ o time; escrita só admin/gestor):

- `acordos_comerciais` — cliente, percentual, forma, vigência, status.
- `campanhas` — período "mãe" (ex.: Setembro).
- `campanha_regras` — campanha_id, nome, percentual, categoria, palavras_chave[], de, ate, status.
- `nfd_creditos` — cliente, numero, valor, status, origem.
- `sellout_creditos` — cliente, valor, status.
- `selos_creditos` — cliente, valor, status.
- `conta_corrente_saldos` — cliente, saldo.
- `pedido_autorizacao` — pedido_id, resultado do motor (json por fonte), status geral, fila (logistica/aprovacao), decisão manual, quem/quando.

## 5. Plano de construção (fases)

1. **✅ Motor de classificação** (`src/lib/orders/authorization/engine.ts`) — porte fiel + testes (11/11).
2. **Schema + RLS** das tabelas acima (migração Supabase) + carga inicial a partir da planilha atual.
3. **Páginas de cadastro** (acordos, campanhas, nfd, sellout, selos, conta corrente) com permissão admin/gestor.
4. **Integração no pedido**: rodar o motor ao criar/editar pedido; gravar `pedido_autorizacao`.
5. **Filas**: tela da **Logística** (só OK) e tela de **Aprovação** (Josi/gestor/admin), com as ações manuais.
6. (Fase futura) **Crédito/limite do ERP** (o motor original consulta o Firebird) — precisa de um caminho de dado próprio; entra depois.

## 6. Fora de escopo por ora
- Puxar crédito/limite direto do ERP Firebird (fase 6).
- Dados reais (clientes/CNPJ/financeiro) **nunca** vão para o repositório público — só para o Supabase privado.
