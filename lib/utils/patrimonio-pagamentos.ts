/**
 * Regras de parcelas de imóveis/veículos.
 *
 * 01/08/2026 — REESCRITO (opção B). Antes, "o que está em aberto" era deduzido
 * varrendo uma janela fixa de 6 meses para trás e chamando de aberto todo mês
 * sem linha 'pago' em pagamentos_imoveis. Como o modal de pagamento nunca
 * conseguiu gravar nessa tabela até 31/07, praticamente TODO mês aparecia em
 * aberto — o resumo do Sr. Max vinha com 5 linhas por imóvel.
 *
 * Agora a fonte de verdade é o próprio contrato: a parcela nº N vence em
 * data_aquisicao + N × passo(periodicidade), e as pagas são as primeiras
 * `parcelas_pagas`. A tabela pagamentos_imoveis entra só como refinamento —
 * se houver linha 'pago' para um mês, ele sai da lista.
 *
 * `calcularParcelasEmAberto` é pura de propósito: o resumo da Elena e o card do
 * Patrimônio consomem a MESMA função. Quando as duas lógicas eram separadas,
 * elas divergiam (31/07: o card dizia "Em Atraso (2026-02)" e o resumo não
 * mostrava atraso nenhum).
 */
import { hojeLocal } from '@/lib/utils'

export interface MesRefResultado {
  mesRef: string
  isAtrasado: boolean
  descricaoStatus: string
}

/** Quantos meses cada parcela avança, conforme a periodicidade do contrato. */
export function passoMeses(periodicidade?: string | null): number {
  switch (String(periodicidade || 'mensal').toLowerCase()) {
    case 'bimestral':     return 2
    case 'trimestral':    return 3
    case 'quadrimestral': return 4
    case 'semestral':     return 6
    case 'anual':         return 12
    default:              return 1
  }
}

/** Soma (ou subtrai) meses a um 'YYYY-MM'. Aritmética inteira: sem Date, sem fuso. */
export function somaMesesRef(ref: string, delta: number): string {
  const [a, m] = ref.split('-').map(Number)
  const total = a * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

export interface ParcelaEmAberto {
  /** Mês de referência, 'YYYY-MM'. */
  mesRef: string
  /** Número da parcela dentro do contrato (1-based). */
  numero: number
  isAtrasado: boolean
}

export interface ContratoParcelado {
  dataAquisicao?: string | null
  parcelasPagas?: number | null
  parcelasTotal?: number | null
  periodicidade?: string | null
  diaVencimento?: number | null
  /**
   * Âncora opcional para contrato irregular (intermediárias, balão, reajuste).
   * Quando preenchida, a próxima parcela em aberto vence NESTA data e as
   * seguintes seguem a periodicidade a partir daqui — a derivação por
   * data_aquisicao é ignorada. Ver migration 079.
   */
  proximoVencimento?: string | null
}

export interface CalculoParcelas {
  emAberto: ParcelaEmAberto[]
  /** parcelas_pagas já alcançou parcelas_total — não deve aparecer em lugar nenhum. */
  quitado: boolean
  /** Sem data_aquisicao não dá para calcular vencimento; só o mês corrente é mostrado. */
  semDataAquisicao: boolean
  /** Primeira parcela que ainda NÃO venceu, se houver. */
  proximaParcela: string | null
}

/** Teto de linhas por imóvel, para um contrato muito atrasado não estourar o resumo. */
const LIMITE_LINHAS = 12

/**
 * Calcula quais parcelas de um contrato estão em aberto hoje.
 *
 * @param mesesPagos meses com registro 'pago' em pagamentos_imoveis/veiculos
 * @param hojeStr    'YYYY-MM-DD' local; padrão hojeLocal()
 */
export function calcularParcelasEmAberto(
  contrato: ContratoParcelado,
  mesesPagos: Set<string> = new Set<string>(),
  hojeStr?: string,
  maxLinhas: number = LIMITE_LINHAS,
): CalculoParcelas {
  const hoje     = hojeStr || hojeLocal()
  const mesAtual = hoje.substring(0, 7)
  const diaHoje  = Number(hoje.substring(8, 10))
  const diaVenc  = contrato.diaVencimento || 10

  const pagas = Math.max(0, Number(contrato.parcelasPagas) || 0)
  const total = contrato.parcelasTotal != null ? Number(contrato.parcelasTotal) : null

  // Contrato quitado: nada em aberto, nunca. (Caso Refinanciamento Ciacci, 6/6,
  // que aparecia no resumo mesmo estando pago.)
  if (total != null && pagas >= total) {
    return { emAberto: [], quitado: true, semDataAquisicao: false, proximaParcela: null }
  }

  const aq = contrato.dataAquisicao ? String(contrato.dataAquisicao) : ''
  const temAncoraPrevia = !!contrato.proximoVencimento &&
                          String(contrato.proximoVencimento).length >= 10
  // Sem data de aquisição MAS com âncora dá para calcular normalmente — a
  // âncora não depende da data da compra.
  if (aq.length < 7 && !temAncoraPrevia) {
    // Sem data de aquisição não há como calcular vencimento nenhum. Mostra só o
    // mês corrente — o imóvel não some do radar — e sinaliza o dado faltando.
    const emAberto = mesesPagos.has(mesAtual)
      ? []
      : [{ mesRef: mesAtual, numero: pagas + 1, isAtrasado: diaHoje > diaVenc }]
    return { emAberto, quitado: false, semDataAquisicao: true, proximaParcela: null }
  }

  const passo = passoMeses(contrato.periodicidade)

  // ── Âncora explícita tem prioridade sobre a fórmula ─────────────
  // Contrato irregular não segue passo rígido desde a compra. Quando o
  // usuário informa quando a PRÓXIMA parcela vence, esse dado vale mais do
  // que qualquer extrapolação nossa. Caso real: Intermediárias Ciacci, cuja
  // derivação cravava fev/2025 quando a próxima vence de fato em 25/09/2026.
  const ancora = contrato.proximoVencimento ? String(contrato.proximoVencimento) : ''
  const temAncora = ancora.length >= 10

  // Com âncora, o dia de vencimento é o da própria data informada.
  const diaEfetivo = temAncora ? Number(ancora.substring(8, 10)) : diaVenc

  // Mês da parcela de índice n (0-based) dentro do contrato.
  const mesDaParcela = temAncora
    // A âncora é a parcela nº (pagas + 1), ou seja, índice `pagas`.
    ? (n: number) => somaMesesRef(ancora.substring(0, 7), (n - pagas) * passo)
    : (n: number) => somaMesesRef(aq.substring(0, 7), n * passo)

  // Último mês cuja parcela já venceu. Antes do dia de vencimento, o mês
  // corrente ainda não é devido.
  const mesLimite = diaHoje >= diaEfetivo ? mesAtual : somaMesesRef(mesAtual, -1)

  const emAberto: ParcelaEmAberto[] = []
  let proximaParcela: string | null = null

  // Sem parcelas_total, trava em 20 anos de parcelas para não girar infinito.
  const teto = total != null ? total : pagas + 240

  for (let n = pagas; n < teto; n++) {
    const mes = mesDaParcela(n)
    if (mes > mesLimite) { proximaParcela = mes; break }
    if (!mesesPagos.has(mes)) {
      emAberto.push({
        mesRef: mes,
        numero: n + 1,
        isAtrasado: mes < mesAtual || (mes === mesAtual && diaHoje > diaEfetivo),
      })
      if (emAberto.length >= maxLinhas) break
    }
  }

  return { emAberto, quitado: false, semDataAquisicao: false, proximaParcela }
}

/** Texto de status para uma parcela, no formato que o card já usava. */
export function descreverStatus(
  mesRef: string,
  mesAtual: string,
  diaHoje: number,
  diaVenc: number,
): string {
  if (mesRef < mesAtual) return `Em Atraso (${mesRef})`
  if (mesRef > mesAtual) return 'Adiantamento'
  if (diaHoje > diaVenc) return `Em Atraso (venceu dia ${diaVenc})`
  if (diaHoje === diaVenc) return 'Vence Hoje'
  return `Vence dia ${diaVenc}`
}

/**
 * Resolve o mês de referência a usar num pagamento: o mais antigo em aberto.
 *
 * Os três últimos parâmetros são NOVOS e OPCIONAIS. Quando informados, o
 * cálculo deriva os vencimentos do contrato (regra nova). Quando ausentes —
 * caso dos veículos, que ainda não passam esses dados — cai no comportamento
 * antigo de varrer 6 meses para trás, para não quebrar chamadas existentes.
 */
export async function resolverMesRefPendente(
  supabase: any,
  tabelaPagamentos: 'pagamentos_imoveis' | 'pagamentos_veiculos',
  fkColuna: 'imovel_id' | 'veiculo_id',
  itemPk: string,
  diaVencimento: number | null | undefined,
  dataPagamentoStr?: string,
  dataAquisicaoStr?: string | null,
  parcelasPagas?: number | null,
  parcelasTotal?: number | null,
  periodicidade?: string | null,
  proximoVencimento?: string | null,
): Promise<MesRefResultado> {
  const hoje = dataPagamentoStr && dataPagamentoStr.length >= 10
    ? dataPagamentoStr.substring(0, 10)
    : hojeLocal()
  const mesAtualStr = hoje.substring(0, 7)
  const diaHoje = Number(hoje.substring(8, 10))
  const diaVenc = diaVencimento || 10

  // Histórico de pagamentos efetivamente pagos
  const { data: pagos } = await (supabase.from(tabelaPagamentos) as any)
    .select('mes_referencia, status')
    .eq(fkColuna, itemPk)
    .eq('status', 'pago')

  const mesesPagos = new Set<string>((pagos || []).map((p: any) => p.mes_referencia))

  // ── Regra NOVA: derivada do contrato ────────────────────────────
  if (parcelasPagas != null) {
    const calc = calcularParcelasEmAberto(
      {
        dataAquisicao: dataAquisicaoStr,
        parcelasPagas,
        parcelasTotal,
        periodicidade,
        diaVencimento,
        proximoVencimento,
      },
      mesesPagos,
      hoje,
    )

    if (calc.quitado) {
      return { mesRef: mesAtualStr, isAtrasado: false, descricaoStatus: 'Contrato quitado' }
    }
    if (calc.emAberto.length > 0) {
      const p = calc.emAberto[0]
      return {
        mesRef: p.mesRef,
        isAtrasado: p.isAtrasado,
        descricaoStatus: descreverStatus(p.mesRef, mesAtualStr, diaHoje, diaVenc),
      }
    }
    const prox = calc.proximaParcela || somaMesesRef(mesAtualStr, 1)
    return { mesRef: prox, isAtrasado: false, descricaoStatus: `Próxima Parcela (${prox})` }
  }

  // ── Fallback ANTIGO: janela de 6 meses ──────────────────────────
  // Usado por veículos, que ainda não passam parcelas_pagas/periodicidade.
  let mesRefNum = Number(hoje.substring(5, 7))
  let anoRef = Number(hoje.substring(0, 4))
  if (diaHoje < diaVenc) {
    mesRefNum -= 1
    if (mesRefNum < 1) { mesRefNum = 12; anoRef -= 1 }
  }

  const mesLimiteInf = (dataAquisicaoStr && String(dataAquisicaoStr).length >= 7)
    ? String(dataAquisicaoStr).substring(0, 7)
    : ''

  const candidatos: string[] = []
  let a = anoRef
  let m = mesRefNum
  for (let i = 0; i < 6; i++) {
    const mStr = `${a}-${String(m).padStart(2, '0')}`
    if (mesLimiteInf && mStr < mesLimiteInf) break
    candidatos.unshift(mStr)
    m -= 1
    if (m < 1) { m = 12; a -= 1 }
  }

  for (const mesCand of candidatos) {
    if (!mesesPagos.has(mesCand)) {
      const isAtrasado = mesCand < mesAtualStr || (mesCand === mesAtualStr && diaHoje > diaVenc)
      return {
        mesRef: mesCand,
        isAtrasado,
        descricaoStatus: descreverStatus(mesCand, mesAtualStr, diaHoje, diaVenc),
      }
    }
  }

  const proxMesStr = somaMesesRef(`${anoRef}-${String(mesRefNum).padStart(2, '0')}`, 1)
  return { mesRef: proxMesStr, isAtrasado: false, descricaoStatus: `Próxima Parcela (${proxMesStr})` }
}
