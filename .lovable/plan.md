# Plano de Implementação: Áreas Administrativas e Correções Visuais

Este plano detalha a implementação das páginas administrativas restantes e a aplicação de correções visuais e de fluxo solicitadas.

## Mudanças Técnicas

### Backend & Domínio
- **Tabelas de Referência**: Garantir que `segments`, `billing_methods`, `product_groups`, e `payment_terms` estejam acessíveis via server functions.
- **Segurança**: Implementar o middleware `requireSupabaseAuth` e verificações de papel (admin/supervisor) em todas as novas server functions.
- **Mapeamento de Preço**: Implementar a lógica para definir o `mapped_level` nas tabelas de preço (`price_tables`).

### Áreas Administrativas (Novas Rotas)
- `src/routes/_authenticated/admin.representantes.tsx`: Gestão de vendedores ERP e ativação de acesso.
- `src/routes/_authenticated/admin.tabelas-preco.tsx`: Mapeamento de níveis de preço (1-6) para cada tabela.
- `src/routes/_authenticated/admin.clientes.tsx`: Lista completa de clientes com status de restrição e limites.
- `src/routes/_authenticated/admin.produtos.tsx`: Gestão de lançamentos e liberação no catálogo.
- `src/routes/_authenticated/admin.cadastros.tsx`: UI para grupos, segmentos e condições.
- `src/routes/_authenticated/admin.regras.tsx`: Editor da matriz de aprovação (`approval_rules`).

### UX & UI (Refinamentos)
- **Filtro de Marcas**: Corrigir a visibilidade do filtro "Empresa" no catálogo e garantir que os dados de `brand` sejam carregados corretamente.
- **Texto do Catálogo**: Localizar e corrigir a string de feedback/exemplo ("no catálogo ta faltando...") se estiver em componentes de placeholder ou dados iniciais.
- **Navegação**: Consolidar os botões de "Novo Pedido" e melhorar a lógica de "Atender este cliente" para evitar pulos desnecessários.

## Detalhes para o Usuário
- **Central Administrativa**: Controle total sobre quem pode vender, quais preços são exibidos e as regras de desconto que exigem aprovação.
- **Catálogo Inteligente**: O filtro por marcas (Dailus, Acemar, etc.) será fixado no topo do catálogo para facilitar a navegação por fornecedor.
- **Fluxo de Pedido**: Menos cliques para começar a vender. O seletor de cliente ficará disponível de forma mais fluida em qualquer tela comercial.
