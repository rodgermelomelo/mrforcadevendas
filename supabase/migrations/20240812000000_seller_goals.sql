-- Tabela de metas mensais por representante
CREATE TABLE public.seller_goals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    seller_erp_code text REFERENCES public.erp_sellers(erp_code) ON DELETE CASCADE NOT NULL,
    month date NOT NULL, -- Primeiro dia do mês de referência (ex: 2026-08-01)
    target_value numeric(15, 2) NOT NULL DEFAULT 0,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE (seller_erp_code, month)
);

-- Permissões
GRANT SELECT ON public.seller_goals TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seller_goals TO authenticated;
GRANT ALL ON public.seller_goals TO service_role;

-- RLS
ALTER TABLE public.seller_goals ENABLE ROW LEVEL SECURITY;

-- Política: Todos autenticados podem ver metas (para mostrar no dashboard/perfil)
CREATE POLICY "Autenticados podem ver metas"
ON public.seller_goals
FOR SELECT
TO authenticated
USING (true);

-- Política: Apenas admins podem gerenciar metas
CREATE POLICY "Admins podem gerenciar metas"
ON public.seller_goals
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'administrador'));

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at
BEFORE UPDATE ON public.seller_goals
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
