# Todos os dados do ERP dentro do sistema

Hoje a importação já grava no banco: representantes, clientes, produtos, grupos de produto, segmentos, formas de cobrança, tabelas de preço, preços (6 valores por tabela), estoque e diagnóstico do catálogo. O que ainda **não** entra são os registros de resumo financeiro (12), títulos/parcelas (15), informações de cobrança (41), condições de pagamento (42/62), cidades (47), empresa (06) e histórico de movimentações (80/82) — o parser guarda esses tipos apenas como linha bruta porque as posições dos campos ainda não foram confirmadas.

O trabalho vai em duas etapas.

## Etapa 1 — Telas para tudo que já está no banco

Novas áreas administrativas (somente admin), no mesmo padrão premium das telas atuais:

- **Estoque**: lista de produtos com quantidade, data da captura, filtros (com estoque / sem estoque / negativo / só código histórico), busca por código ou nome, indicador de última atualização do ERP.
- **Preços por produto**: visão produto × tabela mostrando os 6 valores, destacando qual é o valor aplicável conforme o nível mapeado, filtro por tabela e busca por produto.
- **Cadastros gerais** (tela existente): ganha as abas de Tipos adicionais e Cidades quando esses dados passarem a ser importados, além de contadores por cadastro.
- **Visão geral da Administração**: cards com a contagem real de cada base (clientes, produtos, preços, estoque, grupos, segmentos, cobranças, condições, representantes) e a data do último arquivo publicado.

Todas com paginação, busca, skeleton de carregamento e estado vazio explicando de onde o dado vem.

## Etapa 2 — Importar os registros que faltam

Preciso do `dados.txt` anexado para confirmar byte a byte as posições dos campos. Com o arquivo em mãos:

1. Confirmo os offsets dos tipos 12, 15, 41, 42, 47, 62, 80 e 82 e documento em `docs/ERP_FILE_ANALYSIS.md`.
2. Estendo o parser `dados-v4` (sem quebrar o layout atual) para extrair esses tipos com validação de tamanho.
3. Passam a ser gravados:
   - **Resumo financeiro (12)** → `customer_financial_snapshots` (saldo em aberto, vencido, limite) — alimenta a regra de limite excedido no checkout.
   - **Títulos e parcelas (15)** → `receivables` — usado para marcar "clientes que precisam de atenção".
   - **Condições de pagamento (42/62)** → completa `payment_terms` com a descrição real e os detalhes de parcelamento.
   - **Informações de cobrança (41)** → complementa `billing_methods`.
   - **Cidades (47)** → nova tabela de cidades, usada em filtro na carteira.
   - **Empresa (06)** → dados do emissor exibidos na Administração.
   - **Movimentações (80/82)** → novas tabelas de histórico de vendas, base para "total vendido" e sugestão de recompra.
4. Novas telas: **Financeiro do cliente** (resumo + títulos, dentro do detalhe do cliente), **Cidades** nos cadastros e **Histórico de vendas** por cliente/produto.

Regras mantidas: importação atômica (nada de publicação parcial), deduplicação por hash, registros ausentes marcados como inativos em vez de apagados, logs sanitizados sem CNPJ/endereço/dados financeiros e RLS em todas as tabelas novas.

## Detalhes técnicos

- Parser: novos extratores em `src/lib/erp/parser/records.ts`, tipos movidos de `RAW_ONLY_TYPES` para `CONFIRMED_FIELD_TYPES` em `layout.ts`; nenhuma inferência de layout sem o arquivo real.
- Persistência: `buildEntities`/`upsertAll` em `src/lib/erp/import.server.ts` ganham os novos conjuntos, em lotes idempotentes.
- Migrations para as tabelas novas (cidades, movimentações e itens) com GRANTs e políticas de leitura por carteira/visibilidade, seguindo o padrão já usado em `orders`.
- Server functions de leitura em `src/lib/admin-data.functions.ts`, protegidas por admin, com paginação server-side.
- Rotas novas sob `src/routes/_authenticated/admin.*` e entradas no menu Administração do `AppShell`.
