# Áreas administrativas — MR Força de Vendas

O arquivo `dados.txt` enviado já corresponde ao que está publicado no banco: 4.916 clientes, 960 produtos, 143 representantes, 9 tabelas de preço (8 com nível mapeado), 19.894 preços, 4.974 posições de estoque, 330 grupos, 11 segmentos, 58 formas de cobrança. Então não é preciso reimportar nada: o que falta são as telas para **gerenciar** esses dados.

Hoje só existe `/admin/importacoes`. O plano cria as demais áreas administrativas, todas restritas a administrador (o banco já tem as regras de acesso de escrita só-admin nessas tabelas).

## Navegação

Nova seção "Administração" no menu lateral (já existe, hoje só com Importações), com um índice em `/admin` em formato de cartões, levando a cada área abaixo.

## Telas

**Tabelas de preço** (`/admin/tabelas-preco`) — a mais crítica
- Lista as 9 tabelas com código, nome, nível mapeado e quantos clientes usam cada uma.
- Editar o nível de preço (Valor 1 a 6) por tabela, com prévia: ao escolher um nível, mostra 3 produtos de exemplo com o preço que passará a valer.
- Destaque em vermelho para tabela sem nível: produtos dessa tabela ficam bloqueados no pedido.

**Representantes** (`/admin/representantes`)
- Lista dos 143 representantes: código, nome, ativo/inativo, nº de clientes na carteira, usuário vinculado.
- Editar nome, ativar/desativar, e vincular/desvincular a um usuário do sistema (define a carteira que o vendedor enxerga).

**Clientes** (`/admin/clientes`)
- Busca e lista paginada dos 4.916 clientes.
- Editar: tabela de preço, condição de pagamento, segmento, restrição comercial (com motivo), limite de crédito, valor mínimo de pedido, ativo/inativo, representante responsável.
- Campos vindos do ERP (razão social, CNPJ, cidade) ficam somente-leitura, já que o ERP é a fonte oficial.

**Produtos** (`/admin/produtos`)
- Busca e lista paginada dos 960 produtos com foto, grupo, unidade, estoque e nº de tabelas com preço.
- Editar: liberar/ocultar do catálogo, marcar como lançamento, ativo/inativo, grupo, unidade, nome de exibição e imagem (gravados em enriquecimento, que a importação nunca apaga).

**Usuários e papéis** (`/admin/usuarios`)
- Lista de usuários com papel atual e carteira vinculada.
- Alterar papel (vendedor externo/interno, supervisor, gerente comercial, administrador, operador de integração).
- Definir visibilidade configurável para supervisor/gerente: escolher explicitamente quais representantes cada um enxerga (nunca todos por padrão).

**Cadastros gerais** (`/admin/cadastros`)
- Abas para Grupos de produto (330), Segmentos (11), Formas de cobrança (58) e Condições de pagamento (6): renomear e marcar condição padrão.

**Regras comerciais** (`/admin/regras`)
- Matriz de aprovação configurável em banco (hoje fixa em código): tipo de exceção, faixa de % e de valor, segmento, tabela, autoridade responsável, vigência e ativo/inativo.
- O motor de pedidos passa a ler essa matriz, mantendo a regra de encaminhar direto para a maior autoridade.

**Diagnóstico do catálogo** (`/admin/diagnostico`)
- Classificação dos 4.960 códigos: no catálogo, só-estoque, só-preço, sem estoque, estoque negativo, sem preço, grupo desconhecido.
- Filtro por classificação e ação de liberar manualmente um código para o catálogo.

**Auditoria** (`/admin/auditoria`)
- Registro sanitizado (sem CNPJ/endereço/financeiro) de quem alterou o quê e quando, alimentado por todas as telas acima.

## Fora deste plano

Central de Imagens (busca de fotos oficiais) e Central de Integração ERP ficam para uma etapa seguinte — a segunda depende do formato de saída do ERP, que ainda não foi definido.

## Detalhes técnicos

- Rotas em `src/routes/_authenticated/admin.*.tsx`, cada uma com `head()` próprio e verificação de admin reaproveitando `getIsAdmin`.
- Escritas via novas server functions em `src/lib/admin.functions.ts` (padrão já existente: `requireSupabaseAuth` + checagem de papel), gravando também em `audit_logs`.
- Papéis e vínculos de usuário usam cliente privilegiado no servidor apenas após confirmar que quem chama é administrador; `user_roles` continua sem escrita direta pelo cliente.
- Migração necessária: coluna `released`/`is_launch` já existe em `products`; será preciso adicionar apenas política de escrita em `user_roles` para administradores e semear `approval_rules` com a matriz atual do código.
- Listas grandes (clientes, produtos) usam busca no servidor com paginação, não carregam tudo no navegador.
