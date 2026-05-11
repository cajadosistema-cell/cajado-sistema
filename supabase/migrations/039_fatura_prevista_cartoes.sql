-- ============================================================
-- Migration 039: Adiciona valor_previsto em faturas_cartoes
--               Separa a previa estimada da fatura real/fechada.
--               valor_previsto = cliente digita antes de fechar
--               valor_fechado  = valor real apos fechamento
-- ============================================================

ALTER TABLE public.faturas_cartoes
  ADD COLUMN IF NOT EXISTS valor_previsto NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notas          TEXT          DEFAULT NULL;

-- Comentários descritivos
COMMENT ON COLUMN public.faturas_cartoes.valor_previsto IS 'Previa estimada pelo usuario antes do fechamento da fatura';
COMMENT ON COLUMN public.faturas_cartoes.valor_fechado  IS 'Valor real da fatura apos fechamento pelo banco';
COMMENT ON COLUMN public.faturas_cartoes.notas          IS 'Observacoes livres sobre a fatura do mes';

-- Verifica
SELECT
  conta_id,
  mes_referencia,
  valor_previsto,
  valor_fechado,
  notas
FROM public.faturas_cartoes
ORDER BY created_at DESC
LIMIT 10;
