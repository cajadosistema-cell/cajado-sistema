-- ================================================================
-- MIGRATION 032 - Expande o check constraint de status nos imoveis
-- para incluir todos os status usados no sistema
-- ================================================================

-- Remove constraint antiga (se existir)
ALTER TABLE public.imoveis 
  DROP CONSTRAINT IF EXISTS imoveis_status_check;

-- Recria com todos os valores válidos do sistema
ALTER TABLE public.imoveis
  ADD CONSTRAINT imoveis_status_check 
  CHECK (status IN ('disponivel', 'alugado', 'vendido', 'em_reforma', 'em_obra', 'quitado', 'financiado'));

-- Garante que o default é 'disponivel'
ALTER TABLE public.imoveis 
  ALTER COLUMN status SET DEFAULT 'disponivel';
