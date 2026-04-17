-- ============================================================
-- SISTEMA CAJADO — MIGRATION FASE 1
-- Execute no SQL Editor do Supabase (dashboard.supabase.com)
-- Arquivo: scripts/migration_fase1.sql
-- ============================================================
-- IMPORTANTE: O schema base (001_schema_inicial.sql) deve já
-- ter sido executado. Este script apenas ADICIONA novas tabelas.
-- ============================================================

-- ── SEGURANÇA / RBAC ─────────────────────────────────────────

-- Roles disponíveis no sistema
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome TEXT NOT NULL UNIQUE,            -- admin, financeiro, comercial, atendimento, trader, visualizador
  descricao TEXT,
  permissoes TEXT[] DEFAULT '{}',       -- array de slugs: financeiro:read, financeiro:write, etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Atribuição de role por usuário
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  concedido_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Log de atividade por usuário (complementa audit_log existente)
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  acao TEXT NOT NULL,                   -- login, logout, create, update, delete, export
  modulo TEXT NOT NULL,                 -- financeiro, equipe, crm, trader...
  descricao TEXT,
  ip TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MÓDULO EQUIPE ─────────────────────────────────────────────

-- Extensão da tabela perfis com campos de RH (via tabela separada)
CREATE TABLE IF NOT EXISTS public.colaboradores (
  id UUID REFERENCES public.perfis(id) ON DELETE CASCADE PRIMARY KEY,
  matricula TEXT UNIQUE,
  data_admissao DATE,
  cargo_detalhado TEXT,
  setor TEXT,                           -- financeiro, comercial, atendimento, operacional, diretoria
  salario DECIMAL(12,2),
  carga_horaria_semanal INTEGER DEFAULT 40,
  meta_tarefas_mes INTEGER DEFAULT 20,
  perfil_disc TEXT CHECK (perfil_disc IN ('D','I','S','C','DI','DS','IS','IC','SC','DC')),
  observacoes TEXT,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de ponto eletrônico
CREATE TABLE IF NOT EXISTS public.registros_ponto (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada','saida','pausa_inicio','pausa_fim')),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tarefas por colaborador (kanban)
CREATE TABLE IF NOT EXISTS public.tarefas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  criado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'a_fazer' CHECK (status IN ('a_fazer','em_andamento','concluida','cancelada')),
  prioridade TEXT NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa','media','alta','urgente')),
  prazo DATE,
  modulo TEXT,                          -- módulo relacionado (financeiro, crm, etc.)
  concluida_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Registro de ocorrências (erros e acertos)
CREATE TABLE IF NOT EXISTS public.ocorrencias (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('erro','acerto','alerta','elogio')),
  descricao TEXT NOT NULL,
  colaborador_id UUID REFERENCES public.perfis(id) ON DELETE SET NULL,   -- quem gerou
  registrado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,  -- quem registrou
  modulo TEXT,                          -- em qual módulo ocorreu
  impacto TEXT CHECK (impacto IN ('baixo','medio','alto')),
  resolvida BOOLEAN DEFAULT FALSE,
  resolucao TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── MÓDULO PF PESSOAL ─────────────────────────────────────────

-- Gastos pessoais (PF)
CREATE TABLE IF NOT EXISTS public.gastos_pessoais (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL CHECK (valor > 0),
  categoria TEXT NOT NULL DEFAULT 'outros',  -- alimentacao, transporte, lazer, saude, educacao, moradia, outros
  forma_pagamento TEXT DEFAULT 'pix',       -- pix, cartao_debito, cartao_credito, dinheiro, transferencia
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  recorrente BOOLEAN DEFAULT FALSE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receitas pessoais (PF)
CREATE TABLE IF NOT EXISTS public.receitas_pessoais (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  descricao TEXT NOT NULL,
  valor DECIMAL(12,2) NOT NULL CHECK (valor > 0),
  categoria TEXT NOT NULL DEFAULT 'outros',  -- pro_labore, salario, freelance, dividendos, aluguel, outros
  recorrente BOOLEAN DEFAULT FALSE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orçamentos mensais por categoria (PF)
CREATE TABLE IF NOT EXISTS public.orcamentos_pessoais (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.perfis(id) ON DELETE CASCADE NOT NULL,
  categoria TEXT NOT NULL,
  valor_limite DECIMAL(12,2) NOT NULL CHECK (valor_limite > 0),
  mes_referencia TEXT NOT NULL,              -- formato: YYYY-MM
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, categoria, mes_referencia)
);

-- ── MÓDULO FINANCEIRO (extensões) ─────────────────────────────

-- Pagamentos parciais (entradas parciais de um lançamento)
CREATE TABLE IF NOT EXISTS public.pagamentos_parciais (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lancamento_id UUID REFERENCES public.lancamentos(id) ON DELETE CASCADE NOT NULL,
  valor_pago DECIMAL(12,2) NOT NULL CHECK (valor_pago > 0),
  data_pagamento DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento TEXT DEFAULT 'pix',
  conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  observacoes TEXT,
  registrado_por UUID REFERENCES public.perfis(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Taxas de cartão por bandeira/modalidade
CREATE TABLE IF NOT EXISTS public.taxas_cartao (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  bandeira TEXT NOT NULL,               -- visa, mastercard, elo, amex, hipercard
  modalidade TEXT NOT NULL CHECK (modalidade IN ('debito','credito_1x','credito_2_6','credito_7_12')),
  taxa_percentual DECIMAL(5,4) NOT NULL, -- ex: 0.0199 = 1.99%
  dias_para_receber INTEGER DEFAULT 1,
  ativo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bandeira, modalidade)
);

-- ── ÍNDICES DE PERFORMANCE ────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_registros_ponto_user ON public.registros_ponto(user_id);
CREATE INDEX IF NOT EXISTS idx_registros_ponto_ts ON public.registros_ponto(timestamp);
CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel ON public.tarefas(responsavel_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_status ON public.tarefas(status);
CREATE INDEX IF NOT EXISTS idx_ocorrencias_colaborador ON public.ocorrencias(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_gastos_pessoais_user ON public.gastos_pessoais(user_id);
CREATE INDEX IF NOT EXISTS idx_gastos_pessoais_data ON public.gastos_pessoais(data);
CREATE INDEX IF NOT EXISTS idx_receitas_pessoais_user ON public.receitas_pessoais(user_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_parciais_lanc ON public.pagamentos_parciais(lancamento_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_user ON public.user_activity_log(user_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_pessoais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas_pessoais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamentos_pessoais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pagamentos_parciais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.taxas_cartao ENABLE ROW LEVEL SECURITY;

-- Políticas: autenticado acessa tudo (ajustar após RBAC completo)
CREATE POLICY "auth_full" ON public.roles FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full" ON public.user_roles FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full" ON public.colaboradores FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full" ON public.registros_ponto FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full" ON public.tarefas FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full" ON public.ocorrencias FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full" ON public.taxas_cartao FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
-- PF pessoal: cada user só vê os próprios dados
CREATE POLICY "pf_own" ON public.gastos_pessoais FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "pf_own" ON public.receitas_pessoais FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "pf_own" ON public.orcamentos_pessoais FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "auth_full" ON public.pagamentos_parciais FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full" ON public.user_activity_log FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- ── TRIGGERS ─────────────────────────────────────────────────

-- updated_at para novas tabelas
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.colaboradores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger: ao concluir tarefa, registrar timestamp
CREATE OR REPLACE FUNCTION public.handle_tarefa_concluida()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'concluida' AND OLD.status != 'concluida' THEN
    NEW.concluida_em = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tarefa_concluida BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.handle_tarefa_concluida();

-- ── DADOS INICIAIS ────────────────────────────────────────────

-- Roles padrão do sistema
INSERT INTO public.roles (nome, descricao, permissoes) VALUES
  ('admin',        'Acesso total ao sistema',                         ARRAY['*']),
  ('financeiro',   'Acesso ao módulo financeiro e relatórios',        ARRAY['financeiro:read','financeiro:write','relatorios:read']),
  ('comercial',    'Acesso a vendas, CRM e inbox',                    ARRAY['vendas:read','vendas:write','crm:read','crm:write','inbox:read']),
  ('atendimento',  'Acesso ao inbox e pós-venda',                     ARRAY['inbox:read','inbox:write','pos_venda:read','pos_venda:write']),
  ('trader',       'Acesso ao módulo trader e investimentos',         ARRAY['trader:read','trader:write','investimentos:read']),
  ('visualizador', 'Somente leitura em todos os módulos',             ARRAY['*:read'])
ON CONFLICT (nome) DO NOTHING;

-- Taxas de cartão padrão Brasil
INSERT INTO public.taxas_cartao (bandeira, modalidade, taxa_percentual, dias_para_receber) VALUES
  ('visa',        'debito',        0.0149, 1),
  ('visa',        'credito_1x',    0.0229, 30),
  ('visa',        'credito_2_6',   0.0279, 30),
  ('visa',        'credito_7_12',  0.0329, 30),
  ('mastercard',  'debito',        0.0149, 1),
  ('mastercard',  'credito_1x',    0.0229, 30),
  ('mastercard',  'credito_2_6',   0.0279, 30),
  ('mastercard',  'credito_7_12',  0.0329, 30),
  ('elo',         'debito',        0.0169, 1),
  ('elo',         'credito_1x',    0.0249, 30),
  ('elo',         'credito_2_6',   0.0299, 30),
  ('elo',         'credito_7_12',  0.0349, 30)
ON CONFLICT (bandeira, modalidade) DO NOTHING;
