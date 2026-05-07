-- ================================================================
-- AUDITORIA DE ISOLAMENTO DE CONTAS
-- Confirma que max@cajado.com está isolado de admin@visiopro.com
-- Execute no SQL Editor do Supabase como Service Role
-- ================================================================

-- 1. IDENTIFICAR OS USUÁRIOS E SUAS EMPRESAS
SELECT
  u.email,
  u.id AS user_id,
  p.empresa_id,
  e.nome AS empresa_nome
FROM auth.users u
LEFT JOIN public.perfis p ON p.id = u.id
LEFT JOIN public.empresas e ON e.id = p.empresa_id
WHERE u.email IN ('max@cajado.com', 'admin@visiopro.com')
ORDER BY u.email;

-- ================================================================
-- 2. VERIFICAR SE AS EMPRESAS SÃO DIFERENTES
-- Esperado: empresa_id DIFERENTE para cada email
-- ================================================================
SELECT
  COUNT(DISTINCT p.empresa_id) AS total_empresas_distintas,
  CASE
    WHEN COUNT(DISTINCT p.empresa_id) > 1 THEN '✅ ISOLADO — empresas diferentes'
    ELSE '❌ PROBLEMA — mesma empresa'
  END AS resultado_isolamento
FROM auth.users u
JOIN public.perfis p ON p.id = u.id
WHERE u.email IN ('max@cajado.com', 'admin@visiopro.com');

-- ================================================================
-- 3. CONTAS PF — verificar isolamento por user_id
-- Esperado: cada user só vê suas próprias contas PF
-- ================================================================
SELECT
  u.email,
  c.nome AS conta_nome,
  c.categoria,
  c.user_id,
  CASE
    WHEN c.user_id = u.id THEN '✅ Conta do próprio usuário'
    ELSE '❌ VAZAMENTO — conta de outro usuário!'
  END AS status_isolamento
FROM auth.users u
JOIN public.perfis p ON p.id = u.id
JOIN public.contas c ON c.empresa_id = p.empresa_id AND c.categoria = 'pf'
WHERE u.email IN ('max@cajado.com', 'admin@visiopro.com')
ORDER BY u.email, c.nome;

-- ================================================================
-- 4. GASTOS PESSOAIS — isolamento por user_id
-- ================================================================
SELECT
  u.email,
  COUNT(g.id) AS total_gastos,
  SUM(g.valor) AS soma_gastos
FROM auth.users u
JOIN public.gastos_pessoais g ON g.user_id = u.id
WHERE u.email IN ('max@cajado.com', 'admin@visiopro.com')
GROUP BY u.email;

-- ================================================================
-- 5. LANÇAMENTOS PJ — isolamento por empresa
-- Esperado: lançamentos de max não aparecem para admin e vice-versa
-- ================================================================
SELECT
  u.email,
  e.nome AS empresa,
  COUNT(l.id) AS total_lancamentos,
  SUM(l.valor) AS soma_valores
FROM auth.users u
JOIN public.perfis p ON p.id = u.id
JOIN public.empresas e ON e.id = p.empresa_id
LEFT JOIN public.lancamentos l ON l.conta_id IN (
  SELECT id FROM public.contas WHERE empresa_id = p.empresa_id
)
WHERE u.email IN ('max@cajado.com', 'admin@visiopro.com')
GROUP BY u.email, e.nome;

-- ================================================================
-- 6. RLS POLICIES ATIVAS — confirma que proteção existe
-- ================================================================
SELECT
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename IN (
  'contas', 'lancamentos', 'gastos_pessoais', 'receitas_pessoais',
  'orcamentos_pessoais', 'imoveis', 'veiculos', 'financiamentos'
)
ORDER BY tablename, policyname;

-- ================================================================
-- 7. RESUMO FINAL — VEREDICTO DE ISOLAMENTO
-- ================================================================
WITH usuarios AS (
  SELECT u.id, u.email, p.empresa_id
  FROM auth.users u
  JOIN public.perfis p ON p.id = u.id
  WHERE u.email IN ('max@cajado.com', 'admin@visiopro.com')
),
verificacao AS (
  SELECT
    (SELECT COUNT(DISTINCT empresa_id) FROM usuarios) > 1 AS empresas_separadas,
    (
      SELECT COUNT(*) FROM public.contas c
      JOIN usuarios u1 ON u1.email = 'max@cajado.com'
      JOIN usuarios u2 ON u2.email = 'admin@visiopro.com'
      WHERE c.categoria = 'pf'
        AND c.user_id = u1.id
        AND c.empresa_id = u2.empresa_id
    ) = 0 AS contas_pf_isoladas
)
SELECT
  empresas_separadas,
  contas_pf_isoladas,
  CASE
    WHEN empresas_separadas AND contas_pf_isoladas
    THEN '🔒 SEGURO — Contas completamente isoladas'
    WHEN NOT empresas_separadas
    THEN '⚠️  ATENÇÃO — Usuários na mesma empresa (verifique se é intencional)'
    ELSE '❌ VULNERABILIDADE DETECTADA — Revisar RLS'
  END AS veredicto
FROM verificacao;
