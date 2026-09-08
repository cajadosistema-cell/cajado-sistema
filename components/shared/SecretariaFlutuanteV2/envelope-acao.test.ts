// ── components/shared/SecretariaFlutuanteV2/envelope-acao.test.ts ──
//
// 08/09/2026. O Sr. Max informou dois pagamentos e eles continuaram
// vencidos. A causa: o modelo empacotou `registrar_pagamento` dentro de
// um envelope `registro` — que grava uma anotação e não marca nada como
// pago, e que por não ser destrutivo passou direto pelo gate de
// confirmação. Silencioso: sem erro, sem pergunta, sem diagnóstico.
//
// Os dois payloads abaixo são os REAIS, copiados de elena_conversas.
// A cópia da função é proposital: o que estes testes protegem é a regra,
// e a regra tem de continuar valendo mesmo se o hook for reescrito.

import { describe, it, expect } from 'vitest'

const ENVELOPE_CORRETO: Record<string, string> = {
  registrar_pagamento: 'confirmar_pagamento',
  marcar_como_pago:    'confirmar_pagamento',
  marcar_pago:         'confirmar_pagamento',
  pagar:               'confirmar_pagamento',
  confirmar_pagamento: 'confirmar_pagamento',
}

export function normalizarEnvelopeAcao(acao: any): any {
  if (!acao || typeof acao !== 'object') return acao
  const intencao = String(acao?.dados?.acao || '').toLowerCase().trim()
  const alvo = ENVELOPE_CORRETO[intencao]
  // Sem intenção declarada, ou envelope já correto: não mexe em nada.
  if (!alvo || acao.tipo === alvo) return acao

  const d: Record<string, any> = { ...(acao.dados || {}) }

  if (alvo === 'confirmar_pagamento') {
    // O handler lê `nome`, `valor_pago` e `tipo`; o modelo escreveu
    // `descricao`, `valor` e pôs o nome da AÇÃO em `tipo`. Só preenche o
    // que falta — nunca sobrescreve campo que já veio certo.
    if (d.nome == null && d.descricao != null) d.nome = d.descricao
    if (d.valor_pago == null && d.valor != null) d.valor_pago = d.valor
    // `tipo` aqui deveria ser imovel/conta_fixa/cartao/veiculo/investimento.
    // Veio 'registrar_pagamento'. Marcar como indefinido faz a CORREÇÃO DE
    // TIPO do handler procurar o nome nas tabelas e descobrir sozinha —
    // é o mesmo mecanismo que resolveu a "Energia Solar Jurema" em 11/08.
    if (!['cartao', 'imovel', 'veiculo', 'conta_fixa', 'investimento'].includes(String(d.tipo))) {
      d.tipo = 'indefinido'
    }
  }

  const nomeRotulo = d.nome || d.descricao || 'item'
  const valorRotulo = Number(d.valor_pago ?? d.valor)
  return {
    ...acao,
    tipo: alvo,
    dados: d,
    // Rótulo reescrito: é ele que o Sr. Max lê na lista de confirmação, e
    // o rótulo antigo dizia "registro", que é justamente o engano.
    label: valorRotulo > 0
      ? `✅ Marcar como pago: ${nomeRotulo} — R$ ${valorRotulo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      : `✅ Marcar como pago: ${nomeRotulo}`,
  }
}


const ACOES_DESTRUTIVAS = [
  'deletar_evento', 'deletar_lancamento', 'deletar_duplicados',
  'editar_lancamento', 'transferencia',
  'confirmar_pagamento', 'reagendar_vencimento', 'editar_financiamento',
]

// Payload REAL de 08/09/2026, copiado de elena_conversas.
const planoDeSaude = {
  tipo: 'registro', status: 'pending', label: 'Registro',
  dados: {
    acao: 'registrar_pagamento', tipo: 'registrar_pagamento',
    valor: 2362.5, categoria: 'saude', descricao: 'Plano de Saúde',
    observacoes: null, conta_origem: 'operacional bradesco',
    data_pagamento: '2026-09-08',
  },
}
const sitioMucuge = {
  tipo: 'registro', status: 'pending', label: 'Registro',
  dados: {
    acao: 'registrar_pagamento', tipo: 'registrar_pagamento',
    valor: 1400, categoria: 'imovel', descricao: 'Sítio Mucugê',
    observacoes: null, conta_origem: 'operacional bradesco',
    parcela_atual: 17,
  },
}

describe('normalizarEnvelopeAcao', () => {
  it('reescreve o envelope errado de 08/09 para confirmar_pagamento', () => {
    const a = normalizarEnvelopeAcao(planoDeSaude)
    expect(a.tipo).toBe('confirmar_pagamento')
    expect(a.dados.nome).toBe('Plano de Saúde')
    expect(a.dados.valor_pago).toBe(2362.5)
    expect(a.dados.conta_origem).toBe('operacional bradesco')
    expect(a.dados.data_pagamento).toBe('2026-09-08')
  })

  it('marca o tipo como indefinido para a busca do handler resolver', () => {
    expect(normalizarEnvelopeAcao(sitioMucuge).dados.tipo).toBe('indefinido')
  })

  it('o resultado CAI no gate de confirmação — que era o furo', () => {
    expect(ACOES_DESTRUTIVAS.includes(planoDeSaude.tipo)).toBe(false)
    expect(ACOES_DESTRUTIVAS.includes(normalizarEnvelopeAcao(planoDeSaude).tipo)).toBe(true)
  })

  it('reescreve o rótulo que o Sr. Max lê antes de confirmar', () => {
    expect(normalizarEnvelopeAcao(planoDeSaude).label)
      .toBe('✅ Marcar como pago: Plano de Saúde — R$ 2.362,50')
  })

  it('preserva campos extras do contrato (parcela_atual)', () => {
    expect(normalizarEnvelopeAcao(sitioMucuge).dados.parcela_atual).toBe(17)
  })

  it('nao toca em acao sem intencao declarada', () => {
    const gasto = { tipo: 'gasto', dados: { valor: 50, descricao: 'almoco' } }
    expect(normalizarEnvelopeAcao(gasto)).toBe(gasto)
  })

  it('nao toca em confirmar_pagamento que ja veio certo', () => {
    const ok = { tipo: 'confirmar_pagamento', dados: { acao: 'confirmar_pagamento', tipo: 'imovel', nome: 'Sitio Vida' } }
    expect(normalizarEnvelopeAcao(ok)).toBe(ok)
  })

  it('nao inventa nome nem valor quando ja existem', () => {
    const a = normalizarEnvelopeAcao({
      tipo: 'registro',
      dados: { acao: 'registrar_pagamento', nome: 'Certo', descricao: 'Errado', valor_pago: 10, valor: 99, tipo: 'imovel' },
    })
    expect(a.dados.nome).toBe('Certo')
    expect(a.dados.valor_pago).toBe(10)
    expect(a.dados.tipo).toBe('imovel')
  })

  it('aguenta lixo sem quebrar', () => {
    expect(normalizarEnvelopeAcao(null)).toBe(null)
    expect(normalizarEnvelopeAcao({ tipo: 'registro' }).tipo).toBe('registro')
  })
})
