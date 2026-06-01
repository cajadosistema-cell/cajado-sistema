/**
 * audit-isolamento.js
 * Auditoria completa de isolamento multi-tenant
 */
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

async function run() {
  const { data: perfis }  = await sb.from('perfis').select('id, email, nome, empresa_id')
  const { data: empresas } = await sb.from('empresas').select('id, nome, owner_id')

  console.log('=== USUÁRIOS E EMPRESAS ===')
  for (const p of (perfis || [])) {
    const emp = (empresas || []).find(e => e.id === p.empresa_id)
    console.log('  [' + (p.email || p.nome) + '] empresa=' + (emp?.nome || String(p.empresa_id).substring(0, 8)))
  }

  // Contas
  const { data: contas } = await sb.from('contas').select('user_id, empresa_id, categoria, ativo')
  console.log('\n=== CONTAS POR EMPRESA ===')
  const mapContas = {}
  for (const c of (contas || [])) {
    const emp = (empresas || []).find(e => e.id === c.empresa_id)
    const key = emp?.nome || String(c.empresa_id || '').substring(0, 8) || 'sem-empresa'
    if (!mapContas[key]) mapContas[key] = { pf: 0, pj: 0, sem_uid: 0 }
    if (!c.user_id) mapContas[key].sem_uid++
    else if (c.categoria === 'pf') mapContas[key].pf++
    else mapContas[key].pj++
  }
  for (const [k, v] of Object.entries(mapContas)) {
    console.log('  [' + k + '] pf=' + v.pf + ' pj=' + v.pj + ' sem_user_id=' + v.sem_uid)
  }

  // Gastos pessoais por empresa
  const { data: gastos } = await sb.from('gastos_pessoais').select('user_id')
  console.log('\n=== GASTOS PESSOAIS POR USUÁRIO ===')
  const mapG = {}
  for (const g of (gastos || [])) {
    const uid = g.user_id || 'sem-user_id'
    const p = (perfis || []).find(x => x.id === uid)
    const key = p?.email || p?.nome || uid.substring(0, 12)
    mapG[key] = (mapG[key] || 0) + 1
  }
  for (const [k, v] of Object.entries(mapG)) {
    console.log('  [' + k + '] ' + v + ' lançamentos')
  }

  // Agenda por usuário
  const { data: agenda } = await sb.from('agenda_eventos').select('user_id')
  console.log('\n=== AGENDA POR USUÁRIO ===')
  const mapA = {}
  for (const a of (agenda || [])) {
    const uid = a.user_id || 'sem-user_id'
    const p = (perfis || []).find(x => x.id === uid)
    const key = p?.email || p?.nome || uid.substring(0, 12)
    mapA[key] = (mapA[key] || 0) + 1
  }
  for (const [k, v] of Object.entries(mapA)) {
    console.log('  [' + k + '] ' + v + ' eventos')
  }

  // Verificação de cartões com empresa_id cruzado (problema que ocorreu)
  console.log('\n=== VERIFICAÇÃO: CARTÕES PF COM EMPRESA_ID ERRADO ===')
  for (const p of (perfis || [])) {
    if (!p.empresa_id) continue
    const { data: cartoesErrados } = await sb
      .from('contas')
      .select('nome_cartao, nome, empresa_id')
      .eq('user_id', p.id)
      .eq('categoria', 'pf')
      .neq('empresa_id', p.empresa_id)
      .eq('ativo', true)

    if (cartoesErrados && cartoesErrados.length > 0) {
      console.log('  PROBLEMA [' + (p.email || p.nome) + ']: ' + cartoesErrados.length + ' cartoes com empresa_id errado!')
      for (const c of cartoesErrados) {
        console.log('    - "' + (c.nome_cartao || c.nome) + '" empresa=' + String(c.empresa_id).substring(0, 8))
      }
    } else {
      console.log('  OK [' + (p.email || p.nome) + ']: todos os cartoes com empresa_id correto')
    }
  }

  console.log('\n=== AUDITORIA CONCLUIDA ===')
}

run().catch(console.error)
