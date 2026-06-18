-- ============================================================
-- SISTEMA CAJADO - MIGRATION 054
-- Adiciona campo de status de pagamento e data de pagamento
-- na tabela faturas_cartoes para rastrear se a fatura foi paga.
-- ============================================================

ALTER TABLE public.faturas_cartoes
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'pago', 'parcial')),
  ADD COLUMN IF NOT EXISTS data_pagamento TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notas TEXT DEFAULT NULL;

-- Índice para busca rápida de faturas pendentes por status
CREATE INDEX IF NOT EXISTS idx_faturas_cartoes_status
  ON public.faturas_cartoes (conta_id, status);

-- Comentário
COMMENT ON COLUMN public.faturas_cartoes.status IS
  'Status de pagamento: pendente (padrão), pago, parcial';
COMMENT ON COLUMN public.faturas_cartoes.data_pagamento IS
  'Data/hora em que o pagamento foi registrado';
