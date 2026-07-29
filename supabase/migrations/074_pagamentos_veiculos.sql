-- ============================================================
-- SISTEMA CAJADO - MIGRATION 074
-- Cria tabela pagamentos_veiculos para rastrear histórico de
-- parcelas pagas de veículos financiados (mesma estrutura de
-- pagamentos_imoveis).
-- ============================================================

-- 1) Cria tabela pagamentos_veiculos
CREATE TABLE IF NOT EXISTS public.pagamentos_veiculos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  veiculo_id UUID NOT NULL REFERENCES public.veiculos(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes_referencia VARCHAR(7) NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','parcial','atrasado')),
  valor_pago NUMERIC(12,2),
  data_pagamento DATE,
  conta_origem_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(veiculo_id, mes_referencia)
);

ALTER TABLE public.pagamentos_veiculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagamentos_veiculos_empresa" ON public.pagamentos_veiculos
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

CREATE INDEX IF NOT EXISTS idx_pagamentos_veiculos_empresa
  ON public.pagamentos_veiculos(empresa_id, mes_referencia);

CREATE INDEX IF NOT EXISTS idx_pagamentos_veiculos_veiculo
  ON public.pagamentos_veiculos(veiculo_id, mes_referencia);

-- 2) Garantir que pagamentos_imoveis existe (pode ter sido criada via Elena)
CREATE TABLE IF NOT EXISTS public.pagamentos_imoveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imovel_id UUID NOT NULL REFERENCES public.imoveis(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  mes_referencia VARCHAR(7) NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','pago','parcial','atrasado')),
  valor_pago NUMERIC(12,2),
  data_pagamento DATE,
  conta_origem_id UUID REFERENCES public.contas(id) ON DELETE SET NULL,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(imovel_id, mes_referencia)
);

ALTER TABLE public.pagamentos_imoveis ENABLE ROW LEVEL SECURITY;

-- Política RLS (idempotente — DROP IF EXISTS primeiro)
DROP POLICY IF EXISTS "pagamentos_imoveis_empresa" ON public.pagamentos_imoveis;
CREATE POLICY "pagamentos_imoveis_empresa" ON public.pagamentos_imoveis
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

CREATE INDEX IF NOT EXISTS idx_pagamentos_imoveis_empresa
  ON public.pagamentos_imoveis(empresa_id, mes_referencia);

-- Verificação
SELECT 'Migration 074 OK — pagamentos_veiculos + pagamentos_imoveis garantidas' AS status;
