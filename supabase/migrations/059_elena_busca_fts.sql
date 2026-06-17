-- ============================================================
-- SISTEMA CAJADO - MIGRATION 059
-- Full-Text Search para elena_conversas
-- Habilita busca inteligente com stemming em português
-- ============================================================

-- 1. Coluna de busca FTS (tsvector)
ALTER TABLE public.elena_conversas
  ADD COLUMN IF NOT EXISTS busca_fts tsvector;

-- 2. Função trigger: popula busca_fts automaticamente a cada INSERT/UPDATE
CREATE OR REPLACE FUNCTION public.elena_conversas_fts_trigger()
RETURNS trigger AS $$
BEGIN
  NEW.busca_fts := to_tsvector('portuguese', COALESCE(NEW.texto, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger no INSERT e UPDATE
DROP TRIGGER IF EXISTS trg_elena_conversas_fts ON public.elena_conversas;
CREATE TRIGGER trg_elena_conversas_fts
  BEFORE INSERT OR UPDATE OF texto
  ON public.elena_conversas
  FOR EACH ROW
  EXECUTE FUNCTION public.elena_conversas_fts_trigger();

-- 4. Índice GIN para busca performática
CREATE INDEX IF NOT EXISTS idx_elena_conversas_fts
  ON public.elena_conversas USING GIN(busca_fts);

-- 5. Backfill: preenche dados existentes
UPDATE public.elena_conversas
SET busca_fts = to_tsvector('portuguese', COALESCE(texto, ''))
WHERE busca_fts IS NULL;
