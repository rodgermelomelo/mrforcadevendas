-- Administradores podem gerenciar papéis
create policy "user_roles_admin_insert" on public.user_roles for insert to authenticated
  with check (public.is_admin(auth.uid()));
create policy "user_roles_admin_update" on public.user_roles for update to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "user_roles_admin_delete" on public.user_roles for delete to authenticated
  using (public.is_admin(auth.uid()));

grant insert, update, delete on public.user_roles to authenticated;

-- Admin precisa enxergar todos os perfis para a tela de usuários (já coberto por is_admin no select existente)

-- Semear a matriz de aprovação com as regras que hoje vivem no código
insert into public.approval_rules (exception_type, min_percent, max_percent, authority, valid_from, active)
values
  ('discount_item', 0.01, 5, 'supervisor', current_date, true),
  ('discount_item', 5.01, 12, 'gerente_comercial', current_date, true),
  ('discount_item', 12.01, null, 'administrador', current_date, true),
  ('discount_order', 0.01, 5, 'supervisor', current_date, true),
  ('discount_order', 5.01, 12, 'gerente_comercial', current_date, true),
  ('discount_order', 12.01, null, 'administrador', current_date, true),
  ('insufficient_stock', null, null, 'supervisor', current_date, true),
  ('non_standard_terms', null, null, 'gerente_comercial', current_date, true),
  ('below_minimum', null, null, 'supervisor', current_date, true),
  ('restricted_customer', null, null, 'gerente_comercial', current_date, true),
  ('credit_limit_exceeded', null, null, 'administrador', current_date, true),
  ('bonus_order', null, null, 'gerente_comercial', current_date, true)
on conflict do nothing;