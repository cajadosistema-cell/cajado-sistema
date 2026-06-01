/**
 * diag-rls-cartoes.js
 * Verifica empresa_id dos cartões e se a RLS está bloqueando o Max
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

const USER_ID_MAX = 'd7f70a0c-19ed-4301-8541-bc3f097e97f3'

async function run() {
  console.log('=== DIAGNÓSTICO RLS: EMPRESA_ID DOS CARTÕES ===\n')

  // 1. Empresa do Max
  const { data: perfil } = await supabase
    .from('perfis')
    .select('empresa_id')
    .eq('id', USER_ID_MAX)
    .single()

  console.log('1. Empresa do Max (tabela perfis):')
  console.log(`   empresa_id = ${perfil?.empresa_id ?? 'NÃO ENCONTRADO'}`)

  // 2. Cartões ativos do Max com empresa_id
  console.log('\n2. Cartões ativos do Max com empresa_id:')
  const { data: cartoes } = await supabase
    .from('contas')
    .select('id, nome_cartao, nome, empresa_id, user_id, ativo')
    .eq('user_id', USER_ID_MAX)
    .in('tipo', ['cartao_credito', 'cartao_debito'])
    .eq('ativo', true)

  for (const c of (cartoes || [])) {
    const ok = c.empresa_id === perfil?.empresa_id ? '✅ OK' : '❌ EMPRESA DIFERENTE'
    console.log(`   "${c.nome_cartao || c.nome}" | empresa_id=${c.empresa_id?.substring(0,8)}... | ${ok}`)
  }

  // 3. Corrige empresa_id se necessário
  if (perfil?.empresa_id) {
    console.log('\n3. Corrigindo empresa_id dos cartões ativos do Max...')
    const { data: corrigidos, error } = await supabase
      .from('contas')
      .update({ empresa_id: perfil.empresa_id })
      .eq('user_id', USER_ID_MAX)
      .in('tipo', ['cartao_credito', 'cartao_debito'])
      .eq('ativo', true)
      .select('nome_cartao, nome, empresa_id')

    if (error) {
      console.error('   ❌ Erro:', error.message)
    } else {
      console.log(`   ✅ ${corrigidos?.length ?? 0} cartões atualizados com empresa_id correto`)
      for (const c of (corrigidos || [])) {
        console.log(`   - "${c.nome_cartao || c.nome}"`)
      }
    }
  }

  // 4. Verifica lançamentos (gastos_pessoais) do Max
  console.log('\n4. Verificando lançamentos pessoais do Max...')
  const { data: gastos, error: gErr } = await supabase
    .from('gastos_pessoais')
    .select('id, descricao, data, valor, forma_pagamento')
    .eq('user_id', USER_ID_MAX)
    .order('data', { ascending: false })
    .limit(5)

  if (gErr) console.error('   Erro:', gErr.message)
  else {
    console.log(`   Total recente: ${gastos?.length ?? 0} lançamentos encontrados`)
    for (const g of (gastos || [])) {
      console.log(`   - ${g.data} | ${g.descricao} | R$ ${g.valor} | ${g.forma_pagamento}`)
    }
  }

  console.log('\n✅ Diagnóstico concluído!')
}

run().catch(console.error)
