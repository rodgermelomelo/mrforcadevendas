# MR Força de Vendas — Plano de construção

Sistema interno B2B para a equipe comercial da MR Cosméticos criar pedidos em nome dos clientes da própria carteira, com aprovação interna e integração futura com o ERP.

## Nota sobre a stack

O projeto já roda em **TanStack Start (React 19 + Vite 7 + TypeScript + Tailwind v4 + shadcn/ui)**, não em Next.js App Router nem em React Router. Isso não muda nada do produto: as camadas descritas na ARCHITECTURE.md (parser, pricing, orders, approvals, erp/exporter, demo) são portadas como módulos em `src/lib/*`, as rotas viram arquivos em `src/routes/`, e a lógica de servidor usa server functions em vez de Route Handlers. O backend é o **Lovable Cloud** (Postgres, Auth, Storage, RLS — o mesmo Supabase por baixo).

O link do GitHub (foxyentregas) não é acessível a partir daqui; a identidade visual será construída a partir dos tokens exatos que você especificou (magenta `328 85% 55%`, gradiente magenta→laranja, neutros cinza, radius `0.875rem`). Se quiser paridade visual exata com aquele repositório, envie prints ou os arquivos de CSS/tokens.

## Fase 1 — Fundação visual e fluxo de venda (esta entrega)

Modo demo com dados sintéticos, sem depender de importação nem de login.

1. **Design system**: tokens HSL em `src/styles.css` (marca, gradiente, neutros, dark mode, radius, sombras), fundo com gradiente radial sutil, tipografia hierárquica, componentes shadcn ajustados às variantes da marca.
2. **Shell de navegação mobile-first**: barra inferior em mobile / sidebar em desktop, carrinho sempre acessível com contador, banner "Dados atualizados em DD/MM/AAAA às HH:mm".
3. **Dashboard do vendedor**: cards de meta (placeholder), total vendido, pedidos por status, clientes que precisam de atenção, botão destacado **Novo pedido**.
4. **Minha carteira** (`/carteira`): busca por código, razão social, nome fantasia, CNPJ, cidade; cards com segmento, tabela de preço, restrição, CNPJ mascarado. Selecionar cliente define o contexto do pedido.
5. **Catálogo** (`/catalogo`, exige cliente selecionado): grid premium com foto, nome, grupo, código, estoque, preço da tabela do cliente, seletor de quantidade com atalhos 6/12/30, busca e filtros por categoria/lançamentos. Sem estoque → cinza, "Indisponível", não adicionável. Sem preço válido para a tabela → bloqueado com o motivo exibido.
6. **Carrinho**: painel lateral no desktop, tela dedicada no mobile, sempre com "Comprando para: NOME · Tabela X · Nível · Condição".
7. **Revisar pedido** (`/pedido/revisar`): itens com desconto por produto (%), desconto total (%), botão Bonificação, observações, subtotal/descontos/total. Botão dinâmico: **Gerar pedido** no padrão; vira **Solicitar aprovação** com indicação da autoridade assim que houver desconto, bonificação, estoque insuficiente, condição fora do padrão, abaixo do mínimo, cliente restrito ou limite excedido.
8. **Meus pedidos** + detalhe/histórico (lidos do estado demo).
9. Skeletons, estados vazios e de erro em todas as telas; head/SEO por rota.

Nesta fase, preços, validação, exceções e o motor de aprovação já rodam como módulos puros e testáveis (`src/lib/pricing`, `src/lib/orders`, `src/lib/approvals`), alimentados pelo provider demo — a troca para o banco na Fase 2 não reescreve a UI.

## Fase 2 — Backend, autenticação e RLS

- Ativação do Lovable Cloud e migração com o modelo completo: profiles, roles, user_erp_seller_links, erp_sellers, team_visibility, customers, customer_financial_snapshots, receivables, product_groups, products, product_enrichments, catalog_review, product_eans, inventory_snapshots, price_tables, product_prices (6 valores), payment_terms, segments, billing_methods, erp_import_runs, erp_import_errors, orders, order_items, order_versions, commercial_exceptions, approval_rules, approval_requests, approval_events, erp_outbox, image_candidates, audit_logs.
- uuid interno + códigos ERP como chaves externas únicas; monetário em `numeric`; auditoria em America/Sao_Paulo.
- Papéis em tabela separada (`user_roles` + função `has_role`), nunca no perfil. RLS em todas as tabelas: vendedor enxerga só a própria carteira via `user_erp_seller_links`; supervisor/gerente via `team_visibility` configurável (nunca "todos" por padrão).
- Login e recuperação de senha; máquina de estados do pedido no servidor; snapshot imutável com hash no `confirmed`.
- Central de aprovações: aprovar / reprovar (motivo obrigatório) / devolver para correção (orientação obrigatória), sem edição pelo aprovador; matriz `approval_rules` configurável, múltiplas exceções → maior autoridade direto.

## Fase 3 — Áreas administrativas

- **Central de Importações**: parser versionado `dados-v4` (Latin-1, CRLF, largura fixa, reconstrução de registros quebrados, validação de header/trailer e contagem lógica, rejeição total sem publicação parcial), upload → staging → resumo → confirmação → publicação atômica, dedupe por hash, registros ausentes marcados e nunca apagados, logs sanitizados.
- **Diagnóstico do Catálogo** com as classificações previstas; **Enriquecimento de produtos** (nunca sobrescrito por importação); **Central de Imagens** com candidatos, confiança, revisão, upload manual e cópia controlada no Storage; **Regras comerciais**; **Gestão de usuários**; **Auditoria**.
- **Central de Integração ERP**: `erp_outbox` só com pedidos confirmados, `ErpOrderExporter` com adapter `NotConfigured` e tela "conector a definir" — nenhum formato de saída inventado.

## Pendências que continuam abertas (OPEN_QUESTIONS)

Q1 (mapeamento dos 6 valores → nível de preço) e Q2 (contrato de saída para o ERP) permanecem bloqueadores de produção: sem mapeamento de nível, nenhum preço é exibido e nenhum pedido é gerado; nenhum payload de exportação é definido.

## Detalhes técnicos

- Rotas em `src/routes/` com `head()` próprio por página; `/` passa a ser o dashboard (login público em `/auth`, área logada sob `_authenticated/` na Fase 2).
- Contexto de cliente selecionado + carrinho em um provider React com persistência local; troca de cliente recalcula preços.
- Validação de fronteira com Zod; nenhum dado real em seeds, fixtures ou testes.
