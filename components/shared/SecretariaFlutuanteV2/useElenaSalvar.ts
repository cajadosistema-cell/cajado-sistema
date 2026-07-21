'use client'
// ── useElenaSalvar.ts ─────────────────────────────────────────
// Responsável por: resolução de contas PF/PJ, salvamento de cada tipo de ação,
// card de confirmação visual, e execução automática após resposta da IA.
//
// REGRA CRÍTICA: todos os callbacks aqui leem userId/sessaoId via REF (não state)
// para evitar stale closures. Nunca passe userId como prop direta para callbacks.

import { useCallback, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { AcaoIA, ConfirmacaoSalvamento, Msg } from './elena-types'
import {
  CAT_DESPESA_ID,
  CAT_RECEITA_ID,
  FORMAS_PAG_VALIDAS,
  TIPOS_EVENTO_VALIDOS,
  COR_EVENTO,
  TIPOS_REGISTRO_LIVRE,
  CATEGORIAS_IDEIA,
  MAPA_CONFIRMACAO,
  BANDEIRAS_MAP,
} from './elena-constants'
import { buscarDadosRelatorio } from '../ModalRelatorio'
// ════════════════════════════════════════════════════════════════
// 🔴 FIX DUPLICATA — normalização e similaridade de nomes
//
// BUG ORIGINAL: `.insert()` cego + comparação por nome EXATO.
// Ditando por voz, "Nubank" às vezes virava "no Bank". A Elena não
// reconhecia como o mesmo cartão e criava um NOVO. Resultado: o mesmo
// cartão partido em vários registros, cada um com metade dos dados —
// um com o vencimento, outro com o limite. Quando ela achava o registro
// sem a data, reperguntava a data que o Sr. Max já tinha informado.
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// ElenaPergunta — NÃO é um erro, é uma pergunta.
//
// Quando a Elena não consegue decidir sozinha (ex: 4 contas PJ, 4 cartões
// Visa), ela precisa interromper o fluxo e PERGUNTAR. Antes isso subia como
// `throw new Error(...)` e o handler mostrava "❌ Ops! Não consegui salvar",
// o que assusta — parece falha, mas o sistema está funcionando certo.
//
// Com esta classe, o handler distingue os dois casos e mostra a pergunta
// com um tom apropriado, mantendo a ação como PENDENTE (não como erro).
// ════════════════════════════════════════════════════════════════
class ElenaPergunta extends Error {
  readonly ehPergunta = true
  constructor(mensagem: string) {
    super(mensagem)
    this.name = 'ElenaPergunta'
  }
}

/**
 * 🔴 A IA pode mandar dia 45, 0, "quinze" ou NaN.
 * Sem validação isso vira data inválida no banco — e o alerta de
 * vencimento NUNCA dispara, em silêncio.
 */
function clampDia(valor: any, campo: string): number {
  const n = Number(valor)
  if (!Number.isFinite(n) || n < 1 || n > 31) {
    throw new Error(`Dia de ${campo} inválido: "${valor}". Precisa ser um número entre 1 e 31.`)
  }
  return Math.round(n)
}

/** Sufixos genéricos que não distinguem um cartão de outro */
const SUFIXOS_GENERICOS = ['bank', 'banco', 'card', 'cartao', 'credito', 'pay']

/** Correções conhecidas de transcrição por voz */
const ALIASES_CONTA: Record<string, string> = {
  'nobank': 'nubank',
  'nuconta': 'nubank',
  'newbank': 'nubank',
  'interbank': 'inter',
  'picpay': 'picpay',
  'ctsix': 'c6',
  'seisbank': 'c6',
}

/** lowercase, sem acento, sem pontuação, sem espaços */
function normalizarNome(s: string): string {
  const base = String(s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return ALIASES_CONTA[base] || base
}

/** Distância de Levenshtein */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = cur
  }
  return prev[b.length]
}

/**
 * Dois nomes de conta se referem à MESMA conta?
 *
 * Casa:  "Nubank" ≈ "no Bank"   (Levenshtein 1 → 83% similar)
 *        "C6"     ≈ "C6 Bank"   (prefixo + sufixo genérico "bank")
 *
 * NÃO casa: "Sofisa Master" vs "Sofisa Visa"  (cartões diferentes de verdade)
 *           "Visa Infinity"  vs "Visa Nana"
 */
function mesmaConta(nomeA: string, nomeB: string): boolean {
  const a = normalizarNome(nomeA)
  const b = normalizarNome(nomeB)
  if (!a || !b) return false
  if (a === b) return true

  // Regra 1 — um é o outro + sufixo genérico ("c6" vs "c6bank")
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a]
  if (longo.startsWith(curto) && curto.length >= 2) {
    const resto = longo.slice(curto.length)
    if (SUFIXOS_GENERICOS.includes(resto)) return true
  }

  // Regra 2 — erro de digitação/transcrição ("nubank" vs "nobank")
  // Exige nomes de tamanho parecido, para não casar coisas distintas.
  const maxLen = Math.max(a.length, b.length)
  if (maxLen >= 4 && Math.abs(a.length - b.length) <= 2) {
    const similaridade = 1 - levenshtein(a, b) / maxLen
    if (similaridade >= 0.80) return true
  }

  return false
}

// ════════════════════════════════════════════════════════════════
// upsertConta — procura ANTES de inserir. Nunca cria duplicata.
//
// 🔴 MULTI-TENANT MISTO — a âncora depende da categoria:
//    • Conta PF → pertence ao USUÁRIO  (user_id)
//    • Conta PJ → pertence à EMPRESA   (empresa_id) e tem user_id NULL
//
//    A versão anterior filtrava só por `user_id`. Isso NUNCA encontrava
//    uma conta PJ (user_id nulo) — e criava duplicata toda vez.
//
// PF e PJ com o mesmo nome são contas LEGÍTIMAS e diferentes
// ("Itaú" pessoal vs "Itaú" da empresa). A busca sempre filtra por
// categoria, então elas nunca se confundem.
//
// @returns { id, nome, jaExistia }
// ════════════════════════════════════════════════════════════════
async function upsertConta(
  supabase: any,
  uid: string,
  payload: Record<string, any>,
): Promise<{ id: string; nome: string; jaExistia: boolean }> {
  const nome = String(payload.nome || '').trim()
  const tipo = payload.tipo
  const categoria = payload.categoria === 'pj' ? 'pj' : 'pf'

  // 0. `empresa_id` é NOT NULL na tabela `contas` (sem DEFAULT).
  // Preenchemos SEMPRE, para não depender de trigger do banco.
  if (payload.empresa_id == null) {
    try {
      const { data: perfil } = await supabase
        .from('perfis').select('empresa_id').eq('id', uid).maybeSingle()
      if (perfil?.empresa_id) payload.empresa_id = perfil.empresa_id
    } catch { /* deixa o trigger do banco resolver, se existir */ }
  }

  // 1. Busca os candidatos NO ESCOPO CORRETO do tenant.
  let query = supabase
    .from('contas')
    .select('id, nome, dia_vencimento, dia_fechamento, limite, bandeira, ativo')
    .eq('tipo', tipo)
    .eq('categoria', categoria)

  if (categoria === 'pj') {
    // PJ → escopo EMPRESA (user_id costuma ser NULL nessas contas)
    if (!payload.empresa_id) {
      throw new Error('Não foi possível identificar a empresa para cadastrar a conta PJ.')
    }
    query = query.eq('empresa_id', payload.empresa_id)
  } else {
    // PF → escopo USUÁRIO
    query = query.eq('user_id', uid)
  }

  const { data: candidatos } = await query

  // 2. Compara por similaridade (pega "Nubank" ≈ "no Bank", "itau" ≈ "Itaú")
  const existente = (candidatos || []).find((c: any) => mesmaConta(c.nome, nome))

  if (existente) {
    // 3. Existe → atualiza APENAS os campos novos.
    // Nunca sobrescreve um dado bom com null.
    const patch: Record<string, any> = {}

    if (payload.dia_vencimento != null && existente.dia_vencimento !== payload.dia_vencimento) {
      patch.dia_vencimento = payload.dia_vencimento
    }
    if (payload.dia_fechamento != null && existente.dia_fechamento !== payload.dia_fechamento) {
      patch.dia_fechamento = payload.dia_fechamento
    }
    if (payload.limite != null && existente.limite !== payload.limite) {
      patch.limite = payload.limite
    }
    if (payload.bandeira && !existente.bandeira) {
      patch.bandeira = payload.bandeira
    }
    if (existente.ativo === false) patch.ativo = true

    if (Object.keys(patch).length > 0) {
      const { error: upErr } = await supabase
        .from('contas').update(patch).eq('id', existente.id)
      if (upErr) throw new Error(upErr.message)
    }

    // Retorna o nome JÁ CADASTRADO (não o que a IA inventou),
    // para o chat sempre falar do cartão pelo mesmo nome.
    return { id: existente.id, nome: existente.nome, jaExistia: true }
  }

  // 4. Não existe → insere
  const { data: nova, error } = await supabase
    .from('contas').insert(payload).select('id, nome').single()

  if (error) {
    // Corrida com os índices únicos (migration 064): rebusca no escopo certo
    if (/duplicate key|unique|23505/i.test(error.message || '')) {
      let q2 = supabase.from('contas').select('id, nome')
        .eq('tipo', tipo).eq('categoria', categoria).ilike('nome', nome)
      q2 = categoria === 'pj'
        ? q2.eq('empresa_id', payload.empresa_id)
        : q2.eq('user_id', uid)
      const { data: achada } = await q2.maybeSingle()
      if (achada) return { id: achada.id, nome: achada.nome, jaExistia: true }
    }
    throw new Error(error.message)
  }

  return { id: nova.id, nome: nova.nome, jaExistia: false }
}

interface UseElenaSalvarProps {
  supabase: any  // SupabaseClient — aceita qualquer variante (typed ou untyped)
  userIdRef: React.MutableRefObject<string>
  sessaoIdRef: React.MutableRefObject<string>
  mensagensRef: React.MutableRefObject<Msg[]>     // ref para evitar stale no backup_chat
  colaboradores: { id: string; nome: string }[]
  ultimoRegistroRef: React.MutableRefObject<{ tabela: string; id: string } | null>
  setMensagens: React.Dispatch<React.SetStateAction<Msg[]>>
  setRelatorioData: (data: any) => void
}

// 🔒 Ações que apagam, editam ou movem dinheiro — nunca executam sem
// confirmação explícita do usuário (ver gate em executarAcoesAuto).
// 🆕 (21/07/2026, pedido do Sr. Max): confirmar_pagamento e reagendar_vencimento
// entraram aqui de propósito — marcar algo como pago ou mudar uma data de
// vencimento é uma mudança de estado financeiro real, mesma categoria de
// risco que editar/deletar. Antes disso, a Elena NUNCA marcava nada como
// pago (decisão de produto deliberada); Max e Maiara confirmaram
// explicitamente que quereriam essa reversão antes de eu construir.
const ACOES_DESTRUTIVAS = [
  'deletar_evento', 'deletar_lancamento', 'deletar_duplicados',
  'editar_lancamento', 'transferencia',
  'confirmar_pagamento', 'reagendar_vencimento',
]
const ROTULO_ACAO_DESTRUTIVA: Record<string, string> = {
  deletar_evento:     '🗑️ deletar evento',
  deletar_lancamento: '🗑️ deletar lançamento',
  deletar_duplicados: '🧹 limpar duplicados',
  editar_lancamento:  '✏️ editar lançamento',
  transferencia:      '↔️ transferência entre contas',
  confirmar_pagamento: '✅ marcar como pago',
  reagendar_vencimento: '📅 reagendar vencimento',
}

interface UseElenaSalvarReturn {
  resolverContaPj: (contaNome?: string, autocriar?: boolean) => Promise<{ id: string; nome: string }>
  resolverContaPf: (contaNome?: string, autocriar?: boolean) => Promise<{ id: string; nome: string }>
  resolverContaQualquer: (contaNome: string) => Promise<{ id: string; nome: string; categoria: string }>
  salvarAcao: (msgId: string, acaoIdx: number, acao: AcaoIA) => Promise<void>
  executarAcoesAuto: (msgId: string, acoes: AcaoIA[], uid: string, opts?: { incluirDestrutivas?: boolean }) => Promise<{ salvas: number; falhas: number; erros: string[] }>
  setAcaoStatus: (msgId: string, idx: number, status: AcaoIA['status'], errorMsg?: string) => void
}

export function useElenaSalvar({
  supabase,
  userIdRef,
  sessaoIdRef,
  mensagensRef,
  colaboradores,
  ultimoRegistroRef,
  setMensagens,
  setRelatorioData,
}: UseElenaSalvarProps): UseElenaSalvarReturn {

  // Cache da conta PJ padrão para evitar queries repetidas
  const contaPjIdRef   = useRef<string | null>(null)
  // Cache do empresa_id do usuário (necessário para RLS de contas PJ)
  const empresaIdRef   = useRef<string | null>(null)

  // Busca e cacheia o empresa_id do usuário
  const getEmpresaId = async (uid: string): Promise<string | null> => {
    if (empresaIdRef.current) return empresaIdRef.current
    try {
      const { data, error } = await (supabase.from('perfis') as any)
        .select('empresa_id').eq('id', uid).maybeSingle()
      if (error) throw error
      if (data?.empresa_id) {
        empresaIdRef.current = data.empresa_id
        return data.empresa_id
      }
      // 🔴 FIX: antes retornava null em silêncio e os inserts seguiam SEM
      // empresa_id — o registro nascia "órfão de tenant" e sumia de todas as
      // queries filtradas por empresa. Foi exatamente isso que deixou os
      // imóveis do Sr. Max invisíveis. Agora o problema grita no console e
      // vira diagnóstico para o programador.
      console.warn(`[Elena] ⚠️ perfil ${uid} não tem empresa_id — registros criados agora podem ficar invisíveis nas telas filtradas por empresa!`)
    } catch (e: any) {
      console.warn('[Elena] ⚠️ getEmpresaId falhou:', e?.message || e)
    }
    return null
  }

  // ═══════════════════════════════════════════════════════════════
  // 📋 DIAGNÓSTICO — transforma falha em backlog
  //
  // Toda vez que a Elena não consegue fazer algo, registramos:
  //   • O QUE o Sr. Max pediu (texto original)
  //   • QUAL ação a IA tentou gerar
  //   • POR QUE falhou (erro do banco / handler inexistente)
  //   • O JSON completo que a IA produziu
  //
  // Assim o desenvolvedor abre o relatório e vê exatamente o que
  // implementar e por quê — em vez da mensagem sumir no chat.
  // ═══════════════════════════════════════════════════════════════
  const registrarDiagnostico = useCallback(async (
    tipo: 'nao_implementado' | 'erro_salvar' | 'dado_invalido',
    dados: {
      acaoTipo?: string
      mensagem?: string
      payload?: any
      pedidoUsuario?: string
    },
  ) => {
    try {
      const uid = userIdRef.current
      if (!uid) return
      const empresaId = await getEmpresaId(uid)

      // Última coisa que o Sr. Max escreveu — é o contexto mais valioso
      const ultimaDoUsuario = dados.pedidoUsuario
        || [...(mensagensRef.current || [])].reverse().find(m => m.role === 'user')?.texto
        || null

      const { error } = await (supabase.from('elena_diagnostico') as any).insert({
        user_id: uid,
        empresa_id: empresaId,
        tipo,
        acao_tipo: dados.acaoTipo || null,
        mensagem: (dados.mensagem || '').substring(0, 1000) || null,
        dados: dados.payload ?? null,
        pedido_usuario: ultimaDoUsuario ? String(ultimaDoUsuario).substring(0, 2000) : null,
        rota: typeof window !== 'undefined' ? window.location.pathname : null,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent.substring(0, 300) : null,
      })

      if (error) {
        // Se nem o diagnóstico grava, pelo menos deixa no console
        console.error('[Elena] diagnóstico não registrado:', error.message,
          '— rode a migration 065_elena_diagnostico.sql')
      }
    } catch (e: any) {
      console.error('[Elena] erro ao registrar diagnóstico:', e?.message || e)
    }
  }, [supabase, userIdRef, mensagensRef])

  // ── Helpers internos ──────────────────────────────────────────
  const hoje = () => new Date().toISOString().split('T')[0]

  const validarData = (data: any) =>
    data && /^\d{4}-\d{2}-\d{2}$/.test(String(data)) ? String(data) : hoje()

  const validarFormaPag = (forma: any) =>
    FORMAS_PAG_VALIDAS.includes(forma) ? forma : 'pix'

  // ── setAcaoStatus ─────────────────────────────────────────────
  const setAcaoStatus = useCallback((msgId: string, idx: number, status: AcaoIA['status'], errorMsg?: string) => {
    setMensagens(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, acoes: m.acoes?.map((a, i) => i === idx ? { ...a, status, errorMsg } : a) }
        : m
    ))
  }, [setMensagens])

  // ── exibirConfirmacaoSalvamento ───────────────────────────────
  const exibirConfirmacaoSalvamento = useCallback((
    tipo: string,
    dados: Record<string, any>,
    contaNomeResolvido?: string,
    ultimoId?: string,
    ultimaTabela?: string,
  ) => {
    const info = MAPA_CONFIRMACAO[tipo] || { modulo: tipo, rota: '', icone: '✅' }
    const descricao = dados.descricao || dados.titulo || dados.chave || ''
    const valor = dados.valor ? Number(dados.valor) : undefined
    const categoria = dados.categoria || dados.mes_referencia || undefined
    const dataFmt = dados.data
      ? new Date(dados.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : dados.data_inicio
        ? new Date(dados.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })

    const confirmacao: ConfirmacaoSalvamento = {
      tipo, descricao, valor,
      contaNome: contaNomeResolvido || dados.conta_nome || undefined,
      data: dataFmt, categoria,
      modulo: info.modulo, rota: info.rota, icone: info.icone,
      ultimoId, ultimaTabela,
    }

    setMensagens(prev => [...prev, {
      id: Date.now().toString() + '_conf',
      role: 'ai',
      texto: '',
      confirmacao,
    }])
  }, [setMensagens])

  // ═══════════════════════════════════════════════════════════════
  // 🔴 RESOLVERS DE CONTA — REESCRITOS
  //
  // BUGS CORRIGIDOS:
  //  1. resolverContaPj filtrava por user_id. Contas PJ têm user_id = NULL
  //     no banco → NUNCA eram encontradas → "Nenhuma conta PJ cadastrada".
  //     Agora PJ busca por empresa_id (o tenant correto).
  //  2. Match por bandeira pegava o PRIMEIRO cartão da bandeira. Com 4
  //     cartões Visa, um gasto "no visa" ia para o cartão errado, em
  //     silêncio. Agora, se houver ambiguidade, a Elena PERGUNTA.
  //  3. Fallback silencioso em contas[0] — gasto ia para conta arbitrária.
  //     Agora só usa a conta padrão se houver exatamente UMA.
  //  4. autocriar fazia .insert() cego → duplicava conta. Agora usa upsertConta.
  //  5. resolverContaPf autocriar não passava empresa_id (NOT NULL) → o
  //     insert falhava e o catch {} engolia o erro.
  // ═══════════════════════════════════════════════════════════════

  /** Carrega as contas do escopo correto do tenant */
  const carregarContas = useCallback(async (
    categoria: 'pf' | 'pj',
    tipos?: string[],
  ): Promise<any[]> => {
    const uid = userIdRef.current
    let q = (supabase.from('contas') as any)
      .select('id, nome, bandeira, tipo, categoria')
      .eq('categoria', categoria)
      .eq('ativo', true)

    if (categoria === 'pj') {
      // PJ → escopo EMPRESA (user_id costuma ser NULL nessas contas)
      const empresaId = await getEmpresaId(uid)
      if (!empresaId) return []
      q = q.eq('empresa_id', empresaId)
    } else {
      // PF → escopo USUÁRIO
      q = q.eq('user_id', uid)
    }

    if (tipos?.length) q = q.in('tipo', tipos)
    const { data } = await q.order('created_at', { ascending: true })
    return data || []
  }, [supabase, userIdRef])

  /**
   * Encontra a conta que o Sr. Max quis dizer.
   * Se houver AMBIGUIDADE, lança erro pedindo para especificar —
   * nunca escolhe uma conta por conta própria.
   */
  const acharConta = (contas: any[], busca: string): { id: string; nome: string } | null => {
    if (!contas.length) return null
    const b = busca.trim()
    if (!b) return null

    // 1. Match forte por nome (exato / variante de voz / acento)
    const porNome = contas.filter((c: any) => mesmaConta(c.nome, b))
    if (porNome.length === 1) return { id: porNome[0].id, nome: porNome[0].nome }
    if (porNome.length > 1) {
      throw new ElenaPergunta(
        `Encontrei mais de uma conta parecida com "${b}": ${porNome.map((c: any) => c.nome).join(', ')}. ` +
        `Qual delas, Sr. Max?`
      )
    }

    // 2. Substring do nome (ex: "sofisa" → Sofisa Master / Sofisa Visa)
    const bl = b.toLowerCase()
    const porSub = contas.filter((c: any) => (c.nome || '').toLowerCase().includes(bl))
    if (porSub.length === 1) return { id: porSub[0].id, nome: porSub[0].nome }
    if (porSub.length > 1) {
      throw new ElenaPergunta(
        `"${b}" corresponde a ${porSub.length} contas: ${porSub.map((c: any) => c.nome).join(', ')}. ` +
        `Qual delas, Sr. Max?`
      )
    }

    // 3. Bandeira — só se for INEQUÍVOCO (1 cartão dessa bandeira)
    const porBandeira = contas.filter((c: any) => (c.bandeira || '').toLowerCase() === bl)
    if (porBandeira.length === 1) return { id: porBandeira[0].id, nome: porBandeira[0].nome }
    if (porBandeira.length > 1) {
      throw new ElenaPergunta(
        `Você tem ${porBandeira.length} cartões ${b}: ${porBandeira.map((c: any) => c.nome).join(', ')}. ` +
        `Em qual deles, Sr. Max?`
      )
    }

    return null
  }

  // ── resolverContaPj ───────────────────────────────────────────
  const resolverContaPj = useCallback(async (contaNome?: string, autocriar = true): Promise<{ id: string; nome: string }> => {
    const uid = userIdRef.current
    const contas = await carregarContas('pj')

    if (contaNome?.trim()) {
      const achada = acharConta(contas, contaNome)   // pode lançar erro de ambiguidade
      if (achada) return achada

      if (autocriar && contaNome.trim().length >= 2) {
        const nomeNovo = contaNome.trim()
        const bandeira = Object.entries(BANDEIRAS_MAP).find(([k]) => nomeNovo.toLowerCase().includes(k))?.[1] || null
        const empresaId = await getEmpresaId(uid)
        if (!empresaId) throw new Error('Não consegui identificar sua empresa para criar a conta PJ.')
        const r = await upsertConta(supabase, uid, {
          nome: nomeNovo,
          tipo: bandeira ? 'cartao_credito' : 'corrente',
          categoria: 'pj',
          bandeira,
          saldo_inicial: 0, saldo_atual: 0, ativo: true,
          user_id: uid, empresa_id: empresaId,
        })
        return { id: r.id, nome: r.nome }
      }
      return { id: '', nome: '' }
    }

    // Sem nome informado: só usa a padrão se houver UMA. Nunca escolhe sozinha.
    if (contas.length === 1) {
      contaPjIdRef.current = contas[0].id
      return { id: contas[0].id, nome: contas[0].nome }
    }
    if (contas.length > 1) {
      throw new ElenaPergunta(
        `Você tem ${contas.length} contas PJ (${contas.map((c: any) => c.nome).join(', ')}). ` +
        `Em qual eu lanço, Sr. Max?`
      )
    }
    return { id: '', nome: '' }
  }, [supabase, userIdRef, carregarContas])

  // ── resolverContaPf ───────────────────────────────────────────
  const resolverContaPf = useCallback(async (contaNome?: string, autocriar = true): Promise<{ id: string; nome: string }> => {
    if (!contaNome?.trim()) return { id: '', nome: '' }
    const uid = userIdRef.current
    const contas = await carregarContas('pf')

    const achada = acharConta(contas, contaNome)   // pode lançar erro de ambiguidade
    if (achada) return achada

    if (autocriar && contaNome.trim().length >= 2) {
      const nomeNovo = contaNome.trim()
      const bandeira = Object.entries(BANDEIRAS_MAP).find(([k]) => nomeNovo.toLowerCase().includes(k))?.[1] || null
      // 🔴 empresa_id é NOT NULL — a versão antiga não passava, e o insert falhava
      const empresaId = await getEmpresaId(uid)
      const r = await upsertConta(supabase, uid, {
        nome: nomeNovo,
        tipo: bandeira ? 'cartao_credito' : 'corrente',
        categoria: 'pf',
        bandeira,
        saldo_inicial: 0, saldo_atual: 0, ativo: true,
        user_id: uid,
        ...(empresaId ? { empresa_id: empresaId } : {}),
      })
      return { id: r.id, nome: r.nome }
    }

    return { id: '', nome: '' }
  }, [supabase, userIdRef, carregarContas])

  // ── resolverCartaoPf ────────────────────────────────────────
  const resolverCartaoPf = useCallback(async (contaNome: string): Promise<{ id: string; nome: string }> => {
    if (!contaNome?.trim()) return { id: '', nome: '' }
    const contas = await carregarContas('pf', ['cartao_credito', 'cartao_debito'])
    const achada = acharConta(contas, contaNome)   // pode lançar erro de ambiguidade
    return achada || { id: '', nome: '' }
  }, [carregarContas])

  // ── resolverContaQualquer ─────────────────────────────────────
  const resolverContaQualquer = useCallback(async (contaNome: string): Promise<{ id: string; nome: string; categoria: string }> => {
    if (!contaNome?.trim()) return { id: '', nome: '', categoria: '' }
    const [pf, pj] = await Promise.all([carregarContas('pf'), carregarContas('pj')])
    const todas = [...pf, ...pj]
    const achada = acharConta(todas, contaNome)   // pode lançar erro de ambiguidade
    if (!achada) return { id: '', nome: '', categoria: '' }
    const cat = todas.find((c: any) => c.id === achada.id)?.categoria || ''
    return { ...achada, categoria: cat }
  }, [carregarContas])

  // ── salvarAcao ────────────────────────────────────────────────
  const salvarAcao = useCallback(async (msgId: string, acaoIdx: number, acao: AcaoIA) => {
    // Lê userId da ref — nunca fica stale
    const uid = userIdRef.current

    // ⚠️ Guard crítico: sem uid não salva nada
    if (!uid) {
      setAcaoStatus(msgId, acaoIdx, 'error', 'Sessão expirada. Recarregue a página.')
      return
    }

    try {

      // ── GASTO PF ─────────────────────────────────────────────
      if (acao.tipo === 'gasto') {
        const dataGasto = validarData(acao.dados.data)
        const valor = Number(acao.dados.valor) || 0
        if (valor <= 0) throw new Error('Valor inválido. Informe o valor do gasto antes de salvar.')
        let queryDups = supabase.from('gastos_pessoais').select('id').eq('user_id', uid).eq('data', dataGasto).eq('valor', valor)
        if (acao.dados.descricao) queryDups = queryDups.eq('descricao', acao.dados.descricao)
        const { data: dups } = await queryDups
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error('⚠️ Duplicidade! Já existe um gasto com este valor nesta data.')
        }
        const forma = validarFormaPag(acao.dados.forma_pagamento)
        const contaPf = await resolverContaPf(acao.dados.conta_nome)
        const numParcelas = Number(acao.dados.parcelas) || 1
        const valorTotal = valor
        const notasParcelas = numParcelas > 1 ? `Parcela 1/${numParcelas} — Total R$ ${valorTotal.toFixed(2)} | ` : ''
        const notasFinais = contaPf.nome
          ? `${notasParcelas}Cartão/Conta: ${contaPf.nome} | Registrado pela Elena`
          : `${notasParcelas}Registrado pela Elena`

        const { data: novoGasto, error } = await (supabase.from('gastos_pessoais') as any).insert({
          user_id: uid,
          descricao: numParcelas > 1 ? `${acao.dados.descricao || 'Gasto via Elena'} (${numParcelas}x)` : (acao.dados.descricao || 'Gasto via Elena'),
          valor: valorTotal,
          categoria: acao.dados.categoria || 'outros',
          forma_pagamento: forma,
          data: dataGasto,
          recorrente: false,
          parcelas: numParcelas > 1 ? numParcelas : null,
          conta_id: contaPf.id || null,
          notas: notasFinais,
        }).select('id').single()
        if (error) throw new Error(error.message)
        if (novoGasto?.id) ultimoRegistroRef.current = { tabela: 'gastos_pessoais', id: novoGasto.id }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('gasto', acao.dados, contaPf.nome, novoGasto?.id, 'gastos_pessoais')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── RECEITA PF ───────────────────────────────────────────
      } else if (acao.tipo === 'receita') {
        const dataReceita = validarData(acao.dados.data)
        const valor = Number(acao.dados.valor) || 0
        if (valor <= 0) throw new Error('Valor inválido. Informe o valor da receita antes de salvar.')
        let queryDups = supabase.from('receitas_pessoais').select('id').eq('user_id', uid).eq('data', dataReceita).eq('valor', valor)
        if (acao.dados.descricao) queryDups = queryDups.eq('descricao', acao.dados.descricao)
        const { data: dups } = await queryDups
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error('⚠️ Duplicidade! Já existe uma receita com este valor nesta data.')
        }
        const contaPf = await resolverContaPf(acao.dados.conta_nome)
        const forma = validarFormaPag(acao.dados.forma_pagamento)
        const notaReceita = [
          contaPf.nome ? `Conta: ${contaPf.nome}` : null,
          `Forma: ${forma}`,
          'Registrado pela Elena',
        ].filter(Boolean).join(' | ')
        const { error } = await (supabase.from('receitas_pessoais') as any).insert({
          user_id: uid,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor, categoria: acao.dados.categoria || 'pro_labore',
          data: dataReceita, recorrente: false,
          conta_id: contaPf.id || null, notas: notaReceita,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('receita', acao.dados, contaPf.nome)
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── GASTO EMPRESA ────────────────────────────────────────
      } else if (acao.tipo === 'gasto_empresa') {
        const dataComp = validarData(acao.dados.data)
        const valor = Number(acao.dados.valor) || 0
        if (valor <= 0) throw new Error('Valor inválido. Informe o valor da despesa antes de salvar.')
        const { id: contaId, nome: contaNome } = await resolverContaPj(acao.dados.conta_nome)
        if (!contaId) throw new Error('Nenhuma conta PJ cadastrada. Cadastre uma conta PJ em Financeiro > Contas.')
        let queryDups = supabase.from('lancamentos').select('id').eq('conta_id', contaId).eq('data_competencia', dataComp).eq('valor', valor).eq('tipo', 'despesa')
        if (acao.dados.descricao) queryDups = queryDups.eq('descricao', acao.dados.descricao)
        const { data: dups } = await queryDups
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error(`⚠️ Duplicidade! Já existe uma despesa de R$ ${valor} na conta ${contaNome} nesta data.`)
        }
        const forma = validarFormaPag(acao.dados.forma_pagamento)
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: contaId,
          descricao: acao.dados.descricao || 'Despesa via Elena',
          valor, tipo: 'despesa', regime: 'caixa', status: 'validado',
          data_competencia: dataComp, data_caixa: dataComp,
          categoria_id: CAT_DESPESA_ID,
          created_by: uid,
          observacoes: `Conta: ${contaNome} | Pagamento: ${forma} | Registrado pela Elena`,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('gasto_empresa', acao.dados, contaNome)
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── RECEITA EMPRESA ──────────────────────────────────────
      } else if (acao.tipo === 'receita_empresa') {
        const dataComp = validarData(acao.dados.data)
        const valor = Number(acao.dados.valor) || 0
        if (valor <= 0) throw new Error('Valor inválido. Informe o valor da receita antes de salvar.')
        const { id: contaId, nome: contaNome } = await resolverContaPj(acao.dados.conta_nome)
        if (!contaId) throw new Error('Nenhuma conta PJ cadastrada.')
        let queryDups = supabase.from('lancamentos').select('id').eq('conta_id', contaId).eq('data_competencia', dataComp).eq('valor', valor).eq('tipo', 'receita')
        if (acao.dados.descricao) queryDups = queryDups.eq('descricao', acao.dados.descricao)
        const { data: dups } = await queryDups
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error(`⚠️ Duplicidade! Já existe uma receita de R$ ${valor} na conta ${contaNome} nesta data.`)
        }
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: contaId,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor, tipo: 'receita', regime: 'caixa', status: 'validado',
          data_competencia: dataComp, data_caixa: dataComp,
          categoria_id: CAT_RECEITA_ID, created_by: uid,
          observacoes: `Conta: ${contaNome} | Registrado pela Elena`,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('receita_empresa', acao.dados, contaNome)
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── AGENDA ───────────────────────────────────────────────
      } else if (acao.tipo === 'agenda') {
        let dataInicio: Date
        if (acao.dados.data_inicio) {
          const strData = String(acao.dados.data_inicio)
          const strCorrigida = /^\d{4}-\d{2}-\d{2}$/.test(strData.trim())
            ? strData.trim() + 'T12:00:00' : strData
          dataInicio = new Date(strCorrigida)
        } else {
          dataInicio = new Date(Date.now() + 86400000)
        }
        const anoCorreto = new Date().getFullYear()
        if (dataInicio.getFullYear() < anoCorreto) dataInicio.setFullYear(anoCorreto)
        // Mapeamento de tipos: garante compatibilidade mesmo sem a migration 049
        // Após rodar migration 049 no Supabase, todos esses tipos passam a ser aceitos
        // ANTES da migration: vencimento→lembrete, prazo→tarefa, pessoal→compromisso
        // APÓS a migration 049: todos os tipos são aceitos diretamente pelo banco
        const TIPOS_BANCO_ANTIGO = ['compromisso','lembrete','nota','tarefa','aniversario','reuniao'] as const
        const TIPO_FALLBACK_PRE_MIGRATION: Record<string, string> = {
          vencimento: 'lembrete',    // fallback até migration 049
          prazo: 'tarefa',           // fallback até migration 049  
          pessoal: 'compromisso',    // fallback até migration 049
        }
        const tipoRaw = String(acao.dados.tipo || 'compromisso')
        const tipoEvento = (TIPOS_EVENTO_VALIDOS as readonly string[]).includes(tipoRaw)
          ? tipoRaw
          : (TIPOS_BANCO_ANTIGO.includes(tipoRaw as any)
              ? tipoRaw
              : (TIPO_FALLBACK_PRE_MIGRATION[tipoRaw] || 'compromisso'))
        // ── Guard anti-duplicação ────────────────────────────────────────
        // Janela de 60s para evitar duplo-clique e re-confirmações rápidas.
        // Para vencimentos (recorrentes mensais), verifica sem limite de tempo.
        const ha60s = new Date(Date.now() - 60000).toISOString()
        const tituloEvento = acao.dados.titulo || 'Evento via Elena'
        const strDataParaDedup = String(acao.dados.data_inicio || '').substring(0, 16) // YYYY-MM-DDTHH:MM
        const tipoParaDedup = tipoEvento

        // Vencimentos: nunca duplicar no mesmo mês+dia (independente de hora)
        const strDiaParaDedup = String(acao.dados.data_inicio || '').substring(0, 10) // YYYY-MM-DD
        if (tipoParaDedup === 'vencimento') {
          const { data: jaExisteVenc } = await (supabase.from('agenda_eventos') as any)
            .select('id').eq('user_id', uid).eq('titulo', tituloEvento).eq('tipo', 'vencimento')
            .gte('data_inicio', `${strDiaParaDedup}T00:00:00`)
            .lte('data_inicio', `${strDiaParaDedup}T23:59:59`).limit(1)
          if (jaExisteVenc?.length) {
            setAcaoStatus(msgId, acaoIdx, 'saved')
            return
          }
        } else {
          // Outros tipos: janela de 60s + mesmo título+horário
          const { data: jaExiste } = await (supabase.from('agenda_eventos') as any)
            .select('id, data_inicio').eq('user_id', uid).eq('titulo', tituloEvento)
            .gte('created_at', ha60s).limit(5)
          const isDuplicado = (jaExiste || []).some((ev: any) =>
            String(ev.data_inicio || '').substring(0, 16) === strDataParaDedup
          )
          if (isDuplicado) {
            setAcaoStatus(msgId, acaoIdx, 'saved')
            return
          }
        }

        // ── Timezone: adiciona offset local para salvar corretamente no Supabase ──────
        // Problema: "2026-06-03T20:39:00" sem offset → Supabase (UTC) interpreta como UTC
        //           → exibe 17:39 no Brasil (UTC-3) em vez de 20:39
        // Solução: adicionar o offset local: "2026-06-03T20:39:00-03:00"
        //          → Supabase armazena 23:39 UTC → display correto: 20:39 local
        const tzOffset = (() => {
          const off = new Date().getTimezoneOffset() // e.g. 180 para UTC-3
          const sign = off <= 0 ? '+' : '-'
          const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
          const m = String(Math.abs(off) % 60).padStart(2, '0')
          return `${sign}${h}:${m}` // "-03:00"
        })()
        const strDataOriginal = String(acao.dados.data_inicio || '')
        let dataInicioStr: string
        if (strDataOriginal && strDataOriginal.includes('T')) {
          // Remove Z ou offset existente, adiciona offset local
          const base = strDataOriginal.replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '')
          dataInicioStr = `${base}${tzOffset}`
        } else {
          // Fallback: constrói com data local + offset
          const pad = (n: number) => String(n).padStart(2, '0')
          const d = dataInicio
          dataInicioStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00${tzOffset}`
        }

        const { error } = await (supabase.from('agenda_eventos') as any).insert({
          user_id: uid,
          titulo: tituloEvento,
          descricao: acao.dados.descricao || null,
          tipo: tipoEvento,
          data_inicio: dataInicioStr,  // horário local sem conversão UTC
          data_fim: null, dia_inteiro: false,
          status: 'pendente', prioridade: 'normal',
          cor: COR_EVENTO[tipoEvento] || '#f59e0b',
          origem: 'ia',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('agenda', acao.dados)
        window.dispatchEvent(new CustomEvent('elena:agenda-updated'))

      // ── OCORRÊNCIA ───────────────────────────────────────────
      } else if (acao.tipo === 'ocorrencia') {
        let colaboradorId: string | null = null
        if (acao.dados.colaborador_nome) {
          const nomeBusca = acao.dados.colaborador_nome.toLowerCase()
          const enc = colaboradores.find(c =>
            c.nome.toLowerCase().includes(nomeBusca) || nomeBusca.includes(c.nome.toLowerCase().split(' ')[0])
          )
          colaboradorId = enc?.id || null
        }
        const { error } = await (supabase.from('ocorrencias') as any).insert({
          tipo: acao.dados.tipo || 'alerta',
          descricao: acao.dados.descricao || 'Ocorrência via Elena',
          colaborador_id: colaboradorId,
          modulo: acao.dados.modulo || null,
          impacto: acao.dados.impacto || 'medio',
          resolvida: false,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('ocorrencia', acao.dados)

      // ── IDEIA ────────────────────────────────────────────────
      } else if (acao.tipo === 'ideia') {
        const categoria = CATEGORIAS_IDEIA.includes(acao.dados.categoria) ? acao.dados.categoria : 'geral'
        const { error } = await (supabase.from('elena_ideias') as any).insert({
          user_id: uid,
          titulo: acao.dados.titulo || 'Ideia via Elena',
          descricao: acao.dados.descricao || null,
          categoria, status: 'rascunho', progresso: 5,
          notas: 'Capturada pela Elena durante conversa',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('ideia', acao.dados)
        window.dispatchEvent(new CustomEvent('elena:ideia-salva'))

      // ── REGISTRO GENÉRICO ────────────────────────────────────
      } else if (acao.tipo === 'registro') {
        const tipo = TIPOS_REGISTRO_LIVRE.includes(acao.dados.tipo) ? acao.dados.tipo : 'geral'
        const { error } = await (supabase.from('elena_registro') as any).insert({
          user_id: uid, tipo,
          chave: acao.dados.chave || null,
          titulo: acao.dados.titulo || acao.dados.descricao?.substring(0, 100) || 'Registro via Elena',
          conteudo: acao.dados.descricao || acao.dados.conteudo || null,
          importante: acao.dados.importante ?? false,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── RELATÓRIO ────────────────────────────────────────────
      } else if (acao.tipo === 'relatorio') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const dados = await buscarDadosRelatorio(supabase, uid, acao.dados.periodo || 'mes_atual')
        setRelatorioData(dados)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── PROJEÇÃO DO PRÓXIMO MÊS(ES) ──────────────────────────
      } else if (acao.tipo === 'projecao_mes') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const meses = Math.min(Number(acao.dados.meses) || 1, 3)
        const agora = new Date()
        const empresaId = await getEmpresaId(uid)

        // ── 1. Busca todos os dados em paralelo ──────────────────
        const inicio3m = new Date(agora)
        inicio3m.setMonth(inicio3m.getMonth() - 3)
        inicio3m.setDate(1)

        const mesAtualRef = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`

        // Build queries with empresa_id fallback
        // 🔧 FIX (21/07/2026): faltava dia_vencimento — a coluna "Dia" da
        // tabela de financiamentos sempre mostrava "—" pra imóveis (reportado
        // pelo Sr. Max: "aparece o dos cartões, mas dos imóveis não está").
        let qImoveis = (supabase.from('imoveis') as any)
          .select('titulo, valor_parcela, parcelas_total, parcelas_pagas, dia_vencimento, construtora')
        if (empresaId) qImoveis = qImoveis.eq('empresa_id', empresaId)

        let qVeiculos = (supabase.from('veiculos') as any)
          .select('titulo, valor_parcela, parcelas_total, parcelas_pagas, vencimento_dia, financiado')
          .eq('financiado', true)
        if (empresaId) qVeiculos = qVeiculos.eq('empresa_id', empresaId)

        let qAtivos = (supabase.from('ativos') as any)
          .select('ticker, nome, tipo, valor_investido, valor_atual, data_vencimento, corretora')
          .order('valor_investido', { ascending: false })
        if (empresaId) qAtivos = qAtivos.eq('empresa_id', empresaId)

        // 🔧 FIX (20/07/2026): faltava esta seção inteira — a projeção mostrava
        // cartões e boletos de imóveis mas nunca os contratos de investimento
        // parcelados (ex: Bradesco Solar), diferente do resumo_mensal que já
        // tinha isso (reportado pelo Sr. Max via áudio).
        // 🔧 FIX 2 (20/07/2026): filtrar só pelo mês ATUAL escondia contratos
        // que começam num mês futuro dentro da janela da projeção (ex: Sítio
        // Vida, cuja primeira parcela só existe com mes_referencia de agosto)
        // — usar >= mês atual pega tanto os que já estão rodando quanto os
        // que só começam mais pra frente, sem perder nenhum dos dois casos.
        // 🔧 FIX 3 (21/07/2026): faltava proximo_vencimento — mesma reclamação
        // do Sr. Max, a data também não aparecia na seção de investimentos.
        let qContratosInv = (supabase.from('investimentos_contratos') as any)
          .select('nome_contrato, instituicao, parcela_atual, parcela_total, valor_mensal, valor_variavel, proximo_vencimento, mes_referencia')
          .gte('mes_referencia', mesAtualRef)
          .order('mes_referencia', { ascending: true })
        if (empresaId) qContratosInv = qContratosInv.eq('empresa_id', empresaId)

        const [
          { data: gastos3m },
          { data: receitas3m },
          { data: alertasRec },
          { data: receitasRec },
          { data: imoveisFinanc },
          { data: veiculosFinanc },
          { data: cartoesPf },
          { data: faturasMes },
          { data: ativosProj },
          { data: pagamentosMes },
          { data: contratosInvProj },
        ] = await Promise.all([
          // Gastos históricos (3 meses)
          (supabase.from('gastos_pessoais') as any)
            .select('valor, categoria, data, recorrente')
            .eq('user_id', uid)
            .gte('data', inicio3m.toISOString().split('T')[0])
            .order('data'),
          // Receitas históricas (3 meses)
          (supabase.from('receitas_pessoais') as any)
            .select('valor, categoria, data, recorrente')
            .eq('user_id', uid)
            .gte('data', inicio3m.toISOString().split('T')[0])
            .order('data'),
          // Contas fixas recorrentes (compromissos_fixos — tabela unificada)
          (supabase.from('compromissos_fixos') as any)
            .select('id, descricao, valor, dia_vencimento, categoria, tipo_detalhe')
            .eq('user_id', uid)
            .eq('ativo', true)
            .eq('recorrente', true)
            .order('dia_vencimento'),
          // Receitas marcadas como recorrentes
          (supabase.from('receitas_pessoais') as any)
            .select('descricao, valor, categoria')
            .eq('user_id', uid)
            .eq('recorrente', true)
            .order('valor', { ascending: false }),
          // Parcelas de imóveis (financiamentos ativos)
          qImoveis,
          // Parcelas de veículos (financiamentos ativos)
          qVeiculos,
          // Cartões PF com dia de vencimento
          (supabase.from('contas') as any)
            .select('id, nome, bandeira, dia_vencimento, limite')
            .eq('user_id', uid).eq('ativo', true)
            .in('tipo', ['cartao_credito', 'cartao_debito']),
          // Faturas do mês atual (para estimar próximo mês)
          (supabase.from('faturas_cartoes') as any)
            .select('conta_id, valor_fechado, status')
            .eq('user_id', uid)
            .eq('mes_referencia', mesAtualRef),
          // Investimentos / Ativos
          qAtivos,
          // Histórico de pagamentos do mês atual (compromissos já pagos)
          (supabase.from('historico_pagamentos_mensal') as any)
            .select('compromisso_id, status, valor_pago')
            .eq('user_id', uid)
            .eq('mes_referencia', mesAtualRef),
          // Contratos de investimento parcelados (ex: Bradesco)
          qContratosInv,
        ])

        // ── 2. Calcula médias mensais (gastos variáveis) ────────
        const gastosVariaveis = (gastos3m || []).filter((g: any) => !g.recorrente)
        const totalGastosVar = gastosVariaveis.reduce((s: number, g: any) => s + Number(g.valor), 0)
        const mediaGastosVar = totalGastosVar / 3

        const totalReceitas = (receitas3m || []).reduce((s: number, r: any) => s + Number(r.valor), 0)
        const mediaReceitas = totalReceitas / 3

        // ── 3. Contas fixas (compromissos_fixos) — cruza com pagamentos ──
        const pagosMap = new Map<string, any>((pagamentosMes || []).map((p: any) => [p.compromisso_id, p]))
        const contasPendentes = (alertasRec || []).filter((a: any) => {
          const pag = pagosMap.get(a.id)
          return !pag || pag.status !== 'pago'
        })
        const contasPagas = (alertasRec || []).filter((a: any) => {
          const pag = pagosMap.get(a.id)
          return pag && pag.status === 'pago'
        })
        const totalContasFixas = contasPendentes.reduce((s: number, a: any) => s + (Number(a.valor) || 0), 0)
        const totalContasPagas = contasPagas.reduce((s: number, a: any) => s + (Number(a.valor) || 0), 0)

        // ── 4. Receitas recorrentes confirmadas ─────────────────
        const totalReceitasRec = (receitasRec || []).reduce((s: number, r: any) => s + Number(r.valor), 0)

        // ── 5. Parcelas de financiamento (imóveis + veículos) ───
        // 🔧 FIX (20/07/2026): antes exigia `&& im.valor_parcela`, o que fazia
        // qualquer financiamento sem valor cadastrado sumir da projeção sem
        // aviso — mesmo bug do resumo_mensal (Sítio Zeta/São Roque). Agora
        // entra com placeholder "valor a definir" e não soma no total.
        const parcelasAtivas: { titulo: string; valor: number; valorLabel?: string; somaNoTotal?: boolean; total: number; pagas: number; dia?: number }[] = []
        ;(imoveisFinanc || []).forEach((im: any) => {
          const restantes = (im.parcelas_total || 0) - (im.parcelas_pagas || 0)
          if (restantes > 0) {
            const temValor = im.valor_parcela != null
            parcelasAtivas.push({
              titulo: `🏠 ${im.titulo}${im.construtora ? ` (${im.construtora})` : ''}`,
              valor: temValor ? Number(im.valor_parcela) : 0,
              valorLabel: temValor ? undefined : '⚠️ valor a definir',
              somaNoTotal: temValor,
              total: im.parcelas_total || 0, pagas: im.parcelas_pagas || 0,
              dia: im.dia_vencimento, // 🔧 FIX (21/07/2026): faltava — coluna "Dia" sempre vinha "—" pra imóveis
            })
          }
        })
        ;(veiculosFinanc || []).forEach((ve: any) => {
          const restantes = (ve.parcelas_total || 0) - (ve.parcelas_pagas || 0)
          if (restantes > 0) {
            const temValor = ve.valor_parcela != null
            parcelasAtivas.push({
              titulo: `🚗 ${ve.titulo}`,
              valor: temValor ? Number(ve.valor_parcela) : 0,
              valorLabel: temValor ? undefined : '⚠️ valor a definir',
              somaNoTotal: temValor,
              total: ve.parcelas_total || 0, pagas: ve.parcelas_pagas || 0, dia: ve.vencimento_dia,
            })
          }
        })

        // ── 5b. Investimentos parcelados (contratos tipo Bradesco Solar) ──
        // 🔧 FIX (21/07/2026): faltava proximo_vencimento (Sr. Max: "a data não
        // está aparecendo... nem nos imóveis nem nos investimentos, só do cartão").
        function mesesEntre(mesRefBase: string, mesRefAlvo: string): number {
          const [y1, m1] = mesRefBase.split('-').map(Number)
          const [y2, m2] = mesRefAlvo.split('-').map(Number)
          return (y2 - y1) * 12 + (m2 - m1)
        }
        function somarMeses(dataISO: string | null, meses: number): string | null {
          if (!dataISO) return null
          const d = new Date(dataISO)
          d.setMonth(d.getMonth() + meses)
          return d.toISOString().split('T')[0]
        }
        const investimentosAtivos: { nome: string; instituicao?: string; valor: number; parcelaAtualBase: number; parcelaTotalBase: number; proximoVencBase: string | null; offset: number }[] = []
        const nomesContratosVistos = new Set<string>()
        ;(contratosInvProj || []).forEach((c: any) => {
          // dedupe: se o mesmo contrato tiver linha no mês atual E numa futura
          // (raro, mas possível), fica só com a mais próxima (lista já vem
          // ordenada por mes_referencia ascendente)
          if (nomesContratosVistos.has(c.nome_contrato)) return
          const restantes = (c.parcela_total || 0) - (c.parcela_atual || 0)
          if (restantes > 0) {
            nomesContratosVistos.add(c.nome_contrato)
            investimentosAtivos.push({
              nome: c.nome_contrato,
              instituicao: c.instituicao,
              valor: Number(c.valor_mensal) || 0,
              parcelaAtualBase: c.parcela_atual || 0,
              parcelaTotalBase: c.parcela_total || 0,
              proximoVencBase: c.proximo_vencimento || null,
              offset: mesesEntre(mesAtualRef, c.mes_referencia), // 0 = já em andamento; >0 = começa mais pra frente dentro da janela
            })
          }
        })


        // ── 6. Cartões PF — estima fatura do próximo mês ────────
        const cartoesLista = cartoesPf || []
        const faturasMap = new Map<string, any>((faturasMes || []).map((f: any) => [f.conta_id, f]))
        let totalCartoes = 0
        const cartoesDetalhe: { nome: string; bandeira: string; dia: number; valorEstimado: number; status: string }[] = []
        cartoesLista.forEach((c: any) => {
          const fat: any = faturasMap.get(c.id)
          const valorEst = fat ? Number(fat.valor_fechado) || 0 : 0
          const status = fat?.status || 'sem_fatura'
          totalCartoes += valorEst
          cartoesDetalhe.push({ nome: c.nome, bandeira: c.bandeira || '', dia: c.dia_vencimento || 0, valorEstimado: valorEst, status })
        })

        // ── 7. Investimentos — vencimentos futuros ──────────────
        const ativosLista = ativosProj || []
        const totalInvestido = ativosLista.reduce((s: number, a: any) => s + (Number(a.valor_investido) || 0), 0)
        const totalMercado = ativosLista.reduce((s: number, a: any) => s + (Number(a.valor_atual) || Number(a.valor_investido) || 0), 0)

        // ── 8. Gastos por categoria (top 5) ─────────────────────
        const porCategoria: Record<string, number> = {}
        ;(gastos3m || []).forEach((g: any) => {
          const cat = g.categoria || 'outros'
          porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.valor)
        })
        const mediaCategoria: Record<string, number> = {}
        Object.entries(porCategoria).forEach(([cat, total]) => {
          mediaCategoria[cat] = total / 3
        })
        const topCats = Object.entries(mediaCategoria)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)

        // ── 9. Formata o relatório ──────────────────────────────
        const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        const catEmoji: Record<string, string> = {
          alimentacao: '🍽️', transporte: '🚗', saude: '💊', lazer: '🎮',
          educacao: '📚', moradia: '🏠', vestuario: '👕', tecnologia: '💻',
          investimento: '📈', outros: '📦', internet: '🌐', energia: '⚡',
          agua: '💧', telefone: '📱', aluguel: '🏠', condominio: '🏢',
          plano_saude: '🏥', financiamento: '🏦',
        }
        const contaEmoji: Record<string, string> = {
          agua: '🚰', energia: '💡', internet: '📡', telefone: '📱',
          aluguel: '🏠', condominio: '🏢', plano_saude: '💊',
          financiamento: '🏦', boleto: '📄', cartao: '💳', outro: '📋',
        }

        const nomeMes = (offset: number) => {
          const d = new Date(agora)
          d.setMonth(d.getMonth() + offset)
          return d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
        }

        // ── Totais consolidados ──────────────────────────────────
        const entradasMes = totalReceitasRec > 0 ? Math.max(mediaReceitas, totalReceitasRec) : mediaReceitas
        // 🔧 FIX (21/07/2026): totalSaidasMes/totalParcelas/totalInvestimentosContratos
        // não existem mais como valor único fixo — cada mês do loop abaixo calcula
        // o seu próprio, incrementando as parcelas pagas (Sr. Max: "ele não está
        // projetando, ele está replicando" — agosto/setembro mostravam a mesma
        // parcela de julho em vez de avançar).

        // 🔧 FIX (18/07/2026): saída reescrita pra usar o MESMO formato de tabela
        // markdown do resumo_mensal (pedido do Sr. Max: "a projeção deveria seguir
        // o mesmo formato ali só que com mês diferente na parte de cima"). Antes,
        // esse handler montava texto com "━━━" e bullets aninhados — formato
        // diferente do resumo, o que ele percebeu e reportou como "informações
        // embolada". A lógica de cálculo abaixo não mudou, só a montagem do texto.
        let texto = `📊 **PROJEÇÃO FINANCEIRA — ${meses === 1 ? 'PRÓXIMO MÊS' : `PRÓXIMOS ${meses} MESES`}**\n`
        texto += `_Baseada em dados reais + contas fixas + financiamentos + cartões + investimentos_\n`
        texto += `---\n`

        for (let m = 1; m <= meses; m++) {
          texto += `📅 **${nomeMes(m).toUpperCase()}**\n`
          texto += `---\n`

          // 🔧 FIX (21/07/2026): calculado AQUI DENTRO do loop, por mês —
          // antes esses dois arrays eram fixos e repetiam a mesma parcela em
          // todo mês da projeção. Agora incrementam (pagas+m) e somem da lista
          // quando o financiamento acaba de ser pago dentro da janela.
          const parcelasDoMes = parcelasAtivas
            .map(p => ({ ...p, pagasProjetadas: p.pagas + m }))
            .filter(p => p.pagasProjetadas < p.total)
          const totalParcelasMes = parcelasDoMes.reduce((s, p) => s + (p.somaNoTotal === false ? 0 : p.valor), 0)

          const investimentosDoMes = investimentosAtivos
            .map(i => ({ ...i, parcelaProjetada: i.parcelaAtualBase + (m - i.offset), vencProjetado: somarMeses(i.proximoVencBase, m - i.offset) }))
            .filter(i => m >= i.offset && i.parcelaProjetada < i.parcelaTotalBase)
          const totalInvestimentosMes = investimentosDoMes.reduce((s, i) => s + i.valor, 0)

          const totalSaidasMes = mediaGastosVar + totalContasFixas + totalParcelasMes + totalCartoes + totalInvestimentosMes

          // ── ENTRADAS ────────────────────────────────────────────
          texto += `💰 **ENTRADAS ESTIMADAS: ${fmt(entradasMes)}**\n`
          if (totalReceitasRec > 0) {
            texto += `_${fmt(totalReceitasRec)} confirmados (receitas recorrentes)_\n`
          }
          if (mediaReceitas > 0 && totalReceitasRec !== mediaReceitas) {
            texto += `_Média histórica: ${fmt(mediaReceitas)} (últimos 3 meses)_\n`
          }
          texto += `---\n`

          // ── SAÍDAS DETALHADAS ───────────────────────────────────
          texto += `💸 **SAÍDAS ESTIMADAS: ${fmt(totalSaidasMes)}**\n`

          // 1. Cartões PF
          if (cartoesDetalhe.length > 0) {
            texto += `💳 **Cartões de crédito**\n`
            texto += `| Cartão | Venc. | Fatura estimada | Status |\n`
            texto += `|--------|-------|-----------------:|--------|\n`
            cartoesDetalhe.forEach(c => {
              const bandeira = c.bandeira ? ` (${c.bandeira})` : ''
              const dia = c.dia ? String(c.dia).padStart(2, '0') : '—'
              const statusLabel = c.status === 'pago' ? '✅ Pago' : c.status === 'parcial' ? '🟡 Parcial' : c.status === 'pendente' ? '🔴 Pendente' : '⚪ Sem dados'
              const valorLabel = c.valorEstimado > 0 ? fmt(c.valorEstimado) : '⚪ sem dados'
              texto += `| ${c.nome}${bandeira} | ${dia} | ${valorLabel} | ${statusLabel} |\n`
            })
            if (totalCartoes > 0) {
              texto += `**Subtotal cartões: ${fmt(totalCartoes)}**\n`
            }
          }

          // 2. Contas fixas (compromissos_fixos) — com status de pagamento
          if ((alertasRec || []).length > 0) {
            const totalFixas = (alertasRec || []).length
            const qtdPagas = contasPagas.length
            texto += `🔒 **Contas fixas (${totalFixas}${qtdPagas > 0 ? ` — ${qtdPagas} paga(s)` : ''})**\n`
            texto += `| Conta | Dia | Valor | Status |\n`
            texto += `|-------|-----|------:|--------|\n`
            ;(alertasRec || []).forEach((a: any) => {
              const pag = pagosMap.get(a.id)
              const statusLabel = pag?.status === 'pago' ? '✅ Pago' : pag?.status === 'parcial' ? '🟡 Parcial' : '🔴 Pendente'
              const emoji = contaEmoji[a.tipo_detalhe] || '📋'
              const valorLabel = a.valor ? fmt(Number(a.valor)) : '⚠️ valor a definir'
              texto += `| ${emoji} ${a.descricao} | ${a.dia_vencimento} | ${valorLabel} | ${statusLabel} |\n`
            })
            if (totalContasPagas > 0) {
              texto += `✅ Já pago: ${fmt(totalContasPagas)}\n`
            }
            texto += `**Pendente: ${fmt(totalContasFixas)}**\n`
          }

          // 3. Financiamentos (parcelas detalhadas)
          if (parcelasDoMes.length > 0) {
            texto += `🏦 **Financiamentos ativos (${parcelasDoMes.length})**\n`
            texto += `| Financiamento | Dia | Parcela | Progresso |\n`
            texto += `|---------------|-----|--------:|-----------|\n`
            parcelasDoMes.forEach(p => {
              const pct = p.total > 0 ? Math.round(p.pagasProjetadas / p.total * 100) : 0
              const diaStr = p.dia ? String(p.dia).padStart(2, '0') : '—'
              const valorLabel = p.valorLabel || `${fmt(p.valor)}/mês`
              const faltam = p.total - p.pagasProjetadas
              texto += `| ${p.titulo} | ${diaStr} | ${valorLabel} | ${p.pagasProjetadas}/${p.total} (${pct}%) — faltam ${faltam} |\n`
            })
            texto += `**Subtotal financiamentos: ${fmt(totalParcelasMes)}**\n`
          }

          // 3b. Investimentos parcelados (contratos tipo Bradesco Solar)
          if (investimentosDoMes.length > 0) {
            texto += `📈 **Investimentos com parcela mensal (${investimentosDoMes.length})**\n`
            texto += `| Contrato | Instituição | Vencimento | Parcela | Valor Mensal |\n`
            texto += `|----------|-------------|------------|--------:|-------------:|\n`
            investimentosDoMes.forEach(i => {
              const aindaNaoComecou = m === i.offset && i.offset > 0
              const marcador = aindaNaoComecou ? '🆕 ' : ''
              const vencStr = i.vencProjetado ? new Date(i.vencProjetado).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
              texto += `| ${marcador}${i.nome} | ${i.instituicao || '—'} | ${vencStr} | ${i.parcelaProjetada}/${i.parcelaTotalBase} | ${fmt(i.valor)} |\n`
            })
            texto += `**Subtotal investimentos: ${fmt(totalInvestimentosMes)}**\n`
            if (investimentosDoMes.some(i => m === i.offset && i.offset > 0)) {
              texto += `_🆕 = contrato inicia neste mês_\n`
            }
          }

          // 4. Gastos variáveis (média)
          if (mediaGastosVar > 0) {
            texto += `📦 **Gastos variáveis estimados: ${fmt(mediaGastosVar)}** _(média dos últimos 3 meses)_\n`
            if (topCats.length > 0) {
              texto += `| Categoria | Média/mês |\n`
              texto += `|-----------|----------:|\n`
              topCats.forEach(([cat, media]) => {
                const emoji = catEmoji[cat] || '📦'
                texto += `| ${emoji} ${cat} | ${fmt(media)} |\n`
              })
            }
          }
          texto += `---\n`

          // ── SALDO PROJETADO ─────────────────────────────────────
          const saldoProjetado = entradasMes - totalSaidasMes
          const saldoIcon = saldoProjetado >= 0 ? '🟢' : '🔴'
          texto += `${saldoIcon} **SALDO PROJETADO: ${fmt(saldoProjetado)}**\n`
          texto += `---\n`

          // ── INVESTIMENTOS ───────────────────────────────────────
          if (ativosLista.length > 0) {
            const valorizInv = totalMercado - totalInvestido
            const rentPct = totalInvestido > 0 ? (valorizInv / totalInvestido) * 100 : 0
            texto += `📈 **Carteira de investimentos**\n`
            texto += `| Investido | Mercado | Resultado |\n`
            texto += `|----------:|--------:|-----------|\n`
            texto += `| ${fmt(totalInvestido)} | ${fmt(totalMercado)} | ${valorizInv >= 0 ? '🟢 +' : '🔴 '}${fmt(valorizInv)} (${rentPct.toFixed(1)}%) |\n`

            // Vencimentos de renda fixa no mês projetado
            const inicioM = new Date(agora)
            inicioM.setMonth(inicioM.getMonth() + m)
            inicioM.setDate(1)
            const fimM = new Date(inicioM)
            fimM.setMonth(fimM.getMonth() + 1)
            const ativosVencMes = ativosLista.filter((a: any) => {
              if (!a.data_vencimento) return false
              const dv = new Date(a.data_vencimento)
              return dv >= inicioM && dv < fimM
            })
            if (ativosVencMes.length > 0) {
              texto += `⏰ **Investimentos vencendo neste mês**\n`
              texto += `| Vencimento | Ativo | Valor |\n`
              texto += `|------------|-------|------:|\n`
              ativosVencMes.forEach((a: any) => {
                const dtV = new Date(a.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                texto += `| ${dtV} | ${a.ticker || a.nome} | ${fmt(Number(a.valor_investido) || 0)} |\n`
              })
            }
            texto += `---\n`
          }

          // ── VENCIMENTOS DA AGENDA ───────────────────────────────
          const inicioMes = new Date(agora)
          inicioMes.setMonth(inicioMes.getMonth() + m)
          inicioMes.setDate(1)
          const fimMes = new Date(inicioMes)
          fimMes.setMonth(fimMes.getMonth() + 1)
          const { data: vencFuturos } = await (supabase.from('agenda_eventos') as any)
            .select('titulo, data_inicio, tipo')
            .eq('user_id', uid)
            .in('tipo', ['vencimento'])
            .neq('status', 'cancelado')
            .neq('status', 'concluido')
            .gte('data_inicio', inicioMes.toISOString())
            .lte('data_inicio', fimMes.toISOString())
            .order('data_inicio')

          // Deduplica: remove vencimentos da agenda que já foram listados como contas fixas ou financiamentos
          const descFixas: string[] = (alertasRec || []).map((a: any) => (a.descricao || '').toLowerCase())
          const titulosParcelas: string[] = parcelasAtivas.map(p => p.titulo.replace(/[🏠🚗⚙️🔨📦]/g, '').trim().toLowerCase())

          const vencimentosReais = (vencFuturos || []).filter((ev: any) => {
            const t = (ev.titulo || '').toLowerCase()
            if (t.includes('confirmação') || t.includes('pagou') || t.startsWith('✅')) return false
            // Exclui se já listado como conta fixa
            if (descFixas.some(d => t.includes(d) || d.includes(t.replace(/[💳📄🚰💡📡📱🏠🏢💊🏦📋⚡]/g, '').trim()))) return false
            // Exclui se já listado como financiamento
            if (titulosParcelas.some(p => t.includes(p) || p.includes(t))) return false
            return true
          })

          if (vencimentosReais.length > 0) {
            texto += `📄 **Vencimentos agendados**\n`
            texto += `| Data | Compromisso |\n`
            texto += `|------|-------------|\n`
            vencimentosReais.forEach((ev: any) => {
              const dt = new Date(ev.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
              texto += `| ${dt} | ${ev.titulo} |\n`
            })
            texto += `---\n`
          }
        }

        // ── RODAPÉ ───────────────────────────────────────────────
        texto += `📋 **RESUMO DAS FONTES:**\n`
        const fontes: string[] = []
        if (gastos3m?.length > 0 || receitas3m?.length > 0) fontes.push(`${gastos3m?.length || 0} gastos e ${receitas3m?.length || 0} receitas (3 meses)`)
        if ((alertasRec || []).length > 0) fontes.push(`${(alertasRec || []).length} contas fixas`)
        if ((receitasRec || []).length > 0) fontes.push(`${(receitasRec || []).length} receitas recorrentes`)
        if (parcelasAtivas.length > 0) fontes.push(`${parcelasAtivas.length} financiamentos`)
        if (investimentosAtivos.length > 0) fontes.push(`${investimentosAtivos.length} investimentos parcelados`)
        if (cartoesDetalhe.length > 0) fontes.push(`${cartoesDetalhe.length} cartões`)
        if (ativosLista.length > 0) fontes.push(`${ativosLista.length} investimentos`)

        if (fontes.length === 0) {
          texto += `⚠️ _Sem dados suficientes. Lance suas receitas, gastos e contas fixas para projeções mais precisas._`
        } else {
          texto += fontes.map(f => `- ${f}`).join('\n')
          texto += `\n\n_📈 Projeção baseada em dados reais do sistema. Para melhor precisão, mantenha seus lançamentos em dia!_`
        }

        setMensagens(prev => [...prev, { id: `proj-${Date.now()}`, role: 'ai' as const, texto }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── GERAR DASHBOARD (alias do relatório) ─────────────────
      } else if (acao.tipo === 'gerar_dashboard') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const dados = await buscarDadosRelatorio(supabase, uid, 'mes_atual')
        setRelatorioData(dados)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── GERAR CHECKLIST ──────────────────────────────────────
      } else if (acao.tipo === 'gerar_checklist') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const agora2 = new Date()
        const hoje2 = agora2.toISOString().split('T')[0]
        const amanha2 = new Date(agora2)
        amanha2.setDate(amanha2.getDate() + 1)
        const amanha2Str = amanha2.toISOString().split('T')[0]
        // Eventos de hoje e amanhã
        const { data: eventosHoje } = await (supabase.from('agenda_eventos') as any)
          .select('titulo, data_inicio, tipo')
          .eq('user_id', uid)
          .neq('status', 'cancelado')
          .neq('status', 'concluido')
          .gte('data_inicio', `${hoje2}T00:00:00`)
          .lte('data_inicio', `${amanha2Str}T23:59:59`)
          .order('data_inicio')
        // Vencimentos próximos (7 dias) — agenda + cartões + alertas
        const em7d = new Date(agora2.getTime() + 7 * 24 * 60 * 60 * 1000)
        const [
          { data: venc7d },
          { data: cartoesPfChk },
          { data: alertasRecChk },
        ] = await Promise.all([
          (supabase.from('agenda_eventos') as any)
            .select('titulo, data_inicio')
            .eq('user_id', uid)
            .eq('tipo', 'vencimento')
            .neq('status', 'cancelado')
            .neq('status', 'concluido')
            .gte('data_inicio', agora2.toISOString())
            .lte('data_inicio', em7d.toISOString())
            .order('data_inicio'),
          (supabase.from('contas') as any)
            .select('nome, dia_vencimento, bandeira')
            .eq('user_id', uid).eq('ativo', true)
            .in('tipo', ['cartao_credito', 'cartao_debito'])
            .not('dia_vencimento', 'is', null),
          (supabase.from('compromissos_fixos') as any)
            .select('descricao, dia_vencimento, valor, tipo_detalhe')
            .eq('user_id', uid).eq('ativo', true)
            .eq('recorrente', true),
        ])

        // Mesclar cartões e alertas que vencem nos próximos 7 dias
        const diaHojeChk = agora2.getDate()
        const mesAtualChk = agora2.getMonth()
        const anoAtualChk = agora2.getFullYear()
        const titulosAgendaChk: string[] = 
          (venc7d || []).map((ev: any) => (ev.titulo || '').toLowerCase().replace(/[💳📄🚰💡📡📱🏠🏢💊🏦📋⚡]/g, '').trim())


        const extraVencChk: any[] = []
        ;(cartoesPfChk || []).forEach((c: any) => {
          const dia = c.dia_vencimento
          if (!dia) return
          const dataVenc = new Date(anoAtualChk, mesAtualChk, dia)
          if (dataVenc < agora2) dataVenc.setMonth(dataVenc.getMonth() + 1)
          if (dataVenc >= agora2 && dataVenc <= em7d) {
            const nomeNorm = (c.nome || '').toLowerCase()
            if (!titulosAgendaChk.some(t => t.includes(nomeNorm) || nomeNorm.includes(t))) {
              extraVencChk.push({ titulo: `💳 Fatura ${c.nome}${c.bandeira ? ` (${c.bandeira})` : ''}`, data_inicio: dataVenc.toISOString() })
            }
          }
        })
        ;(alertasRecChk || []).forEach((a: any) => {
          const dia = a.dia_vencimento
          if (!dia) return
          const dataVenc = new Date(anoAtualChk, mesAtualChk, dia)
          if (dataVenc < agora2) dataVenc.setMonth(dataVenc.getMonth() + 1)
          if (dataVenc >= agora2 && dataVenc <= em7d) {
            const descNorm = (a.descricao || '').toLowerCase()
            if (!titulosAgendaChk.some(t => t.includes(descNorm) || descNorm.includes(t))) {
              const emojiMap: Record<string, string> = {
                agua: '🚰', energia: '💡', internet: '📡', telefone: '📱',
                aluguel: '🏠', condominio: '🏢', plano_saude: '💊',
                financiamento: '🏦', boleto: '📄', cartao: '💳', outro: '📋',
              }
              const emoji = emojiMap[a.tipo_detalhe] || '📋'
              const valorStr = a.valor ? ` — R$ ${Number(a.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
              extraVencChk.push({ titulo: `${emoji} ${a.descricao}${valorStr}`, data_inicio: dataVenc.toISOString() })
            }
          }
        })

        const todosVencChk = [...(venc7d || []), ...extraVencChk]
          .sort((a: any, b: any) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())
        const venc7dReais = todosVencChk.filter((ev: any) => {
          const t = (ev.titulo || '').toLowerCase()
          return !t.includes('confirmação') && !t.includes('pagou') && !t.startsWith('✅')
        })
        let chk = `✅ **CHECKLIST EXECUTIVO — ${agora2.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()}**\n\n`
        if (eventosHoje && eventosHoje.length > 0) {
          chk += `📅 **Hoje e amanhã:**\n`
          eventosHoje.forEach((ev: any) => {
            const dt = new Date(ev.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            chk += `  ☐ ${dt}h — ${ev.titulo}\n`
          })
          chk += '\n'
        } else {
          chk += `📅 **Hoje:** Nenhum compromisso agendado.\n\n`
        }
        if (venc7dReais.length > 0) {
          chk += `⚠️ **Vencimentos nos próximos 7 dias:**\n`
          venc7dReais.forEach((ev: any) => {
            const dt = new Date(ev.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            chk += `  ☐ [${dt}] ${ev.titulo}\n`
          })
        }
        setMensagens(prev => [...prev, { id: `chk-${Date.now()}`, role: 'ai' as const, texto: chk }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── BACKUP CHAT ──────────────────────────────────────────
      } else if (acao.tipo === 'backup_chat') {
        const textoBackup = mensagensRef.current
          .filter(m => m.texto && m.texto !== '...')
          .map(m => {
            const data = m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
            return `[${data}] ${m.role === 'ai' ? 'Elena' : 'Sr. Max'}:\n${m.texto}`
          })
          .join('\n\n----------------------------------------\n\n')
        const blob = new Blob([textoBackup], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `elena-chat-${new Date().toISOString().split('T')[0]}.txt`
        a.click()
        URL.revokeObjectURL(url)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── ALERTAR RECORRENTE (cadastra conta fixa + cria eventos imediatos) ─
      } else if (acao.tipo === 'alertar_recorrente') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const tiposValidos = ['boleto','cartao','agua','energia','internet','telefone','aluguel','condominio','plano_saude','financiamento','outro']
        const tipo = tiposValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'boleto'
        // 🔴 FIX: a IA pode mandar dia 45, 0, ou NaN. Sem clamp, vira data
        // inválida no banco e o alerta nunca dispara.
        const diaBruto = Number(acao.dados.dia_vencimento)
        if (!Number.isFinite(diaBruto) || diaBruto < 1 || diaBruto > 31) {
          throw new Error(`Dia de vencimento inválido: "${acao.dados.dia_vencimento}". Precisa ser entre 1 e 31.`)
        }
        const dia = Math.round(diaBruto)
        if (!dia || dia < 1 || dia > 31) throw new Error('Dia de vencimento inválido (1–31).')
        if (!acao.dados.descricao) throw new Error('Descrição da conta é obrigatória.')

        const emojiMap: Record<string, string> = {
          agua: '🚰', energia: '💡', internet: '📡', telefone: '📱',
          aluguel: '🏠', condominio: '🏢', plano_saude: '💊',
          financiamento: '🏦', boleto: '📄', cartao: '💳', outro: '📋',
        }
        const emoji = emojiMap[tipo] || '📋'
        const valorNum = acao.dados.valor ? Number(acao.dados.valor) : null
        const valorStr = valorNum ? ` — R$ ${valorNum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
        const tituloEvento = `${emoji} Pagar ${acao.dados.descricao}${valorStr}`

        // Mapeia tipo → categoria de compromissos_fixos
        const categoriaMap: Record<string, string> = {
          cartao: 'cartao', financiamento: 'boleto_imovel', aluguel: 'boleto_imovel', condominio: 'boleto_imovel',
          agua: 'conta_fixa', energia: 'conta_fixa', internet: 'conta_fixa', telefone: 'conta_fixa', plano_saude: 'conta_fixa',
          boleto: 'outro', outro: 'outro',
        }

        // 1. Salva na tabela compromissos_fixos (tabela unificada)
        // 🔴 FIX: era `.insert()` CEGO — mesmo padrão do bug que criou 30
        // cartões. Dizer "aluguel dia 10" duas vezes criava DOIS compromissos,
        // e o Sr. Max recebia alerta em dobro todo mês.
        const { data: recJaExiste } = await (supabase.from('compromissos_fixos') as any)
          .select('id, valor, dia_vencimento')
          .eq('user_id', uid)
          .eq('ativo', true)
          .ilike('descricao', acao.dados.descricao)
          .maybeSingle()

        if (recJaExiste) {
          const { error: upRecErr } = await (supabase.from('compromissos_fixos') as any)
            .update({ valor: valorNum || recJaExiste.valor, dia_vencimento: dia })
            .eq('id', recJaExiste.id)
          if (upRecErr) throw new Error(upRecErr.message)

          setAcaoStatus(msgId, acaoIdx, 'saved')
          setMensagens(prev => [...prev, {
            id: `rec-dup-${Date.now()}`, role: 'ai' as const,
            texto: `ℹ️ **${acao.dados.descricao}** já estava cadastrado como recorrente — atualizei o valor e o dia (${dia}) em vez de criar outro.`,
          }])
          window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))
          return
        }

        const { data: novoRec, error: errRec } = await (supabase.from('compromissos_fixos') as any).insert({
          user_id:          uid,
          descricao:        acao.dados.descricao,
          valor:            valorNum || 0,
          dia_vencimento:   dia,
          categoria:        categoriaMap[tipo] || 'outro',
          tipo_detalhe:     tipo,
          recorrente:       true,
          ativo:            true,
          criado_pela_elena: true,
        }).select('id').single()

        if (errRec) throw new Error(errRec.message)

        // 2. Cria IMEDIATAMENTE os eventos na agenda (mês atual + próximos 5 meses = 6 meses)
        const agora = new Date()
        let eventosImedatos = 0

        for (let mOffset = 0; mOffset <= 5; mOffset++) {
          const dataAlvo = new Date(agora)
          dataAlvo.setDate(1)
          dataAlvo.setMonth(agora.getMonth() + mOffset)

          // Ajusta se o dia não existe no mês (ex: dia 31 em fevereiro)
          const ultimoDia = new Date(dataAlvo.getFullYear(), dataAlvo.getMonth() + 1, 0).getDate()
          const diaReal = Math.min(dia, ultimoDia)
          dataAlvo.setDate(diaReal)

          // Não cria eventos no passado
          if (dataAlvo < agora && dataAlvo.toDateString() !== agora.toDateString()) continue

          const anoMes = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, '0')}`
          const diaStr = String(diaReal).padStart(2, '0')
          const chaveUnica = `AUTO_REC_${novoRec?.id}_${anoMes}`

          // Verifica deduplicação
          const { data: jaExiste } = await (supabase.from('agenda_eventos') as any)
            .select('id')
            .eq('user_id', uid)
            .like('descricao', `%${chaveUnica}%`)
            .maybeSingle()

          if (jaExiste) continue

          // Cria evento manhã (dispara alerta)
          await (supabase.from('agenda_eventos') as any).insert({
            user_id:     uid,
            titulo:      tituloEvento,
            descricao:   `[${chaveUnica}] Gerado automaticamente`,
            data_inicio:  `${anoMes}-${diaStr}T09:00:00`,
            tipo:        'vencimento',
            status:      'pendente',
          })

          // Cria confirmação noturna
          await (supabase.from('agenda_eventos') as any).insert({
            user_id:     uid,
            titulo:      `✅ Verificar: ${acao.dados.descricao}${valorStr}`,
            descricao:   `[${chaveUnica}_CONF] Verificação noturna`,
            data_inicio:  `${anoMes}-${diaStr}T20:00:00`,
            tipo:        'lembrete',
            status:      'pendente',
          })

          eventosImedatos++
        }

        setAcaoStatus(msgId, acaoIdx, 'saved')
        setMensagens(prev => [...prev, {
          id: `rec-${Date.now()}`, role: 'ai' as const,
          texto: `${emoji} **${acao.dados.descricao}** cadastrada como recorrente!\n📅 Todo dia **${dia}** de cada mês o sistema criará o alerta automaticamente${valorStr}.\n${eventosImedatos > 0 ? `\n✅ Já criei **${eventosImedatos}** evento(s) na agenda para este e o próximo mês!` : ''}\n\n_Pode verificar na aba Agenda, Sr. Max!_ 📋`,
        }])
        window.dispatchEvent(new CustomEvent('elena:agenda-updated'))
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))


      // ── LISTAR RECORRENTES (mostra contas fixas cadastradas) ──
      } else if (acao.tipo === 'listar_recorrentes') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const { data: recs, error } = await (supabase.from('compromissos_fixos') as any)
          .select('descricao, valor, dia_vencimento, tipo_detalhe, ativo, recorrente')
          .eq('user_id', uid)
          .eq('recorrente', true)
          .order('dia_vencimento', { ascending: true })

        if (error) throw new Error(error.message)

        if (!recs || recs.length === 0) {
          setMensagens(prev => [...prev, {
            id: `rec-${Date.now()}`, role: 'ai' as const,
            texto: '📋 Nenhuma conta recorrente cadastrada ainda, Sr. Max.\n\nDiga-me, por exemplo: _"cadastrar internet Vivo R$ 120 todo dia 5"_ e eu cuido dos alertas automaticamente!',
          }])
        } else {
          const ativas = recs.filter((r: any) => r.ativo)
          const inativas = recs.filter((r: any) => !r.ativo)
          const emojiMap: Record<string, string> = {
            agua: '🚰', energia: '💡', internet: '📡', telefone: '📱',
            aluguel: '🏠', condominio: '🏢', plano_saude: '💊',
            financiamento: '🏦', boleto: '📄', cartao: '💳', outro: '📋',
          }
          let texto = `📋 **Suas contas recorrentes cadastradas:**\n\n`
          ativas.forEach((r: any) => {
            const emoji = emojiMap[r.tipo_detalhe] || '📋'
            const valor = r.valor ? ` — R$ ${Number(r.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
            texto += `${emoji} **${r.descricao}**${valor} — todo dia ${r.dia_vencimento}\n`
          })
          if (inativas.length > 0) texto += `\n_${inativas.length} conta(s) inativa(s) não listada(s)._`
          texto += `\n\n_Total: ${ativas.length} conta(s) ativa(s). O sistema gera alertas automaticamente todo mês!_ ✅`
          setMensagens(prev => [...prev, { id: `rec-${Date.now()}`, role: 'ai' as const, texto }])
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── CONCLUIR EVENTO (marcar como pago/feito) ─────────────
      } else if (acao.tipo === 'concluir_evento') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const busca = acao.dados.titulo_busca
        if (!busca) throw new Error('Informe o nome do evento para marcar como concluído.')

        // Busca evento pendente mais recente que contenha o trecho
        const { data: eventos } = await (supabase.from('agenda_eventos') as any)
          .select('id, titulo, data_inicio, tipo')
          .eq('user_id', uid)
          .eq('status', 'pendente')
          .ilike('titulo', `%${busca}%`)
          .order('data_inicio', { ascending: false })
          .limit(5)

        if (!eventos || eventos.length === 0) {
          throw new Error(`Nenhum evento pendente encontrado com "${busca}". Verifique o nome.`)
        }

        // Marca o mais recente como concluído
        const evento = eventos[0]
        const { error } = await (supabase.from('agenda_eventos') as any)
          .update({ status: 'concluido' })
          .eq('id', evento.id)

        if (error) throw new Error(error.message)

        // Se for vencimento, marca também o lembrete de confirmação do mesmo dia
        if (evento.tipo === 'vencimento') {
          const diaEvento = String(evento.data_inicio).substring(0, 10)
          await (supabase.from('agenda_eventos') as any)
            .update({ status: 'concluido' })
            .eq('user_id', uid)
            .eq('status', 'pendente')
            .eq('tipo', 'lembrete')
            .ilike('titulo', `%${busca}%`)
            .gte('data_inicio', `${diaEvento}T00:00:00`)
            .lte('data_inicio', `${diaEvento}T23:59:59`)
        }

        setAcaoStatus(msgId, acaoIdx, 'saved')
        setMensagens(prev => [...prev, {
          id: `concl-${Date.now()}`, role: 'ai' as const,
          texto: `✅ **${evento.titulo}** marcado como concluído!${evento.tipo === 'vencimento' ? '\n💳 Lembrete de confirmação também baixado automaticamente.' : ''}\n\n_Pode conferir na aba Agenda, Sr. Max!_ 📋`,
        }])
        window.dispatchEvent(new CustomEvent('elena:agenda-updated'))

      // ── REAGENDAR EVENTO ──────────────────────────────────────
      } else if (acao.tipo === 'reagendar_evento') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const busca = acao.dados.titulo_busca
        const novaData = acao.dados.nova_data
        if (!busca) throw new Error('Informe o nome do evento para reagendar.')
        if (!novaData) throw new Error('Informe a nova data/horário.')

        // Busca evento pendente
        const { data: eventos } = await (supabase.from('agenda_eventos') as any)
          .select('id, titulo, data_inicio')
          .eq('user_id', uid)
          .eq('status', 'pendente')
          .ilike('titulo', `%${busca}%`)
          .order('data_inicio', { ascending: true })
          .limit(5)

        if (!eventos || eventos.length === 0) {
          throw new Error(`Nenhum evento pendente encontrado com "${busca}".`)
        }

        const evento = eventos[0]

        // Aplica timezone local
        const tzOffset = (() => {
          const off = new Date().getTimezoneOffset()
          const sign = off <= 0 ? '+' : '-'
          const h = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
          const m = String(Math.abs(off) % 60).padStart(2, '0')
          return `${sign}${h}:${m}`
        })()
        const strNovaData = String(novaData).includes('T')
          ? `${String(novaData).replace(/Z$/, '').replace(/[+-]\d{2}:\d{2}$/, '')}${tzOffset}`
          : `${novaData}T12:00:00${tzOffset}`

        const { error } = await (supabase.from('agenda_eventos') as any)
          .update({ data_inicio: strNovaData })
          .eq('id', evento.id)

        if (error) throw new Error(error.message)

        const dtAnterior = new Date(evento.data_inicio).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        const dtNova = new Date(strNovaData).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

        setAcaoStatus(msgId, acaoIdx, 'saved')
        setMensagens(prev => [...prev, {
          id: `reag-${Date.now()}`, role: 'ai' as const,
          texto: `📅 **${evento.titulo}** reagendado!\n• De: ${dtAnterior}\n• Para: ${dtNova}\n\n_Pode conferir na aba Agenda, Sr. Max!_ 📋`,
        }])
        window.dispatchEvent(new CustomEvent('elena:agenda-updated'))

      // ── FATURA CARTÃO ────────────────────────────────────────

      } else if (acao.tipo === 'fatura_cartao') {
        const valor = Number(acao.dados.valor) || 0
        const mesRef = acao.dados.mes_referencia || new Date().toISOString().substring(0, 7)
        const cartaoPf = await resolverCartaoPf(acao.dados.conta_nome)
        if (!cartaoPf.id) throw new Error('Cartão não encontrado. Certifique-se de que o cartão existe na aba Cartões.')
        
        const { error } = await (supabase.from('faturas_cartoes') as any).upsert({
          user_id: uid,
          conta_id: cartaoPf.id,
          valor_fechado: valor,
          mes_referencia: mesRef,
          notas: acao.dados.notas || 'Registrado pela Elena',
        }, { onConflict: 'conta_id,mes_referencia' })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('fatura_cartao', acao.dados, cartaoPf.nome)

      // ── CADASTRAR CONTA ──────────────────────────────────────
      } else if (acao.tipo === 'cadastrar_conta') {
        const categoria = acao.dados.categoria === 'pj' ? 'pj' : 'pf'
        // ⛔ NUNCA aceita cartao_credito ou cartao_debito aqui — deve usar cadastrar_cartao
        const tiposContaValidos = ['corrente','poupanca','investimento','carteira','digital','outro']
        let tipoConta = tiposContaValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'corrente'
        // Redireciona automaticamente se enviou tipo de cartão por engano
        if (acao.dados.tipo === 'cartao_credito' || acao.dados.tipo === 'cartao_debito') {
          tipoConta = 'corrente'
        }

        // Para contas PJ: inclui empresa_id (obrigatório pela RLS da migration 050)
        const payloadConta: Record<string, any> = {
          nome: acao.dados.nome || 'Conta via Elena',
          tipo: tipoConta,
          categoria,
          saldo_inicial: Number(acao.dados.saldo_inicial) || 0,
          saldo_atual: Number(acao.dados.saldo_inicial) || 0,
          ativo: true,
          user_id: uid,
        }
        if (categoria === 'pj') {
          const empresaId = await getEmpresaId(uid)
          if (empresaId) payloadConta.empresa_id = empresaId
        }

        // 🔴 FIX: era `.insert()` cego → criava conta duplicada toda vez.
        const { id: contaId, nome: contaNomeFinal, jaExistia } = await upsertConta(supabase, uid, payloadConta)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('cadastrar_conta', acao.dados, contaNomeFinal, contaId, 'contas')
        if (jaExistia) {
          setMensagens(prev => [...prev, {
            id: `conta-dup-${Date.now()}`, role: 'ai' as const,
            texto: `ℹ️ A conta **${contaNomeFinal}** já estava cadastrada — atualizei os dados em vez de criar outra.`,
          }])
        }
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── CADASTRAR CARTÃO ─────────────────────────────────────
      } else if (acao.tipo === 'cadastrar_cartao') {
        const categoria = acao.dados.categoria === 'pj' ? 'pj' : 'pf'
        const bandeirasValidas = ['visa','mastercard','elo','hipercard','amex']
        // Detecta bandeira pelo nome se não informada explicitamente
        const nomeLower = (acao.dados.nome || '').toLowerCase()
        const bandeiraNome = acao.dados.bandeira?.toLowerCase()
        const bandeira = bandeirasValidas.includes(bandeiraNome)
          ? bandeiraNome
          : (Object.entries(BANDEIRAS_MAP).find(([k]) => nomeLower.includes(k))?.[1] || null)

        // Para cartões PJ: inclui empresa_id (obrigatório pela RLS da migration 050)
        const payloadCartao: Record<string, any> = {
          nome: acao.dados.nome || 'Cartão via Elena',
          tipo: 'cartao_credito',
          categoria,
          bandeira: bandeira || null,
          saldo_inicial: 0,
          saldo_atual: 0,
          ativo: true,
          user_id: uid,
        }
        if (acao.dados.limite)          payloadCartao.limite = Number(acao.dados.limite)
        if (acao.dados.dia_fechamento) payloadCartao.dia_fechamento = clampDia(acao.dados.dia_fechamento, 'fechamento')
        if (acao.dados.dia_vencimento) payloadCartao.dia_vencimento = clampDia(acao.dados.dia_vencimento, 'vencimento')
        if (categoria === 'pj') {
          const empresaId = await getEmpresaId(uid)
          if (empresaId) payloadCartao.empresa_id = empresaId
        }

        // 🔴 FIX: era `.insert()` cego → é ISTO que criou ~30 "Nubank"
        // duplicados, vários com dia_vencimento NULL, fazendo a Elena
        // reperguntar a data que o Sr. Max já tinha informado.
        const { id: cartaoId, nome: cartaoNomeFinal, jaExistia } = await upsertConta(supabase, uid, payloadCartao)
        const novoCartao = { id: cartaoId, nome: cartaoNomeFinal }

        // ── Auto-gera alertas e agenda se dia_vencimento foi informado ──
        const diaVenc = acao.dados.dia_vencimento ? clampDia(acao.dados.dia_vencimento, 'vencimento') : null
        let agendaMsg = ''
        if (diaVenc && diaVenc >= 1 && diaVenc <= 31) {
          const nomeCartao = acao.dados.nome || 'Cartão'
          const tituloEvento = `💳 Pagar ${nomeCartao}`
          const agora2 = new Date()
          let eventosCartao = 0

          // Cria compromisso fixo recorrente para o cartão
          // 🔴 FIX: os eventos de agenda já tinham dedup (chave AUTO_CARTAO_*),
          // mas o compromisso fixo NÃO — recadastrar o mesmo cartão criava um
          // compromisso novo toda vez. Agora checamos antes.
          try {
            const { data: compJaExiste } = await (supabase.from('compromissos_fixos') as any)
              .select('id')
              .eq('user_id', uid)
              .eq('conta_id', novoCartao?.id || '')
              .eq('categoria', 'cartao')
              .maybeSingle()

            if (compJaExiste) {
              // Já existe: só atualiza o dia de vencimento, se mudou
              const { error: cErr } = await (supabase.from('compromissos_fixos') as any)
                .update({ dia_vencimento: diaVenc, ativo: true })
                .eq('id', compJaExiste.id)
              if (cErr) console.warn('[Elena] compromisso do cartão não atualizou:', cErr.message)
            } else {
              const { error: cErr } = await (supabase.from('compromissos_fixos') as any).insert({
                user_id: uid,
                descricao: nomeCartao,
                valor: 0,
                dia_vencimento: diaVenc,
                categoria: 'cartao',
                tipo_detalhe: 'cartao',
                recorrente: true,
                ativo: true,
                conta_id: novoCartao?.id || null,
                criado_pela_elena: true,
              })
              if (cErr) console.warn('[Elena] compromisso do cartão não foi criado:', cErr.message)
            }
          } catch (e: any) {
            console.warn('[Elena] erro no compromisso do cartão:', e?.message || e)
          }

          // Cria eventos diretamente na agenda_eventos (não depende da migration)
          for (let mOffset = 0; mOffset <= 1; mOffset++) {
            const dataAlvo = new Date(agora2)
            dataAlvo.setDate(1)
            dataAlvo.setMonth(agora2.getMonth() + mOffset)
            const ultimoDia2 = new Date(dataAlvo.getFullYear(), dataAlvo.getMonth() + 1, 0).getDate()
            const diaReal2 = Math.min(diaVenc, ultimoDia2)
            dataAlvo.setDate(diaReal2)

            // Não cria no passado
            if (dataAlvo < agora2 && dataAlvo.toDateString() !== agora2.toDateString()) continue

            const anoMes2 = `${dataAlvo.getFullYear()}-${String(dataAlvo.getMonth() + 1).padStart(2, '0')}`
            const diaStr2 = String(diaReal2).padStart(2, '0')
            const chave2 = `AUTO_CARTAO_${novoCartao?.id}_${anoMes2}`

            const { data: jaExiste2 } = await (supabase.from('agenda_eventos') as any)
              .select('id').eq('user_id', uid).like('descricao', `%${chave2}%`).maybeSingle()
            if (jaExiste2) continue

            await (supabase.from('agenda_eventos') as any).insert({
              user_id: uid, titulo: tituloEvento,
              descricao: `[${chave2}] Gerado ao cadastrar cartão`,
              data_inicio: `${anoMes2}-${diaStr2}T09:00:00`,
              tipo: 'vencimento', status: 'pendente',
            })
            await (supabase.from('agenda_eventos') as any).insert({
              user_id: uid, titulo: `✅ Verificar: Pagou o ${nomeCartao}?`,
              descricao: `[${chave2}_CONF] Verificação noturna`,
              data_inicio: `${anoMes2}-${diaStr2}T20:00:00`,
              tipo: 'lembrete', status: 'pendente',
            })
            eventosCartao++
          }

          if (eventosCartao > 0) {
            agendaMsg = `\n✅ Criei **${eventosCartao * 2}** alertas na agenda para o vencimento dia **${diaVenc}**!`
            window.dispatchEvent(new CustomEvent('elena:agenda-updated'))
          }
        }

        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('cadastrar_cartao', acao.dados, cartaoNomeFinal, cartaoId, 'contas')
        if (jaExistia) {
          setMensagens(prev => [...prev, {
            id: `cartao-dup-${Date.now()}`, role: 'ai' as const,
            texto: `ℹ️ O cartão **${cartaoNomeFinal}** já estava cadastrado — atualizei os dados em vez de criar outro.${agendaMsg}`,
          }])
        } else if (agendaMsg) {
          setMensagens(prev => [...prev, {
            id: `cartao-${Date.now()}`, role: 'ai' as const,
            texto: `💳 Cartão **${cartaoNomeFinal}** cadastrado na aba ${categoria === 'pj' ? 'Financeiro > Cartões PJ' : 'PF > Cartões'}!${agendaMsg}`,
          }])
        }
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))


      // ── REGISTRAR PATRIMÔNIO ──────────────────────────────────
      } else if (acao.tipo === 'registrar_patrimonio') {
        const tiposValidos = ['imovel', 'veiculo', 'equipamento', 'reforma', 'outro']
        const tipo = tiposValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'imovel'
        const vi = Number(acao.dados.valor_investido) || 0
        const vm = acao.dados.valor_mercado ? Number(acao.dados.valor_mercado) : null
        const roi = vm && vi > 0 ? ((vm - vi) / vi) * 100 : null
        const pt = acao.dados.parcelas_total ? Number(acao.dados.parcelas_total) : null
        const pp = acao.dados.parcelas_pagas ? Number(acao.dados.parcelas_pagas) : null

        const dataAq = acao.dados.data_aquisicao || null

        // Busca empresa_id para RLS
        const empresaId = await getEmpresaId(uid)

        let tabelaDestino = 'projetos_patrimonio'
        let insertId: string | undefined

        if (tipo === 'imovel') {
          tabelaDestino = 'imoveis'
          const payloadImovel: Record<string, any> = {
            titulo: acao.dados.titulo || 'Imóvel via Elena',
            valor_compra: vi,
            valor_mercado: vm,
            data_aquisicao: dataAq,
            parcelas_total: pt,
            parcelas_pagas: pp || 0,
            status: 'disponivel',
            // Campos adicionais de imóvel
            construtora: acao.dados.construtora || null,
            unidade: acao.dados.unidade || null,
            endereco: acao.dados.endereco || null,
          }
          if (empresaId) payloadImovel.empresa_id = empresaId
          const { data, error } = await (supabase.from('imoveis') as any).insert(payloadImovel).select('id').single()
          if (error) throw new Error(error.message)
          insertId = data?.id

        } else if (tipo === 'veiculo') {
          tabelaDestino = 'veiculos'
          const payloadVeiculo: Record<string, any> = {
            titulo: acao.dados.titulo || 'Veículo via Elena',
            valor_compra: vi,
            valor_mercado: vm,
            parcelas_total: pt,
            parcelas_pagas: pp || 0,
            status: 'ativo',
            // Campos adicionais de veículo
            marca: acao.dados.marca || null,
            modelo: acao.dados.modelo || null,
            ano_fabricacao: acao.dados.ano ? Number(acao.dados.ano) : null,
            ano_modelo: acao.dados.ano_modelo ? Number(acao.dados.ano_modelo) : (acao.dados.ano ? Number(acao.dados.ano) : null),
            placa: acao.dados.placa || null,
            cor: acao.dados.cor || null,
            combustivel: acao.dados.combustivel || 'flex',
            km_atual: acao.dados.km ? Number(acao.dados.km) : null,
          }
          if (empresaId) payloadVeiculo.empresa_id = empresaId
          const { data, error } = await (supabase.from('veiculos') as any).insert(payloadVeiculo).select('id').single()
          if (error) throw new Error(error.message)
          insertId = data?.id

        } else {
          tabelaDestino = 'projetos_patrimonio'
          const payloadProj: Record<string, any> = {
            titulo: acao.dados.titulo || 'Patrimônio via Elena',
            tipo,
            descricao: acao.dados.descricao || null,
            valor_investido_total: vi,
            valor_mercado_atual: vm,
            roi_percentual: roi,
            data_aquisicao: dataAq,
            status: 'ativo',
            parcelas_total: pt,
            parcelas_pagas: pp,
          }
          if (empresaId) payloadProj.empresa_id = empresaId
          const { data, error } = await (supabase.from('projetos_patrimonio') as any).insert(payloadProj).select('id').single()
          if (error) throw new Error(error.message)
          insertId = data?.id
        }

        if (insertId) ultimoRegistroRef.current = { tabela: tabelaDestino, id: insertId }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('registrar_patrimonio', acao.dados, undefined, insertId, tabelaDestino)

      // ── BUSCAR PATRIMÔNIO ─────────────────────────────────────
      } else if (acao.tipo === 'buscar_patrimonio') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const empresaId = await getEmpresaId(uid)
        const filtroTipo = acao.dados.tipo && acao.dados.tipo !== 'todos' ? acao.dados.tipo : null

        // Busca projetos_patrimonio
        let queryProj = (supabase.from('projetos_patrimonio') as any)
          .select('titulo, tipo, descricao, valor_investido_total, valor_mercado_atual, data_aquisicao, status, parcelas_total, parcelas_pagas')
          .order('valor_investido_total', { ascending: false })
        if (empresaId) queryProj = queryProj.eq('empresa_id', empresaId)
        if (filtroTipo) queryProj = queryProj.eq('tipo', filtroTipo)
        const { data: projetos } = await queryProj

        // Busca tabela imoveis (se não filtrando por veiculo/equipamento)
        let imoveisLista: any[] = []
        if (!filtroTipo || filtroTipo === 'imovel') {
          let queryIm = (supabase.from('imoveis') as any)
            .select('titulo, valor_compra, valor_mercado, data_aquisicao, parcelas_total, parcelas_pagas, construtora, unidade')
            .order('valor_compra', { ascending: false })
          if (empresaId) queryIm = queryIm.eq('empresa_id', empresaId)
          const { data: ims } = await queryIm
          imoveisLista = (ims || []).map((im: any) => ({
            titulo: im.titulo, tipo: 'imovel',
            descricao: [im.construtora, im.unidade].filter(Boolean).join(' · ') || null,
            valor_investido_total: im.valor_compra || 0,
            valor_mercado_atual: im.valor_mercado || null,
            parcelas_total: im.parcelas_total, parcelas_pagas: im.parcelas_pagas,
          }))
        }

        // Busca tabela veiculos (se não filtrando por imovel/equipamento)
        let veiculosLista: any[] = []
        if (!filtroTipo || filtroTipo === 'veiculo') {
          let queryVe = (supabase.from('veiculos') as any)
            .select('titulo, marca, modelo, ano_modelo, placa, valor_compra, valor_mercado, parcelas_total, parcelas_pagas')
            .order('valor_compra', { ascending: false })
          if (empresaId) queryVe = queryVe.eq('empresa_id', empresaId)
          const { data: veics } = await queryVe
          veiculosLista = (veics || []).map((ve: any) => ({
            titulo: ve.titulo, tipo: 'veiculo',
            descricao: [ve.marca, ve.modelo, ve.ano_modelo, ve.placa].filter(Boolean).join(' · ') || null,
            valor_investido_total: ve.valor_compra || 0,
            valor_mercado_atual: ve.valor_mercado || null,
            parcelas_total: ve.parcelas_total, parcelas_pagas: ve.parcelas_pagas,
          }))
        }

        const todos = [...(projetos || []), ...imoveisLista, ...veiculosLista]
        const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        const tipoEmoji: Record<string, string> = { imovel: '🏠', veiculo: '🚗', equipamento: '⚙️', reforma: '🔨', outro: '📦' }

        if (todos.length === 0) {
          setMensagens(prev => [...prev, {
            id: `pat-${Date.now()}`, role: 'ai' as const,
            texto: '📋 Nenhum patrimônio cadastrado ainda, Sr. Max.\n\nDiga-me, por exemplo: _\"registrar apartamento no centro, paguei 350 mil\"_ e eu cuido do resto!',
          }])
        } else {
          const totalInvestido = todos.reduce((a: number, p: any) => a + (p.valor_investido_total || 0), 0)
          const totalMercado = todos.reduce((a: number, p: any) => a + (p.valor_mercado_atual || p.valor_investido_total || 0), 0)
          const valoriz = totalMercado - totalInvestido

          let texto = `🏠 **SEU PATRIMÔNIO${filtroTipo ? ` — ${filtroTipo.toUpperCase()}` : ''}**\n\n`
          texto += `💰 Total investido: **${fmt(totalInvestido)}**\n`
          texto += `📊 Valor de mercado: **${fmt(totalMercado)}**\n`
          texto += `${valoriz >= 0 ? '🟢' : '🔴'} Valorização: **${valoriz >= 0 ? '+' : ''}${fmt(valoriz)}**\n\n`
          texto += `---\n\n`

          todos.forEach((p: any) => {
            const emoji = tipoEmoji[p.tipo] || '📦'
            const vm = p.valor_mercado_atual || p.valor_investido_total
            const roi = p.valor_investido_total > 0 ? ((vm - p.valor_investido_total) / p.valor_investido_total * 100).toFixed(1) : '0'
            texto += `${emoji} **${p.titulo}**\n`
            texto += `   Investido: ${fmt(p.valor_investido_total)} · Mercado: ${fmt(vm)} · ROI: ${Number(roi) >= 0 ? '+' : ''}${roi}%\n`
            if (p.parcelas_total) {
              const pagas = p.parcelas_pagas || 0
              texto += `   📅 Parcelas: ${pagas}/${p.parcelas_total} (${Math.round(pagas / p.parcelas_total * 100)}%)\n`
            }
            texto += '\n'
          })

          texto += `_Total: ${todos.length} bem(ns) cadastrado(s). Veja mais detalhes em Patrimônio._`
          setMensagens(prev => [...prev, { id: `pat-${Date.now()}`, role: 'ai' as const, texto }])
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')


      // ── DIÁRIO PESSOAL ────────────────────────────────────────
      } else if (acao.tipo === 'diario') {
        const tiposValidos = ['diario', 'decisao', 'snapshot', 'marco', 'espiritual']
        const catsValidas = ['geral', 'decisao', 'aprendizado', 'patrimonio', 'financeiro_pf', 'financeiro_pj', 'trading', 'mercado', 'projeto', 'ideia', 'reserva', 'meta']
        const humoresValidos = ['otimo', 'bom', 'neutro', 'ruim', 'critico']

        const tipo = tiposValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'diario'
        const categoria = catsValidas.includes(acao.dados.categoria) ? acao.dados.categoria : 'geral'
        const humor = humoresValidos.includes(acao.dados.humor) ? acao.dados.humor : 'neutro'

        const empresaId = await getEmpresaId(uid)

        const payload: Record<string, any> = {
          titulo: acao.dados.titulo || null,
          texto: acao.dados.texto || acao.dados.conteudo || 'Entrada via Elena',
          tipo,
          categoria,
          humor,
          fixada: acao.dados.fixada ?? false,
          gratidao: acao.dados.gratidao || null,
          intencao: acao.dados.intencao || null,
        }
        if (empresaId) payload.empresa_id = empresaId

        const { data: novaEntrada, error } = await (supabase.from('diario_entradas') as any)
          .insert(payload).select('id').single()
        if (error) throw new Error(error.message)
        if (novaEntrada?.id) ultimoRegistroRef.current = { tabela: 'diario_entradas', id: novaEntrada.id }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('diario', acao.dados, undefined, novaEntrada?.id, 'diario_entradas')

      // ── BUSCAR DIÁRIO ─────────────────────────────────────────
      } else if (acao.tipo === 'buscar_diario') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const empresaId = await getEmpresaId(uid)
        const limite = Math.min(Number(acao.dados.limite) || 5, 15)

        let query = (supabase.from('diario_entradas') as any)
          .select('titulo, texto, tipo, categoria, humor, fixada, gratidao, intencao, created_at')
          .order('created_at', { ascending: false })
          .limit(limite)
        if (empresaId) query = query.eq('empresa_id', empresaId)
        if (acao.dados.tipo && acao.dados.tipo !== 'todos') query = query.eq('tipo', acao.dados.tipo)
        const { data: entradas } = await query

        const humorEmoji: Record<string, string> = { otimo: '😄', bom: '🙂', neutro: '😐', ruim: '😕', critico: '😰' }
        const tipoIcon: Record<string, string> = { diario: '📓', decisao: '⚡', snapshot: '📸', marco: '🏆', espiritual: '🙏' }

        if (!entradas || entradas.length === 0) {
          setMensagens(prev => [...prev, {
            id: `diario-${Date.now()}`, role: 'ai' as const,
            texto: '📓 Nenhuma entrada no diário ainda, Sr. Max.\n\nDiga-me algo como: _\"anotar no diário: hoje foi um dia produtivo\"_ e eu registro pra você!',
          }])
        } else {
          let texto = `📓 **DIÁRIO PESSOAL — Últimas ${entradas.length} entradas**\n\n`
          entradas.forEach((e: any) => {
            const dt = e.created_at ? new Date(e.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
            const emoji = humorEmoji[e.humor] || '📓'
            const icon = tipoIcon[e.tipo] || '📓'
            texto += `${icon} **${e.titulo || 'Sem título'}** ${emoji}\n`
            texto += `   _${dt}_ · ${e.categoria || 'geral'}\n`
            texto += `   ${(e.texto || '').substring(0, 120)}${(e.texto || '').length > 120 ? '...' : ''}\n`
            if (e.gratidao) texto += `   🙏 ${e.gratidao.substring(0, 80)}\n`
            texto += '\n'
          })
          texto += `_Veja todas as entradas em Diário Pessoal._`
          setMensagens(prev => [...prev, { id: `diario-${Date.now()}`, role: 'ai' as const, texto }])
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')


      // ── INVESTIMENTOS ─────────────────────────────────────────
      } else if (acao.tipo === 'registrar_investimento') {
        const tiposValidos = ['acao', 'fii', 'fundo', 'cdb', 'lci', 'lca', 'tesouro', 'cripto', 'poupanca', 'previdencia', 'outro']
        const tipo = tiposValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'outro'
        const qtd = Number(acao.dados.quantidade) || 1
        const pm = Number(acao.dados.preco_medio) || 0
        const pa = acao.dados.preco_atual ? Number(acao.dados.preco_atual) : null
        const vi = qtd * pm

        const empresaId = await getEmpresaId(uid)

        const payload: Record<string, any> = {
          ticker: acao.dados.ticker?.toUpperCase() || null,
          nome: acao.dados.nome || (acao.dados.ticker ? acao.dados.ticker.toUpperCase() : 'Investimento via Elena'),
          tipo,
          quantidade: qtd,
          preco_medio: pm,
          preco_atual: pa,
          valor_investido: vi,
          valor_atual: pa ? qtd * pa : null,
          liquidez: acao.dados.liquidez || 'diaria',
          risco_nivel: 3,
          corretora: acao.dados.corretora || null,
        }
        if (empresaId) payload.empresa_id = empresaId

        const { data: novoAtivo, error } = await (supabase.from('ativos') as any)
          .insert(payload).select('id').single()
        if (error) throw new Error(error.message)
        if (novoAtivo?.id) ultimoRegistroRef.current = { tabela: 'ativos', id: novoAtivo.id }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('registrar_investimento', acao.dados, undefined, novoAtivo?.id, 'ativos')

      } else if (acao.tipo === 'buscar_investimentos') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const empresaId = await getEmpresaId(uid)
        const filtroTipo = acao.dados.tipo && acao.dados.tipo !== 'todos' ? acao.dados.tipo : null

        let query = (supabase.from('ativos') as any)
          .select('ticker, nome, tipo, quantidade, preco_medio, valor_investido, valor_atual, corretora')
          .order('valor_investido', { ascending: false })
        if (empresaId) query = query.eq('empresa_id', empresaId)
        if (filtroTipo) query = query.eq('tipo', filtroTipo)
        const { data: ativos } = await query

        const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        const tipoColors: Record<string, string> = { acao: '🔵', fii: '🟢', fundo: '🟣', cdb: '🟠', tesouro: '🔴', cripto: '🟣', poupanca: '🟠' }

        if (!ativos || ativos.length === 0) {
          setMensagens(prev => [...prev, {
            id: `inv-${Date.now()}`, role: 'ai' as const,
            texto: '📈 Nenhum investimento cadastrado ainda, Sr. Max.\n\nDiga-me, por exemplo: _\"comprei 100 ações de PETR4 a 35 reais\"_ e eu adiciono à sua carteira!',
          }])
        } else {
          const totalInvestido = ativos.reduce((a: number, p: any) => a + (p.valor_investido || 0), 0)
          const totalMercado = ativos.reduce((a: number, p: any) => a + (p.valor_atual || p.valor_investido || 0), 0)
          const valoriz = totalMercado - totalInvestido
          const rentPct = totalInvestido > 0 ? (valoriz / totalInvestido) * 100 : 0

          let texto = `📈 **SUA CARTEIRA${filtroTipo ? ` — ${filtroTipo.toUpperCase()}` : ''}**\n\n`
          texto += `💰 Total investido: **${fmt(totalInvestido)}**\n`
          texto += `📊 Valor atual: **${fmt(totalMercado)}**\n`
          texto += `${valoriz >= 0 ? '🟢' : '🔴'} Resultado: **${valoriz >= 0 ? '+' : ''}${fmt(valoriz)} (${rentPct.toFixed(2)}%)**\n\n`
          texto += `---\n\n`

          ativos.forEach((a: any) => {
            const emoji = tipoColors[a.tipo] || '⚪'
            const va = a.valor_atual || a.valor_investido
            const res = va - a.valor_investido
            const rent = a.valor_investido > 0 ? (res / a.valor_investido) * 100 : 0
            texto += `${emoji} **${a.ticker || a.nome}**\n`
            texto += `   Investido: ${fmt(a.valor_investido)} · Atual: ${fmt(va)}\n`
            texto += `   ${res >= 0 ? '🟢 +' : '🔴 '}${rent.toFixed(2)}%\n`
            texto += '\n'
          })

          texto += `_Total: ${ativos.length} ativo(s)._`
          setMensagens(prev => [...prev, { id: `inv-${Date.now()}`, role: 'ai' as const, texto }])
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')


      // ── TRANSFERÊNCIA ────────────────────────────────────────

      } else if (acao.tipo === 'transferencia') {
        const valor = Number(acao.dados.valor) || 0
        const { id: origemId } = await resolverContaQualquer(acao.dados.conta_origem)
        const { id: destinoId } = await resolverContaQualquer(acao.dados.conta_destino)
        if (!origemId || !destinoId) throw new Error('Conta de origem ou destino não encontrada.')
        const dataT = hoje()
        const { error: e1 } = await (supabase.from('lancamentos') as any).insert({
          conta_id: origemId, descricao: acao.dados.descricao || 'Transferência via Elena',
          valor, tipo: 'despesa', regime: 'caixa', status: 'validado',
          data_competencia: dataT, data_caixa: dataT, categoria_id: CAT_DESPESA_ID, created_by: uid,
        })
        const { error: e2 } = await (supabase.from('lancamentos') as any).insert({
          conta_id: destinoId, descricao: acao.dados.descricao || 'Transferência via Elena',
          valor, tipo: 'receita', regime: 'caixa', status: 'validado',
          data_competencia: dataT, data_caixa: dataT, categoria_id: CAT_RECEITA_ID, created_by: uid,
        })
        if (e1 || e2) throw new Error('Erro ao registrar transferência.')
        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('transferencia', acao.dados)
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── CANCELAR ÚLTIMO ──────────────────────────────────────
      } else if (acao.tipo === 'cancelar') {
        if (!ultimoRegistroRef.current) throw new Error('Nenhum registro recente para cancelar.')
        const { tabela, id } = ultimoRegistroRef.current
        const { error } = await (supabase.from(tabela) as any).delete().eq('id', id)
        if (error) throw new Error(error.message)
        ultimoRegistroRef.current = null
        setAcaoStatus(msgId, acaoIdx, 'saved')
        setMensagens(prev => [...prev, { id: 'cancel-' + Date.now(), role: 'ai', texto: '↩️ Último registro cancelado com sucesso!' }])
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── DEFINIR META ─────────────────────────────────────────
      } else if (acao.tipo === 'definir_meta') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const categoria = acao.dados.categoria || 'geral'
        const valorLimite = Number(acao.dados.valor_limite) || 0

        // Verifica se já existe um limite para essa categoria
        const { data: existente } = await (supabase.from('limites_orcamento') as any)
          .select('id')
          .eq('user_id', uid)
          .eq('categoria', categoria)
          .eq('tipo', 'pf')
          .eq('ativo', true)
          .maybeSingle()

        if (existente?.id) {
          // Atualiza o limite existente
          await (supabase.from('limites_orcamento') as any)
            .update({ limite_mensal: valorLimite, updated_at: new Date().toISOString() })
            .eq('id', existente.id)
        } else {
          // Cria novo limite
          await (supabase.from('limites_orcamento') as any).insert({
            user_id: uid,
            nome: `Meta ${categoria}`,
            categoria,
            tipo: 'pf',
            limite_mensal: valorLimite,
            ativo: true,
          })
        }

        setAcaoStatus(msgId, acaoIdx, 'saved')
        exibirConfirmacaoSalvamento('definir_meta', acao.dados)

      // ── RELATÓRIO DE COLABORADORES ────────────────────────────
      } else if (acao.tipo === 'relatorio_colaboradores') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const { data: ocorrencias } = await (supabase.from('ocorrencias') as any)
          .select('tipo, impacto, colaborador_id, created_at, perfis!colaborador_id(nome)')
          .order('created_at', { ascending: false })
          .limit(100)

        if (!ocorrencias || ocorrencias.length === 0) {
          setMensagens(prev => [...prev, {
            id: `colab-${Date.now()}`, role: 'ai' as const,
            texto: '👥 Nenhuma ocorrência registrada para os colaboradores ainda, Sr. Max.',
          }])
        } else {
          // Agrupa por colaborador
          const porColab: Record<string, { nome: string; total: number; tipos: Record<string, number>; impactos: Record<string, number> }> = {}
          for (const oc of ocorrencias as any[]) {
            const nome = oc.perfis?.nome || 'Sem nome'
            const fid = oc.colaborador_id || 'unknown'
            if (!porColab[fid]) porColab[fid] = { nome, total: 0, tipos: {}, impactos: {} }
            porColab[fid].total++
            const tipo = oc.tipo || 'outro'
            porColab[fid].tipos[tipo] = (porColab[fid].tipos[tipo] || 0) + 1
            const imp = oc.impacto || 'baixo'
            porColab[fid].impactos[imp] = (porColab[fid].impactos[imp] || 0) + 1
          }

          const sorted = Object.values(porColab).sort((a, b) => b.total - a.total)
          let texto = `👥 **RELATÓRIO DE PERFORMANCE — EQUIPE**\n\n`
          texto += `_${ocorrencias.length} ocorrência(s) registrada(s)_\n\n`

          for (const c of sorted) {
            const impAlto = c.impactos['alto'] || 0
            const impMedio = c.impactos['medio'] || 0
            const icon = impAlto > 2 ? '🔴' : impAlto > 0 || impMedio > 2 ? '🟡' : '🟢'
            texto += `${icon} **${c.nome}** — ${c.total} ocorrência(s)\n`
            const tiposStr = Object.entries(c.tipos).map(([t, n]) => `${t}: ${n}`).join(', ')
            texto += `  📋 ${tiposStr}\n`
            if (impAlto > 0) texto += `  ⚠️ ${impAlto} de alto impacto\n`
            texto += '\n'
          }

          setMensagens(prev => [...prev, { id: `colab-${Date.now()}`, role: 'ai' as const, texto }])
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── REGISTRO LIVRE ───────────────────────────────────────
      } else if (acao.tipo === 'registro_livre') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const { chave, titulo, conteudo, tipo: tipoReg, dados: dadosReg, importante, tags } = acao.dados
        if (!titulo && !conteudo) { setAcaoStatus(msgId, acaoIdx, 'error', 'Sem conteúdo para salvar'); return }

        const payload: Record<string, any> = {
          user_id: uid, tipo: tipoReg || 'anotacao',
          titulo: titulo || conteudo?.substring(0, 80) || 'Registro',
          conteudo: conteudo || null,
          dados: dadosReg && Object.keys(dadosReg).length > 0 ? dadosReg : null,
          importante: importante === true || importante === 'true',
          tags: Array.isArray(tags) ? tags : [],
          atualizado_em: new Date().toISOString(),
        }
        if (chave) payload.chave = chave

        let salvo = false, isUpdate = false
        try {
          if (chave) {
            const { data: existing } = await (supabase.from('elena_registro') as any)
              .select('id').eq('user_id', uid).eq('chave', chave).maybeSingle()
            isUpdate = !!existing
            if (isUpdate && existing?.id) {
              // Update direto ao invés de upsert — evita constraint issue
              const { error } = await (supabase.from('elena_registro') as any)
                .update({ ...payload, user_id: undefined }).eq('id', existing.id)
              if (!error) salvo = true
              else console.error('[Elena][registro_livre] Erro update:', error.message, error.code)
            } else {
              const { error } = await (supabase.from('elena_registro') as any).insert(payload)
              if (!error) salvo = true
              else console.error('[Elena][registro_livre] Erro insert com chave:', error.message, error.code)
            }
          } else {
            const { error } = await (supabase.from('elena_registro') as any).insert(payload)
            if (!error) salvo = true
            else console.error('[Elena][registro_livre] Erro insert:', error.message, error.code)
          }
        } catch (regErr: any) {
          console.error('[Elena][registro_livre] Exception:', regErr?.message)
          // Retry: tenta insert simples sem chave como fallback
          try {
            const fallbackPayload = { ...payload }
            delete fallbackPayload.chave
            const { error } = await (supabase.from('elena_registro') as any).insert(fallbackPayload)
            if (!error) salvo = true
          } catch { /* esgotou tentativas */ }
        }

        const icon = tipoReg === 'preferencia' ? '⭐' : tipoReg === 'regra_negocio' ? '📋'
          : tipoReg === 'contato' ? '📞' : tipoReg === 'acordo' ? '🤝'
          : tipoReg === 'dado_pessoal' ? '👤' : '🧠'

        setMensagens(prev => [...prev, {
          id: `reg-${Date.now()}`, role: 'ai' as const,
          texto: salvo
            ? `${icon} **${isUpdate ? 'Atualizado' : 'Anotado'}:** _${titulo || conteudo?.substring(0, 60)}_\nGuardei isso na minha memória, Sr. Max! 💾`
            : `${icon} **Anotado localmente:** _${titulo || conteudo?.substring(0, 60)}_\n_(Houve um problema ao salvar no banco)_`,
        }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── BUSCAR CONTAS E CARTÕES ───────────────────────────────
      } else if (acao.tipo === 'buscar_contas') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const cat = acao.dados.categoria || 'todos'
        const COLS = 'id, nome, tipo, categoria, bandeira, saldo_atual, ativo, dia_vencimento, dia_fechamento, limite'

        // 🔴 FIX: PF isola por user_id, PJ isola por empresa_id.
        // A versão antiga filtrava TUDO por user_id — e como as contas PJ
        // têm user_id = NULL no banco, elas NUNCA apareciam na listagem.
        const empresaIdBusca = await getEmpresaId(uid)

        const buscarPf = async () => {
          if (cat === 'pj') return []
          const { data } = await (supabase.from('contas') as any)
            .select(COLS).eq('user_id', uid).eq('categoria', 'pf').eq('ativo', true).order('nome')
          return data || []
        }
        const buscarPj = async () => {
          if (cat === 'pf' || !empresaIdBusca) return []
          const { data } = await (supabase.from('contas') as any)
            .select(COLS).eq('empresa_id', empresaIdBusca).eq('categoria', 'pj').eq('ativo', true).order('nome')
          return data || []
        }

        const [listaPf, listaPj] = await Promise.all([buscarPf(), buscarPj()])
        const contas = [...listaPf, ...listaPj]

        if (!contas || contas.length === 0) {
          setMensagens(prev => [...prev, { id: `busca-${Date.now()}`, role: 'ai' as const, texto: '🏦 Nenhuma conta cadastrada ainda, Sr. Max. Posso cadastrar uma para você agora!' }])
        } else {
          const contasPf = contas.filter((c: any) => c.categoria === 'pf')
          const contasPj = contas.filter((c: any) => c.categoria === 'pj')
          const tipoIcon = (tipo: string) => tipo === 'cartao_credito' ? '💳' : tipo === 'cartao_debito' ? '💳' : tipo === 'poupanca' ? '🏦' : tipo === 'investimento' ? '📈' : tipo === 'carteira' ? '👛' : '🏦'
          let texto = '🏦 **Suas contas cadastradas:**\n\n'
          if (contasPf.length > 0) {
            texto += '**👤 Pessoal (PF):**\n'
            contasPf.forEach((c: any) => {
              const saldo = c.saldo_atual != null ? `R$ ${Number(c.saldo_atual).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
              const band = c.bandeira ? ` [${c.bandeira}]` : ''
              const venc = c.dia_vencimento ? ` | 📅 dia ${c.dia_vencimento}` : ''
              const lim = c.limite ? ` | Limite: R$ ${Number(c.limite).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
              const isCartao = c.tipo === 'cartao_credito' || c.tipo === 'cartao_debito'
              texto += `• ${tipoIcon(c.tipo)} ${c.nome}${band} — ${saldo}${isCartao ? venc + lim : ''}\n`
            })
            texto += '\n'
          }
          if (contasPj.length > 0) {
            texto += '**🏢 Empresa (PJ):**\n'
            contasPj.forEach((c: any) => {
              const saldo = c.saldo_atual != null ? `R$ ${Number(c.saldo_atual).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
              const band = c.bandeira ? ` [${c.bandeira}]` : ''
              const venc = c.dia_vencimento ? ` | 📅 dia ${c.dia_vencimento}` : ''
              const lim = c.limite ? ` | Limite: R$ ${Number(c.limite).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
              const isCartao = c.tipo === 'cartao_credito' || c.tipo === 'cartao_debito'
              texto += `• ${tipoIcon(c.tipo)} ${c.nome}${band} — ${saldo}${isCartao ? venc + lim : ''}\n`
            })
          }
          texto += `\n_Total: ${contas.length} conta(s) ativa(s)_`
          setMensagens(prev => [...prev, { id: `busca-${Date.now()}`, role: 'ai' as const, texto }])
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── BUSCAR LANÇAMENTOS RECENTES ───────────────────────────
      } else if (acao.tipo === 'buscar_lancamentos') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const tipo = acao.dados.tipo || 'todos'
        const limite = Math.min(Number(acao.dados.limite) || 10, 20)
        let texto = ''

        if (tipo === 'pf' || tipo === 'todos') {
          const [{ data: gastos }, { data: receitas }] = await Promise.all([
            (supabase.from('gastos_pessoais') as any).select('descricao, valor, categoria, data, forma_pagamento').eq('user_id', uid).order('data', { ascending: false }).limit(limite),
            (supabase.from('receitas_pessoais') as any).select('descricao, valor, categoria, data').eq('user_id', uid).order('data', { ascending: false }).limit(limite),
          ])
          const todosPf = [
            ...(gastos || []).map((g: any) => ({ ...g, _tipo: 'gasto' })),
            ...(receitas || []).map((r: any) => ({ ...r, _tipo: 'receita' })),
          ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()).slice(0, limite)

          if (todosPf.length > 0) {
            texto += '**💰 Lançamentos Pessoais (PF):**\n'
            todosPf.forEach((l: any) => {
              const dt = l.data ? new Date(l.data + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
              const icon = l._tipo === 'gasto' ? '💸' : '💰'
              const valor = `R$ ${Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              texto += `• ${icon} [${dt}] ${l.descricao} — **${valor}** _(${l.categoria})_\n`
            })
            texto += '\n'
          } else if (tipo === 'pf') {
            texto += '💰 Nenhum lançamento PF encontrado.\n'
          }
        }

        if (tipo === 'pj' || tipo === 'todos') {
          // 🔴 FIX: contas PJ pertencem à EMPRESA (user_id é NULL nelas).
          // A versão antiga buscava por user_id → lista vazia → a Elena
          // sempre respondia "Nenhum lançamento PJ encontrado".
          const empresaIdLanc = await getEmpresaId(uid)
          const { data: contasPjIds } = empresaIdLanc
            ? await (supabase.from('contas') as any)
                .select('id').eq('empresa_id', empresaIdLanc).eq('categoria', 'pj')
            : { data: [] }
          const idsContas = (contasPjIds || []).map((c: any) => c.id)
          const { data: lancPj } = idsContas.length > 0
            ? await (supabase.from('lancamentos') as any)
                .select('descricao, valor, tipo, data_competencia, categorias(nome)')
                .in('conta_id', idsContas)
                .order('data_competencia', { ascending: false })
                .limit(limite)
            : { data: [] }
          if (lancPj && lancPj.length > 0) {
            texto += '**🏢 Lançamentos Empresa (PJ):**\n'
            lancPj.forEach((l: any) => {
              const dt = l.data_competencia ? new Date(l.data_competencia + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'
              const icon = l.tipo === 'despesa' ? '💸' : '💰'
              const valor = `R$ ${Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
              texto += `• ${icon} [${dt}] ${l.descricao} — **${valor}**\n`
            })
          } else if (tipo === 'pj') {
            texto += '🏢 Nenhum lançamento PJ encontrado.\n'
          }
        }

        if (!texto.trim()) texto = '🔍 Nenhum lançamento encontrado para o filtro aplicado.'
        setMensagens(prev => [...prev, { id: `busca-${Date.now()}`, role: 'ai' as const, texto: texto.trim() }])
        setAcaoStatus(msgId, acaoIdx, 'saved')


      // ── BUSCAR VENCIMENTOS PRÓXIMOS (só tipo 'vencimento') ───────────
      } else if (acao.tipo === 'buscar_vencimentos') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const dias = Math.min(Number(acao.dados.dias) || 30, 90)
        const agora = new Date()
        const ate = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000)

        // Busca APENAS tipo vencimento — não mistura com lembretes genéricos
        const { data: eventos, error: errEv } = await (supabase.from('agenda_eventos') as any)
          .select('id, titulo, data_inicio, tipo, descricao')
          .eq('user_id', uid)
          .eq('tipo', 'vencimento')
          .neq('status', 'cancelado')
          .neq('status', 'concluido')
          .gte('data_inicio', agora.toISOString())
          .lte('data_inicio', ate.toISOString())
          .order('data_inicio', { ascending: true })

        if (errEv) throw new Error(errEv.message)

        if (!eventos || eventos.length === 0) {
          setMensagens(prev => [...prev, {
            id: `venc-${Date.now()}`, role: 'ai' as const,
            texto: `📅 Nenhum vencimento encontrado nos próximos ${dias} dias, Sr. Max.`,
          }])
        } else {
          const pagamentos = (eventos as any[]).filter(ev => {
            const tit = (ev.titulo || '').toLowerCase()
            return !tit.includes('confirmação') && !tit.includes('pagou') && !tit.startsWith('✅')
          })

          let texto = `📋 **Vencimentos dos próximos ${dias} dias:**\n\n`
          const hoje = new Date()
          hoje.setHours(0, 0, 0, 0)

          pagamentos.forEach((ev: any) => {
            const dt = new Date(ev.data_inicio)
            const diffDias = Math.ceil((dt.getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000))
            const dtFmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
            const urgencia = diffDias <= 2 ? '🔴' : diffDias <= 7 ? '🟡' : '🟢'
            const quando = diffDias === 0 ? 'HOJE' : diffDias === 1 ? 'amanhã' : `em ${diffDias} dias`
            texto += `${urgencia} [${dtFmt}] **${ev.titulo}** — ${quando}\n`
          })

          const totalUrgente = pagamentos.filter((ev: any) =>
            Math.ceil((new Date(ev.data_inicio).getTime() - hoje.getTime()) / (24 * 60 * 60 * 1000)) <= 7
          ).length

          if (totalUrgente > 0) texto += `\n⚠️ _${totalUrgente} vencimento(s) nos próximos 7 dias!_`
          texto += `\n\n_Total: ${pagamentos.length} compromisso(s) financeiro(s)_`
          setMensagens(prev => [...prev, { id: `venc-${Date.now()}`, role: 'ai' as const, texto }])
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── BUSCAR PAGAMENTOS (filtro financeiro inteligente) ─────────────
      } else if (acao.tipo === 'buscar_pagamentos') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const dias = Math.min(Number(acao.dados.dias) || 30, 90)
        const agora = new Date()
        const ate = new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000)

        const { data: eventosP } = await (supabase.from('agenda_eventos') as any)
          .select('id, titulo, data_inicio, tipo, descricao')
          .eq('user_id', uid)
          .in('tipo', ['vencimento', 'lembrete', 'prazo'])
          .neq('status', 'cancelado').neq('status', 'concluido')
          .gte('data_inicio', agora.toISOString())
          .lte('data_inicio', ate.toISOString())
          .order('data_inicio', { ascending: true })

        const PALAVRAS_PAG = ['pagar','cartão','fatura','boleto','conta','vencimento','aluguel','energia','internet','agua','água','mensalidade','parcela','financiamento','condomínio','condominio','plano','seguro']
        const pagamentosF = (eventosP || []).filter((ev: any) => {
          const txt = `${ev.titulo} ${ev.descricao || ''}`.toLowerCase()
          if (txt.includes('confirmação') || txt.includes('pagou') || txt.startsWith('✅')) return false
          if (ev.tipo === 'vencimento') return true
          return PALAVRAS_PAG.some(p => txt.includes(p))
        })

        if (!pagamentosF.length) {
          setMensagens(prev => [...prev, { id: `pag-${Date.now()}`, role: 'ai' as const,
            texto: `💳 Nenhum compromisso financeiro encontrado nos próximos ${dias} dias, Sr. Max.` }])
        } else {
          const hoje2 = new Date(); hoje2.setHours(0,0,0,0)
          let texto = `💳 **Compromissos financeiros — próximos ${dias} dias:**\n\n`
          pagamentosF.forEach((ev: any) => {
            const dt = new Date(ev.data_inicio)
            const diff = Math.ceil((dt.getTime() - hoje2.getTime()) / (24*60*60*1000))
            const dtFmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
            const urg = diff <= 2 ? '🔴' : diff <= 7 ? '🟡' : '🟢'
            const quando = diff === 0 ? 'HOJE' : diff === 1 ? 'amanhã' : `dia ${dtFmt}`
            texto += `${urg} **${ev.titulo}** — ${quando}\n`
          })
          texto += `\n_Total: ${pagamentosF.length} compromisso(s)_`
          setMensagens(prev => [...prev, { id: `pag-${Date.now()}`, role: 'ai' as const, texto }])
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── BUSCAR LANCAMENTO (singular) → redireciona para buscar_lancamentos ──
      } else if (acao.tipo === 'buscar_lancamento') {
        // A IA pode gerar "buscar_lancamento" (singular) — redireciona para o handler plural
        const acaoRedirecionada = { ...acao, tipo: 'buscar_lancamentos' as any, dados: { ...acao.dados, tipo: acao.dados.tipo || 'todos', limite: acao.dados.limite || 10 } }
        await salvarAcao(msgId, acaoIdx, acaoRedirecionada)

      // ── EDITAR LANÇAMENTO ─────────────────────────────────────
      } else if (acao.tipo === 'editar_lancamento') {
        if (!ultimoRegistroRef.current) throw new Error('Nenhum registro recente para editar.')
        const { tabela, id } = ultimoRegistroRef.current
        const updates: Record<string, any> = {}
        if (acao.dados.novo_valor) {
          updates.valor = Number(acao.dados.novo_valor)
        }
        if (acao.dados.nova_descricao) {
          updates.descricao = acao.dados.nova_descricao
        }
        if (Object.keys(updates).length === 0) throw new Error('Nenhuma alteração informada.')
        // 🔒 FIX: o update era só por `id` — a única barreira contra editar
        // registro de outro usuário era o RLS. Cinto e suspensório: para as
        // tabelas pessoais, exigimos também o dono na própria query.
        const TABELAS_COM_USER_ID = ['gastos_pessoais', 'receitas_pessoais', 'diario_entradas']
        let updQuery = (supabase.from(tabela) as any).update(updates).eq('id', id)
        if (TABELAS_COM_USER_ID.includes(tabela)) updQuery = updQuery.eq('user_id', uid)
        const { error } = await updQuery
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        setMensagens(prev => [...prev, {
          id: `edit-${Date.now()}`, role: 'ai' as const,
          texto: `✏️ Registro atualizado com sucesso!${updates.valor ? ` Novo valor: R$ ${Number(updates.valor).toFixed(2)}` : ''}${updates.descricao ? ` Nova descrição: ${updates.descricao}` : ''}`,
        }])
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── IMPORTAR EXTRATO (batch de lançamentos) ────────────────
      } else if (acao.tipo === 'importar_extrato') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const itens = Array.isArray(acao.dados.itens) ? acao.dados.itens : []
        if (itens.length === 0) throw new Error('Nenhum item encontrado no extrato.')
        let sucesso = 0
        const falhas: string[] = []
        for (const item of itens) {
          try {
            const isReceita = ['receita', 'credito', 'crédito', 'entrada'].includes(String(item.tipo || '').toLowerCase())
            const dataItem = validarData(item.data)
            const valor = Math.abs(Number(item.valor) || 0)
            if (valor === 0) continue

            // 🔴 FIX: o Supabase NÃO lança exceção em erro de query — retorna
            // { error }. O código antigo fazia `sucesso++` logo após o insert
            // e o catch nunca disparava. Resultado: a Elena reportava
            // "12 de 12 importados com sucesso" mesmo quando NENHUM salvou.
            const { error: impErr } = isReceita
              ? await (supabase.from('receitas_pessoais') as any).insert({
                  user_id: uid, descricao: item.descricao || 'Extrato', valor,
                  categoria: 'outros', data: dataItem, notas: 'Importado via extrato — Elena',
                })
              : await (supabase.from('gastos_pessoais') as any).insert({
                  user_id: uid, descricao: item.descricao || 'Extrato', valor,
                  categoria: item.categoria || 'outros', forma_pagamento: 'transferencia',
                  data: dataItem, notas: 'Importado via extrato — Elena',
                })

            if (impErr) {
              falhas.push(`${item.descricao || 'item'} (R$ ${valor}): ${impErr.message}`)
              console.error('[Elena] extrato — item não importado:', impErr.message)
            } else {
              sucesso++
            }
          } catch (e: any) {
            falhas.push(`${item.descricao || 'item'}: ${e?.message || 'erro'}`)
          }
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        let textoExtrato = `🏦 **Extrato importado!** ${sucesso} de ${itens.length} lançamento(s) registrado(s).`
        if (falhas.length > 0) {
          textoExtrato += `\n\n⚠️ **${falhas.length} item(ns) NÃO foram salvos:**\n` +
            falhas.slice(0, 5).map(f => `  • ${f}`).join('\n') +
            (falhas.length > 5 ? `\n  • …e mais ${falhas.length - 5}` : '')
        }
        setMensagens(prev => [...prev, {
          id: `extrato-${Date.now()}`, role: 'ai' as const,
          texto: textoExtrato,
        }])
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))


      // -- DELETAR EVENTO DA AGENDA -----------------------------------------
      } else if (acao.tipo === 'deletar_evento') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const tituloDelete = acao.dados.titulo || ''
        const dataDelete   = acao.dados.data   || ''
        if (!tituloDelete) throw new Error('Informe o titulo do evento a deletar.')
        let query = (supabase.from('agenda_eventos') as any)
          .select('id, titulo').eq('user_id', uid).ilike('titulo', `%${tituloDelete}%`)
        if (dataDelete) query = query
          .gte('data_inicio', `${dataDelete.substring(0,10)}T00:00:00`)
          .lte('data_inicio', `${dataDelete.substring(0,10)}T23:59:59`)
        const { data: encontrados } = await query.limit(5)
        if (!encontrados?.length) {
          setMensagens(prev => [...prev, { id: `del-${Date.now()}`, role: 'ai' as const,
            texto: `Nenhum evento encontrado com "${tituloDelete}".` }])
        } else {
          await (supabase.from('agenda_eventos') as any).delete().in('id', encontrados.map((e: any) => e.id))
          setMensagens(prev => [...prev, { id: `del-${Date.now()}`, role: 'ai' as const,
            texto: `Deletei ${encontrados.length} evento(s): ${encontrados.map((e: any) => e.titulo).join(', ')}` }])
          window.dispatchEvent(new CustomEvent('elena:agenda-updated'))
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // -- DELETAR LANCAMENTO (GASTO/RECEITA) --------------------------------
      } else if (acao.tipo === 'deletar_lancamento') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const descDelete  = acao.dados.descricao || ''
        const dataDelete2 = acao.dados.data || ''
        const tipoDelete  = acao.dados.tipo || 'gasto'
        const tabelaDel   = tipoDelete === 'receita' ? 'receitas_pessoais' : 'gastos_pessoais'
        if (!descDelete) throw new Error('Informe a descricao do lancamento a deletar.')
        let q2 = (supabase.from(tabelaDel) as any).select('id, descricao, valor').eq('user_id', uid)
          .ilike('descricao', `%${descDelete}%`)
        if (dataDelete2) q2 = q2.gte('data', dataDelete2.substring(0,10)).lte('data', dataDelete2.substring(0,10))
        const { data: lancs } = await q2.limit(3)
        if (!lancs?.length) {
          setMensagens(prev => [...prev, { id: `del2-${Date.now()}`, role: 'ai' as const,
            texto: `Nenhum lancamento encontrado com "${descDelete}".` }])
        } else {
          await (supabase.from(tabelaDel) as any).delete().in('id', lancs.map((l: any) => l.id))
          const total = lancs.reduce((s: number, l: any) => s + Number(l.valor), 0)
          setMensagens(prev => [...prev, { id: `del2-${Date.now()}`, role: 'ai' as const,
            texto: `Deletei ${lancs.length} lancamento(s) — R$ ${total.toFixed(2)}` }])
          window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // -- DELETAR DUPLICADOS ------------------------------------------------
      } else if (acao.tipo === 'deletar_duplicados') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const alvo = acao.dados.tabela || 'agenda'
        let totalRemovidos = 0
        if (alvo === 'agenda' || alvo === 'todos') {
          const { data: todosEvts } = await (supabase.from('agenda_eventos') as any)
            .select('id, titulo, data_inicio, created_at').eq('user_id', uid)
            .order('created_at', { ascending: true })
          const vis = new Map<string, string>(); const idsE: string[] = []
          ;(todosEvts || []).forEach((ev: any) => {
            const ch = `${(ev.titulo||'').toLowerCase().trim()}_${String(ev.data_inicio||'').substring(0,16)}`
            if (vis.has(ch)) { idsE.push(ev.id) } else { vis.set(ch, ev.id) }
          })
          if (idsE.length > 0) {
            for (let i = 0; i < idsE.length; i += 50)
              await (supabase.from('agenda_eventos') as any).delete().in('id', idsE.slice(i, i+50))
            totalRemovidos += idsE.length
            window.dispatchEvent(new CustomEvent('elena:agenda-updated'))
          }
        }
        if (alvo === 'gastos' || alvo === 'todos') {
          const { data: todosG } = await (supabase.from('gastos_pessoais') as any)
            .select('id, descricao, valor, data, created_at').eq('user_id', uid)
            .order('created_at', { ascending: true })
          // 🔴 FIX: a chave era só (descricao + data + valor). Isso apagava
          // GASTOS LEGÍTIMOS: dois Ubers de R$ 15 no mesmo dia viravam
          // "duplicata" e um era DESTRUÍDO.
          // Agora só considera duplicata se foram criados com menos de 2
          // minutos de diferença — o padrão de double-click / retry, não de
          // duas compras iguais de verdade.
          const JANELA_MS = 2 * 60 * 1000
          const visG = new Map<string, any>(); const idsG: string[] = []
          ;(todosG || []).forEach((g: any) => {
            const ch = `${(g.descricao||'').toLowerCase().trim()}_${g.data}_${g.valor}`
            const anterior = visG.get(ch)
            if (anterior) {
              const dt = Math.abs(new Date(g.created_at).getTime() - new Date(anterior.created_at).getTime())
              if (dt < JANELA_MS) {
                idsG.push(g.id)          // gravado 2x em segundos → duplicata real
              } else {
                visG.set(ch, g)          // gasto legítimo repetido → PRESERVA
              }
            } else {
              visG.set(ch, g)
            }
          })
          if (idsG.length > 0) {
            for (let i = 0; i < idsG.length; i += 50)
              await (supabase.from('gastos_pessoais') as any).delete().eq('user_id', uid).in('id', idsG.slice(i, i+50))
            totalRemovidos += idsG.length
            window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))
          }
        }
        setMensagens(prev => [...prev, { id: `dedup-${Date.now()}`, role: 'ai' as const,
          texto: totalRemovidos > 0
            ? `Limpeza concluida! Removi ${totalRemovidos} duplicata(s) da ${alvo}.`
            : `Nenhuma duplicata encontrada — tudo limpo, Sr. Max!` }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── CONFIRMAR PAGAMENTO (🆕 21/07/2026 — pedido do Sr. Max) ─────────
      // Marca fatura de cartão / boleto de imóvel / conta fixa / parcela de
      // investimento como PAGA. Ação passa pelo gate de confirmação (mesma
      // categoria de risco que editar/deletar — muda estado financeiro real).
      // dados esperados: { tipo: 'cartao'|'imovel'|'conta_fixa'|'investimento',
      //                     nome: string, mes_referencia?: 'YYYY-MM',
      //                     valor_pago?: number, data_pagamento?: 'YYYY-MM-DD' }
      } else if (acao.tipo === 'confirmar_pagamento') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const tipoAlvo = acao.dados.tipo
        const nomeAlvo = (acao.dados.nome || '').trim()
        const mesRefAlvo = acao.dados.mes_referencia || new Date().toISOString().substring(0, 7)
        const dataPag = acao.dados.data_pagamento || new Date().toISOString().substring(0, 10)
        if (!nomeAlvo) throw new Error('Informe o nome do cartão/imóvel/conta/investimento a marcar como pago.')
        const empresaIdConf = await getEmpresaId(uid)

        if (tipoAlvo === 'cartao') {
          const cartaoPf = await resolverCartaoPf(nomeAlvo)
          if (!cartaoPf.id) throw new Error(`Cartão "${nomeAlvo}" não encontrado.`)
          const { data: faturaExistente } = await (supabase.from('faturas_cartoes') as any)
            .select('id, valor_fechado').eq('conta_id', cartaoPf.id).eq('mes_referencia', mesRefAlvo).maybeSingle()
          if (!faturaExistente) throw new Error(`Fatura de ${cartaoPf.nome} de ${mesRefAlvo} ainda não foi lançada — informe o valor da fatura primeiro.`)
          const { error } = await (supabase.from('faturas_cartoes') as any)
            .update({ status: 'pago', data_pagamento: dataPag, ...(acao.dados.valor_pago ? { valor_fechado: Number(acao.dados.valor_pago) } : {}) })
            .eq('id', faturaExistente.id)
          if (error) throw new Error(error.message)
          setMensagens(prev => [...prev, { id: `pago-${Date.now()}`, role: 'ai' as const,
            texto: `✅ Fatura do **${cartaoPf.nome}** (${mesRefAlvo}) marcada como paga.` }])

        } else if (tipoAlvo === 'imovel') {
          let qIm = (supabase.from('imoveis') as any).select('id, titulo').ilike('titulo', `%${nomeAlvo}%`)
          if (empresaIdConf) qIm = qIm.eq('empresa_id', empresaIdConf)
          const { data: imoveisAch } = await qIm.limit(5)
          if (!imoveisAch?.length) throw new Error(`Imóvel "${nomeAlvo}" não encontrado.`)
          if (imoveisAch.length > 1) throw new Error(`Mais de um imóvel encontrado com "${nomeAlvo}": ${imoveisAch.map((i: any) => i.titulo).join(', ')}. Seja mais específico.`)
          const imovelAch = imoveisAch[0]
          const { error: errPag } = await (supabase.from('pagamentos_imoveis') as any).upsert({
            imovel_id: imovelAch.id, empresa_id: empresaIdConf, mes_referencia: mesRefAlvo,
            status: 'pago', valor_pago: acao.dados.valor_pago || null, data_pagamento: dataPag,
          }, { onConflict: 'imovel_id,mes_referencia' })
          if (errPag) throw new Error(errPag.message)
          // 🆕 Incrementa parcelas_pagas automaticamente — resolve exatamente o
          // tipo de erro manual que a gente ficou corrigindo via SQL o tempo
          // todo (Sítio Mucugê, São Roque). Nunca passa de parcelas_total.
          const { data: imovelAtual } = await (supabase.from('imoveis') as any)
            .select('parcelas_pagas, parcelas_total').eq('id', imovelAch.id).maybeSingle()
          if (imovelAtual && (imovelAtual.parcelas_pagas || 0) < (imovelAtual.parcelas_total || 0)) {
            await (supabase.from('imoveis') as any)
              .update({ parcelas_pagas: (imovelAtual.parcelas_pagas || 0) + 1 })
              .eq('id', imovelAch.id)
          }
          setMensagens(prev => [...prev, { id: `pago-${Date.now()}`, role: 'ai' as const,
            texto: `✅ Boleto do **${imovelAch.titulo}** (${mesRefAlvo}) marcado como pago — parcela avançada automaticamente.` }])

        } else if (tipoAlvo === 'conta_fixa') {
          const { data: contasAch } = await (supabase.from('compromissos_fixos') as any)
            .select('id, descricao').eq('user_id', uid).ilike('descricao', `%${nomeAlvo}%`).limit(5)
          if (!contasAch?.length) throw new Error(`Conta fixa "${nomeAlvo}" não encontrada.`)
          if (contasAch.length > 1) throw new Error(`Mais de uma conta fixa encontrada com "${nomeAlvo}": ${contasAch.map((c: any) => c.descricao).join(', ')}. Seja mais específico.`)
          const contaAch = contasAch[0]
          // ⚠️ onConflict assume UNIQUE(compromisso_id, mes_referencia) em
          // historico_pagamentos_mensal — se a tabela não tiver essa
          // constraint, ajustar aqui ou trocar por select+insert/update manual.
          const { error: errHist } = await (supabase.from('historico_pagamentos_mensal') as any).upsert({
            compromisso_id: contaAch.id, user_id: uid, mes_referencia: mesRefAlvo,
            status: 'pago', valor_pago: acao.dados.valor_pago || null,
          }, { onConflict: 'compromisso_id,mes_referencia' })
          if (errHist) throw new Error(errHist.message)
          setMensagens(prev => [...prev, { id: `pago-${Date.now()}`, role: 'ai' as const,
            texto: `✅ Conta **${contaAch.descricao}** (${mesRefAlvo}) marcada como paga.` }])

        } else if (tipoAlvo === 'investimento') {
          let qInv = (supabase.from('investimentos_contratos') as any)
            .select('id, nome_contrato, parcela_atual, parcela_total').ilike('nome_contrato', `%${nomeAlvo}%`).eq('mes_referencia', mesRefAlvo)
          if (empresaIdConf) qInv = qInv.eq('empresa_id', empresaIdConf)
          const { data: contratosAch } = await qInv.limit(5)
          if (!contratosAch?.length) throw new Error(`Contrato "${nomeAlvo}" não encontrado para ${mesRefAlvo}.`)
          if (contratosAch.length > 1) throw new Error(`Mais de um contrato encontrado com "${nomeAlvo}". Seja mais específico.`)
          const contratoAch = contratosAch[0]
          const novaParcela = Math.min((contratoAch.parcela_atual || 0) + 1, contratoAch.parcela_total || 0)
          const { error: errInv } = await (supabase.from('investimentos_contratos') as any)
            .update({ status: 'pago', parcela_atual: novaParcela })
            .eq('id', contratoAch.id)
          if (errInv) throw new Error(errInv.message)
          setMensagens(prev => [...prev, { id: `pago-${Date.now()}`, role: 'ai' as const,
            texto: `✅ Contrato **${contratoAch.nome_contrato}** (${mesRefAlvo}) marcado como pago — parcela ${novaParcela}/${contratoAch.parcela_total}.` }])
        } else {
          throw new Error(`Tipo "${tipoAlvo}" não reconhecido. Use: cartao, imovel, conta_fixa ou investimento.`)
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── REAGENDAR VENCIMENTO (🆕 21/07/2026 — pedido do Sr. Max) ────────
      // Atualiza o dia/data de vencimento — usado quando cai em fim de
      // semana ou precisa adiar por algum imprevisto. NÃO marca como pago
      // (isso é o confirmar_pagamento); só move a data prevista.
      // dados esperados: { tipo: 'cartao'|'imovel'|'conta_fixa'|'investimento',
      //                     nome: string, novo_dia?: number, nova_data?: 'YYYY-MM-DD' }
      } else if (acao.tipo === 'reagendar_vencimento') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const tipoAlvo2 = acao.dados.tipo
        const nomeAlvo2 = (acao.dados.nome || '').trim()
        const novoDia = acao.dados.novo_dia ? Number(acao.dados.novo_dia) : null
        const novaData = acao.dados.nova_data || null
        if (!nomeAlvo2) throw new Error('Informe o nome do cartão/imóvel/conta/investimento a reagendar.')
        if (!novoDia && !novaData) throw new Error('Informe o novo dia (ex: 25) ou a nova data completa.')
        const empresaIdReag = await getEmpresaId(uid)

        if (tipoAlvo2 === 'cartao') {
          const cartaoReag = await resolverCartaoPf(nomeAlvo2)
          if (!cartaoReag.id) throw new Error(`Cartão "${nomeAlvo2}" não encontrado.`)
          if (!novoDia) throw new Error('Pra cartão, informe o novo dia do mês (ex: 25).')
          await (supabase.from('contas') as any).update({ dia_vencimento: novoDia }).eq('id', cartaoReag.id)
          setMensagens(prev => [...prev, { id: `reag-${Date.now()}`, role: 'ai' as const,
            texto: `📅 Vencimento do **${cartaoReag.nome}** atualizado pro dia ${novoDia}.` }])

        } else if (tipoAlvo2 === 'imovel') {
          let qImR = (supabase.from('imoveis') as any).select('id, titulo').ilike('titulo', `%${nomeAlvo2}%`)
          if (empresaIdReag) qImR = qImR.eq('empresa_id', empresaIdReag)
          const { data: imR } = await qImR.limit(5)
          if (!imR?.length) throw new Error(`Imóvel "${nomeAlvo2}" não encontrado.`)
          if (imR.length > 1) throw new Error(`Mais de um imóvel encontrado com "${nomeAlvo2}". Seja mais específico.`)
          if (!novoDia) throw new Error('Pra imóvel, informe o novo dia do mês (ex: 25).')
          await (supabase.from('imoveis') as any).update({ dia_vencimento: novoDia }).eq('id', imR[0].id)
          setMensagens(prev => [...prev, { id: `reag-${Date.now()}`, role: 'ai' as const,
            texto: `📅 Vencimento do **${imR[0].titulo}** atualizado pro dia ${novoDia}.` }])

        } else if (tipoAlvo2 === 'conta_fixa') {
          const { data: cfR } = await (supabase.from('compromissos_fixos') as any)
            .select('id, descricao').eq('user_id', uid).ilike('descricao', `%${nomeAlvo2}%`).limit(5)
          if (!cfR?.length) throw new Error(`Conta fixa "${nomeAlvo2}" não encontrada.`)
          if (cfR.length > 1) throw new Error(`Mais de uma conta fixa encontrada com "${nomeAlvo2}". Seja mais específico.`)
          if (!novoDia) throw new Error('Pra conta fixa, informe o novo dia do mês (ex: 25).')
          await (supabase.from('compromissos_fixos') as any).update({ dia_vencimento: novoDia }).eq('id', cfR[0].id)
          setMensagens(prev => [...prev, { id: `reag-${Date.now()}`, role: 'ai' as const,
            texto: `📅 Vencimento de **${cfR[0].descricao}** atualizado pro dia ${novoDia}.` }])

        } else if (tipoAlvo2 === 'investimento') {
          if (!novaData) throw new Error('Pra investimento, informe a data completa (ex: 2026-08-28), não só o dia.')
          let qInvR = (supabase.from('investimentos_contratos') as any)
            .select('id, nome_contrato').ilike('nome_contrato', `%${nomeAlvo2}%`)
          if (empresaIdReag) qInvR = qInvR.eq('empresa_id', empresaIdReag)
          const { data: invR } = await qInvR.limit(5)
          if (!invR?.length) throw new Error(`Contrato "${nomeAlvo2}" não encontrado.`)
          if (invR.length > 1) throw new Error(`Mais de um contrato encontrado com "${nomeAlvo2}". Seja mais específico.`)
          await (supabase.from('investimentos_contratos') as any).update({ proximo_vencimento: novaData }).eq('id', invR[0].id)
          setMensagens(prev => [...prev, { id: `reag-${Date.now()}`, role: 'ai' as const,
            texto: `📅 Vencimento do **${invR[0].nome_contrato}** atualizado pra ${new Date(novaData).toLocaleDateString('pt-BR')}.` }])
        } else {
          throw new Error(`Tipo "${tipoAlvo2}" não reconhecido. Use: cartao, imovel, conta_fixa ou investimento.`)
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))

      // ── RESUMO MENSAL ESTRUTURADO (formato tabela — Sr. Max) ──
      } else if (acao.tipo === 'resumo_mensal') {
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const agora = new Date()
        const mesRef = acao.dados.mes || `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
        const [anoRef, mesNumRef] = mesRef.split('-').map(Number)
        const dataInicio = `${mesRef}-01`
        const ultimoDia = new Date(anoRef, mesNumRef, 0).getDate()
        const dataFim = `${mesRef}-${String(ultimoDia).padStart(2, '0')}`
        const nomeMes = new Date(anoRef, mesNumRef - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

        const empresaId = await getEmpresaId(uid)
        const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

        // Build queries with empresa_id fallback
        let qImoveisR = (supabase.from('imoveis') as any)
          .select('id, titulo, valor_parcela, parcelas_total, parcelas_pagas, dia_vencimento, construtora')
          .not('valor_parcela', 'is', null)
        if (empresaId) qImoveisR = qImoveisR.eq('empresa_id', empresaId)

        let qVeiculosR = (supabase.from('veiculos') as any)
          .select('titulo, valor_parcela, parcelas_total, parcelas_pagas, vencimento_dia')
          .eq('financiado', true)
        if (empresaId) qVeiculosR = qVeiculosR.eq('empresa_id', empresaId)

        let qAtivosR = (supabase.from('ativos') as any)
          .select('ticker, nome, tipo, quantidade, preco_medio, valor_investido, valor_atual, data_vencimento, corretora')
          .order('valor_investido', { ascending: false })
        if (empresaId) qAtivosR = qAtivosR.eq('empresa_id', empresaId)

        let qContratosInvR = (supabase.from('investimentos_contratos') as any)
          .select('nome_contrato, instituicao, parcela_atual, parcela_total, valor_mensal, valor_variavel, proximo_vencimento, status, data_pagamento')
          .eq('mes_referencia', mesRef)
        if (empresaId) qContratosInvR = qContratosInvR.eq('empresa_id', empresaId)

        const [
          { data: cartoes },
          { data: faturas },
          { data: imoveisData },
          { data: veiculosData },
          { data: alertasRec },
          { data: gastosMes },
          { data: receitasMes },
          { data: ativosData },
          { data: pagamentosResumo },
          { data: contratosInvData },
          { data: pagamentosImoveisData },
        ] = await Promise.all([
          // Cartões de crédito do usuário
          (supabase.from('contas') as any)
            .select('id, nome, bandeira, dia_vencimento, dia_fechamento, limite')
            .eq('user_id', uid).eq('ativo', true)
            .in('tipo', ['cartao_credito', 'cartao_debito'])
            .order('dia_vencimento', { ascending: true, nullsFirst: false }),
          // Faturas do mês
          (supabase.from('faturas_cartoes') as any)
            .select('conta_id, valor_fechado, status, data_pagamento')
            .eq('user_id', uid)
            .eq('mes_referencia', mesRef),
          // Imóveis com parcelas
          qImoveisR,
          // Veículos financiados
          qVeiculosR,
          // Contas recorrentes (compromissos_fixos — tabela unificada)
          (supabase.from('compromissos_fixos') as any)
            .select('id, descricao, valor, dia_vencimento, tipo_detalhe')
            .eq('user_id', uid).eq('ativo', true)
            .eq('recorrente', true)
            .order('dia_vencimento'),
          // Gastos do mês
          (supabase.from('gastos_pessoais') as any)
            .select('descricao, valor, categoria, data, forma_pagamento')
            .eq('user_id', uid)
            .gte('data', dataInicio).lte('data', dataFim)
            .order('data'),
          // Receitas do mês
          (supabase.from('receitas_pessoais') as any)
            .select('descricao, valor, categoria, data')
            .eq('user_id', uid)
            .gte('data', dataInicio).lte('data', dataFim)
            .order('data'),
          // Investimentos / Ativos (carteira de mercado)
          qAtivosR,
          // Histórico de pagamentos do mês (compromissos já pagos)
          (supabase.from('historico_pagamentos_mensal') as any)
            .select('compromisso_id, status, valor_pago')
            .eq('user_id', uid)
            .eq('mes_referencia', mesRef),
          // Contratos de investimento parcelados (ex: Bradesco)
          qContratosInvR,
          // Pagamentos de imóveis do mês (status real por imóvel/mês)
          (empresaId
            ? (supabase.from('pagamentos_imoveis') as any)
                .select('imovel_id, status, valor_pago, data_pagamento')
                .eq('empresa_id', empresaId)
                .eq('mes_referencia', mesRef)
            : (supabase.from('pagamentos_imoveis') as any)
                .select('imovel_id, status, valor_pago, data_pagamento')
                .eq('mes_referencia', mesRef)),
        ])

        // Mapa de pagamentos para cruzar com compromissos
        const pagosMapResumo = new Map<string, any>((pagamentosResumo || []).map((p: any) => [p.compromisso_id, p]))
        // Mapa de pagamentos de imóveis (imovel_id → status daquele mês)
        const pagosImoveisMap = new Map<string, any>((pagamentosImoveisData || []).map((p: any) => [p.imovel_id, p]))

        // ── CABEÇALHO (formato Sr. Max) ────────────────────────────
        const mesAnoMax = `${new Date(anoRef, mesNumRef - 1).toLocaleDateString('pt-BR', { month: 'long' }).toUpperCase()}/${anoRef}`
        let texto = `📊 **RESUMO ${mesAnoMax} — CARTÕES, BOLETOS & INVESTIMENTOS**\n`
        texto += `---\n`

        // ── SEÇÃO 1: CARTÕES DE CRÉDITO ────────────────────────────
        texto += `💳 **CARTÕES DE CRÉDITO**\n`
        const cartoesLista = cartoes || []
        let totalCartoes = 0, totalPagoCartoes = 0, qtdPagosCartoes = 0

        if (cartoesLista.length === 0) {
          texto += `_Nenhum cartão cadastrado._\n\n`
        } else {
          texto += `| Cartão | Venc. | Valor | Status |\n`
          texto += `|--------|-------|------:|--------|\n`
          for (const cartao of cartoesLista) {
            const fatura = (faturas || []).find((f: any) => f.conta_id === cartao.id)
            const valor = fatura ? Number(fatura.valor_fechado) : 0
            const statusRaw = fatura?.status || 'sem_fatura'
            const statusLabel = statusRaw === 'pago' ? '✅ Pago'
              : statusRaw === 'parcial' ? '🟡 Parcial'
              : statusRaw === 'pendente' ? '🔴 Pendente'
              : '⚪ Sem fatura'
            const venc = cartao.dia_vencimento ? `${String(cartao.dia_vencimento).padStart(2, '0')}/${String(mesNumRef).padStart(2, '0')}` : '—'
            texto += `| ${cartao.nome} | ${venc} | ${valor > 0 ? fmt(valor) : '—'} | ${statusLabel} |\n`
            totalCartoes += valor
            if (statusRaw === 'pago') { totalPagoCartoes += valor; qtdPagosCartoes++ }
          }
          texto += `\n💳 **TOTAL CARTÕES: ${fmt(totalCartoes)}**\n`
          texto += `💰 VALOR PAGO: ${fmt(totalPagoCartoes)} | RESTA: ${fmt(totalCartoes - totalPagoCartoes)}\n`
          texto += `📊 STATUS: ${qtdPagosCartoes}/${cartoesLista.length} pagos ✅\n`
        }
        texto += `---\n`

        // ── SEÇÃO 2: BOLETOS IMÓVEIS ───────────────────────────────
        texto += `🏠 **BOLETOS IMÓVEIS**\n`

        type LinhaBoleto = { desc: string; dia: string | number; valor: number; parcela: string; status: string; pago: boolean }
        const linhasBoletos: LinhaBoleto[] = []

        ;(imoveisData || []).forEach((im: any) => {
          const restantes = (im.parcelas_total || 0) - (im.parcelas_pagas || 0)
          if (restantes <= 0) return
          const pag = pagosImoveisMap.get(im.id)
          const statusPg = pag?.status || 'pendente'
          linhasBoletos.push({
            desc: im.construtora ? `${im.titulo} (${im.construtora})` : im.titulo,
            dia: im.dia_vencimento || '—',
            valor: Number(im.valor_parcela) || 0,
            parcela: (im.parcelas_pagas != null && im.parcelas_total != null) ? `${im.parcelas_pagas}/${im.parcelas_total}` : '—',
            status: statusPg === 'pago' ? '✅ Pago' : statusPg === 'parcial' ? '🟡 Parcial' : '🔴 Pendente',
            pago: statusPg === 'pago',
          })
        })
        ;(veiculosData || []).forEach((ve: any) => {
          const restantes = (ve.parcelas_total || 0) - (ve.parcelas_pagas || 0)
          if (restantes <= 0) return
          linhasBoletos.push({
            desc: ve.titulo,
            dia: ve.vencimento_dia || '—',
            valor: Number(ve.valor_parcela) || 0,
            parcela: `${ve.parcelas_pagas}/${ve.parcelas_total}`,
            status: '🔴 Pendente',
            pago: false,
          })
        })
        ;(alertasRec || []).forEach((al: any) => {
          const pag = pagosMapResumo.get(al.id)
          const pago = pag?.status === 'pago'
          linhasBoletos.push({
            desc: al.descricao,
            dia: al.dia_vencimento,
            valor: Number(al.valor) || 0,
            parcela: '—',
            status: pago ? '✅ Pago' : pag?.status === 'parcial' ? '🟡 Parcial' : '🔴 Pendente',
            pago,
          })
        })

        let totalBoletos = 0, totalPagoBoletos = 0, qtdPagosBoletos = 0

        if (linhasBoletos.length === 0) {
          texto += `_Nenhum boleto/compromisso cadastrado._\n`
        } else {
          texto += `| Dia | Compromisso | Valor | Parcela | Status |\n`
          texto += `|-----|-------------|------:|---------|--------|\n`
          linhasBoletos.forEach(l => {
            texto += `| ${l.dia} | ${l.desc} | ${l.valor > 0 ? fmt(l.valor) : '—'} | ${l.parcela} | ${l.status} |\n`
            totalBoletos += l.valor
            if (l.pago) { totalPagoBoletos += l.valor; qtdPagosBoletos++ }
          })
          texto += `🏠 **TOTAL BOLETOS: ${fmt(totalBoletos)}**\n`
          texto += `💰 VALOR PAGO: ${fmt(totalPagoBoletos)} | RESTA: ${fmt(totalBoletos - totalPagoBoletos)}\n`
          texto += `📊 STATUS: ${qtdPagosBoletos}/${linhasBoletos.length} pagos ✅\n`
        }
        texto += `---\n`

        // ── SEÇÃO 3: INVESTIMENTOS (contratos parcelados) ──────────
        const contratosInv = contratosInvData || []
        let totalContratos = 0, totalPagoContratos = 0, qtdPagosContratos = 0
        const ativosLista = ativosData || []
        let totalInvestido = 0, totalMercadoInv = 0

        if (contratosInv.length > 0) {
          const instituicaoTitulo = contratosInv[0]?.instituicao ? contratosInv[0].instituicao.toUpperCase() : ''
          texto += `📈 **INVESTIMENTOS${instituicaoTitulo ? ' ' + instituicaoTitulo : ''}**\n`
          texto += `| Contrato | Parcelas | Valor Mensal | Próximo Venc. | Status |\n`
          texto += `|----------|----------|-------------:|---------------|--------|\n`
          contratosInv.forEach((c: any) => {
            const valor = Number(c.valor_mensal) || 0
            const parcelaStr = `${c.parcela_atual}/${c.parcela_total}`
            const venc = new Date(c.proximo_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            const statusLabel = c.status === 'pago' ? '✅ Pago'
              : (c.parcela_atual === 0 && new Date(c.proximo_vencimento) > agora) ? '🟢 Futuro'
              : '🔴 Pendente'
            const variavel = c.valor_variavel ? '*' : ''
            texto += `| ${c.nome_contrato} | ${parcelaStr} | ${fmt(valor)}${variavel} | ${venc} | ${statusLabel} |\n`
            totalContratos += valor
            if (c.status === 'pago') { totalPagoContratos += valor; qtdPagosContratos++ }
          })
          texto += `📈 **TOTAL INVESTIMENTOS ${mesAnoMax.split('/')[0]}: ${fmt(totalContratos)}**\n`
          texto += `💰 VALOR PAGO: ${fmt(totalPagoContratos)} | RESTA: ${fmt(totalContratos - totalPagoContratos)}\n`
          texto += `📊 STATUS: ${qtdPagosContratos}/${contratosInv.length} pagos ✅\n`
          texto += `_*Parcela variável_\n`
          texto += `---\n`
        } else if (ativosLista.length > 0) {
          // Sem contratos, mas há carteira de mercado — mostra ela
          texto += `📈 **INVESTIMENTOS / CARTEIRA**\n`
          texto += `| Ativo | Investido | Atual | Resultado |\n`
          texto += `|-------|----------:|------:|-----------|\n`
          ativosLista.forEach((a: any) => {
            const vi = Number(a.valor_investido) || 0
            const va = Number(a.valor_atual) || vi
            const res = va - vi
            const pct = vi > 0 ? (res / vi) * 100 : 0
            totalInvestido += vi
            totalMercadoInv += va
            texto += `| ${a.ticker || a.nome} | ${fmt(vi)} | ${fmt(va)} | ${res >= 0 ? '🟢 +' : '🔴 '}${pct.toFixed(1)}% |\n`
          })
          texto += `📈 **TOTAL INVESTIDO: ${fmt(totalInvestido)}** | ATUAL: **${fmt(totalMercadoInv)}**\n`
          texto += `---\n`
        }

        // ── CONSOLIDADO GERAL (formato Sr. Max) ────────────────────
        texto += `💰 **CONSOLIDADO GERAL**\n`
        const totalGeral = totalCartoes + totalBoletos + totalContratos
        const totalPagoGeral = totalPagoCartoes + totalPagoBoletos + totalPagoContratos
        const qtdItensGeral = cartoesLista.length + linhasBoletos.length + contratosInv.length
        const qtdPagosGeral = qtdPagosCartoes + qtdPagosBoletos + qtdPagosContratos
        const qtdPendencias = qtdItensGeral - qtdPagosGeral
        texto += `• CARTÕES + BOLETOS + INVESTIMENTOS: **${fmt(totalGeral)}**\n`
        texto += `• TOTAL PAGO: ${fmt(totalPagoGeral)} | TOTAL PENDENTE: ${fmt(totalGeral - totalPagoGeral)}\n`
        texto += `• STATUS GERAL: ${qtdPagosGeral}/${qtdItensGeral} pagos ✅\n`
        texto += `• PENDÊNCIAS: ${qtdPendencias} ${qtdPendencias === 1 ? 'item' : 'itens'} 🔴\n`
        texto += `\n🎯 Resumo gerado com dados reais do sistema.\n`

        // ── SEÇÃO 3: RESUMO FINANCEIRO (receitas/gastos do mês) ────
        texto += `---\n`
        texto += `💰 **MOVIMENTAÇÃO DO MÊS**\n`

        const totalGastos = (gastosMes || []).reduce((s: number, g: any) => s + Number(g.valor), 0)
        const totalReceitas = (receitasMes || []).reduce((s: number, r: any) => s + Number(r.valor), 0)
        const saldoMes = totalReceitas - totalGastos
        const saldoIcon = saldoMes >= 0 ? '🟢' : '🔴'

        texto += `📈 Entradas: **${fmt(totalReceitas)}** _(${(receitasMes || []).length} lançamentos)_\n`
        texto += `📉 Saídas: **${fmt(totalGastos)}** _(${(gastosMes || []).length} lançamentos)_\n`
        texto += `${saldoIcon} Saldo: **${fmt(saldoMes)}**\n\n`

        // Top 5 categorias de gasto
        const porCategoria: Record<string, number> = {}
        ;(gastosMes || []).forEach((g: any) => {
          const cat = g.categoria || 'outros'
          porCategoria[cat] = (porCategoria[cat] || 0) + Number(g.valor)
        })
        const topCats = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 5)
        if (topCats.length > 0) {
          texto += `📂 **Top gastos por categoria:**\n`
          const catEmojis: Record<string, string> = {
            alimentacao: '🍽️', transporte: '🚗', saude: '💊', lazer: '🎮',
            educacao: '📚', moradia: '🏠', vestuario: '👕', tecnologia: '💻', outros: '📦',
          }
          topCats.forEach(([cat, val]) => {
            const emoji = catEmojis[cat] || '📦'
            texto += `  ${emoji} ${cat}: **${fmt(val)}**\n`
          })
          texto += '\n'
        }

        texto += `\n🎯 Atualizado! Dados reais do sistema — sem estimativas.`

        setMensagens(prev => [...prev, { id: `resumo-${Date.now()}`, role: 'ai' as const, texto }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── REGISTRAR PEDIDO DE FEATURE ──────────────────────────
      // Quando a própria Elena PERCEBE que o sistema não faz algo, ela
      // registra aqui. Sem isso, ela explicava lindamente o que falta...
      // e a informação morria no chat.
      } else if (acao.tipo === 'registrar_pedido_feature') {
        setAcaoStatus(msgId, acaoIdx, 'saving')

        const func = acao.dados.funcionalidade || acao.dados.acao_sugerida || 'não especificada'
        await registrarDiagnostico('nao_implementado', {
          acaoTipo: acao.dados.acao_sugerida || func,
          mensagem: acao.dados.descricao || `Funcionalidade solicitada: ${func}`,
          payload: acao.dados,
        })

        setAcaoStatus(msgId, acaoIdx, 'saved')
        setMensagens(prev => [...prev, {
          id: `feat-${Date.now()}`, role: 'ai' as const,
          texto:
            `📋 **Pedido registrado no backlog de desenvolvimento.**\n` +
            `_${func}_\n\n` +
            `Anotei o que você pediu e o contexto. Pergunte "o que falta no sistema?" ` +
            `a qualquer momento para ver o relatório completo.`,
        }])

      // ── RELATÓRIO DE DIAGNÓSTICO ─────────────────────────────
      // A Elena reporta o que ELA MESMA não conseguiu fazer.
      // Pergunte: "o que está faltando no sistema?" / "relatório de erros"
      } else if (acao.tipo === 'relatorio_diagnostico') {
        setAcaoStatus(msgId, acaoIdx, 'saving')

        const { data: diag, error: diagErr } = await (supabase.from('elena_diagnostico') as any)
          .select('tipo, acao_tipo, mensagem, pedido_usuario, created_at')
          .eq('user_id', uid)
          .eq('status', 'aberto')
          .order('created_at', { ascending: false })
          .limit(200)

        if (diagErr) throw new Error(diagErr.message)

        if (!diag || diag.length === 0) {
          setMensagens(prev => [...prev, {
            id: `diag-${Date.now()}`, role: 'ai' as const,
            texto: '✅ **Nenhuma pendência registrada!**\n\nNão houve nenhuma funcionalidade faltando nem erro de gravação desde a última limpeza, Sr. Max.',
          }])
          setAcaoStatus(msgId, acaoIdx, 'saved')
          return
        }

        // Agrupa por tipo + ação
        const faltando = new Map<string, { qtd: number; exemplos: string[]; ultima: string }>()
        const bugs     = new Map<string, { qtd: number; erro: string; ultima: string }>()

        for (const d of diag as any[]) {
          const chave = d.acao_tipo || 'desconhecida'
          const quando = new Date(d.created_at).toLocaleDateString('pt-BR')

          if (d.tipo === 'nao_implementado') {
            const e = faltando.get(chave) || { qtd: 0, exemplos: [], ultima: quando }
            e.qtd++
            if (d.pedido_usuario && e.exemplos.length < 2) e.exemplos.push(d.pedido_usuario.substring(0, 80))
            faltando.set(chave, e)
          } else if (d.tipo === 'erro_salvar') {
            const e = bugs.get(chave) || { qtd: 0, erro: d.mensagem || '', ultima: quando }
            e.qtd++
            bugs.set(chave, e)
          }
        }

        let texto = `🛠️ **RELATÓRIO DE DIAGNÓSTICO DA ELENA**\n`
        texto += `_${diag.length} ocorrência(s) em aberto_\n\n`

        if (faltando.size > 0) {
          texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
          texto += `📋 **FUNCIONALIDADES QUE FALTAM** _(você pediu, o sistema não tem)_\n\n`
          const ord = [...faltando.entries()].sort((a, b) => b[1].qtd - a[1].qtd)
          ord.forEach(([acaoNome, e], i) => {
            texto += `**${i + 1}. \`${acaoNome}\`** — pedido ${e.qtd}× _(última: ${e.ultima})_\n`
            e.exemplos.forEach(ex => { texto += `   💬 _"${ex}"_\n` })
            texto += '\n'
          })
        }

        if (bugs.size > 0) {
          texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
          texto += `🐛 **ERROS DE GRAVAÇÃO** _(existe, mas falhou)_\n\n`
          const ord = [...bugs.entries()].sort((a, b) => b[1].qtd - a[1].qtd)
          ord.forEach(([acaoNome, e], i) => {
            texto += `**${i + 1}. \`${acaoNome}\`** — ${e.qtd}× _(última: ${e.ultima})_\n`
            texto += `   ⚠️ ${e.erro.substring(0, 160)}\n\n`
          })
        }

        texto += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
        texto += `_Detalhes completos (JSON gerado, contexto, navegador) estão na tabela_ \`elena_diagnostico\`.\n`
        texto += `_Consultas prontas para o dev estão no arquivo_ \`065_elena_diagnostico.sql\`.`

        setMensagens(prev => [...prev, {
          id: `diag-${Date.now()}`, role: 'ai' as const, texto,
        }])
        setAcaoStatus(msgId, acaoIdx, 'saved')

      // ── AÇÃO DESCONHECIDA → registra como PEDIDO DE FEATURE ──
      } else {
        const tipoAcao = acao.tipo || 'desconhecida'
        console.warn(`[Elena] 📋 Funcionalidade não implementada: ${tipoAcao}`, acao.dados)

        // 📋 Vira backlog: fica registrado O QUE ele pediu e QUAL ação a IA
        // tentou gerar. É o dado mais valioso que existe — mostra a demanda real.
        await registrarDiagnostico('nao_implementado', {
          acaoTipo: tipoAcao,
          mensagem: `Handler não existe para a ação "${tipoAcao}"`,
          payload: acao.dados,
        })

        setAcaoStatus(msgId, acaoIdx, 'error', `Ação "${tipoAcao}" não disponível`)
        setMensagens(prev => [...prev, {
          id: `unk-${Date.now()}`, role: 'ai' as const,
          texto:
            `🛠️ **Isso ainda não existe no sistema.** _(${tipoAcao})_\n\n` +
            `Já **registrei seu pedido** no relatório de desenvolvimento — ` +
            `com o que você pediu e o que eu tentei fazer. O programador vai ver.\n\n` +
            `Enquanto isso, me diga de outro jeito e eu vejo o que consigo! 💬`,
        }])
      }

    } catch (err: any) {
      const errMsg = err?.message || err?.details || err?.error_description || err?.hint || 'Erro ao salvar'

      // 🔵 É uma PERGUNTA, não uma falha.
      // A Elena precisa que o Sr. Max escolha (ex: 4 contas PJ, 4 cartões Visa).
      // O sistema está funcionando corretamente — mostrar "❌ Não consegui salvar"
      // aqui seria enganoso e assustador.
      if (err instanceof ElenaPergunta || err?.ehPergunta === true) {
        // A ação fica PENDENTE (aguardando resposta), não em erro.
        setAcaoStatus(msgId, acaoIdx, 'pending')
        setMensagens(prev => [...prev, {
          id: `perg-${Date.now()}`,
          role: 'ai' as const,
          // Sem truncar: a pergunta precisa listar TODAS as opções
          texto: `🤔 ${errMsg}`,
        }])
        return
      }

      // ❌ Erro de verdade → registra como BUG, com a mensagem exata do banco
      setAcaoStatus(msgId, acaoIdx, 'error', errMsg)

      await registrarDiagnostico('erro_salvar', {
        acaoTipo: acao?.tipo,
        mensagem: errMsg,
        payload: acao?.dados,
      })

      const erroCurto = errMsg.length > 120 ? errMsg.substring(0, 120) + '...' : errMsg
      setMensagens(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'ai' as const,
        texto:
          `❌ **Ops! Não consegui salvar.**\n${erroCurto}\n\n` +
          `_Já registrei o erro no relatório de diagnóstico — o programador consegue ver o que aconteceu._`,
      }])
    }
  }, [
    supabase, userIdRef, mensagensRef, colaboradores, ultimoRegistroRef,
    resolverContaPf, resolverContaPj, resolverContaQualquer, registrarDiagnostico,
    setAcaoStatus, exibirConfirmacaoSalvamento, setMensagens, setRelatorioData,
  ])

  // ── executarAcoesAuto ─────────────────────────────────────────
  // Executa todas as ações de uma mensagem em sequência.
  // 🔴 FIX: esta função ENGOLIA todos os erros e não retornava nada.
  // Quem chamava (a fila offline) achava que tinha dado tudo certo,
  // marcava o registro como processado e o REMOVIA da fila — mesmo
  // quando nada tinha sido salvo. Lançamentos feitos offline eram
  // PERDIDOS PARA SEMPRE, com a Elena anunciando "sincronizado!".
  //
  // Agora retorna { salvas, falhas } para o chamador decidir.
  const executarAcoesAuto = useCallback(async (
    msgId: string, acoes: AcaoIA[], uid: string,
    opts?: { incluirDestrutivas?: boolean },
  ): Promise<{ salvas: number; falhas: number; erros: string[] }> => {
    let salvas = 0
    let falhas = 0
    let aguardandoConfirmacao = 0
    const erros: string[] = []
    const tiposAguardando: string[] = []

    for (let i = 0; i < acoes.length; i++) {
      if (acoes[i].status === 'pending') {
        // 🔒 GATE DE CONFIRMAÇÃO: ações que apagam, editam ou movem dinheiro
        // NUNCA rodam automaticamente. Uma alucinação da IA emitindo
        // `deletar_lancamento` apagava dados reais em silêncio. Agora essas
        // ações ficam 'pending' até o Sr. Max confirmar ("sim", "pode" etc.) —
        // o atalho de confirmação reexecuta com incluirDestrutivas: true.
        // Criações (gasto, agenda, alerta) continuam automáticas por decisão
        // de produto (fluxo sem fricção).
        if (!opts?.incluirDestrutivas && ACOES_DESTRUTIVAS.includes(acoes[i].tipo)) {
          aguardandoConfirmacao++
          tiposAguardando.push(ROTULO_ACAO_DESTRUTIVA[acoes[i].tipo] || acoes[i].tipo)
          continue
        }
        try {
          await salvarAcao(msgId, i, acoes[i])
          salvas++
        } catch (err: any) {
          // Erro na ação #i NÃO impede a #(i+1) de rodar — mas é CONTADO.
          falhas++
          erros.push(err?.message || String(err))
          console.error(`[Elena] Erro na ação ${i} (${acoes[i]?.tipo}):`, err?.message)
        }
      }
    }

    if (aguardandoConfirmacao > 0) {
      setMensagens(prev => [...prev, {
        id: `confirm-req-${Date.now()}`, role: 'ai' as const,
        texto: `⚠️ **Confirmação necessária:** ${tiposAguardando.join(', ')}. Essa ação altera ou remove dados — responda **"sim"** para eu executar, ou ignore para cancelar.`,
      }])
    }
    return { salvas, falhas, erros }
  }, [salvarAcao])

  return {
    resolverContaPj,
    resolverContaPf,
    resolverContaQualquer,
    salvarAcao,
    executarAcoesAuto,
    setAcaoStatus,
  }
}
