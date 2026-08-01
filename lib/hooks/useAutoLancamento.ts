'use client'
/**
 * useAutoLancamento — hook reutilizável
 *
 * Dado os dados de uma parcela extraída pela IA, cria o lançamento
 * no financeiro automaticamente.
 *
 * 01/08/2026 — CORRIGIDO:
 *   (1) FUSO: dataStr vinha de dataVenc.toISOString().split('T')[0], que é UTC.
 *       Das 21h à meia-noite (BRT) a parcela era lançada no dia seguinte, e na
 *       virada do mês, no mês seguinte. Agora monta a string a partir da data
 *       LOCAL, sem passar por toISOString().
 *   (2) ESTOURO DE DIA: new Date(ano, mes, 31) em fevereiro virava 03/03.
 *       Agora o dia é limitado ao último dia do mês.
 */
import { createClient } from '@/lib/supabase/client'
import { hojeLocal } from '@/lib/utils'

const pad = (n: number) => String(n).padStart(2, '0')

/** Último dia do mês (mes é 1-based: 1 = janeiro). */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

export async function autoLancarParcela(opts: {
  conta_id: string
  titulo: string
  valor_parcela: number
  parcela_atual: number
  parcelas_total: number | null
  dia_vencimento?: number | null
  categoria?: string
  observacoes?: string
}) {
  const supabase = createClient()

  // Data local (America/Sao_Paulo), nunca UTC
  const [anoAtual, mesAtual, diaHoje] = hojeLocal().split('-').map(Number)
  const diaDesejado = opts.dia_vencimento || diaHoje
  const diaReal = Math.min(diaDesejado, ultimoDiaDoMes(anoAtual, mesAtual))
  const dataStr = `${anoAtual}-${pad(mesAtual)}-${pad(diaReal)}`

  // Busca ou cria categoria
  let catId: string | null = null
  const catNome = opts.categoria || 'Financiamento'
  const { data: catExist } = await supabase
    .from('categorias_financeiras')
    .select('id').eq('nome', catNome).limit(1)
  if (catExist?.[0]?.id) {
    catId = catExist[0].id
  } else {
    const { data: novaCat } = await (supabase.from('categorias_financeiras') as any)
      .insert({ nome: catNome, tipo: 'despesa', cor: '#F59E0B' })
      .select('id').single()
    catId = novaCat?.id ?? null
  }

  const { error } = await (supabase.from('lancamentos') as any).insert({
    conta_id: opts.conta_id,
    descricao: `Parcela ${opts.parcela_atual}/${opts.parcelas_total ?? '?'} – ${opts.titulo}`,
    valor: opts.valor_parcela,
    tipo: 'despesa',
    regime: 'competencia',
    status: 'pendente',
    data_competencia: dataStr,
    categoria_id: catId,
    parcela_atual: opts.parcela_atual,
    total_parcelas: opts.parcelas_total,
    observacoes: opts.observacoes || null,
  })
  if (error) throw new Error(error.message)
}
