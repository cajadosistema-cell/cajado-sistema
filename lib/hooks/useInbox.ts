'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

const API = process.env.NEXT_PUBLIC_INBOX_API_URL || 'https://visiopro-unified01-production.up.railway.app'
const INBOX_TOKEN_KEY = 'cajado_inbox_token'

// ── Tipos ──────────────────────────────────────────────────────

export interface Conversa {
  numero: string
  nome: string
  etiqueta: string
  botOn: boolean
  unread: number
  ultimaMensagem: string
  ultimoHorario: string
  setor: string | null
  assumido_nome: string | null
}

export interface Mensagem {
  id: string
  tipo: 'recebida' | 'enviada' | 'bot' | 'interna'
  texto: string
  numero: string
  timestamp: string
}

export interface ConversaDetalhada extends Conversa {
  mensagens: Mensagem[]
}

export interface Time {
  id: string
  nome: string
  cor: string
  emoji: string
}

// ── Auth com o backend Railway ─────────────────────────────────

export async function loginInbox(email: string, senha: string) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha, password: senha }),
  })
  if (!res.ok) throw new Error('Credenciais inválidas para o Inbox')
  const data = await res.json()
  if (typeof window !== 'undefined') {
    localStorage.setItem(INBOX_TOKEN_KEY, data.token)
  }
  return data
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(INBOX_TOKEN_KEY)
}

async function apiGet<T>(path: string): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Inbox API error: ${res.status}`)
  return res.json()
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Inbox API error: ${res.status}`)
  return res.json()
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const token = getToken()
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Inbox API error: ${res.status}`)
  return res.json()
}

// ── Hook principal ─────────────────────────────────────────────

export function useInbox() {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchConversas = useCallback(async () => {
    const token = getToken()
    if (!token) {
      setLoading(false)
      return
    }
    try {
      const data = await apiGet<Conversa[]>('/inbox/conversas')
      setConversas(data.sort((a, b) => (b.unread || 0) - (a.unread || 0)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar conversas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchConversas()
    intervalRef.current = setInterval(fetchConversas, 5000) // polling 5s
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchConversas])

  return { conversas, loading, error, refetch: fetchConversas }
}

// ── Hook de conversa individual ────────────────────────────────

export function useConversaDetalhe(numero: string | null) {
  const [conversa, setConversa] = useState<ConversaDetalhada | null>(null)
  const [loading, setLoading] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetch = useCallback(async () => {
    if (!numero) return
    const token = getToken()
    if (!token) return
    
    setLoading(true)
    try {
      const data = await apiGet<ConversaDetalhada>(`/inbox/conversas/${numero}`)
      setConversa(data)
    } catch {
      // silencioso
    } finally {
      setLoading(false)
    }
  }, [numero])

  useEffect(() => {
    if (!numero) { setConversa(null); return }
    fetch()
    intervalRef.current = setInterval(fetch, 3000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [numero, fetch])

  return { conversa, loading, refetch: fetch }
}

// ── Ações ──────────────────────────────────────────────────────

export async function enviarMensagem(numero: string, texto: string) {
  return apiPost('/inbox/enviar', { numero, texto })
}

export async function enviarNota(numero: string, texto: string) {
  return apiPost('/inbox/enviar', { numero, texto, interna: true })
}

export async function toggleBot(numero: string, pausar: boolean) {
  return apiPost(`/inbox/bot/${numero}`, { pausar })
}

export async function humanouAssumiu(numero: string, nome: string) {
  return apiPost(`/webhook/humano-assumiu/${numero}`, { nome })
}

export async function reativarBot(numero: string) {
  return apiPost(`/webhook/reativar-bot/${numero}`, {})
}

export async function mudarEtiqueta(numero: string, etiqueta: string) {
  return apiPatch(`/inbox/conversas/${numero}/etiqueta`, { etiqueta })
}

export async function mudarSetor(numero: string, setor: string) {
  return apiPatch(`/inbox/conversas/${numero}/setor`, { setor })
}

export async function buscarTimes(): Promise<Time[]> {
  return apiGet('/times')
}
