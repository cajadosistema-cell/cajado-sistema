-- ============================================================
-- SISTEMA CAJADO - MIGRATION 015
-- Trigger: preenche empresa_id automaticamente em todos os INSERTs
-- O frontend não precisa enviar empresa_id — o banco preenche sozinho
-- ============================================================

-- Função genérica usada por todos os triggers
CREATE OR REPLACE FUNCTION public.set_empresa_id_automatico()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.empresa_id IS NULL THEN
    NEW.empresa_id := public.get_empresa_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Macro para criar o trigger em cada tabela
-- (PostgreSQL não suporta dynamic DDL em funções, então listamos manualmente)

-- Financeiro
DROP TRIGGER IF EXISTS trg_auto_empresa_contas ON public.contas;
CREATE TRIGGER trg_auto_empresa_contas
  BEFORE INSERT ON public.contas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_categorias ON public.categorias_financeiras;
CREATE TRIGGER trg_auto_empresa_categorias
  BEFORE INSERT ON public.categorias_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_recorrencias ON public.recorrencias;
CREATE TRIGGER trg_auto_empresa_recorrencias
  BEFORE INSERT ON public.recorrencias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_lancamentos ON public.lancamentos;
CREATE TRIGGER trg_auto_empresa_lancamentos
  BEFORE INSERT ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_conciliacao ON public.conciliacao_extrato;
CREATE TRIGGER trg_auto_empresa_conciliacao
  BEFORE INSERT ON public.conciliacao_extrato
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

-- CRM
DROP TRIGGER IF EXISTS trg_auto_empresa_leads ON public.leads;
CREATE TRIGGER trg_auto_empresa_leads
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_atividades ON public.atividades;
CREATE TRIGGER trg_auto_empresa_atividades
  BEFORE INSERT ON public.atividades
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_parceiros ON public.parceiros;
CREATE TRIGGER trg_auto_empresa_parceiros
  BEFORE INSERT ON public.parceiros
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_mensagens ON public.mensagens_padrao;
CREATE TRIGGER trg_auto_empresa_mensagens
  BEFORE INSERT ON public.mensagens_padrao
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_campanhas ON public.campanhas;
CREATE TRIGGER trg_auto_empresa_campanhas
  BEFORE INSERT ON public.campanhas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

-- Operacional
DROP TRIGGER IF EXISTS trg_auto_empresa_checkins ON public.checkins;
CREATE TRIGGER trg_auto_empresa_checkins
  BEFORE INSERT ON public.checkins
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_relatorio ON public.relatorio_diario;
CREATE TRIGGER trg_auto_empresa_relatorio
  BEFORE INSERT ON public.relatorio_diario
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_whatsapp ON public.numeros_whatsapp;
CREATE TRIGGER trg_auto_empresa_whatsapp
  BEFORE INSERT ON public.numeros_whatsapp
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_backup ON public.backup_contatos;
CREATE TRIGGER trg_auto_empresa_backup
  BEFORE INSERT ON public.backup_contatos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

-- Organização
DROP TRIGGER IF EXISTS trg_auto_empresa_projetos ON public.projetos;
CREATE TRIGGER trg_auto_empresa_projetos
  BEFORE INSERT ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_ideias ON public.ideias;
CREATE TRIGGER trg_auto_empresa_ideias
  BEFORE INSERT ON public.ideias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_decisoes ON public.decisoes;
CREATE TRIGGER trg_auto_empresa_decisoes
  BEFORE INSERT ON public.decisoes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

-- Trader / Investimentos
DROP TRIGGER IF EXISTS trg_auto_empresa_regras ON public.regras_risco;
CREATE TRIGGER trg_auto_empresa_regras
  BEFORE INSERT ON public.regras_risco
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_operacoes ON public.operacoes;
CREATE TRIGGER trg_auto_empresa_operacoes
  BEFORE INSERT ON public.operacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_ativos ON public.ativos;
CREATE TRIGGER trg_auto_empresa_ativos
  BEFORE INSERT ON public.ativos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_movimentacoes ON public.movimentacoes_ativos;
CREATE TRIGGER trg_auto_empresa_movimentacoes
  BEFORE INSERT ON public.movimentacoes_ativos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_patrimonio ON public.projetos_patrimonio;
CREATE TRIGGER trg_auto_empresa_patrimonio
  BEFORE INSERT ON public.projetos_patrimonio
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_custos ON public.custos_patrimonio;
CREATE TRIGGER trg_auto_empresa_custos
  BEFORE INSERT ON public.custos_patrimonio
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

-- Inteligência
DROP TRIGGER IF EXISTS trg_auto_empresa_analises ON public.analises_mercado;
CREATE TRIGGER trg_auto_empresa_analises
  BEFORE INSERT ON public.analises_mercado
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_tendencias ON public.tendencias;
CREATE TRIGGER trg_auto_empresa_tendencias
  BEFORE INSERT ON public.tendencias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

-- Clientes / Vendas
DROP TRIGGER IF EXISTS trg_auto_empresa_clientes ON public.clientes;
CREATE TRIGGER trg_auto_empresa_clientes
  BEFORE INSERT ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_produtos ON public.produtos;
CREATE TRIGGER trg_auto_empresa_produtos
  BEFORE INSERT ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_vendas ON public.vendas;
CREATE TRIGGER trg_auto_empresa_vendas
  BEFORE INSERT ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_itens ON public.itens_venda;
CREATE TRIGGER trg_auto_empresa_itens
  BEFORE INSERT ON public.itens_venda
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_parcelas ON public.parcelas_venda;
CREATE TRIGGER trg_auto_empresa_parcelas
  BEFORE INSERT ON public.parcelas_venda
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_templates ON public.templates_pos_venda;
CREATE TRIGGER trg_auto_empresa_templates
  BEFORE INSERT ON public.templates_pos_venda
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_disparos ON public.disparos_pos_venda;
CREATE TRIGGER trg_auto_empresa_disparos
  BEFORE INSERT ON public.disparos_pos_venda
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

-- Gestão interna
DROP TRIGGER IF EXISTS trg_auto_empresa_diario ON public.diario_entradas;
CREATE TRIGGER trg_auto_empresa_diario
  BEFORE INSERT ON public.diario_entradas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_conf ON public.configuracoes_empresa;
CREATE TRIGGER trg_auto_empresa_conf
  BEFORE INSERT ON public.configuracoes_empresa
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_funcionarios ON public.funcionarios;
CREATE TRIGGER trg_auto_empresa_funcionarios
  BEFORE INSERT ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_tarefas ON public.tarefas;
CREATE TRIGGER trg_auto_empresa_tarefas
  BEFORE INSERT ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_ocorrencias ON public.ocorrencias;
CREATE TRIGGER trg_auto_empresa_ocorrencias
  BEFORE INSERT ON public.ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_ponto ON public.registros_ponto;
CREATE TRIGGER trg_auto_empresa_ponto
  BEFORE INSERT ON public.registros_ponto
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

-- RBAC
DROP TRIGGER IF EXISTS trg_auto_empresa_user_roles ON public.user_roles;
CREATE TRIGGER trg_auto_empresa_user_roles
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

-- Logs
DROP TRIGGER IF EXISTS trg_auto_empresa_log_acesso ON public.log_acesso;
CREATE TRIGGER trg_auto_empresa_log_acesso
  BEFORE INSERT ON public.log_acesso
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_audit_log ON public.audit_log;
CREATE TRIGGER trg_auto_empresa_audit_log
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();
