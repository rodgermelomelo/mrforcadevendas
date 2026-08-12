CREATE TABLE public.carriers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  tax_id text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX carriers_name_key ON public.carriers (lower(name));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carriers TO authenticated;
GRANT ALL ON public.carriers TO service_role;

ALTER TABLE public.carriers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carriers_read_authenticated" ON public.carriers
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "carriers_admin_write" ON public.carriers
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER carriers_set_updated_at
  BEFORE UPDATE ON public.carriers
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.carrier_cities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  carrier_id uuid NOT NULL REFERENCES public.carriers(id) ON DELETE CASCADE,
  city text NOT NULL,
  uf text NOT NULL,
  lead_time_days integer NOT NULL DEFAULT 0,
  freight_type text NOT NULL DEFAULT 'CIF',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX carrier_cities_unique ON public.carrier_cities (carrier_id, lower(city), upper(uf));
CREATE INDEX carrier_cities_carrier_idx ON public.carrier_cities (carrier_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carrier_cities TO authenticated;
GRANT ALL ON public.carrier_cities TO service_role;

ALTER TABLE public.carrier_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "carrier_cities_read_authenticated" ON public.carrier_cities
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "carrier_cities_admin_write" ON public.carrier_cities
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER carrier_cities_set_updated_at
  BEFORE UPDATE ON public.carrier_cities
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

INSERT INTO public.carriers (name, tax_id, phone, email, notes) VALUES
  ('Foxy Entregas', '12.345.678/0001-90', '(31) 3333-1000', 'operacao@foxyentregas.com.br', 'Parceira preferencial para capital e regiao metropolitana.'),
  ('Rapido Minas Log', '23.456.789/0001-11', '(31) 3222-4500', 'atendimento@rapidominaslog.com.br', 'Cobertura no interior de Minas Gerais.'),
  ('TransSudeste Cargas', '34.567.890/0001-22', '(11) 4002-8922', 'cargas@transsudeste.com.br', 'Rotas interestaduais SP / RJ / ES.');

INSERT INTO public.carrier_cities (carrier_id, city, uf, lead_time_days, freight_type)
SELECT c.id, v.city, v.uf, v.lead_time, v.freight
FROM public.carriers c
JOIN (VALUES
  ('Foxy Entregas', 'Belo Horizonte', 'MG', 1, 'CIF'),
  ('Foxy Entregas', 'Contagem', 'MG', 1, 'CIF'),
  ('Foxy Entregas', 'Betim', 'MG', 2, 'CIF'),
  ('Foxy Entregas', 'Nova Lima', 'MG', 2, 'CIF'),
  ('Foxy Entregas', 'Sete Lagoas', 'MG', 2, 'FOB'),
  ('Rapido Minas Log', 'Uberlandia', 'MG', 3, 'CIF'),
  ('Rapido Minas Log', 'Juiz de Fora', 'MG', 3, 'CIF'),
  ('Rapido Minas Log', 'Montes Claros', 'MG', 4, 'FOB'),
  ('Rapido Minas Log', 'Governador Valadares', 'MG', 4, 'FOB'),
  ('TransSudeste Cargas', 'Sao Paulo', 'SP', 3, 'CIF'),
  ('TransSudeste Cargas', 'Campinas', 'SP', 4, 'CIF'),
  ('TransSudeste Cargas', 'Rio de Janeiro', 'RJ', 4, 'CIF'),
  ('TransSudeste Cargas', 'Vitoria', 'ES', 5, 'FOB')
) AS v(carrier, city, uf, lead_time, freight) ON v.carrier = c.name;