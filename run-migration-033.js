const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function runMigration() {
  console.log('🚀 Criando Bucket Inbox-Media no Supabase...\n')

  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '033_inbox_media_bucket.sql')
  const sql = fs.readFileSync(sqlPath, 'utf-8')

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
  if (errors > 0) {
    console.log('\n📋 Por favor, abra o Painel do Supabase > SQL Editor > New Query e cole todo o conteúdo do arquivo:')
    console.log('   supabase/migrations/033_inbox_media_bucket.sql')
  }
}

runMigration().catch(console.error)
