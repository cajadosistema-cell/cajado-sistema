-- ============================================================
-- SISTEMA CAJADO - MIGRATION 052
-- Cron job via pg_cron + pg_net para envio automático de
-- push notifications a cada minuto, independente do app estar aberto.
-- Funciona no Railway, Vercel, qualquer host.
-- ============================================================

-- 1. Habilita extensão pg_net (chamadas HTTP dentro do banco)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Agenda cron job: chama a Edge Function send-push a cada minuto
-- A Edge Function verifica eventos em 2-5 min e envia push para todos os usuários
SELECT cron.schedule(
  'send-push-alerts',           -- nome do job (único)
  '* * * * *',                  -- a cada 1 minuto
  $$
  SELECT net.http_post(
    url     := 'https://wagkyyqstsgetktefewd.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5NzIxNTAsImV4cCI6MjA5MTU0ODE1MH0.8DOD4XOrOZD21bl-J6WN8a1nk3cTJJm8Ope_s9V7Hnk'
    ),
    body    := '{}'::jsonb
  );
  $$
);

-- Para verificar se o cron foi criado:
-- SELECT * FROM cron.job;

-- Para remover o cron (se necessário):
-- SELECT cron.unschedule('send-push-alerts');
