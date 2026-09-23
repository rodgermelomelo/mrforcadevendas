-- =============================================================================
-- Fontes de desconto/acordo do motor de autorizacao de pedidos.
-- Substitui as abas da planilha (ACORDO COMERCIAL, CAMPANHAS, SELL OUT, SELOS,
-- CONTA CORRENTE, NFD). Leitura: qualquer autenticado (o motor precisa ler).
-- Escrita: administrador ou gerente_comercial (a "Josi"/gestora).
-- =============================================================================

-- helper de permissao de escrita (admin ou gestora) --------------------------
CREATE OR REPLACE FUNCTION public.pode_gerir_descontos(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT public.is_admin(_user_id)
      OR public.has_role(_user_id, 'gerente_comercial');
$$;
GRANT EXECUTE ON FUNCTION public.pode_gerir_descontos(uuid) TO authenticated;

-- 1) ACORDOS COMERCIAIS -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.acordos_comerciais (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_codigo text NOT NULL,
  cliente_nome   text NOT NULL DEFAULT '',
  percentual     numeric(5,2),
  forma          text NOT NULL DEFAULT '',   -- texto livre do acordo (ex.: "5%" ou "5% + 3%")
  vigencia_de    date,
  vigencia_ate   date,
  status         text NOT NULL DEFAULT 'ATIVO',
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS acordos_comerciais_cliente_idx ON public.acordos_comerciais (cliente_codigo);

-- 2) CAMPANHAS (mae) + REGRAS -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campanhas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL,               -- ex.: "Setembro 2026"
  periodo_de date,
  periodo_ate date,
  status     text NOT NULL DEFAULT 'ATIVA',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.campanha_regras (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id   uuid NOT NULL REFERENCES public.campanhas(id) ON DELETE CASCADE,
  nome          text NOT NULL,            -- ex.: "MAKE 10%"
  percentual    numeric(5,2),
  categoria     text NOT NULL DEFAULT '',
  palavras_chave text[] NOT NULL DEFAULT '{}',  -- gatilhos na observacao (normalizados)
  de            date,
  ate           date,
  status        text NOT NULL DEFAULT 'ATIVA',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS campanha_regras_campanha_idx ON public.campanha_regras (campanha_id);

-- 3) NFD (creditos de devolucao) ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.nfd_creditos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_codigo text NOT NULL,
  cliente_nome   text NOT NULL DEFAULT '',
  numero         text NOT NULL DEFAULT '',
  valor          numeric(12,2),
  status         text NOT NULL DEFAULT 'PENDENTE',   -- PENDENTE / DESCONTADO / ...
  origem         text NOT NULL DEFAULT '',
  data           date,
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS nfd_creditos_cliente_idx ON public.nfd_creditos (cliente_codigo);
CREATE INDEX IF NOT EXISTS nfd_creditos_numero_idx  ON public.nfd_creditos (numero);

-- 4) SELL OUT -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sellout_creditos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_codigo text NOT NULL,
  cliente_nome   text NOT NULL DEFAULT '',
  valor          numeric(12,2),
  status         text NOT NULL DEFAULT 'PENDENTE',
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sellout_creditos_cliente_idx ON public.sellout_creditos (cliente_codigo);

-- 5) SELOS --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.selos_creditos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_codigo text NOT NULL,
  cliente_nome   text NOT NULL DEFAULT '',
  valor          numeric(12,2),
  status         text NOT NULL DEFAULT 'PENDENTE',
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS selos_creditos_cliente_idx ON public.selos_creditos (cliente_codigo);

-- 6) CONTA CORRENTE (saldo por cliente) --------------------------------------
CREATE TABLE IF NOT EXISTS public.conta_corrente_saldos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_codigo text NOT NULL UNIQUE,
  cliente_nome   text NOT NULL DEFAULT '',
  saldo          numeric(12,2) NOT NULL DEFAULT 0,
  created_by     uuid REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---- GRANTS + RLS (mesmo padrao para todas) --------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'acordos_comerciais','campanhas','campanha_regras','nfd_creditos',
    'sellout_creditos','selos_creditos','conta_corrente_saldos'
  ] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated;', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role;', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_read" ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_write" ON public.%I;', t, t);
    -- leitura: qualquer autenticado (o motor precisa consultar as fontes)
    EXECUTE format($p$CREATE POLICY "%s_read" ON public.%I FOR SELECT TO authenticated USING (true);$p$, t, t);
    -- escrita: admin ou gerente_comercial (a gestora)
    EXECUTE format($p$CREATE POLICY "%s_write" ON public.%I FOR ALL TO authenticated
      USING (public.pode_gerir_descontos(auth.uid()))
      WITH CHECK (public.pode_gerir_descontos(auth.uid()));$p$, t, t);
    -- trigger updated_at
    EXECUTE format($tg$
      DO $inner$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_%s_updated_at'
                       AND tgrelid = 'public.%I'::regclass) THEN
          CREATE TRIGGER set_%s_updated_at BEFORE UPDATE ON public.%I
          FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
        END IF;
      END $inner$; $tg$, t, t, t, t);
  END LOOP;
END $$;
