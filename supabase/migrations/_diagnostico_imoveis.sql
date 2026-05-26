-- ================================================================
-- DIAGNÓSTICO: verifica estado dos imóveis e empresa_id do usuário
-- Rode cada bloco separadamente no SQL Editor do Supabase
-- ================================================================

-- 1. Ver todos os imóveis e seus empresa_id
SELECT 
  id, 
  titulo, 
  empresa_id,
  criado_em
FROM public.imoveis
ORDER BY criado_em DESC;

-- ================================================================
-- 2. Ver empresa_id do usuário atual (troque o email abaixo)
-- ================================================================
SELECT 
  p.id AS perfil_id, 
  p.nome, 
  p.empresa_id,
  u.email
FROM public.perfis p
JOIN auth.users u ON u.id = p.id
ORDER BY p.empresa_id;

-- ================================================================
-- 3. Verificar se empresa_id dos imóveis bate com algum perfil
-- ================================================================
SELECT 
  i.id,
  i.titulo,
  i.empresa_id AS imovel_empresa_id,
  p.empresa_id AS perfil_empresa_id,
  CASE WHEN i.empresa_id = p.empresa_id THEN '✅ OK' ELSE '❌ DIVERGENTE' END AS status
FROM public.imoveis i
CROSS JOIN public.perfis p
WHERE p.id = auth.uid();

-- ================================================================
-- 4. CORREÇÃO: atualiza empresa_id dos imóveis que estão NULL
--    ou que pertencem ao usuário mas com empresa errada
-- ================================================================

-- Primeiro, veja quantos imóveis têm empresa_id NULL
SELECT COUNT(*) AS imoveis_sem_empresa FROM public.imoveis WHERE empresa_id IS NULL;

-- Se houver imóveis com empresa_id NULL, este comando corrige:
-- (descomente e execute apenas se necessário)
/*
UPDATE public.imoveis
SET empresa_id = (
  SELECT empresa_id FROM public.perfis WHERE id = auth.uid() LIMIT 1
)
WHERE empresa_id IS NULL;
*/

-- ================================================================
-- 5. CORREÇÃO DEFINITIVA: desabilita RLS temporariamente e
--    recria com política permissiva (só se nada funcionar)
-- ================================================================
-- CUIDADO: execute apenas como último recurso
/*
ALTER TABLE public.imoveis DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.imoveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "imoveis_select" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_insert" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_update" ON public.imoveis;
DROP POLICY IF EXISTS "imoveis_delete" ON public.imoveis;

-- Política permissiva: qualquer usuário autenticado pode fazer tudo
CREATE POLICY "imoveis_auth_all" ON public.imoveis
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
*/
