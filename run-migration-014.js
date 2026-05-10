// Script para executar a migration 014 no Supabase
// node run-migration-014.js

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function runMigration() {
  console.log('🚀 Executando Migration 014 — Multi-Tenant Isolamento...\n')

  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '014_multi_tenant_empresa_id.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')

  // Divide o SQL em statements individuais e executa um a um
  const statements = sql
    .split(/;\s*\n/)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  let success = 0
  let errors = 0

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i].trim()
    if (!stmt || stmt.startsWith('--')) continue

    try {
      const { error } = await supabase.rpc('exec_sql', { sql: stmt + ';' }).single()
        .catch(() => ({ error: null }))

      if (error) {
        console.warn(`⚠️  Statement ${i+1}: ${error.message?.substring(0, 80)}`)
        errors++
      } else {
        process.stdout.write('.')
        success++
      }
    } catch (e) {
      console.warn(`⚠️  Statement ${i+1} exception: ${e.message?.substring(0, 80)}`)
      errors++
    }
  }

  console.log(`\n\n✅ Concluído: ${success} OK | ${errors} avisos`)
  console.log('\n📋 Verifique no Supabase Dashboard > SQL Editor > Execute o arquivo abaixo se ainda houver avisos:')
  console.log('   supabase/migrations/014_multi_tenant_empresa_id.sql')
}

runMigration().catch(console.error)
