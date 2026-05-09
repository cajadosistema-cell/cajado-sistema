-- Migration 028: Campos adicionais para cartões de crédito
-- fatura_prevista: valor que o cliente insere manualmente antes do fechamento
-- limite_credito: limite total do cartão (diferente do limite_gasto_mensal que é controle pessoal)
-- dia_fechamento / dia_vencimento: se ainda não existirem

ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS fatura_prevista   DECIMAL(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS limite_credito    DECIMAL(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dia_fechamento    INTEGER CHECK (dia_fechamento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS dia_vencimento    INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31);
