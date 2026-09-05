-- ====================================================================
-- Migração 084: Tabela de Fluxogramas e Processos (POPs)
-- ====================================================================

CREATE TABLE IF NOT EXISTS public.fluxogramas_processos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    titulo VARCHAR(255) NOT NULL,
    categoria VARCHAR(100) NOT NULL DEFAULT 'Empresa',
    descricao TEXT,
    versao VARCHAR(20) DEFAULT '1.0',
    responsavel VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    nos JSONB NOT NULL DEFAULT '[]'::jsonb,
    conexoes JSONB NOT NULL DEFAULT '[]'::jsonb,
    is_ativo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para buscas rápidas por empresa e categoria
CREATE INDEX IF NOT EXISTS idx_fluxogramas_empresa_id ON public.fluxogramas_processos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fluxogramas_categoria ON public.fluxogramas_processos(empresa_id, categoria);

-- RLS
ALTER TABLE public.fluxogramas_processos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura para membros da mesma empresa"
    ON public.fluxogramas_processos
    FOR SELECT
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.usuarios_perfis WHERE user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.funcionarios WHERE id = auth.uid() AND empresa_id = public.fluxogramas_processos.empresa_id
        )
        OR
        auth.role() = 'service_role'
    );

CREATE POLICY "Permitir inserção e atualização para membros da empresa"
    ON public.fluxogramas_processos
    FOR ALL
    USING (
        empresa_id IN (
            SELECT empresa_id FROM public.usuarios_perfis WHERE user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.funcionarios WHERE id = auth.uid() AND empresa_id = public.fluxogramas_processos.empresa_id
        )
        OR
        auth.role() = 'service_role'
    );
