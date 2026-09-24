// ── teste-pluggy.mjs ──────────────────────────────────────────
//
// Responde a ÚNICA pergunta que decide se Open Finance resolve o problema
// do Cajado: o extrato do banco diz o suficiente para casar cada débito
// com o boleto certo?
//
// Se o Bradesco mandar "PAGTO BOLETO 23793..." sem nada que identifique o
// Sítio Mucugê, a conciliação continua manual e o Open Finance vira
// conveniência — bom, mas não resolve o que vem machucando o Sr. Max.
// Melhor descobrir isso com sessenta linhas de script do que depois de
// assinar contrato de R$ 540 ou R$ 2.500 por mês.
//
// O script SÓ LÊ. Não grava nada, nem na Pluggy nem no Supabase.
//
// ── COMO RODAR ───────────────────────────────────────────────
// 1. O Sr. Max conecta as contas dele em https://meu.pluggy.ai
// 2. Você cria uma aplicação no Dashboard da Pluggy e pega Client ID/Secret
// 3. No Meu Pluggy, cada conexão tem um "item id" — copie os que quiser ver
// 4. No PowerShell, na raiz do projeto:
//
//      $env:PLUGGY_CLIENT_ID     = "..."
//      $env:PLUGGY_CLIENT_SECRET = "..."
//      $env:PLUGGY_ITEM_IDS      = "item-1,item-2"
//      node teste-pluggy.mjs
//
// ⚠️ As credenciais vão por variável de ambiente de propósito: NÃO escreva
// elas aqui dentro nem commite. O Client Secret dá acesso aos dados
// bancários — é do mesmo nível do service role do Supabase.
// ─────────────────────────────────────────────────────────────

const API = 'https://api.pluggy.ai'

const CLIENT_ID     = process.env.PLUGGY_CLIENT_ID
const CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET
const ITEM_IDS      = (process.env.PLUGGY_ITEM_IDS || '').split(',').map(s => s.trim()).filter(Boolean)
const DIAS          = Number(process.env.DIAS || 60)

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Faltou PLUGGY_CLIENT_ID e/ou PLUGGY_CLIENT_SECRET no ambiente.')
  process.exit(1)
}
if (ITEM_IDS.length === 0) {
  console.error('Faltou PLUGGY_ITEM_IDS. Pegue o id de cada conexão no Meu Pluggy.')
  process.exit(1)
}

// Valores que o Cajado conhece. Se um débito bater com algum deles, o
// script marca — é o atalho para enxergar de relance o que casaria.
const BOLETOS_CONHECIDOS = [
  { nome: 'Sítio Mucugê',            valor: 1400.00 },
  { nome: 'Sítio São Roque',         valor: 1035.00 },
  { nome: 'Sítio Vida',              valor: 3300.00 },
  { nome: 'Sítio Palmeira',          valor:  400.00 },
  { nome: 'Apartamento Ciacci',      valor: 1650.00 },
  { nome: 'Intermediárias Ciacci',   valor: 10000.00 },
  { nome: 'Terreno Baron (VCA)',     valor:  462.00 },
  { nome: 'Energia Solar (Jurema)',  valor: 1033.00 },
  { nome: 'Placa Solar Complemento', valor:  600.00 },
  { nome: 'Contrato 2',              valor: 2628.46 },
  { nome: 'Contrato 3',              valor: 4916.69 },
  { nome: 'Plano de Saúde',          valor: 2362.50 },
  { nome: 'Cartão XP',               valor:  127.90 },
]

const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

async function chamar(caminho, apiKey) {
  const r = await fetch(`${API}${caminho}`, { headers: { 'X-API-KEY': apiKey } })
  const corpo = await r.text()
  if (!r.ok) {
    // Erro completo de propósito: a API pode ter mudado desde que escrevi
    // isto, e mensagem truncada não deixa ninguém consertar.
    throw new Error(`GET ${caminho} → ${r.status}\n${corpo}`)
  }
  return JSON.parse(corpo)
}

// ── Transações, com paginação por cursor ─────────────────────
// 24/09/2026: o endpoint /transactions foi aposentado pela Pluggy
// ("ENDPOINT_DEPRECATED, use GET /v2/transactions with cursor pagination").
// O /v2 devolve um cursor para a próxima página em vez de número de página.
// Como não tenho certeza do nome exato do campo do cursor, aceito as três
// grafias possíveis e paro quando nenhuma aparecer — adivinhar errado aqui
// daria "0 lançamentos" de novo, que é a resposta que mais engana.
async function buscarTransacoes(accountId, de, ate, apiKey) {
  const todas = []
  let cursor = null

  for (let pagina = 0; pagina < 25; pagina++) {
    // 24/09/2026: o /v2 recusa `from`, `to` e `pageSize`
    // ("property from should not exist..."). Só aceita accountId e cursor.
    // Então o recorte de data é feito aqui embaixo, em memória — o que é
    // aceitável: a conta do teste tem poucos lançamentos, e para volume
    // grande o corte de 25 páginas segura.
    const p = new URLSearchParams({ accountId })
    if (cursor) p.set('cursor', cursor)
    const r = await chamar(`/v2/transactions?${p.toString()}`, apiKey)

    const lote = r.results ?? r.data ?? []
    if (pagina === 0 && !Array.isArray(lote)) {
      console.log('  Formato inesperado. Chaves da resposta:', Object.keys(r).join(', '))
      console.log('  ' + JSON.stringify(r).slice(0, 800))
      return []
    }

    todas.push(...lote)
    cursor = r.nextCursor ?? r.next_cursor ?? r.cursor ?? null
    if (!cursor || lote.length === 0) break
  }

  const dentroDoPeriodo = todas.filter(t => {
    const d = String(t.date ?? t.createdAt ?? '').slice(0, 10)
    return d >= de && d <= ate
  })

  if (todas.length > 0 && dentroDoPeriodo.length === 0) {
    console.log(`  (${todas.length} lançamentos vieram, nenhum entre ${de} e ${ate})`)
    console.log(`  mais antigo: ${String(todas[todas.length - 1]?.date).slice(0, 10)} · mais recente: ${String(todas[0]?.date).slice(0, 10)}`)
  }

  return dentroDoPeriodo
}

async function main() {
  // 1. Autenticação
  const rAuth = await fetch(`${API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: CLIENT_ID, clientSecret: CLIENT_SECRET }),
  })
  if (!rAuth.ok) throw new Error(`POST /auth → ${rAuth.status}\n${await rAuth.text()}`)
  const { apiKey } = await rAuth.json()
  console.log('✓ Autenticado na Pluggy\n')

  const ate   = new Date()
  const de    = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000)
  const iso   = (d) => d.toISOString().slice(0, 10)

  let totalTx = 0
  let comCasamento = 0

  for (const itemId of ITEM_IDS) {
    // Estado do item primeiro: se ele estiver desatualizado ou com erro, a
    // lista de contas vem vazia e não dá para saber por quê olhando só o
    // resultado. Melhor perguntar.
    try {
      const item = await chamar(`/items/${itemId}`, apiKey)
      console.log(`ITEM ${itemId}`)
      console.log(`  conector: ${item?.connector?.name ?? '?'}`)
      console.log(`  status:   ${item?.status ?? '?'}${item?.executionStatus ? ` (${item.executionStatus})` : ''}`)
      console.log(`  atualizado em: ${item?.lastUpdatedAt ?? '—'}`)
      if (item?.error) console.log(`  erro: ${JSON.stringify(item.error)}`)
      console.log('')
    } catch (e) {
      console.log(`(não consegui ler o item ${itemId}: ${e.message})\n`)
    }

    const contas = await chamar(`/accounts?itemId=${itemId}`, apiKey)

    if (!contas.results || contas.results.length === 0) {
      // Resposta crua quando vier vazia. Sem isto, "0 lançamentos" tanto
      // pode ser conta sem movimento quanto formato diferente do esperado —
      // e adivinhar qual dos dois é como se perde uma noite.
      console.log('Nenhuma conta veio nesta resposta. Conteúdo cru:')
      console.log(JSON.stringify(contas, null, 2).slice(0, 2000))
      console.log('')
      continue
    }

    for (const c of (contas.results || [])) {
      console.log('═'.repeat(72))
      console.log(`CONTA: ${c.name ?? c.type} · ${c.number ?? ''} · saldo ${brl(c.balance ?? 0)}`)
      console.log('═'.repeat(72))

      const bruto = await buscarTransacoes(c.id, iso(de), iso(ate), apiKey)
      const lista = bruto.sort((a, b) => String(a.date).localeCompare(String(b.date)))

      if (lista.length === 0) {
        console.log('  (nenhum lançamento no período)\n')
        continue
      }

      // CRU=1 → imprime o objeto completo dos 3 primeiros lançamentos.
      // A `description` é só um dos campos; o nome de quem recebeu costuma
      // estar em `paymentData`. Julgar a viabilidade sem olhar o resto seria
      // condenar a ideia por preguiça.
      if (process.env.CRU === '1') {
        console.log('  ── objeto completo dos 3 primeiros ──')
        lista.slice(0, 3).forEach(t => console.log(JSON.stringify(t, null, 2)))
        console.log('  ── fim ──\n')
      }

      for (const t of lista) {
        totalTx++
        const valor = Math.abs(Number(t.amount) || 0)
        const saida = Number(t.amount) < 0
        const casa  = BOLETOS_CONHECIDOS.find(b => Math.abs(b.valor - valor) < 0.01)
        if (casa) comCasamento++

        console.log(
          `${String(t.date).slice(0, 10)}  ${saida ? '−' : '+'}${brl(valor).padStart(14)}  ` +
          `${String(t.description || '').slice(0, 44).padEnd(44)}` +
          (casa ? `  ⇐ bate com ${casa.nome}` : ''),
        )
      }
      console.log('')
    }
  }

  // ── O veredito ───────────────────────────────────────────────
  console.log('═'.repeat(72))
  console.log(`${totalTx} lançamentos no período · ${comCasamento} com valor igual a boleto conhecido`)
  console.log('')
  console.log('A pergunta que só VOCÊ pode responder, olhando a coluna de descrição:')
  console.log('  dá para saber QUAL boleto é cada débito, sem consultar outra coisa?')
  console.log('')
  console.log('  Se dá  → a conciliação automática é viável, e o Open Finance resolve.')
  console.log('  Se não → ele economiza o Max de contar os pagamentos, mas alguém ainda')
  console.log('           precisa dizer a que se refere cada um. Continua valendo, só')
  console.log('           não resolve sozinho.')
  console.log('')
  console.log('Casamento por VALOR (o ⇐ acima) é pista, não prova: duas parcelas de')
  console.log('R$ 1.400 no mesmo mês são indistinguíveis só pelo número.')
}

main().catch(e => { console.error('\n✖', e.message); process.exit(1) })
