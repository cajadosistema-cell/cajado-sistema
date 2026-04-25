-- ============================================================
-- Migration 009: Tabela de configuração de Backup
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracoes_backup (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email   text,
  frequencia     text DEFAULT 'semanal'
                  CHECK (frequencia IN ('diario', 'semanal', 'mensal', 'manual')),
  ativo          boolean DEFAULT true,
  ultimo_backup  timestamptz,
  proximo_backup timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.configuracoes_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve propria config" ON public.configuracoes_backup
  FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON public.configuracoes_backup TO authenticated;
