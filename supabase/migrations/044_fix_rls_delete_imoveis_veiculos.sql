-- ================================================================
-- MIGRATION 044 - Corrige RLS para garantir DELETE em imoveis e veiculos
-- ================================================================

-- Garante que imoveis tem políticas separadas para cada operação
DROP POLICY IF EXISTS "imoveis_por_empresa"   ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_all"           ON public.imoveis;
DROP POLICY IF EXISTS "empresa_imoveis"       ON public.imoveis;

CREATE POLICY "imoveis_select" ON public.imoveis
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );

CREATE POLICY "imoveis_insert" ON public.imoveis
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );

CREATE POLICY "imoveis_update" ON public.imoveis
  FOR UPDATE TO authenticated
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

CREATE POLICY "imoveis_delete" ON public.imoveis
  FOR DELETE TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );

-- ================================================================
-- Veiculos: garante DELETE também
-- ================================================================
DROP POLICY IF EXISTS "empresa_veiculos"     ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_por_empresa" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_all"         ON public.veiculos;

CREATE POLICY "veiculos_select" ON public.veiculos
  FOR SELECT TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );

CREATE POLICY "veiculos_insert" ON public.veiculos
  FOR INSERT TO authenticated
  WITH CHECK (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );

CREATE POLICY "veiculos_update" ON public.veiculos
  FOR UPDATE TO authenticated
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

CREATE POLICY "veiculos_delete" ON public.veiculos
  FOR DELETE TO authenticated
  USING (
    empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );
