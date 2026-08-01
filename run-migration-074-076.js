// run-migration-074-076.js — Executa migrations 074, 075 e 076
// Usa REST API /rest/v1/rpc/exec_sql ou imprime SQL para execução manual

const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const SUPABASE_URL = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZ2t5eXFzdHNnZXRrdGVmZXdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTk3MjE1MCwiZXhwIjoyMDkxNTQ4MTUwfQ.KowvODIBfe2shrPXUDP4vzUMzIy3tDAxpAE6I0CqKlw'

const MIGRATIONS = [
  { file: '074_pagamentos_veiculos.sql', label: '074 — pagamentos_veiculos + pagamentos_imoveis' },
  { file: '075_periodicidade_parcelamento.sql', label: '075 — periodicidade (mensal/bimestral/etc)' },
  { file: '076_observacoes_patrimonio.sql', label: '076 — observacoes / bloco de anotações' },
]

async function main() {
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  console.log('=== Executor de Migrations 074 → 076 ===\n')

  // Primeiro, testar se exec_sql existe
  const { error: testErr } = await supabase.rpc('exec_sql', { sql_text: "SELECT 1;" })
  const hasExecSql = !testErr

  if (!hasExecSql) {
    console.log('⚠️  Função exec_sql NÃO encontrada no banco.')
    console.log('   Criando a função exec_sql...\n')

    // Tentar criar exec_sql via REST
    const createFnSql = `
      CREATE OR REPLACE FUNCTION exec_sql(sql_text TEXT)
      RETURNS VOID AS $$
      BEGIN
        EXECUTE sql_text;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `
    const { error: createErr } = await supabase.rpc('exec_sql', { sql_text: createFnSql })
    if (createErr) {
      // Não conseguiu criar — precisa execução manual
      console.log('❌ Não foi possível criar exec_sql automaticamente.')
      console.log('')
      console.log('📋 EXECUÇÃO MANUAL NECESSÁRIA:')
      console.log('   Abra o SQL Editor do Supabase Dashboard:')
      console.log('   https://supabase.com/dashboard/project/wagkyyqstsgetktefewd/sql/new')
      console.log('')
      console.log('   Primeiro, crie a função exec_sql (copie e cole):')
      console.log('─'.repeat(60))
      console.log(createFnSql)
      console.log('─'.repeat(60))
      console.log('')
      console.log('   Depois, execute os 3 arquivos SQL abaixo (um por vez):')
      console.log('')

      for (const mig of MIGRATIONS) {
        const filePath = path.join(__dirname, 'supabase/migrations', mig.file)
        const sql = fs.readFileSync(filePath, 'utf8')
        console.log(`\n${'═'.repeat(60)}`)
        console.log(`📄 ${mig.label}`)
        console.log(`${'═'.repeat(60)}`)
        console.log(sql)
      }

      console.log('\n\n💡 Ou rode este script novamente após criar a função exec_sql.')
      return
    }
    console.log('✅ Função exec_sql criada com sucesso!\n')
  } else {
    console.log('✅ Função exec_sql encontrada no banco.\n')
  }

  // Agora executar cada migration
  let totalOk = 0
  let totalErros = 0

  for (const mig of MIGRATIONS) {
    const filePath = path.join(__dirname, 'supabase/migrations', mig.file)
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Arquivo não encontrado: ${mig.file} — pulando.`)
      continue
    }

    const sql = fs.readFileSync(filePath, 'utf8')
    console.log(`📄 ${mig.label}`)
    console.log('─'.repeat(60))

    // Tentar executar o SQL inteiro de uma vez
    const { error } = await supabase.rpc('exec_sql', { sql_text: sql })
    if (error) {
      // Se falhou, tentar statement por statement
      console.log(`  ⚠️ Execução em bloco falhou: ${error.message?.substring(0, 80)}`)
      console.log('  → Tentando statement por statement...\n')

      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.split('\n').every(l => l.trim().startsWith('--') || l.trim() === ''))

      let ok = 0, erros = 0
      for (const stmt of statements) {
        const label = stmt.substring(0, 65).replace(/\s+/g, ' ').trim()
        const { error: stmtErr } = await supabase.rpc('exec_sql', { sql_text: stmt + ';' })
        if (stmtErr) {
          if (stmtErr.message?.includes('already exists')) {
            console.log(`  ⚠️  Já existe: ${label}...`)
            ok++
          } else {
            console.log(`  ❌ ${label}...\n     ${stmtErr.message?.substring(0, 120)}`)
            erros++
          }
        } else {
          console.log(`  ✅ ${label}...`)
          ok++
        }
      }
      totalOk += ok
      totalErros += erros
      console.log(`  📋 ${ok} OK, ${erros} erros`)
    } else {
      console.log(`  ✅ Migration executada com sucesso!`)
      totalOk++
    }
    console.log('')
  }

  console.log('═'.repeat(60))
  console.log(`📊 TOTAL: ${totalOk} OK, ${totalErros} com erro`)

  if (totalErros === 0) {
    console.log('\n🎉 Todas as migrations aplicadas!')
    console.log('   → observacoes e periodicidade agora serão salvos.')
  } else {
    console.log('\n💡 Copie os SQLs que falharam e execute no Supabase SQL Editor:')
    console.log('   https://supabase.com/dashboard/project/wagkyyqstsgetktefewd/sql/new')
  }
}

main().catch(console.error)
