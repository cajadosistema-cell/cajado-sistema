-- ============================================================
-- Migration 008: Função para limpar dados fictícios/demo
-- ============================================================
-- Remove registros transacionais criados ANTES de uma data de corte,
-- preservando configurações, contas, produtos e estrutura do sistema.
-- Só pode ser chamada por usuários autenticados (SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.limpar_dados_ficticios(data_corte timestamptz)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  n_lancamentos     int := 0;
  n_leads           int := 0;
  n_ocorrencias     int := 0;
  n_chat            int := 0;
  n_gastos_pf       int := 0;
  n_receitas_pf     int := 0;
  n_agenda          int := 0;
  n_elena           int := 0;
  n_operacoes       int := 0;
  total             int := 0;
BEGIN
  -- ── Financeiro Empresa ────────────────────────────────────
  DELETE FROM public.lancamentos
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_lancamentos = ROW_COUNT;

  -- ── CRM / Vendas ──────────────────────────────────────────
  DELETE FROM public.leads
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_leads = ROW_COUNT;

  -- ── Equipe ────────────────────────────────────────────────
  DELETE FROM public.ocorrencias
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_ocorrencias = ROW_COUNT;

  -- ── Chat Interno ──────────────────────────────────────────
  DELETE FROM public.chat_interno
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_chat = ROW_COUNT;

  -- ── Finanças Pessoais ─────────────────────────────────────
  DELETE FROM public.gastos_pessoais
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_gastos_pf = ROW_COUNT;

  DELETE FROM public.receitas_pessoais
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_receitas_pf = ROW_COUNT;

  -- ── Agenda ────────────────────────────────────────────────
  DELETE FROM public.agenda_eventos
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_agenda = ROW_COUNT;

  -- ── Elena (IA) ────────────────────────────────────────────
  DELETE FROM public.elena_conversas
    WHERE created_at < data_corte;
  DELETE FROM public.elena_ideias
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_elena = ROW_COUNT;

  -- ── Trader ────────────────────────────────────────────────
  -- Tenta deletar de operacoes_trader (pode não existir em todas as instâncias)
  BEGIN
    DELETE FROM public.operacoes_trader
      WHERE created_at < data_corte;
    GET DIAGNOSTICS n_operacoes = ROW_COUNT;
  EXCEPTION WHEN undefined_table THEN
    n_operacoes := 0;
  END;

  total := n_lancamentos + n_leads + n_ocorrencias + n_chat 
         + n_gastos_pf + n_receitas_pf + n_agenda + n_elena + n_operacoes;

  RETURN json_build_object(
    'ok',              true,
    'total',           total,
    'data_corte',      data_corte,
    'lancamentos',     n_lancamentos,
    'leads',           n_leads,
    'ocorrencias',     n_ocorrencias,
    'chat_interno',    n_chat,
    'gastos_pessoais', n_gastos_pf,
    'receitas_pessoais', n_receitas_pf,
    'agenda_eventos',  n_agenda,
    'elena',           n_elena,
    'operacoes_trader', n_operacoes
  );
END;
$$;

-- Permissão apenas para usuários autenticados
GRANT EXECUTE ON FUNCTION public.limpar_dados_ficticios(timestamptz) TO authenticated;

-- ── O QUE NÃO É DELETADO ──────────────────────────────────────
-- ✅ funcionarios     — equipe e acessos
-- ✅ clientes         — carteira de clientes
-- ✅ produtos         — catálogo de produtos
-- ✅ contas           — contas bancárias
-- ✅ categorias       — categorias financeiras
-- ✅ configuracoes_empresa — dados da empresa
