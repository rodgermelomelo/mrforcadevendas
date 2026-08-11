CREATE TABLE public.brands (
    name text PRIMARY KEY,
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brands TO authenticated;
GRANT ALL ON public.brands TO service_role;

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated to read brands" ON public.brands FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow admins to manage brands" ON public.brands FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'administrador'));

-- Insert existing brands from products table
INSERT INTO public.brands (name)
SELECT DISTINCT brand FROM public.products WHERE brand IS NOT NULL
ON CONFLICT (name) DO NOTHING;