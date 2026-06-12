-- ================================================================
-- SISTEMA CAJADO - MIGRATION 058
-- Adiciona colunas modulo e impacto à tabela ocorrencias
-- (usadas pela Elena nos handlers ocorrencia e relatorio_colaboradores)
-- ================================================================

ALTER TABLE public.ocorrencias
  ADD COLUMN IF NOT EXISTS modulo  TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS impacto TEXT DEFAULT 'medio'
    CHECK (impacto IN ('baixo','medio','alto','critico'));

-- Índice para relatórios por impacto
CREATE INDEX IF NOT EXISTS idx_ocorrencias_impacto ON public.ocorrencias(impacto);
