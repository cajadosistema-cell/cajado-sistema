-- ====================================================================
-- Migração 086: Credenciais Pluggy por Empresa
-- Permite que cada empresa salve seu próprio Client ID e Client Secret
-- do Pluggy para acessar Items criados no portal Meu Pluggy ou conta própria.
-- ====================================================================

-- 1. Tabela de credenciais Pluggy por empresa
CREATE TABLE IF NOT EXISTS public.open_finance_credenciais (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL DEFAULT 'pluggy',
    client_id TEXT NOT NULL,
    client_secret TEXT NOT NULL,
    label VARCHAR(150) DEFAULT 'Minha Conta Pluggy',
    ativo BOOLEAN DEFAULT TRUE,
    validated_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(empresa_id, provider)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_open_finance_credenciais_empresa ON public.open_finance_credenciais(empresa_id);

-- RLS
ALTER TABLE public.open_finance_credenciais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir leitura de credenciais para membros da empresa" ON public.open_finance_credenciais;
DROP POLICY IF EXISTS "Permitir mutacao de credenciais para membros da empresa" ON public.open_finance_credenciais;

CREATE POLICY "Permitir leitura de credenciais para membros da empresa"
    ON public.open_finance_credenciais
    FOR SELECT
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
        )
        OR
        auth.role() = 'service_role'
    );

CREATE POLICY "Permitir mutacao de credenciais para membros da empresa"
    ON public.open_finance_credenciais
    FOR ALL
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
        )
        OR
        auth.role() = 'service_role'
    );

-- 2. Adicionar referência opcional de credencial na tabela de conexões
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='open_finance_conexoes' AND column_name='credencial_id') THEN
        ALTER TABLE public.open_finance_conexoes ADD COLUMN credencial_id UUID REFERENCES public.open_finance_credenciais(id) ON DELETE SET NULL;
    END IF;
END $$;
