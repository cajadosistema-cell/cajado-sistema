'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { EmptyState } from '@/components/shared/ui'
import { formatDate } from '@/lib/utils'

type Reuniao = {
  id: string
  projeto_id: string | null
  titulo: string
  data_reuniao: string
  horario: string | null
  participantes: string | null
  pauta: string | null
  decisoes_tomadas: string | null
  acoes: string | null
  created_at: string
}

type Projeto = {
  id: string
  titulo: string
  status: string
}

type Props = {
  projetos: Projeto[]
}

export function TabReunioes({ projetos }: Props) {
  const supabase = createClient()
  const [projetoFiltro, setProjetoFiltro] = useState('todos')
  const [showForm, setShowForm] = useState(false)
  const [expandida, setExpandida] = useState<string | null>(null)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    titulo: '',
    data_reuniao: today,
    horario: '',
    participantes: '',
    pauta: '',
    decisoes_tomadas: '',
    acoes: '',
    projeto_id: '',
  })

  const { data: reunioes, refetch } = useSupabaseQuery<Reuniao>('reunioes', {
    orderBy: { column: 'data_reuniao', ascending: false },
  })

  const reunioesFiltradas = reunioes.filter(r =>
    projetoFiltro === 'todos' || r.projeto_id === projetoFiltro
  )

  const hoje = reunioes.filter(r => r.data_reuniao === today).length
  const comDecisoes = reunioes.filter(r => r.decisoes_tomadas).length
  const semana = reunioes.filter(r => {
    const d = new Date(r.data_reuniao)
    const now = new Date()
    const diff = Math.abs(d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    return diff <= 7
  }).length

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    await (supabase.from('reunioes') as any).insert({
      titulo: form.titulo,
      data_reuniao: form.data_reuniao,
      horario: form.horario || null,
      participantes: form.participantes || null,
      pauta: form.pauta || null,
      decisoes_tomadas: form.decisoes_tomadas || null,
      acoes: form.acoes || null,
      projeto_id: form.projeto_id || null,
    })
    setForm({
      titulo: '', data_reuniao: today, horario: '', participantes: '',
      pauta: '', decisoes_tomadas: '', acoes: '', projeto_id: '',
    })
    setShowForm(false)
    refetch()
  }

  return (
    <div className="space-y-5">

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total registradas', value: reunioes.length, color: 'text-zinc-200' },
          { label: 'Essa semana',       value: semana,          color: 'text-blue-400' },
          { label: 'Com decisões',      value: comDecisoes,     color: 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
            <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-[0.06em] mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Barra de ações */}
      <div className="flex items-center gap-2">
        <select className="input text-xs py-1.5 w-auto" value={projetoFiltro} onChange={e => setProjetoFiltro(e.target.value)}>
          <option value="todos">Todos os projetos</option>
          {projetos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
          <option value="">Sem projeto</option>
        </select>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary text-xs ml-auto">
          {showForm ? '✕ Cancelar' : '+ Reunião'}
        </button>
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSalvar} className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-zinc-200">Registrar Reunião</p>
          <div>
            <label className="label">Título *</label>
            <input className="input mt-1" required value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Reunião de alinhamento, Revisão semanal..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data *</label>
              <input className="input mt-1" type="date" required value={form.data_reuniao}
                onChange={e => setForm(f => ({ ...f, data_reuniao: e.target.value }))} />
            </div>
            <div>
              <label className="label">Horário</label>
              <input className="input mt-1" type="time" value={form.horario}
                onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Participantes</label>
              <input className="input mt-1" value={form.participantes}
                onChange={e => setForm(f => ({ ...f, participantes: e.target.value }))}
                placeholder="Carlos, Ana, João..." />
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
          <div>
            <label className="label">Pauta</label>
            <textarea className="input mt-1 resize-none" rows={2} value={form.pauta}
              onChange={e => setForm(f => ({ ...f, pauta: e.target.value }))}
              placeholder="Tópicos discutidos..." />
          </div>
          <div>
            <label className="label">Decisões tomadas</label>
            <textarea className="input mt-1 resize-none" rows={2} value={form.decisoes_tomadas}
              onChange={e => setForm(f => ({ ...f, decisoes_tomadas: e.target.value }))}
              placeholder="O que foi decidido?" />
          </div>
          <div>
            <label className="label">Ações / próximos passos</label>
            <textarea className="input mt-1 resize-none" rows={2} value={form.acoes}
              onChange={e => setForm(f => ({ ...f, acoes: e.target.value }))}
              placeholder="Quem faz o quê até quando?" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancelar</button>
            <button type="submit" className="btn-primary text-xs">Salvar reunião</button>
          </div>
        </form>
      )}

      {/* Lista de reuniões */}
      {reunioesFiltradas.length === 0 ? (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
          <EmptyState message="Nenhuma reunião registrada" />
        </div>
      ) : (
        <div className="space-y-2">
          {reunioesFiltradas.map(r => {
            const isAberta = expandida === r.id
            const projetoNome = projetos.find(p => p.id === r.projeto_id)?.titulo
            return (
              <div key={r.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-all">
                {/* Header clicável */}
                <button
                  onClick={() => setExpandida(isAberta ? null : r.id)}
                  className="w-full flex items-center gap-4 p-4 text-left">
                  <div className="bg-zinc-800 rounded-lg p-2 text-center min-w-[52px]">
                    <p className="text-[10px] text-zinc-500 uppercase">
                      {new Date(r.data_reuniao + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short' })}
                    </p>
                    <p className="text-lg font-bold text-zinc-200 leading-tight">
                      {new Date(r.data_reuniao + 'T12:00:00').getDate()}
                    </p>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-zinc-200 truncate">{r.titulo}</p>
                      {r.decisoes_tomadas && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                          Decisão
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {r.horario && <span className="text-[10px] text-zinc-500">🕐 {r.horario}</span>}
                      {r.participantes && <span className="text-[10px] text-zinc-500">👥 {r.participantes}</span>}
                      {projetoNome && <span className="text-[10px] text-zinc-600">📁 {projetoNome}</span>}
                    </div>
                  </div>

                  <span className={`text-zinc-500 text-xs transition-transform ${isAberta ? 'rotate-180' : ''}`}>▼</span>
                </button>

                {/* Detalhes expandidos */}
                {isAberta && (
                  <div className="border-t border-zinc-800 p-4 space-y-3">
                    {r.pauta && (
                      <div>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">Pauta</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">{r.pauta}</p>
                      </div>
                    )}
                    {r.decisoes_tomadas && (
                      <div>
                        <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-1">📌 Decisões</p>
                        <p className="text-xs text-amber-400/80 leading-relaxed">{r.decisoes_tomadas}</p>
                      </div>
                    )}
                    {r.acoes && (
                      <div>
                        <p className="text-[10px] text-emerald-500 uppercase tracking-wide mb-1">✅ Ações</p>
                        <p className="text-xs text-emerald-400/80 leading-relaxed">{r.acoes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
