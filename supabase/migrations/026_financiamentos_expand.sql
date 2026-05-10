-- ================================================================
-- MIGRATION 026 - Expande tabela financiamentos
-- Adiciona tipo, título, análise de quitação antecipada e campos IA
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

-- Renomeia vencimento_dia para dia_vencimento (padrão do sistema)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name='financiamentos' AND column_name='vencimento_dia') THEN
    ALTER TABLE public.financiamentos RENAME COLUMN vencimento_dia TO dia_vencimento;
  END IF;
END $$;

-- Renomeia prazo_meses para parcelas_total (padrão do sistema)
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
