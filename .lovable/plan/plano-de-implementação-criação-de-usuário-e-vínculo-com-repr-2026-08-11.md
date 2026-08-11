# Plano de Implementação: Criação de Usuário e Vínculo com Representante

Implementar um botão "Criar Usuário" na página de Administração de Usuários que abre um modal para criar um novo usuário no Supabase Auth, atribuir um papel e vinculá-lo a um representante do ERP. Também removeremos o texto de instrução residual que está poluindo o cabeçalho.

## 1. Limpeza de Texto Residual
- Localizar e remover o texto de instrução residual no `src/routes/_authenticated/admin.usuarios.tsx` que aparece na descrição da página.

## 2. Backend (Server Functions)
- Adicionar uma nova server function `createUserWithRoleAndSeller` em `src/lib/admin-data.functions.ts` que:
    - Valida o e-mail, nome, papel e código do representante.
    - Usa o `supabaseAdmin` para criar o usuário no Auth (com senha temporária e e-mail confirmado).
    - Insere o papel na tabela `user_roles`.
    - Insere o vínculo na tabela `user_erp_seller_links`.
    - Registra a ação na auditoria.

## 3. Frontend (UI)
- Modificar `src/routes/_authenticated/admin.usuarios.tsx`:
    - Adicionar o botão "Criar Usuário" no cabeçalho (prop `actions` do `AdminPage`).
    - Criar o componente `CreateUserDialog` que gerencia o formulário de criação.
    - O formulário incluirá: Nome Completo, E-mail, Papel (Select) e Representante (Combobox/Busca).
    - Integrar com a nova server function via TanStack Mutation.
    - Exibir a senha temporária gerada após o sucesso.

## Detalhes Técnicos
- **Segurança**: Todas as operações de criação de usuário serão feitas no servidor usando a service role key, protegidas por middleware de autenticação e verificação de papel 'administrador'.
- **UX**: Feedback imediato via toast e exibição clara da senha temporária para o administrador copiar e enviar ao novo usuário.
