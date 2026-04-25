'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { EmptyState, StatusBadge } from '@/components/shared/ui'
import { cn } from '@/lib/utils'

type OKR = {
  id: string
  ciclo: string
  objetivo: string
  status: 'no_prazo' | 'em_risco' | 'atrasado' | 'concluido'
  responsavel_id: string | null
  perfis?: { nome: string }
  okr_resultados: OKRResultado[]
}

type OKRResultado = {
  id: string
  okr_id: string
  resultado_chave: string
  meta_valor: number
  atual_valor: number
  unidade: string
}

export function TabOKRs() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ciclo: 'Q1', objetivo: '', status: 'no_prazo' as OKR['status'] })
  const [formKR, setFormKR] = useState({ okr_id: '', resultado_chave: '', meta_valor: '', atual_valor: '0', unidade: '%' })

  // Nested eager loading of results!
  const { data: okrs, refetch } = useSupabaseQuery<OKR>('okrs', {
    select: '*, perfis(nome), okr_resultados(*)',
    orderBy: { column: 'created_at', ascending: false }
  } as any)

  const { insert: insertOkr } = useSupabaseMutation('okrs')
  const { insert: insertKR } = useSupabaseMutation('okr_resultados')

  const handleSalvarOkr = async (e: React.FormEvent) => {
    e.preventDefault()
    await insertOkr({
      ciclo: form.ciclo,
      objetivo: form.objetivo,
      status: form.status,
    })
    setShowForm(false)
    refetch()
    setForm({ ciclo: 'Q1', objetivo: '', status: 'no_prazo' })
  }

  const handleSalvarKR = async (e: React.FormEvent) => {
    e.preventDefault()
    await insertKR({
      okr_id: formKR.okr_id,
      resultado_chave: formKR.resultado_chave,
      meta_valor: parseFloat(formKR.meta_valor),
      atual_valor: parseFloat(formKR.atual_valor),
      unidade: formKR.unidade || '%',
    })
    setFormKR({ okr_id: '', resultado_chave: '', meta_valor: '', atual_valor: '0', unidade: '%' })
    refetch()
  }

  const updateKRProgress = async (id: string, newVal: number) => {
    await (supabase.from('okr_resultados') as any).update({ atual_valor: newVal }).eq('id', id)
    refetch()
  }

  const updateOKRStatus = async (id: string, newVal: string) => {
    await (supabase.from('okrs') as any).update({ status: newVal }).eq('id', id)
    refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-fg">🎯 Objetivos e Resultados Chave (OKRs)</h2>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary text-xs">
          {showForm ? '✕ Cancelar' : '+ Novo Objetivo Tri/Sem'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSalvarOkr} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-1">
              <label className="label">Ciclo (Ex: Q3 26)</label>
              <input className="input mt-1" required value={form.ciclo} onChange={e => setForm(f => ({...f, ciclo: e.target.value}))} />
            </div>
            <div className="col-span-3">
              <label className="label">Objetivo Inspirador (O)</label>
              <input className="input mt-1" required value={form.objetivo} placeholder="Ex: Dominar o estado de SP em logística..." onChange={e => setForm(f => ({...f, objetivo: e.target.value}))} />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">Salvar Objetivo</button>
          </div>
        </form>
      )}

      {okrs.length === 0 && !showForm ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8"><EmptyState message="Defina os OKRs estratégicos da empresa para o ciclo." /></div>
      ) : (
        <div className="space-y-4">
          {okrs.map(okr => {
            const krs = Array.isArray(okr.okr_resultados) ? okr.okr_resultados : []
            // calcula o progresso geral do objetivo baseado na media dos KRs
            let mediaProgresso = 0
            if (krs.length > 0) {
              const pcts = krs.map(kr => Math.min(100, Math.max(0, (kr.atual_valor / kr.meta_valor) * 100)))
              mediaProgresso = pcts.reduce((a,b) => a+b, 0) / krs.length
            }

            return (
              <div key={okr.id} className="bg-page border border-border-subtle rounded-xl overflow-hidden hover:border-border-subtle transition">
                {/* Cabeçalho do Objetivo */}
                <div className="p-5 border-b border-border-subtle/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-bold tracking-widest uppercase text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded">
                        {okr.ciclo}
                      </span>
                      <select className={cn("text-[10px] px-2 py-0.5 rounded-full outline-none font-semibold", 
                          okr.status === 'no_prazo' ? 'text-emerald-400 bg-emerald-400/10' : 
                          okr.status === 'em_risco' ? 'text-amber-400 bg-amber-400/10' :
                          okr.status === 'atrasado' ? 'text-red-400 bg-red-400/10' : 'text-fg-secondary bg-muted'
                        )}
                        value={okr.status} onChange={e => updateOKRStatus(okr.id, e.target.value)}
                      >
                        <option value="no_prazo">🟢 No Prazo</option>
                        <option value="em_risco">🟡 Em Risco</option>
                        <option value="atrasado">🔴 Atrasado</option>
                        <option value="concluido">✔️ Concluído</option>
                      </select>
                    </div>
                    <h3 className="text-base font-bold text-fg flex items-center gap-2">🎯 {okr.objetivo}</h3>
                  </div>
                  
                  {/* Progresso Geral */}
                  <div className="w-full md:w-48">
                    <div className="flex justify-between items-end mb-1">
                      <span className="text-[10px] text-fg-tertiary font-semibold uppercase">Progresso Geral</span>
                      <span className="text-xs font-bold text-emerald-400">{mediaProgresso.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-sidebar rounded-full border border-border-subtle overflow-hidden relative">
                      <div className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-700" style={{width: `${mediaProgresso}%`}} />
                    </div>
                  </div>
                </div>

                {/* Key Results */}
                <div className="p-5 bg-sidebar">
                  <h4 className="text-[11px] font-bold text-fg-tertiary uppercase tracking-widest mb-3">Resultados Chave (KRs)</h4>
                  
                  <div className="space-y-3">
                    {krs.map(kr => {
                      const limit = Math.max(kr.atual_valor, kr.meta_valor)
                      const pct = Math.min(100, Math.max(0, (kr.atual_valor / kr.meta_valor) * 100))
                      return (
                        <div key={kr.id} className="flex items-center gap-4">
                          <p className="flex-1 text-sm text-fg-secondary font-medium">↳ {kr.resultado_chave}</p>
                          <div className="flex items-center gap-3 shrink-0">
                            <input type="number" 
                              className="w-20 text-center bg-page border border-border-subtle rounded px-2 py-1 text-xs text-fg placeholder:text-fg-disabled outline-none focus:border-purple-500"
                              value={kr.atual_valor}
                              onChange={e => updateKRProgress(kr.id, parseFloat(e.target.value) || 0)}
                            />
                            <span className="text-xs text-fg-tertiary w-16">/ {kr.meta_valor} {kr.unidade}</span>
                            
                            <div className="w-24 h-5 bg-page rounded overflow-hidden relative">
                              <div className="absolute top-0 left-0 h-full bg-surface-hover transition-all" style={{width: `${pct}%`}} />
                              <span className="absolute inset-0 flex flex-col justify-center text-center text-[9px] font-bold mix-blend-difference text-white">{pct.toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Form add KR (inline) */}
                  {formKR.okr_id === okr.id ? (
                    <form onSubmit={handleSalvarKR} className="mt-4 flex gap-2">
                       <input className="input py-1 text-xs flex-1" required placeholder="Ex: Atingir 500 vendas de Software" value={formKR.resultado_chave} onChange={e => setFormKR(f => ({...f, resultado_chave: e.target.value}))} />
                       <input className="input py-1 text-xs w-20" type="number" required placeholder="Meta" value={formKR.meta_valor} onChange={e => setFormKR(f => ({...f, meta_valor: e.target.value}))} />
                       <input className="input py-1 text-xs w-16" placeholder="%" value={formKR.unidade} onChange={e => setFormKR(f => ({...f, unidade: e.target.value}))} />
                       <button type="submit" className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded text-xs font-bold hover:bg-emerald-500/30">Add</button>
                       <button type="button" onClick={() => setFormKR({...formKR, okr_id: ''})} className="text-fg-tertiary px-2 text-xs">✕</button>
                    </form>
                  ) : (
                    <button onClick={() => setFormKR({...formKR, okr_id: okr.id})} className="mt-3 text-xs text-purple-400 hover:text-purple-300 font-medium">+ Adicionar Resultado Chave</button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
