-- ════════════════════════════════════════════════════════════════
-- MIGRATION FASE 2 — Sistema Cajado
-- Módulos: Projetos (pendências + reuniões), Comercial (metas)
-- Execute no SQL Editor do Supabase Dashboard
-- ════════════════════════════════════════════════════════════════

-- ── 1. PENDÊNCIAS POR PROJETO ─────────────────────────────────
CREATE TABLE IF NOT EXISTS pendencias_projeto (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id       UUID REFERENCES perfis(id) ON DELETE CASCADE,
  projeto_id       UUID REFERENCES projetos(id) ON DELETE SET NULL,
  descricao        TEXT NOT NULL,
  responsavel      TEXT,
  prazo            DATE,
  status           TEXT NOT NULL DEFAULT 'aberta'
                   CHECK (status IN ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  prioridade       TEXT NOT NULL DEFAULT 'media'
                   CHECK (prioridade IN ('baixa', 'media', 'alta', 'urgente')),
  created_by       UUID REFERENCES auth.users,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE pendencias_projeto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pendencias_projeto_select" ON pendencias_projeto;
DROP POLICY IF EXISTS "pendencias_projeto_insert" ON pendencias_projeto;
DROP POLICY IF EXISTS "pendencias_projeto_update" ON pendencias_projeto;
DROP POLICY IF EXISTS "pendencias_projeto_delete" ON pendencias_projeto;
CREATE POLICY "pendencias_projeto_select" ON pendencias_projeto FOR SELECT USING (true);
CREATE POLICY "pendencias_projeto_insert" ON pendencias_projeto FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "pendencias_projeto_update" ON pendencias_projeto FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "pendencias_projeto_delete" ON pendencias_projeto FOR DELETE USING (auth.role() = 'authenticated');

-- ── 2. REUNIÕES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reunioes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id          UUID REFERENCES perfis(id) ON DELETE CASCADE,
  projeto_id          UUID REFERENCES projetos(id) ON DELETE SET NULL,
  titulo              TEXT NOT NULL,
  data_reuniao        DATE NOT NULL DEFAULT CURRENT_DATE,
  horario             TIME,
  participantes       TEXT,                    -- lista separada por vírgula
  pauta               TEXT,
  decisoes_tomadas    TEXT,
  acoes               TEXT,                    -- ações/próximos passos acordados
  created_by          UUID REFERENCES auth.users,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE reunioes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reunioes_select" ON reunioes;
DROP POLICY IF EXISTS "reunioes_insert" ON reunioes;
DROP POLICY IF EXISTS "reunioes_update" ON reunioes;
DROP POLICY IF EXISTS "reunioes_delete" ON reunioes;
CREATE POLICY "reunioes_select" ON reunioes FOR SELECT USING (true);
CREATE POLICY "reunioes_insert" ON reunioes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "reunioes_update" ON reunioes FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "reunioes_delete" ON reunioes FOR DELETE USING (auth.role() = 'authenticated');

-- ── 3. METAS DE VENDAS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metas_vendas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      UUID REFERENCES perfis(id) ON DELETE CASCADE,
  atendente_id    UUID REFERENCES auth.users,
  atendente_nome  TEXT,                   -- campo desnormalizado para facilitar UI
  mes_referencia  TEXT NOT NULL,          -- formato YYYY-MM
  valor_meta      DECIMAL(12,2) NOT NULL,
  valor_realizado DECIMAL(12,2) DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(empresa_id, atendente_id, mes_referencia)
);

-- RLS
ALTER TABLE metas_vendas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "metas_vendas_select" ON metas_vendas;
DROP POLICY IF EXISTS "metas_vendas_insert" ON metas_vendas;
DROP POLICY IF EXISTS "metas_vendas_update" ON metas_vendas;
DROP POLICY IF EXISTS "metas_vendas_delete" ON metas_vendas;
CREATE POLICY "metas_vendas_select" ON metas_vendas FOR SELECT USING (true);
CREATE POLICY "metas_vendas_insert" ON metas_vendas FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "metas_vendas_update" ON metas_vendas FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "metas_vendas_delete" ON metas_vendas FOR DELETE USING (auth.role() = 'authenticated');

-- ── 4. HISTÓRICO DE PROJETO ────────────────────────────────────
CREATE TABLE IF NOT EXISTS historico_projeto (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id    UUID REFERENCES projetos(id) ON DELETE CASCADE NOT NULL,
  user_id       UUID REFERENCES auth.users,
  descricao     TEXT NOT NULL,
  tipo          TEXT DEFAULT 'atualizacao'
                CHECK (tipo IN ('criacao', 'atualizacao', 'conclusao', 'pausa', 'cancelamento', 'nota')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE historico_projeto ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "historico_projeto_all" ON historico_projeto;
CREATE POLICY "historico_projeto_all" ON historico_projeto FOR ALL USING (true);

-- ── 5. PATRIMÔNIO: IMÓVEIS E FINANCIAMENTOS ──────────────────────
CREATE TABLE IF NOT EXISTS imoveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES perfis(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  endereco TEXT,
  tipo_imovel TEXT DEFAULT 'residencial' CHECK (tipo_imovel IN ('residencial', 'comercial', 'terreno', 'galpao')),
  area_m2 DECIMAL(10,2),
  quartos INTEGER,
  vagas INTEGER,
  valor_compra DECIMAL(12,2),
  valor_mercado DECIMAL(12,2),
  status TEXT DEFAULT 'disponivel' CHECK (status IN ('alugado', 'disponivel', 'em_reforma', 'vendido')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE imoveis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "imoveis_all" ON imoveis;
CREATE POLICY "imoveis_all" ON imoveis FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS financiamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES perfis(id) ON DELETE CASCADE,
  bem_id UUID, -- Referência solta para poder linkar carros ou imóveis
  banco TEXT NOT NULL,
  valor_financiado DECIMAL(12,2),
  taxa_juros DECIMAL(5,2), -- % ao ano
  prazo_meses INTEGER,
  parcelas_pagas INTEGER DEFAULT 0,
  valor_parcela DECIMAL(10,2),
  vencimento_dia INTEGER,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE financiamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "financiamentos_all" ON financiamentos;
CREATE POLICY "financiamentos_all" ON financiamentos FOR ALL USING (true);

-- ── SEED DEMO ─────────────────────────────────────────────────
-- (Opcional — para ambiente de demonstração)

-- INSERT INTO pendencias_projeto (descricao, responsavel, prazo, prioridade, status) VALUES
--   ('Enviar proposta para cliente ABC', 'Carlos', CURRENT_DATE + 2, 'alta', 'aberta'),
--   ('Atualizar tabela de preços 2026', 'Ana', CURRENT_DATE + 7, 'media', 'em_andamento'),
--   ('Revisar contrato de aluguel', 'João', CURRENT_DATE - 1, 'urgente', 'aberta'),
--   ('Comprar material para escritório', NULL, NULL, 'baixa', 'concluida');

-- INSERT INTO reunioes (titulo, data_reuniao, horario, participantes, decisoes_tomadas) VALUES
--   ('Alinhamento semanal', CURRENT_DATE, '09:00', 'Carlos, Ana, João', 
--    'Priorizar atendimento à fila de WhatsApp. Meta: responder em até 2h.'),
--   ('Revisão de metas Q2', CURRENT_DATE - 7, '14:00', 'Carlos, Ana', 
--    'Aumentar prospecção via Instagram. Meta 15 leads/mês.');
