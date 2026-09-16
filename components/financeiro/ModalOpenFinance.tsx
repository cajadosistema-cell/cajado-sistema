'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'

interface ConexaoOF {
  id: string
  item_id: string
  connector_id?: number
  connector_name: string
  connector_logo_url?: string
  connector_color?: string
  status: string
  last_sync_at?: string
  error_message?: string
  contas?: Array<{
    id: string
    nome: string
    tipo: string
    saldo_atual: number
    open_finance_id?: string
  }>
}

interface ModalOpenFinanceProps {
  categoria?: 'pf' | 'pj'
  onClose: () => void
  onSuccess?: () => void
}

const BANCOS_POPULARES = [
  { id: 201, name: 'Nubank', color: '#820ad1', logo: '🟣' },
  { id: 2, name: 'Banco Itaú', color: '#ec7000', logo: '🟧' },
  { id: 208, name: 'Banco Bradesco', color: '#cc092f', logo: '🔴' },
  { id: 1, name: 'Banco do Brasil', color: '#fcee21', logo: '🟡' },
  { id: 3, name: 'Banco Santander', color: '#e00000', logo: '🔺' },
  { id: 41, name: 'Banco Inter', color: '#ff7a00', logo: '🟠' },
  { id: 70, name: 'C6 Bank', color: '#242424', logo: '⚫' },
  { id: 102, name: 'XP Investimentos', color: '#000000', logo: '📈' },
]

export function ModalOpenFinance({ categoria = 'pj', onClose, onSuccess }: ModalOpenFinanceProps) {
  const [conexoes, setConexoes] = useState<ConexaoOF[]>([])
  const [loading, setLoading] = useState(true)
  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [modalConectar, setModalConectar] = useState(false)
  const [bancoSelecionado, setBancoSelecionado] = useState<typeof BANCOS_POPULARES[0] | null>(null)
  const [conectando, setConectando] = useState(false)
  const [feedbackMsg, setFeedbackMsg] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  const carregarConexoes = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/open-finance/conexoes?categoria=${categoria}`)
      const data = await res.json()
      if (data.conexoes) {
        setConexoes(data.conexoes)
      }
    } catch (err: any) {
      console.error('Erro ao carregar conexões:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarConexoes()

    // Carrega dinamicamente o script oficial do Pluggy Connect
    if (typeof window !== 'undefined' && !document.getElementById('pluggy-connect-script')) {
      const script = document.createElement('script')
      script.id = 'pluggy-connect-script'
      script.src = 'https://cdn.pluggy.ai/pluggy-connect/v1/pluggy-connect.js'
      script.async = true
      document.body.appendChild(script)
    }
  }, [carregarConexoes])

  // Inicia fluxo de conexão
  const handleIniciarConexao = async (banco?: typeof BANCOS_POPULARES[0]) => {
    try {
      setConectando(true)
      setFeedbackMsg(null)

      // 1. Obter Connect Token
      const resToken = await fetch('/api/open-finance/connect-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const dataToken = await resToken.json()

      if (!resToken.ok || !dataToken.connectToken) {
        throw new Error(dataToken.error || 'Não foi possível gerar token de conexão')
      }

      // Se for ambiente Pluggy Real: abrir o widget oficial
      if (!dataToken.isMock && typeof window !== 'undefined') {
        const getPluggyConstructor = async (): Promise<any> => {
          if ((window as any).PluggyConnect) return (window as any).PluggyConnect
          return new Promise((resolve) => {
            const check = setInterval(() => {
              if ((window as any).PluggyConnect) {
                clearInterval(check)
                resolve((window as any).PluggyConnect)
              }
            }, 100)
            setTimeout(() => { clearInterval(check); resolve(null) }, 6000)
          })
        }

        const PluggyConstructor = await getPluggyConstructor()
        if (PluggyConstructor) {
          const pluggyConnect = new PluggyConstructor({
            connectToken: dataToken.connectToken,
            onSuccess: async (itemData: any) => {
              setFeedbackMsg({ tipo: 'success', texto: 'Sincronizando contas do banco...' })
              const resSave = await fetch('/api/open-finance/conexoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  itemId: itemData.item.id,
                  connector: itemData.item.connector,
                  categoria,
                }),
              })
              const resData = await resSave.json()
              if (resSave.ok) {
                setFeedbackMsg({ tipo: 'success', texto: '✅ Banco conectado com sucesso! Saldos e extratos sincronizados.' })
              } else {
                setFeedbackMsg({ tipo: 'error', texto: resData.error || 'Erro ao salvar contas do banco' })
              }
              setModalConectar(false)
              await carregarConexoes()
              onSuccess?.()
            },
            onError: (error: any) => {
              setFeedbackMsg({ tipo: 'error', texto: 'Erro ao conectar banco: ' + (error?.message || 'Falha na conexão') })
            },
            onClose: () => {
              setConectando(false)
            },
          })
          pluggyConnect.init()
          return
        }
      }

      // Modo Simulado / Mock para Testes Imediatos
      const bancoEscolhido = banco || bancoSelecionado || BANCOS_POPULARES[0]
      const mockItemId = `mock_item_${bancoEscolhido.name.toLowerCase().replace(/\s+/g, '_')}_${Date.now()}`

      const resSave = await fetch('/api/open-finance/conexoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemId: mockItemId,
          categoria,
          connector: {
            id: bancoEscolhido.id,
            name: bancoEscolhido.name,
            primaryColor: bancoEscolhido.color,
          },
        }),
      })

      const resSaveData = await resSave.json()
      if (!resSave.ok) {
        throw new Error(resSaveData.error || 'Erro ao registrar conexão simulada')
      }

      setFeedbackMsg({
        tipo: 'success',
        texto: `✅ ${bancoEscolhido.name} conectado com sucesso! Contas e extratos foram importados automaticamente.`,
      })
      setModalConectar(false)
      setBancoSelecionado(null)
      await carregarConexoes()
      onSuccess?.()
    } catch (err: any) {
      setFeedbackMsg({ tipo: 'error', texto: err.message || 'Erro inesperado' })
    } finally {
      setConectando(false)
    }
  }

  // Sincronizar conexão sob demanda
  const handleSincronizar = async (conexaoId: string) => {
    try {
      setSyncingId(conexaoId)
      setFeedbackMsg(null)
      const res = await fetch('/api/open-finance/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conexaoId }),
      })
      const data = await res.json()
      if (res.ok) {
        setFeedbackMsg({
          tipo: 'success',
          texto: `🔄 Sincronização concluída! ${data.contasAtualizadas || 0} conta(s) atualizada(s) e ${data.novasTransacoes || 0} novo(s) lançamento(s).`,
        })
        await carregarConexoes()
        onSuccess?.()
      } else {
        setFeedbackMsg({ tipo: 'error', texto: data.error || 'Erro ao sincronizar' })
      }
    } catch (err: any) {
      setFeedbackMsg({ tipo: 'error', texto: err.message })
    } finally {
      setSyncingId(null)
    }
  }

  // Desconectar banco
  const handleDesconectar = async (conexao: ConexaoOF) => {
    if (!confirm(`Deseja realmente desconectar o banco ${conexao.connector_name}?\n\nOs lançamentos já importados serão preservados no sistema.`)) {
      return
    }

    try {
      setRemovingId(conexao.id)
      const res = await fetch(`/api/open-finance/conexoes?id=${conexao.id}`, { method: 'DELETE' })
      if (res.ok) {
        setFeedbackMsg({ tipo: 'success', texto: `Conexão com ${conexao.connector_name} removida.` })
        await carregarConexoes()
        onSuccess?.()
      } else {
        const d = await res.json()
        setFeedbackMsg({ tipo: 'error', texto: d.error || 'Erro ao desconectar' })
      }
    } catch (err: any) {
      setFeedbackMsg({ tipo: 'error', texto: err.message })
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-[#12141a] border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg shadow-inner">
              ⚡
            </div>
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                Open Finance Brasil
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Pluggy API
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Sincronização automática de saldos, extratos bancários e faturas de cartão
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl leading-none px-2 py-1">
            ×
          </button>
        </div>

        {/* Feedback message */}
        {feedbackMsg && (
          <div
            className={cn(
              'px-6 py-3 text-xs flex items-center justify-between border-b transition-all',
              feedbackMsg.tipo === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                : 'bg-red-500/10 text-red-300 border-red-500/20'
            )}
          >
            <span>{feedbackMsg.texto}</span>
            <button onClick={() => setFeedbackMsg(null)} className="opacity-60 hover:opacity-100">
              ✕
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Active Connections List */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Bancos Conectados ({conexoes.length})
              </h3>
              <button
                onClick={() => setModalConectar(true)}
                className="text-xs font-medium px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md flex items-center gap-1.5"
              >
                <span>+</span> Conectar Banco
              </button>
            </div>

            {loading ? (
              <div className="py-12 text-center text-gray-500 text-xs flex items-center justify-center gap-2">
                <span className="animate-spin text-base">🔄</span> Carregando conexões bancárias...
              </div>
            ) : conexoes.length === 0 ? (
              <div className="border border-dashed border-white/10 rounded-2xl p-8 text-center bg-white/[0.02]">
                <div className="text-3xl mb-2">🏦</div>
                <p className="text-sm font-medium text-white mb-1">Nenhum banco conectado ainda</p>
                <p className="text-xs text-gray-400 max-w-sm mx-auto mb-4">
                  Conecte seu banco via Open Finance para atualizar saldos e puxar lançamentos automaticamente, sem precisar de arquivos OFX.
                </p>
                <button
                  onClick={() => setModalConectar(true)}
                  className="btn-primary text-xs px-4 py-2"
                >
                  ⚡ Conectar Meu Primeiro Banco
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {conexoes.map((c) => {
                  const isSyncing = syncingId === c.id
                  const isRemoving = removingId === c.id

                  return (
                    <div
                      key={c.id}
                      className="border border-white/10 rounded-xl p-4 bg-white/[0.03] hover:bg-white/[0.05] transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-md"
                            style={{ background: c.connector_color || '#2563eb' }}
                          >
                            {c.connector_name.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-white">{c.connector_name}</h4>
                              <span
                                className={cn(
                                  'text-[10px] px-2 py-0.5 rounded-full font-medium',
                                  c.status === 'UPDATED'
                                    ? 'bg-emerald-500/20 text-emerald-300'
                                    : c.status === 'UPDATING'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-red-500/20 text-red-300'
                                )}
                              >
                                {c.status === 'UPDATED'
                                  ? '🟢 Conectado'
                                  : c.status === 'UPDATING'
                                  ? '🔄 Sincronizando'
                                  : '⚠️ Requer Ação'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                              {c.last_sync_at
                                ? `Última sincronização: ${formatDate(c.last_sync_at)} às ${new Date(c.last_sync_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                                : 'Aguardando sincronização inicial'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSincronizar(c.id)}
                            disabled={isSyncing}
                            className="text-xs px-2.5 py-1.5 rounded-lg border border-white/10 hover:border-blue-500/40 hover:bg-blue-500/10 text-blue-400 transition-all flex items-center gap-1 disabled:opacity-50"
                            title="Sincronizar saldos e transações agora"
                          >
                            <span className={cn(isSyncing && 'animate-spin')}>🔄</span>
                            <span className="hidden sm:inline">{isSyncing ? 'Atualizando...' : 'Sincronizar'}</span>
                          </button>
                          <button
                            onClick={() => handleDesconectar(c)}
                            disabled={isRemoving}
                            className="text-xs px-2 py-1.5 rounded-lg border border-white/10 hover:border-red-500/40 hover:bg-red-500/10 text-red-400 transition-all disabled:opacity-50"
                            title="Desconectar banco"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>

                      {/* Subcontas vinculadas */}
                      {c.contas && c.contas.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {c.contas.map((acc) => (
                            <div
                              key={acc.id}
                              className="bg-black/20 rounded-lg px-3 py-2 flex items-center justify-between text-xs"
                            >
                              <div className="truncate pr-2">
                                <span className="text-gray-300 font-medium">{acc.nome}</span>
                                <span className="text-[10px] text-gray-500 block capitalize">
                                  {acc.tipo.replace('_', ' ')}
                                </span>
                              </div>
                              <span
                                className={cn(
                                  'font-bold shrink-0',
                                  acc.saldo_atual >= 0 ? 'text-emerald-400' : 'text-red-400'
                                )}
                              >
                                {formatCurrency(acc.saldo_atual)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Institutional Info & Security Banner */}
          <div className="bg-gradient-to-r from-blue-900/15 via-blue-950/10 to-transparent border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
            <div className="text-xl">🔒</div>
            <div className="text-xs text-gray-300 space-y-1">
              <p className="font-semibold text-white">Segurança Regulada pelo Banco Central do Brasil</p>
              <p className="text-gray-400 leading-relaxed">
                As conexões utilizam o padrão Open Finance regulado pelo BACEN. O sistema possui apenas permissão de{' '}
                <strong>leitura</strong> de saldos e extratos. Nenhuma transação bancária ou envio de dinheiro pode ser realizado por aqui.
              </p>
            </div>
          </div>
        </div>

        {/* Modal de Conectar Banco (Seletor de Instituições) */}
        {modalConectar && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="bg-[#161821] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <span>🏦</span> Selecione seu Banco
                </h3>
                <button
                  onClick={() => {
                    setModalConectar(false)
                    setBancoSelecionado(null)
                  }}
                  className="text-gray-400 hover:text-white text-xl"
                >
                  ×
                </button>
              </div>

              <p className="text-xs text-gray-400">
                Escolha a instituição financeira para autorizar a sincronização de saldos e extratos:
              </p>

              <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                {BANCOS_POPULARES.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => setBancoSelecionado(b)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-xl border text-xs font-medium transition-all text-left',
                      bancoSelecionado?.id === b.id
                        ? 'bg-blue-500/20 border-blue-500/50 text-white shadow-md'
                        : 'border-white/10 text-gray-300 hover:border-white/20 hover:bg-white/[0.02]'
                    )}
                  >
                    <span className="text-base">{b.logo}</span>
                    <span className="truncate">{b.name}</span>
                  </button>
                ))}
              </div>

              <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setModalConectar(false)
                    setBancoSelecionado(null)
                  }}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleIniciarConexao(bancoSelecionado || BANCOS_POPULARES[0])}
                  disabled={conectando}
                  className="btn-primary text-xs flex items-center gap-1.5"
                >
                  {conectando ? (
                    <>
                      <span className="animate-spin">🔄</span> Conectando...
                    </>
                  ) : (
                    <>
                      <span>⚡</span> Conectar {bancoSelecionado?.name || 'Banco'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 bg-white/[0.01] flex items-center justify-between">
          <p className="text-[11px] text-gray-500">
            Dúvidas? Pergunte à Elena: <span className="text-gray-400 italic">&ldquo;Elena, atualiza minhas contas bancárias&rdquo;</span>
          </p>
          <button onClick={onClose} className="btn-secondary text-xs px-4 py-2">
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
