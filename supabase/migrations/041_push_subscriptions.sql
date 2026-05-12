-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 041: Web Push Subscriptions (notificações iPhone/Android)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_sub_owner" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Service account (backend) pode inserir/deletar
CREATE POLICY "push_sub_service" ON push_subscriptions
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

COMMENT ON TABLE push_subscriptions IS 'Subscriptions Web Push por dispositivo/usuário para notificações nativas iPhone/Android';
