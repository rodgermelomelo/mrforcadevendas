ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand text;

-- O RLS já está habilitado na products, mas precisamos garantir que o GRANT inclua a nova coluna (embora SELECT * cubra isso).
-- Re-aplicando GRANTs por segurança conforme as regras do Lovable Cloud.
GRANT SELECT ON public.products TO authenticated;
GRANT SELECT ON public.products TO anon;
GRANT ALL ON public.products TO service_role;
