-- ============================================================
-- SISTEMA CAJADO - MIGRATION 070
-- Adiciona conta_pagamento_id em historico_pagamentos_mensal
-- para rastrear de qual conta saiu o pagamento de compromissos
-- (boletos, contas fixas, investimentos etc.)
-- ============================================================

ALTER TABLE public.historico_pagamentos_mensal
  ADD COLUMN IF NOT EXISTS conta_pagamento_id UUID REFERENCES public.contas(id) DEFAULT NULL;

COMMENT ON COLUMN public.historico_pagamentos_mensal.conta_pagamento_id IS
  'Conta bancária utilizada para pagar este compromisso mensal';
