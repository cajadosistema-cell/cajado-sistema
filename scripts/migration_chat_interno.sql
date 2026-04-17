-- Migration: Chat Interno
-- Tabela para guardar mensagens do chat interno com suporte a áudio em base64

CREATE TABLE IF NOT EXISTS chat_interno (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  remetente_id    UUID NOT NULL, -- auth.uid() do funcionário enviando
  destinatario_id UUID NULL,     -- se nulo, é mensagem para o Grupo/Geral
  texto           TEXT,
  audio_base64    TEXT,          -- Suporte a voz (áudio base64)
  lido            BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Realtime para esta tabela (se não estiver habilitado)
-- Nota: no Supabase, é preciso ir em Database > Replication para garantir que a tabela
-- chat_interno emite eventos INSERT. O código cliente tbm vai usar subscriptions.

ALTER TABLE chat_interno ENABLE ROW LEVEL SECURITY;

-- Para simplificar (Chat Interno Corporativo), visibilidade total para todos autenticados
DROP POLICY IF EXISTS "chat_interno_all" ON chat_interno;
CREATE POLICY "chat_interno_all" 
  ON chat_interno FOR ALL 
  USING (auth.role() = 'authenticated') 
  WITH CHECK (auth.role() = 'authenticated');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_chat_interno_remetente ON chat_interno(remetente_id);
CREATE INDEX IF NOT EXISTS idx_chat_interno_created ON chat_interno(created_at);
