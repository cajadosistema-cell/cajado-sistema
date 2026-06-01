/**
 * diag-cartoes-max.js
 * Diagnóstico: por que os cartões do Sr. Max sumiram?
 * Uso: node diag-cartoes-max.js
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

async function run() {
  console.log('=== DIAGNÓSTICO: CARTÕES DO SR. MAX ===\n')

  // 1. Encontrar o user_id do Sr. Max
  console.log('1. Buscando usuário max@cajado.com na tabela auth.users...')
  const { data: users, error: userErr } = await supabase.auth.admin.listUsers()
  if (userErr) {
    console.error('   Erro ao listar users:', userErr.message)
  }
  const maxUser = users?.users?.find(u => u.email === 'max@cajado.com')
  if (!maxUser) {
    console.log('   ⚠️  Usuário max@cajado.com NÃO encontrado no auth!')
  } else {
    console.log(`   ✅ Encontrado! user_id = ${maxUser.id}`)
    console.log(`   Email confirmado: ${maxUser.email_confirmed_at ? 'Sim' : 'Não'}`)
  }

  const userId = maxUser?.id

  console.log('\n2. Buscando TODOS os cartões da tabela contas (sem filtros)...')
  const { data: todosCartoes } = await supabase
    .from('contas')
    .select('id, user_id, empresa_id, nome, nome_cartao, tipo, categoria, bandeira, ativo')
    .in('tipo', ['cartao_credito', 'cartao_debito'])

  console.log(`   Total de cartões no banco: ${todosCartoes?.length ?? 0}`)
  if (todosCartoes?.length) {
    for (const c of todosCartoes) {
      const dono = c.user_id === userId ? '✅ SR MAX' : `outro (${c.user_id?.substring(0,8)}...)`
      console.log(`   - "${c.nome_cartao || c.nome}" | tipo=${c.tipo} | cat=${c.categoria} | ativo=${c.ativo} | dono=${dono}`)
    }
  }

  if (userId) {
    console.log(`\n3. Buscando cartões com user_id=${userId} (como o sistema faz)...`)
    const { data: cartoesPF } = await supabase
      .from('contas')
      .select('id, nome, nome_cartao, tipo, categoria, bandeira, ativo')
      .eq('user_id', userId)
      .eq('categoria', 'pf')
      .in('tipo', ['cartao_credito', 'cartao_debito'])
      .eq('ativo', true)

    console.log(`   Cartões PF ativos encontrados pela query do sistema: ${cartoesPF?.length ?? 0}`)
    if (cartoesPF?.length) {
      for (const c of cartoesPF) {
        console.log(`   - "${c.nome_cartao || c.nome}" | tipo=${c.tipo} | cat=${c.categoria}`)
      }
    }

    console.log(`\n4. Buscando cartões do Max SEM filtro de categoria...`)
    const { data: semCat } = await supabase
      .from('contas')
      .select('id, nome, nome_cartao, tipo, categoria, bandeira, ativo')
      .eq('user_id', userId)
      .in('tipo', ['cartao_credito', 'cartao_debito'])

    console.log(`   Cartões do Max (sem filtro categoria): ${semCat?.length ?? 0}`)
    if (semCat?.length) {
      for (const c of semCat) {
        console.log(`   - "${c.nome_cartao || c.nome}" | cat=${c.categoria} | ativo=${c.ativo}`)
      }
    }

    console.log(`\n5. Buscando cartões inativos do Max (ativo=false)...`)
    const { data: inativos } = await supabase
      .from('contas')
      .select('id, nome, nome_cartao, tipo, categoria, ativo')
      .eq('user_id', userId)
      .in('tipo', ['cartao_credito', 'cartao_debito'])
      .eq('ativo', false)

    console.log(`   Cartões inativos: ${inativos?.length ?? 0}`)
    if (inativos?.length) {
      for (const c of inativos) {
        console.log(`   - "${c.nome_cartao || c.nome}" | cat=${c.categoria}`)
      }
    }
  }

  console.log('\n=== DIAGNÓSTICO CONCLUÍDO ===')
  console.log('\nPossíveis causas do sumiço:')
  console.log('  A) Cartões cadastrados com categoria != "pf" (ex: null, "pj")')
  console.log('  B) user_id dos cartões não bate com o user_id atual do Sr. Max')
  console.log('  C) Cartões marcados como ativo=false por engano')
  console.log('  D) Cartões salvos sem user_id (antigo cadastro sem isolamento)')
}

run().catch(console.error)
