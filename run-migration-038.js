/**
 * run-migration-038.js
 * Executa a migration 038 via fetch direto na API SQL do Supabase.
 * Uso: node run-migration-038.js
 */

const fs   = require('fs')
const path = require('path')

const SUPABASE_URL     = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'

async function execSQL(sql) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text)
  }
  return res.json().catch(() => null)
}

async function runMigration() {
  console.log('\n🚀 Migration 038 — Isolamento de faturas_cartoes por user_id\n')
  console.log('⚠️  ATENÇÃO: Execute o SQL diretamente no Supabase SQL Editor, pois a')
  console.log('   função exec_sql pode não estar disponível neste projeto.\n')
  console.log('   Caminho do arquivo:')
  console.log('   supabase/migrations/038_add_user_id_to_contas_e_faturas.sql\n')

  // Tenta via fetch mesmo assim
  const sqlPath = path.join(__dirname, 'supabase', 'migrations', '038_add_user_id_to_contas_e_faturas.sql')
  const fullSQL = fs.readFileSync(sqlPath, 'utf-8')

  try {
    await execSQL(fullSQL)
    console.log('✅ Migration executada via RPC com sucesso!\n')
  } catch (e) {
    // Fallback: tenta via endpoint pg
    try {
      const res = await fetch(`${SUPABASE_URL}/pg`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ query: fullSQL }),
      })
      if (res.ok) {
        console.log('✅ Migration executada via /pg com sucesso!\n')
      } else {
        throw new Error(await res.text())
      }
    } catch (e2) {
      console.log('❌ Não foi possível executar automaticamente.')
      console.log('   Execute o SQL manualmente no Supabase SQL Editor:\n')
      console.log('─'.repeat(60))
      console.log(fullSQL)
      console.log('─'.repeat(60))
    }
  }
}

runMigration().catch(console.error)
