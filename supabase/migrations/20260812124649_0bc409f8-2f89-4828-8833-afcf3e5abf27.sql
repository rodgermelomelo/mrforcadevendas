CREATE TABLE public.customer_visits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_erp_code text NOT NULL REFERENCES public.customers(erp_code),
  seller_erp_code text NOT NULL,
  visited_at timestamp with time zone NOT NULL DEFAULT now(),
  visit_reason text NOT NULL DEFAULT 'rotina',
  shelf_status text NOT NULL DEFAULT 'abastecida',
  proof_status text NOT NULL DEFAULT 'photo_sent',
  proof_photo_path text NOT NULL DEFAULT '',
  proof_photo_mime text NOT NULL DEFAULT '',
  proof_photo_size bigint NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  routine_interval_days integer NOT NULL DEFAULT 30,
  next_visit_date date NOT NULL DEFAULT (now()::date + 30),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX customer_visits_customer_idx ON public.customer_visits(customer_erp_code);
CREATE INDEX customer_visits_seller_idx ON public.customer_visits(seller_erp_code);
CREATE INDEX customer_visits_visited_at_idx ON public.customer_visits(visited_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_visits TO authenticated;
GRANT ALL ON public.customer_visits TO service_role;

ALTER TABLE public.customer_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visits visible to owners and managers"
  ON public.customer_visits FOR SELECT TO authenticated
  USING (public.can_see_seller(auth.uid(), seller_erp_code) OR public.is_admin(auth.uid()) OR public.is_approver(auth.uid()));

CREATE POLICY "Visits insert by owners and managers"
  ON public.customer_visits FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (public.can_see_seller(auth.uid(), seller_erp_code) OR public.is_admin(auth.uid()) OR public.is_approver(auth.uid())));

CREATE POLICY "Visits update by managers or author"
  ON public.customer_visits FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_admin(auth.uid()) OR public.is_approver(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_admin(auth.uid()) OR public.is_approver(auth.uid()));

CREATE POLICY "Visits delete by admins"
  ON public.customer_visits FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER customer_visits_set_updated_at
  BEFORE UPDATE ON public.customer_visits
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Visit proofs readable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'visit-proofs');

CREATE POLICY "Visit proofs uploadable by authenticated"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'visit-proofs');