-- Tabela: parceiro_servicos
CREATE TABLE IF NOT EXISTS public.parceiro_servicos (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
    parceiro_id UUID NOT NULL REFERENCES public.parceiros(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    valor_bruto NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    porcentagem NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    comissao NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Garantir que a coluna empresa_id existe caso a tabela já tivesse sido criada antes
ALTER TABLE public.parceiro_servicos ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE;

-- Habilitar RLS
ALTER TABLE public.parceiro_servicos ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
DROP POLICY IF EXISTS "Isolamento por empresa - parceiro_servicos" ON public.parceiro_servicos;

CREATE POLICY "Isolamento por empresa - parceiro_servicos" ON public.parceiro_servicos
    FOR ALL
    USING (
        empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    )
    WITH CHECK (
        empresa_id = (SELECT empresa_id FROM public.usuarios WHERE id = auth.uid())
    );

-- Gatilho para preencher empresa_id automaticamente
DROP TRIGGER IF EXISTS trg_auto_empresa_parceiro_servicos ON public.parceiro_servicos;
CREATE TRIGGER trg_auto_empresa_parceiro_servicos
    BEFORE INSERT ON public.parceiro_servicos
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_empresa_id();
