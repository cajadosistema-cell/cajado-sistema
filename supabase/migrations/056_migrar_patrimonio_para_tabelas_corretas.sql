-- ================================================================
-- SISTEMA CAJADO - MIGRATION 056
-- Migra registros de projetos_patrimonio para as tabelas corretas
-- APENAS para a empresa do Sr. Max (max@cajadosolucoes.com.br)
-- ================================================================

DO $$
DECLARE
  v_empresa_id UUID;
BEGIN
  -- Busca o empresa_id do Sr. Max pelo email
  SELECT empresa_id INTO v_empresa_id
  FROM public.perfis
  WHERE email ILIKE '%max%cajado%'
  LIMIT 1;

  -- Se não encontrar pelo padrão, tenta buscar pela empresa "Cajado"
  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id
    FROM public.empresas
    WHERE nome ILIKE '%cajado%'
    LIMIT 1;
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE NOTICE '⚠️  Empresa do Sr. Max não encontrada. Nenhum registro migrado.';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Empresa encontrada: %', v_empresa_id;

  -- ═══════════════════════════════════════════════════════════
  -- PASSO 1: Migrar tipo = 'imovel' → tabela imoveis
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.imoveis (
    empresa_id, titulo, valor_compra, valor_mercado,
    data_aquisicao, parcelas_total, parcelas_pagas, status
  )
  SELECT
    pp.empresa_id, pp.titulo, pp.valor_investido_total, pp.valor_mercado_atual,
    pp.data_aquisicao, pp.parcelas_total, COALESCE(pp.parcelas_pagas, 0),
    CASE
      WHEN pp.status = 'ativo' THEN 'disponivel'
      WHEN pp.status = 'concluido' THEN 'disponivel'
      WHEN pp.status = 'pausado' THEN 'em_reforma'
      WHEN pp.status = 'cancelado' THEN 'vendido'
      ELSE 'disponivel'
    END
  FROM public.projetos_patrimonio pp
  WHERE pp.tipo = 'imovel'
    AND pp.empresa_id = v_empresa_id;

  RAISE NOTICE '✅ Imóveis migrados para tabela imoveis';

  -- ═══════════════════════════════════════════════════════════
  -- PASSO 2: Migrar tipo = 'veiculo' → tabela veiculos
  -- ═══════════════════════════════════════════════════════════
  INSERT INTO public.veiculos (
    empresa_id, titulo, valor_compra, valor_mercado,
    parcelas_total, parcelas_pagas, status
  )
  SELECT
    pp.empresa_id, pp.titulo, pp.valor_investido_total, pp.valor_mercado_atual,
    pp.parcelas_total, COALESCE(pp.parcelas_pagas, 0),
    CASE
      WHEN pp.status = 'ativo' THEN 'ativo'
      WHEN pp.status = 'concluido' THEN 'ativo'
      WHEN pp.status = 'pausado' THEN 'em_manutencao'
      WHEN pp.status = 'cancelado' THEN 'vendido'
      ELSE 'ativo'
    END
  FROM public.projetos_patrimonio pp
  WHERE pp.tipo = 'veiculo'
    AND pp.empresa_id = v_empresa_id;

  RAISE NOTICE '✅ Veículos migrados para tabela veiculos';

  -- ═══════════════════════════════════════════════════════════
  -- PASSO 3: Remover apenas os migrados da aba geral
  -- ═══════════════════════════════════════════════════════════
  DELETE FROM public.projetos_patrimonio
  WHERE tipo IN ('imovel', 'veiculo')
    AND empresa_id = v_empresa_id;

  RAISE NOTICE '✅ Registros migrados removidos da aba geral. Concluído!';
END $$;
