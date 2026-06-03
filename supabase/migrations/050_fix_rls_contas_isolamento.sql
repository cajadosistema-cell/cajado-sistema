-- ================================================================
-- SISTEMA CAJADO - MIGRATION 050
-- Corrige RLS da tabela contas para isolamento total entre contas:
--   - Contas PF (pessoal): isoladas por user_id (só o próprio dono)
--   - Contas PJ (empresa): isoladas por empresa_id (toda a empresa)
-- Problema: Elena estava mostrando cartões/contas de outros usuários
--           ao usar buscar_contas sem filtro de user_id no código.
--           O código foi corrigido (useElenaSalvar.ts), e esta migration
--           adiciona a proteção na camada do banco como garantia extra.
-- ================================================================

-- Remove todas as policies existentes na tabela contas para recriar corretamente
DROP POLICY IF EXISTS "Isolamento de contas PJ e PF"      ON public.contas;
DROP POLICY IF EXISTS "Isolamento de contas PJ e PT"      ON public.contas;
DROP POLICY IF EXISTS "contas_isolamento"                  ON public.contas;
DROP POLICY IF EXISTS "auth_all"                           ON public.contas;
DROP POLICY IF EXISTS "contas_pf_por_usuario"              ON public.contas;
DROP POLICY IF EXISTS "contas_pj_por_empresa"              ON public.contas;

-- ── Policy 1: Contas PF — isoladas por user_id ────────────────────
-- Cada usuário vê/opera APENAS suas próprias contas pessoais
CREATE POLICY "contas_pf_por_usuario" ON public.contas
  FOR ALL TO authenticated
  USING (
    categoria = 'pf'
    AND user_id = auth.uid()
  )
  WITH CHECK (
    categoria = 'pf'
    AND user_id = auth.uid()
  );

-- ── Policy 2: Contas PJ — isoladas por empresa_id ─────────────────
-- Usuários da mesma empresa veem as contas PJ da empresa
CREATE POLICY "contas_pj_por_empresa" ON public.contas
  FOR ALL TO authenticated
  USING (
    categoria = 'pj'
    AND empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    categoria = 'pj'
    AND empresa_id IN (
      SELECT empresa_id FROM public.perfis WHERE id = auth.uid()
    )
  );

-- ── Garante que RLS está habilitado ──────────────────────────────
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;

-- ── Verificação ───────────────────────────────────────────────────
-- Execute para confirmar as policies criadas:
-- SELECT policyname, cmd, 
--        pg_get_expr(qual, 'public.contas'::regclass) as using_expr
-- FROM pg_policies 
-- WHERE tablename = 'contas'
-- ORDER BY policyname;
