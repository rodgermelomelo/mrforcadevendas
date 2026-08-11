-- ===== ENUMS =====
create type public.app_role as enum ('vendedor_externo','vendedor_interno','supervisor','gerente_comercial','administrador','operador_integracao');
create type public.commercial_status as enum ('draft','validating','pending_approval','changes_requested','rejected','auto_approved','approved','confirmed');
create type public.integration_status as enum ('not_ready','awaiting_erp_integration','sending','accepted_by_erp','integration_error');

-- ===== UTIL =====
create or replace function public.set_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- ===== PROFILES / ROLES =====
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.is_admin(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'administrador')
$$;

create or replace function public.is_approver(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(_user_id,'supervisor')
      or public.has_role(_user_id,'gerente_comercial')
      or public.has_role(_user_id,'administrador')
$$;

create policy "profiles_select_own_or_admin" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin(auth.uid()));
create policy "profiles_insert_own" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "user_roles_select_own_or_admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'vendedor_externo')
  on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== SELLERS / VISIBILITY =====
create table public.erp_sellers (
  id uuid primary key default gen_random_uuid(),
  erp_code text not null unique,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.erp_sellers to authenticated;
grant all on public.erp_sellers to service_role;
alter table public.erp_sellers enable row level security;
create policy "erp_sellers_read" on public.erp_sellers for select to authenticated using (true);
create policy "erp_sellers_admin_write" on public.erp_sellers for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create table public.user_erp_seller_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seller_erp_code text not null references public.erp_sellers(erp_code) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, seller_erp_code)
);
grant select on public.user_erp_seller_links to authenticated;
grant all on public.user_erp_seller_links to service_role;
alter table public.user_erp_seller_links enable row level security;

create table public.team_visibility (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  seller_erp_code text not null references public.erp_sellers(erp_code) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, seller_erp_code)
);
grant select on public.team_visibility to authenticated;
grant all on public.team_visibility to service_role;
alter table public.team_visibility enable row level security;

create or replace function public.visible_seller_codes(_user_id uuid)
returns setof text language sql stable security definer set search_path = public as $$
  select seller_erp_code from public.user_erp_seller_links where user_id = _user_id
  union
  select seller_erp_code from public.team_visibility where user_id = _user_id
$$;

create or replace function public.can_see_seller(_user_id uuid, _code text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(_user_id)
      or exists (select 1 from public.visible_seller_codes(_user_id) c where c = _code)
$$;

create policy "links_select_own_or_admin" on public.user_erp_seller_links for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "links_admin_write" on public.user_erp_seller_links for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "visibility_select_own_or_admin" on public.team_visibility for select to authenticated
  using (user_id = auth.uid() or public.is_admin(auth.uid()));
create policy "visibility_admin_write" on public.team_visibility for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));