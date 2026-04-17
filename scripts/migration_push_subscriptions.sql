-- Migration: Push Subscriptions para Web Push
-- Salva as subscriptions de cada usuário para enviar notificações push mesmo offline

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Usuário só pode ver/manipular as próprias subscriptions
DROP POLICY IF EXISTS "push_sub_own" ON push_subscriptions;
CREATE POLICY "push_sub_own"
  ON push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index para busca por user_id (usada ao enviar push)
CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);
