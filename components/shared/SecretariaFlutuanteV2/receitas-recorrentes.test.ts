// ── components/shared/SecretariaFlutuanteV2/receitas-recorrentes.test.ts ──
//
// 23/09/2026. O Sr. Max cadastrou o pró-labore como receita recorrente em
// 24/07 e desde agosto o resumo mostrava "Entradas: R$ 0,00". A causa:
// `recorrente = true` cria um MOLDE, não gera linha por mês, e o resumo
// somava só as receitas com data dentro do mês.
//
// É o espelho exato do defeito das contas fixas de 04/09 — lá os
// R$ 3.021,30 de compromissos recorrentes sumiam da projeção pelo mesmo
// motivo.
//
// Os dois testes que mais importam aqui são os NEGATIVOS: não duplicar
// quando o recebimento já foi lançado, e não aparecer em mês anterior ao
// cadastro. Somar o molde é a parte fácil; é errar para o outro lado que
// criaria um problema pior que o original.

import { describe, it, expect } from 'vitest'

// Regra extraída do bloco MOVIMENTAÇÃO DO MÊS (useElenaSalvar.ts).
const normalizarDesc = (t: any) => String(t || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, ' ').trim()

function entradasDoMes(receitasMes: any[], receitasRec: any[], dataFim: string) {
  const totalLancado = (receitasMes || []).reduce((s, r) => s + Number(r.valor), 0)
  const jaLancadoNoMes = new Set((receitasMes || []).map(r => normalizarDesc(r.descricao)))
  const pendentes = (receitasRec || []).filter(r => {
    if (jaLancadoNoMes.has(normalizarDesc(r.descricao))) return false
    const inicio = String(r.data || '').slice(0, 10)
    return !inicio || inicio <= dataFim
  })
  const totalRecorrentes = pendentes.reduce((s, r) => s + (Number(r.valor) || 0), 0)
  return { total: totalLancado + totalRecorrentes, pendentes, totalRecorrentes }
}

// Linha REAL do banco, de receitas_pessoais.
const proLabore = {
  descricao: 'SALÁRIO-MAX', valor: 23000, categoria: 'pro_labore',
  data: '2026-07-24', recorrente: true,
}

describe('entradas do mês com receita recorrente', () => {
  it('o caso do Sr. Max: setembro sem lançamento mostrava zero', () => {
    const r = entradasDoMes([], [proLabore], '2026-09-30')
    expect(r.total).toBe(23000)
    expect(r.pendentes).toHaveLength(1)
  })

  it('NAO duplica quando o recebimento ja foi lancado no mes', () => {
    const lancado = [{ descricao: 'Salario Max', valor: 23000, data: '2026-09-05' }]
    const r = entradasDoMes(lancado, [proLabore], '2026-09-30')
    expect(r.total).toBe(23000)
    expect(r.totalRecorrentes).toBe(0)
  })

  it('ignora acento e pontuacao ao comparar a descricao', () => {
    const lancado = [{ descricao: 'salário   max!', valor: 23000, data: '2026-09-05' }]
    expect(entradasDoMes(lancado, [proLabore], '2026-09-30').totalRecorrentes).toBe(0)
  })

  it('nao aparece em mes anterior ao cadastro do molde', () => {
    expect(entradasDoMes([], [proLabore], '2026-05-31').total).toBe(0)
  })

  it('aparece no proprio mes de cadastro', () => {
    // Julho: a linha concreta existe, o molde nao soma de novo.
    const r = entradasDoMes([proLabore], [proLabore], '2026-07-31')
    expect(r.total).toBe(23000)
  })

  it('soma lancamento avulso junto com o recorrente pendente', () => {
    const lancado = [{ descricao: 'Aluguel recebido', valor: 2000, data: '2026-09-10' }]
    expect(entradasDoMes(lancado, [proLabore], '2026-09-30').total).toBe(25000)
  })

  it('aguenta listas vazias', () => {
    expect(entradasDoMes([], [], '2026-09-30').total).toBe(0)
  })
})
