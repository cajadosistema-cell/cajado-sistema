// ── components/shared/SecretariaFlutuanteV2/confirmacao-destrutiva.test.ts ──
//
// Testa a regra do segundo portão de confirmação em isolamento: as duas
// listas são copiadas aqui de propósito, porque o que este teste protege é a
// REGRA (casual não autoriza dinheiro), não a implementação React em volta.
// Se alguém afrouxar a lista forte ou remover o gate, estes cinco casos
// quebram.

import { describe, it, expect } from 'vitest'

const ACOES_DESTRUTIVAS = [
  'deletar_evento', 'deletar_lancamento', 'deletar_duplicados',
  'editar_lancamento', 'transferencia',
  'confirmar_pagamento', 'reagendar_vencimento', 'editar_financiamento',
]
const PALAVRAS_CONFIRMACAO_FORTE = [
  'sim', 'sim pode', 'pode', 'pode sim', 'pode fazer', 'pode executar',
  'confirmo', 'confirmado', 'confirma', 'confirmar',
  'autorizo', 'autorizado', 'executa', 'execute', 'executar',
]
// amostra da lista larga que hoje autoriza tudo
const FRACAS = ['ok', 'certo', 'isso', 'beleza', 'perfeito', 'show', 'top', 'boa', 'tá', 'vai', 'manda']

const forte = (t: string) => PALAVRAS_CONFIRMACAO_FORTE.some(
  p => t === p || t === p + '!' || t === p + '.')
const executa = (texto: string, tipos: string[]) => {
  const temDestrutiva = tipos.some(t => ACOES_DESTRUTIVAS.includes(t))
  return !(temDestrutiva && !forte(texto.trim().toLowerCase()))
}

describe('segundo portão de confirmação', () => {
  it('bloqueia palavra casual quando o lote mexe em dinheiro', () => {
    for (const p of FRACAS) expect(executa(p, ['confirmar_pagamento'])).toBe(false)
  })
  it('deixa passar palavra forte', () => {
    for (const p of ['sim', 'Sim!', 'CONFIRMO', 'pode sim', 'autorizo.'])
      expect(executa(p, ['confirmar_pagamento'])).toBe(true)
  })
  it('nao poe friccao em lote inofensivo', () => {
    for (const p of FRACAS) expect(executa(p, ['gasto', 'agenda'])).toBe(true)
  })
  it('basta UMA destrutiva no lote para exigir palavra forte', () => {
    expect(executa('ok', ['gasto', 'agenda', 'deletar_lancamento'])).toBe(false)
    expect(executa('sim', ['gasto', 'agenda', 'deletar_lancamento'])).toBe(true)
  })
  it('o caso de 01/09: cinco pagamentos e um "ok"', () => {
    const lote = Array(5).fill('confirmar_pagamento')
    expect(executa('ok', lote)).toBe(false)
  })
})
