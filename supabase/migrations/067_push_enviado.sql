-- ════════════════════════════════════════════════════════════════
-- 067_push_enviado.sql (CORRIGIDO)
--
-- A Edge Function send-push marca `push_enviado = timestamp_atual` depois de
-- entregar a notificação.
--
-- A coluna push_enviado já existe como `timestamptz` desde a migration 042.
-- Este script reforça o índice para evitar table scans no cron.
-- ════════════════════════════════════════════════════════════════

-- A coluna já foi criada na 042 como timestamptz, então não tentaremos adicioná-la como boolean.
ALTER TABLE agenda_eventos
  ADD COLUMN IF NOT EXISTS push_enviado timestamptz DEFAULT NULL;

-- Índice otimizado para a varredura do cron
CREATE INDEX IF NOT EXISTS idx_agenda_push_pendente_v2
  ON agenda_eventos (data_inicio)
  WHERE push_enviado IS NULL AND status = 'pendente';

-- Conferência
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'agenda_eventos' AND column_name = 'push_enviado';
