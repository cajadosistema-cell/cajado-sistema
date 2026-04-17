-- ════════════════════════════════════════════════════════════════
-- MIGRATION FASE 3 — Sistema Cajado
-- Módulos: Expansão (OKRs e Projetos), IA Financeira e Setups Trader
-- ════════════════════════════════════════════════════════════════

-- ── 1. EXPANSÃO: OPORTUNIDADES E OKRS ─────────────────────────
CREATE TABLE IF NOT EXISTS oportunidades_expansao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES perfis(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'ideia' CHECK (status IN ('ideia', 'analisando', 'aprovado', 'executando', 'descartado')),
  roi_estimado DECIMAL(10,2),
  investimento_estimado DECIMAL(12,2),
  created_by UUID REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE oportunidades_expansao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oportunidades_all" ON oportunidades_expansao;
CREATE POLICY "oportunidades_all" ON oportunidades_expansao FOR ALL USING (true);


CREATE TABLE IF NOT EXISTS okrs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id UUID REFERENCES perfis(id) ON DELETE CASCADE,
  ciclo TEXT NOT NULL, -- Ex: 'Q1 2026'
  objetivo TEXT NOT NULL,
  responsavel_id UUID REFERENCES auth.users,
  status TEXT DEFAULT 'no_prazo' CHECK (status IN ('no_prazo', 'em_risco', 'atrasado', 'concluido')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE okrs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "okrs_all" ON okrs;
CREATE POLICY "okrs_all" ON okrs FOR ALL USING (true);


CREATE TABLE IF NOT EXISTS okr_resultados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  okr_id UUID REFERENCES okrs(id) ON DELETE CASCADE,
  resultado_chave TEXT NOT NULL,
  meta_valor DECIMAL(10,2) NOT NULL,
  atual_valor DECIMAL(10,2) DEFAULT 0,
  unidade TEXT DEFAULT '%',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE okr_resultados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "okr_resultados_all" ON okr_resultados;
CREATE POLICY "okr_resultados_all" ON okr_resultados FOR ALL USING (true);

-- ── 2. TRADER: EQUITY CURVE E SETUPS ─────────────────────────
CREATE TABLE IF NOT EXISTS setups_trader (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   UUID REFERENCES perfis(id) ON DELETE CASCADE,
  nome         TEXT NOT NULL,
  descricao    TEXT,
  regras_entrada TEXT,
  regras_saida TEXT,
  ativo        BOOLEAN DEFAULT true,
  taxa_acerto_historica DECIMAL(5,2),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE setups_trader ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "setups_trader_all" ON setups_trader;
CREATE POLICY "setups_trader_all" ON setups_trader FOR ALL USING (true);

-- =====================================================================
-- (Opcional - Seed Demo Expansão)
-- =====================================================================
-- INSERT INTO okrs (ciclo, objetivo, status) VALUES 
-- ('Q2 2026', 'Dominar o mercado de SAAS nacional', 'no_prazo');
