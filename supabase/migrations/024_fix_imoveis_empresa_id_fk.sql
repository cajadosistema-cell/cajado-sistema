-- ================================================================
-- MIGRATION 024 - Corrige FK imoveis.empresa_id
-- A FK estava apontando para perfis.id (errado)
-- Deve apontar para empresas.id (correto para multi-tenant)
-- ================================================================

-- 1. Remove a FK errada
ALTER TABLE public.imoveis DROP CONSTRAINT IF EXISTS imoveis_empresa_id_fkey;

-- 2. Atualiza registros existentes que têm empresa_id = perfis.id
--    substituindo pelo empresa_id correto do perfil do usuário
UPDATE public.imoveis i
SET empresa_id = p.empresa_id
FROM public.perfis p
WHERE i.empresa_id = p.id;

-- 3. Remove registros com empresa_id ainda nulo ou inválido (opcional - comentado por segurança)
-- DELETE FROM public.imoveis WHERE empresa_id NOT IN (SELECT id FROM public.empresas);

-- 4. Adiciona a FK correta apontando para empresas.id
ALTER TABLE public.imoveis
  ADD CONSTRAINT imoveis_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

-- 5. Recria a RLS policy (garante consistência)
DROP POLICY IF EXISTS "imoveis_por_empresa" ON public.imoveis;
CREATE POLICY "imoveis_por_empresa" ON public.imoveis
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
