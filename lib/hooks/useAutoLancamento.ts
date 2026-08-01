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
 *   (3) EMPRESA_ID: `lancamentos.empresa_id` é NOT NULL e o insert não passava
 *       nada. Agora resolve via perfis.empresa_id (mesmo padrão do TabImoveis)
 *       e aborta com mensagem clara se não conseguir, em vez de deixar subir o
 *       erro cru do Postgres. Quem já tem o empresa_id em mãos pode passar em
 *       opts e evitar as duas idas ao banco.
 */
import { createClient } from '@/lib/supabase/client'
import { hojeLocal } from '@/lib/utils'
import type { SupabaseClient } from '@supabase/supabase-js'

const pad = (n: number) => String(n).padStart(2, '0')

/** Último dia do mês (mes é 1-based: 1 = janeiro). */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate()
}

/**
 * Resolve o empresa_id do usuário logado.
 * Mesmo caminho usado no TabImoveis: perfis.empresa_id keyed por auth.uid().
 * Usa maybeSingle() (e não single()) para não estourar exceção quando o perfil
 * não existe — quem trata o null é o chamador.
 */
async function resolverEmpresaId(supabase: SupabaseClient<any>): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData?.user) return null
  const { data: perfil } = await (supabase.from('perfis') as any)
    .select('empresa_id')
    .eq('id', userData.user.id)
    .maybeSingle()
  return perfil?.empresa_id ?? null
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
  /** Opcional. Se o chamador já tem o empresa_id, evita duas consultas. */
  empresa_id?: string
}) {
  const supabase = createClient()

  // -- empresa_id (NOT NULL na tabela) ---------------------------
  const empresaId = opts.empresa_id ?? await resolverEmpresaId(supabase)
  if (!empresaId) {
    throw new Error(
      'Nao foi possivel identificar a empresa do usuario (perfis.empresa_id). Lancamento nao criado.'
    )
  }

  // -- Data local (America/Sao_Paulo), nunca UTC -----------------
  const [anoAtual, mesAtual, diaHoje] = hojeLocal().split('-').map(Number)
  const diaDesejado = opts.dia_vencimento || diaHoje
  const diaReal = Math.min(diaDesejado, ultimoDiaDoMes(anoAtual, mesAtual))
  const dataStr = `${anoAtual}-${pad(mesAtual)}-${pad(diaReal)}`

  // -- Busca ou cria categoria -----------------------------------
  // Sem filtro por empresa, igual ao TabImoveis. Se categorias_financeiras for
  // multi-tenant, isso precisa de um .eq('empresa_id', empresaId) aqui e no
  // insert abaixo -- verificar o schema dessa tabela.
  let catId: string | null = null
  const catNome = opts.categoria || 'Financiamento'
  const { data: cats } = await (supabase.from('categorias_financeiras') as any)
    .select('id').eq('nome', catNome).limit(1)
  if (cats?.[0]?.id) {
    catId = cats[0].id
  } else {
    const { data: novaCat } = await (supabase.from('categorias_financeiras') as any)
      .insert({ nome: catNome, tipo: 'despesa', cor: '#F59E0B' })
      .select('id').single()
    catId = novaCat?.id ?? null
  }

  // -- Cria o lancamento -----------------------------------------
  const { error } = await (supabase.from('lancamentos') as any).insert({
    empresa_id: empresaId,
    conta_id: opts.conta_id,
    descricao: `Parcela ${opts.parcela_atual}/${opts.parcelas_total ?? '?'} - ${opts.titulo}`,
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
