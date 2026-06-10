-- ============================================================
-- SISTEMA CAJADO - MIGRATION 055
-- Adiciona coluna whatsapp_alerta_enviado na agenda_eventos
-- para controle de alertas já enviados via WhatsApp,
-- evitando duplicidade no cron de 5 minutos.
-- Também adiciona coluna whatsapp na tabela perfis (se não existir).
-- ============================================================

-- 1. Adiciona controle de alerta enviado via WhatsApp nos eventos
ALTER TABLE agenda_eventos
  ADD COLUMN IF NOT EXISTS whatsapp_alerta_enviado TIMESTAMPTZ DEFAULT NULL;

-- Índice para o cron buscar rapidamente eventos pendentes de alerta
CREATE INDEX IF NOT EXISTS idx_agenda_eventos_whatsapp_alerta
  ON agenda_eventos (data_inicio, status, whatsapp_alerta_enviado)
  WHERE whatsapp_alerta_enviado IS NULL;

-- 2. Adiciona campo whatsapp no perfis (número do usuário para receber alertas)
ALTER TABLE perfis
  ADD COLUMN IF NOT EXISTS whatsapp TEXT DEFAULT NULL;

COMMENT ON COLUMN agenda_eventos.whatsapp_alerta_enviado IS
  'Timestamp do envio do alerta via WhatsApp. NULL = ainda não enviado.';

COMMENT ON COLUMN perfis.whatsapp IS
  'Número WhatsApp do usuário para receber alertas (formato: 5571999999999).';
