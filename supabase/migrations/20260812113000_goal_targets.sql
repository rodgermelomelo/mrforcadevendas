-- Metas comerciais genericas por mes.
-- Representantes continuam usando seller_goals para manter compatibilidade
-- com dashboard, perfil e equipe. As demais dimensoes usam goal_targets.

CREATE TABLE IF NOT EXISTS public.goal_targets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  scope text NOT NULL CHECK (scope IN ('global', 'team', 'brand', 'category', 'product')),
  scope_ref text NOT NULL,
  target_value numeric(15,2) NOT NULL DEFAULT 0 CHECK (target_value >= 0),
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month, scope, scope_ref)
);

CREATE INDEX IF NOT EXISTS goal_targets_month_scope_idx
  ON public.goal_targets (month, scope, active);
CREATE INDEX IF NOT EXISTS goal_targets_scope_ref_idx
  ON public.goal_targets (scope, scope_ref);

GRANT SELECT ON public.goal_targets TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.goal_targets TO authenticated;
GRANT ALL ON public.goal_targets TO service_role;

ALTER TABLE public.goal_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "goal_targets_read" ON public.goal_targets;
DROP POLICY IF EXISTS "goal_targets_manage" ON public.goal_targets;

CREATE POLICY "goal_targets_read"
ON public.goal_targets
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "goal_targets_manage"
ON public.goal_targets
FOR ALL
TO authenticated
USING (public.is_approver(auth.uid()))
WITH CHECK (public.is_approver(auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_goal_targets_updated_at'
      AND tgrelid = 'public.goal_targets'::regclass
  ) THEN
    CREATE TRIGGER set_goal_targets_updated_at
    BEFORE UPDATE ON public.goal_targets
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Garante que a regra usada pelo codigo atual (gerentes/supervisores tambem
-- gerenciam metas) esteja refletida na RLS de seller_goals.
DROP POLICY IF EXISTS "Admins podem gerenciar metas" ON public.seller_goals;
DROP POLICY IF EXISTS "Aprovadores podem gerenciar metas" ON public.seller_goals;

CREATE POLICY "Aprovadores podem gerenciar metas"
ON public.seller_goals
FOR ALL
TO authenticated
USING (public.is_approver(auth.uid()))
WITH CHECK (public.is_approver(auth.uid()));

COMMENT ON TABLE public.goal_targets IS
  'Metas mensais por dimensao comercial: geral, equipe, marca, categoria ou produto.';
