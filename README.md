# MR Sales Hub

Crie o **MR Força de Vendas**, um e-commerce B2B interno da MR Cosméticos para a equipe de vendas criar pedidos em nome dos clientes da própria carteira. Use **React + Vite + TypeScript + Tailwind + shadcn/ui + Supabase (Postgres, Auth, Storage, RLS)**.

## Identidade visual (muito importante)

Experiência **premium**, inspirada no padrão de qualidade/organização da Apple (sem copiar a Apple), e **consistente com o MR TMS**. Use design tokens (CSS variables HSL):

- Marca (primary e accent): **magenta `328 85% 55%`**; gradiente de marca magenta→laranja `linear-gradient(135deg, hsl(328 85% 55%), hsl(20 90% 55%))`.

- Neutros em cinza sofisticado: background `220 16% 96%`, foreground `222 47% 11%`, cards brancos, borders `220 13% 88%`, radius `0.875rem`.

- Dark mode: background `222 47% 6%`, primary `328 85% 60%`.

- Fundo com gradiente radial magenta/laranja muito sutil. Sombras discretas, bordas suaves, muito espaço em branco, tipografia grande e hierárquica, animações curtas.

- **Mobile-first**, navegação com uma mão, carrinho sempre acessível, skeletons nos carregamentos, bons estados vazios/erros.

## Perfis e acesso

Perfis: vendedor_externo, vendedor_interno, supervisor, gerente_comercial, administrador, operador_integracao. Vendedores veem **apenas a própria carteira**; supervisor/gerente têm visibilidade **configurável** (nunca todos automaticamente). Aplique tudo com **RLS no Supabase**, não só escondendo menus. O ERP é a fonte oficial: o sistema recebe dados e envia ao ERP **apenas pedidos confirmados**.

## Telas

1. **Login / recuperação** (Supabase Auth).

2. **Dashboard do vendedor**: cards de meta do mês (preparado p/ futuro), total vendido, pedidos em análise/aprovados/correção/enviados ao ERP, clientes que precisam de atenção, última atualização do ERP (“Dados atualizados em DD/MM/AAAA às HH:mm”) e botão destacado **Novo pedido**.

3. **Minha carteira**: busca por código, razão social, nome fantasia, CNPJ, cidade. Cards de cliente com segmento, tabela de preço, restrição, CNPJ mascarado. Selecionar um cliente é o ponto de partida do pedido.

4. **Catálogo** (o cliente é selecionado **antes** de calcular preço): grid premium com **foto do produto**, nome, grupo, código, estoque, preço da tabela do cliente, **seletor de quantidade com atalhos rápidos (6/12/30)** e botão Adicionar. Busca e filtros por categoria/lançamentos. **Produtos sem estoque ficam em cinza, marcados “Indisponível” e não podem ser adicionados.** Produto sem preço válido para a tabela não pode ser adicionado (mostre o motivo).

5. **Carrinho** lateral (desktop) / tela dedicada (mobile), sempre mostrando o cliente atendido: “Comprando para: NOME · Tabela X · Nível · Condição”.

6. **Revisar pedido (checkout comercial)**: cliente, vendedor, tabela, nível, itens com **desconto por produto (%)** e **desconto total do pedido (%)**, botão **Bonificação** (marca o pedido como bonificação), observações, subtotal/descontos/total. **O botão de ação muda dinamicamente**: quando o pedido está no padrão, mostra **“Gerar pedido”**; assim que houver desconto, bonificação, estoque insuficiente, condição fora do padrão, abaixo do mínimo, cliente com restrição ou limite excedido, ele muda para **“Solicitar aprovação”** e indica para qual autoridade irá.

7. **Meus pedidos** + detalhe/histórico.

8. **Central de aprovações**: aprovar / reprovar (motivo obrigatório) / devolver para correção (orientação obrigatória). O aprovador **não edita** o pedido.

9. **Áreas administrativas**: Central de Importações, Central de Integração ERP, Gestão de usuários, Regras comerciais, Enriquecimento de produtos, **Diagnóstico do Catálogo**, **Central de Imagens**, Auditoria.

## Regras de pedido

- **Erros obrigatórios** (bloqueiam, pedido fica em rascunho): cliente inválido, produto inválido, produto sem preço, tabela sem mapeamento de nível, quantidade inválida, campo obrigatório ausente.

- **Exceções comerciais** (vão para aprovação): desconto, estoque insuficiente, condição fora do padrão, abaixo do valor mínimo, cliente com restrição, limite excedido, bonificação.

- Sem exceção → auto-aprovado e confirmado. Com exceção → aprovação interna.

- **Motor de aprovação por matriz configurável** (sem valores fixos no código): considera tipo de exceção, % e valor de desconto, total, estoque, condição, perfil, cliente, segmento, tabela, vigência e autoridade. Se houver várias exceções, encaminhe **direto para a maior autoridade** (não cascatear).

- Pedido **confirmado** gera **snapshot imutável** (tabela/nível/preços, data do estoque, vendedor, aprovador, exceções aprovadas, condições, hash do conteúdo). Alteração posterior → nova revisão que revalida tudo.

- **Status comercial**: draft, validating, pending_approval, changes_requested, rejected, auto_approved, approved, confirmed. **Status de integração (separado)**: not_ready, awaiting_erp_integration, sending, accepted_by_erp, integration_error.

## Importação do ERP (Central de Importações)

O ERP envia um arquivo `dados.txt` de **largura fixa, encoding Latin-1 (ISO-8859-1), quebras CRLF, versão 004.0**. Um parser versionado (**dados-v4**) deve: ler bytes, converter Latin-1, dividir por CRLF, ignorar linhas vazias, **reconstruir registros quebrados** (normalizar quebra interna para espaço), identificar o tipo pelos 2 primeiros caracteres, validar o tamanho de cada tipo, validar cabeçalho (tipo 01) e trailer (tipo 99 `###EOF###`), **conferir a contagem lógica com o trailer** e **rejeitar a importação inteira** se algo estiver inválido (nunca publicação parcial). Fluxo: upload → staging → resumo (versão, data, contagens, válidos, reconstruídos, avisos, erros, a criar, a atualizar) → confirmação → **publicação atômica**. Deduplicar por hash do arquivo. Registros que somem numa nova importação **não são apagados** (marcados ausentes/inativos). Logs **sanitizados** (sem CNPJ/CPF/endereço/financeiro).

## Catálogo e imagens

Catálogo comercial inicial = produtos “liberados” do ERP (registro tipo 22). Estoque e preços trazem também códigos históricos/inativos que **não** entram no catálogo automaticamente → tela **Diagnóstico do Catálogo** que classifica os códigos (no catálogo / só-estoque / só-preço / sem-estoque / estoque-negativo / sem-preço / grupo-desconhecido / pendente / inativo / liberado-manual). **Central de Imagens**: buscar fotos oficiais dos produtos, com candidatos (URL de origem, domínio, EAN/código encontrado, confiança alta/média/baixa, status de revisão), aprovar/reprovar, upload manual, armazenar cópia controlada no Storage (não hotlink), placeholder premium para produtos sem foto. Só imagens de **alta confiança de fonte oficial** podem ser pré-selecionadas.

## Preços (regra crítica)

Cada produto tem, por tabela, **6 valores**; qual deles é o preço aplicável depende de **configuração administrativa por tabela** (nível de preço). **Sem esse mapeamento, nunca exibir preço nem gerar pedido** — bloquear com aviso de configuração pendente. Trocar o cliente **recalcula** os preços.

## Modelo de dados (Supabase)

Tabelas: profiles, roles, user_erp_seller_links, erp_sellers, team_visibility, customers, customer_financial_snapshots, receivables, product_groups, products, product_enrichments (nunca apagado por importação), catalog_review, product_eans, inventory_snapshots, price_tables (com nível), product_prices (6 valores), payment_terms, segments, billing_methods, erp_import_runs, erp_import_errors, orders, order_items, order_versions, commercial_exceptions, approval_rules, approval_requests, approval_events, erp_outbox, image_candidates, audit_logs. Use **uuid** interno + **códigos do ERP como chaves externas únicas**. Valores monetários em **numeric** (nunca float). Datas/auditoria em **America/Sao_Paulo**. RLS em tudo.

## Integração ERP (futuro)

Apenas pedidos confirmados entram na **erp_outbox** (estados, tentativas, logs sanitizados, idempotency key, reenvio administrativo). O ERP nunca recebe rascunho/análise/devolvido/reprovado. O **formato de saída ainda não está definido** — crie uma abstração `ErpOrderExporter` com adapter `NotConfigured` e uma tela indicando “conector a definir”. **Não invente um formato.**

## Segurança

Dados reais só locais; nunca em fixtures/seeds/testes (use dados sintéticos). Logs sanitizados. Comece com um **modo demo** com dados sintéticos e um catálogo de exemplo com fotos, para navegar sem depender de importação.

Comece pela navegação, pelo design premium (magenta) e pelo fluxo Carteira → Catálogo → Carrinho → Revisar/Gerar pedido, depois as áreas administrativas.

DESIGN: SIGA ESTE PROEJTO DO GITHUB: https://github.com/rodgermelomelo/foxyentregas-645dad94.git

EM ANEXO TEM TODOS OS ARQUIVOS NECESSÁRIOS!

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://mrforcadevendas.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/d30b1c63-9c91-4bc7-bf42-249ef45ba26d).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
