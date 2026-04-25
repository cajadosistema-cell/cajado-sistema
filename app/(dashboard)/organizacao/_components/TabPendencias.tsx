'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { EmptyState } from '@/components/shared/ui'
import { formatDate } from '@/lib/utils'

type Pendencia = {
  id: string
  projeto_id: string | null
  descricao: string
  responsavel: string | null
  prazo: string | null
  status: 'aberta' | 'em_andamento' | 'concluida' | 'cancelada'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  created_at: string
}

type Projeto = {
  id: string
  titulo: string
  status: string
}

const PRIORIDADE_CONFIG = {
  baixa:   { label: 'Baixa',   color: 'text-fg-secondary',   bg: 'bg-surface-hover/50 border-border-subtle', dot: 'bg-zinc-500' },
  media:   { label: 'Média',   color: 'text-blue-400',   bg: 'bg-blue-500/10 border-blue-500/20', dot: 'bg-blue-500' },
  alta:    { label: 'Alta',    color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20', dot: 'bg-amber-500' },
  urgente: { label: 'Urgente', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20', dot: 'bg-red-500' },
}

const STATUS_CONFIG = {
  aberta:       { label: 'Aberta',       color: 'text-fg-secondary   border-border-subtle    bg-muted' },
  em_andamento: { label: 'Em andamento', color: 'text-blue-400   border-blue-500/30  bg-blue-500/10' },
  concluida:    { label: 'Concluída',    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  cancelada:    { label: 'Cancelada',    color: 'text-fg-disabled   border-border-subtle    bg-page' },
}

function isVencida(prazo: string | null): boolean {
  if (!prazo) return false
  return new Date(prazo) < new Date()
}

type Props = {
  projetos: Projeto[]
}

export function TabPendencias({ projetos }: Props) {
  const supabase = createClient()
  const [projetoFiltro, setProjetoFiltro] = useState('todos')
  const [statusFiltro, setStatusFiltro] = useState<'todas' | Pendencia['status']>('todas')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    descricao: '',
    responsavel: '',
    prazo: '',
    prioridade: 'media' as Pendencia['prioridade'],
    projeto_id: '',
  })

  const { data: pendencias, refetch } = useSupabaseQuery<Pendencia>('pendencias_projeto', {
    orderBy: { column: 'created_at', ascending: false },
  })

  const pendenciasFiltradas = pendencias.filter(p => {
    if (projetoFiltro !== 'todos' && p.projeto_id !== projetoFiltro) return false
    if (statusFiltro !== 'todas' && p.status !== statusFiltro) return false
    return true
  })

  const abertas = pendencias.filter(p => p.status === 'aberta').length
  const urgentes = pendencias.filter(p => p.prioridade === 'urgente' && p.status !== 'concluida').length
  const concluidas = pendencias.filter(p => p.status === 'concluida').length
  const vencidas = pendencias.filter(p => isVencida(p.prazo) && p.status !== 'concluida').length

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    await (supabase.from('pendencias_projeto') as any).insert({
      descricao: form.descricao,
      responsavel: form.responsavel || null,
      prazo: form.prazo || null,
      prioridade: form.prioridade,
      status: 'aberta',
      projeto_id: form.projeto_id || null,
    })
    setForm({ descricao: '', responsavel: '', prazo: '', prioridade: 'media', projeto_id: '' })
    setShowForm(false)
    refetch()
  }

  const alterarStatus = async (id: string, status: Pendencia['status']) => {
    await (supabase.from('pendencias_projeto') as any).update({ status }).eq('id', id)
    refetch()
  }

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Abertas',   value: abertas,   color: 'text-fg' },
          { label: 'Urgentes',  value: urgentes,  color: urgentes > 0 ? 'text-red-400' : 'text-fg' },
          { label: 'Vencidas',  value: vencidas,  color: vencidas > 0 ? 'text-amber-400' : 'text-fg' },
          { label: 'Concluídas', value: concluidas, color: 'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="bg-page border border-border-subtle rounded-xl p-3">
            <p className="text-[10px] font-medium text-fg-tertiary uppercase tracking-[0.06em] mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros + Botão */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="input text-xs py-1.5 w-auto" value={projetoFiltro} onChange={e => setProjetoFiltro(e.target.value)}>
          <option value="todos">Todos os projetos</option>
          {projetos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
          <option value="">Sem projeto</option>
        </select>

        <div className="flex items-center gap-1 bg-page border border-border-subtle rounded-lg p-1">
          {(['todas', 'aberta', 'em_andamento', 'concluida'] as const).map(s => (
            <button key={s} onClick={() => setStatusFiltro(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                statusFiltro === s ? 'bg-surface-hover text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
              }`}>
              {s === 'todas' ? 'Todas' : STATUS_CONFIG[s].label}
            </button>
          ))}
        </div>

        <button onClick={() => setShowForm(s => !s)} className="btn-primary text-xs ml-auto">
          {showForm ? '✕ Cancelar' : '+ Pendência'}
        </button>
      </div>

      {/* Formulário rápido */}
      {showForm && (
        <form onSubmit={handleSalvar} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-fg mb-3">Nova Pendência</p>
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="O que precisa ser feito?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Responsável</label>
              <input className="input mt-1" value={form.responsavel}
                onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))}
                placeholder="Nome" />
            </div>
            <div>
              <label className="label">Prazo</label>
              <input className="input mt-1" type="date" value={form.prazo}
                onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prioridade</label>
              <select className="input mt-1" value={form.prioridade}
                onChange={e => setForm(f => ({ ...f, prioridade: e.target.value as Pendencia['prioridade'] }))}>
                {Object.entries(PRIORIDADE_CONFIG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Projeto</label>
              <select className="input mt-1" value={form.projeto_id}
                onChange={e => setForm(f => ({ ...f, projeto_id: e.target.value }))}>
                <option value="">Sem projeto</option>
                {projetos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancelar</button>
            <button type="submit" className="btn-primary text-xs">Salvar pendência</button>
          </div>
        </form>
      )}

      {/* Lista de pendências */}
      {pendenciasFiltradas.length === 0 ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8">
          <EmptyState message="Nenhuma pendência encontrada" />
        </div>
      ) : (
        <div className="space-y-2">
          {pendenciasFiltradas.map(p => {
            const prio = PRIORIDADE_CONFIG[p.prioridade]
            const isC = p.status === 'concluida'
            const vencida = isVencida(p.prazo) && !isC
            return (
              <div key={p.id}
                className={`bg-page border rounded-xl p-4 flex items-start gap-4 transition-all ${
                  isC ? 'opacity-50 border-border-subtle' : vencida ? 'border-amber-500/30' : 'border-border-subtle hover:border-border-subtle'
                }`}>

                {/* Checkbox */}
                <button
                  onClick={() => alterarStatus(p.id, isC ? 'aberta' : 'concluida')}
                  className={`mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                    isC ? 'bg-emerald-500 border-emerald-500' : 'border-zinc-600 hover:border-emerald-400'
                  }`}>
                  {isC && <span className="text-[8px] text-white font-bold">✓</span>}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm font-medium ${isC ? 'line-through text-fg-tertiary' : 'text-fg'}`}>
                      {p.descricao}
                    </p>
                    {/* Badge prioridade */}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium border shrink-0 ${prio.bg} ${prio.color}`}>
                      {prio.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {p.responsavel && (
                      <span className="text-[10px] text-fg-tertiary">👤 {p.responsavel}</span>
                    )}
                    {p.prazo && (
                      <span className={`text-[10px] ${vencida ? 'text-amber-400' : 'text-fg-tertiary'}`}>
                        {vencida ? '⚠️' : '📅'} {formatDate(p.prazo)}
                        {vencida && ' — vencida!'}
                      </span>
                    )}
                    {p.projeto_id && (
                      <span className="text-[10px] text-fg-disabled">
                        📁 {projetos.find(pr => pr.id === p.projeto_id)?.titulo ?? 'Projeto'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status selector */}
                <select
                  value={p.status}
                  onChange={e => alterarStatus(p.id, e.target.value as Pendencia['status'])}
                  className="input text-[10px] py-1 w-auto shrink-0">
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
