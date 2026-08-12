CREATE TABLE public.commercial_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  leader_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_teams TO authenticated;
GRANT ALL ON public.commercial_teams TO service_role;

ALTER TABLE public.commercial_teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approvers can read teams" ON public.commercial_teams
  FOR SELECT TO authenticated USING (public.is_approver(auth.uid()));
CREATE POLICY "Admins manage teams" ON public.commercial_teams
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER commercial_teams_updated_at BEFORE UPDATE ON public.commercial_teams
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.commercial_team_sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.commercial_teams(id) ON DELETE CASCADE,
  seller_erp_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id, seller_erp_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_team_sellers TO authenticated;
GRANT ALL ON public.commercial_team_sellers TO service_role;

ALTER TABLE public.commercial_team_sellers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approvers can read team sellers" ON public.commercial_team_sellers
  FOR SELECT TO authenticated USING (public.is_approver(auth.uid()));
CREATE POLICY "Admins manage team sellers" ON public.commercial_team_sellers
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE INDEX idx_commercial_team_sellers_team ON public.commercial_team_sellers(team_id);