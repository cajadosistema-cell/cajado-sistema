/**
 * fix-cartoes-max.js
 * Reativa os cartões originais do Sr. Max e desativa os duplicados com "-MAX"
 * Uso: node fix-cartoes-max.js
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

const USER_ID_MAX = 'd7f70a0c-19ed-4301-8541-bc3f097e97f3'

// Cartões originais (ativo=false) que devem ser REativados
const NOMES_ORIGINAIS = ['XP', 'Sam s club', 'Nubank', 'Sofisa ', 'C6 Carbon', 'Hiper ', 'Bradesco visa infinity']

// Cartões duplicados (ativo=true) que devem ser DESativados
const NOMES_DUPLICADOS = ['XP-MAX', 'SAM s-CLUB', 'NUBANK-MAX', 'SOFISA-MAX VISA', 'C6- MAX', 'HIPER-MAX', 'BRADESCO- INFINITY']

// SICOOB-MAX não tem original → manter ativo

async function run() {
  console.log('=== CORRIGINDO CARTÕES DO SR. MAX ===\n')

  // 1. Reativar originais
  console.log('1. Reativando cartões originais...')
  for (const nome of NOMES_ORIGINAIS) {
    const { data, error } = await supabase
      .from('contas')
      .update({ ativo: true })
      .eq('user_id', USER_ID_MAX)
      .eq('nome_cartao', nome)
      .select('id, nome_cartao')

    if (error) {
      console.error(`   ❌ Erro ao reativar "${nome}":`, error.message)
    } else if (data?.length) {
      console.log(`   ✅ Reativado: "${nome}"`)
    } else {
      // tenta pelo campo nome
      const { data: d2, error: e2 } = await supabase
        .from('contas')
        .update({ ativo: true })
        .eq('user_id', USER_ID_MAX)
        .eq('nome', nome)
        .select('id, nome')
      if (e2) console.error(`   ❌ Erro ao reativar "${nome}" (by nome):`, e2.message)
      else if (d2?.length) console.log(`   ✅ Reativado: "${nome}"`)
      else console.log(`   ⚠️  Não encontrado: "${nome}"`)
    }
  }

  // 2. Desativar duplicados
  console.log('\n2. Desativando duplicados com sufixo "-MAX"...')
  for (const nome of NOMES_DUPLICADOS) {
    const { data, error } = await supabase
      .from('contas')
      .update({ ativo: false })
      .eq('user_id', USER_ID_MAX)
      .eq('nome_cartao', nome)
      .select('id, nome_cartao')

    if (error) {
      console.error(`   ❌ Erro ao desativar "${nome}":`, error.message)
    } else if (data?.length) {
      console.log(`   🗑️  Desativado: "${nome}"`)
    } else {
      const { data: d2, error: e2 } = await supabase
        .from('contas')
        .update({ ativo: false })
        .eq('user_id', USER_ID_MAX)
        .eq('nome', nome)
        .select('id, nome')
      if (e2) console.error(`   ❌ Erro ao desativar "${nome}" (by nome):`, e2.message)
      else if (d2?.length) console.log(`   🗑️  Desativado: "${nome}"`)
      else console.log(`   ⚠️  Não encontrado: "${nome}"`)
    }
  }

  // 3. Estado final
  console.log('\n3. Estado final dos cartões do Sr. Max...')
  const { data: final } = await supabase
    .from('contas')
    .select('nome_cartao, nome, bandeira, ativo')
    .eq('user_id', USER_ID_MAX)
    .in('tipo', ['cartao_credito', 'cartao_debito'])
    .order('ativo', { ascending: false })

  console.log('\n   ATIVOS (aparecem no sistema):')
  for (const c of (final || []).filter(c => c.ativo)) {
    console.log(`   ✅ "${c.nome_cartao || c.nome}" [${c.bandeira}]`)
  }
  console.log('\n   INATIVOS (não aparecem):')
  for (const c of (final || []).filter(c => !c.ativo)) {
    console.log(`   ❌ "${c.nome_cartao || c.nome}"`)
  }

  console.log('\n✅ Correção concluída! O Sr. Max verá os cartões originais ao recarregar a página.')
}

run().catch(console.error)
