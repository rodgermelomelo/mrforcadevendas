# Produtos, Estoque e Preços em uma única página

## Diagnóstico atual

Hoje o mesmo produto está espalhado em três telas administrativas:

- **/admin/produtos** — lista com busca por código/nome, edição inline (liberação, lançamento, ativo, grupo, unidade, nome de exibição, imagem). Já mostra estoque e "N tabelas com preço", mas apenas como texto.
- **/admin/estoque** — lista `inventory_snapshots` (registro 27) com busca por código e filtros Todos / Com estoque / Sem estoque / Negativo. Somente leitura.
- **/admin/precos** — lista `product_prices` (registro 28): 6 valores por tabela, destacando o nível mapeado. Somente leitura.

As duas últimas não têm nada que o produto não possa mostrar: são recortes de leitura da mesma entidade, com a mesma chave (`erp_code`). O custo é navegação em três lugares para responder uma pergunta só ("esse produto está liberado, tem estoque e tem preço?").

## Solução

Uma tela única — **Produtos** — como centro de tudo, com um **modal de detalhe do produto em abas**.

### Lista (tela principal)

Cada linha mostra, além do que já existe, três indicadores de saúde lado a lado:

```text
[img]  304 ESMALTE TRANSPARENTE          [Lançamento] [Fora do catálogo]
       304 · UN · DAILUS
       Estoque 128    Preço OK (4 tabelas)    Catálogo: liberado
```

Semáforo por indicador: estoque negativo/zerado em vermelho/cinza; "Sem preço" ou "Tabela sem nível mapeado" em vermelho.

Filtros na barra superior (combináveis, chips removíveis):
busca por código/nome · Estoque (todos / com / sem / negativo) · Preço (todos / com preço / sem preço / tabela sem nível) · Catálogo (todos / liberado / fora do catálogo / inativo) · Lançamentos · Grupo/Marca.

Ordenação: código, nome, estoque, e contagem de resultados visível.

### Modal de detalhe (clique na linha)

Cabeçalho fixo com foto, nome de exibição, código, unidade, e as badges de estoque/preço/catálogo. Quatro abas:

1. **Visão geral** — descrição oficial do ERP, grupo, marca, unidade, datas de atualização, atalho "Ver no catálogo comercial".
2. **Estoque** — quantidade atual, data da captura, aviso de somente leitura (vem do registro 27), e situação no catálogo.
3. **Preços** — uma linha por tabela de preço com os 6 valores, destaque no nível mapeado e o preço aplicável em evidência; alerta com link para /admin/tabelas-preco quando a tabela não tem nível mapeado.
4. **Editar** — o formulário que hoje é inline: liberado, lançamento, ativo, grupo, unidade, nome de exibição, URL da imagem.

### O que acontece com /admin/estoque e /admin/precos

Deixam de existir como itens de menu. As rotas continuam válidas e **redirecionam para /admin/produtos** com o filtro correspondente já aplicado (`?estoque=...` / `?preco=...`), preservando links antigos e o link que hoje sai do card de produto.

## Detalhes técnicos

- Nova server function `getProductDetail({ erpCode })` em `src/lib/admin-data.functions.ts`: retorna produto + enriquecimento + snapshot de estoque (com `captured_at`) + todas as linhas de `product_prices` com `mapped_level`/`level_label` da tabela. Reaproveita a lógica já existente em `listInventory` e `listProductPrices`.
- `listProducts` ganha parâmetros `stockFilter`, `priceFilter`, `catalogFilter`, `groupCode`, `sort`, e passa a devolver `hasPrice`, `hasUnmappedTable`, `stockCapturedAt` por linha. As agregações de estoque/preço já são feitas hoje na função; a mudança é expor os flags e permitir filtrar por eles.
- `listInventory` e `listProductPrices` permanecem como estão (usadas pelo modal e por eventuais consultas), sem duplicar lógica.
- Novos componentes: `src/components/admin/product-detail-dialog.tsx` (modal com abas, usando o Dialog/Tabs do shadcn) e `src/components/admin/product-filters.tsx`.
- `src/routes/_authenticated/admin.produtos.tsx` passa a orquestrar lista + filtros + modal; o `ProductForm` atual migra para dentro da aba Editar.
- `admin.estoque.tsx` e `admin.precos.tsx` viram redirects (`beforeLoad` → `redirect` para `/admin/produtos` com search params).
- `app-shell.tsx` e `admin.index.tsx`: remover os dois cards/itens e reescrever o card de Produtos como "Produtos, estoque e preços".
- Metadados `head()` da rota de produtos atualizados para refletir o escopo unificado.
- Nenhuma mudança de banco de dados nem de RLS.
