# Plano de Implementação: Carteira Organizada por Cidades

Agrupar os clientes da carteira por cidades, facilitando a navegação em dispositivos móveis e permitindo que o vendedor foque em rotas específicas.

## Alterações

### 1. Componente Carteira (`src/routes/_authenticated/carteira.tsx`)
- Introduzir um estado para alternar entre "Lista" e "Cidades" (opcional, mas recomendado para flexibilidade).
- Agrupar os `results` por cidade utilizando a propriedade `c.city`.
- Implementar uma interface de "Pastas" ou "Acordeões":
  - Cada cidade será um cabeçalho/item expansível.
  - Exibir a contagem de clientes por cidade.
  - Dentro de cada cidade, renderizar os cartões dos clientes correspondentes.
- Otimizar a visualização mobile para que a lista de cidades seja fácil de percorrer.

### 2. UI/UX
- Utilizar componentes do shadcn/ui como `Accordion` ou criar uma estrutura de lista colapsável personalizada.
- Manter a funcionalidade de busca e filtro de representante integrada, filtrando tanto as cidades quanto os clientes dentro delas.

## Detalhes Técnicos
- Transformar `results` em um objeto ou array de grupos: `Record<string, Customer[]>`.
- Garantir que a ordenação das cidades seja alfabética.
- Preservar todas as funcionalidades de "Atender este cliente", "Ver carrinho" e detalhes.
