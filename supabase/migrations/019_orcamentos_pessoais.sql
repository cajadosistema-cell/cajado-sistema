-- ================================================================
-- SISTEMA CAJADO - MIGRATION 019
-- Tabela para os limites de orcamento mensais por categoria do PF
-- ================================================================

CREATE TABLE IF NOT EXISTS public.orcamentos_pessoais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  categoria text NOT NULL,
  valor_limite numeric(12,2) NOT NULL DEFAULT 0,
  mes_referencia text NOT NULL, -- Ex: '2026-05'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.orcamentos_pessoais ENABLE ROW LEVEL SECURITY;

-- Garantir que o usuario so veja/edite os proprios orçamentos
CREATE POLICY "Isolamento por usuario" ON public.orcamentos_pessoais
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indice para evitar duplicidade da mesma categoria no mesmo mes
CREATE UNIQUE INDEX IF NOT EXISTS idx_orcamentos_categoria_mes 
  ON public.orcamentos_pessoais(user_id, categoria, mes_referencia);
