-- ===== APPROVAL MATRIX =====
create table public.approval_rules (
  id uuid primary key default gen_random_uuid(),
  exception_type text not null,
  min_percent numeric(6,2),
  max_percent numeric(6,2),
  min_amount numeric(14,2),
  max_amount numeric(14,2),
  segment_code text,
  price_table_code text,
  authority public.app_role not null,
  valid_from date not null default current_date,
  valid_to date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.approval_rules to authenticated;
grant insert, update, delete on public.approval_rules to authenticated;
grant all on public.approval_rules to service_role;
alter table public.approval_rules enable row level security;
create policy "approval_rules_read" on public.approval_rules for select to authenticated using (true);
create policy "approval_rules_admin" on public.approval_rules for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- ===== ORDERS =====
create sequence public.order_number_seq;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number text not null unique default ('PV-' || to_char(now() at time zone 'America/Sao_Paulo','YYYY') || '-' || lpad(nextval('public.order_number_seq')::text, 5, '0')),
  customer_erp_code text not null references public.customers(erp_code),
  customer_name text not null,
  seller_erp_code text not null,
  seller_name text not null,
  created_by uuid not null references auth.users(id),
  price_table_code text not null,
  price_level_label text not null default '',
  payment_term text not null default '',
  is_bonus boolean not null default false,
  order_discount_percent numeric(6,2) not null default 0,
  subtotal numeric(14,2) not null default 0,
  discount_total numeric(14,2) not null default 0,
  total numeric(14,2) not null default 0,
  notes text not null default '',
  status public.commercial_status not null default 'draft',
  integration_status public.integration_status not null default 'not_ready',
  required_authority public.app_role,
  content_hash text not null default '',
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (seller_erp_code);
create index on public.orders (status);
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_erp_code text not null,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(14,4) not null,
  discount_percent numeric(6,2) not null default 0,
  total numeric(14,2) not null
);
create index on public.order_items (order_id);

create table public.order_versions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  revision integer not null default 1,
  snapshot jsonb not null,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (order_id, revision)
);

create table public.commercial_exceptions (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  exception_type text not null,
  label text not null,
  detail text not null default '',
  authority public.app_role not null,
  created_at timestamptz not null default now()
);
create index on public.commercial_exceptions (order_id);

create table public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  required_authority public.app_role not null,
  status text not null default 'pending',
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  reason text,
  created_at timestamptz not null default now()
);
create index on public.approval_requests (order_id);

create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,
  detail text,
  created_at timestamptz not null default now()
);
create index on public.approval_events (order_id);

grant select, insert, update on public.orders to authenticated;
grant select, insert, update, delete on public.order_items to authenticated;
grant select, insert on public.order_versions to authenticated;
grant select, insert, delete on public.commercial_exceptions to authenticated;
grant select, insert, update on public.approval_requests to authenticated;
grant select, insert on public.approval_events to authenticated;
grant all on public.orders, public.order_items, public.order_versions,
  public.commercial_exceptions, public.approval_requests, public.approval_events to service_role;
grant usage, select on sequence public.order_number_seq to authenticated, service_role;

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_versions enable row level security;
alter table public.commercial_exceptions enable row level security;
alter table public.approval_requests enable row level security;
alter table public.approval_events enable row level security;

create policy "orders_scope_read" on public.orders for select to authenticated
  using (created_by = auth.uid() or public.can_see_seller(auth.uid(), seller_erp_code));
create policy "orders_insert_own" on public.orders for insert to authenticated
  with check (created_by = auth.uid() and public.can_see_seller(auth.uid(), seller_erp_code));
create policy "orders_update_owner_draft" on public.orders for update to authenticated
  using (created_by = auth.uid() and status in ('draft','changes_requested'))
  with check (created_by = auth.uid());
create policy "orders_update_approver" on public.orders for update to authenticated
  using (public.is_approver(auth.uid()) and public.can_see_seller(auth.uid(), seller_erp_code))
  with check (public.is_approver(auth.uid()) and public.can_see_seller(auth.uid(), seller_erp_code));

create or replace function public.can_read_order(_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.id = _order_id
      and (o.created_by = auth.uid() or public.can_see_seller(auth.uid(), o.seller_erp_code))
  )
$$;
create or replace function public.can_edit_order_items(_order_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.id = _order_id and o.created_by = auth.uid()
      and o.status in ('draft','changes_requested','validating','pending_approval','auto_approved','approved','confirmed')
  )
$$;

create policy "order_items_read" on public.order_items for select to authenticated using (public.can_read_order(order_id));
create policy "order_items_write" on public.order_items for all to authenticated
  using (public.can_edit_order_items(order_id)) with check (public.can_edit_order_items(order_id));
create policy "order_versions_read" on public.order_versions for select to authenticated using (public.can_read_order(order_id));
create policy "order_versions_insert" on public.order_versions for insert to authenticated with check (public.can_edit_order_items(order_id));
create policy "exceptions_read" on public.commercial_exceptions for select to authenticated using (public.can_read_order(order_id));
create policy "exceptions_write" on public.commercial_exceptions for all to authenticated
  using (public.can_edit_order_items(order_id)) with check (public.can_edit_order_items(order_id));
create policy "approval_requests_read" on public.approval_requests for select to authenticated using (public.can_read_order(order_id));
create policy "approval_requests_insert" on public.approval_requests for insert to authenticated with check (public.can_edit_order_items(order_id));
create policy "approval_requests_decide" on public.approval_requests for update to authenticated
  using (public.is_approver(auth.uid()) and public.can_read_order(order_id))
  with check (public.is_approver(auth.uid()) and public.can_read_order(order_id));
create policy "approval_events_read" on public.approval_events for select to authenticated using (public.can_read_order(order_id));
create policy "approval_events_insert" on public.approval_events for insert to authenticated
  with check (actor_id = auth.uid() and public.can_read_order(order_id));

-- ===== OPERATION =====
create table public.erp_import_runs (
  id uuid primary key default gen_random_uuid(),
  file_hash text not null,
  parser_version text not null default 'dados-v4',
  file_version text,
  status text not null default 'staged',
  totals jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_by uuid references auth.users(id)
);
create table public.erp_import_errors (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.erp_import_runs(id) on delete cascade,
  line_number integer,
  record_type text,
  message text not null,
  created_at timestamptz not null default now()
);
create table public.erp_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  idempotency_key text not null unique,
  state text not null default 'queued',
  attempts integer not null default 0,
  last_error text,
  payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.image_candidates (
  id uuid primary key default gen_random_uuid(),
  product_erp_code text not null,
  source_url text not null,
  domain text not null default '',
  matched_code text,
  confidence text not null default 'baixa',
  review_status text not null default 'pending',
  storage_path text,
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  entity text not null,
  entity_id text,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

grant select, insert, update on public.erp_import_runs, public.erp_import_errors,
  public.erp_outbox, public.image_candidates to authenticated;
grant select, insert on public.audit_logs to authenticated;
grant all on public.erp_import_runs, public.erp_import_errors, public.erp_outbox,
  public.image_candidates, public.audit_logs to service_role;

alter table public.erp_import_runs enable row level security;
alter table public.erp_import_errors enable row level security;
alter table public.erp_outbox enable row level security;
alter table public.image_candidates enable row level security;
alter table public.audit_logs enable row level security;

create or replace function public.is_ops(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin(_user_id) or public.has_role(_user_id,'operador_integracao')
$$;

create policy "import_runs_ops" on public.erp_import_runs for all to authenticated
  using (public.is_ops(auth.uid())) with check (public.is_ops(auth.uid()));
create policy "import_errors_ops" on public.erp_import_errors for all to authenticated
  using (public.is_ops(auth.uid())) with check (public.is_ops(auth.uid()));
create policy "outbox_ops" on public.erp_outbox for all to authenticated
  using (public.is_ops(auth.uid())) with check (public.is_ops(auth.uid()));
create policy "image_candidates_ops" on public.image_candidates for all to authenticated
  using (public.is_ops(auth.uid())) with check (public.is_ops(auth.uid()));
create policy "audit_read_admin" on public.audit_logs for select to authenticated using (public.is_admin(auth.uid()));
create policy "audit_insert_self" on public.audit_logs for insert to authenticated with check (actor_id = auth.uid());

-- lock down helper functions
revoke execute on function public.has_role(uuid, public.app_role) from anon, public;
revoke execute on function public.is_admin(uuid) from anon, public;
revoke execute on function public.is_approver(uuid) from anon, public;
revoke execute on function public.is_ops(uuid) from anon, public;
revoke execute on function public.visible_seller_codes(uuid) from anon, public;
revoke execute on function public.can_see_seller(uuid, text) from anon, public;
revoke execute on function public.can_read_order(uuid) from anon, public;
revoke execute on function public.can_edit_order_items(uuid) from anon, public;
revoke execute on function public.set_updated_at() from anon, public;
revoke execute on function public.handle_new_user() from anon, public;