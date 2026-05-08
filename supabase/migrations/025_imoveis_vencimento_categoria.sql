-- ================================================================
-- MIGRATION 025 - Adiciona campos de vencimento e categoria
-- financeira nos imóveis parcelados
-- ================================================================

-- Dia do mês do vencimento da parcela (ex: 5, 10, 15, 20...)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31);

-- Categoria para lançamento no financeiro (texto livre ou nome da categoria)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS categoria_financeira TEXT DEFAULT 'Financiamento Imobiliário';

-- Conta padrão para lançar a parcela (opcional - o usuário escolhe na hora)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS conta_id_padrao UUID REFERENCES public.contas(id) ON DELETE SET NULL;
