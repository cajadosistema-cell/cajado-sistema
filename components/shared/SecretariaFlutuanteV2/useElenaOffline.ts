'use client'
// â”€â”€ useElenaOffline.ts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ResponsÃ¡vel por: detecÃ§Ã£o online/offline, fila IndexedDB, sync ao reconectar,
// formulÃ¡rio de emergÃªncia offline.
// Completamente isolado â€” nÃ£o sabe nada de IA ou voz.

import { useState, useEffect, useCallback } from 'react'
import {
  getPendentes,
  marcarProcessado,
  limparProcessados,
  registrarBackgroundSync,
  enqueueOffline,
} from '@/lib/elena-offline'

interface OfflineFormState {
  tipo: 'gasto' | 'receita' | 'agenda'
  valor: string
  descricao: string
  categoria: string
  data: string
  hora: string
}

interface UseElenaOfflineProps {
  userId: string
  // Callback para executar aÃ§Ãµes (vem do useSalvar para aproveitar a mesma lÃ³gica)
  executarAcoesAuto: (msgId: string, acoes: any[], uid: string) => Promise<void>
  // Callback para adicionar mensagem no chat
  adicionarMensagem: (msg: any) => void
}

interface UseElenaOfflineReturn {
  isOnline: boolean
  offlineQueue: any[]
  offlineForm: OfflineFormState
  setOfflineForm: React.Dispatch<React.SetStateAction<OfflineFormState>>
  offlineSaved: boolean
  salvarOffline: () => Promise<void>
  processarFilaOffline: () => Promise<void>
}

export function useElenaOffline({
  userId,
  executarAcoesAuto,
  adicionarMensagem,
}: UseElenaOfflineProps): UseElenaOfflineReturn {
  const [isOnline, setIsOnline] = useState(true)
  const [offlineQueue, setOfflineQueue] = useState<any[]>([])
  const [offlineSaved, setOfflineSaved] = useState(false)
  const [offlineForm, setOfflineForm] = useState<OfflineFormState>({
    tipo: 'gasto',
    valor: '',
    descricao: '',
    categoria: 'alimentacao',
    data: new Date().toISOString().split('T')[0],
    hora: '12:00',
  })

  // â”€â”€ DetecÃ§Ã£o online/offline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const goOnline  = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online',  goOnline)
    window.addEventListener('offline', goOffline)
    setIsOnline(navigator.onLine)

    const swListener = (event: MessageEvent) => {
      if (event.data?.type === 'ELENA_SYNC_QUEUE') setIsOnline(true)
    }
    navigator.serviceWorker?.addEventListener('message', swListener)
    registrarBackgroundSync()

    return () => {
      window.removeEventListener('online',  goOnline)
      window.removeEventListener('offline', goOffline)
      navigator.serviceWorker?.removeEventListener('message', swListener)
    }
  }, [])

  // â”€â”€ Carrega fila offline ao montar e ao reconectar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (userId) getPendentes(userId).then(setOfflineQueue)
  }, [userId, isOnline])

  // â”€â”€ Processa fila ao reconectar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const processarFilaOffline = useCallback(async () => {
    if (!userId || !navigator.onLine) return
    const pendentes = await getPendentes(userId)
    if (pendentes.length === 0) return

    adicionarMensagem({
      id: 'sync-' + Date.now(),
      role: 'ai' as const,
      texto: `ðŸ“¶ **ConexÃ£o restabelecida!** Encontrei ${pendentes.length} registro(s) salvo(s) offline. Sincronizando agora...`,
    })

    let sucesso = 0
    for (const reg of pendentes) {
      try {
        const msgId = 'offline-sync-' + reg.id
        await executarAcoesAuto(msgId, [{ tipo: reg.tipo, dados: reg.acao, label: '', status: 'pending' }], userId)
        await marcarProcessado(reg.id!)
        sucesso++
      } catch {
        // MantÃ©m na fila â€” tentarÃ¡ novamente na prÃ³xima conexÃ£o
      }
    }

    if (sucesso > 0) {
      await limparProcessados()
      adicionarMensagem({
        id: 'sync-ok-' + Date.now(),
        role: 'ai' as const,
        texto: `âœ… ${sucesso} registro(s) sincronizado(s) com sucesso!`,
      })
    }
  }, [userId, executarAcoesAuto, adicionarMensagem])

  useEffect(() => {
    if (isOnline && userId) {
      const timer = setTimeout(processarFilaOffline, 1500)
      return () => clearTimeout(timer)
    }
  }, [isOnline, userId, processarFilaOffline])

  // â”€â”€ Salvar registro no formulÃ¡rio offline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleRegistrarOffline = useCallback(async () => {
    if (!userId) return
    const { tipo, valor, descricao, categoria, data, hora } = offlineForm
    if (!descricao.trim()) return

    let acao: Record<string, unknown> = {}
    if (tipo === 'agenda') {
      acao = { acao: 'agenda', titulo: descricao, data_inicio: `${data}T${hora}:00`, tipo: 'lembrete' }
    } else {
      const v = parseFloat(valor.replace(',', '.'))
      if (isNaN(v) || v <= 0) return
      acao = { acao: tipo, valor: v, descricao, categoria, forma_pagamento: 'pix' }
    }

    await enqueueOffline(userId, tipo, acao)
    const pendentes = await getPendentes(userId)
    setOfflineQueue(pendentes)
    setOfflineForm(prev => ({ ...prev, valor: '', descricao: '' }))
    setOfflineSaved(true)
    setTimeout(() => setOfflineSaved(false), 2500)
  }, [userId, offlineForm])

  return {
    isOnline,
    offlineQueue,
    offlineForm,
    setOfflineForm,
    offlineSaved,
    processarFilaOffline,
    salvarOffline,
    handleRegistrarOffline,
  }
}

