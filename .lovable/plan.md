# Fase 2 — Lovable Cloud: banco, autenticação e RLS

Ativar o Lovable Cloud e migrar o MR Força de Vendas do modo demo (localStorage) para persistência real, com login e segurança por carteira.

## O que será feito

### 1. Ativar o Lovable Cloud
Banco de dados, autenticação, storage e funções de servidor passam a existir no projeto.

### 2. Login e perfis
- Tela `/auth` (e-mail + senha, recuperação de senha e página `/reset-password`).
- Rotas do app protegidas: quem não estiver logado vai para `/auth`.
- Cabeçalho passa a mostrar o usuário logado e a opção de sair.
- Perfis: vendedor_externo, vendedor_interno, supervisor, gerente_comercial, administrador, operador_integracao — guardados em tabela separada de papéis (nunca no perfil), como exige a segurança.

### 3. Estrutura do banco (migrations)
Criação das tabelas do dicionário de dados, em blocos:

- Pessoas e acesso: `profiles`, `user_roles`, `erp_sellers`, `user_erp_seller_links`, `team_visibility`
- Clientes: `customers`, `segments`, `payment_terms`, `billing_methods`, `customer_financial_snapshots`, `receivables`
- Produtos e preços: `product_groups`, `products`, `product_enrichments`, `product_eans`, `catalog_review`, `inventory_snapshots`, `price_tables` (com nível mapeado), `product_prices` (6 valores)
- Pedidos: `orders`, `order_items`, `order_versions`, `commercial_exceptions`, `approval_rules`, `approval_requests`, `approval_events`
- Operação: `erp_import_runs`, `erp_import_errors`, `erp_outbox`, `image_candidates`, `audit_logs`

Padrões: uuid interno + código do ERP como chave externa única, valores monetários em `numeric`, datas em America/Sao_Paulo, RLS habilitada em todas as tabelas com os GRANTs correspondentes.

### 4. Regras de acesso (RLS)
- Vendedor enxerga apenas clientes e pedidos da própria carteira (via `user_erp_seller_links`).
- Supervisor/gerente enxergam apenas o que estiver configurado em `team_visibility` — nunca "todos" automaticamente.
- Administrador e operador de integração com escopos próprios.
- Catálogo, preços e estoque legíveis por usuários autenticados; escrita apenas por administração/importação.
- Aprovador pode mudar status, mas não editar itens do pedido.

### 5. Migração do fluxo atual
- Carteira, catálogo, preços e estoque passam a ler do banco.
- Carrinho continua local até a confirmação; o pedido é gravado no banco com itens, exceções e snapshot imutável (hash do conteúdo).
- Motor de aprovação passa a ler `approval_rules` do banco em vez da matriz em código.
- Modo demo continua disponível como opção, com dados sintéticos, para navegar sem depender de importação.

### 6. Dados iniciais
Seed sintético (sem dados reais) na migration: vendedores, clientes, grupos, produtos, tabela de preços com nível mapeado, estoque e regras de aprovação — para o app abrir já com conteúdo.

## Detalhes técnicos

- Leituras autenticadas via `createServerFn` com `requireSupabaseAuth`; rotas protegidas sob `src/routes/_authenticated/`.
- Função `has_role(user_id, role)` em SECURITY DEFINER para evitar recursão nas policies.
- Preço aplicável continua dependendo do nível mapeado da tabela; sem mapeamento, o app bloqueia exibição de preço e geração de pedido (regra já implementada, agora lida do banco).
- Storage: bucket para imagens de produto (cópia controlada, sem hotlink).

## Fora desta fase

Parser `dados-v4` do ERP, Central de Importações, Diagnóstico do Catálogo, Central de Imagens e outbox de integração ficam para a Fase 3.
