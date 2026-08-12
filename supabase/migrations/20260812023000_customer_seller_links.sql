-- Carteira comercial normalizada: um cliente pode pertencer a varios representantes.
-- Mantemos customers.seller_erp_code como legado/compatibilidade, mas a fonte
-- correta de visibilidade passa a ser customer_seller_links.

CREATE TABLE IF NOT EXISTS public.customer_seller_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_erp_code text NOT NULL REFERENCES public.customers(erp_code) ON DELETE CASCADE,
  seller_erp_code text NOT NULL REFERENCES public.erp_sellers(erp_code) ON DELETE CASCADE,
  price_table_code text NOT NULL DEFAULT '000',
  payment_term text NOT NULL DEFAULT '',
  segment_code text,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'erp',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_erp_code, seller_erp_code)
);

CREATE INDEX IF NOT EXISTS customer_seller_links_customer_idx
  ON public.customer_seller_links (customer_erp_code);
CREATE INDEX IF NOT EXISTS customer_seller_links_seller_idx
  ON public.customer_seller_links (seller_erp_code);
CREATE INDEX IF NOT EXISTS customer_seller_links_price_table_idx
  ON public.customer_seller_links (price_table_code);

INSERT INTO public.customer_seller_links (
  customer_erp_code,
  seller_erp_code,
  price_table_code,
  payment_term,
  segment_code,
  active,
  source
)
SELECT
  erp_code,
  seller_erp_code,
  price_table_code,
  payment_term,
  segment_code,
  active,
  'legacy_customers'
FROM public.customers
WHERE seller_erp_code IS NOT NULL
ON CONFLICT (customer_erp_code, seller_erp_code) DO UPDATE SET
  price_table_code = EXCLUDED.price_table_code,
  payment_term = EXCLUDED.payment_term,
  segment_code = EXCLUDED.segment_code,
  active = EXCLUDED.active,
  updated_at = now();

GRANT SELECT ON public.customer_seller_links TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.customer_seller_links TO authenticated;
GRANT ALL ON public.customer_seller_links TO service_role;

ALTER TABLE public.customer_seller_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_seller_links_scope_read" ON public.customer_seller_links;
DROP POLICY IF EXISTS "customer_seller_links_admin_write" ON public.customer_seller_links;

CREATE POLICY "customer_seller_links_scope_read"
ON public.customer_seller_links
FOR SELECT
TO authenticated
USING (public.can_see_seller(auth.uid(), seller_erp_code));

CREATE POLICY "customer_seller_links_admin_write"
ON public.customer_seller_links
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_customer_seller_links_updated_at'
      AND tgrelid = 'public.customer_seller_links'::regclass
  ) THEN
    CREATE TRIGGER set_customer_seller_links_updated_at
    BEFORE UPDATE ON public.customer_seller_links
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

DROP POLICY IF EXISTS "customers_scope_read" ON public.customers;
CREATE POLICY "customers_scope_read"
ON public.customers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_seller_links csl
    WHERE csl.customer_erp_code = customers.erp_code
      AND csl.active = true
      AND public.can_see_seller(auth.uid(), csl.seller_erp_code)
  )
  OR public.can_see_seller(auth.uid(), seller_erp_code)
);

DROP POLICY IF EXISTS "cfs_scope_read" ON public.customer_financial_snapshots;
CREATE POLICY "cfs_scope_read"
ON public.customer_financial_snapshots
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_seller_links csl
    WHERE csl.customer_erp_code = customer_financial_snapshots.customer_erp_code
      AND csl.active = true
      AND public.can_see_seller(auth.uid(), csl.seller_erp_code)
  )
  OR EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.erp_code = customer_financial_snapshots.customer_erp_code
      AND public.can_see_seller(auth.uid(), c.seller_erp_code)
  )
);

DROP POLICY IF EXISTS "receivables_scope_read" ON public.receivables;
CREATE POLICY "receivables_scope_read"
ON public.receivables
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.customer_seller_links csl
    WHERE csl.customer_erp_code = receivables.customer_erp_code
      AND csl.active = true
      AND public.can_see_seller(auth.uid(), csl.seller_erp_code)
  )
  OR EXISTS (
    SELECT 1
    FROM public.customers c
    WHERE c.erp_code = receivables.customer_erp_code
      AND public.can_see_seller(auth.uid(), c.seller_erp_code)
  )
);
