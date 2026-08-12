-- Sugestoes derivadas do ERP. A curadoria visual continua em products.brand
-- e products.category, que nao devem ser sobrescritas pela importacao.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS erp_brand_suggestion text,
  ADD COLUMN IF NOT EXISTS erp_category_suggestion text,
  ADD COLUMN IF NOT EXISTS erp_taxonomy_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS products_erp_brand_suggestion_idx
  ON public.products (erp_brand_suggestion);

CREATE INDEX IF NOT EXISTS products_erp_category_suggestion_idx
  ON public.products (erp_category_suggestion);

COMMENT ON COLUMN public.products.brand IS
  'Marca curada manualmente no catalogo. A importacao ERP nao sobrescreve este campo.';

COMMENT ON COLUMN public.products.category IS
  'Categoria curada manualmente no catalogo. A importacao ERP nao sobrescreve este campo.';

COMMENT ON COLUMN public.products.erp_brand_suggestion IS
  'Sugestao de marca calculada a partir da descricao/grupo do ERP.';

COMMENT ON COLUMN public.products.erp_category_suggestion IS
  'Sugestao de categoria calculada a partir da descricao/grupo do ERP.';
