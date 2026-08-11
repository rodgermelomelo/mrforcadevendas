ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;