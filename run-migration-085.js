/**
 * run-migration-085.js
 * Utilitário para verificar e exibir a migration 085 (Open Finance)
 * Uso: node run-migration-085.js
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  console.log('=== VERIFICAÇÃO DA MIGRATION 085 (OPEN FINANCE) ===\n')

  const { data, error } = await supabase.from('open_finance_conexoes').select('id').limit(1)

  if (!error) {
    console.log('✅ A tabela open_finance_conexoes JÁ ESTÁ CRIADA e ativa no Supabase!')
    return
  }

  console.log('⚠️  Tabela open_finance_conexoes ainda não foi criada no banco.')
  console.log('   Copie e cole o SQL abaixo no Supabase Dashboard → SQL Editor:\n')
  console.log('='.repeat(70))

  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '085_open_finance.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')
  console.log(sql)

  console.log('='.repeat(70))
  console.log('\nApós rodar no Supabase, execute `node run-migration-085.js` novamente para confirmar.\n')
}

main().catch(console.error)
