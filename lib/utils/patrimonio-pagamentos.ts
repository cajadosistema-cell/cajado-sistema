/**
 * Utility for resolving the correct pending or overdue month of reference (YYYY-MM)
 * for property (imóvel) and vehicle (veículo) installment payments.
 */

export interface MesRefResultado {
  mesRef: string
  isAtrasado: boolean
  descricaoStatus: string
}

export async function resolverMesRefPendente(
  supabase: any,
  tabelaPagamentos: 'pagamentos_imoveis' | 'pagamentos_veiculos',
  fkColuna: 'imovel_id' | 'veiculo_id',
  itemPk: string,
  diaVencimento: number | null | undefined,
  dataPagamentoStr?: string,
  dataAquisicaoStr?: string | null
): Promise<MesRefResultado> {
  const hoje = dataPagamentoStr ? new Date(dataPagamentoStr + 'T12:00:00') : new Date()
  const diaVenc = diaVencimento || 10
  const diaHoje = hoje.getDate()
  const mesAtualStr = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`

  let anoRef = hoje.getFullYear()
  let mesRefNum = hoje.getMonth() + 1 // 1 a 12

  // Se o dia de vencimento deste mês ainda não passou, o mês mais recente que já venceu é o anterior.
  if (diaHoje < diaVenc) {
    mesRefNum -= 1
    if (mesRefNum < 1) {
      mesRefNum = 12
      anoRef -= 1
    }
  }

  // Busca histórico de pagamentos pagos
  const { data: pagos } = await (supabase.from(tabelaPagamentos) as any)
    .select('mes_referencia, status')
    .eq(fkColuna, itemPk)
    .eq('status', 'pago')

  const mesesPagosSet = new Set<string>((pagos || []).map((p: any) => p.mes_referencia))

  // Define limite inferior de busca (data_aquisicao ou máximo de 6 meses atrás)
  let mesLimiteInf = ''
  if (dataAquisicaoStr && dataAquisicaoStr.length >= 7) {
    mesLimiteInf = dataAquisicaoStr.substring(0, 7)
  }

  // Gera até 6 meses de candidatos retroativos até (anoRef, mesRefNum) em ordem cronológica
  const candidatos: string[] = []
  let a = anoRef
  let m = mesRefNum
  for (let i = 0; i < 6; i++) {
    const mStr = `${a}-${String(m).padStart(2, '0')}`
    if (mesLimiteInf && mStr < mesLimiteInf) break
    candidatos.unshift(mStr)
    m -= 1
    if (m < 1) {
      m = 12
      a -= 1
    }
  }

  // Procura o mês mais antigo não pago entre os candidatos
  for (const mesCand of candidatos) {
    if (!mesesPagosSet.has(mesCand)) {
      const isAtrasado = mesCand < mesAtualStr || (mesCand === mesAtualStr && diaHoje > diaVenc)
      let desc = ''
      if (mesCand < mesAtualStr) {
        desc = `Em Atraso (${mesCand})`
      } else if (mesCand === mesAtualStr) {
        desc = diaHoje > diaVenc ? `Em Atraso (venceu dia ${diaVenc})` : diaHoje === diaVenc ? `Vence Hoje` : `Vence dia ${diaVenc}`
      } else {
        desc = `Adiantamento`
      }
      return { mesRef: mesCand, isAtrasado, descricaoStatus: desc }
    }
  }

  // Se todos os meses verificados estão pagos, avança para o próximo mês
  let proxM = mesRefNum + 1
  let proxA = anoRef
  if (proxM > 12) {
    proxM = 1
    proxA += 1
  }
  const proxMesStr = `${proxA}-${String(proxM).padStart(2, '0')}`
  return { mesRef: proxMesStr, isAtrasado: false, descricaoStatus: `Próxima Parcela (${proxMesStr})` }
}
