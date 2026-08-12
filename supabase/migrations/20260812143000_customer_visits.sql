CREATE TABLE IF NOT EXISTS public.customer_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_erp_code text NOT NULL REFERENCES public.customers(erp_code) ON DELETE CASCADE,
  seller_erp_code text NOT NULL REFERENCES public.erp_sellers(erp_code) ON DELETE CASCADE,
  visited_at timestamptz NOT NULL DEFAULT now(),
  visit_reason text NOT NULL DEFAULT 'rotina',
  shelf_status text NOT NULL DEFAULT 'abastecida',
  proof_status text NOT NULL DEFAULT 'photo_sent',
  proof_photo_path text NOT NULL,
  proof_photo_mime text NOT NULL DEFAULT '',
  proof_photo_size integer NOT NULL DEFAULT 0,
  notes text NOT NULL DEFAULT '',
  routine_interval_days integer NOT NULL DEFAULT 30,
  next_visit_date date NOT NULL DEFAULT (CURRENT_DATE + 30),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  review_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT customer_visits_shelf_status_chk CHECK (
    shelf_status IN ('abastecida', 'baixo_estoque', 'sem_exposicao', 'oportunidade')
  ),
  CONSTRAINT customer_visits_proof_status_chk CHECK (
    proof_status IN ('photo_sent', 'validated', 'rejected')
  ),
  CONSTRAINT customer_visits_photo_required_chk CHECK (length(trim(proof_photo_path)) > 0),
  CONSTRAINT customer_visits_interval_chk CHECK (routine_interval_days BETWEEN 7 AND 120),
  CONSTRAINT customer_visits_photo_size_chk CHECK (proof_photo_size >= 0)
);

CREATE INDEX IF NOT EXISTS customer_visits_customer_idx
  ON public.customer_visits (customer_erp_code, visited_at DESC);
CREATE INDEX IF NOT EXISTS customer_visits_seller_idx
  ON public.customer_visits (seller_erp_code, visited_at DESC);
CREATE INDEX IF NOT EXISTS customer_visits_next_visit_idx
  ON public.customer_visits (next_visit_date, seller_erp_code);
CREATE INDEX IF NOT EXISTS customer_visits_created_by_idx
  ON public.customer_visits (created_by, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.customer_visits TO authenticated;
GRANT ALL ON public.customer_visits TO service_role;

ALTER TABLE public.customer_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customer_visits_read_scope" ON public.customer_visits;
DROP POLICY IF EXISTS "customer_visits_insert_scope" ON public.customer_visits;
DROP POLICY IF EXISTS "customer_visits_update_scope" ON public.customer_visits;

CREATE POLICY "customer_visits_read_scope"
ON public.customer_visits
FOR SELECT
TO authenticated
USING (public.can_see_seller(auth.uid(), seller_erp_code));

CREATE POLICY "customer_visits_insert_scope"
ON public.customer_visits
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND proof_photo_path IS NOT NULL
  AND length(trim(proof_photo_path)) > 0
  AND public.can_see_seller(auth.uid(), seller_erp_code)
  AND EXISTS (
    SELECT 1
    FROM public.customer_seller_links csl
    WHERE csl.customer_erp_code = customer_visits.customer_erp_code
      AND csl.seller_erp_code = customer_visits.seller_erp_code
      AND csl.active = true
  )
);

CREATE POLICY "customer_visits_update_scope"
ON public.customer_visits
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()) OR created_by = auth.uid())
WITH CHECK (
  public.is_admin(auth.uid())
  OR (
    created_by = auth.uid()
    AND public.can_see_seller(auth.uid(), seller_erp_code)
    AND length(trim(proof_photo_path)) > 0
  )
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_customer_visits_updated_at'
      AND tgrelid = 'public.customer_visits'::regclass
  ) THEN
    CREATE TRIGGER set_customer_visits_updated_at
    BEFORE UPDATE ON public.customer_visits
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'visit-proofs',
  'visit-proofs',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "visit_proofs_insert_own_folder" ON storage.objects;
DROP POLICY IF EXISTS "visit_proofs_select_own_folder" ON storage.objects;

CREATE POLICY "visit_proofs_insert_own_folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'visit-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "visit_proofs_select_own_folder"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'visit-proofs'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
