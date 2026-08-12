# Plano: Perfil do Usuário e Metas

Este plano descreve a implementação da funcionalidade de perfil para que vendedores e administradores possam visualizar seus dados e metas comerciais diretamente na plataforma.

## Ações do Usuário
- O usuário poderá acessar seu perfil através de um novo item no menu lateral (AppShell) ou clicando no seu nome/avatar.
- Na página de perfil, o vendedor visualizará suas informações básicas (nome, código ERP) e uma seção dedicada às suas metas comerciais do mês.
- A página de metas mostrará o progresso em relação ao objetivo mensal, total vendido no período e a diferença restante.

## Alterações Técnicas

### 1. Banco de Dados (Supabase)
- Criar a tabela `seller_goals` para armazenar as metas mensais por vendedor.
- Campos sugeridos: `id`, `seller_erp_code`, `month` (data do primeiro dia do mês), `target_amount` (decimal), `created_at`, `updated_at`.
- Habilitar RLS e permissões (vendedores leem suas metas, administradores gerenciam).

### 2. Rotas e Componentes
- **Nova rota:** `src/routes/_authenticated/perfil.tsx`.
- **UI de Perfil:** Exibir dados do perfil (vindos da tabela `profiles` e `erp_sellers`).
- **UI de Metas:** Gráfico de progresso ou barra de progresso indicando o atingimento da meta com base no `totalSold` calculado no dashboard e no `target_amount` do banco.

### 3. Integração
- Criar funções de servidor (`src/lib/goals.functions.ts`) para buscar a meta do vendedor logado.
- Atualizar o componente `AppShell` para incluir o link para "/perfil".
- Atualizar o `MetricCard` de "Meta do mês" no dashboard para exibir o valor real vindo do banco de dados em vez de "Em breve".

### 4. Gestão Administrativa
- Adicionar aba "Metas" na central administrativa (`/admin/representantes` ou `/admin/usuarios`) para que gestores possam inserir/editar metas dos vendedores.

## Detalhes Técnicos
- **Tabela `seller_goals`:** Chave primária UUID, FK para `erp_sellers.code`.
- **Cálculo de Progresso:** `(total_vendido_mes / meta_mes) * 100`.
- **Estilização:** Manter o padrão premium magenta/laranja e cards brancos com sombras suaves.
