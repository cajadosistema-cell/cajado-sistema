/**
 * reset-conta-max.js
 * Apaga TODOS os dados financeiros/operacionais do max@cajado.com
 * Mantém: conta de acesso (auth), perfil, empresa
 * 
 * Uso: node reset-conta-max.js          → mostra o que será apagado
 *      node reset-conta-max.js --confirm → EXECUTA o reset
 */

const { createClient } = require('@supabase/supabase-js')
const sb = createClient(
  'https://wagkyyqstsgetktefewd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'
)

const USER_ID_MAX   = 'd7f70a0c-19ed-4301-8541-bc3f097e97f3'
const EMPRESA_MAX   = '658ed627-c84e-46c0-a9d2-83c4a1b66bca'
const CONFIRMAR     = process.argv.includes('--confirm')

// Tabelas e filtros que serão zerados
const TABELAS = [
  { nome: 'contas',              filtro: { user_id: USER_ID_MAX } },
  { nome: 'gastos_pessoais',     filtro: { user_id: USER_ID_MAX } },
  { nome: 'receitas_pessoais',   filtro: { user_id: USER_ID_MAX } },
  { nome: 'agenda_eventos',      filtro: { user_id: USER_ID_MAX } },
  { nome: 'orcamentos_pessoais', filtro: { user_id: USER_ID_MAX } },
  { nome: 'faturas_cartoes',     filtro: { user_id: USER_ID_MAX } },
  { nome: 'elena_conversas',     filtro: { user_id: USER_ID_MAX } },
  { nome: 'elena_perfil',        filtro: { user_id: USER_ID_MAX } },
  { nome: 'elena_registro',      filtro: { user_id: USER_ID_MAX } },
  // Contas PJ da empresa Cajado (se houver)
  { nome: 'gastos_empresa',      filtro: { empresa_id: EMPRESA_MAX } },
  { nome: 'receitas_empresa',    filtro: { empresa_id: EMPRESA_MAX } },
]

async function run() {
  console.log('╔══════════════════════════════════════════╗')
  console.log('║  RESET DA CONTA max@cajado.com           ║')
  console.log('╚══════════════════════════════════════════╝')
  console.log('')
  console.log('Modo:', CONFIRMAR ? '🔴 EXECUÇÃO REAL' : '🟡 SIMULAÇÃO (use --confirm para executar)')
  console.log('Usuário:', USER_ID_MAX)
  console.log('Empresa:', EMPRESA_MAX)
  console.log('')
  console.log('O QUE SERÁ MANTIDO:')
  console.log('  ✅ Conta de acesso (email + senha)')
  console.log('  ✅ Perfil (nome, foto)')
  console.log('  ✅ Empresa Cajado')
  console.log('')
  console.log('O QUE SERÁ APAGADO:')

  let totalRegistros = 0
  const contagens = []

  for (const t of TABELAS) {
    try {
      let q = sb.from(t.nome).select('id', { count: 'exact', head: true })
      for (const [k, v] of Object.entries(t.filtro)) q = q.eq(k, v)
      const { count, error } = await q
      if (error && error.code === '42P01') {
        // tabela não existe — pula silenciosamente
        continue
      }
      const n = count || 0
      totalRegistros += n
      contagens.push({ tabela: t.nome, count: n, filtro: t.filtro })
      console.log('  ' + (n > 0 ? '🗑️ ' : '   ') + t.nome.padEnd(22) + n + ' registros')
    } catch {
      console.log('  ⚠️  ' + t.nome.padEnd(22) + '(não encontrada, pulando)')
    }
  }

  console.log('  ' + '─'.repeat(35))
  console.log('  Total:                ' + totalRegistros + ' registros')
  console.log('')

  if (!CONFIRMAR) {
    console.log('══════════════════════════════════════════')
    console.log('  SIMULAÇÃO — nenhum dado foi alterado.')
    console.log('  Para executar de verdade, rode:')
    console.log('  node reset-conta-max.js --confirm')
    console.log('══════════════════════════════════════════')
    return
  }

  // ── EXECUÇÃO REAL ──────────────────────────────────────
  console.log('🔴 INICIANDO RESET...')
  console.log('')

  for (const t of contagens) {
    if (t.count === 0) continue
    try {
      let q = sb.from(t.tabela).delete()
      for (const [k, v] of Object.entries(t.filtro)) q = q.eq(k, v)
      const { error } = await q
      if (error) {
        console.log('  ❌ Erro em ' + t.tabela + ': ' + error.message)
      } else {
        console.log('  ✅ ' + t.tabela + ' — ' + t.count + ' registros removidos')
      }
    } catch (err) {
      console.log('  ❌ Exceção em ' + t.tabela + ': ' + err.message)
    }
  }

  console.log('')
  console.log('══════════════════════════════════════════')
  console.log('  ✅ RESET CONCLUÍDO!')
  console.log('  O Sr. Max pode fazer login normalmente.')
  console.log('  Todos os dados financeiros foram zerados.')
  console.log('══════════════════════════════════════════')
}

run().catch(console.error)
