# Refatoração estrutural — componentes limpos e reutilizáveis

Objetivo: mesma tela, mesmo comportamento, código organizado por domínio. Nenhuma regra de negócio muda.

## Diagnóstico

Arquivos com responsabilidades misturadas hoje:

| Arquivo | Linhas | Problema |
|---|---|---|
| `admin-data.functions.ts` | 1468 | Todas as funções de servidor do admin num único módulo (usuários, produtos, marcas, clientes, metas) |
| `catalogo.tsx` | 648 | Rota + filtros + ordenação + paginação + card + skeleton no mesmo arquivo |
| `admin.estoque.tsx` | 446 | Três abas (produtos, estoque, marcas) numa só rota |
| `admin.usuarios.tsx` | 411 | Página + diálogo de criação + card de usuário + visibilidade |
| `equipe.tsx` / `admin.clientes.tsx` | 363 / 391 | Métricas, tabelas e diálogos inline |

Além disso existem **dois componentes com o mesmo nome** (`ProductDetailDialog`): o administrativo em `components/admin/` e o novo do catálogo em `components/`. Nomes precisam revelar a intenção.

## Plano de extração

### 1. Organização por domínio (pastas)
```text
src/features/
  catalog/    componentes + hooks do catálogo
  team/       equipe e metas
  admin/      usuários, estoque, marcas, clientes
src/lib/domain/    tipos e constantes compartilhadas
```
Componentes de UI genéricos permanecem em `components/ui`.

### 2. Catálogo (maior ganho)
- `useCatalogFilters()` — hook que concentra busca, marcas, categorias, ordenação, paginação e o "limpar filtros". A rota passa a só orquestrar.
- `CatalogFilterBar` — barra de busca, ordenação e chips ativos (UI pura).
- `BrandFilterRow` / `CategoryFilterRow` — mesma UI de chips roláveis, hoje duplicada duas vezes.
- `ProductCard` e `ProductCardSkeleton` — arquivos próprios.
- `QuantityStepper` — o seletor de quantidade existe hoje em três lugares (card, modal, carrinho) com o mesmo código.
- Renomear os diálogos: `ProductQuickViewDialog` (vendas) e `ProductAdminDialog` (administrativo).

### 3. Camada de servidor
Quebrar `admin-data.functions.ts` por domínio, mantendo as assinaturas exportadas idênticas:
`admin/users.functions.ts`, `admin/products.functions.ts`, `admin/brands.functions.ts`, `admin/customers.functions.ts`, `admin/goals.functions.ts`.
Um arquivo de reexport mantém os imports atuais funcionando durante a transição.

### 4. Componentes compartilhados extraídos
- `MetricCard` — hoje reimplementado em dashboard, perfil e equipe.
- `EmptyState` — estados vazios repetidos em catálogo, carteira e admin.
- `PageHeader` — título + descrição + ações.
- `StatusBadge` — mapeamento de status comercial/integração para cor, hoje espalhado.

### 5. Constantes e utilitários
- `lib/domain/roles.ts` — lista de perfis e rótulos (duplicada em 3 arquivos).
- `lib/domain/order-status.ts` — rótulos e cores de status.
- Formatações (`formatBRL`, datas) já centralizadas em `lib/pricing`; passam a ser a única fonte.

## Ordem de execução (passos pequenos e reversíveis)

1. Constantes e tipos compartilhados (`roles`, `order-status`).
2. Componentes compartilhados (`MetricCard`, `EmptyState`, `PageHeader`, `StatusBadge`, `QuantityStepper`).
3. Catálogo: hook de filtros + subcomponentes + renomeio dos diálogos.
4. Admin estoque e usuários: uma aba/diálogo por arquivo.
5. Equipe e clientes: extração de tabelas e diálogos.
6. Quebra do módulo de funções de servidor por domínio.

Cada passo termina com verificação de tipos e conferência visual da tela no preview antes do próximo.

## Garantias

- Nenhuma query, política de acesso, cálculo de preço ou regra de aprovação é alterada.
- Nomes de rotas e URLs permanecem os mesmos.
- Se algum passo alterar o visual, ele é revertido isoladamente sem afetar os demais.
