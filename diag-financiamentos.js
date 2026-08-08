const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

async function diagnostico() {
  console.log('=== DIAGNÓSTICO FINANCIAMENTOS ===\n')

  // 1. Verificar perfis e empresa_id
  const { data: perfis } = await supabase.from('perfis').select('id, nome, papel, empresa_id').order('created_at', { ascending: true })
  console.log('📋 Perfis:')
  perfis?.forEach(p => console.log(`  - ${p.nome} (${p.papel}) | empresa_id: ${p.empresa_id || 'NULL'}`))

  // 2. Verificar empresas existentes
  const { data: empresas } = await supabase.from('empresas').select('id, nome')
  console.log('\n🏢 Empresas:')
  empresas?.forEach(e => console.log(`  - ${e.nome} | id: ${e.id}`))

  // 3. Verificar colunas da tabela financiamentos
  const { data: cols, error: colsErr } = await supabase.rpc('get_table_columns', { p_table: 'financiamentos' }).maybeSingle()
  if (colsErr) {
    // Fallback: tentar query direta
    console.log('\n📊 Colunas de financiamentos (tentando via query):')
    const { data: testRow, error: testErr } = await supabase.from('financiamentos').select('*').limit(0)
    if (testErr) console.log('  Erro ao acessar tabela:', testErr.message)
    else console.log('  Tabela acessível (sem registros ou colunas não verificáveis via select)')
  }

  // 4. Tentar insert de teste com service role (bypassa RLS)
  const adminPerfil = perfis?.find(p => p.papel === 'admin' || p.papel === 'dono')
  if (adminPerfil?.empresa_id) {
    console.log(`\n🧪 Testando insert com empresa_id: ${adminPerfil.empresa_id}`)
    const { data: inserted, error: insertErr } = await supabase.from('financiamentos').insert({
      credor: 'TESTE_DIAGNOSTICO',
      valor_financiado: 1000,
      valor_parcela: 100,
      parcelas_total: 10,
      parcelas_pagas: 0,
      dia_vencimento: 15,
      empresa_id: adminPerfil.empresa_id
    }).select()

    if (insertErr) {
      console.log('  ❌ ERRO no insert:', insertErr.message)
      console.log('  Detalhes:', JSON.stringify(insertErr, null, 2))
    } else {
      console.log('  ✅ INSERT OK! id:', inserted?.[0]?.id)
      // Limpar registro de teste
      if (inserted?.[0]?.id) {
        await supabase.from('financiamentos').delete().eq('id', inserted[0].id)
        console.log('  🗑️ Registro de teste removido')
      }
    }
  } else {
    console.log('\n⚠️ Admin não tem empresa_id! Isso causa o erro de FK.')
    console.log('  Solução: vincular admin a uma empresa.')
  }

  // 5. Verificar se a coluna 'banco' ainda existe (schema cache issue)
  console.log('\n🔍 Verificando schema cache - tentando select com colunas novas:')
  const { data: testNew, error: errNew } = await supabase.from('financiamentos').select('credor, dia_vencimento, parcelas_total, taxa_juros_anual').limit(1)
  if (errNew) console.log('  ❌ Colunas novas não existem:', errNew.message)
  else console.log('  ✅ Colunas renomeadas existem no banco!')

  const { error: errOld } = await supabase.from('financiamentos').select('banco').limit(1)
  if (errOld) console.log('  ✅ Coluna "banco" antiga NÃO existe (correto - foi renomeada)')
  else console.log('  ⚠️ Coluna "banco" antiga AINDA existe!')
}

diagnostico().catch(console.error)
