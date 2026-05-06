-- SISTEMA CAJADO - MIGRATION 016
-- Adiciona colunas de parcelamento na tabela projetos_patrimonio

ALTER TABLE public.projetos_patrimonio
  ADD COLUMN IF NOT EXISTS parcelas_total INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcelas_pagas INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.projetos_patrimonio.parcelas_total IS 'Número total de parcelas do financiamento (ex: 60 para 5 anos)';
COMMENT ON COLUMN public.projetos_patrimonio.parcelas_pagas IS 'Quantas parcelas já foram pagas até hoje';
