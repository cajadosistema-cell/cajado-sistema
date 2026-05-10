CREATE TABLE IF NOT EXISTS public.faturas_cartoes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conta_id UUID NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
    mes_referencia VARCHAR(7) NOT NULL,
    valor_fechado NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(conta_id, mes_referencia)
);

-- Policies
ALTER TABLE public.faturas_cartoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total faturas_cartoes" ON public.faturas_cartoes
    FOR ALL USING (true);
