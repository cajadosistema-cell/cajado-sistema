-- ============================================================
-- SISTEMA CAJADO - MIGRATION 071
-- Torna valor_fechado e valor_previsto nullable em faturas_cartoes.
-- Necessário para permitir salvar pagamentos antes de definir
-- o valor da fatura.
-- ============================================================

ALTER TABLE public.faturas_cartoes
  ALTER COLUMN valor_fechado DROP NOT NULL;
