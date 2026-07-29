-- ============================================================
-- SISTEMA CAJADO - MIGRATION 075
-- Adiciona suporte a periodicidade (mensal, bimestral, trimestral,
-- semestral, anual) nas parcelas de imóveis, veículos, financiamentos
-- e compromissos fixos.
-- ============================================================

-- 1) Tabela imoveis
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS periodicidade TEXT DEFAULT 'mensal'
    CHECK (periodicidade IN ('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'semestral', 'anual'));

-- 2) Tabela veiculos
ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS periodicidade TEXT DEFAULT 'mensal'
    CHECK (periodicidade IN ('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'semestral', 'anual'));

-- 3) Tabela financiamentos (se existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financiamentos') THEN
    ALTER TABLE public.financiamentos
      ADD COLUMN IF NOT EXISTS periodicidade TEXT DEFAULT 'mensal'
        CHECK (periodicidade IN ('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'semestral', 'anual'));
  END IF;
END $$;

-- 4) Tabela compromissos_fixos
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compromissos_fixos') THEN
    ALTER TABLE public.compromissos_fixos
      ADD COLUMN IF NOT EXISTS periodicidade TEXT DEFAULT 'mensal'
        CHECK (periodicidade IN ('mensal', 'bimestral', 'trimestral', 'quadrimestral', 'semestral', 'anual'));
  END IF;
END $$;

SELECT 'Migration 075 OK — periodicidade adicionada' AS status;
