-- ============================================================
-- SISTEMA CAJADO - MIGRATION 051
-- Push Subscriptions: armazena subscriptions do PushManager
-- para envio de notificações server-side (iOS PWA + Android)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  -- Garante 1 subscription por endpoint (upsert idempotente)
  UNIQUE (user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuario gerencia proprias subscriptions" ON public.push_subscriptions;
CREATE POLICY "Usuario gerencia proprias subscriptions"
  ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON public.push_subscriptions(user_id);

DROP TRIGGER IF EXISTS set_updated_at_push_sub ON public.push_subscriptions;
CREATE TRIGGER set_updated_at_push_sub
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
