'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ativarPush, desativarPush, statusPush, type StatusPush } from '@/lib/push'

// ════════════════════════════════════════════════════════════════
// 🔴 BUG CORRIGIDO — O BOTÃO MENTIA
//
// Antes:
//     await fetch('/api/push/subscribe', {...})   // ← retornava HTTP 500
//     setSub(subscription)                         // ← ninguém checava resp.ok
//     setStatus('subscribed')                      // ← "✅ Ativado"
//
// A rota falhava (gravava colunas que não existiam), NADA era salvo, e o
// botão ficava VERDE dizendo "Notificações ativadas". O Sr. Max confiava
// e nunca recebeu um alerta sequer com o app fechado.
//
// Agora: se o servidor recusa, o botão MOSTRA O ERRO e fica desativado.
// ════════════════════════════════════════════════════════════════

export function PushNotificationButton() {
  const supabase = createClient()
  const [status, setStatus] = useState<StatusPush | 'carregando'>('carregando')
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    // Só LÊ o estado. NÃO pede permissão aqui — requestPermission() exige
    // gesto do usuário; Safari/iOS bloqueia se for chamado num useEffect.
    statusPush().then(setStatus)
  }, [])

  const handleAtivar = async () => {
    setStatus('carregando')
    setErro(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.id) throw new Error('Faça login primeiro.')

      await ativarPush(user.id)   // lança erro REAL se o servidor recusar
      setStatus('ativo')
    } catch (e: any) {
      setErro(e?.message || 'Falha ao ativar notificações.')
      setStatus(Notification.permission === 'denied' ? 'negado' : 'inativo')
    }
  }

  const handleDesativar = async () => {
    setStatus('carregando')
    setErro(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await desativarPush(user?.id)
      setStatus('inativo')
    } catch (e: any) {
      setErro(e?.message || 'Falha ao desativar.')
      setStatus('ativo')
    }
  }

  if (status === 'nao_suportado') return null

  return (
    <div className="flex flex-col gap-2">
      {status === 'carregando' && (
        <button disabled className="px-4 py-2 rounded-lg bg-slate-700 text-slate-400 text-sm">
          Verificando…
        </button>
      )}

      {status === 'inativo' && (
        <button
          onClick={handleAtivar}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-900 font-medium text-sm transition"
        >
          🔔 Ativar notificações
        </button>
      )}

      {status === 'ativo' && (
        <button
          onClick={handleDesativar}
          className="px-4 py-2 rounded-lg bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-sm transition hover:bg-emerald-600/30"
        >
          ✅ Notificações ativas — desativar
        </button>
      )}

      {status === 'negado' && (
        <div className="px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          🔕 Notificações bloqueadas neste navegador.
          <div className="text-xs text-red-400/80 mt-1">
            Libere em: cadeado na barra de endereço → Notificações → Permitir.
          </div>
        </div>
      )}

      {/* 🔴 O erro agora APARECE. Antes era engolido por `catch { }`. */}
      {erro && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">
          ❌ {erro}
        </div>
      )}
    </div>
  )
}

export default PushNotificationButton
