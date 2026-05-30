-- =============================================================
-- NEXUM SAAS -- SETUP COMPLETO DO BANCO DE DADOS
-- Cole e execute no SQL Editor do novo projeto Supabase
-- =============================================================

-- -------------------------------------------------------------
-- MIGRATION: 001_schema_inicial.sql
-- -------------------------------------------------------------

-- ============================================================
-- SISTEMA CAJADO - SCHEMA COMPLETO
-- Migration: 001_schema_inicial
-- ============================================================

-- Habilitar extensÃµes necessÃ¡rias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELAS BASE / AUTENTICAÃ‡ÃƒO
-- ============================================================

CREATE TABLE public.perfis (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  cargo TEXT,
  foto_url TEXT,
  meta_mensal DECIMAL(12,2),
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- M01 - FINANCEIRO
-- ============================================================

CREATE TABLE public.contas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('corrente','poupanca','investimento','cartao_credito','cartao_debito','dinheiro')),
  categoria TEXT NOT NULL DEFAULT 'pf' CHECK (categoria IN ('pf','pj')),
  banco TEXT,
  agencia TEXT,
  numero TEXT,
  saldo_inicial DECIMAL(15,2) NOT NULL DEFAULT 0,
  saldo_atual DECIMAL(15,2) NOT NULL DEFAULT 0,
  cor TEXT DEFAULT '#6B7280',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.categorias_financeiras (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','investimento','transferencia')),
  cor TEXT DEFAULT '#6B7280',
  icone TEXT,
  parent_id UUID REFERENCES public.categorias_financeiras(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.recorrencias (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','investimento','transferencia')),
  conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  frequencia TEXT NOT NULL CHECK (frequencia IN ('diaria','semanal','mensal','anual','personalizada')),
  dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31),
  data_inicio DATE NOT NULL,
  data_fim DATE,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.lancamentos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conta_id UUID REFERENCES public.contas(id) ON DELETE RESTRICT NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita','despesa','investimento','transferencia')),
  regime TEXT NOT NULL DEFAULT 'caixa' CHECK (regime IN ('competencia','caixa')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('automatico','pendente','validado')),
  data_competencia DATE NOT NULL,
  data_caixa DATE,
  categoria_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  parcela_atual INTEGER,
  total_parcelas INTEGER,
  recorrencia_id UUID REFERENCES public.recorrencias(id) ON DELETE SET NULL,
  conta_destino_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  conciliado BOOLEAN DEFAULT FALSE,
  observacoes TEXT,
  anexos TEXT[],
  created_by UUID REFERENCES public.perfis(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.conciliacao_extrato (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  conta_id UUID REFERENCES public.contas(id) ON DELETE CASCADE NOT NULL,
  lancamento_id UUID REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data DATE NOT NULL,
  origem TEXT NOT NULL DEFAULT 'extrato' CHECK (origem IN ('extrato','sistema')),
  status TEXT NOT NULL DEFAULT 'nao_identificado' CHECK (status IN ('conciliado','divergente','nao_identificado')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- M02 - CAJADO EMPRESA
-- ============================================================

CREATE TABLE public.leads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  origem TEXT NOT NULL DEFAULT 'whatsapp' CHECK (origem IN ('whatsapp','indicacao','instagram','google','outro')),
  servico_interesse TEXT,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo','proposta','retomar','cliente_ativo','perdido')),
  valor_estimado DECIMAL(12,2),
  atendente_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  parceiro_id UUID,
  notas TEXT,
  ultimo_contato TIMESTAMPTZ,
  proximo_followup TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.atividades (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('mensagem','ligacao','reuniao','proposta','visita','outro')),
  descricao TEXT NOT NULL,
  resultado TEXT,
  duracao_minutos INTEGER,
  realizado_por UUID REFERENCES public.perfis(id) NOT NULL,
  realizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.parceiros (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT NOT NULL,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo','suspenso')),
  comissao_percentual DECIMAL(5,2) NOT NULL DEFAULT 10,
  total_indicacoes INTEGER DEFAULT 0,
  total_convertidas INTEGER DEFAULT 0,
  total_comissao DECIMAL(12,2) DEFAULT 0,
  meta_mensal INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atualizar FK de leads para parceiros
ALTER TABLE public.leads ADD CONSTRAINT leads_parceiro_fk
  FOREIGN KEY (parceiro_id) REFERENCES public.parceiros(id) ON DELETE SET NULL;

CREATE TABLE public.mensagens_padrao (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT NOT NULL,
  conteudo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  variaveis TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.campanhas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','agendada','enviando','concluida','pausada')),
  numero_origem_id UUID,
  total_destinatarios INTEGER DEFAULT 0,
  enviados INTEGER DEFAULT 0,
  erros INTEGER DEFAULT 0,
  agendado_para TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  created_by UUID REFERENCES public.perfis(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.checkins (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  membro_id UUID REFERENCES public.perfis(id) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida')),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  endereco TEXT,
  servico_descricao TEXT,
  foto_evidencia_url TEXT,
  tempo_execucao_minutos INTEGER,
  observacoes TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.relatorio_diario (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  leads_sem_resposta INTEGER DEFAULT 0,
  propostas_sem_resposta INTEGER DEFAULT 0,
  clientes_para_retomar INTEGER DEFAULT 0,
  servicos_nao_finalizados INTEGER DEFAULT 0,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- M03 - SEGURANÃ‡A WHATSAPP
-- ============================================================

CREATE TABLE public.numeros_whatsapp (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','backup','bloqueado','inativo')),
  instancia_id TEXT,
  limite_diario INTEGER DEFAULT 200,
  enviados_hoje INTEGER DEFAULT 0,
  intervalo_minimo_segundos INTEGER DEFAULT 10,
  is_backup BOOLEAN DEFAULT FALSE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.backup_contatos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero_id UUID REFERENCES public.numeros_whatsapp(id) ON DELETE CASCADE,
  total_contatos INTEGER DEFAULT 0,
  arquivo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- FK de campanhas para nÃºmeros
ALTER TABLE public.campanhas ADD CONSTRAINT campanhas_numero_fk
  FOREIGN KEY (numero_origem_id) REFERENCES public.numeros_whatsapp(id) ON DELETE SET NULL;

-- ============================================================
-- M04 - ORGANIZAÃ‡ÃƒO
-- ============================================================

CREATE TABLE public.projetos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','concluido','cancelado')),
  data_inicio DATE,
  data_fim_prevista DATE,
  data_fim_real DATE,
  responsavel_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  progresso_percentual INTEGER DEFAULT 0 CHECK (progresso_percentual BETWEEN 0 AND 100),
  proximos_passos TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.ideias (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'ideia' CHECK (status IN ('ideia','analise','execucao','validada','descartada')),
  prazo TEXT NOT NULL DEFAULT 'medio' CHECK (prazo IN ('curto','medio','longo')),
  potencial_impacto TEXT CHECK (potencial_impacto IN ('baixo','medio','alto')),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.decisoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  contexto TEXT NOT NULL,
  decisao_tomada TEXT NOT NULL,
  alternativas_consideradas TEXT,
  resultado TEXT,
  aprendizado TEXT,
  data_decisao DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES public.perfis(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- M05 - TRADER
-- ============================================================

CREATE TABLE public.regras_risco (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  descricao TEXT NOT NULL,
  valor_maximo_operacao DECIMAL(15,2) NOT NULL,
  percentual_max_capital DECIMAL(5,2) NOT NULL,
  max_operacoes_dia INTEGER NOT NULL DEFAULT 5,
  horario_inicio TIME,
  horario_fim TIME,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.operacoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ativo TEXT NOT NULL,
  mercado TEXT NOT NULL CHECK (mercado IN ('acoes','futuros','cripto','forex','opcoes','fii')),
  tipo TEXT NOT NULL CHECK (tipo IN ('compra','venda','opcao_call','opcao_put')),
  data_entrada TIMESTAMPTZ NOT NULL,
  data_saida TIMESTAMPTZ,
  preco_entrada DECIMAL(15,6) NOT NULL,
  preco_saida DECIMAL(15,6),
  quantidade DECIMAL(15,6) NOT NULL,
  stop_loss DECIMAL(15,6),
  take_profit DECIMAL(15,6),
  resultado TEXT NOT NULL DEFAULT 'aberta' CHECK (resultado IN ('gain','loss','breakeven','aberta')),
  lucro_prejuizo DECIMAL(15,2),
  percentual DECIMAL(8,4),
  erros_cometidos TEXT,
  aprendizado TEXT,
  conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- M06 - INVESTIMENTOS
-- ============================================================

CREATE TABLE public.ativos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticker TEXT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('acao','fii','fundo','cdb','lci','lca','tesouro','cripto','outro')),
  quantidade DECIMAL(15,6) NOT NULL DEFAULT 0,
  preco_medio DECIMAL(15,6) NOT NULL DEFAULT 0,
  preco_atual DECIMAL(15,6),
  valor_investido DECIMAL(15,2) NOT NULL DEFAULT 0,
  valor_atual DECIMAL(15,2),
  liquidez TEXT NOT NULL DEFAULT 'diaria' CHECK (liquidez IN ('diaria','semanal','mensal','no_vencimento')),
  data_vencimento DATE,
  rentabilidade_percentual DECIMAL(8,4),
  risco_nivel INTEGER NOT NULL DEFAULT 3 CHECK (risco_nivel BETWEEN 1 AND 5),
  corretora TEXT,
  conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.movimentacoes_ativos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  ativo_id UUID REFERENCES public.ativos(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('compra','venda','dividendo','jscp','amortizacao')),
  quantidade DECIMAL(15,6),
  valor DECIMAL(15,2) NOT NULL,
  data DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- M07 - PATRIMÃ”NIO
-- ============================================================

CREATE TABLE public.projetos_patrimonio (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('imovel','veiculo','equipamento','reforma','outro')),
  descricao TEXT,
  valor_investido_total DECIMAL(15,2) NOT NULL DEFAULT 0,
  valor_mercado_atual DECIMAL(15,2),
  roi_percentual DECIMAL(8,4),
  data_aquisicao DATE,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','pausado','concluido','cancelado')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.custos_patrimonio (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  projeto_id UUID REFERENCES public.projetos_patrimonio(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data DATE NOT NULL,
  categoria TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- M08 - INTELIGÃŠNCIA
-- ============================================================

CREATE TABLE public.analises_mercado (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('concorrente','preco','oportunidade','tendencia')),
  conteudo TEXT NOT NULL,
  fonte TEXT,
  status TEXT NOT NULL DEFAULT 'concluida' CHECK (status IN ('processando','concluida','erro')),
  ia_gerada BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.tendencias (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('servico','tecnologia','mercado','comportamento')),
  status TEXT NOT NULL DEFAULT 'monitorando' CHECK (status IN ('monitorando','ativa','descartada')),
  impacto_estimado TEXT CHECK (impacto_estimado IN ('baixo','medio','alto')),
  fontes TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- M09 - SEGURANÃ‡A GERAL
-- ============================================================

CREATE TABLE public.log_acesso (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id),
  acao TEXT NOT NULL,
  recurso TEXT NOT NULL,
  recurso_id TEXT,
  ip TEXT,
  user_agent TEXT,
  sucesso BOOLEAN DEFAULT TRUE,
  detalhes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tabela TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  acao TEXT NOT NULL CHECK (acao IN ('create','update','delete')),
  valores_anteriores JSONB,
  valores_novos JSONB,
  user_id UUID REFERENCES public.perfis(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÃNDICES DE PERFORMANCE
-- ============================================================

CREATE INDEX idx_lancamentos_conta ON public.lancamentos(conta_id);
CREATE INDEX idx_lancamentos_data ON public.lancamentos(data_competencia);
CREATE INDEX idx_lancamentos_tipo ON public.lancamentos(tipo);
CREATE INDEX idx_lancamentos_status ON public.lancamentos(status);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_atendente ON public.leads(atendente_id);
CREATE INDEX idx_leads_followup ON public.leads(proximo_followup);
CREATE INDEX idx_atividades_lead ON public.atividades(lead_id);
CREATE INDEX idx_checkins_membro ON public.checkins(membro_id);
CREATE INDEX idx_checkins_timestamp ON public.checkins(timestamp);
CREATE INDEX idx_operacoes_ativo ON public.operacoes(ativo);
CREATE INDEX idx_operacoes_data ON public.operacoes(data_entrada);
CREATE INDEX idx_audit_log_tabela ON public.audit_log(tabela, registro_id);
CREATE INDEX idx_log_acesso_user ON public.log_acesso(user_id);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lancamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ideias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projetos_patrimonio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analises_mercado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tendencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_acesso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- PolÃ­ticas bÃ¡sicas: usuÃ¡rio autenticado acessa tudo (ajuste conforme necessÃ¡rio)
CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.contas
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.lancamentos
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.leads
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.atividades
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.parceiros
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.checkins
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.projetos
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.ideias
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.decisoes
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.operacoes
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.ativos
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.projetos_patrimonio
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.analises_mercado
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "UsuÃ¡rios autenticados tÃªm acesso total" ON public.tendencias
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Perfil: usuÃ¡rio sÃ³ vÃª/edita o prÃ³prio perfil
CREATE POLICY "UsuÃ¡rio vÃª e edita o prÃ³prio perfil" ON public.perfis
  FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auditoria: apenas inserÃ§Ã£o
CREATE POLICY "InserÃ§Ã£o de auditoria" ON public.log_acesso
  FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Leitura de auditoria" ON public.log_acesso
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "InserÃ§Ã£o de audit_log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Leitura de audit_log" ON public.audit_log
  FOR SELECT TO authenticated USING (TRUE);

-- ============================================================
-- FUNÃ‡ÃƒO: atualizar updated_at automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.contas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.parceiros
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projetos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ideias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.ativos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.projetos_patrimonio
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tendencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.numeros_whatsapp
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- FUNÃ‡ÃƒO: criar perfil apÃ³s signup
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.perfis (id, nome, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- VIEWS ÃšTEIS
-- ============================================================

-- Saldo consolidado por conta
CREATE VIEW public.v_saldo_contas AS
SELECT
  c.id,
  c.nome,
  c.tipo,
  c.categoria,
  c.banco,
  c.saldo_inicial,
  c.saldo_inicial + COALESCE(SUM(
    CASE
      WHEN l.tipo IN ('receita') THEN l.valor
      WHEN l.tipo IN ('despesa', 'investimento') THEN -l.valor
      ELSE 0
    END
  ), 0) AS saldo_calculado,
  c.saldo_atual,
  c.cor,
  c.ativo
FROM public.contas c
LEFT JOIN public.lancamentos l ON l.conta_id = c.id AND l.regime = 'caixa'
GROUP BY c.id;

-- Dashboard de leads
CREATE VIEW public.v_leads_dashboard AS
SELECT
  status,
  COUNT(*) AS total,
  AVG(valor_estimado) AS ticket_medio,
  COUNT(CASE WHEN proximo_followup < NOW() THEN 1 END) AS followups_atrasados
FROM public.leads
GROUP BY status;

-- Performance da equipe (mÃªs atual)
CREATE VIEW public.v_performance_equipe AS
SELECT
  p.id,
  p.nome,
  p.cargo,
  p.meta_mensal,
  COUNT(DISTINCT l.id) FILTER (
    WHERE l.status = 'cliente_ativo'
    AND DATE_TRUNC('month', l.created_at) = DATE_TRUNC('month', NOW())
  ) AS conversoes_mes,
  COUNT(DISTINCT l.id) FILTER (
    WHERE DATE_TRUNC('month', l.created_at) = DATE_TRUNC('month', NOW())
  ) AS leads_mes,
  AVG(
    EXTRACT(EPOCH FROM (a.realizado_em - l.created_at)) / 3600
  ) AS tempo_medio_resposta_horas
FROM public.perfis p
LEFT JOIN public.leads l ON l.atendente_id = p.id
LEFT JOIN public.atividades a ON a.realizado_por = p.id
GROUP BY p.id;

-- PosiÃ§Ã£o de investimentos
CREATE VIEW public.v_posicao_investimentos AS
SELECT
  tipo,
  COUNT(*) AS qtd_ativos,
  SUM(valor_investido) AS total_investido,
  SUM(COALESCE(valor_atual, valor_investido)) AS total_atual,
  SUM(COALESCE(valor_atual, valor_investido)) - SUM(valor_investido) AS resultado,
  ROUND(
    (SUM(COALESCE(valor_atual, valor_investido)) - SUM(valor_investido))
    / NULLIF(SUM(valor_investido), 0) * 100, 2
  ) AS rentabilidade_percentual
FROM public.ativos
GROUP BY tipo;

-- ============================================================
-- DADOS INICIAIS
-- ============================================================

INSERT INTO public.categorias_financeiras (nome, tipo, cor) VALUES
  ('Receita Operacional', 'receita', '#10B981'),
  ('Receita Financeira', 'receita', '#6EE7B7'),
  ('Outros Recebimentos', 'receita', '#A7F3D0'),
  ('Despesas Operacionais', 'despesa', '#EF4444'),
  ('Marketing e Publicidade', 'despesa', '#F87171'),
  ('Pessoal e SalÃ¡rios', 'despesa', '#FCA5A5'),
  ('Infraestrutura e Tecnologia', 'despesa', '#FECACA'),
  ('Impostos e Taxas', 'despesa', '#FEE2E2'),
  ('Outras Despesas', 'despesa', '#FEF2F2'),
  ('Aportes', 'investimento', '#3B82F6'),
  ('TransferÃªncia Interna', 'transferencia', '#6B7280');

INSERT INTO public.mensagens_padrao (titulo, conteudo, categoria, variaveis) VALUES
  ('Primeiro Contato', 'OlÃ¡, {{nome}}! Tudo bem? Vi que vocÃª entrou em contato sobre {{servico}}. Posso te ajudar! ðŸ˜Š', 'prospeccao', ARRAY['nome', 'servico']),
  ('Proposta Enviada', 'OlÃ¡, {{nome}}! Acabei de te enviar a proposta por e-mail. Ficou alguma dÃºvida?', 'proposta', ARRAY['nome']),
  ('Follow-up', 'Oi, {{nome}}! Estou passando para ver se vocÃª conseguiu analisar a proposta que enviei. ðŸ˜Š', 'followup', ARRAY['nome']),
  ('PÃ³s-venda', 'OlÃ¡, {{nome}}! Gostaria de saber como estÃ¡ sendo sua experiÃªncia com o serviÃ§o. Tudo certo?', 'pos_venda', ARRAY['nome']),
  ('Lembrete de RenovaÃ§Ã£o', 'Oi, {{nome}}! Seu contrato vence em breve. Vamos conversar sobre a renovaÃ§Ã£o?', 'renovacao', ARRAY['nome']);


-- -------------------------------------------------------------
-- MIGRATION: 002_modulos_vendas_diario_posvenda.sql
-- -------------------------------------------------------------

-- ============================================================
-- SISTEMA CAJADO - MIGRATION 002 (v2 - idempotente com DROP)
-- MÃ³dulos: Vendas/OS, Clientes, PÃ³s-venda, DiÃ¡rio EstratÃ©gico
-- ============================================================

-- ============================================================
-- DROP de tabelas que podem existir com schema antigo
-- (ordem inversa por dependÃªncias de FK)
-- ============================================================

DROP TABLE IF EXISTS public.registros_ponto    CASCADE;
DROP TABLE IF EXISTS public.ocorrencias        CASCADE;
DROP TABLE IF EXISTS public.tarefas            CASCADE;
DROP TABLE IF EXISTS public.funcionarios       CASCADE;
DROP TABLE IF EXISTS public.configuracoes_empresa CASCADE;
DROP TABLE IF EXISTS public.diario_entradas    CASCADE;
DROP TABLE IF EXISTS public.disparos_pos_venda CASCADE;
DROP TABLE IF EXISTS public.templates_pos_venda CASCADE;
DROP TABLE IF EXISTS public.parcelas_venda     CASCADE;
DROP TABLE IF EXISTS public.itens_venda        CASCADE;
DROP TABLE IF EXISTS public.vendas             CASCADE;
DROP TABLE IF EXISTS public.produtos           CASCADE;
DROP TABLE IF EXISTS public.clientes           CASCADE;

-- ============================================================
-- M10 - CLIENTES
-- ============================================================

CREATE TABLE public.clientes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'pf' CHECK (tipo IN ('pf','pj')),
  cpf_cnpj TEXT,
  telefone TEXT,
  email TEXT,
  endereco TEXT,
  cidade TEXT,
  estado TEXT,
  cep TEXT,
  observacoes TEXT,
  total_compras INTEGER DEFAULT 0,
  total_gasto DECIMAL(15,2) DEFAULT 0,
  ultima_compra TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados clientes" ON public.clientes
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_clientes_nome ON public.clientes(nome);
CREATE INDEX IF NOT EXISTS idx_clientes_lead ON public.clientes(lead_id);

CREATE TRIGGER set_updated_at_clientes BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- M11 - PRODUTOS / CATÃLOGO
-- ============================================================

CREATE TABLE public.produtos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'servico' CHECK (tipo IN ('produto','servico','kit')),
  codigo TEXT,
  preco_custo DECIMAL(15,2) NOT NULL DEFAULT 0,
  preco_venda DECIMAL(15,2) NOT NULL DEFAULT 0,
  unidade TEXT NOT NULL DEFAULT 'UN',
  categoria TEXT,
  foto_url TEXT,
  controla_estoque BOOLEAN DEFAULT FALSE,
  estoque_atual INTEGER DEFAULT 0,
  estoque_minimo INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados produtos" ON public.produtos
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_produtos_nome ON public.produtos(nome);
CREATE INDEX IF NOT EXISTS idx_produtos_tipo ON public.produtos(tipo);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo ON public.produtos(ativo);

CREATE TRIGGER set_updated_at_produtos BEFORE UPDATE ON public.produtos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- M12 - VENDAS / ORDENS DE SERVIÃ‡O
-- ============================================================

CREATE TABLE public.vendas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'os' CHECK (tipo IN ('venda','os','orcamento','pedido')),
  status TEXT NOT NULL DEFAULT 'aberta' CHECK (status IN ('rascunho','aberta','em_andamento','concluida','cancelada','orcamento_aprovado')),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  atendente_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  parceiro_id UUID REFERENCES public.parceiros(id) ON DELETE SET NULL,
  data_abertura DATE NOT NULL DEFAULT CURRENT_DATE,
  data_previsao DATE,
  data_conclusao DATE,
  subtotal DECIMAL(15,2) NOT NULL DEFAULT 0,
  desconto_valor DECIMAL(15,2) NOT NULL DEFAULT 0,
  desconto_percentual DECIMAL(5,2) NOT NULL DEFAULT 0,
  acrescimo DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) NOT NULL DEFAULT 0,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro','pix','cartao_credito','cartao_debito','boleto','fiado','outro')),
  total_parcelas INTEGER NOT NULL DEFAULT 1,
  valor_entrada DECIMAL(15,2) NOT NULL DEFAULT 0,
  status_pagamento TEXT NOT NULL DEFAULT 'pendente' CHECK (status_pagamento IN ('pendente','parcial','pago','cancelado')),
  total_recebido DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_a_receber DECIMAL(15,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  observacoes_internas TEXT,
  origem TEXT,
  lancamento_id UUID REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  created_by UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados vendas" ON public.vendas
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_vendas_status ON public.vendas(status);
CREATE INDEX IF NOT EXISTS idx_vendas_cliente ON public.vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON public.vendas(data_abertura);
CREATE INDEX IF NOT EXISTS idx_vendas_numero ON public.vendas(numero);

CREATE TRIGGER set_updated_at_vendas BEFORE UPDATE ON public.vendas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Itens da venda
CREATE TABLE public.itens_venda (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venda_id UUID REFERENCES public.vendas(id) ON DELETE CASCADE NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  quantidade DECIMAL(15,6) NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL DEFAULT 'UN',
  preco_unitario DECIMAL(15,2) NOT NULL,
  desconto_percentual DECIMAL(5,2) NOT NULL DEFAULT 0,
  desconto_valor DECIMAL(15,2) NOT NULL DEFAULT 0,
  total DECIMAL(15,2) NOT NULL,
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.itens_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados itens_venda" ON public.itens_venda
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Parcelas da venda
CREATE TABLE public.parcelas_venda (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  venda_id UUID REFERENCES public.vendas(id) ON DELETE CASCADE NOT NULL,
  numero_parcela INTEGER NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_recebimento DATE,
  valor_recebido DECIMAL(15,2),
  forma_pagamento TEXT CHECK (forma_pagamento IN ('dinheiro','pix','cartao_credito','cartao_debito','boleto','fiado','outro')),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','pago','atrasado','cancelado')),
  observacao TEXT,
  lancamento_id UUID REFERENCES public.lancamentos(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.parcelas_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados parcelas_venda" ON public.parcelas_venda
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- M13 - PÃ“S-VENDA / AUTOMAÃ‡Ã•ES
-- ============================================================

CREATE TABLE public.templates_pos_venda (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  gatilho TEXT NOT NULL DEFAULT 'manual' CHECK (gatilho IN ('conclusao_os','dias_7','dias_15','dias_30','manual')),
  ativo BOOLEAN DEFAULT TRUE,
  disparos_total INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.templates_pos_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados templates_pos_venda" ON public.templates_pos_venda
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE TRIGGER set_updated_at_templates_pv BEFORE UPDATE ON public.templates_pos_venda
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.disparos_pos_venda (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  template_id UUID REFERENCES public.templates_pos_venda(id) ON DELETE SET NULL,
  venda_id UUID REFERENCES public.vendas(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL,
  cliente_telefone TEXT,
  status TEXT NOT NULL DEFAULT 'na_fila' CHECK (status IN ('enviado','entregue','lido','falhou','agendado','na_fila')),
  mensagem_enviada TEXT,
  agendado_para TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ,
  erro_detalhe TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.disparos_pos_venda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados disparos_pos_venda" ON public.disparos_pos_venda
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_disparos_status ON public.disparos_pos_venda(status);
CREATE INDEX IF NOT EXISTS idx_disparos_template ON public.disparos_pos_venda(template_id);

-- Templates padrÃ£o iniciais
INSERT INTO public.templates_pos_venda (nome, mensagem, gatilho, ativo) VALUES
  ('Agradecimento imediato', 'OlÃ¡ {{nome_cliente}}! ðŸ˜Š Obrigado por escolher a {{empresa}}. Foi um prazer te atender! Ficou com alguma dÃºvida Ã© sÃ³ chamar.', 'conclusao_os', true),
  ('Follow-up 7 dias', 'Oi {{nome_cliente}}, tudo bem? Estou passando para saber se ficou satisfeito com o {{servico}}. Tem algum feedback para compartilhar? ðŸ™', 'dias_7', true),
  ('Pedido de indicaÃ§Ã£o 15 dias', 'Oi {{nome_cliente}}! Espero que esteja tudo certo com vocÃª. Caso conheÃ§a alguÃ©m que precise de {{servico}}, vai ser um prazer atender! ðŸ˜€ Obrigado por confiar no nosso trabalho!', 'dias_15', true);

-- ============================================================
-- M14 - DIÃRIO ESTRATÃ‰GICO
-- ============================================================

CREATE TABLE public.diario_entradas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT,
  texto TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'diario' CHECK (tipo IN ('diario','decisao','snapshot','marco')),
  categoria TEXT NOT NULL DEFAULT 'geral' CHECK (categoria IN ('geral','decisao','aprendizado','patrimonio','financeiro_pf','financeiro_pj','trading','mercado','projeto','ideia','reserva','meta')),
  humor TEXT CHECK (humor IN ('otimo','bom','neutro','ruim','critico')),
  fixada BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.diario_entradas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados diario_entradas" ON public.diario_entradas
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_diario_tipo ON public.diario_entradas(tipo);
CREATE INDEX IF NOT EXISTS idx_diario_categoria ON public.diario_entradas(categoria);
CREATE INDEX IF NOT EXISTS idx_diario_fixada ON public.diario_entradas(fixada);
CREATE INDEX IF NOT EXISTS idx_diario_data ON public.diario_entradas(created_at);

CREATE TRIGGER set_updated_at_diario BEFORE UPDATE ON public.diario_entradas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- CONFIGURAÃ‡Ã•ES DA EMPRESA
-- ============================================================

CREATE TABLE public.configuracoes_empresa (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome_fantasia TEXT DEFAULT 'Sistema Cajado',
  razao_social TEXT,
  cnpj TEXT,
  inscricao_estadual TEXT,
  email_suporte TEXT,
  whatsapp_principal TEXT,
  website TEXT,
  cep TEXT,
  logradouro TEXT,
  numero TEXT,
  bairro TEXT,
  cidade_estado TEXT,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.configuracoes_empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados conf_empresa" ON public.configuracoes_empresa
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE TRIGGER set_updated_at_conf_empresa BEFORE UPDATE ON public.configuracoes_empresa
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- FUNCIONÃRIOS
-- ============================================================

CREATE TABLE public.funcionarios (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  cargo TEXT,
  permissoes TEXT[] DEFAULT '{}',
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.funcionarios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados funcionarios" ON public.funcionarios
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE TRIGGER set_updated_at_funcionarios BEFORE UPDATE ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- GESTÃƒO DE EQUIPE
-- ============================================================

CREATE TABLE public.tarefas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'a_fazer' CHECK (status IN ('a_fazer','em_andamento','concluida','cancelada')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','urgente')),
  responsavel_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  data_vencimento DATE,
  created_by UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados tarefas" ON public.tarefas
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE TRIGGER set_updated_at_tarefas BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.ocorrencias (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tipo TEXT NOT NULL DEFAULT 'outro' CHECK (tipo IN ('erro','acerto','advertencia','elogio','outro')),
  descricao TEXT NOT NULL,
  colaborador_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  resolvida BOOLEAN DEFAULT FALSE,
  resolucao TEXT,
  registrado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados ocorrencias" ON public.ocorrencias
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE TRIGGER set_updated_at_ocorrencias BEFORE UPDATE ON public.ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.registros_ponto (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  colaborador_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','pausa','retorno')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  observacao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados registros_ponto" ON public.registros_ponto
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_ponto_colaborador ON public.registros_ponto(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_ponto_timestamp ON public.registros_ponto(timestamp);


-- -------------------------------------------------------------
-- MIGRATION: 003_rbac_roles.sql
-- -------------------------------------------------------------

-- ============================================================
-- SISTEMA CAJADO - MIGRATION 003
-- RBAC: Roles, User Roles e dados iniciais de roles
-- ============================================================

-- Roles disponÃ­veis no sistema
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,
  descricao TEXT,
  permissoes TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura de roles para autenticados" ON public.roles
  FOR SELECT TO authenticated USING (TRUE);

-- VÃ­nculo usuÃ¡rio â†” role
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Acesso total autenticados user_roles" ON public.user_roles
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ============================================================
-- Dados iniciais de Roles
-- ============================================================

INSERT INTO public.roles (nome, descricao, permissoes) VALUES
  ('admin', 'Administrador com acesso irrestrito', ARRAY[
    'financeiro','comissoes','inbox','cajado','vendas','pos-venda',
    'seguranca-wa','expansao','inteligencia','organizacao','diario',
    'gestao-pessoal','pf-pessoal','patrimonio','investimentos','trader',
    'seguranca-geral','configuracoes'
  ]),
  ('gestor', 'Gestor com acesso ao comercial e financeiro', ARRAY[
    'financeiro','cajado','vendas','pos-venda','inbox','organizacao','diario'
  ]),
  ('atendente', 'Atendente com acesso ao CRM e WhatsApp', ARRAY[
    'inbox','cajado','vendas','pos-venda','organizacao'
  ]),
  ('financeiro', 'Analista financeiro', ARRAY[
    'financeiro','comissoes','organizacao'
  ]),
  ('visualizacao', 'Somente leitura nos mÃ³dulos permitidos', ARRAY[
    'cajado','vendas'
  ])
ON CONFLICT (nome) DO NOTHING;


-- -------------------------------------------------------------
-- MIGRATION: 004_agenda_pessoal.sql
-- -------------------------------------------------------------

-- ============================================================
-- SISTEMA CAJADO - MIGRATION 004
-- Agenda Pessoal: compromissos, lembretes, notas rÃ¡pidas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.agenda_eventos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  tipo TEXT NOT NULL DEFAULT 'compromisso'
    CHECK (tipo IN ('compromisso','lembrete','nota','tarefa','aniversario','reuniao')),
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ,
  dia_inteiro BOOLEAN DEFAULT FALSE,
  recorrencia TEXT DEFAULT 'nenhuma'
    CHECK (recorrencia IN ('nenhuma','diaria','semanal','mensal','anual')),
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente','concluido','cancelado')),
  prioridade TEXT NOT NULL DEFAULT 'normal'
    CHECK (prioridade IN ('baixa','normal','alta','urgente')),
  cor TEXT DEFAULT '#f5a623',
  lembrete_minutos INTEGER, -- ex: 30 = lembrar 30 min antes
  origem TEXT DEFAULT 'manual'
    CHECK (origem IN ('manual','voz','ia','sistema')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agenda_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario ve e edita proprios eventos" ON public.agenda_eventos
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER set_updated_at_agenda BEFORE UPDATE ON public.agenda_eventos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE INDEX idx_agenda_user_data ON public.agenda_eventos(user_id, data_inicio);
CREATE INDEX idx_agenda_status ON public.agenda_eventos(status, data_inicio);


-- -------------------------------------------------------------
-- MIGRATION: 005_elena_historico.sql
-- -------------------------------------------------------------

-- ============================================================
-- SISTEMA CAJADO - MIGRATION 005
-- HistÃ³rico de conversas com a Elena (Assistente IA)
-- Permite resumo, memÃ³ria e contexto persistente
-- ============================================================

CREATE TABLE IF NOT EXISTS public.elena_conversas (
  id          UUID         DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id     UUID         REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  role        TEXT         NOT NULL CHECK (role IN ('user', 'ai')),
  texto       TEXT         NOT NULL,
  acoes       JSONB,                         -- aÃ§Ãµes estruturadas registradas nesta msg
  sessao_id   TEXT,                          -- agrupa mensagens por sessÃ£o (dia/contexto)
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- Ãndices para performance
CREATE INDEX idx_elena_user_data    ON public.elena_conversas(user_id, created_at DESC);
CREATE INDEX idx_elena_sessao       ON public.elena_conversas(sessao_id, created_at);

-- RLS: cada usuÃ¡rio vÃª apenas seu prÃ³prio histÃ³rico
ALTER TABLE public.elena_conversas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve proprio historico Elena"
  ON public.elena_conversas FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- -------------------------------------------------------------
-- MIGRATION: 006_chat_interno.sql
-- -------------------------------------------------------------

-- ============================================================
-- Migration 006: Chat Interno da Equipe
-- ============================================================

-- Tabela de mensagens do chat interno
CREATE TABLE IF NOT EXISTS public.chat_interno (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  remetente_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  destinatario_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- NULL = mensagem para o canal geral
  texto            text,
  audio_base64     text, -- Ã¡udio em base64 (data URI)
  created_at       timestamptz DEFAULT now() NOT NULL,

  -- Pelo menos texto ou Ã¡udio deve estar preenchido
  CONSTRAINT chat_tem_conteudo CHECK (texto IS NOT NULL OR audio_base64 IS NOT NULL)
);

-- Ãndices para performance
CREATE INDEX IF NOT EXISTS idx_chat_remetente   ON public.chat_interno(remetente_id);
CREATE INDEX IF NOT EXISTS idx_chat_destinatario ON public.chat_interno(destinatario_id);
CREATE INDEX IF NOT EXISTS idx_chat_created_at  ON public.chat_interno(created_at DESC);

-- â”€â”€ Row Level Security â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
ALTER TABLE public.chat_interno ENABLE ROW LEVEL SECURITY;

-- UsuÃ¡rios autenticados podem ler:
--   - Mensagens do canal geral (destinatario_id IS NULL)
--   - Mensagens que enviaram
--   - Mensagens que receberam (mensagens diretas para eles)
CREATE POLICY "chat_select" ON public.chat_interno
  FOR SELECT
  TO authenticated
  USING (
    destinatario_id IS NULL
    OR remetente_id   = auth.uid()
    OR destinatario_id = auth.uid()
  );

-- UsuÃ¡rios autenticados sÃ³ inserem mensagens em que sÃ£o o remetente
CREATE POLICY "chat_insert" ON public.chat_interno
  FOR INSERT
  TO authenticated
  WITH CHECK (remetente_id = auth.uid());

-- NinguÃ©m pode editar mensagens antigas
-- (sem policy UPDATE/DELETE â€” mensagens sÃ£o imutÃ¡veis)

-- â”€â”€ Realtime â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Habilitar Realtime para a tabela (replication)
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_interno;


-- -------------------------------------------------------------
-- MIGRATION: 007_vw_usuarios_chat.sql
-- -------------------------------------------------------------

-- ============================================================
-- Migration 007: View de Usuarios para o Chat
-- ============================================================

-- Cria uma view segura para ler nomes de todos os usuarios do auth.users
-- Isso resolve o problema de administradores ou usuarios sem registro
-- na tabela "funcionarios" aparecerem como "Desconhecido" no chat.

CREATE OR REPLACE VIEW public.vw_usuarios_chat AS
SELECT 
    id,
    COALESCE(
        raw_user_meta_data->>'nome', 
        raw_user_meta_data->>'name', 
        split_part(email, '@', 1)
    ) as nome,
    email
FROM auth.users;

-- DÃ¡ permissÃ£o de select na view para usuÃ¡rios autenticados
GRANT SELECT ON public.vw_usuarios_chat TO authenticated;


-- -------------------------------------------------------------
-- MIGRATION: 008_limpar_dados_ficticios.sql
-- -------------------------------------------------------------

-- ============================================================
-- Migration 008: FunÃ§Ã£o para limpar dados fictÃ­cios/demo
-- ============================================================
-- Remove registros transacionais criados ANTES de uma data de corte,
-- preservando configuraÃ§Ãµes, contas, produtos e estrutura do sistema.
-- SÃ³ pode ser chamada por usuÃ¡rios autenticados (SECURITY DEFINER).

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
  -- â”€â”€ Financeiro Empresa â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DELETE FROM public.lancamentos
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_lancamentos = ROW_COUNT;

  -- â”€â”€ CRM / Vendas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DELETE FROM public.leads
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_leads = ROW_COUNT;

  -- â”€â”€ Equipe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DELETE FROM public.ocorrencias
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_ocorrencias = ROW_COUNT;

  -- â”€â”€ Chat Interno â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DELETE FROM public.chat_interno
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_chat = ROW_COUNT;

  -- â”€â”€ FinanÃ§as Pessoais â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DELETE FROM public.gastos_pessoais
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_gastos_pf = ROW_COUNT;

  DELETE FROM public.receitas_pessoais
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_receitas_pf = ROW_COUNT;

  -- â”€â”€ Agenda â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DELETE FROM public.agenda_eventos
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_agenda = ROW_COUNT;

  -- â”€â”€ Elena (IA) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  DELETE FROM public.elena_conversas
    WHERE created_at < data_corte;
  DELETE FROM public.elena_ideias
    WHERE created_at < data_corte;
  GET DIAGNOSTICS n_elena = ROW_COUNT;

  -- â”€â”€ Trader â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  -- Tenta deletar de operacoes_trader (pode nÃ£o existir em todas as instÃ¢ncias)
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

-- PermissÃ£o apenas para usuÃ¡rios autenticados
GRANT EXECUTE ON FUNCTION public.limpar_dados_ficticios(timestamptz) TO authenticated;

-- â”€â”€ O QUE NÃƒO Ã‰ DELETADO â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- âœ… funcionarios     â€” equipe e acessos
-- âœ… clientes         â€” carteira de clientes
-- âœ… produtos         â€” catÃ¡logo de produtos
-- âœ… contas           â€” contas bancÃ¡rias
-- âœ… categorias       â€” categorias financeiras
-- âœ… configuracoes_empresa â€” dados da empresa


-- -------------------------------------------------------------
-- MIGRATION: 009_backup_config.sql
-- -------------------------------------------------------------

-- ============================================================
-- Migration 009: Tabela de configuraÃ§Ã£o de Backup
-- ============================================================

CREATE TABLE IF NOT EXISTS public.configuracoes_backup (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_email   text,
  frequencia     text DEFAULT 'semanal'
                  CHECK (frequencia IN ('diario', 'semanal', 'mensal', 'manual')),
  ativo          boolean DEFAULT true,
  ultimo_backup  timestamptz,
  proximo_backup timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS
ALTER TABLE public.configuracoes_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario ve propria config" ON public.configuracoes_backup
  FOR ALL USING (auth.uid() = user_id);

GRANT ALL ON public.configuracoes_backup TO authenticated;


-- -------------------------------------------------------------
-- MIGRATION: 010_elena_registros_genericos.sql
-- -------------------------------------------------------------

-- ================================================================
-- Migration 010: Tabela genÃ©rica de registros da Elena (fallback)
-- Armazena qualquer tipo de lanÃ§amento que nÃ£o se encaixe nas
-- tabelas especializadas (gastos, receitas, agenda, ideias etc.)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.elena_registros (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo        TEXT        NOT NULL DEFAULT 'geral',   -- ex: nota, lembrete, contrato, emprestimo, etc.
  titulo      TEXT        NOT NULL,
  descricao   TEXT,
  valor       NUMERIC(12,2),
  data        DATE        NOT NULL DEFAULT CURRENT_DATE,
  metadados   JSONB,                                  -- JSON completo da aÃ§Ã£o para nÃ£o perder nenhum dado
  origem      TEXT        NOT NULL DEFAULT 'elena',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS
ALTER TABLE public.elena_registros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuarios_proprio_registro"
  ON public.elena_registros
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ãndices
CREATE INDEX IF NOT EXISTS idx_elena_registros_user    ON public.elena_registros(user_id);
CREATE INDEX IF NOT EXISTS idx_elena_registros_tipo    ON public.elena_registros(tipo);
CREATE INDEX IF NOT EXISTS idx_elena_registros_data    ON public.elena_registros(data DESC);


-- -------------------------------------------------------------
-- MIGRATION: 011_cartoes_limite_gasto.sql
-- -------------------------------------------------------------

-- Migration: Adicionar campo limite_gasto_mensal na tabela contas
-- Executar no Supabase SQL Editor

ALTER TABLE contas ADD COLUMN IF NOT EXISTS limite_gasto_mensal numeric(12,2) DEFAULT NULL;

COMMENT ON COLUMN contas.limite_gasto_mensal IS 'Limite de gasto mensal definido pelo cliente para controle de gastos do cartÃ£o. Gera alertas ao atingir 80% e 100%.';


-- -------------------------------------------------------------
-- MIGRATION: 012_elena_ideias.sql
-- -------------------------------------------------------------

-- ================================================================
-- Migration 012: Tabela de Ideias da Elena
-- Armazena ideias capturadas via IA ou formulÃ¡rio manual
-- ================================================================

CREATE TABLE IF NOT EXISTS public.elena_ideias (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  titulo      TEXT        NOT NULL,
  descricao   TEXT,
  categoria   TEXT        NOT NULL DEFAULT 'geral'
                          CHECK (categoria IN ('negocio','produto','pessoal','financeiro','saude','criativo','geral')),
  status      TEXT        NOT NULL DEFAULT 'rascunho'
                          CHECK (status IN ('rascunho','desenvolvendo','validando','concluida','arquivada')),
  progresso   INTEGER     NOT NULL DEFAULT 0 CHECK (progresso BETWEEN 0 AND 100),
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: cada usuÃ¡rio vÃª apenas suas prÃ³prias ideias
ALTER TABLE public.elena_ideias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_propria_ideia"
  ON public.elena_ideias
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Ãndices para performance
CREATE INDEX IF NOT EXISTS idx_elena_ideias_user     ON public.elena_ideias(user_id);
CREATE INDEX IF NOT EXISTS idx_elena_ideias_status   ON public.elena_ideias(status);
CREATE INDEX IF NOT EXISTS idx_elena_ideias_created  ON public.elena_ideias(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER set_elena_ideias_updated_at
  BEFORE UPDATE ON public.elena_ideias
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- -------------------------------------------------------------
-- MIGRATION: 013_limites_orcamento.sql
-- -------------------------------------------------------------

-- ================================================================
-- 013_limites_orcamento.sql
-- Limites mensais de orÃ§amento para alertas PF e PJ
-- ================================================================

CREATE TABLE IF NOT EXISTS public.limites_orcamento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome          text NOT NULL,                  -- Ex: "PrÃ³-labore", "AlimentaÃ§Ã£o", "Operacional"
  categoria     text NOT NULL DEFAULT 'geral',  -- Ex: "prolabore", "alimentacao", "pessoal", "empresa"
  tipo          text NOT NULL DEFAULT 'pf',     -- 'pf' ou 'pj'
  limite_mensal numeric(12,2) NOT NULL DEFAULT 0,
  cor           text DEFAULT '#10B981',
  ativo         boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.limites_orcamento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_own_limites" ON public.limites_orcamento
  FOR ALL USING (auth.uid() = user_id);

-- Ãndice para queries frequentes
CREATE INDEX IF NOT EXISTS idx_limites_user_tipo ON public.limites_orcamento(user_id, tipo, ativo);


-- -------------------------------------------------------------
-- MIGRATION: 014_multi_tenant_empresa_id.sql
-- -------------------------------------------------------------

-- ============================================================
-- SISTEMA CAJADO - MIGRATION 014
-- Multi-Tenant: Isolamento por empresa_id
-- Cada cliente/empresa sÃ³ acessa seus prÃ³prios dados via RLS
-- ============================================================

-- ============================================================
-- 1. TABELA DE EMPRESAS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.empresas (
  id           UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome         TEXT NOT NULL DEFAULT 'Minha Empresa',
  cnpj         TEXT,
  email        TEXT,
  telefone     TEXT,
  plano        TEXT NOT NULL DEFAULT 'trial' CHECK (plano IN ('trial','basico','pro','enterprise')),
  trial_ate    TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '5 days'),
  ativo        BOOLEAN DEFAULT TRUE,
  owner_id     UUID,  -- FK para perfis, adicionada depois
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER set_updated_at_empresas BEFORE UPDATE ON public.empresas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 2. ADICIONAR empresa_id em PERFIS
-- ============================================================

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

-- FK reversa: empresas.owner_id â†’ perfis
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_owner_fk
  FOREIGN KEY (owner_id) REFERENCES public.perfis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_perfis_empresa ON public.perfis(empresa_id);

-- ============================================================
-- 3. FUNÃ‡ÃƒO: retorna empresa_id do usuÃ¡rio atual
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM public.perfis WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 4. CRIAR EMPRESA PADRÃƒO E MIGRAR DADOS EXISTENTES
-- ============================================================

DO $$
DECLARE
  v_empresa_id UUID;
  v_owner_id   UUID;
BEGIN
  -- Pega o primeiro usuÃ¡rio cadastrado (admin/dono da plataforma)
  SELECT id INTO v_owner_id FROM public.perfis ORDER BY created_at ASC LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  -- Cria empresa padrÃ£o para dados existentes
  INSERT INTO public.empresas (nome, plano, owner_id)
  VALUES ('Cajado Admin', 'enterprise', v_owner_id)
  RETURNING id INTO v_empresa_id;

  -- Atribui todos os perfis existentes a esta empresa
  UPDATE public.perfis SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;

  -- Atualiza owner_id
  UPDATE public.empresas SET owner_id = v_owner_id WHERE id = v_empresa_id;
END;
$$;

-- ============================================================
-- 5. ADICIONAR empresa_id EM TODAS AS TABELAS DE NEGÃ“CIO
-- ============================================================

-- Financeiro
ALTER TABLE public.contas                ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.categorias_financeiras ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.recorrencias          ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.lancamentos           ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.conciliacao_extrato   ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- CRM / Comercial
ALTER TABLE public.leads                 ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.atividades            ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.parceiros             ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.mensagens_padrao      ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.campanhas             ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- Operacional
ALTER TABLE public.checkins              ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.relatorio_diario      ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.numeros_whatsapp      ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.backup_contatos       ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- OrganizaÃ§Ã£o
ALTER TABLE public.projetos              ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.ideias                ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.decisoes              ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- Trader / Investimentos
ALTER TABLE public.regras_risco          ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.operacoes             ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.ativos                ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.movimentacoes_ativos  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.projetos_patrimonio   ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.custos_patrimonio     ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- InteligÃªncia
ALTER TABLE public.analises_mercado      ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.tendencias            ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- Clientes / Vendas (migration 002)
ALTER TABLE public.clientes              ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.produtos              ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.vendas                ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.itens_venda           ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.parcelas_venda        ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.templates_pos_venda   ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.disparos_pos_venda    ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- GestÃ£o interna
ALTER TABLE public.diario_entradas       ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.configuracoes_empresa ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.funcionarios          ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.tarefas               ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.ocorrencias           ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.registros_ponto       ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- RBAC
ALTER TABLE public.user_roles            ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- Logs
ALTER TABLE public.log_acesso            ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);
ALTER TABLE public.audit_log             ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id);

-- ============================================================
-- 6. POPULAR empresa_id NOS DADOS EXISTENTES
--    (tudo fica na empresa padrÃ£o criada acima)
-- ============================================================

DO $$
DECLARE
  v_empresa_id UUID;
BEGIN
  SELECT id INTO v_empresa_id FROM public.empresas ORDER BY created_at ASC LIMIT 1;
  IF v_empresa_id IS NULL THEN RETURN; END IF;

  UPDATE public.contas                SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.categorias_financeiras SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.recorrencias          SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.lancamentos           SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.conciliacao_extrato   SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.leads                 SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.atividades            SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.parceiros             SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.mensagens_padrao      SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.campanhas             SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.checkins              SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.relatorio_diario      SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.numeros_whatsapp      SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.backup_contatos       SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.projetos              SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.ideias                SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.decisoes              SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.regras_risco          SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.operacoes             SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.ativos                SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.movimentacoes_ativos  SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.projetos_patrimonio   SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.custos_patrimonio     SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.analises_mercado      SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.tendencias            SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.clientes              SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.produtos              SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.vendas                SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.itens_venda           SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.parcelas_venda        SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.templates_pos_venda   SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.disparos_pos_venda    SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.diario_entradas       SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.configuracoes_empresa SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.funcionarios          SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.tarefas               SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.ocorrencias           SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.registros_ponto       SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.user_roles            SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.log_acesso            SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
  UPDATE public.audit_log             SET empresa_id = v_empresa_id WHERE empresa_id IS NULL;
END;
$$;

-- ============================================================
-- 7. ÃNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_contas_empresa               ON public.contas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_lancamentos_empresa           ON public.lancamentos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_leads_empresa                 ON public.leads(empresa_id);
CREATE INDEX IF NOT EXISTS idx_clientes_empresa              ON public.clientes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_vendas_empresa                ON public.vendas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_produtos_empresa              ON public.produtos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_empresa               ON public.tarefas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_diario_empresa                ON public.diario_entradas(empresa_id);
CREATE INDEX IF NOT EXISTS idx_numeros_whatsapp_empresa      ON public.numeros_whatsapp(empresa_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_empresa            ON public.user_roles(empresa_id);

-- ============================================================
-- 8. ATUALIZAR POLÃTICAS RLS â€” FILTRAR POR empresa_id
-- ============================================================

-- Helper: dropa e recria policy
-- CONTAS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.contas;
CREATE POLICY "Isolamento por empresa" ON public.contas
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CATEGORIAS FINANCEIRAS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.categorias_financeiras;
CREATE POLICY "Isolamento por empresa" ON public.categorias_financeiras
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- RECORRÃŠNCIAS
ALTER TABLE public.recorrencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.recorrencias;
CREATE POLICY "Isolamento por empresa" ON public.recorrencias
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- LANÃ‡AMENTOS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.lancamentos;
CREATE POLICY "Isolamento por empresa" ON public.lancamentos
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CONCILIAÃ‡ÃƒO
ALTER TABLE public.conciliacao_extrato ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.conciliacao_extrato;
CREATE POLICY "Isolamento por empresa" ON public.conciliacao_extrato
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- LEADS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.leads;
CREATE POLICY "Isolamento por empresa" ON public.leads
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- ATIVIDADES
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.atividades;
CREATE POLICY "Isolamento por empresa" ON public.atividades
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- PARCEIROS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.parceiros;
CREATE POLICY "Isolamento por empresa" ON public.parceiros
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- MENSAGENS PADRÃƒO
ALTER TABLE public.mensagens_padrao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.mensagens_padrao;
CREATE POLICY "Isolamento por empresa" ON public.mensagens_padrao
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CAMPANHAS
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.campanhas;
CREATE POLICY "Isolamento por empresa" ON public.campanhas
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CHECKINS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.checkins;
CREATE POLICY "Isolamento por empresa" ON public.checkins
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- NÃšMEROS WHATSAPP
ALTER TABLE public.numeros_whatsapp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.numeros_whatsapp;
CREATE POLICY "Isolamento por empresa" ON public.numeros_whatsapp
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- BACKUP CONTATOS (via whatsapp)
ALTER TABLE public.backup_contatos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.backup_contatos;
CREATE POLICY "Isolamento por empresa" ON public.backup_contatos
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- PROJETOS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.projetos;
CREATE POLICY "Isolamento por empresa" ON public.projetos
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- IDEIAS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.ideias;
CREATE POLICY "Isolamento por empresa" ON public.ideias
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- DECISÃ•ES
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.decisoes;
CREATE POLICY "Isolamento por empresa" ON public.decisoes
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- OPERAÃ‡Ã•ES TRADER
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.operacoes;
CREATE POLICY "Isolamento por empresa" ON public.operacoes
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- ATIVOS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.ativos;
CREATE POLICY "Isolamento por empresa" ON public.ativos
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- PROJETOS PATRIMÃ”NIO
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.projetos_patrimonio;
CREATE POLICY "Isolamento por empresa" ON public.projetos_patrimonio
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- ANÃLISES MERCADO
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.analises_mercado;
CREATE POLICY "Isolamento por empresa" ON public.analises_mercado
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- TENDÃŠNCIAS
DROP POLICY IF EXISTS "UsuÃ¡rios autenticados tÃªm acesso total" ON public.tendencias;
CREATE POLICY "Isolamento por empresa" ON public.tendencias
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CLIENTES
DROP POLICY IF EXISTS "Acesso total autenticados clientes" ON public.clientes;
CREATE POLICY "Isolamento por empresa" ON public.clientes
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- PRODUTOS
DROP POLICY IF EXISTS "Acesso total autenticados produtos" ON public.produtos;
CREATE POLICY "Isolamento por empresa" ON public.produtos
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- VENDAS
DROP POLICY IF EXISTS "Acesso total autenticados vendas" ON public.vendas;
CREATE POLICY "Isolamento por empresa" ON public.vendas
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- ITENS VENDA (via venda_id)
DROP POLICY IF EXISTS "Acesso total autenticados itens_venda" ON public.itens_venda;
CREATE POLICY "Isolamento por empresa" ON public.itens_venda
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- PARCELAS VENDA
DROP POLICY IF EXISTS "Acesso total autenticados parcelas_venda" ON public.parcelas_venda;
CREATE POLICY "Isolamento por empresa" ON public.parcelas_venda
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- TEMPLATES PÃ“S-VENDA
DROP POLICY IF EXISTS "Acesso total autenticados templates_pos_venda" ON public.templates_pos_venda;
CREATE POLICY "Isolamento por empresa" ON public.templates_pos_venda
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- DISPAROS PÃ“S-VENDA
DROP POLICY IF EXISTS "Acesso total autenticados disparos_pos_venda" ON public.disparos_pos_venda;
CREATE POLICY "Isolamento por empresa" ON public.disparos_pos_venda
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- DIÃRIO
DROP POLICY IF EXISTS "Acesso total autenticados diario_entradas" ON public.diario_entradas;
CREATE POLICY "Isolamento por empresa" ON public.diario_entradas
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CONFIGURAÃ‡Ã•ES EMPRESA
DROP POLICY IF EXISTS "Acesso total autenticados conf_empresa" ON public.configuracoes_empresa;
CREATE POLICY "Isolamento por empresa" ON public.configuracoes_empresa
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- FUNCIONÃRIOS
DROP POLICY IF EXISTS "Acesso total autenticados funcionarios" ON public.funcionarios;
CREATE POLICY "Isolamento por empresa" ON public.funcionarios
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- TAREFAS
DROP POLICY IF EXISTS "Acesso total autenticados tarefas" ON public.tarefas;
CREATE POLICY "Isolamento por empresa" ON public.tarefas
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- OCORRÃŠNCIAS
DROP POLICY IF EXISTS "Acesso total autenticados ocorrencias" ON public.ocorrencias;
CREATE POLICY "Isolamento por empresa" ON public.ocorrencias
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- REGISTROS PONTO
DROP POLICY IF EXISTS "Acesso total autenticados registros_ponto" ON public.registros_ponto;
CREATE POLICY "Isolamento por empresa" ON public.registros_ponto
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- USER ROLES
DROP POLICY IF EXISTS "Acesso total autenticados user_roles" ON public.user_roles;
CREATE POLICY "Isolamento por empresa" ON public.user_roles
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- LOGS
DROP POLICY IF EXISTS "Leitura de auditoria" ON public.log_acesso;
DROP POLICY IF EXISTS "InserÃ§Ã£o de auditoria" ON public.log_acesso;
CREATE POLICY "Isolamento por empresa" ON public.log_acesso
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS "Leitura de audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "InserÃ§Ã£o de audit_log" ON public.audit_log;
CREATE POLICY "Isolamento por empresa" ON public.audit_log
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- EMPRESAS: cada usuÃ¡rio vÃª somente a prÃ³pria empresa
CREATE POLICY "Usuario ve propria empresa" ON public.empresas
  FOR ALL TO authenticated
  USING  (id = public.get_empresa_id())
  WITH CHECK (id = public.get_empresa_id());

-- PERFIS: usuÃ¡rio vÃª todos da mesma empresa (para chat interno, menÃ§Ãµes etc.)
DROP POLICY IF EXISTS "UsuÃ¡rio vÃª e edita o prÃ³prio perfil" ON public.perfis;
CREATE POLICY "Perfis da mesma empresa" ON public.perfis
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());
CREATE POLICY "Edita proprio perfil" ON public.perfis
  FOR ALL TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 9. ATUALIZAR handle_new_user â€” criar empresa automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_empresa_id UUID;
  v_nome       TEXT;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));

  -- Cria empresa para o novo usuÃ¡rio
  INSERT INTO public.empresas (nome, plano, trial_ate)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'empresa_nome', v_nome || ' - Empresa'),
    'trial',
    NOW() + INTERVAL '5 days'
  )
  RETURNING id INTO v_empresa_id;

  -- Cria perfil vinculado Ã  empresa
  INSERT INTO public.perfis (id, nome, email, empresa_id)
  VALUES (NEW.id, v_nome, NEW.email, v_empresa_id);

  -- Atualiza owner da empresa
  UPDATE public.empresas SET owner_id = NEW.id WHERE id = v_empresa_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. CONSTRAINT NOT NULL (apÃ³s popular dados existentes)
-- ============================================================

-- Tabelas principais: empresa_id obrigatÃ³rio
ALTER TABLE public.contas                ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.lancamentos           ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.leads                 ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.clientes              ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.vendas                ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.produtos              ALTER COLUMN empresa_id SET NOT NULL;


-- -------------------------------------------------------------
-- MIGRATION: 015_auto_empresa_id_trigger.sql
-- -------------------------------------------------------------

-- ============================================================
-- SISTEMA CAJADO - MIGRATION 015
-- Trigger: preenche empresa_id automaticamente em todos os INSERTs
-- O frontend nÃ£o precisa enviar empresa_id â€” o banco preenche sozinho
-- ============================================================

-- FunÃ§Ã£o genÃ©rica usada por todos os triggers
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
-- (PostgreSQL nÃ£o suporta dynamic DDL em funÃ§Ãµes, entÃ£o listamos manualmente)

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

-- OrganizaÃ§Ã£o
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

-- InteligÃªncia
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

-- GestÃ£o interna
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


-- -------------------------------------------------------------
-- MIGRATION: 016_patrimonio_parcelas.sql
-- -------------------------------------------------------------

-- SISTEMA CAJADO - MIGRATION 016
-- Adiciona colunas de parcelamento na tabela projetos_patrimonio

ALTER TABLE public.projetos_patrimonio
  ADD COLUMN IF NOT EXISTS parcelas_total INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcelas_pagas INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.projetos_patrimonio.parcelas_total IS 'NÃºmero total de parcelas do financiamento (ex: 60 para 5 anos)';
COMMENT ON COLUMN public.projetos_patrimonio.parcelas_pagas IS 'Quantas parcelas jÃ¡ foram pagas atÃ© hoje';


-- -------------------------------------------------------------
-- MIGRATION: 017_gastos_pessoais_parcelas.sql
-- -------------------------------------------------------------

-- ============================================================
-- Migration 017: Adiciona coluna 'parcelas' em gastos_pessoais
-- Para rastrear compras parceladas no cartÃ£o de crÃ©dito
-- ============================================================

ALTER TABLE public.gastos_pessoais
  ADD COLUMN IF NOT EXISTS parcelas INTEGER DEFAULT NULL
    CHECK (parcelas IS NULL OR (parcelas >= 1 AND parcelas <= 96));

-- Ãndice para filtrar gastos parcelados facilmente
CREATE INDEX IF NOT EXISTS idx_gastos_pessoais_parcelas
  ON public.gastos_pessoais(parcelas)
  WHERE parcelas IS NOT NULL;

-- ComentÃ¡rio de documentaÃ§Ã£o
COMMENT ON COLUMN public.gastos_pessoais.parcelas IS
  'NÃºmero total de parcelas (cartÃ£o de crÃ©dito). NULL = Ã  vista.';


-- -------------------------------------------------------------
-- MIGRATION: 018_isolamento_contas_pf.sql
-- -------------------------------------------------------------

-- ============================================================
-- SISTEMA CAJADO - MIGRATION 018
-- Isola cartÃµes e contas da categoria PF por usuÃ¡rio
-- ============================================================

-- 1. Adiciona coluna user_id
ALTER TABLE public.contas 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Trigger para preencher user_id automaticamente caso seja PF e nÃ£o venha preenchido
CREATE OR REPLACE FUNCTION public.set_conta_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.categoria = 'pf' AND NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_conta_user_id ON public.contas;
CREATE TRIGGER trg_set_conta_user_id
  BEFORE INSERT ON public.contas
  FOR EACH ROW EXECUTE FUNCTION public.set_conta_user_id();

-- 3. Atualizar as contas PF existentes para nÃ£o sumirem da interface
-- Atribuimos os cartÃµes PF Ã³rfÃ£os para o Dono da Empresa (owner_id)
UPDATE public.contas c
SET user_id = e.owner_id
FROM public.empresas e
WHERE c.empresa_id = e.id AND c.categoria = 'pf' AND c.user_id IS NULL;

-- 4. Atualizar a RLS da tabela de contas
DROP POLICY IF EXISTS "Isolamento por empresa" ON public.contas;
DROP POLICY IF EXISTS "Isolamento de contas PJ e PF" ON public.contas;

-- A polÃ­tica agora diz:
-- - Contas PJ: AcessÃ­veis por todos da mesma empresa
-- - Contas PF: AcessÃ­veis apenas se o user_id for o do usuÃ¡rio logado
CREATE POLICY "Isolamento de contas PJ e PF" ON public.contas
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_empresa_id() 
    AND (categoria = 'pj' OR user_id = auth.uid())
  )
  WITH CHECK (
    empresa_id = public.get_empresa_id() 
    AND (categoria = 'pj' OR user_id = auth.uid())
  );


-- -------------------------------------------------------------
-- MIGRATION: 019_orcamentos_pessoais.sql
-- -------------------------------------------------------------

-- ================================================================
-- SISTEMA CAJADO - MIGRATION 019
-- Tabela para os limites de orcamento mensais por categoria do PF
-- ================================================================

CREATE TABLE IF NOT EXISTS public.orcamentos_pessoais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  categoria text NOT NULL,
  valor_limite numeric(12,2) NOT NULL DEFAULT 0,
  mes_referencia text NOT NULL, -- Ex: '2026-05'
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Ativar RLS
ALTER TABLE public.orcamentos_pessoais ENABLE ROW LEVEL SECURITY;

-- Garantir que o usuario so veja/edite os proprios orÃ§amentos
CREATE POLICY "Isolamento por usuario" ON public.orcamentos_pessoais
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indice para evitar duplicidade da mesma categoria no mesmo mes
CREATE UNIQUE INDEX IF NOT EXISTS idx_orcamentos_categoria_mes 
  ON public.orcamentos_pessoais(user_id, categoria, mes_referencia);


-- -------------------------------------------------------------
-- MIGRATION: 020_imoveis_veiculos_parcelamento.sql
-- -------------------------------------------------------------

-- ================================================================
-- SISTEMA CAJADO - MIGRATION 020
-- Adiciona parcelamento em imoveis e cria tabela veiculos
-- ================================================================

-- Campos adicionais de parcelamento / financiamento no imÃ³vel
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS construtora        text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS unidade            text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_total_contrato numeric(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS valor_parcela       numeric(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcelas_total      integer       DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS parcelas_pagas      integer       DEFAULT 0,
  ADD COLUMN IF NOT EXISTS indexador           text          DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS data_aquisicao      date          DEFAULT NULL;

-- ================================================================
-- Tabela de VeÃ­culos
-- ================================================================
CREATE TABLE IF NOT EXISTS public.veiculos (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       uuid          REFERENCES public.empresas(id) ON DELETE CASCADE,
  titulo           text          NOT NULL,
  marca            text,
  modelo           text,
  ano_fabricacao   integer,
  ano_modelo       integer,
  placa            text,
  cor              text,
  combustivel      text          DEFAULT 'flex',
  km_atual         integer,
  valor_compra     numeric(12,2),
  valor_mercado    numeric(12,2),
  -- Financiamento
  financiado       boolean       DEFAULT false,
  banco_financiador text,
  valor_total_financiado numeric(12,2),
  valor_parcela    numeric(12,2),
  parcelas_total   integer,
  parcelas_pagas   integer       DEFAULT 0,
  vencimento_dia   integer,
  -- Status
  status           text          DEFAULT 'ativo'
                   CHECK (status IN ('ativo','vendido','sinistro','em_manutencao')),
  criado_em        timestamptz   DEFAULT now()
);

ALTER TABLE public.veiculos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "empresa_veiculos" ON public.veiculos
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_veiculos_empresa ON public.veiculos(empresa_id);


-- -------------------------------------------------------------
-- MIGRATION: 021_fix_rls_financiamentos_imoveis.sql
-- -------------------------------------------------------------

-- ================================================================
-- SISTEMA CAJADO - MIGRATION 021
-- Corrige RLS: remove politicas permissivas e adiciona isolamento
-- correto por empresa em financiamentos e imoveis
-- ================================================================

-- Remove politicas que permitiam acesso irrestrito a todos os usuarios
DROP POLICY IF EXISTS "auth_all"           ON public.contas;
DROP POLICY IF EXISTS "auth_all"           ON public.lancamentos;
DROP POLICY IF EXISTS "financiamentos_all" ON public.financiamentos;
DROP POLICY IF EXISTS "imoveis_all"        ON public.imoveis;

-- Financiamentos: isolamento correto por empresa
CREATE POLICY "financiamentos_por_empresa" ON public.financiamentos
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );

-- Imoveis: isolamento correto por empresa
CREATE POLICY "imoveis_por_empresa" ON public.imoveis
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );


-- -------------------------------------------------------------
-- MIGRATION: 023_trigger_empresa_id_imoveis.sql
-- -------------------------------------------------------------


-- Adiciona triggers de empresa_id para imoveis e financiamentos que faltaram na migration 015

DROP TRIGGER IF EXISTS trg_auto_empresa_imoveis ON public.imoveis;
CREATE TRIGGER trg_auto_empresa_imoveis
  BEFORE INSERT ON public.imoveis
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();

DROP TRIGGER IF EXISTS trg_auto_empresa_financiamentos ON public.financiamentos;
CREATE TRIGGER trg_auto_empresa_financiamentos
  BEFORE INSERT ON public.financiamentos
  FOR EACH ROW EXECUTE FUNCTION public.set_empresa_id_automatico();


-- -------------------------------------------------------------
-- MIGRATION: 024_fix_imoveis_empresa_id_fk.sql
-- -------------------------------------------------------------

-- ================================================================
-- MIGRATION 024 - Corrige FK imoveis.empresa_id
-- A FK estava apontando para perfis.id (errado)
-- Deve apontar para empresas.id (correto para multi-tenant)
-- ================================================================

-- 1. Remove a FK errada
ALTER TABLE public.imoveis DROP CONSTRAINT IF EXISTS imoveis_empresa_id_fkey;

-- 2. Atualiza registros existentes que tÃªm empresa_id = perfis.id
--    substituindo pelo empresa_id correto do perfil do usuÃ¡rio
UPDATE public.imoveis i
SET empresa_id = p.empresa_id
FROM public.perfis p
WHERE i.empresa_id = p.id;

-- 3. Remove registros com empresa_id ainda nulo ou invÃ¡lido (opcional - comentado por seguranÃ§a)
-- DELETE FROM public.imoveis WHERE empresa_id NOT IN (SELECT id FROM public.empresas);

-- 4. Adiciona a FK correta apontando para empresas.id
ALTER TABLE public.imoveis
  ADD CONSTRAINT imoveis_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

-- 5. Recria a RLS policy (garante consistÃªncia)
DROP POLICY IF EXISTS "imoveis_por_empresa" ON public.imoveis;
CREATE POLICY "imoveis_por_empresa" ON public.imoveis
  FOR ALL TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );


-- -------------------------------------------------------------
-- MIGRATION: 025_imoveis_vencimento_categoria.sql
-- -------------------------------------------------------------

-- ================================================================
-- MIGRATION 025 - Adiciona campos de vencimento e categoria
-- financeira nos imÃ³veis parcelados
-- ================================================================

-- Dia do mÃªs do vencimento da parcela (ex: 5, 10, 15, 20...)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31);

-- Categoria para lanÃ§amento no financeiro (texto livre ou nome da categoria)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS categoria_financeira TEXT DEFAULT 'Financiamento ImobiliÃ¡rio';

-- Conta padrÃ£o para lanÃ§ar a parcela (opcional - o usuÃ¡rio escolhe na hora)
ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS conta_id_padrao UUID REFERENCES public.contas(id) ON DELETE SET NULL;


-- -------------------------------------------------------------
-- MIGRATION: 026_financiamentos_expand.sql
-- -------------------------------------------------------------

-- ================================================================
-- MIGRATION 026 - Expande tabela financiamentos
-- Adiciona tipo, tÃ­tulo, anÃ¡lise de quitaÃ§Ã£o antecipada e campos IA
-- ================================================================

ALTER TABLE public.financiamentos
  ADD COLUMN IF NOT EXISTS titulo TEXT,
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'outro'
    CHECK (tipo IN ('imovel','automovel','carta_credito','consorcio','pessoal','outro')),
  ADD COLUMN IF NOT EXISTS taxa_juros_mensal DECIMAL(8,4),
  ADD COLUMN IF NOT EXISTS valor_entrada DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS valor_pago_total DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS saldo_devedor_atual DECIMAL(15,2),
  ADD COLUMN IF NOT EXISTS categoria_financeira TEXT DEFAULT 'Financiamento',
  ADD COLUMN IF NOT EXISTS data_inicio DATE,
  ADD COLUMN IF NOT EXISTS indexador TEXT,
  ADD COLUMN IF NOT EXISTS analise_ia TEXT,
  ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Renomeia vencimento_dia para dia_vencimento (padrÃ£o do sistema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='financiamentos' AND column_name='vencimento_dia') THEN
    ALTER TABLE public.financiamentos RENAME COLUMN vencimento_dia TO dia_vencimento;
  END IF;
END $$;

-- Renomeia prazo_meses para parcelas_total (padrÃ£o do sistema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='financiamentos' AND column_name='prazo_meses') THEN
    ALTER TABLE public.financiamentos RENAME COLUMN prazo_meses TO parcelas_total;
  END IF;
END $$;

-- Renomeia banco para credor
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='financiamentos' AND column_name='banco') THEN
    ALTER TABLE public.financiamentos RENAME COLUMN banco TO credor;
  END IF;
END $$;

-- Renomeia taxa_juros para taxa_juros_anual
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='financiamentos' AND column_name='taxa_juros') THEN
    ALTER TABLE public.financiamentos RENAME COLUMN taxa_juros TO taxa_juros_anual;
  END IF;
END $$;

-- Garante RLS
ALTER TABLE public.financiamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financiamentos_por_empresa" ON public.financiamentos;
CREATE POLICY "financiamentos_por_empresa" ON public.financiamentos
  FOR ALL TO authenticated
  USING (empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid()))
  WITH CHECK (empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid()));


-- -------------------------------------------------------------
-- MIGRATION: 026_taxa_juros_imoveis_veiculos.sql
-- -------------------------------------------------------------

-- ================================================================
-- MIGRATION 026 - Adiciona taxa_juros_anual em imoveis e veiculos
-- ================================================================

ALTER TABLE public.imoveis
  ADD COLUMN IF NOT EXISTS taxa_juros_anual DECIMAL(8,4);

ALTER TABLE public.veiculos
  ADD COLUMN IF NOT EXISTS taxa_juros_anual DECIMAL(8,4);


-- -------------------------------------------------------------
-- MIGRATION: 027_cofre_senhas.sql
-- -------------------------------------------------------------

-- Migration 027: Cofre de Senhas com criptografia client-side
-- Os dados sensÃ­veis sÃ£o criptografados ANTES de chegar ao banco.
-- O Supabase nunca vÃª a senha mestra nem os dados em texto puro.

CREATE TABLE IF NOT EXISTS public.cofre_senhas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  categoria TEXT DEFAULT 'outro',
  -- dados_cifrados contÃ©m JSON criptografado com AES-256-GCM via WebCrypto API
  -- formato: { iv: base64, salt: base64, ciphertext: base64 }
  dados_cifrados TEXT NOT NULL,
  -- icone opcional para identificaÃ§Ã£o visual (emoji ou nome)
  icone TEXT DEFAULT 'ðŸ”',
  -- favorito para acesso rÃ¡pido
  favorito BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.cofre_senhas ENABLE ROW LEVEL SECURITY;

-- Apenas o prÃ³prio usuÃ¡rio vÃª suas senhas
CREATE POLICY "cofre_select_own" ON public.cofre_senhas
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "cofre_insert_own" ON public.cofre_senhas
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "cofre_update_own" ON public.cofre_senhas
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "cofre_delete_own" ON public.cofre_senhas
  FOR DELETE USING (auth.uid() = user_id);

-- Index para busca rÃ¡pida
CREATE INDEX IF NOT EXISTS idx_cofre_user ON public.cofre_senhas (user_id);
CREATE INDEX IF NOT EXISTS idx_cofre_categoria ON public.cofre_senhas (categoria);


-- -------------------------------------------------------------
-- MIGRATION: 028_cartao_fatura_prevista.sql
-- -------------------------------------------------------------

-- Migration 028: Campos adicionais para cartÃµes de crÃ©dito
-- fatura_prevista: valor que o cliente insere manualmente antes do fechamento
-- limite_credito: limite total do cartÃ£o (diferente do limite_gasto_mensal que Ã© controle pessoal)
-- dia_fechamento / dia_vencimento: se ainda nÃ£o existirem

ALTER TABLE public.contas
  ADD COLUMN IF NOT EXISTS fatura_prevista   DECIMAL(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS limite_credito    DECIMAL(14,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dia_fechamento    INTEGER CHECK (dia_fechamento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS dia_vencimento    INTEGER CHECK (dia_vencimento BETWEEN 1 AND 31);


-- -------------------------------------------------------------
-- MIGRATION: 029_diario_espiritual.sql
-- -------------------------------------------------------------

-- Migration 029: Campos espirituais no diÃ¡rio
ALTER TABLE public.diario_entradas
  ADD COLUMN IF NOT EXISTS gratidao TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS intencao TEXT DEFAULT NULL;

-- Adiciona tipo espiritual ao check constraint
ALTER TABLE public.diario_entradas
  DROP CONSTRAINT IF EXISTS diario_entradas_tipo_check;

ALTER TABLE public.diario_entradas
  ADD CONSTRAINT diario_entradas_tipo_check
  CHECK (tipo IN ('diario','decisao','snapshot','marco','espiritual'));


-- -------------------------------------------------------------
-- MIGRATION: 030_perfis_comportamentais.sql
-- -------------------------------------------------------------

-- Migration 030: Tabela de perfis comportamentais
CREATE TABLE IF NOT EXISTS public.perfis_comportamentais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Perfil Profissional DISC
  disc_dominancia   INTEGER DEFAULT 0 CHECK (disc_dominancia BETWEEN 0 AND 100),
  disc_influencia   INTEGER DEFAULT 0 CHECK (disc_influencia BETWEEN 0 AND 100),
  disc_estabilidade INTEGER DEFAULT 0 CHECK (disc_estabilidade BETWEEN 0 AND 100),
  disc_conformidade INTEGER DEFAULT 0 CHECK (disc_conformidade BETWEEN 0 AND 100),
  disc_perfil_dominante TEXT, -- 'executor','comunicador','planejador','analista'
  -- Perfil Pessoal Temperamentos
  temp_colerico    INTEGER DEFAULT 0 CHECK (temp_colerico BETWEEN 0 AND 100),
  temp_melancolico INTEGER DEFAULT 0 CHECK (temp_melancolico BETWEEN 0 AND 100),
  temp_fleumatico  INTEGER DEFAULT 0 CHECK (temp_fleumatico BETWEEN 0 AND 100),
  temp_sanguineo   INTEGER DEFAULT 0 CHECK (temp_sanguineo BETWEEN 0 AND 100),
  temp_perfil_dominante TEXT,
  -- Metadados
  respondido_em TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.perfis_comportamentais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perfil_select_own" ON public.perfis_comportamentais
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "perfil_insert_own" ON public.perfis_comportamentais
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "perfil_update_own" ON public.perfis_comportamentais
  FOR UPDATE USING (auth.uid() = user_id);


-- -------------------------------------------------------------
-- MIGRATION: 031_push_subscriptions.sql
-- -------------------------------------------------------------

-- Migration 031: Tabela de assinaturas push para notificaÃ§Ãµes mobile
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_select_own" ON public.push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "push_insert_own" ON public.push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "push_delete_own" ON public.push_subscriptions FOR DELETE USING (auth.uid() = user_id);

-- Service role pode enviar para todos (para notificaÃ§Ãµes do servidor)
CREATE POLICY "push_service_select" ON public.push_subscriptions
  FOR SELECT TO service_role USING (true);


-- -------------------------------------------------------------
-- MIGRATION: 032_expand_imoveis_status.sql
-- -------------------------------------------------------------

-- ================================================================
-- MIGRATION 032 - Expande o check constraint de status nos imoveis
-- para incluir todos os status usados no sistema
-- ================================================================

-- Remove constraint antiga (se existir)
ALTER TABLE public.imoveis 
  DROP CONSTRAINT IF EXISTS imoveis_status_check;

-- Recria com todos os valores vÃ¡lidos do sistema
ALTER TABLE public.imoveis
  ADD CONSTRAINT imoveis_status_check 
  CHECK (status IN ('disponivel', 'alugado', 'vendido', 'em_reforma', 'em_obra', 'quitado', 'financiado'));

-- Garante que o default Ã© 'disponivel'
ALTER TABLE public.imoveis 
  ALTER COLUMN status SET DEFAULT 'disponivel';


-- -------------------------------------------------------------
-- MIGRATION: 033_inbox_media_bucket.sql
-- -------------------------------------------------------------

-- CriaÃ§Ã£o do bucket inbox-media para armazenar arquivos enviados/recebidos no chat
INSERT INTO storage.buckets (id, name, public) 
VALUES ('inbox-media', 'inbox-media', true)
ON CONFLICT (id) DO NOTHING;

-- PolÃ­tica para permitir que o backend e usuÃ¡rios autenticados faÃ§am upload
CREATE POLICY "Permitir upload autenticado em inbox-media"
ON storage.objects FOR INSERT
TO authenticated, service_role
WITH CHECK (bucket_id = 'inbox-media');

-- PolÃ­tica para permitir acesso pÃºblico de leitura (necessÃ¡rio para a Evolution API e visualizaÃ§Ã£o)
CREATE POLICY "Permitir leitura pÃºblica em inbox-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'inbox-media');

-- PolÃ­tica para exclusÃ£o (apenas donos/admin ou service_role)
CREATE POLICY "Permitir delete para roles"
ON storage.objects FOR DELETE
TO authenticated, service_role
USING (bucket_id = 'inbox-media');


-- -------------------------------------------------------------
-- MIGRATION: 034_add_is_fixo_to_lancamentos.sql
-- -------------------------------------------------------------

ALTER TABLE public.lancamentos ADD COLUMN IF NOT EXISTS is_fixo BOOLEAN DEFAULT false;


-- -------------------------------------------------------------
-- MIGRATION: 035_add_conta_id_to_pf_lancamentos.sql
-- -------------------------------------------------------------

ALTER TABLE public.gastos_pessoais ADD COLUMN IF NOT EXISTS conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL;
ALTER TABLE public.receitas_pessoais ADD COLUMN IF NOT EXISTS conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL;


-- -------------------------------------------------------------
-- MIGRATION: 036_faturas_cartoes.sql
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.faturas_cartoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conta_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
    mes_referencia VARCHAR(7) NOT NULL,
    valor_fechado NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conta_id, mes_referencia)
);

-- Policies
ALTER TABLE public.faturas_cartoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total faturas_cartoes" ON public.faturas_cartoes
    FOR ALL USING (true);


-- -------------------------------------------------------------
-- MIGRATION: 037_curso_idiomas.sql
-- -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.curso_progresso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    curso VARCHAR(50) NOT NULL DEFAULT 'ingles',
    licao_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'iniciada' CHECK (status IN ('iniciada', 'concluida')),
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, curso, licao_id)
);

ALTER TABLE public.curso_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total curso_progresso" ON public.curso_progresso
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE TRIGGER set_updated_at_curso_progresso BEFORE UPDATE ON public.curso_progresso
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- -------------------------------------------------------------
-- MIGRATION: 038_add_user_id_to_contas_e_faturas.sql
-- -------------------------------------------------------------

-- ============================================================
-- Migration 038: Corrige isolamento de faturas_cartoes por user_id
--               A tabela contas jÃ¡ tem user_id desde migration 018.
--               Aqui corrigimos faturas_cartoes que ficou com USING(true).
-- ============================================================

-- 1. Adiciona user_id em faturas_cartoes (se nÃ£o existir)
ALTER TABLE public.faturas_cartoes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Preenche user_id a partir do user_id da conta vinculada
UPDATE public.faturas_cartoes fc
SET user_id = c.user_id
FROM public.contas c
WHERE fc.conta_id = c.id
  AND fc.user_id IS NULL
  AND c.user_id IS NOT NULL;

-- 3. Ãndice para performance
CREATE INDEX IF NOT EXISTS idx_faturas_cartoes_user_id ON public.faturas_cartoes(user_id);

-- 4. Troca a policy aberta por isolamento real por user_id
DROP POLICY IF EXISTS "Acesso total faturas_cartoes" ON public.faturas_cartoes;

CREATE POLICY "faturas_cartoes_user_isolado" ON public.faturas_cartoes
  FOR ALL TO authenticated
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Trigger: quando inserir uma fatura, preenche user_id automaticamente
CREATE OR REPLACE FUNCTION public.set_fatura_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    SELECT user_id INTO NEW.user_id
    FROM public.contas
    WHERE id = NEW.conta_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_fatura_user_id ON public.faturas_cartoes;
CREATE TRIGGER trg_set_fatura_user_id
  BEFORE INSERT ON public.faturas_cartoes
  FOR EACH ROW EXECUTE FUNCTION public.set_fatura_user_id();

-- 6. Verifica estado final
SELECT
  fc.id,
  c.nome_cartao,
  fc.mes_referencia,
  fc.valor_fechado,
  fc.user_id IS NOT NULL AS tem_user_id
FROM public.faturas_cartoes fc
JOIN public.contas c ON c.id = fc.conta_id
ORDER BY fc.created_at DESC
LIMIT 20;


-- -------------------------------------------------------------
-- MIGRATION: 039_fatura_prevista_cartoes.sql
-- -------------------------------------------------------------

-- ============================================================
-- Migration 039: Adiciona valor_previsto em faturas_cartoes
--               Separa a previa estimada da fatura real/fechada.
--               valor_previsto = cliente digita antes de fechar
--               valor_fechado  = valor real apos fechamento
-- ============================================================

ALTER TABLE public.faturas_cartoes
  ADD COLUMN IF NOT EXISTS valor_previsto NUMERIC(12,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS notas          TEXT          DEFAULT NULL;

-- ComentÃ¡rios descritivos
COMMENT ON COLUMN public.faturas_cartoes.valor_previsto IS 'Previa estimada pelo usuario antes do fechamento da fatura';
COMMENT ON COLUMN public.faturas_cartoes.valor_fechado  IS 'Valor real da fatura apos fechamento pelo banco';
COMMENT ON COLUMN public.faturas_cartoes.notas          IS 'Observacoes livres sobre a fatura do mes';

-- Verifica
SELECT
  conta_id,
  mes_referencia,
  valor_previsto,
  valor_fechado,
  notas
FROM public.faturas_cartoes
ORDER BY created_at DESC
LIMIT 10;


-- -------------------------------------------------------------
-- MIGRATION: 040_elena_perfil_aprendizado.sql
-- -------------------------------------------------------------

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Migration 040: Perfil de Aprendizado da Elena
-- A Elena aprende com o estilo de comunicaÃ§Ã£o do usuÃ¡rio ao longo do tempo
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS elena_perfil (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Estilo de comunicaÃ§Ã£o aprendido
  estilo_comunicacao    text DEFAULT 'informal',        -- formal | informal | direto | detalhado
  tom_preferido         text DEFAULT 'profissional',    -- profissional | casual | amigavel
  prefere_resposta      text DEFAULT 'concisa',         -- concisa | detalhada | com_exemplos

  -- VocabulÃ¡rio e expressÃµes que o usuÃ¡rio usa
  expressoes_comuns     jsonb DEFAULT '[]'::jsonb,      -- ["lanÃ§a lÃ¡", "bota na PJ", "esquece"]
  palavras_chave        jsonb DEFAULT '[]'::jsonb,      -- palavras/abreviaÃ§Ãµes frequentes

  -- PadrÃµes de comportamento financeiro
  categorias_frequentes jsonb DEFAULT '{}'::jsonb,      -- {"alimentacao": 15, "transporte": 8}
  contas_preferidas     jsonb DEFAULT '[]'::jsonb,      -- ["Visa", "C6", "Nubank"]
  forma_pagamento_usual text DEFAULT 'pix',             -- forma mais usada

  -- Contexto pessoal aprendido (livre)
  contexto_pessoal      text,                           -- "EmpresÃ¡rio, usa muito o C6 Bank PJ, gosta de respostas curtas"
  preferencias_ui       jsonb DEFAULT '{}'::jsonb,      -- outras preferÃªncias detectadas

  -- Controle
  total_interacoes      int DEFAULT 0,                  -- total de msgs processadas
  ultima_atualizacao    timestamptz DEFAULT now(),
  created_at            timestamptz DEFAULT now(),

  UNIQUE(user_id)
);

-- RLS: cada usuÃ¡rio vÃª apenas seu perfil
ALTER TABLE elena_perfil ENABLE ROW LEVEL SECURITY;

CREATE POLICY "elena_perfil_owner" ON elena_perfil
  FOR ALL USING (auth.uid() = user_id);

-- Ãndice
CREATE INDEX IF NOT EXISTS idx_elena_perfil_user ON elena_perfil(user_id);

-- ComentÃ¡rio
COMMENT ON TABLE elena_perfil IS 'Perfil de aprendizado da Elena â€” armazena padrÃµes de comunicaÃ§Ã£o do usuÃ¡rio para personalizar respostas';


-- -------------------------------------------------------------
-- MIGRATION: 041_push_subscriptions.sql
-- -------------------------------------------------------------

-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- Migration 041: Web Push Subscriptions (notificaÃ§Ãµes iPhone/Android)
-- â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint     text NOT NULL,
  p256dh       text NOT NULL,
  auth         text NOT NULL,
  user_agent   text,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_sub_owner" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Service account (backend) pode inserir/deletar
CREATE POLICY "push_sub_service" ON push_subscriptions
  FOR ALL USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id);

COMMENT ON TABLE push_subscriptions IS 'Subscriptions Web Push por dispositivo/usuÃ¡rio para notificaÃ§Ãµes nativas iPhone/Android';


-- -------------------------------------------------------------
-- MIGRATION: 042_agenda_push_enviado.sql
-- -------------------------------------------------------------

-- Migration 042: Adiciona campo push_enviado na agenda_eventos
-- Para rastrear se a notificaÃ§Ã£o push jÃ¡ foi enviada (evita duplicidade)

ALTER TABLE agenda_eventos
  ADD COLUMN IF NOT EXISTS push_enviado timestamptz DEFAULT NULL;

COMMENT ON COLUMN agenda_eventos.push_enviado IS 'Timestamp de quando a notificaÃ§Ã£o push foi enviada. NULL = ainda nÃ£o enviada.';

CREATE INDEX IF NOT EXISTS idx_agenda_push_pendente
  ON agenda_eventos(data_inicio, push_enviado)
  WHERE tipo = 'lembrete' AND status = 'pendente' AND push_enviado IS NULL;


-- -------------------------------------------------------------
-- MIGRATION: 043_contas_milhas.sql
-- -------------------------------------------------------------

-- Migration 043: Campos de milhas/pontos nas contas (cartÃµes)
-- Permite rastrear programa de fidelidade, saldo e taxa de conversÃ£o

ALTER TABLE contas
  ADD COLUMN IF NOT EXISTS programa_milhas  text DEFAULT NULL,   -- 'livelo','smiles','tudoazul','esfera','latam','azul','multiplus','none'
  ADD COLUMN IF NOT EXISTS taxa_milhas      numeric(6,2) DEFAULT 1.0,  -- R$1 = X pontos/milhas
  ADD COLUMN IF NOT EXISTS saldo_milhas     int DEFAULT 0,             -- saldo atual em pontos
  ADD COLUMN IF NOT EXISTS valor_milha      numeric(6,4) DEFAULT 0.02; -- valor estimado de 1 milha em R$

COMMENT ON COLUMN contas.programa_milhas IS 'Programa de fidelidade vinculado ao cartÃ£o (Livelo, Smiles, etc.)';
COMMENT ON COLUMN contas.taxa_milhas      IS 'Quantos pontos/milhas o cartÃ£o gera por R$1 gasto';
COMMENT ON COLUMN contas.saldo_milhas     IS 'Saldo atual de milhas/pontos neste cartÃ£o';
COMMENT ON COLUMN contas.valor_milha      IS 'Valor estimado de cada milha em R$ para cÃ¡lculo de resgate';


