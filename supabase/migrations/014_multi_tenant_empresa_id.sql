-- ============================================================
-- SISTEMA CAJADO - MIGRATION 014
-- Multi-Tenant: Isolamento por empresa_id
-- Cada cliente/empresa só acessa seus próprios dados via RLS
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

-- FK reversa: empresas.owner_id → perfis
ALTER TABLE public.empresas
  ADD CONSTRAINT empresas_owner_fk
  FOREIGN KEY (owner_id) REFERENCES public.perfis(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_perfis_empresa ON public.perfis(empresa_id);

-- ============================================================
-- 3. FUNÇÃO: retorna empresa_id do usuário atual
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM public.perfis WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================================
-- 4. CRIAR EMPRESA PADRÃO E MIGRAR DADOS EXISTENTES
-- ============================================================

DO $$
DECLARE
  v_empresa_id UUID;
  v_owner_id   UUID;
BEGIN
  -- Pega o primeiro usuário cadastrado (admin/dono da plataforma)
  SELECT id INTO v_owner_id FROM public.perfis ORDER BY created_at ASC LIMIT 1;

  IF v_owner_id IS NULL THEN
    RETURN;
  END IF;

  -- Cria empresa padrão para dados existentes
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
-- 5. ADICIONAR empresa_id EM TODAS AS TABELAS DE NEGÓCIO
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

-- Organização
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

-- Inteligência
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

-- Gestão interna
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
--    (tudo fica na empresa padrão criada acima)
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
-- 7. ÍNDICES PARA PERFORMANCE
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
-- 8. ATUALIZAR POLÍTICAS RLS — FILTRAR POR empresa_id
-- ============================================================

-- Helper: dropa e recria policy
-- CONTAS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.contas;
CREATE POLICY "Isolamento por empresa" ON public.contas
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CATEGORIAS FINANCEIRAS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.categorias_financeiras;
CREATE POLICY "Isolamento por empresa" ON public.categorias_financeiras
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- RECORRÊNCIAS
ALTER TABLE public.recorrencias ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.recorrencias;
CREATE POLICY "Isolamento por empresa" ON public.recorrencias
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- LANÇAMENTOS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.lancamentos;
CREATE POLICY "Isolamento por empresa" ON public.lancamentos
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CONCILIAÇÃO
ALTER TABLE public.conciliacao_extrato ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.conciliacao_extrato;
CREATE POLICY "Isolamento por empresa" ON public.conciliacao_extrato
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- LEADS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.leads;
CREATE POLICY "Isolamento por empresa" ON public.leads
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- ATIVIDADES
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.atividades;
CREATE POLICY "Isolamento por empresa" ON public.atividades
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- PARCEIROS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.parceiros;
CREATE POLICY "Isolamento por empresa" ON public.parceiros
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- MENSAGENS PADRÃO
ALTER TABLE public.mensagens_padrao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.mensagens_padrao;
CREATE POLICY "Isolamento por empresa" ON public.mensagens_padrao
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CAMPANHAS
ALTER TABLE public.campanhas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.campanhas;
CREATE POLICY "Isolamento por empresa" ON public.campanhas
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CHECKINS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.checkins;
CREATE POLICY "Isolamento por empresa" ON public.checkins
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- NÚMEROS WHATSAPP
ALTER TABLE public.numeros_whatsapp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.numeros_whatsapp;
CREATE POLICY "Isolamento por empresa" ON public.numeros_whatsapp
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- BACKUP CONTATOS (via whatsapp)
ALTER TABLE public.backup_contatos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.backup_contatos;
CREATE POLICY "Isolamento por empresa" ON public.backup_contatos
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- PROJETOS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.projetos;
CREATE POLICY "Isolamento por empresa" ON public.projetos
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- IDEIAS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.ideias;
CREATE POLICY "Isolamento por empresa" ON public.ideias
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- DECISÕES
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.decisoes;
CREATE POLICY "Isolamento por empresa" ON public.decisoes
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- OPERAÇÕES TRADER
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.operacoes;
CREATE POLICY "Isolamento por empresa" ON public.operacoes
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- ATIVOS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.ativos;
CREATE POLICY "Isolamento por empresa" ON public.ativos
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- PROJETOS PATRIMÔNIO
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.projetos_patrimonio;
CREATE POLICY "Isolamento por empresa" ON public.projetos_patrimonio
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- ANÁLISES MERCADO
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.analises_mercado;
CREATE POLICY "Isolamento por empresa" ON public.analises_mercado
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- TENDÊNCIAS
DROP POLICY IF EXISTS "Usuários autenticados têm acesso total" ON public.tendencias;
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

-- TEMPLATES PÓS-VENDA
DROP POLICY IF EXISTS "Acesso total autenticados templates_pos_venda" ON public.templates_pos_venda;
CREATE POLICY "Isolamento por empresa" ON public.templates_pos_venda
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- DISPAROS PÓS-VENDA
DROP POLICY IF EXISTS "Acesso total autenticados disparos_pos_venda" ON public.disparos_pos_venda;
CREATE POLICY "Isolamento por empresa" ON public.disparos_pos_venda
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- DIÁRIO
DROP POLICY IF EXISTS "Acesso total autenticados diario_entradas" ON public.diario_entradas;
CREATE POLICY "Isolamento por empresa" ON public.diario_entradas
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- CONFIGURAÇÕES EMPRESA
DROP POLICY IF EXISTS "Acesso total autenticados conf_empresa" ON public.configuracoes_empresa;
CREATE POLICY "Isolamento por empresa" ON public.configuracoes_empresa
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- FUNCIONÁRIOS
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

-- OCORRÊNCIAS
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
DROP POLICY IF EXISTS "Inserção de auditoria" ON public.log_acesso;
CREATE POLICY "Isolamento por empresa" ON public.log_acesso
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

DROP POLICY IF EXISTS "Leitura de audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Inserção de audit_log" ON public.audit_log;
CREATE POLICY "Isolamento por empresa" ON public.audit_log
  FOR ALL TO authenticated
  USING  (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());

-- EMPRESAS: cada usuário vê somente a própria empresa
CREATE POLICY "Usuario ve propria empresa" ON public.empresas
  FOR ALL TO authenticated
  USING  (id = public.get_empresa_id())
  WITH CHECK (id = public.get_empresa_id());

-- PERFIS: usuário vê todos da mesma empresa (para chat interno, menções etc.)
DROP POLICY IF EXISTS "Usuário vê e edita o próprio perfil" ON public.perfis;
CREATE POLICY "Perfis da mesma empresa" ON public.perfis
  FOR SELECT TO authenticated
  USING (empresa_id = public.get_empresa_id());
CREATE POLICY "Edita proprio perfil" ON public.perfis
  FOR ALL TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 9. ATUALIZAR handle_new_user — criar empresa automaticamente
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_empresa_id UUID;
  v_nome       TEXT;
BEGIN
  v_nome := COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email, '@', 1));

  -- Cria empresa para o novo usuário
  INSERT INTO public.empresas (nome, plano, trial_ate)
  VALUES (
    COALESCE(NEW.raw_user_meta_data->>'empresa_nome', v_nome || ' - Empresa'),
    'trial',
    NOW() + INTERVAL '5 days'
  )
  RETURNING id INTO v_empresa_id;

  -- Cria perfil vinculado à empresa
  INSERT INTO public.perfis (id, nome, email, empresa_id)
  VALUES (NEW.id, v_nome, NEW.email, v_empresa_id);

  -- Atualiza owner da empresa
  UPDATE public.empresas SET owner_id = NEW.id WHERE id = v_empresa_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 10. CONSTRAINT NOT NULL (após popular dados existentes)
-- ============================================================

-- Tabelas principais: empresa_id obrigatório
ALTER TABLE public.contas                ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.lancamentos           ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.leads                 ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.clientes              ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.vendas                ALTER COLUMN empresa_id SET NOT NULL;
ALTER TABLE public.produtos              ALTER COLUMN empresa_id SET NOT NULL;
