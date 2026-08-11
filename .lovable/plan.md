# Novo pedido sem pular de página

Hoje o vendedor clica em "Novo pedido" no painel, cai na Carteira, escolhe o cliente e só então chega ao Catálogo. São três telas para começar a vender. A proposta é transformar a escolha do cliente em um seletor rápido, disponível de qualquer lugar, e deixar o botão de atendimento mais claro.

## 1. Seletor de cliente em painel (sem trocar de página)

Um painel de busca de cliente que abre por cima da tela atual (estilo "command palette"), com:

- campo de busca por código, razão social, nome fantasia, CNPJ ou cidade;
- lista com nome fantasia, código, cidade/UF, tabela de preço e selos de restrição / preço pendente;
- últimos clientes atendidos no topo quando a busca está vazia;
- atalho de teclado no desktop e navegação por setas/Enter;
- ao escolher, o cliente é definido e o app vai direto para o Catálogo (ou permanece na página atual, se já estiver no Catálogo).

Esse painel é o novo destino do "Novo pedido" — nada de pular para a Carteira.

## 2. Botão "Novo pedido" em todos os pontos do fluxo

- **Painel/Dashboard**: continua em destaque, mas abre o seletor.
- **Carteira**: botão "Novo pedido" no cabeçalho.
- **Catálogo**: botão "Novo pedido" no cabeçalho, ao lado do carrinho.
- **App shell** (barra superior/menu): ação sempre acessível.

Regra: se já existe um carrinho em andamento, "Novo pedido" pede confirmação ("Você tem X itens para CLIENTE — descartar e iniciar um novo pedido?") antes de limpar. Sem itens, abre direto o seletor.

## 3. Melhor lógica do "Atender este cliente"

Na Carteira, o card do cliente passa a ter comportamento consistente:

- o card inteiro é clicável (o botão continua existindo para toque preciso);
- **sem carrinho ativo**: "Atender este cliente" → seleciona e vai ao Catálogo;
- **cliente já é o atual**: "Continuar atendimento" com contagem de itens, mais uma ação secundária "Ver carrinho";
- **carrinho ativo de outro cliente**: "Trocar cliente" com confirmação explicando que o carrinho atual será descartado (preços mudam de tabela);
- **cliente sem nível de preço mapeado**: pode ser selecionado, mas o card avisa que o pedido ficará bloqueado até a configuração — o mesmo aviso aparece no Catálogo;
- **cliente com restrição**: selo mantido e aviso de que o pedido irá para aprovação.

Também fica visível na Carteira uma faixa fixa com o cliente em atendimento no momento e ações "Ir para o catálogo" / "Ver carrinho" / "Encerrar atendimento".

## Detalhes técnicos

- Novo componente `src/components/customer-picker.tsx` usando `Command`/`Dialog` do shadcn, alimentado por `useSales()` (`customers`, `priceTables`, `selectCustomer`).
- Contexto leve para abrir o seletor de qualquer rota (provider dentro de `AppShell`), expondo `openCustomerPicker()`.
- Confirmação de troca com `AlertDialog`; `selectCustomer` já limpa o carrinho ao mudar de cliente, então a mudança é só na UX de confirmação.
- Alterações em: `src/components/app-shell.tsx`, `src/routes/_authenticated/index.tsx`, `carteira.tsx`, `catalogo.tsx` — apenas UI/navegação, sem mudanças de banco ou regras de pedido.
