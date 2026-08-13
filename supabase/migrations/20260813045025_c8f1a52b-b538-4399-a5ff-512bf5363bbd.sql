CREATE TABLE public.brand_taxonomy_overrides (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    category_name text NOT NULL,
    target_brand_name text NOT NULL,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(category_name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_taxonomy_overrides TO authenticated;
GRANT ALL ON public.brand_taxonomy_overrides TO service_role;

ALTER TABLE public.brand_taxonomy_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage brand taxonomy overrides"
ON public.brand_taxonomy_overrides
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Users can view brand taxonomy overrides"
ON public.brand_taxonomy_overrides
FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.brand_taxonomy_overrides (category_name, target_brand_name) VALUES
('AMACIANTE', 'ACEMAR'),
('AMOLECEDOR', 'ACEMAR'),
('GOTA', 'ACEMAR'),
('MANTEIGA', 'ACEMAR'),
('OLEO', 'ACEMAR'),
('SECANTE', 'ACEMAR'),
('SOLUCAO', 'ACEMAR'),
('TOALHA', 'ACEMAR'),
('BABADO', 'DAILUS'),
('BASE', 'DAILUS'),
('BATOM', 'DAILUS'),
('BLUSH', 'DAILUS'),
('BODY', 'DAILUS'),
('CANETA', 'DAILUS'),
('CHOCO', 'DAILUS'),
('CONTORNO', 'DAILUS');