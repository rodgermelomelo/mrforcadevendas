# Plan: Unificar Gestão de Produtos, Estoque, Preços, Marcas e Categorias

Unificar as telas administrativas de Marcas, Categorias, Produtos, Estoque e Preços sob a rota `/admin/estoque` como tela principal, movendo Marcas e Categorias para dentro da interface de Produtos (como abas ou seções) e atualizando a navegação.

## User Review Required

> [!IMPORTANT]
> A página `/admin/produtos` já unifica "Produtos, estoque e preços" via modais de detalhe. A nova estrutura centralizará tudo em `/admin/estoque`.

- **Nova Rota Principal**: `/admin/estoque` passará a renderizar o que hoje é `/admin/produtos`.
- **Marcas e Categorias**: Serão movidas para uma aba ou seção lateral dentro da nova visão de estoque/produtos.

## Proposed Changes

### 1. Roteamento e Navegação
- [ ] Criar/Atualizar `src/routes/_authenticated/admin.estoque.tsx`: Remover o redirecionamento e mover o conteúdo de `src/routes/_authenticated/admin.produtos.tsx` para cá.
- [ ] Atualizar `src/routes/_authenticated/admin.produtos.tsx`: Adicionar redirecionamento para `/admin/estoque` (inverter a lógica atual).
- [ ] Atualizar `src/routes/_authenticated/admin.marcas.tsx`: Adicionar redirecionamento para `/admin/estoque` (ou manter como rota secundária, mas removê-la do menu principal).
- [ ] Atualizar `src/components/app-shell.tsx`:
    - Remover "Marcas e Categorias" do menu lateral admin.
    - Renomear "Produtos, estoque e preços" para "Estoque e Produtos" e apontar para `/admin/estoque`.

### 2. Interface Unificada em `/admin/estoque`
- [ ] Modificar o componente em `admin.estoque.tsx` para incluir abas (Tabs):
    - **Aba "Produtos"**: Listagem atual de produtos com filtros de estoque/preço.
    - **Aba "Marcas e Categorias"**: Mover a lógica de `admin.marcas.tsx` para esta aba.
- [ ] Garantir que o `AdminPage` tenha o título "Estoque e Produtos".

### 3. Dashboard Admin
- [ ] Atualizar `src/routes/_authenticated/admin.index.tsx`:
    - Mesclar os cards de "Marcas e Categorias" e "Produtos, estoque e preços" em um único card de "Estoque e Produtos".

## Technical Details
- Utilizar `Tabs` do shadcn/ui para alternar entre a visão de Produtos e a gestão de Marcas/Categorias.
- Manter as `server functions` existentes (`listProducts`, `listRegistries`, etc.) sem alterações, apenas mudando onde são chamadas no frontend.
- Atualizar metadados de SEO (head) na nova rota `/admin/estoque`.
