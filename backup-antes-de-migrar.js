/**
 * backup-antes-de-migrar.js
 * ─────────────────────────────────────────────────────────────
 * Execute SEMPRE antes de qualquer migration:
 *   node backup-antes-de-migrar.js
 *
 * O que faz:
 *  1. Exporta todos os dados PF por usuário (cartões, gastos, faturas, agenda)
 *  2. Salva em /backups/YYYY-MM-DD_HH-mm/ como JSON por tabela
 *  3. Gera relatório de integridade (contagens antes da migration)
 * ─────────────────────────────────────────────────────────────
 */

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')

const SUPABASE_URL     = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Tabelas críticas para backup
const TABELAS = [
  { nome: 'contas',             filtro: {} },
  { nome: 'faturas_cartoes',    filtro: {} },
  { nome: 'gastos_pessoais',    filtro: {} },
  { nome: 'receitas_pessoais',  filtro: {} },
  { nome: 'orcamentos_pessoais',filtro: {} },
  { nome: 'agenda_eventos',     filtro: {} },
  { nome: 'ativos',             filtro: {} },
  { nome: 'projetos_patrimonio',filtro: {} },
  { nome: 'perfis',             filtro: {} },
  { nome: 'empresas',           filtro: {} },
]

async function backup() {
  const agora = new Date()
  const stamp = agora.toISOString().replace(/[:.]/g, '-').slice(0, 16)
  const dir   = path.join(__dirname, 'backups', stamp)

  fs.mkdirSync(dir, { recursive: true })
  console.log(`\n🔒 Backup iniciado: ${stamp}\n   Destino: ${dir}\n`)

  const relatorio = {
    data: agora.toISOString(),
    tabelas: {},
    total_registros: 0,
  }

  for (const tabela of TABELAS) {
    try {
      const { data, error } = await supabase
        .from(tabela.nome)
        .select('*')
        .limit(50000) // segurança

      if (error) {
        console.warn(`  ⚠️  ${tabela.nome}: ${error.message}`)
        relatorio.tabelas[tabela.nome] = { erro: error.message }
        continue
      }

      const count = data?.length ?? 0
      fs.writeFileSync(
        path.join(dir, `${tabela.nome}.json`),
        JSON.stringify(data, null, 2),
        'utf-8'
      )

      relatorio.tabelas[tabela.nome] = { registros: count }
      relatorio.total_registros += count
      console.log(`  ✅  ${tabela.nome.padEnd(25)} ${count} registros`)
    } catch (e) {
      console.warn(`  ❌  ${tabela.nome}: ${e.message}`)
      relatorio.tabelas[tabela.nome] = { erro: e.message }
    }
  }

  // Salva relatório
  fs.writeFileSync(
    path.join(dir, '_relatorio.json'),
    JSON.stringify(relatorio, null, 2),
    'utf-8'
  )

  console.log(`\n📊 Total: ${relatorio.total_registros} registros exportados`)
  console.log(`✅ Backup completo em: backups/${stamp}/\n`)
  console.log('🚀 AGORA pode executar sua migration com segurança.\n')
}

backup().catch(console.error)
