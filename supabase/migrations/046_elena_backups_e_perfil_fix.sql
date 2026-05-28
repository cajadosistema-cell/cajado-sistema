-- ============================================================
-- SISTEMA CAJADO - MIGRATION 046
-- Elena: Tabela de backups de conversas + colunas de controle
-- de última execução de briefing/vencimentos no perfil
-- ============================================================

-- 1. Tabela para armazenar backups de conversas no Supabase
--    Permite que a Elena busque conversas antigas quando perguntada
CREATE TABLE IF NOT EXISTS public.elena_backups (
  id             UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id        UUID         REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  sessao_id      TEXT,
  conteudo       TEXT         NOT NULL,   -- texto formatado da conversa completa
  total_mensagens INT         DEFAULT 0,
  gerado_em      TIMESTAMPTZ  DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_elena_backups_user ON public.elena_backups(user_id, gerado_em DESC);
CREATE INDEX IF NOT EXISTS idx_elena_backups_sessao ON public.elena_backups(sessao_id);

-- RLS
ALTER TABLE public.elena_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve proprio backup Elena"
  ON public.elena_backups FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Adicionar colunas de controle ao elena_perfil
--    Substitui o localStorage para controle de "já exibiu hoje"
--    Funciona em múltiplos dispositivos e não some ao limpar cache
ALTER TABLE public.elena_perfil
  ADD COLUMN IF NOT EXISTS ultima_vez_briefing   DATE,
  ADD COLUMN IF NOT EXISTS ultima_vez_vencimentos DATE;

-- 3. Garantir que a tabela elena_perfil tenha a coluna user_id se existir
--    (algumas instâncias podem estar sem índice nessa coluna)
CREATE INDEX IF NOT EXISTS idx_elena_perfil_user ON public.elena_perfil(user_id);
