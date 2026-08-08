-- ================================================================
-- MIGRATION 078 - Corrige FK financiamentos.empresa_id
-- A FK estava apontando para perfis.id (errado)
-- Deve apontar para empresas.id (correto para multi-tenant)
-- ================================================================

-- 1. Remove a FK errada
ALTER TABLE public.financiamentos DROP CONSTRAINT IF EXISTS financiamentos_empresa_id_fkey;

-- 2. Atualiza registros existentes que têm empresa_id = perfis.id
--    substituindo pelo empresa_id correto do perfil do usuário
UPDATE public.financiamentos f
SET empresa_id = p.empresa_id
FROM public.perfis p
WHERE f.empresa_id = p.id;

-- 3. Adiciona a FK correta apontando para empresas.id
ALTER TABLE public.financiamentos
  ADD CONSTRAINT financiamentos_empresa_id_fkey
  FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;

-- 4. Recria a RLS policy (garante consistência caso precise)
ALTER TABLE public.financiamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financiamentos_por_empresa" ON public.financiamentos;
CREATE POLICY "financiamentos_por_empresa" ON public.financiamentos
  FOR ALL
  USING (empresa_id = public.get_empresa_id())
  WITH CHECK (empresa_id = public.get_empresa_id());
