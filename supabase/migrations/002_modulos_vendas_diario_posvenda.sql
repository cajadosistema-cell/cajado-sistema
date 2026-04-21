-- ============================================================
-- SISTEMA CAJADO - MIGRATION 002 (v2 - idempotente com DROP)
-- Módulos: Vendas/OS, Clientes, Pós-venda, Diário Estratégico
-- ============================================================

-- ============================================================
-- DROP de tabelas que podem existir com schema antigo
-- (ordem inversa por dependências de FK)
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
-- M11 - PRODUTOS / CATÁLOGO
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
-- M12 - VENDAS / ORDENS DE SERVIÇO
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
-- M13 - PÓS-VENDA / AUTOMAÇÕES
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

-- Templates padrão iniciais
INSERT INTO public.templates_pos_venda (nome, mensagem, gatilho, ativo) VALUES
  ('Agradecimento imediato', 'Olá {{nome_cliente}}! 😊 Obrigado por escolher a {{empresa}}. Foi um prazer te atender! Ficou com alguma dúvida é só chamar.', 'conclusao_os', true),
  ('Follow-up 7 dias', 'Oi {{nome_cliente}}, tudo bem? Estou passando para saber se ficou satisfeito com o {{servico}}. Tem algum feedback para compartilhar? 🙏', 'dias_7', true),
  ('Pedido de indicação 15 dias', 'Oi {{nome_cliente}}! Espero que esteja tudo certo com você. Caso conheça alguém que precise de {{servico}}, vai ser um prazer atender! 😀 Obrigado por confiar no nosso trabalho!', 'dias_15', true);

-- ============================================================
-- M14 - DIÁRIO ESTRATÉGICO
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
-- CONFIGURAÇÕES DA EMPRESA
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
-- FUNCIONÁRIOS
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
-- GESTÃO DE EQUIPE
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
