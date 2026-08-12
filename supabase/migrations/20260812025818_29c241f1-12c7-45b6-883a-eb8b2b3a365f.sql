CREATE TABLE public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Regra de comissao',
  percent numeric NOT NULL DEFAULT 0,
  brand text,
  category text,
  product_erp_code text,
  priority integer NOT NULL DEFAULT 0,
  valid_from date NOT NULL DEFAULT current_date,
  valid_to date,
  active boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rules TO authenticated;
GRANT ALL ON public.commission_rules TO service_role;

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read commission rules" ON public.commission_rules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins manage commission rules" ON public.commission_rules
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER commission_rules_updated_at
  BEFORE UPDATE ON public.commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.commission_rule_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.commission_rules(id) ON DELETE CASCADE,
  seller_erp_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_id, seller_erp_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commission_rule_sellers TO authenticated;
GRANT ALL ON public.commission_rule_sellers TO service_role;

ALTER TABLE public.commission_rule_sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read commission rule sellers" ON public.commission_rule_sellers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "admins manage commission rule sellers" ON public.commission_rule_sellers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

ALTER TABLE public.orders
  ADD COLUMN commission_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN commission_calculated_at timestamptz;

ALTER TABLE public.order_items
  ADD COLUMN commission_percent numeric NOT NULL DEFAULT 0,
  ADD COLUMN commission_base numeric NOT NULL DEFAULT 0,
  ADD COLUMN commission_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN commission_rule_id uuid,
  ADD COLUMN commission_rule_name text,
  ADD COLUMN commission_scope text NOT NULL DEFAULT '';