-- ====================================================================
-- Migração 085: Open Finance (Conexões Bancárias, Saldos e Extratos Automáticos)
-- ====================================================================

-- 1. Tabela de Conexões Open Finance (Pluggy / Agregadores)
CREATE TABLE IF NOT EXISTS public.open_finance_conexoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL DEFAULT 'pluggy',
    item_id TEXT NOT NULL UNIQUE,
    connector_id INTEGER,
    connector_name VARCHAR(150) NOT NULL,
    connector_logo_url TEXT,
    connector_color VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'UPDATED',
    execution_status VARCHAR(50),
    error_message TEXT,
    last_sync_at TIMESTAMPTZ,
    consent_expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Adicionar colunas de Open Finance na tabela de Contas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contas' AND column_name='open_finance_id') THEN
        ALTER TABLE public.contas ADD COLUMN open_finance_id TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contas' AND column_name='open_finance_conexao_id') THEN
        ALTER TABLE public.contas ADD COLUMN open_finance_conexao_id UUID REFERENCES public.open_finance_conexoes(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contas' AND column_name='open_finance_sincronizado_em') THEN
        ALTER TABLE public.contas ADD COLUMN open_finance_sincronizado_em TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='contas' AND column_name='open_finance_sync_auto') THEN
        ALTER TABLE public.contas ADD COLUMN open_finance_sync_auto BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- 3. Adicionar colunas de Open Finance na tabela de Lançamentos
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lancamentos' AND column_name='open_finance_id') THEN
        ALTER TABLE public.lancamentos ADD COLUMN open_finance_id TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_lancamentos_open_finance_id ON public.lancamentos(open_finance_id) WHERE open_finance_id IS NOT NULL;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lancamentos' AND column_name='open_finance_tipo') THEN
        ALTER TABLE public.lancamentos ADD COLUMN open_finance_tipo VARCHAR(50);
    END IF;
END $$;

-- 4. Tabela de Auditoria e Logs de Eventos do Open Finance
CREATE TABLE IF NOT EXISTS public.open_finance_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
    conexao_id UUID REFERENCES public.open_finance_conexoes(id) ON DELETE CASCADE,
    evento VARCHAR(100) NOT NULL,
    payload JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_open_finance_conexoes_empresa ON public.open_finance_conexoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_open_finance_conexoes_item ON public.open_finance_conexoes(item_id);
CREATE INDEX IF NOT EXISTS idx_contas_open_finance_id ON public.contas(open_finance_id);
CREATE INDEX IF NOT EXISTS idx_contas_open_finance_conexao ON public.contas(open_finance_conexao_id);

-- RLS (Row Level Security)
ALTER TABLE public.open_finance_conexoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.open_finance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura de conexoes para membros da empresa"
    ON public.open_finance_conexoes
    FOR SELECT
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.usuarios_perfis WHERE user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.funcionarios WHERE id = auth.uid() AND empresa_id = public.open_finance_conexoes.empresa_id
        )
        OR
        auth.role() = 'service_role'
    );

CREATE POLICY "Permitir mutacao de conexoes para membros da empresa"
    ON public.open_finance_conexoes
    FOR ALL
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.usuarios_perfis WHERE user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.funcionarios WHERE id = auth.uid() AND empresa_id = public.open_finance_conexoes.empresa_id
        )
        OR
        auth.role() = 'service_role'
    );

CREATE POLICY "Permitir leitura de logs para membros da empresa"
    ON public.open_finance_logs
    FOR SELECT
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.usuarios_perfis WHERE user_id = auth.uid()
        )
        OR
        auth.role() = 'service_role'
    );

CREATE POLICY "Permitir insercao de logs"
    ON public.open_finance_logs
    FOR INSERT
    WITH CHECK (true);
