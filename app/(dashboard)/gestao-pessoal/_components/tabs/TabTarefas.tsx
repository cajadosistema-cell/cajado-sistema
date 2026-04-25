'use client'

import { createClient } from '@/lib/supabase/client'
import type { Tarefa, Colaborador } from '../types'
import { STATUS_TAREFA_LABEL, PRIORIDADE_COLOR } from '../types'

type Props = {
  tarefas: Tarefa[]
  colaboradores: Colaborador[]
  onUpdate: () => void
  onNova: () => void
}

const COLUNAS: { status: Tarefa['status']; label: string; color: string }[] = [
  { status: 'a_fazer',      label: 'A Fazer',       color: 'border-border-subtle' },
  { status: 'em_andamento', label: 'Em Andamento',  color: 'border-blue-500/40' },
  { status: 'concluida',    label: 'Concluída',     color: 'border-emerald-500/40' },
]

function formatPrazo(data: string | null): string {
  if (!data) return ''
  const hoje = new Date()
  const prazo = new Date(data)
  const diff = Math.ceil((prazo.getTime() - hoje.getTime()) / 86400000)
  if (diff < 0) return `⚠️ ${Math.abs(diff)}d atrasada`
  if (diff === 0) return '🔴 Hoje'
  if (diff === 1) return '🟡 Amanhã'
  return `📅 ${prazo.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}`
}

function nomeColaborador(id: string | null, colaboradores: Colaborador[]): string {
  if (!id) return '—'
  return colaboradores.find(c => c.id === id)?.nome.split(' ')[0] ?? '—'
}

export function TabTarefas({ tarefas, colaboradores, onUpdate, onNova }: Props) {
  const supabase = createClient()

  const moverTarefa = async (id: string, novoStatus: Tarefa['status']) => {
    await (supabase.from('tarefas') as any).update({ status: novoStatus }).eq('id', id)
    onUpdate()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-fg-tertiary">{tarefas.filter(t => t.status !== 'cancelada').length} tarefas ativas</p>
        <button onClick={onNova} className="btn-primary text-xs">+ Nova Tarefa</button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLUNAS.map(col => {
          const items = tarefas.filter(t => t.status === col.status)
          return (
            <div key={col.status} className={`bg-page border-2 ${col.color} rounded-2xl p-4 min-h-[300px]`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-fg-secondary">{col.label}</h3>
                <span className="text-xs bg-muted text-fg-secondary px-2 py-0.5 rounded-full">{items.length}</span>
              </div>

              <div className="space-y-3">
                {items.length === 0 ? (
                  <p className="text-xs text-zinc-700 text-center py-8">Vazio</p>
                ) : (
                  items.map(t => (
                    <div key={t.id} className="bg-muted/60 border border-border-subtle/50 rounded-xl p-3 group hover:border-zinc-600 transition-colors">
                      {/* Prioridade badge */}
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${PRIORIDADE_COLOR[t.prioridade]}`}>
                        {t.prioridade.toUpperCase()}
                      </span>

                      <p className="text-sm font-medium text-fg mt-2">{t.titulo}</p>
                      {t.descricao && <p className="text-xs text-fg-tertiary mt-1 line-clamp-2">{t.descricao}</p>}

                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-surface-hover flex items-center justify-center text-[9px] text-fg-secondary font-bold">
                            {nomeColaborador(t.responsavel_id, colaboradores)[0] || '?'}
                          </div>
                          <span className="text-[11px] text-fg-tertiary">{nomeColaborador(t.responsavel_id, colaboradores)}</span>
                        </div>
                        {t.prazo && <span className="text-[11px] text-fg-tertiary">{formatPrazo(t.prazo)}</span>}
                      </div>

                      {/* Mover para próxima coluna */}
                      <div className="flex gap-1.5 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        {col.status !== 'a_fazer' && (
                          <button
                            onClick={() => moverTarefa(t.id, col.status === 'em_andamento' ? 'a_fazer' : 'em_andamento')}
                            className="text-[10px] text-fg-tertiary hover:text-fg-secondary px-2 py-1 bg-muted rounded-lg border border-border-subtle transition-colors"
                          >
                            ← Voltar
                          </button>
                        )}
                        {col.status !== 'concluida' && (
                          <button
                            onClick={() => moverTarefa(t.id, col.status === 'a_fazer' ? 'em_andamento' : 'concluida')}
                            className="text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20 transition-colors ml-auto"
                          >
                            {col.status === 'a_fazer' ? 'Iniciar →' : 'Concluir ✓'}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Canceladas (colapsável) */}
      {tarefas.filter(t => t.status === 'cancelada').length > 0 && (
        <p className="text-xs text-fg-disabled text-center">
          + {tarefas.filter(t => t.status === 'cancelada').length} tarefa(s) cancelada(s)
        </p>
      )}
    </div>
  )
}
