'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// Usa proxy relativo do Next.js (rewrite em next.config.mjs) — sem CORS, sem variável de build
const API = '/api/inbox-proxy'
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
  lastInboundAt?: string | null
}

export interface Mensagem {
  id: string
  tipo: 'recebida' | 'enviada' | 'bot' | 'interna' | 'audio'
  texto: string
  numero: string
  timestamp: string
  transcricao?: string
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
  const token = await ensureInboxToken()
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`Inbox API error: ${res.status}`)
  return res.json()
}

async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const token = await ensureInboxToken()
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
  const token = await ensureInboxToken()
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

// Auto-login: obtém token via /api/inbox-token (server-side, usa sessão Supabase)
async function ensureInboxToken(): Promise<string | null> {
  const existing = getToken()
  if (existing) return existing
  try {
    const res = await fetch('/api/inbox-token')
    if (!res.ok) return null
    const data = await res.json()
    if (data.token) {
      if (typeof window !== 'undefined') localStorage.setItem(INBOX_TOKEN_KEY, data.token)
      return data.token
    }
  } catch {}
  return null
}

// ── Hook principal ─────────────────────────────────────────────

export function useInbox() {
  const [conversas, setConversas] = useState<Conversa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchConversas = useCallback(async () => {
    // Garante que há um token antes de tentar carregar
    const token = await ensureInboxToken()
    if (!token) {
      setLoading(false)
      setError('Sessão expirada — faça login novamente')
      return
    }
    try {
      const res = await fetch(`${API}/inbox/conversas`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.status === 401) {
        // Token inválido: limpa e tenta renovar na próxima rodada
        if (typeof window !== 'undefined') localStorage.removeItem(INBOX_TOKEN_KEY)
        return
      }
      if (!res.ok) throw new Error(`Inbox API error: ${res.status}`)
      const data: Conversa[] = await res.json()
      setConversas(data.sort((a, b) => (b.unread || 0) - (a.unread || 0)))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar conversas')
    } finally {
      setLoading(false)
    }
  }, [])

  // Zera o unread localmente de imediato (sem esperar próximo polling)
  const clearUnreadLocal = useCallback((numero: string) => {
    setConversas(prev => prev.map(c => c.numero === numero ? { ...c, unread: 0 } : c))
  }, [])

  useEffect(() => {
    fetchConversas()
    intervalRef.current = setInterval(fetchConversas, 5000) // polling 5s
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchConversas])

  return { conversas, loading, error, refetch: fetchConversas, clearUnreadLocal }
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

export async function enviarMensagem(numero: string, texto: string, media?: { url: string, mimetype: string, tipo: string, fileName?: string }) {
  return apiPost('/inbox/enviar', { numero, texto, media })
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
