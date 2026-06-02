/**
 * auditoria-sistema.js
 * Auditoria completa: verifica todos os dados do sistema
 * por usuário, módulo e isolamento correto
 */
const { createClient } = require('@supabase/supabase-js')
const sb = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

async function run() {
  // 1. Carrega usuários e empresas
  const { data: perfis }   = await sb.from('perfis').select('id, email, nome, empresa_id')
  const { data: empresas } = await sb.from('empresas').select('id, nome')

  const nomeEmp = (id) => {
    const e = (empresas || []).find(e => e.id === id)
    return e ? e.nome : (id ? id.substring(0, 8) : 'sem-empresa')
  }
  const nomeUser = (id) => {
    const p = (perfis || []).find(p => p.id === id)
    return p ? (p.email || p.nome) : (id ? id.substring(0, 12) : 'sem-user')
  }

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║          AUDITORIA COMPLETA DO SISTEMA CAJADO                ║')
  console.log('║          ' + new Date().toLocaleString('pt-BR') + '                         ║')
  console.log('╚══════════════════════════════════════════════════════════════╝\n')

  // 2. Usuários cadastrados
  console.log('══ USUÁRIOS E EMPRESAS ══════════════════════════════')
  for (const p of (perfis || [])) {
    console.log('  👤 ' + (p.email || p.nome) + ' → empresa: ' + nomeEmp(p.empresa_id))
  }

  // 3. Módulo: LANÇAMENTOS PESSOAIS (PF)
  console.log('\n══ LANÇAMENTOS PESSOAIS (PF) ════════════════════════')
  const modPF = [
    { tabela: 'gastos_pessoais',   label: 'Gastos PF' },
    { tabela: 'receitas_pessoais', label: 'Receitas PF' },
  ]
  for (const m of modPF) {
    const { data } = await sb.from(m.tabela).select('user_id, valor, categoria, data').order('data', { ascending: false }).limit(500)
    const map = {}
    let semUID = 0
    for (const r of (data || [])) {
      if (!r.user_id) { semUID++; continue }
      const key = nomeUser(r.user_id)
      if (!map[key]) map[key] = { count: 0, total: 0 }
      map[key].count++
      map[key].total += Number(r.valor || 0)
    }
    console.log('\n  📋 ' + m.label + ':')
    if (Object.keys(map).length === 0 && semUID === 0) {
      console.log('     (vazio)')
    }
    for (const [u, v] of Object.entries(map)) {
      console.log('     ' + u + ': ' + v.count + ' registros | R$ ' + v.total.toFixed(2))
    }
    if (semUID > 0) console.log('     ⚠️  SEM user_id: ' + semUID + ' registros ORPHÃOS')
  }

  // 4. Módulo: CONTAS E CARTÕES
  console.log('\n══ CONTAS E CARTÕES ═════════════════════════════════')
  const { data: contas } = await sb.from('contas').select('user_id, empresa_id, nome, nome_cartao, tipo, categoria, ativo, dia_vencimento')
  const mapContas = {}
  let contasSemUID = 0
  for (const c of (contas || [])) {
    if (!c.user_id && !c.empresa_id) { contasSemUID++; continue }
    const empNome = nomeEmp(c.empresa_id)
    const usrNome = c.user_id ? nomeUser(c.user_id) : '(conta PJ)'
    const key = usrNome + ' [' + empNome + ']'
    if (!mapContas[key]) mapContas[key] = { pf: [], pj: [] }
    const tipo = c.categoria === 'pf' ? 'pf' : 'pj'
    const nome = c.nome_cartao || c.nome
    const venc = c.dia_vencimento ? ' vence/' + c.dia_vencimento : ''
    const ativo = c.ativo ? '' : ' [INATIVO]'
    mapContas[key][tipo].push(nome + venc + ativo)
  }
  for (const [key, v] of Object.entries(mapContas)) {
    console.log('  👤 ' + key)
    if (v.pf.length > 0) console.log('     PF: ' + v.pf.join(', '))
    if (v.pj.length > 0) console.log('     PJ: ' + v.pj.join(', '))
  }
  if (contasSemUID > 0) console.log('  ⚠️  SEM user_id E empresa_id: ' + contasSemUID + ' registros ORPHÃOS')
  if (Object.keys(mapContas).length === 0) console.log('  (nenhuma conta cadastrada)')

  // 5. Módulo: AGENDA
  console.log('\n══ AGENDA / LEMBRETES ═══════════════════════════════')
  const { data: agenda } = await sb.from('agenda_eventos').select('user_id, tipo').limit(500)
  const mapAgenda = {}
  for (const a of (agenda || [])) {
    const key = nomeUser(a.user_id)
    if (!mapAgenda[key]) mapAgenda[key] = {}
    mapAgenda[key][a.tipo || 'outro'] = (mapAgenda[key][a.tipo || 'outro'] || 0) + 1
  }
  for (const [u, v] of Object.entries(mapAgenda)) {
    const tipos = Object.entries(v).map(([t, n]) => t + ':' + n).join(' | ')
    console.log('  👤 ' + u + ': ' + tipos)
  }
  if (Object.keys(mapAgenda).length === 0) console.log('  (nenhum evento cadastrado)')

  // 6. Módulo: PATRIMÔNIO
  console.log('\n══ PATRIMÔNIO ═══════════════════════════════════════')
  const modPatrimonio = [
    { tabela: 'imoveis',       label: 'Imóveis',       campo: 'user_id' },
    { tabela: 'veiculos',      label: 'Veículos',      campo: 'user_id' },
    { tabela: 'financiamentos',label: 'Financiamentos',campo: 'empresa_id' },
  ]
  let patrimonioVazio = true
  for (const m of modPatrimonio) {
    const { data } = await sb.from(m.tabela).select(m.campo).limit(200)
    const map = {}
    for (const r of (data || [])) {
      const key = m.campo === 'user_id' ? nomeUser(r[m.campo]) : nomeEmp(r[m.campo])
      map[key] = (map[key] || 0) + 1
    }
    if (Object.keys(map).length > 0) {
      patrimonioVazio = false
      console.log('  📦 ' + m.label + ':')
      for (const [k, v] of Object.entries(map)) console.log('     ' + k + ': ' + v + ' registros')
    }
  }
  if (patrimonioVazio) console.log('  (nenhum bem cadastrado)')

  // 7. Módulo: ELENA
  console.log('\n══ ELENA (IA) ═══════════════════════════════════════')
  const modElena = [
    { tabela: 'elena_conversas', label: 'Conversas' },
    { tabela: 'elena_perfil',    label: 'Perfil aprendido' },
    { tabela: 'elena_ideias',    label: 'Ideias salvas' },
    { tabela: 'elena_registros', label: 'Memória (registros)' },
  ]
  for (const m of modElena) {
    try {
      const { data } = await sb.from(m.tabela).select('user_id').limit(500)
      const map = {}
      for (const r of (data || [])) {
        const key = nomeUser(r.user_id)
        map[key] = (map[key] || 0) + 1
      }
      if (Object.keys(map).length > 0) {
        console.log('  🤖 ' + m.label + ':')
        for (const [k, v] of Object.entries(map)) console.log('     ' + k + ': ' + v)
      } else {
        console.log('  🤖 ' + m.label + ': (vazio)')
      }
    } catch { console.log('  🤖 ' + m.label + ': (tabela não existe)') }
  }

  // 8. Resumo de isolamento — verifica cruzamentos
  console.log('\n══ VERIFICAÇÃO DE ISOLAMENTO ════════════════════════')
  let problemas = 0
  for (const p of (perfis || [])) {
    if (!p.empresa_id) continue
    // Cartões PF com empresa_id errado
    const { data: cross } = await sb.from('contas')
      .select('nome_cartao, nome, empresa_id')
      .eq('user_id', p.id).eq('categoria', 'pf').eq('ativo', true)
      .neq('empresa_id', p.empresa_id)
    if (cross && cross.length > 0) {
      problemas++
      console.log('  ❌ ' + (p.email || p.nome) + ': ' + cross.length + ' cartão(ões) com empresa_id ERRADO!')
      for (const c of cross) console.log('     "' + (c.nome_cartao || c.nome) + '" → empresa=' + nomeEmp(c.empresa_id))
    } else {
      console.log('  ✅ ' + (p.email || p.nome) + ': isolamento OK')
    }
  }

  // Gastos pessoais sem user_id
  const { count: gastosOrfaos } = await sb.from('gastos_pessoais').select('id', { count:'exact', head:true }).is('user_id', null)
  if (gastosOrfaos > 0) { problemas++; console.log('  ❌ Gastos sem user_id: ' + gastosOrfaos) }

  console.log('\n══ RESULTADO FINAL ══════════════════════════════════')
  if (problemas === 0) {
    console.log('  ✅ SISTEMA SAUDÁVEL — nenhum problema de isolamento detectado')
  } else {
    console.log('  ❌ ' + problemas + ' PROBLEMA(S) ENCONTRADO(S) — requer correção')
  }
  console.log('════════════════════════════════════════════════════\n')
}

run().catch(console.error)
