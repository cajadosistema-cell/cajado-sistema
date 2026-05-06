-- ============================================================
-- Migration 017: Adiciona coluna 'parcelas' em gastos_pessoais
-- Para rastrear compras parceladas no cartão de crédito
-- ============================================================

ALTER TABLE public.gastos_pessoais
  ADD COLUMN IF NOT EXISTS parcelas INTEGER DEFAULT NULL
    CHECK (parcelas IS NULL OR (parcelas >= 1 AND parcelas <= 96));

-- Índice para filtrar gastos parcelados facilmente
CREATE INDEX IF NOT EXISTS idx_gastos_pessoais_parcelas
  ON public.gastos_pessoais(parcelas)
  WHERE parcelas IS NOT NULL;

-- Comentário de documentação
COMMENT ON COLUMN public.gastos_pessoais.parcelas IS
  'Número total de parcelas (cartão de crédito). NULL = à vista.';
