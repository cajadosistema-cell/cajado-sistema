-- ================================================================
-- 013_limites_orcamento.sql
-- Limites mensais de orçamento para alertas PF e PJ
-- ================================================================

CREATE TABLE IF NOT EXISTS public.limites_orcamento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome          text NOT NULL,                  -- Ex: "Pró-labore", "Alimentação", "Operacional"
  categoria     text NOT NULL DEFAULT 'geral',  -- Ex: "prolabore", "alimentacao", "pessoal", "empresa"
  tipo          text NOT NULL DEFAULT 'pf',     -- 'pf' ou 'pj'
  limite_mensal numeric(12,2) NOT NULL DEFAULT 0,
  cor           text DEFAULT '#10B981',
  ativo         boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.limites_orcamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_limites" ON public.limites_orcamento
  FOR ALL USING (auth.uid() = user_id);

-- Índice para queries frequentes
CREATE INDEX IF NOT EXISTS idx_limites_user_tipo ON public.limites_orcamento(user_id, tipo, ativo);
