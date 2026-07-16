-- ============================================================
-- SISTEMA CAJADO - MIGRATION 069
-- Adiciona conta_pagamento_id em faturas_cartoes para rastrear
-- de qual conta bancária saiu o pagamento da fatura do cartão.
-- ============================================================

ALTER TABLE public.faturas_cartoes
  ADD COLUMN IF NOT EXISTS conta_pagamento_id UUID REFERENCES public.contas(id) DEFAULT NULL;

-- Comentário
COMMENT ON COLUMN public.faturas_cartoes.conta_pagamento_id IS
  'Conta bancária (corrente, poupança etc.) utilizada para pagar esta fatura';

-- Índice para busca rápida
CREATE INDEX IF NOT EXISTS idx_faturas_cartoes_conta_pagamento
  ON public.faturas_cartoes (conta_pagamento_id)
  WHERE conta_pagamento_id IS NOT NULL;
