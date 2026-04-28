-- Migration: Adicionar campo limite_gasto_mensal na tabela contas
-- Executar no Supabase SQL Editor

ALTER TABLE contas ADD COLUMN IF NOT EXISTS limite_gasto_mensal numeric(12,2) DEFAULT NULL;

COMMENT ON COLUMN contas.limite_gasto_mensal IS 'Limite de gasto mensal definido pelo cliente para controle de gastos do cartão. Gera alertas ao atingir 80% e 100%.';
