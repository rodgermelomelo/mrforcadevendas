CREATE TABLE public.customer_seller_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_erp_code text NOT NULL,
  seller_erp_code text NOT NULL,
  price_table_code text NOT NULL DEFAULT '000',
  payment_term text NOT NULL DEFAULT '',
  segment_code text,
  active boolean NOT NULL DEFAULT true,
  source text NOT NULL DEFAULT 'erp',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_erp_code, seller_erp_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_seller_links TO authenticated;
GRANT ALL ON public.customer_seller_links TO service_role;

ALTER TABLE public.customer_seller_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read own wallet links" ON public.customer_seller_links
  FOR SELECT TO authenticated
  USING (public.can_see_seller(auth.uid(), seller_erp_code));

CREATE POLICY "ops manage links" ON public.customer_seller_links
  FOR ALL TO authenticated
  USING (public.is_ops(auth.uid()))
  WITH CHECK (public.is_ops(auth.uid()));

CREATE INDEX idx_csl_seller ON public.customer_seller_links (seller_erp_code);
CREATE INDEX idx_csl_customer ON public.customer_seller_links (customer_erp_code);

CREATE TRIGGER customer_seller_links_updated_at
  BEFORE UPDATE ON public.customer_seller_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.customer_seller_links (customer_erp_code, seller_erp_code, price_table_code, payment_term, segment_code, active, source)
SELECT erp_code, seller_erp_code, price_table_code, payment_term, segment_code, active, 'erp'
FROM public.customers
ON CONFLICT (customer_erp_code, seller_erp_code) DO NOTHING;