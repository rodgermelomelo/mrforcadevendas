ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;
GRANT SELECT ON public.brands TO anon;