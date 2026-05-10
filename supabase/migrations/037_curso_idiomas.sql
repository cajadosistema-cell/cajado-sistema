CREATE TABLE IF NOT EXISTS public.curso_progresso (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    curso VARCHAR(50) NOT NULL DEFAULT 'ingles',
    licao_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'iniciada' CHECK (status IN ('iniciada', 'concluida')),
    score INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, curso, licao_id)
);

ALTER TABLE public.curso_progresso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso total curso_progresso" ON public.curso_progresso
    FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

CREATE TRIGGER set_updated_at_curso_progresso BEFORE UPDATE ON public.curso_progresso
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
