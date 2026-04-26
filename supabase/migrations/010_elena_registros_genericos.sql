-- ================================================================
-- Migration 010: Tabela genérica de registros da Elena (fallback)
-- Armazena qualquer tipo de lançamento que não se encaixe nas
-- tabelas especializadas (gastos, receitas, agenda, ideias etc.)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.elena_registros (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT        NOT NULL DEFAULT 'geral',   -- ex: nota, lembrete, contrato, emprestimo, etc.
  titulo      TEXT        NOT NULL,
  descricao   TEXT,
  valor       NUMERIC(12,2),
  data        DATE        NOT NULL DEFAULT CURRENT_DATE,
  metadados   JSONB,                                  -- JSON completo da ação para não perder nenhum dado
  origem      TEXT        NOT NULL DEFAULT 'elena',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.elena_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_proprio_registro"
  ON public.elena_registros
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índices
CREATE INDEX IF NOT EXISTS idx_elena_registros_user    ON public.elena_registros(user_id);
CREATE INDEX IF NOT EXISTS idx_elena_registros_tipo    ON public.elena_registros(tipo);
CREATE INDEX IF NOT EXISTS idx_elena_registros_data    ON public.elena_registros(data DESC);
