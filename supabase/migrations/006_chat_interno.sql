-- ============================================================
-- Migration 006: Chat Interno da Equipe
-- ============================================================

-- Tabela de mensagens do chat interno
CREATE TABLE IF NOT EXISTS public.chat_interno (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  remetente_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL = mensagem para o canal geral
  texto            text,
  audio_base64     text, -- áudio em base64 (data URI)
  created_at       timestamptz DEFAULT now() NOT NULL,

  -- Pelo menos texto ou áudio deve estar preenchido
  CONSTRAINT chat_tem_conteudo CHECK (texto IS NOT NULL OR audio_base64 IS NOT NULL)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_chat_remetente   ON public.chat_interno(remetente_id);
CREATE INDEX IF NOT EXISTS idx_chat_destinatario ON public.chat_interno(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at  ON public.chat_interno(created_at DESC);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE public.chat_interno ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ler:
--   - Mensagens do canal geral (destinatario_id IS NULL)
--   - Mensagens que enviaram
--   - Mensagens que receberam (mensagens diretas para eles)
CREATE POLICY "chat_select" ON public.chat_interno
  FOR SELECT
  TO authenticated
  USING (
    destinatario_id IS NULL
    OR remetente_id   = auth.uid()
    OR destinatario_id = auth.uid()
  );

-- Usuários autenticados só inserem mensagens em que são o remetente
CREATE POLICY "chat_insert" ON public.chat_interno
  FOR INSERT
  TO authenticated
  WITH CHECK (remetente_id = auth.uid());

-- Ninguém pode editar mensagens antigas
-- (sem policy UPDATE/DELETE — mensagens são imutáveis)

-- ── Realtime ──────────────────────────────────────────────────
-- Habilitar Realtime para a tabela (replication)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_interno;
