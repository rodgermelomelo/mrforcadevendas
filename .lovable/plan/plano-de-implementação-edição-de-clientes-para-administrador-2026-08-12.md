# Plano de Implementação: Edição de Clientes para Administradores

Adição de funcionalidade para administradores editarem manualmente dados comerciais de clientes (segmento, tabela de preço, situação de crédito, etc.) diretamente pela interface, facilitando ajustes que fogem à automação do ERP.

## Alterações

### Backend (Server Functions)
- Adição de `listSegments` em `src/lib/admin-data.functions.ts` para prover a lista de segmentos cadastrados no sistema.

### Componentes UI
- Criação de `src/components/admin/edit-customer-dialog.tsx`:
    - Formulário completo para edição de `priceTableCode`, `paymentTerm`, `segmentCode`, `restricted`, `restrictionReason`, `creditLimit`, `minOrderValue` e `active`.
    - Integração com a server function `updateCustomer` já existente.
- Atualização de `src/components/admin/customer-detail-dialog.tsx`:
    - Adição de um botão "Editar Cliente" visível apenas para administradores.
    - O botão abrirá o novo `EditCustomerDialog`.

### Frontend (Integração)
- Garantir que a `Carteira` e o `CustomerPicker` reflitam as mudanças após a edição (invalidação de cache do TanStack Query).

## Detalhes Técnicos
- **Segurança**: A server function `updateCustomer` já possui `assertAdmin`, garantindo que apenas administradores façam alterações.
- **Auditoria**: As alterações manuais serão registradas na tabela `audit_logs` (já implementado na função de update).
- **UX**: Uso de componentes `shadcn/ui` para consistência visual com o restante do sistema premium (magenta/Apple-style).
