-- ============================================================
-- SISTEMA CAJADO - MIGRATION 018
-- Isola cartões e contas da categoria PF por usuário
-- ============================================================

-- 1. Adiciona coluna user_id
ALTER TABLE public.contas 
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Trigger para preencher user_id automaticamente caso seja PF e não venha preenchido
CREATE OR REPLACE FUNCTION public.set_conta_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.categoria = 'pf' AND NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_conta_user_id ON public.contas;
CREATE TRIGGER trg_set_conta_user_id
  BEFORE INSERT ON public.contas
  FOR EACH ROW EXECUTE FUNCTION public.set_conta_user_id();

-- 3. Atualizar as contas PF existentes para não sumirem da interface
-- Atribuimos os cartões PF órfãos para o Dono da Empresa (owner_id)
UPDATE public.contas c
SET user_id = e.owner_id
FROM public.empresas e
WHERE c.empresa_id = e.id AND c.categoria = 'pf' AND c.user_id IS NULL;

-- 4. Atualizar a RLS da tabela de contas
DROP POLICY IF EXISTS "Isolamento por empresa" ON public.contas;
DROP POLICY IF EXISTS "Isolamento de contas PJ e PF" ON public.contas;

-- A política agora diz:
-- - Contas PJ: Acessíveis por todos da mesma empresa
-- - Contas PF: Acessíveis apenas se o user_id for o do usuário logado
CREATE POLICY "Isolamento de contas PJ e PF" ON public.contas
  FOR ALL TO authenticated
  USING (
    empresa_id = public.get_empresa_id() 
    AND (categoria = 'pj' OR user_id = auth.uid())
  )
  WITH CHECK (
    empresa_id = public.get_empresa_id() 
    AND (categoria = 'pj' OR user_id = auth.uid())
  );
