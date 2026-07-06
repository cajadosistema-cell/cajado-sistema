'use client'
// ── useElenaSession.ts ────────────────────────────────────────
// Responsável por: autenticação, sessão, histórico de mensagens e perfil de aprendizado.
// NUNCA contém lógica de salvamento, voz ou IA.

import { useState, useEffect, useRef } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Msg } from './elena-types'

const SAUDACAO_INICIAL: Msg = {
  id: '1',
  role: 'ai',
  texto: 'Olá, Sr. Max! ðŸ‘‹ Sou a **Elena**, sua Secretária Executiva.\n\nPosso **registrar gastos, receitas, agenda e ocorrências** direto no sistema.\n\nExemplos:\n• _"Gastei R$ 80 de gasolina no PIX"_\n• _"Agendar reunião amanhã às 14h"_\n• _"Abrir ocorrência de erro para o Pedro"_',
}

interface UseElenaSessionReturn {
  // IDs (sempre via ref — nunca stale)
  userIdRef: React.MutableRefObject<string>
  sessaoIdRef: React.MutableRefObject<string>
  // Reatividade para UI
  userId: string
  sessaoId: string
  setUserId: (v: string) => void
  setSessaoId: (v: string) => void
  // Mensagens
  mensagens: Msg[]
  setMensagens: React.Dispatch<React.SetStateAction<Msg[]>>
  // Perfil de aprendizado
  perfilRef: React.MutableRefObject<any>
  // Colaboradores
  colaboradores: { id: string; nome: string }[]
  // Histórico de sessões
  sessoesAnteriores: { sid: string; data: string; resumo: string }[]
  showHistory: boolean
  setShowHistory: (v: boolean) => void
  loadSessoes: () => Promise<void>
  loadSpecificSession: (sid: string) => Promise<void>
  handleClearChat: () => void
  // Mic autorizado
  micPermitidoRef: React.MutableRefObject<boolean>
  salvarMicAutorizado: (uid: string) => Promise<void>
  // Persistência de histórico
  salvarHistorico: (uid: string, role: 'ai' | 'user', texto: string, acoes?: any[], sessaoId?: string) => Promise<void>
}

export function useElenaSession(supabase: SupabaseClient): UseElenaSessionReturn {
  // ── Refs (nunca ficam stale em callbacks) ────────────────────
  const userIdRef  = useRef('')
  const sessaoIdRef = useRef('')
  const perfilRef  = useRef<any>(null)
  const micPermitidoRef = useRef(false)
  const historyLoadedRef = useRef(false)

  // ── State (apenas para reatividade de UI) ────────────────────
  const [userId,  setUserIdState]  = useState('')
  const [sessaoId, setSessaoIdState] = useState('')
  const [mensagens, setMensagens]  = useState<Msg[]>([SAUDACAO_INICIAL])
  const [colaboradores, setColaboradores] = useState<{ id: string; nome: string }[]>([])
  const [sessoesAnteriores, setSessoesAnteriores] = useState<{ sid: string; data: string; resumo: string }[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Wrappers que mantêm ref + state sincronizados
  const setUserId = (v: string) => { userIdRef.current = v; setUserIdState(v) }
  const setSessaoId = (v: string) => { sessaoIdRef.current = v; setSessaoIdState(v) }

  // ── Inicialização ─────────────────────────────────────────────
  useEffect(() => {
    // Restaura permissão de mic do localStorage
    if (typeof window !== 'undefined') {
      micPermitidoRef.current = localStorage.getItem('elena_mic_ok') === '1'
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setUserId(uid)

      // Verifica mic no banco se localStorage foi limpo
      if (!micPermitidoRef.current) {
        try {
          const { data: perfilMic } = await (supabase.from('perfis') as any)
            .select('mic_autorizado').eq('id', uid).maybeSingle()
          if (perfilMic?.mic_autorizado) {
            micPermitidoRef.current = true
            localStorage.setItem('elena_mic_ok', '1')
          }
        } catch { /* silencioso */ }
      }

      // Carrega histórico uma única vez
      if (!historyLoadedRef.current) {
        historyLoadedRef.current = true

        let sid = localStorage.getItem(`elena_sessao_id_${uid}`)
        if (!sid) {
          sid = Date.now().toString()
          localStorage.setItem(`elena_sessao_id_${uid}`, sid)
        }
        setSessaoId(sid)

        const { data: hist } = await (supabase.from('elena_conversas') as any)
          .select('id, role, texto, acoes, created_at, sessao_id')
          .eq('user_id', uid)
          .eq('sessao_id', sid)
          .order('created_at', { ascending: false })
          .limit(30)

        if (hist && hist.length > 0) {
          const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
            id: r.id,
            role: r.role as 'ai' | 'user',
            texto: r.texto,
            acoes: r.acoes ?? undefined,
            created_at: r.created_at,
          }))
          setMensagens([
            { id: '1', role: 'ai', texto: 'Olá, Sr. Max! ðŸ‘‹ Carreguei o histórico recente. O que faremos agora?' },
            ...historico,
          ])
        }

        // Carrega perfil de aprendizado
        const { data: perfil } = await (supabase.from('elena_perfil') as any)
          .select('*').eq('user_id', uid).maybeSingle()
        if (perfil) perfilRef.current = perfil

        // ── BRIEFING MATINAL ─────────────────────────────────────
        // Exibe 1x por dia na primeira abertura. Guarda a data no localStorage.
        const hoje = new Date().toLocaleDateString('sv') // YYYY-MM-DD
        const ultimoBriefing = localStorage.getItem(`elena_briefing_${uid}`)
        if (ultimoBriefing !== hoje) {
          localStorage.setItem(`elena_briefing_${uid}`, hoje)
          setTimeout(async () => {
            try {
              const agora = new Date()
              const horaAtual = agora.getHours()
              const saudacao = horaAtual < 12 ? '☀️ Bom dia'
                : horaAtual < 18 ? '🌤️ Boa tarde' : '🌙 Boa noite'

              // 1. Eventos de hoje
              const hojeIso = hoje

              const { data: eventosHoje } = await (supabase.from('agenda_eventos') as any)
                .select('titulo, data_inicio, tipo')
                .eq('user_id', uid)
                .neq('status', 'cancelado')
                .neq('status', 'concluido')
                .gte('data_inicio', `${hojeIso}T00:00:00`)
                .lte('data_inicio', `${hojeIso}T23:59:59`)
                .order('data_inicio')

              // 2. Vencimentos nos próximos 7 dias (agenda)
              const em7d = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
              const [
                { data: venc7d },
                { data: cartoesPf },
                { data: alertasRec },
              ] = await Promise.all([
                (supabase.from('agenda_eventos') as any)
                  .select('titulo, data_inicio')
                  .eq('user_id', uid)
                  .eq('tipo', 'vencimento')
                  .neq('status', 'cancelado')
                  .neq('status', 'concluido')
                  .gte('data_inicio', agora.toISOString())
                  .lte('data_inicio', em7d.toISOString())
                  .order('data_inicio'),
                // Cartões PF com dia_vencimento (podem não ter evento na agenda)
                (supabase.from('contas') as any)
                  .select('nome, dia_vencimento, bandeira')
                  .eq('user_id', uid).eq('ativo', true)
                  .in('tipo', ['cartao_credito', 'cartao_debito'])
                  .not('dia_vencimento', 'is', null),
                // Contas fixas recorrentes (compromissos_fixos — tabela unificada)
                (supabase.from('compromissos_fixos') as any)
                  .select('descricao, dia_vencimento, valor, tipo_detalhe')
                  .eq('user_id', uid).eq('ativo', true)
                  .eq('recorrente', true),
              ])

              // Mesclar: agenda + cartões + alertas que vencem nos próximos 7 dias
              const diaHoje = agora.getDate()
              const mesAtual = agora.getMonth()
              const anoAtual = agora.getFullYear()

              // Títulos já presentes na agenda (evita duplicatas)
              const titulosAgenda = new Set(
                (venc7d || []).map((ev: any) => (ev.titulo || '').toLowerCase().replace(/[💳📄🚰💡📡📱🏠🏢💊🏦📋⚡]/g, '').trim())
              )

              // Cartões PF: inclui se dia_vencimento está nos próximos 7 dias e não tem evento
              const cartoesVenc: any[] = []
              ;(cartoesPf || []).forEach((c: any) => {
                const dia = c.dia_vencimento
                if (!dia) return
                const dataVenc = new Date(anoAtual, mesAtual, dia)
                // Se já passou neste mês, considerar próximo mês
                if (dataVenc < agora) dataVenc.setMonth(dataVenc.getMonth() + 1)
                if (dataVenc >= agora && dataVenc <= em7d) {
                  const nomeNorm = (c.nome || '').toLowerCase()
                  const jaTemEvento = [...titulosAgenda].some(t => t.includes(nomeNorm) || nomeNorm.includes(t))
                  if (!jaTemEvento) {
                    cartoesVenc.push({ titulo: `💳 Fatura ${c.nome}${c.bandeira ? ` (${c.bandeira})` : ''}`, data_inicio: dataVenc.toISOString() })
                  }
                }
              })

              // Compromissos fixos: inclui se dia_vencimento está nos próximos 7 dias e não tem evento
              const alertasVenc: any[] = []
              ;(alertasRec || []).forEach((a: any) => {
                const dia = a.dia_vencimento
                if (!dia) return
                const dataVenc = new Date(anoAtual, mesAtual, dia)
                if (dataVenc < agora) dataVenc.setMonth(dataVenc.getMonth() + 1)
                if (dataVenc >= agora && dataVenc <= em7d) {
                  const descNorm = (a.descricao || '').toLowerCase()
                  const jaTemEvento = [...titulosAgenda].some(t => t.includes(descNorm) || descNorm.includes(t))
                  if (!jaTemEvento) {
                    const emojiMap: Record<string, string> = {
                      agua: '🚰', energia: '💡', internet: '📡', telefone: '📱',
                      aluguel: '🏠', condominio: '🏢', plano_saude: '💊',
                      financiamento: '🏦', boleto: '📄', cartao: '💳', outro: '📋',
                    }
                    const emoji = emojiMap[a.tipo_detalhe] || '📋'
                    const valorStr = a.valor ? ` — R$ ${Number(a.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''
                    alertasVenc.push({ titulo: `${emoji} ${a.descricao}${valorStr}`, data_inicio: dataVenc.toISOString() })
                  }
                }
              })

              // Combina tudo e ordena por data
              const todosVenc = [...(venc7d || []), ...cartoesVenc, ...alertasVenc]
                .sort((a: any, b: any) => new Date(a.data_inicio).getTime() - new Date(b.data_inicio).getTime())

              const vencReais = todosVenc.filter((ev: any) => {
                const t = (ev.titulo || '').toLowerCase()
                return !t.includes('confirmação') && !t.includes('pagou') && !t.startsWith('✅')
              })

              // 3. Saldo financeiro do mês + investimentos
              const inicioMes = `${hojeIso.substring(0, 7)}-01`
              const [{ data: gastosM }, { data: receitasM }, { data: ativosBriefing }] = await Promise.all([
                (supabase.from('gastos_pessoais') as any)
                  .select('valor').eq('user_id', uid).gte('data', inicioMes),
                (supabase.from('receitas_pessoais') as any)
                  .select('valor').eq('user_id', uid).gte('data', inicioMes),
                (supabase.from('ativos') as any)
                  .select('ticker, nome, tipo, valor_investido, valor_atual, data_vencimento')
                  .order('valor_investido', { ascending: false }),
              ])
              const totalGastos = (gastosM || []).reduce((s: number, g: any) => s + Number(g.valor), 0)
              const totalReceitas = (receitasM || []).reduce((s: number, r: any) => s + Number(r.valor), 0)
              const saldoMes = totalReceitas - totalGastos
              const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

              // 4. Monta o briefing
              const diaSemana = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
              let briefing = `${saudacao}, Sr. Max! 👋\n`
              briefing += `📅 Hoje é **${diaSemana}**\n\n`

              // Agenda do dia
              const eventosHojeList = (eventosHoje || [])
              if (eventosHojeList.length > 0) {
                briefing += `📌 **Sua agenda de hoje:**\n`
                eventosHojeList.forEach((ev: any) => {
                  const hora = new Date(ev.data_inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                  briefing += `  • ${hora}h — ${ev.titulo}\n`
                })
                briefing += '\n'
              } else {
                briefing += `📌 **Agenda:** Dia livre — nenhum compromisso agendado.\n\n`
              }

              // Vencimentos urgentes
              if (vencReais.length > 0) {
                briefing += `⚠️ **Vencimentos nos próximos 7 dias:**\n`
                const hoje0h = new Date(agora)
              hoje0h.setHours(0, 0, 0, 0)
              const hoje0hTs = hoje0h.getTime()

              vencReais.forEach((ev: any) => {
                const dt = new Date(ev.data_inicio)
                const diffDias = Math.ceil((dt.getTime() - hoje0hTs) / (24 * 60 * 60 * 1000))
                const dtFmt = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                const quando = diffDias === 0 ? '**HOJE**' : diffDias === 1 ? 'amanhã' : `em ${diffDias} dias`
                const urgencia = diffDias <= 2 ? '🔴' : '🟡'
                briefing += `  ${urgencia} [${dtFmt}] ${ev.titulo} — ${quando}\n`
              })
                briefing += '\n'
              }

              // Financeiro do mês
              briefing += `💰 **Financeiro do mês:**\n`
              briefing += `  • Entradas: ${fmt(totalReceitas)}\n`
              briefing += `  • Saídas: ${fmt(totalGastos)}\n`
              briefing += `  • Saldo: ${saldoMes >= 0 ? '🟢' : '🔴'} **${fmt(saldoMes)}**\n\n`

              // Investimentos
              const ativosB = ativosBriefing || []
              if (ativosB.length > 0) {
                const totalInv = ativosB.reduce((s: number, a: any) => s + (Number(a.valor_investido) || 0), 0)
                const totalMerc = ativosB.reduce((s: number, a: any) => s + (Number(a.valor_atual) || Number(a.valor_investido) || 0), 0)
                const valorizB = totalMerc - totalInv
                briefing += `📈 **Carteira de investimentos:**\n`
                briefing += `  • Investido: ${fmt(totalInv)}\n`
                briefing += `  • Mercado: ${fmt(totalMerc)}\n`
                briefing += `  • ${valorizB >= 0 ? '🟢 +' : '🔴 '}${fmt(Math.abs(valorizB))} (${totalInv > 0 ? ((valorizB / totalInv) * 100).toFixed(1) : '0'}%)\n`

                // Ativos vencendo em 7 dias
                const em7dInv = new Date(agora.getTime() + 7 * 24 * 60 * 60 * 1000)
                const vencInv = ativosB.filter((a: any) => {
                  if (!a.data_vencimento) return false
                  const dv = new Date(a.data_vencimento)
                  return dv >= agora && dv <= em7dInv
                })
                if (vencInv.length > 0) {
                  briefing += `\n  ⏰ **Investimentos vencendo em 7 dias:**\n`
                  vencInv.forEach((a: any) => {
                    const dtV = new Date(a.data_vencimento).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                    briefing += `    📌 [${dtV}] ${a.ticker || a.nome} — ${fmt(Number(a.valor_investido) || 0)}\n`
                  })
                }
                briefing += '\n'
              }

              briefing += `_Como posso ajudá-lo hoje, Sr. Max?_ 💼`

              setMensagens(prev => {
                // Evita duplicar se já existe o briefing hoje
                const jaTemBriefing = prev.some(m => m.texto?.includes('Bom dia, Sr. Max') || m.texto?.includes('Boa tarde, Sr. Max') || m.texto?.includes('Boa noite, Sr. Max'))
                if (jaTemBriefing) return prev
                return [...prev, {
                  id: `briefing-${Date.now()}`,
                  role: 'ai' as const,
                  texto: briefing,
                }]
              })
            } catch { /* silencioso — não bloqueia se falhar */ }
          }, 1500) // Delay de 1,5s para carregar após o histórico
        }
      }
    })

    // Carrega colaboradores ativos
    supabase.from('funcionarios').select('id, nome').eq('ativo', true).then(({ data }) => {
      if (data) setColaboradores(data as { id: string; nome: string }[])
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Salvar histórico no banco ─────────────────────────────────
  const salvarHistorico = async (uid: string, role: 'ai' | 'user', texto: string, acoes?: any[], sid?: string) => {
    if (!uid || !texto || texto === '...') return
    try {
      await (supabase.from('elena_conversas') as any).insert({
        user_id: uid,
        sessao_id: sid || sessaoIdRef.current,
        role,
        texto: texto.substring(0, 4000),
        acoes: acoes ?? null,
      })
    } catch { /* silencioso */ }
  }

  // ── Mic autorizado ────────────────────────────────────────────
  const salvarMicAutorizado = async (uid: string) => {
    try {
      localStorage.setItem('elena_mic_ok', '1')
      await (supabase.from('perfis') as any).update({ mic_autorizado: true }).eq('id', uid)
    } catch { /* silencioso */ }
  }

  // ── Histórico de sessões ──────────────────────────────────────
  const loadSessoes = async () => {
    const uid = userIdRef.current
    if (!uid) return
    const { data } = await supabase
      .from('elena_conversas')
      .select('sessao_id, created_at, texto, role')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(200)

    const agrupado = new Map<string, { data: string; resumo: string }>()
    if (data) {
      const dataReversa = [...(data as any[])].reverse()
      dataReversa.forEach((m: any) => {
        if (!agrupado.has(m.sessao_id)) {
          agrupado.set(m.sessao_id, { data: m.created_at, resumo: m.texto })
        } else if (m.role === 'user' && (!agrupado.get(m.sessao_id)?.resumo || agrupado.get(m.sessao_id)!.resumo.includes('Olá, Sr. Max'))) {
          agrupado.set(m.sessao_id, { data: m.created_at, resumo: m.texto })
        }
      })
    }

    const arraySessoes = Array.from(agrupado.entries())
      .map(([sid, info]) => ({ sid, ...info }))
      .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())

    setSessoesAnteriores(arraySessoes)
    setShowHistory(true)
  }

  const loadSpecificSession = async (sid: string) => {
    const uid = userIdRef.current
    const { data: hist } = await (supabase.from('elena_conversas') as any)
      .select('id, role, texto, acoes, created_at')
      .eq('user_id', uid)
      .eq('sessao_id', sid)
      .order('created_at', { ascending: false })
      .limit(40)

    if (hist && hist.length > 0) {
      const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
        id: r.id,
        role: r.role as 'ai' | 'user',
        texto: r.texto,
        acoes: r.acoes ?? undefined,
        created_at: r.created_at,
      }))
      setMensagens([{ id: '1', role: 'ai', texto: 'Histórico carregado! O que faremos com ele?' }, ...historico])
      setSessaoId(sid)
      localStorage.setItem(`elena_sessao_id_${uid}`, sid)
      setShowHistory(false)
    }
  }

  const handleClearChat = () => {
    // Não pede confirmação — histórico sempre salvo no banco automaticamente
    setMensagens([SAUDACAO_INICIAL])
    const newSid = Date.now().toString()
    setSessaoId(newSid)
    localStorage.setItem(`elena_sessao_id_${userIdRef.current}`, newSid)
  }

  return {
    userIdRef, sessaoIdRef,
    userId, sessaoId, setUserId, setSessaoId,
    mensagens, setMensagens,
    perfilRef,
    colaboradores,
    sessoesAnteriores, showHistory, setShowHistory,
    loadSessoes, loadSpecificSession, handleClearChat,
    micPermitidoRef, salvarMicAutorizado,
    salvarHistorico,
  }
}

