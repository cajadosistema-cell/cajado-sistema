require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const SUPABASE_URL = 'https://wagkyyqstsgetktefewd.supabase.co'
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || ''
const APP_URL = 'http://localhost:3000'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)
const USER_ID_MAX  = 'd7f70a0c-19ed-4301-8541-bc3f097e97f3'
const EMPRESA_CAJADO = '658ed627-c84e-46c0-a9d2-83c4a1b66bca'

let passou = 0
let falhou = 0

function ok(msg)   { console.log(`  ✅ ${msg}`); passou++ }
function fail(msg) { console.log(`  ❌ ${msg}`); falhou++ }
function sec(msg)  { console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n🔍 ${msg}`) }

async function run() {
  console.log('╔══════════════════════════════════════╗')
  console.log('║   TESTE COMPLETO — SISTEMA CAJADO    ║')
  console.log('╚══════════════════════════════════════╝')

  // ─────────────────────────────────────────────
  sec('1. CARTÕES DO SR. MAX')
  // ─────────────────────────────────────────────

  const { data: cartoes, error: ce } = await supabase
    .from('contas')
    .select('id, nome_cartao, nome, empresa_id, user_id, tipo, ativo, bandeira')
    .eq('user_id', USER_ID_MAX)
    .eq('empresa_id', EMPRESA_CAJADO)
    .in('tipo', ['cartao_credito', 'cartao_debito'])
    .eq('ativo', true)

  if (ce) {
    fail(`Erro ao buscar cartões: ${ce.message}`)
  } else if (!cartoes || cartoes.length === 0) {
    fail('Nenhum cartão ativo encontrado para o Max!')
  } else {
    ok(`${cartoes.length} cartões ativos encontrados`)
    for (const c of cartoes) {
      const empOk = c.empresa_id === EMPRESA_CAJADO
      const userOk = c.user_id === USER_ID_MAX
      if (empOk && userOk) {
        ok(`"${c.nome_cartao || c.nome}" [${c.bandeira}] — empresa ✓ user ✓`)
      } else {
        fail(`"${c.nome_cartao || c.nome}" — empresa=${empOk ? '✓' : '✗'} user=${userOk ? '✓' : '✗'}`)
      }
    }
  }

  // ─────────────────────────────────────────────
  sec('2. LANÇAMENTOS PESSOAIS (gastos)')
  // ─────────────────────────────────────────────

  const { data: gastos, error: ge } = await supabase
    .from('gastos_pessoais')
    .select('id, descricao, valor, data, forma_pagamento')
    .eq('user_id', USER_ID_MAX)
    .order('data', { ascending: false })
    .limit(10)

  if (ge) {
    fail(`Erro ao buscar gastos: ${ge.message}`)
  } else if (!gastos || gastos.length === 0) {
    fail('Nenhum lançamento de gasto encontrado!')
  } else {
    ok(`${gastos.length} gastos encontrados (últimos 10)`)
    const mesAtual = new Date().toISOString().substring(0, 7)
    const doMes = gastos.filter(g => g.data?.startsWith(mesAtual))
    ok(`${doMes.length} lançamentos no mês atual (${mesAtual})`)
    console.log('  📋 Últimos 3 lançamentos:')
    for (const g of gastos.slice(0, 3)) {
      console.log(`     • ${g.data} | ${g.descricao?.substring(0, 30)} | R$ ${Number(g.valor).toFixed(2)} | ${g.forma_pagamento}`)
    }
  }

  // ─────────────────────────────────────────────
  sec('3. LANÇAMENTOS PESSOAIS (receitas)')
  // ─────────────────────────────────────────────

  const { data: receitas, error: re } = await supabase
    .from('receitas_pessoais')
    .select('id, descricao, valor, data')
    .eq('user_id', USER_ID_MAX)
    .order('data', { ascending: false })
    .limit(5)

  if (re) {
    fail(`Erro ao buscar receitas: ${re.message}`)
  } else if (!receitas || receitas.length === 0) {
    fail('Nenhuma receita pessoal encontrada!')
  } else {
    ok(`${receitas.length} receitas encontradas`)
    for (const r of receitas.slice(0, 3)) {
      console.log(`     • ${r.data} | ${r.descricao?.substring(0, 30)} | R$ ${Number(r.valor).toFixed(2)}`)
    }
  }

  // ─────────────────────────────────────────────
  sec('4. ELENA — API OpenRouter (GPT-4o)')
  // ─────────────────────────────────────────────

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://cajado-sistema.vercel.app',
        'X-Title': 'Cajado Sistema Teste',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          { role: 'system', content: 'Voce e a Elena, assistente da Cajado Solucoes. Responda em portugues brasileiro de forma curta.' },
          { role: 'user',   content: 'Diga apenas "Elena funcionando!" sem mais nada.' }
        ],
        max_tokens: 20,
      })
    })

    const data = await res.json()

    if (!res.ok) {
      fail(`OpenRouter retornou erro ${res.status}: ${data.error?.message || JSON.stringify(data)}`)
    } else {
      const resposta = data.choices?.[0]?.message?.content ?? ''
      ok(`GPT-4o respondeu: "${resposta.trim()}"`)
      ok(`Modelo usado: ${data.model}`)
      ok(`Tokens usados: ${data.usage?.total_tokens ?? '?'}`)
    }
  } catch (err) {
    fail(`Erro de conexão com OpenRouter: ${err.message}`)
  }

  // ─────────────────────────────────────────────
  sec('5. API INTERNA (/api/openrouter) — via Next.js')
  // ─────────────────────────────────────────────

  try {
    const res = await fetch(`${APP_URL}/api/openrouter`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'Diga apenas "API OK" sem mais nada.' })
    })
    if (!res.ok) {
      const txt = await res.text()
      fail(`API interna retornou ${res.status}: ${txt.substring(0, 100)}`)
    } else {
      const d = await res.json()
      if (d.error) {
        fail(`API interna erro: ${d.error}`)
      } else {
        ok(`API interna OK! Resposta: "${(d.result ?? '').trim().substring(0, 50)}"`)
        ok(`Modelo utilizado: ${d.model}`)
      }
    }
  } catch (err) {
    fail(`API interna indisponível (servidor local ligado?): ${err.message}`)
  }

  // ─────────────────────────────────────────────
  // RESULTADO FINAL
  // ─────────────────────────────────────────────
  console.log('\n══════════════════════════════════════')
  console.log(`  RESULTADO: ${passou} ✅ passaram | ${falhou} ❌ falharam`)
  console.log('══════════════════════════════════════')
  if (falhou === 0) {
    console.log('  🎉 Tudo funcionando corretamente!')
  } else {
    console.log('  ⚠️  Há itens que precisam de atenção acima.')
  }
}

run().catch(console.error)
