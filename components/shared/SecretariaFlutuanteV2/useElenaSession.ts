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
  texto: 'Olá, Sr. Max! 👋 Sou a **Elena**, sua Secretária Executiva.\n\nPosso **registrar gastos, receitas, agenda e ocorrências** direto no sistema.\n\nExemplos:\n• _"Gastei R$ 80 de gasolina no PIX"_\n• _"Agendar reunião amanhã às 14h"_\n• _"Abrir ocorrência de erro para o Pedro"_',
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

        const { data: lastMsg } = await (supabase.from('elena_conversas') as any)
          .select('sessao_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(1)
        const sid = lastMsg?.[0]?.sessao_id ?? Date.now().toString()
        setSessaoId(sid)

        const { data: hist } = await (supabase.from('elena_conversas') as any)
          .select('id, role, texto, acoes, created_at, sessao_id')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(60)

        if (hist && hist.length > 0) {
          const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
            id: r.id,
            role: r.role as 'ai' | 'user',
            texto: r.texto,
            acoes: r.acoes ?? undefined,
            created_at: r.created_at,
          }))
          setMensagens([
            { id: '1', role: 'ai', texto: 'Olá, Sr. Max! 👋 Carreguei o histórico recente. O que faremos agora?' },
            ...historico,
          ])
        }

        // Carrega perfil de aprendizado
        const { data: perfil } = await (supabase.from('elena_perfil') as any)
          .select('*').eq('user_id', uid).maybeSingle()
        if (perfil) perfilRef.current = perfil
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
      setShowHistory(false)
    }
  }

  const handleClearChat = () => {
    if (!confirm('Deseja iniciar um NOVO assunto? O assunto atual ficará salvo no banco para consultas futuras.')) return
    setMensagens([SAUDACAO_INICIAL])
    setSessaoId(Date.now().toString())
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
