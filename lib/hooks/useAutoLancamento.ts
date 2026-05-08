'use client'
/**
 * useAutoLancamento — hook reutilizável
 * 
 * Dado os dados de uma parcela extraída pela IA, cria o lançamento
 * no financeiro automaticamente. Usa empresa_id da sessão.
 */
import { createClient } from '@/lib/supabase/client'

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
  const hoje = new Date()
  const dia = opts.dia_vencimento || hoje.getDate()
  const dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), dia)
  const dataStr = dataVenc.toISOString().split('T')[0]

  // Busca ou cria categoria
  let catId: string | null = null
  const catNome = opts.categoria || 'Financiamento'
  const { data: catExist } = await supabase
    .from('categorias_financeiras')
    .select('id').eq('nome', catNome).maybeSingle()
  if (catExist?.id) {
    catId = catExist.id
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
