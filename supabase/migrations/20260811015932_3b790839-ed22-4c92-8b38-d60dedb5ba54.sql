-- ===== REFERENCE =====
create table public.segments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);
create table public.payment_terms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null,
  is_standard boolean not null default true
);
create table public.billing_methods (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null
);
create table public.product_groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);
create table public.price_tables (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  mapped_level smallint,
  level_label text,
  updated_at timestamptz not null default now(),
  constraint price_tables_level_range check (mapped_level is null or (mapped_level between 0 and 5))
);

-- ===== CUSTOMERS =====
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  erp_code text not null unique,
  legal_name text not null,
  trade_name text not null,
  tax_id text not null,
  city text not null default '',
  uf text not null default '',
  segment_code text,
  price_table_code text not null,
  payment_term text not null default '',
  seller_erp_code text not null,
  restricted boolean not null default false,
  restriction_reason text,
  credit_limit numeric(14,2) not null default 0,
  open_balance numeric(14,2) not null default 0,
  min_order_value numeric(14,2) not null default 0,
  last_order_at timestamptz,
  active boolean not null default true,
  missing_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.customers (seller_erp_code);

create table public.customer_financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  customer_erp_code text not null references public.customers(erp_code) on delete cascade,
  captured_at timestamptz not null default now(),
  open_balance numeric(14,2) not null default 0,
  overdue_balance numeric(14,2) not null default 0,
  credit_limit numeric(14,2) not null default 0
);
create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  customer_erp_code text not null references public.customers(erp_code) on delete cascade,
  document text not null,
  due_date date not null,
  amount numeric(14,2) not null,
  paid boolean not null default false
);

-- ===== PRODUCTS =====
create table public.products (
  id uuid primary key default gen_random_uuid(),
  erp_code text not null unique,
  name text not null,
  group_code text,
  unit text not null default 'UN',
  is_launch boolean not null default false,
  released boolean not null default true,
  active boolean not null default true,
  missing_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.product_enrichments (
  id uuid primary key default gen_random_uuid(),
  product_erp_code text not null unique,
  display_name text,
  description text,
  image_path text,
  image_url text,
  updated_at timestamptz not null default now()
);
create table public.product_eans (
  id uuid primary key default gen_random_uuid(),
  product_erp_code text not null,
  ean text not null,
  unique (product_erp_code, ean)
);
create table public.catalog_review (
  id uuid primary key default gen_random_uuid(),
  erp_code text not null unique,
  classification text not null,
  detail text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  product_erp_code text not null unique,
  quantity numeric(14,3) not null default 0,
  captured_at timestamptz not null default now()
);
create table public.product_prices (
  id uuid primary key default gen_random_uuid(),
  product_erp_code text not null,
  price_table_code text not null,
  value_1 numeric(14,4) not null default 0,
  value_2 numeric(14,4) not null default 0,
  value_3 numeric(14,4) not null default 0,
  value_4 numeric(14,4) not null default 0,
  value_5 numeric(14,4) not null default 0,
  value_6 numeric(14,4) not null default 0,
  updated_at timestamptz not null default now(),
  unique (product_erp_code, price_table_code)
);

-- ===== GRANTS =====
grant select on public.segments, public.payment_terms, public.billing_methods,
  public.product_groups, public.price_tables, public.products, public.product_enrichments,
  public.product_eans, public.catalog_review, public.inventory_snapshots, public.product_prices,
  public.customers, public.customer_financial_snapshots, public.receivables to authenticated;
grant insert, update, delete on public.segments, public.payment_terms, public.billing_methods,
  public.product_groups, public.price_tables, public.products, public.product_enrichments,
  public.product_eans, public.catalog_review, public.inventory_snapshots, public.product_prices,
  public.customers, public.customer_financial_snapshots, public.receivables to authenticated;
grant all on public.segments, public.payment_terms, public.billing_methods,
  public.product_groups, public.price_tables, public.products, public.product_enrichments,
  public.product_eans, public.catalog_review, public.inventory_snapshots, public.product_prices,
  public.customers, public.customer_financial_snapshots, public.receivables to service_role;

-- ===== RLS =====
alter table public.segments enable row level security;
alter table public.payment_terms enable row level security;
alter table public.billing_methods enable row level security;
alter table public.product_groups enable row level security;
alter table public.price_tables enable row level security;
alter table public.products enable row level security;
alter table public.product_enrichments enable row level security;
alter table public.product_eans enable row level security;
alter table public.catalog_review enable row level security;
alter table public.inventory_snapshots enable row level security;
alter table public.product_prices enable row level security;
alter table public.customers enable row level security;
alter table public.customer_financial_snapshots enable row level security;
alter table public.receivables enable row level security;

create policy "segments_read" on public.segments for select to authenticated using (true);
create policy "segments_admin" on public.segments for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "payment_terms_read" on public.payment_terms for select to authenticated using (true);
create policy "payment_terms_admin" on public.payment_terms for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "billing_methods_read" on public.billing_methods for select to authenticated using (true);
create policy "billing_methods_admin" on public.billing_methods for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "product_groups_read" on public.product_groups for select to authenticated using (true);
create policy "product_groups_admin" on public.product_groups for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "price_tables_read" on public.price_tables for select to authenticated using (true);
create policy "price_tables_admin" on public.price_tables for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "products_read" on public.products for select to authenticated using (true);
create policy "products_admin" on public.products for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "enrichments_read" on public.product_enrichments for select to authenticated using (true);
create policy "enrichments_admin" on public.product_enrichments for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "eans_read" on public.product_eans for select to authenticated using (true);
create policy "eans_admin" on public.product_eans for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "catalog_review_read" on public.catalog_review for select to authenticated using (true);
create policy "catalog_review_admin" on public.catalog_review for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "inventory_read" on public.inventory_snapshots for select to authenticated using (true);
create policy "inventory_admin" on public.inventory_snapshots for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "prices_read" on public.product_prices for select to authenticated using (true);
create policy "prices_admin" on public.product_prices for all to authenticated using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "customers_scope_read" on public.customers for select to authenticated
  using (public.can_see_seller(auth.uid(), seller_erp_code));
create policy "customers_admin_write" on public.customers for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

create policy "cfs_scope_read" on public.customer_financial_snapshots for select to authenticated
  using (exists (select 1 from public.customers c where c.erp_code = customer_erp_code and public.can_see_seller(auth.uid(), c.seller_erp_code)));
create policy "cfs_admin_write" on public.customer_financial_snapshots for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
create policy "receivables_scope_read" on public.receivables for select to authenticated
  using (exists (select 1 from public.customers c where c.erp_code = customer_erp_code and public.can_see_seller(auth.uid(), c.seller_erp_code)));
create policy "receivables_admin_write" on public.receivables for all to authenticated
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));