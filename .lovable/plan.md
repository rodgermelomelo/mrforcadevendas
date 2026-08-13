# Plano de Implementação: Motivos de Indisponibilidade no Catálogo

Exibir o motivo claro pelo qual um produto está indisponível para o cliente selecionado (sem estoque, tabela de preço não configurada, restrição de carteira, etc.).

## Alterações

### 1. Domínio e Tipagem
- Garantir que `Product` contenha informações suficientes para auditoria de indisponibilidade (já possui `stock` e `prices`).
- Revisar a interface `PriceResolution` (em `src/lib/pricing.ts`) para suportar mensagens de erro detalhadas.

### 2. Lógica de Preços (`src/lib/pricing.ts`)
- Refinar a função `resolvePrice` para identificar motivos específicos de falha:
  - Tabela de preço inexistente no produto.
  - Nível de preço não mapeado para o cliente.
  - Preço zero ou nulo no nível correspondente.

### 3. Interface do Cartão de Produto (`src/features/catalog/product-card.tsx`)
- Atualizar a exibição do estado `blocked`.
- Substituir mensagens genéricas por motivos específicos:
  - **Sem Estoque:** Quando `stock <= 0`.
  - **Tabela Inexistente:** Quando a tabela do cliente não existe no cadastro do produto.
  - **Nível Não Mapeado:** Quando o cliente não tem nível definido.
  - **Preço Não Aplicável:** Quando o preço no nível é zero/nulo.
  - **Restrição:** Verificar campo `restricted` do cliente (via `useSales`).

### 4. Modal de Detalhes do Produto (`src/features/catalog/product-detail-dialog.tsx`)
- Aplicar a mesma lógica de mensagens detalhadas no modal.
- Melhorar o componente de alerta de bloqueio para ser mais informativo.

## Detalhes Técnicos

- Utilizar `useSales` para obter o contexto do `customer` e suas restrições.
- As mensagens devem ser curtas para o card e mais explicativas no modal.

```text
Exemplos de Mensagens:
- "Indisponível: Sem saldo em estoque"
- "Indisponível: Tabela [TAB] não cadastrada"
- "Indisponível: Cliente com restrição comercial"
- "Indisponível: Nível de preço não configurado"
```
