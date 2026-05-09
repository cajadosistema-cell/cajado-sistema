-- Migration 029: Campos espirituais no diário
ALTER TABLE public.diario_entradas
  ADD COLUMN IF NOT EXISTS gratidao TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS intencao TEXT DEFAULT NULL;

-- Adiciona tipo espiritual ao check constraint
ALTER TABLE public.diario_entradas
  DROP CONSTRAINT IF EXISTS diario_entradas_tipo_check;

ALTER TABLE public.diario_entradas
  ADD CONSTRAINT diario_entradas_tipo_check
  CHECK (tipo IN ('diario','decisao','snapshot','marco','espiritual'));
