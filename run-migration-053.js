// run-migration-053.js — Cria tabela alertas_recorrentes para contas fixas mensais
// Necessário para que Elena possa cadastrar contas recorrentes (energia, internet, aluguel, etc.)

const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'

const SQL = fs.readFileSync(
  path.join(__dirname, 'supabase/migrations/053_alertas_recorrentes.sql'),
  'utf8'
)

async function runStatement(sql) {
  const res = await fetch(`${SUPABASE_URL}/pg/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  })
  return { status: res.status, ok: res.ok, body: await res.text() }
}

async function main() {
  console.log('=== Migration 053 — alertas_recorrentes ===\n')
  console.log('Criando tabela para contas fixas mensais (energia, internet, aluguel...)\n')

  // Divide o SQL em statements individuais
  const statements = SQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  let ok = 0, erros = 0

  for (const stmt of statements) {
    const label = stmt.substring(0, 70).replace(/\s+/g, ' ').trim()
    try {
      const result = await runStatement(stmt)
      if (result.ok || result.status === 200) {
        console.log(`✅ ${label}...`)
        ok++
      } else {
        // Ignora erros de "já existe" (IF NOT EXISTS pode não estar disponível)
        if (result.body.includes('already exists') || result.body.includes('já existe')) {
          console.log(`⚠️  Já existe: ${label.substring(0, 50)}...`)
          ok++
        } else {
          console.log(`❌ ${label}...\n   ${result.body.substring(0, 150)}`)
          erros++
        }
      }
    } catch (e) {
      console.log(`❌ Erro de rede: ${e.message}`)
      erros++
    }
  }

  console.log(`\n=== Resultado: ${ok} ok, ${erros} erros ===`)

  if (erros > 0 || ok === 0) {
    console.log('\n⚠️  ALTERNATIVA MANUAL — copie e execute no Supabase SQL Editor:')
    console.log('   https://supabase.com/dashboard/project/wagkyyqstsgetktefewd/sql/new')
    console.log('\n--- INÍCIO DO SQL ---')
    console.log(SQL)
    console.log('--- FIM DO SQL ---')
  } else {
    console.log('\n✅ Migration 053 aplicada com sucesso!')
    console.log('   Elena agora pode cadastrar contas recorrentes mensais.')
  }
}

main().catch(console.error)
