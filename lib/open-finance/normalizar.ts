// ── lib/open-finance/normalizar.ts ────────────────────────────
//
// 24/09/2026. A lógica de importar uma transação do Open Finance estava
// COPIADA em dois lugares: `api/open-finance/conexoes/route.ts` (quando se
// conecta/vincula um item) e `api/open-finance/sync/route.ts` (quando se
// aperta Sincronizar). As duas cópias gravavam sempre em `lancamentos`.
//
// Corrigi uma e achei que tinha acabado. Não tinha: o botão Sincronizar
// chama a OUTRA, e a tela de PF continuou vazia. Duas cópias da mesma
// regra é exatamente o defeito que produziu quase todos os bugs deste
// sistema — projeção × resumo, card × resumo, e agora este.
//
// Então a regra mora aqui, uma vez. As duas rotas chamam.

export interface ContextoImportacao {
  categoriaConta: string        // 'pf' | 'pj' — do CADASTRO da conta, não da tela
  empresaId: string | null
  userId: string
  contaId: string
  connectorName: string
  origem: string                // texto que vai nas observações
}

// ── Nome curto da conta ──────────────────────────────────────
// "PICPAY INSTITUIÇÃO DE PAGAMENTO S.A (MeuPluggy)" é o texto que aparece
// na lista de "de qual conta saiu o pagamento" — e o Sr. Max escolhe conta
// FALANDO com a Elena. Nome que ninguém fala em voz alta não serve aqui.
const MARCAS_CONHECIDAS: Record<string, string> = {
  picpay: 'PicPay', infinitepay: 'InfinitePay', nubank: 'Nubank',
  itau: 'Itaú', bradesco: 'Bradesco', santander: 'Santander',
  inter: 'Inter', c6: 'C6 Bank', xp: 'XP', btg: 'BTG',
  caixa: 'Caixa', 'banco do brasil': 'Banco do Brasil',
  'mercado pago': 'Mercado Pago', neon: 'Neon', original: 'Original',
  safra: 'Safra', sicoob: 'Sicoob', sicredi: 'Sicredi',
  pagbank: 'PagBank', pagseguro: 'PagBank', stone: 'Stone', will: 'Will Bank',
}

const RUIDO = /\b(institui[çc][aã]o|de|pagamento|pagamentos|banco|m[uú]ltiplo|s\/?\.?a\.?|sa|ltda|me|epp|cr[eé]dito|financiamento|investimento|conta|corrente)\b/gi

export function semAcento(t: string) {
  return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function nomeCurtoDaConta(nomeBruto: string, connectorName: string): string {
  const base = String(nomeBruto || connectorName || 'Conta').trim()
  const chave = semAcento(base).toLowerCase()

  for (const [marca, bonito] of Object.entries(MARCAS_CONHECIDAS)) {
    if (chave.includes(marca)) return bonito
  }

  const limpo = base.replace(RUIDO, ' ').replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  if (!limpo) return base // sobrou nada: melhor o nome feio que nome vazio

  return limpo === limpo.toUpperCase()
    ? limpo.toLowerCase().replace(/(^|\s)\p{L}/gu, s => s.toUpperCase())
    : limpo
}

// ── A transação ──────────────────────────────────────────────
// Decide o LIVRO e monta a linha no formato daquele livro.
//
// `lancamentos` é o livro da PJ: contábil, com regime, competência × caixa,
// status. `gastos_pessoais` / `receitas_pessoais` são o livro da PF:
// simples, uma data, categoria em texto. As telas de PF não leem o da PJ —
// foi assim que o PicPay ficou com saldo certo e movimentação zerada.
export function montarImportacao(tx: any, ctx: ContextoImportacao): {
  tabela: 'lancamentos' | 'gastos_pessoais' | 'receitas_pessoais'
  linha: Record<string, any>
} {
  const isDespesa = tx.amount < 0 || tx.type === 'DEBIT'
  const ehPessoal = ctx.categoriaConta === 'pf'
  const valorAbs = Math.abs(Number(tx.amount) || 0)
  const dataTx = String(tx.date ?? tx.createdAt ?? new Date().toISOString()).slice(0, 10)

  // Enriquecer a descrição é o que torna a conciliação possível. A
  // `description` do banco costuma ser genérica ("PIX enviado"), mas
  // `paymentData` traz o CPF/CNPJ de quem recebeu — e cada credor do Sr.
  // Max tem CNPJ fixo. É por aí que um débito vira "parcela da Ciacci".
  let descFinal = tx.description || 'Transação bancária'
  const receiverName = tx.paymentData?.receiver?.name
  const receiverDoc = tx.paymentData?.receiver?.documentNumber?.value
  const payerName = tx.paymentData?.payer?.name
  const payerDoc = tx.paymentData?.payer?.documentNumber?.value

  if (isDespesa && (receiverName || receiverDoc)) {
    const info = receiverName || `CPF/CNPJ ${receiverDoc}`
    if (!descFinal.toLowerCase().includes(String(info).toLowerCase())) {
      descFinal = `${descFinal} (${info})`
    }
  } else if (!isDespesa && (payerName || payerDoc)) {
    const info = payerName || `CPF/CNPJ ${payerDoc}`
    if (!descFinal.toLowerCase().includes(String(info).toLowerCase())) {
      descFinal = `${descFinal} (${info})`
    }
  }

  const obsPartes: string[] = [`${ctx.origem} (${ctx.connectorName})`]
  if (tx.paymentData?.paymentMethod) obsPartes.push(`Método: ${tx.paymentData.paymentMethod}`)
  if (receiverDoc) obsPartes.push(`Destino Doc: ${receiverDoc}`)
  if (payerDoc) obsPartes.push(`Origem Doc: ${payerDoc}`)
  if (tx.category) obsPartes.push(`Categoria: ${tx.category}`)
  const observacoes = obsPartes.join(' | ')

  if (ehPessoal) {
    const linha: Record<string, any> = {
      user_id: ctx.userId,
      conta_id: ctx.contaId,
      descricao: descFinal,
      valor: valorAbs,
      categoria: tx.category || 'outros',
      data: dataTx,
      recorrente: false,
      notas: observacoes,
      open_finance_id: tx.id,
    }
    // `forma_pagamento` só existe em gastos_pessoais.
    if (isDespesa) {
      linha.forma_pagamento = String(tx.paymentData?.paymentMethod || 'outro').toLowerCase()
    }
    return { tabela: isDespesa ? 'gastos_pessoais' : 'receitas_pessoais', linha }
  }

  return {
    tabela: 'lancamentos',
    linha: {
      empresa_id: ctx.empresaId,
      conta_id: ctx.contaId,
      descricao: descFinal,
      valor: valorAbs,
      tipo: isDespesa ? 'despesa' : 'receita',
      regime: 'caixa',
      status: 'validado',
      data_competencia: dataTx,
      data_caixa: dataTx,
      open_finance_id: tx.id,
      open_finance_tipo: tx.type,
      observacoes,
      conciliado: true,
      created_by: ctx.userId,
    },
  }
}

// ── Gravar uma transação ─────────────────────────────────────
// Confere se já existe, insere, e trata 23505 (índice único) como "já
// existe" em vez de erro. Devolve true quando gravou de fato.
export async function importarTransacao(
  adminSupabase: any,
  tx: any,
  ctx: ContextoImportacao,
): Promise<boolean> {
  const { tabela, linha } = montarImportacao(tx, ctx)

  const { data: jaExiste } = await (adminSupabase.from(tabela) as any)
    .select('id')
    .eq('open_finance_id', tx.id)
    .maybeSingle()
  if (jaExiste) return false

  const { error } = await (adminSupabase.from(tabela) as any).insert(linha)
  if (error) {
    // 23505 = índice único. A transação já está lá; a trava fez o trabalho.
    if (error.code !== '23505') {
      console.warn(`[open-finance] não importei ${tx.id} para ${tabela}:`, error.message)
    }
    return false
  }
  return true
}
