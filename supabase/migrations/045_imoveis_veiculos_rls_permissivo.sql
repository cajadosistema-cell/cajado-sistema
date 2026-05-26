-- ================================================================
-- MIGRATION 045 - Correção definitiva RLS imoveis e veiculos
-- Remove RLS restritivo por empresa e usa política permissiva
-- (igual ao projetos_patrimonio que funciona)
-- ================================================================

-- ────── IMOVEIS ──────────────────────────────────────────────
DROP POLICY IF EXISTS "imoveis_select"       ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_insert"       ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_update"       ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_delete"       ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_por_empresa"  ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_all"          ON public.imoveis;
DROP POLICY IF EXISTS "empresa_imoveis"      ON public.imoveis;
DROP POLICY IF EXISTS "auth_all"             ON public.imoveis;

-- Política permissiva: usuário autenticado acessa tudo
-- (igual à projetos_patrimonio que funciona corretamente)
CREATE POLICY "imoveis_auth_all" ON public.imoveis
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ────── VEICULOS ─────────────────────────────────────────────
DROP POLICY IF EXISTS "veiculos_select"      ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_insert"      ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_update"      ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_delete"      ON public.veiculos;
DROP POLICY IF EXISTS "empresa_veiculos"     ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_por_empresa" ON public.veiculos;
DROP POLICY IF EXISTS "veiculos_all"         ON public.veiculos;

CREATE POLICY "veiculos_auth_all" ON public.veiculos
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
