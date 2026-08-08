// Fix: vincular perfis sem empresa_id à empresa correta
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

async function fix() {
  // 1. Listar todos os perfis
  const { data: perfis } = await supabase.from('perfis').select('id, nome, papel, empresa_id, created_at').order('created_at', { ascending: true })
  console.log('📋 Todos os perfis:')
  perfis?.forEach(p => console.log(`  - ${p.nome || '(sem nome)'} | papel: ${p.papel} | empresa_id: ${p.empresa_id || 'NULL'} | id: ${p.id}`))

  // 2. Listar empresas
  const { data: empresas } = await supabase.from('empresas').select('id, nome')
  console.log('\n🏢 Empresas:')
  empresas?.forEach(e => console.log(`  - ${e.nome} | id: ${e.id}`))

  // 3. Vincular perfis órfãos à empresa principal (Cajado Admin)
  const empresaPrincipal = empresas?.find(e => e.nome === 'Cajado Admin') || empresas?.[0]
  if (!empresaPrincipal) { console.log('❌ Nenhuma empresa encontrada!'); return }

  const orfaos = perfis?.filter(p => !p.empresa_id) || []
  console.log(`\n🔧 ${orfaos.length} perfil(is) sem empresa_id`)

  for (const p of orfaos) {
    console.log(`  Vinculando "${p.nome || p.id}" → empresa "${empresaPrincipal.nome}"`)
    const { error } = await supabase.from('perfis').update({ empresa_id: empresaPrincipal.id }).eq('id', p.id)
    if (error) console.log(`    ❌ Erro: ${error.message}`)
    else console.log(`    ✅ OK`)
  }

  // 4. Verificar resultado
  const { data: perfisUpdated } = await supabase.from('perfis').select('id, nome, papel, empresa_id').order('created_at', { ascending: true })
  console.log('\n📋 Perfis atualizados:')
  perfisUpdated?.forEach(p => console.log(`  - ${p.nome || '(sem nome)'} | papel: ${p.papel} | empresa_id: ${p.empresa_id || 'NULL'}`))
}

fix().catch(console.error)
