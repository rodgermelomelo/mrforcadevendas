-- Sistema de comissoes configuravel e auditavel.
-- As regras usam a curadoria atual de products.brand/category, preservada nas importacoes.

CREATE TABLE IF NOT EXISTS public.commission_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  percent numeric(6,2) NOT NULL DEFAULT 0 CHECK (percent >= 0 AND percent <= 100),
  brand text,
  category text,
  product_erp_code text REFERENCES public.products(erp_code) ON DELETE CASCADE,
  priority integer NOT NULL DEFAULT 100,
  valid_from date NOT NULL DEFAULT current_date,
  valid_to date,
  active boolean NOT NULL DEFAULT true,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commission_rules_valid_period CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE IF NOT EXISTS public.commission_rule_sellers (
  rule_id uuid NOT NULL REFERENCES public.commission_rules(id) ON DELETE CASCADE,
  seller_erp_code text NOT NULL REFERENCES public.erp_sellers(erp_code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (rule_id, seller_erp_code)
);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS commission_total numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_calculated_at timestamptz;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS commission_percent numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_base numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_value numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS commission_rule_id uuid REFERENCES public.commission_rules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commission_rule_name text,
  ADD COLUMN IF NOT EXISTS commission_scope text NOT NULL DEFAULT 'sem_regra';

CREATE INDEX IF NOT EXISTS commission_rules_active_idx
  ON public.commission_rules (active, valid_from, valid_to);
CREATE INDEX IF NOT EXISTS commission_rules_brand_category_idx
  ON public.commission_rules (brand, category);
CREATE INDEX IF NOT EXISTS commission_rules_product_idx
  ON public.commission_rules (product_erp_code);
CREATE INDEX IF NOT EXISTS commission_rule_sellers_seller_idx
  ON public.commission_rule_sellers (seller_erp_code);
CREATE INDEX IF NOT EXISTS orders_commission_month_idx
  ON public.orders (seller_erp_code, created_at, commission_total);

GRANT SELECT ON public.commission_rules, public.commission_rule_sellers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.commission_rules, public.commission_rule_sellers TO authenticated;
GRANT ALL ON public.commission_rules, public.commission_rule_sellers TO service_role;

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_rule_sellers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_commission_rule(_user_id uuid, _rule_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR NOT EXISTS (
      SELECT 1
      FROM public.commission_rule_sellers crs
      WHERE crs.rule_id = _rule_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.commission_rule_sellers crs
      WHERE crs.rule_id = _rule_id
        AND public.can_see_seller(_user_id, crs.seller_erp_code)
    )
$$;

GRANT EXECUTE ON FUNCTION public.can_read_commission_rule(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_read_commission_rule(uuid, uuid) FROM anon, public;

DROP POLICY IF EXISTS "commission_rules_read_scope" ON public.commission_rules;
DROP POLICY IF EXISTS "commission_rules_admin_write" ON public.commission_rules;
DROP POLICY IF EXISTS "commission_rule_sellers_read_scope" ON public.commission_rule_sellers;
DROP POLICY IF EXISTS "commission_rule_sellers_admin_write" ON public.commission_rule_sellers;

CREATE POLICY "commission_rules_read_scope"
ON public.commission_rules
FOR SELECT
TO authenticated
USING (public.can_read_commission_rule(auth.uid(), id));

CREATE POLICY "commission_rules_admin_write"
ON public.commission_rules
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "commission_rule_sellers_read_scope"
ON public.commission_rule_sellers
FOR SELECT
TO authenticated
USING (
  public.is_admin(auth.uid())
  OR public.can_see_seller(auth.uid(), seller_erp_code)
);

CREATE POLICY "commission_rule_sellers_admin_write"
ON public.commission_rule_sellers
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_commission_rules_updated_at'
      AND tgrelid = 'public.commission_rules'::regclass
  ) THEN
    CREATE TRIGGER set_commission_rules_updated_at
    BEFORE UPDATE ON public.commission_rules
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

COMMENT ON TABLE public.commission_rules IS
  'Regras comerciais de comissao por produto, marca, categoria ou combinacao, com vigencia.';
COMMENT ON TABLE public.commission_rule_sellers IS
  'Representantes incluidos em uma regra de comissao. Sem linhas = regra para todos.';
COMMENT ON COLUMN public.order_items.commission_value IS
  'Snapshot da comissao calculada no momento da geracao do pedido.';
