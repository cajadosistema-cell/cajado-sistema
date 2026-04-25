'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type AuditEntry = {
  id: string
  tabela: string
  registro_id: string
  acao: 'create' | 'update' | 'delete'
  valores_anteriores: Record<string, unknown> | null
  valores_novos: Record<string, unknown> | null
  user_id: string | null
  created_at: string
}

const ACAO_COLOR: Record<AuditEntry['acao'], string> = {
  create: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  update: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  delete: 'text-red-400 bg-red-500/10 border-red-500/20',
}

const ACAO_LABEL: Record<AuditEntry['acao'], string> = {
  create: 'Criado',
  update: 'Alterado',
  delete: 'Excluído',
}

const TABELA_LABEL: Record<string, string> = {
  lancamentos: 'Lançamento',
  contas: 'Conta',
  categorias_financeiras: 'Categoria',
  pagamentos_parciais: 'Entrada parcial',
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function DiffViewer({ anterior, novo }: {
  anterior: Record<string, unknown> | null
  novo: Record<string, unknown> | null
}) {
  if (!anterior && !novo) return null
  const todas = new Set([...Object.keys(anterior ?? {}), ...Object.keys(novo ?? {})])
  const campos = ['descricao', 'valor', 'tipo', 'status', 'data_competencia', 'regime']
  const filtradas = Array.from(todas).filter(k => campos.includes(k))

  if (filtradas.length === 0) return null

  return (
    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
      {filtradas.map(campo => {
        const v_antes = anterior?.[campo]
        const v_depois = novo?.[campo]
        const mudou = JSON.stringify(v_antes) !== JSON.stringify(v_depois)
        if (!mudou && v_antes === undefined) return null
        return (
          <div key={campo} className="bg-sidebar/50 rounded-lg px-3 py-2 text-xs">
            <p className="text-fg-disabled capitalize mb-1">{campo.replace('_', ' ')}</p>
            {mudou ? (
              <div className="flex items-center gap-2">
                <span className="text-red-400 line-through">{String(v_antes ?? '—')}</span>
                <span className="text-fg-tertiary">→</span>
                <span className="text-emerald-400">{String(v_depois ?? '—')}</span>
              </div>
            ) : (
              <span className="text-fg-secondary">{String(v_depois ?? v_antes ?? '—')}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function SecaoAuditoria() {
  const supabase = createClient()
  const [logs, setLogs] = useState<AuditEntry[]>([])
  const [carregando, setCarregando] = useState(true)
  const [filtroTabela, setFiltroTabela] = useState<string>('lancamentos')
  const [expandido, setExpandido] = useState<string | null>(null)

  useEffect(() => {
    const carregar = async () => {
      setCarregando(true)
      const { data } = await (supabase.from('audit_log') as any)
        .select('*')
        .eq('tabela', filtroTabela)
        .order('created_at', { ascending: false })
        .limit(50)
      setLogs(data ?? [])
      setCarregando(false)
    }
    carregar()
  }, [filtroTabela])

  return (
    <div className="bg-surface border border-white/5 rounded-xl p-5 lg:col-span-3">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="section-title mb-0">🔍 Auditoria de Alterações</h2>
          <p className="text-xs text-fg-disabled mt-0.5">Histórico completo de criações, edições e exclusões</p>
        </div>
        {/* Filtro por tabela */}
        <div className="flex gap-1 bg-page border border-border-subtle rounded-xl p-1">
          {Object.entries(TABELA_LABEL).map(([k, v]) => (
            <button
              key={k}
              onClick={() => setFiltroTabela(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filtroTabela === k ? 'bg-muted text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-fg-disabled">Carregando auditoria...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-fg-disabled">Nenhum registro de auditoria para esta tabela.</p>
          <p className="text-xs text-zinc-700 mt-1">A auditoria é registrada automaticamente via trigger no banco de dados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map(log => (
            <div
              key={log.id}
              className="border border-white/5 bg-black/20 rounded-xl p-4 cursor-pointer hover:border-border-subtle transition-colors"
              onClick={() => setExpandido(expandido === log.id ? null : log.id)}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${ACAO_COLOR[log.acao]}`}>
                    {ACAO_LABEL[log.acao]}
                  </span>
                  <div>
                    <p className="text-sm text-fg-secondary">
                      {TABELA_LABEL[log.tabela] ?? log.tabela}
                      <span className="text-fg-disabled text-xs ml-1">#{log.registro_id.slice(0, 8)}…</span>
                    </p>
                    <p className="text-xs text-fg-disabled">{formatTs(log.created_at)}</p>
                  </div>
                </div>
                <span className="text-fg-disabled text-xs">{expandido === log.id ? '▲' : '▼'}</span>
              </div>

              {expandido === log.id && (
                <DiffViewer
                  anterior={log.valores_anteriores}
                  novo={log.valores_novos}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
