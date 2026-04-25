-- ============================================================
-- SISTEMA CAJADO - MIGRATION 005
-- Histórico de conversas com a Elena (Assistente IA)
-- Permite resumo, memória e contexto persistente
-- ============================================================

CREATE TABLE IF NOT EXISTS public.elena_conversas (
  id          UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID         REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  role        TEXT         NOT NULL CHECK (role IN ('user', 'ai')),
  texto       TEXT         NOT NULL,
  acoes       JSONB,                         -- ações estruturadas registradas nesta msg
  sessao_id   TEXT,                          -- agrupa mensagens por sessão (dia/contexto)
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_elena_user_data    ON public.elena_conversas(user_id, created_at DESC);
CREATE INDEX idx_elena_sessao       ON public.elena_conversas(sessao_id, created_at);

-- RLS: cada usuário vê apenas seu próprio histórico
ALTER TABLE public.elena_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve proprio historico Elena"
  ON public.elena_conversas FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
