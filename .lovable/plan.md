# Experiência mobile premium

O print enviado mostra três problemas reais: o cabeçalho flutuante fica em cima do conteúdo, o título/descrição da página é espremido numa coluna de poucas letras (uma palavra por linha) e a barra inferior tem itens demais, gerando rolagem lateral. O objetivo é reconstruir o esqueleto mobile do app para que todas as telas fiquem limpas, legíveis e com toque confortável.

## 1. Cabeçalho mobile (topo)

- Substituir o cabeçalho flutuante sobreposto por uma barra fixa real, com altura própria, que empurra o conteúdo em vez de cobri-lo (remove os deslocamentos negativos do conteúdo principal).
- Estrutura em uma linha: identidade compacta "MR / Força de Vendas" à esquerda, e à direita apenas dois botões — Novo pedido e Carrinho (com badge).
- Cliente ativo passa a ser uma faixa fina logo abaixo do cabeçalho (nome + código, com truncagem), em vez de disputar espaço na mesma linha.
- Fundo com blur e borda inferior sutil, respeitando o notch (safe-area no topo).

## 2. Cabeçalho de página (título + ações)

- `PageHeader` e o cabeçalho próprio do Catálogo passam a empilhar no mobile: título em cima, descrição abaixo, ações numa linha rolável horizontal — nunca mais texto em coluna estreita.
- Tamanhos: título 22–24px no mobile, 36px no desktop; descrição limitada a 2 linhas com reticências.
- Botões de ação viram ícone + rótulo curto no mobile, com altura mínima de 44px.
- Aplicar o mesmo padrão nas telas que hoje montam o cabeçalho à mão (Catálogo, Carteira, Pedidos, Visitas, Metas, Perfil, Carrinho, Equipe, Mapa, Admin).

## 3. Barra de navegação inferior

- Reduzir para 5 itens fixos no mobile: Início, Carteira, Catálogo, Pedidos e "Mais".
- "Mais" abre uma folha inferior (bottom sheet) com Visitas, Metas, Perfil, Mapa, Equipe e Admin, conforme a permissão do usuário.
- Sem rolagem horizontal: distribuição igual, ícone 22px, rótulo 11px, indicador ativo em magenta, área de toque de 48px e respeito ao safe-area inferior.

## 4. Barra de filtros do Catálogo

- A barra grudenta passa a colar logo abaixo do novo cabeçalho (sem sobreposição).
- No mobile: busca em linha própria; ordenação e Filtros lado a lado ocupando metade cada; contador de resultados e chips ativos numa linha rolável.
- O painel de filtros abre como folha inferior no mobile (mais espaço e polegar-friendly), mantendo o popover no desktop.

## 5. Densidade e toque em todas as telas

- Padding lateral padronizado em 16px no mobile e espaçamento vertical menor entre blocos.
- Cards de produto, cliente, pedido e visita revisados para 2 colunas no mobile sem texto cortado, com preço e ações sempre visíveis.
- Tabelas administrativas largas ganham rolagem horizontal contida (não empurram a página) ou viram lista de cartões no mobile.
- Modais e diálogos ocupam quase a tela inteira no mobile, com cabeçalho fixo e rolagem interna.

## Detalhes técnicos

- `src/components/app-shell.tsx`: novo cabeçalho fixo com altura definida, remoção de `-mt-14/-mt-16` e do `pointer-events-none`, `nav` inferior reduzida a 5 slots + Sheet de "Mais", padding do `main` calculado a partir das alturas de cabeçalho/nav e `env(safe-area-inset-*)`.
- `src/components/shared/page-header.tsx`: layout empilhado por padrão, promovido para grid/flex a partir de `sm:`; `min-w-0` e `line-clamp` nos textos, `shrink-0` nos ícones.
- `src/routes/_authenticated/catalogo.tsx`: cabeçalho manual trocado pelo `PageHeader` compartilhado.
- `src/features/catalog/catalog-filter-bar.tsx`: `top` da barra grudenta alinhado ao cabeçalho; `Popover` no desktop e `Sheet` no mobile via `useIsMobile`.
- Nenhuma mudança de regra de negócio, dados ou permissões — apenas apresentação.
