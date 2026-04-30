-- ================================================================
-- Migration 012: Tabela de Ideias da Elena
-- Armazena ideias capturadas via IA ou formulário manual
-- ================================================================

CREATE TABLE IF NOT EXISTS public.elena_ideias (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  titulo      TEXT        NOT NULL,
  descricao   TEXT,
  categoria   TEXT        NOT NULL DEFAULT 'geral'
                          CHECK (categoria IN ('negocio','produto','pessoal','financeiro','saude','criativo','geral')),
  status      TEXT        NOT NULL DEFAULT 'rascunho'
                          CHECK (status IN ('rascunho','desenvolvendo','validando','concluida','arquivada')),
  progresso   INTEGER     NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: cada usuário vê apenas suas próprias ideias
ALTER TABLE public.elena_ideias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_propria_ideia"
  ON public.elena_ideias
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_elena_ideias_user     ON public.elena_ideias(user_id);
CREATE INDEX IF NOT EXISTS idx_elena_ideias_status   ON public.elena_ideias(status);
CREATE INDEX IF NOT EXISTS idx_elena_ideias_created  ON public.elena_ideias(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER set_elena_ideias_updated_at
  BEFORE UPDATE ON public.elena_ideias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
