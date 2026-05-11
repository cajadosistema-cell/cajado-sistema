/**
 * restaurar-backup.js
 * ─────────────────────────────────────────────────────────────
 * Restaura dados de um backup específico em caso de problemas.
 *
 * Uso:
 *   node restaurar-backup.js 2026-05-11_12-30   (pasta do backup)
 *   node restaurar-backup.js latest              (último backup)
 *
 * ATENÇÃO: Restaura apenas tabelas PF pessoais.
 *          Tabelas multi-tenant (leads, vendas) exigem análise manual.
 * ─────────────────────────────────────────────────────────────
 */

const { createClient } = require('@supabase/supabase-js')
const fs   = require('fs')
const path = require('path')

const SUPABASE_URL     = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

// Tabelas seguras para restaurar (sem risk de quebrar foreign keys de outras tabelas)
const TABELAS_RESTAURAVEIS = [
  'gastos_pessoais',
  'receitas_pessoais',
  'orcamentos_pessoais',
  'agenda_eventos',
  'faturas_cartoes',
  'contas',  // cuidado: restaurar por último por causa de FKs
]

async function restaurar(stamp) {
  const backupsDir = path.join(__dirname, 'backups')

  // Resolve "latest"
  if (stamp === 'latest') {
    const dirs = fs.readdirSync(backupsDir).sort()
    stamp = dirs[dirs.length - 1]
    console.log(`\n📂 Usando último backup: ${stamp}`)
  }

  const dir = path.join(backupsDir, stamp)
  if (!fs.existsSync(dir)) {
    console.error(`❌ Backup não encontrado: ${dir}`)
    process.exit(1)
  }

  const relatorio = JSON.parse(fs.readFileSync(path.join(dir, '_relatorio.json'), 'utf-8'))
  console.log(`\n🔄 Restaurando backup de: ${relatorio.data}`)
  console.log(`   Total original: ${relatorio.total_registros} registros\n`)
  console.log('⚠️  ATENÇÃO: Isso fará UPSERT nos dados. Dados novos não serão perdidos.')
  console.log('   Pressione CTRL+C nos próximos 5s para cancelar...\n')

  await new Promise(r => setTimeout(r, 5000))

  for (const tabela of TABELAS_RESTAURAVEIS) {
    const arquivo = path.join(dir, `${tabela}.json`)
    if (!fs.existsSync(arquivo)) {
      console.log(`  ⏭️  ${tabela}: sem backup`)
      continue
    }

    const dados = JSON.parse(fs.readFileSync(arquivo, 'utf-8'))
    if (!dados || dados.length === 0) {
      console.log(`  ⏭️  ${tabela}: vazio`)
      continue
    }

    // Upsert em lotes de 100
    const LOTE = 100
    let restaurados = 0
    let erros = 0

    for (let i = 0; i < dados.length; i += LOTE) {
      const lote = dados.slice(i, i + LOTE)
      const { error } = await supabase.from(tabela).upsert(lote, { onConflict: 'id' })
      if (error) {
        erros++
        console.warn(`  ⚠️  ${tabela} lote ${i/LOTE + 1}: ${error.message}`)
      } else {
        restaurados += lote.length
        process.stdout.write('.')
      }
    }

    console.log(`\n  ✅  ${tabela.padEnd(25)} ${restaurados} restaurados | ${erros} erros`)
  }

  console.log('\n✅ Restauração concluída!\n')
}

const arg = process.argv[2] || 'latest'
restaurar(arg).catch(console.error)
