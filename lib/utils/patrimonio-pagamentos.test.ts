// ── lib/utils/patrimonio-pagamentos.test.ts ──────────────────
//
// Estas são as funções mais fáceis de testar do projeto inteiro: aritmética
// pura sobre strings 'AAAA-MM-DD', sem banco, sem rede, sem relógio (todas
// aceitam `hojeStr`). E são justamente onde moraram três dos defeitos
// encontrados entre 02 e 04/09/2026.
//
// Os casos abaixo usam os contratos REAIS do Sr. Max de propósito — quando um
// teste quebrar, dá para comparar direto com o que ele vê na tela em vez de
// decifrar um cenário inventado.
//
// Rodar:  npm test

import { describe, it, expect } from 'vitest'
import {
  passoMeses,
  ultimoDiaDoMes,
  diaDaSemana,
  somaDias,
  somaMesesRef,
  vencimentoNominal,
  vencimentoEfetivo,
  calcularParcelasEmAberto,
  proximasParcelas,
} from './patrimonio-pagamentos'

// ════════════════════════════════════════════════════════════
describe('passoMeses', () => {
  it('traduz cada periodicidade em meses', () => {
    expect(passoMeses('mensal')).toBe(1)
    expect(passoMeses('bimestral')).toBe(2)
    expect(passoMeses('trimestral')).toBe(3)
    expect(passoMeses('quadrimestral')).toBe(4)
    expect(passoMeses('semestral')).toBe(6)
    expect(passoMeses('anual')).toBe(12)
  })

  it('ignora caixa alta', () => {
    expect(passoMeses('TRIMESTRAL')).toBe(3)
  })

  // Este é o contrato que a projeção precisava respeitar: ausência de
  // periodicidade significa mensal, e a projeção TEM de assumir o mesmo,
  // senão a âncora anda num ritmo e o calendário da tela em outro.
  it('trata ausência e valor desconhecido como mensal', () => {
    expect(passoMeses(null)).toBe(1)
    expect(passoMeses(undefined)).toBe(1)
    expect(passoMeses('')).toBe(1)
    expect(passoMeses('quinzenal')).toBe(1)
  })
})

// ════════════════════════════════════════════════════════════
describe('ultimoDiaDoMes', () => {
  it('acerta os meses comuns', () => {
    expect(ultimoDiaDoMes(2026, 1)).toBe(31)
    expect(ultimoDiaDoMes(2026, 4)).toBe(30)
    expect(ultimoDiaDoMes(2026, 12)).toBe(31)
  })

  it('acerta fevereiro, inclusive a regra dos séculos', () => {
    expect(ultimoDiaDoMes(2026, 2)).toBe(28)
    expect(ultimoDiaDoMes(2028, 2)).toBe(29) // bissexto comum
    expect(ultimoDiaDoMes(2000, 2)).toBe(29) // divisível por 400
    expect(ultimoDiaDoMes(1900, 2)).toBe(28) // divisível por 100, não por 400
  })
})

// ════════════════════════════════════════════════════════════
describe('diaDaSemana', () => {
  // 0 = domingo … 6 = sábado
  it('acerta datas conhecidas', () => {
    expect(diaDaSemana(2026, 9, 5)).toBe(6)  // sábado
    expect(diaDaSemana(2026, 9, 6)).toBe(0)  // domingo
    expect(diaDaSemana(2026, 9, 7)).toBe(1)  // segunda
  })
})

// ════════════════════════════════════════════════════════════
describe('somaDias', () => {
  it('soma dentro do mês', () => {
    expect(somaDias('2026-09-05', 2)).toBe('2026-09-07')
  })

  it('atravessa o mês', () => {
    expect(somaDias('2026-09-30', 1)).toBe('2026-10-01')
  })

  it('atravessa o ano', () => {
    expect(somaDias('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('anda para trás', () => {
    expect(somaDias('2026-01-01', -1)).toBe('2025-12-31')
  })
})

// ════════════════════════════════════════════════════════════
describe('somaMesesRef', () => {
  it('soma meses atravessando o ano', () => {
    expect(somaMesesRef('2026-09', 1)).toBe('2026-10')
    expect(somaMesesRef('2026-11', 3)).toBe('2027-02')
    expect(somaMesesRef('2026-01', -1)).toBe('2025-12')
  })

  it('anda de trimestre em trimestre', () => {
    // Intermediárias Ciacci: parcela 5 em setembro, 6 em dezembro.
    expect(somaMesesRef('2026-09', 3)).toBe('2026-12')
  })
})

// ════════════════════════════════════════════════════════════
describe('vencimentoNominal', () => {
  it('usa o dia do contrato', () => {
    expect(vencimentoNominal('2026-09', 5)).toBe('2026-09-05')
  })

  // Sem o clamp, contrato com vencimento 31 nunca acusava atraso em
  // fevereiro: nenhum dia de fevereiro é maior que 31.
  it('limita o dia ao último do mês', () => {
    expect(vencimentoNominal('2026-02', 31)).toBe('2026-02-28')
    expect(vencimentoNominal('2028-02', 31)).toBe('2028-02-29')
  })
})

// ════════════════════════════════════════════════════════════
describe('vencimentoEfetivo — folga de dia útil', () => {
  // 05/09/2026 é sábado. É o vencimento real do Sítio Mucugê.
  it('empurra sábado para segunda', () => {
    expect(vencimentoEfetivo('2026-09', 5)).toBe('2026-09-07')
  })

  it('empurra domingo para segunda', () => {
    expect(vencimentoEfetivo('2026-09', 6)).toBe('2026-09-07')
  })

  it('deixa dia útil como está', () => {
    expect(vencimentoEfetivo('2026-09', 10)).toBe('2026-09-10')
  })
})

// ════════════════════════════════════════════════════════════
describe('calcularParcelasEmAberto', () => {
  // Refinanciamento Ciacci: 6/6. Aparecia no resumo mesmo quitado.
  it('não devolve nada para contrato quitado', () => {
    const r = calcularParcelasEmAberto(
      { dataAquisicao: '2025-01-25', parcelasPagas: 6, parcelasTotal: 6, periodicidade: 'mensal', diaVencimento: 25 },
      new Set(),
      '2026-09-04',
    )
    expect(r.quitado).toBe(true)
    expect(r.emAberto).toHaveLength(0)
  })

  // Sítio Mucugê depois da correção de 04/09: âncora em setembro, agosto pago.
  // Nada em aberto, e a próxima parcela é a 17.
  it('não acusa atraso quando a âncora aponta para o mês corrente e o dia ainda não chegou', () => {
    const r = calcularParcelasEmAberto(
      {
        dataAquisicao: '2025-02-05',
        parcelasPagas: 16,
        parcelasTotal: 18,
        periodicidade: 'mensal',
        diaVencimento: 5,
        proximoVencimento: '2026-09-05',
      },
      new Set(['2026-08']),
      '2026-09-04',
    )
    expect(r.emAberto).toHaveLength(0)
    expect(r.proximaParcela).toBe('2026-09')
    expect(r.proximaNumero).toBe(17)
  })

  // O mesmo contrato depois que o dia passou e ninguém pagou.
  it('acusa atraso depois que o vencimento efetivo passa', () => {
    const r = calcularParcelasEmAberto(
      {
        dataAquisicao: '2025-02-05',
        parcelasPagas: 16,
        parcelasTotal: 18,
        periodicidade: 'mensal',
        diaVencimento: 5,
        proximoVencimento: '2026-09-05',
      },
      new Set(),
      '2026-09-20',
    )
    expect(r.emAberto).toHaveLength(1)
    expect(r.emAberto[0]).toMatchObject({ mesRef: '2026-09', numero: 17, isAtrasado: true })
  })

  // Venceu no sábado 05/09; no domingo ainda NÃO é atraso — o prazo vai até
  // segunda. Esta é a regra que o Sr. Max usa na prática com boleto.
  it('não pinta de atraso no fim de semana quando o vencimento caiu no sábado', () => {
    const r = calcularParcelasEmAberto(
      {
        dataAquisicao: '2025-02-05',
        parcelasPagas: 16,
        parcelasTotal: 18,
        periodicidade: 'mensal',
        diaVencimento: 5,
        proximoVencimento: '2026-09-05',
      },
      new Set(),
      '2026-09-06', // domingo
    )
    expect(r.emAberto).toHaveLength(1)
    expect(r.emAberto[0].isAtrasado).toBe(false)
  })

  // Intermediárias Ciacci: R$ 10.000 TRIMESTRAL, parcela 5 de 6 em setembro.
  // A próxima é dezembro, não outubro — foi exatamente isso que a projeção
  // ignorava, somando os R$ 10.000 todo mês.
  it('anda de trimestre em trimestre quando a periodicidade não é mensal', () => {
    const contrato = {
      dataAquisicao: '2023-11-23',
      parcelasPagas: 4,
      parcelasTotal: 6,
      periodicidade: 'trimestral',
      diaVencimento: 25,
      proximoVencimento: '2026-09-25',
    }
    const r = calcularParcelasEmAberto(contrato, new Set(), '2026-09-04')
    expect(r.proximaParcela).toBe('2026-09')
    expect(r.proximaNumero).toBe(5)

    // A parcela seguinte pula para dezembro.
    const proximas = proximasParcelas(contrato, new Set(), 2, '2026-09-04')
    expect(proximas.map(p => p.mesRef)).toEqual(['2026-09', '2026-12'])
  })

  // Sem âncora, o calendário vem de data_aquisicao + parcelas_pagas.
  it('deriva o calendário da data de aquisição quando não há âncora', () => {
    const r = calcularParcelasEmAberto(
      {
        dataAquisicao: '2026-03-05',
        parcelasPagas: 5,
        parcelasTotal: 21,
        periodicidade: 'mensal',
        diaVencimento: 10,
      },
      new Set(),
      '2026-09-04',
    )
    expect(r.emAberto).toHaveLength(1)
    expect(r.emAberto[0]).toMatchObject({ mesRef: '2026-08', numero: 6, isAtrasado: true })
  })

  // Um mês com registro 'pago' sai da lista mesmo que o contador não tenha
  // andado — é o refinamento que pagamentos_imoveis faz sobre o contrato.
  it('remove da lista o mês que já tem pagamento registrado', () => {
    const contrato = {
      dataAquisicao: '2026-03-05',
      parcelasPagas: 5,
      parcelasTotal: 21,
      periodicidade: 'mensal',
      diaVencimento: 10,
    }
    const semPagamento = calcularParcelasEmAberto(contrato, new Set(), '2026-09-04')
    const comPagamento = calcularParcelasEmAberto(contrato, new Set(['2026-08']), '2026-09-04')

    expect(semPagamento.emAberto).toHaveLength(1)
    expect(comPagamento.emAberto).toHaveLength(0)
  })

  // Sem data de aquisição E sem âncora não há calendário possível. O imóvel
  // não pode sumir do radar: mostra o mês corrente e sinaliza o dado faltando.
  it('sinaliza contrato sem data de aquisição em vez de escondê-lo', () => {
    const r = calcularParcelasEmAberto(
      { parcelasPagas: 3, parcelasTotal: 10, diaVencimento: 10 },
      new Set(),
      '2026-09-04',
    )
    expect(r.semDataAquisicao).toBe(true)
    expect(r.emAberto).toHaveLength(1)
    expect(r.emAberto[0].mesRef).toBe('2026-09')
  })

  // O resumo mensal precisa listar o que vence NESTE mês mesmo antes do dia
  // chegar — sem isso, no dia 1º o resumo nascia vazio.
  it('inclui a parcela a vencer no mês quando a opção é pedida', () => {
    const contrato = {
      dataAquisicao: '2023-11-23',
      parcelasPagas: 4,
      parcelasTotal: 6,
      periodicidade: 'trimestral',
      diaVencimento: 25,
      proximoVencimento: '2026-09-25',
    }
    const sem = calcularParcelasEmAberto(contrato, new Set(), '2026-09-04')
    const com = calcularParcelasEmAberto(contrato, new Set(), '2026-09-04', 12, { incluirAVencerNoMes: true })

    expect(sem.emAberto).toHaveLength(0)
    expect(com.emAberto).toHaveLength(1)
    expect(com.emAberto[0]).toMatchObject({ mesRef: '2026-09', numero: 5, isAtrasado: false })
  })
})
