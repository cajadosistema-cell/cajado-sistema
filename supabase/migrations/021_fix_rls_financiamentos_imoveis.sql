-- ================================================================
-- SISTEMA CAJADO - MIGRATION 021
-- Corrige RLS: remove politicas permissivas e adiciona isolamento
-- correto por empresa em financiamentos e imoveis
-- ================================================================

-- Remove politicas que permitiam acesso irrestrito a todos os usuarios
DROP POLICY IF EXISTS "auth_all"           ON public.contas;
DROP POLICY IF EXISTS "auth_all"           ON public.lancamentos;
DROP POLICY IF EXISTS "financiamentos_all" ON public.financiamentos;
DROP POLICY IF EXISTS "imoveis_all"        ON public.imoveis;

-- Financiamentos: isolamento correto por empresa
CREATE POLICY "financiamentos_por_empresa" ON public.financiamentos
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

-- Imoveis: isolamento correto por empresa
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
