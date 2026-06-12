-- ================================================================
-- SISTEMA CAJADO - MIGRATION 057
-- Expande CHECK constraint da tabela ativos para aceitar
-- tipos adicionais: poupanca, previdencia, imovel, veiculo, terreno
-- ================================================================

-- Remove a constraint antiga
ALTER TABLE public.ativos DROP CONSTRAINT IF EXISTS ativos_tipo_check;

-- Adiciona a constraint expandida com todos os tipos suportados
ALTER TABLE public.ativos ADD CONSTRAINT ativos_tipo_check
  CHECK (tipo IN (
    'acao','fii','fundo','cdb','lci','lca','tesouro','cripto','outro',
    'poupanca','previdencia','imovel','veiculo','terreno'
  ));

-- Adiciona coluna endereco na tabela imoveis (para endereço do imóvel)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS endereco TEXT DEFAULT NULL;
