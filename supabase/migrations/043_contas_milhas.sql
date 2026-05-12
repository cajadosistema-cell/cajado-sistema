-- Migration 043: Campos de milhas/pontos nas contas (cartões)
-- Permite rastrear programa de fidelidade, saldo e taxa de conversão

ALTER TABLE contas
  ADD COLUMN IF NOT EXISTS programa_milhas  text DEFAULT NULL,   -- 'livelo','smiles','tudoazul','esfera','latam','azul','multiplus','none'
  ADD COLUMN IF NOT EXISTS taxa_milhas      numeric(6,2) DEFAULT 1.0,  -- R$1 = X pontos/milhas
  ADD COLUMN IF NOT EXISTS saldo_milhas     int DEFAULT 0,             -- saldo atual em pontos
  ADD COLUMN IF NOT EXISTS valor_milha      numeric(6,4) DEFAULT 0.02; -- valor estimado de 1 milha em R$

COMMENT ON COLUMN contas.programa_milhas IS 'Programa de fidelidade vinculado ao cartão (Livelo, Smiles, etc.)';
COMMENT ON COLUMN contas.taxa_milhas      IS 'Quantos pontos/milhas o cartão gera por R$1 gasto';
COMMENT ON COLUMN contas.saldo_milhas     IS 'Saldo atual de milhas/pontos neste cartão';
COMMENT ON COLUMN contas.valor_milha      IS 'Valor estimado de cada milha em R$ para cálculo de resgate';
