-- ================================================================
-- MIGRATION 026 - Adiciona taxa_juros_anual em imoveis e veiculos
-- ================================================================

ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS taxa_juros_anual DECIMAL(8,4);

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS taxa_juros_anual DECIMAL(8,4);
