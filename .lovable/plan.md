# Implementação de Edição em Lote de Marcas

Este plano descreve a implementação da funcionalidade de edição em lote para marcas de produtos na área administrativa, permitindo que administradores selecionem múltiplos produtos e apliquem uma marca de uma só vez.

## Alterações Propostas

### Backend / API
- Criar uma nova server function `bulkUpdateProductBrand` em `src/lib/admin-data.functions.ts` para processar a atualização de múltiplos códigos de produtos.
- Garantir que a função realize auditoria da operação.

### Componentes UI
- Modificar `src/routes/_authenticated/admin.produtos.tsx` para adicionar suporte a seleção múltipla.
- Adicionar checkboxes na listagem de produtos.
- Implementar uma barra de ações flutuante (floating action bar) que aparece quando um ou mais itens são selecionados.
- Criar um diálogo de edição em lote que permite escolher uma marca existente ou digitar uma nova.

### Fluxo do Usuário
1. O administrador acessa a lista de produtos.
2. Seleciona os produtos desejados via checkbox.
3. Clica no botão "Editar marca em lote" na barra inferior.
4. Escolhe a marca no modal e confirma.
5. O sistema processa a atualização e recarrega a lista.

## Detalhes Técnicos
- Utilizar `useMutation` do TanStack Query para a atualização.
- Garantir que a UI de seleção seja responsiva e intuitiva.
- Adicionar opção de "Limpar seleção".
