-- ================================================================
-- SISTEMA CAJADO - MIGRATION 072
-- Isolamento de Ativos e Patrimônio por Usuário (user_id)
-- Max (owner/admin) continua vendo tudo, funcionários só veem o deles.
-- ================================================================

-- 1. Adicionar colunas user_id se não existirem
ALTER TABLE public.ativos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.movimentacoes_ativos ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.projetos_patrimonio ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Migrar registros existentes: associar os dados já criados ao dono da empresa
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, owner_id FROM public.empresas LOOP
    UPDATE public.ativos SET user_id = r.owner_id WHERE empresa_id = r.id AND user_id IS NULL;
    UPDATE public.movimentacoes_ativos SET user_id = r.owner_id WHERE empresa_id = r.id AND user_id IS NULL;
    UPDATE public.projetos_patrimonio SET user_id = r.owner_id WHERE empresa_id = r.id AND user_id IS NULL;
  END LOOP;
END $$;

-- 3. Recriar RLS para ativos
DROP POLICY IF EXISTS "Isolamento por empresa" ON public.ativos;
DROP POLICY IF EXISTS "ativos_isolamento" ON public.ativos;

CREATE POLICY "ativos_isolamento" ON public.ativos
  FOR ALL TO authenticated
  USING (
    empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid())
    AND (
      user_id = auth.uid() OR
      'admin' = (SELECT role FROM public.perfis WHERE id = auth.uid() LIMIT 1) OR
      'owner' = (SELECT role FROM public.perfis WHERE id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid())
  );

-- 4. Recriar RLS para projetos_patrimonio
DROP POLICY IF EXISTS "Isolamento por empresa" ON public.projetos_patrimonio;
DROP POLICY IF EXISTS "patrimonio_isolamento" ON public.projetos_patrimonio;

CREATE POLICY "patrimonio_isolamento" ON public.projetos_patrimonio
  FOR ALL TO authenticated
  USING (
    empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid())
    AND (
      user_id = auth.uid() OR
      'admin' = (SELECT role FROM public.perfis WHERE id = auth.uid() LIMIT 1) OR
      'owner' = (SELECT role FROM public.perfis WHERE id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid())
  );

-- 5. Recriar RLS para movimentacoes_ativos
DROP POLICY IF EXISTS "Isolamento por empresa" ON public.movimentacoes_ativos;
DROP POLICY IF EXISTS "movimentacoes_ativos_isolamento" ON public.movimentacoes_ativos;

CREATE POLICY "movimentacoes_ativos_isolamento" ON public.movimentacoes_ativos
  FOR ALL TO authenticated
  USING (
    empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid())
    AND (
      user_id = auth.uid() OR
      'admin' = (SELECT role FROM public.perfis WHERE id = auth.uid() LIMIT 1) OR
      'owner' = (SELECT role FROM public.perfis WHERE id = auth.uid() LIMIT 1)
    )
  )
  WITH CHECK (
    empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid())
  );
