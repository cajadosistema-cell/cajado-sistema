-- ============================================================
-- SISTEMA CAJADO - SCHEMA COMPLETO
-- Migration: 001_schema_inicial
-- ============================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABELAS BASE / AUTENTICAÇÃO
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
-- M03 - SEGURANÇA WHATSAPP
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

-- FK de campanhas para números
ALTER TABLE public.campanhas ADD CONSTRAINT campanhas_numero_fk
  FOREIGN KEY (numero_origem_id) REFERENCES public.numeros_whatsapp(id) ON DELETE SET NULL;

-- ============================================================
-- M04 - ORGANIZAÇÃO
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
-- M07 - PATRIMÔNIO
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
-- M08 - INTELIGÊNCIA
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
-- M09 - SEGURANÇA GERAL
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
-- ÍNDICES DE PERFORMANCE
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

-- Políticas básicas: usuário autenticado acessa tudo (ajuste conforme necessário)
CREATE POLICY "Usuários autenticados têm acesso total" ON public.contas
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.lancamentos
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.leads
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.atividades
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.parceiros
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.checkins
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.projetos
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.ideias
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.decisoes
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.operacoes
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.ativos
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.projetos_patrimonio
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.analises_mercado
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "Usuários autenticados têm acesso total" ON public.tendencias
  FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- Perfil: usuário só vê/edita o próprio perfil
CREATE POLICY "Usuário vê e edita o próprio perfil" ON public.perfis
  FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auditoria: apenas inserção
CREATE POLICY "Inserção de auditoria" ON public.log_acesso
  FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Leitura de auditoria" ON public.log_acesso
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "Inserção de audit_log" ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (TRUE);
CREATE POLICY "Leitura de audit_log" ON public.audit_log
  FOR SELECT TO authenticated USING (TRUE);

-- ============================================================
-- FUNÇÃO: atualizar updated_at automaticamente
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
-- FUNÇÃO: criar perfil após signup
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
-- VIEWS ÚTEIS
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

-- Performance da equipe (mês atual)
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

-- Posição de investimentos
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
  ('Pessoal e Salários', 'despesa', '#FCA5A5'),
  ('Infraestrutura e Tecnologia', 'despesa', '#FECACA'),
  ('Impostos e Taxas', 'despesa', '#FEE2E2'),
  ('Outras Despesas', 'despesa', '#FEF2F2'),
  ('Aportes', 'investimento', '#3B82F6'),
  ('Transferência Interna', 'transferencia', '#6B7280');

INSERT INTO public.mensagens_padrao (titulo, conteudo, categoria, variaveis) VALUES
  ('Primeiro Contato', 'Olá, {{nome}}! Tudo bem? Vi que você entrou em contato sobre {{servico}}. Posso te ajudar! 😊', 'prospeccao', ARRAY['nome', 'servico']),
  ('Proposta Enviada', 'Olá, {{nome}}! Acabei de te enviar a proposta por e-mail. Ficou alguma dúvida?', 'proposta', ARRAY['nome']),
  ('Follow-up', 'Oi, {{nome}}! Estou passando para ver se você conseguiu analisar a proposta que enviei. 😊', 'followup', ARRAY['nome']),
  ('Pós-venda', 'Olá, {{nome}}! Gostaria de saber como está sendo sua experiência com o serviço. Tudo certo?', 'pos_venda', ARRAY['nome']),
  ('Lembrete de Renovação', 'Oi, {{nome}}! Seu contrato vence em breve. Vamos conversar sobre a renovação?', 'renovacao', ARRAY['nome']);
