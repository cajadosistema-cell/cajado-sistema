// run-migration-061.js — Executa migration 061: unifica alertas_recorrentes → compromissos_fixos
// Necessário para que Elena e a UI TabControleUnificado compartilhem a mesma tabela.

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const sql = fs.readFileSync(
  path.join(__dirname, 'supabase/migrations/061_unificar_alertas_compromissos.sql'),
  'utf8'
)

async function run() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Faltam variáveis: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  console.log('=== Migration 061 — Unificar alertas_recorrentes → compromissos_fixos ===\n')

  // Conta registros antes
  const { count: countAntes } = await supabase
    .from('alertas_recorrentes')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 Alertas recorrentes existentes: ${countAntes || 0}`)

  const { count: countCompAntes } = await supabase
    .from('compromissos_fixos')
    .select('*', { count: 'exact', head: true })

  console.log(`📊 Compromissos fixos antes da migração: ${countCompAntes || 0}`)

  // Executa a migration por statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  let ok = 0
  let erros = 0

  for (const stmt of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_text: stmt + ';' })
      if (error) {
        // Tenta via query direta se rpc não existir
        const { error: e2 } = await supabase.from('_migrations_log').select('*').limit(0)
        if (e2) {
          console.warn(`  ⚠️ Ignorando statement (sem exec_sql): ${stmt.substring(0, 60)}...`)
        }
        erros++
      } else {
        ok++
      }
    } catch (err) {
      console.warn(`  ⚠️ Erro: ${String(err).substring(0, 80)}`)
      erros++
    }
  }

  // Conta registros depois
  const { count: countDepois } = await supabase
    .from('compromissos_fixos')
    .select('*', { count: 'exact', head: true })

  console.log(`\n📊 Compromissos fixos após migração: ${countDepois || 0}`)
  console.log(`✅ Migrados: ${(countDepois || 0) - (countCompAntes || 0)} novos registros`)
  console.log(`\n📋 Resultado: ${ok} statements OK, ${erros} com aviso`)
  console.log('\n💡 IMPORTANTE: Execute o SQL diretamente no Supabase Dashboard se')
  console.log('   os statements acima falharam (a função exec_sql pode não existir).')
  console.log('   Arquivo: supabase/migrations/061_unificar_alertas_compromissos.sql')
}

run().catch(console.error)
