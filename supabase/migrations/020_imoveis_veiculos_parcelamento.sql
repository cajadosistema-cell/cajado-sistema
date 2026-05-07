-- ================================================================
-- SISTEMA CAJADO - MIGRATION 020
-- Adiciona parcelamento em imoveis e cria tabela veiculos
-- ================================================================

-- Campos adicionais de parcelamento / financiamento no imóvel
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
-- Tabela de Veículos
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
