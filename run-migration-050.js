// run-migration-050.js — Corrige RLS da tabela contas para isolamento por user_id
const SUPABASE_URL = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'

const statements = [
  // Remove policies antigas
  `DROP POLICY IF EXISTS "Isolamento de contas PJ e PF" ON public.contas`,
  `DROP POLICY IF EXISTS "Isolamento de contas PJ e PT" ON public.contas`,
  `DROP POLICY IF EXISTS "contas_isolamento" ON public.contas`,
  `DROP POLICY IF EXISTS "auth_all" ON public.contas`,
  `DROP POLICY IF EXISTS "contas_pf_por_usuario" ON public.contas`,
  `DROP POLICY IF EXISTS "contas_pj_por_empresa" ON public.contas`,

  // Policy PF — isolado por user_id
  `CREATE POLICY "contas_pf_por_usuario" ON public.contas
    FOR ALL TO authenticated
    USING (categoria = 'pf' AND user_id = auth.uid())
    WITH CHECK (categoria = 'pf' AND user_id = auth.uid())`,

  // Policy PJ — isolado por empresa_id
  `CREATE POLICY "contas_pj_por_empresa" ON public.contas
    FOR ALL TO authenticated
    USING (
      categoria = 'pj'
      AND empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid())
    )
    WITH CHECK (
      categoria = 'pj'
      AND empresa_id IN (SELECT empresa_id FROM public.perfis WHERE id = auth.uid())
    )`,

  // Garante RLS habilitado
  `ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY`,
]

const verificacao = `
  SELECT policyname, cmd, 
         pg_get_expr(qual, 'public.contas'::regclass) as using_expr
  FROM pg_policies 
  WHERE tablename = 'contas'
  ORDER BY policyname
`

async function runSql(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_raw_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  return res
}

async function runViaPostgrest(sql) {
  // Usa o endpoint de query direto do Supabase Management API
  const res = await fetch(`${SUPABASE_URL}/rest/v1/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'Prefer': 'return=representation',
    },
    body: JSON.stringify({ query: sql }),
  })
  const text = await res.text()
  return { status: res.status, body: text }
}

async function main() {
  console.log('=== Migration 050 — Corrigindo RLS da tabela contas ===\n')
  
  for (const stmt of statements) {
    const label = stmt.substring(0, 60).replace(/\s+/g, ' ').trim() + '...'
    try {
      // Usa a API de administração do Supabase
      const res = await fetch(`${SUPABASE_URL}/pg/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: stmt }),
      })
      
      if (res.ok) {
        console.log(`✅ ${label}`)
      } else {
        const body = await res.text()
        // Se for 404 nesse endpoint, tenta outro
        if (res.status === 404) {
          console.log(`⚠️  Endpoint /pg/query não disponível, status: ${res.status}`)
          break
        }
        console.log(`⚠️  ${label}\n   Status: ${res.status} — ${body.substring(0, 100)}`)
      }
    } catch (err) {
      console.log(`❌ ${label}\n   Erro: ${err.message}`)
    }
  }

  console.log('\n=== Verificação das policies ===')
  try {
    const res = await fetch(`${SUPABASE_URL}/pg/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ query: verificacao }),
    })
    const data = await res.json()
    console.log(JSON.stringify(data, null, 2))
  } catch (e) {
    console.log('Verificação não disponível via API direta.')
  }

  console.log('\n📋 Alternativamente, execute o arquivo abaixo manualmente no Supabase SQL Editor:')
  console.log('   supabase/migrations/050_fix_rls_contas_isolamento.sql')
}

main().catch(console.error)
