ALTER TABLE public.gastos_pessoais ADD COLUMN IF NOT EXISTS conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL;
ALTER TABLE public.receitas_pessoais ADD COLUMN IF NOT EXISTS conta_id UUID REFERENCES public.contas(id) ON DELETE SET NULL;
