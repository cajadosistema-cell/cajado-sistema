-- ============================================================
-- SISTEMA CAJADO - MIGRATION 060
-- Controle Financeiro Unificado: compromissos fixos + histórico
-- de pagamentos mensal com persistência no Supabase.
-- ============================================================

-- 1) Tabela de compromissos fixos (boletos, parcelas, contas recorrentes)
CREATE TABLE IF NOT EXISTS public.compromissos_fixos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'conta_fixa'
    CHECK (categoria IN ('cartao','boleto_imovel','investimento','conta_fixa','outro')),
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL DEFAULT 0,
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  recorrente BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  metadados JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.compromissos_fixos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compromissos_fixos_user" ON public.compromissos_fixos
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_compromissos_fixos_user
  ON public.compromissos_fixos(user_id, ativo);

-- 2) Histórico de pagamentos mensal (substitui localStorage)
CREATE TABLE IF NOT EXISTS public.historico_pagamentos_mensal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  compromisso_id UUID NOT NULL REFERENCES public.compromissos_fixos(id) ON DELETE CASCADE,
  mes_referencia VARCHAR(7) NOT NULL,
  status TEXT DEFAULT 'pendente'
    CHECK (status IN ('pendente','pago','parcial','atrasado')),
  valor_pago NUMERIC(12,2),
  data_pagamento DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(compromisso_id, mes_referencia)
);

ALTER TABLE public.historico_pagamentos_mensal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "historico_pagamentos_user" ON public.historico_pagamentos_mensal
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_historico_pagamentos_mes
  ON public.historico_pagamentos_mensal(user_id, mes_referencia);

-- 3) Adicionar user_id em faturas_cartoes se não existir
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'faturas_cartoes' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.faturas_cartoes
      ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4) Garantir colunas extras em contas para cartões
ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS nome_cartao TEXT,
  ADD COLUMN IF NOT EXISTS bandeira TEXT,
  ADD COLUMN IF NOT EXISTS limite NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS dia_fechamento INTEGER,
  ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER,
  ADD COLUMN IF NOT EXISTS limite_gasto_mensal NUMERIC(12,2);

-- Verificação
SELECT 'Migration 060 OK' AS status;
