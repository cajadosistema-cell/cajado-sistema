'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { EmptyState, StatusBadge } from '@/components/shared/ui'
import { formatCurrency, formatRelative, cn } from '@/lib/utils'

type Oportunidade = {
  id: string
  titulo: string
  descricao: string | null
  status: 'ideia' | 'analisando' | 'aprovado' | 'executando' | 'descartado'
  roi_estimado: number | null
  investimento_estimado: number | null
  created_at: string
}

const KANBAN_STATUS = [
  { id: 'ideia', label: '💡 Ideias Brutas', color: 'border-blue-500/30 bg-blue-500/5' },
  { id: 'analisando', label: '📊 Em Análise (Viabilidade)', color: 'border-amber-500/30 bg-amber-500/5' },
  { id: 'aprovado', label: '🎯 Aprovado', color: 'border-purple-500/30 bg-purple-500/5' },
  { id: 'executando', label: '🚀 Em Execução', color: 'border-emerald-500/30 bg-emerald-500/5' },
] as const

export function TabOportunidades() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    titulo: '', descricao: '', status: 'ideia' as Oportunidade['status'],
    roi_estimado: '', investimento_estimado: ''
  })

  const { data: oportunidades, refetch } = useSupabaseQuery<Oportunidade>('oportunidades_expansao', {
    orderBy: { column: 'created_at', ascending: false }
  } as any)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    await (supabase.from('oportunidades_expansao') as any).insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      status: form.status,
      roi_estimado: form.roi_estimado ? parseFloat(form.roi_estimado) : null,
      investimento_estimado: form.investimento_estimado ? parseFloat(form.investimento_estimado) : null,
    })
    setShowForm(false)
    refetch()
    setForm({ titulo: '', descricao: '', status: 'ideia', roi_estimado: '', investimento_estimado: '' })
  }

  const moverStatus = async (id: string, novoStatus: string) => {
    await (supabase.from('oportunidades_expansao') as any).update({ status: novoStatus }).eq('id', id)
    refetch()
  }

  // Filtrando descartados do board principal
  const ativas = oportunidades.filter(o => o.status !== 'descartado')

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-fg">🚀 Pipeline de Inovação & Expansão</h2>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary text-xs">
          {showForm ? '✕ Cancelar' : '+ Nova Oportunidade'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSalvar} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Qual a nova ideia/projeto? *</label>
              <input className="input mt-1" required value={form.titulo}
                onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
                placeholder="Ex: Abrir filial em SP, Lançar App Mobile..." />
            </div>
            <div className="col-span-2">
              <label className="label">Hipótese / Contexto do Projeto</label>
              <textarea className="input mt-1 h-20" value={form.descricao}
                onChange={e => setForm(f => ({...f, descricao: e.target.value}))}
                placeholder="Por que deveríamos fazer isso? Qual a vantagem?" />
            </div>
            <div>
              <label className="label">Investimento (R$)</label>
              <input type="number" step="1000" className="input mt-1" value={form.investimento_estimado} 
                onChange={e => setForm(f => ({...f, investimento_estimado: e.target.value}))} placeholder="Ex: 50000" />
            </div>
            <div>
              <label className="label">ROI Estimado (R$ de retorno limpo)</label>
              <input type="number" step="1000" className="input mt-1" value={form.roi_estimado} 
                onChange={e => setForm(f => ({...f, roi_estimado: e.target.value}))} placeholder="Ex: 150000" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">Adicionar ao Pipeline</button>
          </div>
        </form>
      )}

      {ativas.length === 0 && !showForm ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8"><EmptyState message="Sem iniciativas no pipeline" /></div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 snap-x">
          {KANBAN_STATUS.map(col => (
            <div key={col.id} className={cn('min-w-[280px] w-full max-w-[320px] rounded-xl border p-3 flex flex-col snap-center', col.color)}>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-xs font-bold text-fg-secondary">{col.label}</h3>
                <span className="text-[10px] text-fg-tertiary bg-page/50 px-2 py-0.5 rounded-full">
                  {ativas.filter(o => o.status === col.id).length}
                </span>
              </div>
              
              <div className="flex flex-col gap-3">
                {ativas.filter(o => o.status === col.id).map(o => (
                  <div key={o.id} className="bg-page border border-border-subtle rounded-xl p-4 shadow-sm hover:border-border-subtle transition">
                    <h4 className="text-sm font-bold text-fg leading-tight">{o.titulo}</h4>
                    {o.descricao && <p className="text-[11px] text-fg-secondary mt-2 line-clamp-3 leading-relaxed">{o.descricao}</p>}
                    
                    <div className="mt-4 pt-3 border-t border-border-subtle/60 grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-[9px] text-fg-disabled uppercase tracking-widest">Aporte Disp.</p>
                        <p className="text-xs font-semibold text-fg-secondary">{o.investimento_estimado ? formatCurrency(o.investimento_estimado) : 'TBD'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-fg-disabled uppercase tracking-widest">ROI Previsto</p>
                        <p className="text-xs font-semibold text-emerald-400">{o.roi_estimado ? formatCurrency(o.roi_estimado) : 'TBD'}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <select 
                        className="text-[10px] bg-muted border-none outline-none rounded px-1.5 py-1 text-fg-secondary hover:text-fg"
                        value={o.status}
                        onChange={e => moverStatus(o.id, e.target.value)}
                      >
                        {KANBAN_STATUS.map(k => <option key={k.id} value={k.id}>{k.label.replace(/[^A-Za-z ]/g, '')}</option>)}
                        <option value="descartado">Descartar 🗑️</option>
                      </select>

                      <span className="text-[9px] text-fg-disabled">{formatRelative(o.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
