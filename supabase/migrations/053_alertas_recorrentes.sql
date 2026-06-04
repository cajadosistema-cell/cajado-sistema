-- ============================================================
-- SISTEMA CAJADO - MIGRATION 053
-- Tabela de alertas_recorrentes: contas fixas mensais que o
-- sistema auto-gera como eventos de vencimento na agenda.
-- ============================================================

CREATE TABLE IF NOT EXISTS alertas_recorrentes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  descricao        TEXT NOT NULL,                      -- Ex: "Internet Vivo", "Conta de Luz"
  valor            DECIMAL(10,2),                      -- Valor estimado (opcional)
  dia_vencimento   INTEGER NOT NULL CHECK (dia_vencimento BETWEEN 1 AND 31),
  categoria        TEXT DEFAULT 'outros',
  conta_id         UUID REFERENCES contas(id),         -- Vínculo com cartão (opcional)
  tipo             TEXT DEFAULT 'boleto'               -- boleto, cartao, agua, energia, internet, aluguel, outro
                   CHECK (tipo IN ('boleto','cartao','agua','energia','internet','telefone','aluguel','condominio','plano_saude','financiamento','outro')),
  ativo            BOOLEAN DEFAULT TRUE,
  criado_pela_elena BOOLEAN DEFAULT FALSE,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_alertas_recorrentes_user ON alertas_recorrentes(user_id);
CREATE INDEX IF NOT EXISTS idx_alertas_recorrentes_ativo ON alertas_recorrentes(user_id, ativo);

-- RLS
ALTER TABLE alertas_recorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own alertas" ON alertas_recorrentes
  FOR ALL USING (auth.uid() = user_id);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_alertas_recorrentes_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_alertas_recorrentes_updated_at
  BEFORE UPDATE ON alertas_recorrentes
  FOR EACH ROW EXECUTE FUNCTION update_alertas_recorrentes_updated_at();

-- Comentário
COMMENT ON TABLE alertas_recorrentes IS
  'Contas e boletos recorrentes. O sistema auto-gera eventos de vencimento na agenda_eventos todo mês.';
