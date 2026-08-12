CREATE TABLE public.segment_import_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id uuid REFERENCES public.erp_import_runs(id) ON DELETE SET NULL,
  customer_erp_code text NOT NULL,
  previous_segment_code text,
  new_segment_code text,
  status text NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.segment_import_audit TO authenticated;
GRANT ALL ON public.segment_import_audit TO service_role;

ALTER TABLE public.segment_import_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segment_import_audit_read_admins"
  ON public.segment_import_audit FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_approver(auth.uid()));

CREATE INDEX idx_segment_import_audit_run ON public.segment_import_audit (run_id, created_at DESC);
CREATE INDEX idx_segment_import_audit_status ON public.segment_import_audit (status);
CREATE INDEX idx_segment_import_audit_customer ON public.segment_import_audit (customer_erp_code);

CREATE OR REPLACE FUNCTION public.segment_import_audit_status_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('updated', 'unchanged', 'skipped', 'failed') THEN
    RAISE EXCEPTION 'status inválido: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER segment_import_audit_status_guard
  BEFORE INSERT OR UPDATE ON public.segment_import_audit
  FOR EACH ROW EXECUTE FUNCTION public.segment_import_audit_status_guard();