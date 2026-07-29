-- ============================================================
-- SISTEMA CAJADO - MIGRATION 076
-- Adiciona coluna de observacoes / bloco de anotações (TEXT)
-- nas tabelas imoveis e veiculos.
-- ============================================================

ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS observacoes TEXT DEFAULT NULL;

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS observacoes TEXT DEFAULT NULL;

SELECT 'Migration 076 OK — observacoes adicionadas a imoveis e veiculos' AS status;
