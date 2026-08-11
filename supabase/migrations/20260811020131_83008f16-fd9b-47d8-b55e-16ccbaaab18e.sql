create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'vendedor_externo')
  on conflict do nothing;
  insert into public.user_erp_seller_links (user_id, seller_erp_code)
  select new.id, 'V001' where exists (select 1 from public.erp_sellers where erp_code = 'V001')
  on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from anon, public;