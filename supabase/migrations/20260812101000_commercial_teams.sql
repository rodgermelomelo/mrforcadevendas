CREATE TABLE IF NOT EXISTS public.commercial_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  leader_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS public.commercial_team_sellers (
  team_id uuid NOT NULL REFERENCES public.commercial_teams(id) ON DELETE CASCADE,
  seller_erp_code text NOT NULL REFERENCES public.erp_sellers(erp_code) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id, seller_erp_code)
);

CREATE INDEX IF NOT EXISTS commercial_teams_leader_idx
  ON public.commercial_teams (leader_user_id);
CREATE INDEX IF NOT EXISTS commercial_team_sellers_seller_idx
  ON public.commercial_team_sellers (seller_erp_code);

GRANT SELECT ON public.commercial_teams, public.commercial_team_sellers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.commercial_teams, public.commercial_team_sellers TO authenticated;
GRANT ALL ON public.commercial_teams, public.commercial_team_sellers TO service_role;

ALTER TABLE public.commercial_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_team_sellers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commercial_teams_read_scope" ON public.commercial_teams;
DROP POLICY IF EXISTS "commercial_teams_admin_write" ON public.commercial_teams;
DROP POLICY IF EXISTS "commercial_team_sellers_read_scope" ON public.commercial_team_sellers;
DROP POLICY IF EXISTS "commercial_team_sellers_admin_write" ON public.commercial_team_sellers;

CREATE POLICY "commercial_teams_read_scope"
ON public.commercial_teams
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()) OR leader_user_id = auth.uid());

CREATE POLICY "commercial_teams_admin_write"
ON public.commercial_teams
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "commercial_team_sellers_read_scope"
ON public.commercial_team_sellers
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.commercial_teams t
    WHERE t.id = team_id
      AND (public.is_admin(auth.uid()) OR t.leader_user_id = auth.uid())
  )
);

CREATE POLICY "commercial_team_sellers_admin_write"
ON public.commercial_team_sellers
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.visible_seller_codes(_user_id uuid)
RETURNS SETOF text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select seller_erp_code from public.user_erp_seller_links
   where user_id = _user_id
     and (auth.uid() is null or _user_id = auth.uid())
  union
  select seller_erp_code from public.team_visibility
   where user_id = _user_id
     and (auth.uid() is null or _user_id = auth.uid())
  union
  select cts.seller_erp_code
    from public.commercial_team_sellers cts
    join public.commercial_teams ct on ct.id = cts.team_id
   where ct.leader_user_id = _user_id
     and ct.active = true
     and (auth.uid() is null or _user_id = auth.uid())
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_commercial_teams_updated_at'
      AND tgrelid = 'public.commercial_teams'::regclass
  ) THEN
    CREATE TRIGGER set_commercial_teams_updated_at
    BEFORE UPDATE ON public.commercial_teams
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;
