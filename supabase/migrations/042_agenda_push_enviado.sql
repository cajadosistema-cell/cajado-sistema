-- Migration 042: Adiciona campo push_enviado na agenda_eventos
-- Para rastrear se a notificação push já foi enviada (evita duplicidade)

ALTER TABLE agenda_eventos
  ADD COLUMN IF NOT EXISTS push_enviado timestamptz DEFAULT NULL;

COMMENT ON COLUMN agenda_eventos.push_enviado IS 'Timestamp de quando a notificação push foi enviada. NULL = ainda não enviada.';

CREATE INDEX IF NOT EXISTS idx_agenda_push_pendente
  ON agenda_eventos(data_inicio, push_enviado)
  WHERE tipo = 'lembrete' AND status = 'pendente' AND push_enviado IS NULL;
