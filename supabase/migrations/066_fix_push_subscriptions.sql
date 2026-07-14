-- ════════════════════════════════════════════════════════════════
-- 066_fix_push_subscriptions.sql
--
-- BUG: /api/push/subscribe grava DUAS colunas que não existem:
--
--   await supabaseAdmin.from('push_subscriptions').upsert({
--     user_id, endpoint, p256dh, auth,
--     user_agent: req.headers.get('user-agent'),   ❌ coluna não existe
--     updated_at: new Date().toISOString(),         ❌ coluna não existe
--   }, { onConflict: 'user_id,endpoint' })          ⚠️ exige constraint UNIQUE
--
--   if (error) throw error   → HTTP 500, SEMPRE
--
-- RESULTADO: nenhum dispositivo conseguiu se inscrever. A tabela
-- push_subscriptions ficou VAZIA — e o send-push envia notificação
-- para uma lista vazia. Os alertas do Sr. Max NUNCA funcionaram com
-- o app fechado. Ele só era avisado com a aba aberta (setInterval).
--
-- Mesmo padrão do bug `limite_credito`: coluna que o código usa e o
-- schema não tem, com o erro engolido pelo caminho.
-- ════════════════════════════════════════════════════════════════


-- ────────────────────────────────────────────────────────────────
-- PASSO 1 — DIAGNÓSTICO (leitura)
-- ────────────────────────────────────────────────────────────────
SELECT count(*)                AS dispositivos_inscritos,
       count(DISTINCT user_id) AS usuarios
FROM push_subscriptions;
-- ⚠️ Se der 0: confirmado, o push nunca funcionou.

-- Existe a constraint que o onConflict precisa?
SELECT conname AS constraint_name, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid = 'push_subscriptions'::regclass
  AND contype IN ('u', 'p');


-- ────────────────────────────────────────────────────────────────
-- PASSO 2 — CORRIGIR O SCHEMA
-- ────────────────────────────────────────────────────────────────
BEGIN;

-- 2.1 — Colunas que o código já grava
ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS user_agent text;

ALTER TABLE push_subscriptions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 2.2 — Constraint exigida pelo `onConflict: 'user_id,endpoint'`.
-- Sem ela, o upsert falha mesmo com as colunas certas.
-- (Limpa duplicatas antes, se houver — não deve haver, a tabela está vazia.)
DELETE FROM push_subscriptions a
USING push_subscriptions b
WHERE a.ctid < b.ctid
  AND a.user_id = b.user_id
  AND a.endpoint = b.endpoint;

ALTER TABLE push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_endpoint_key;

ALTER TABLE push_subscriptions
  ADD CONSTRAINT push_subscriptions_user_endpoint_key
  UNIQUE (user_id, endpoint);

-- 2.3 — Índice para o send-push (busca por user_id)
CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions (user_id);

-- 2.4 — Mantém updated_at em dia automaticamente
CREATE OR REPLACE FUNCTION touch_push_subscriptions()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_touch_push_subs ON push_subscriptions;
CREATE TRIGGER trg_touch_push_subs
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION touch_push_subscriptions();

COMMIT;


-- ────────────────────────────────────────────────────────────────
-- PASSO 3 — CONFERÊNCIA
-- Deve listar: id, user_id, endpoint, p256dh, auth, created_at,
--              user_agent, updated_at
-- ────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'push_subscriptions'
ORDER BY ordinal_position;

-- E a constraint UNIQUE tem que aparecer aqui:
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'push_subscriptions'::regclass AND contype = 'u';
