'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { EmptyState } from '@/components/shared/ui'
import { formatCurrency } from '@/lib/utils'

type Financiamento = {
  id: string
  banco: string
  bem_id: string | null
  valor_financiado: number | null
  taxa_juros: number | null
  prazo_meses: number | null
  parcelas_pagas: number
  valor_parcela: number | null
  vencimento_dia: number | null
}

export function TabFinanciamentos() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    banco: '', valor_financiado: '', taxa_juros: '', prazo_meses: '',
    parcelas_pagas: '0', valor_parcela: '', vencimento_dia: ''
  })

  const { data: financiamentos, refetch } = useSupabaseQuery<Financiamento>('financiamentos', {
    orderBy: { column: 'criado_em', ascending: false }
  } as any)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    await (supabase.from('financiamentos') as any).insert({
      banco: form.banco,
      valor_financiado: form.valor_financiado ? parseFloat(form.valor_financiado) : null,
      taxa_juros: form.taxa_juros ? parseFloat(form.taxa_juros) : null,
      prazo_meses: form.prazo_meses ? parseInt(form.prazo_meses) : null,
      parcelas_pagas: parseInt(form.parcelas_pagas),
      valor_parcela: form.valor_parcela ? parseFloat(form.valor_parcela) : null,
      vencimento_dia: form.vencimento_dia ? parseInt(form.vencimento_dia) : null,
    })
    setShowForm(false)
    refetch()
    setForm({ banco: '', valor_financiado: '', taxa_juros: '', prazo_meses: '', parcelas_pagas: '0', valor_parcela: '', vencimento_dia: '' })
  }

  const addParcelaPaga = async (f: Financiamento) => {
    await (supabase.from('financiamentos') as any).update({ parcelas_pagas: f.parcelas_pagas + 1 }).eq('id', f.id)
    refetch()
  }

  // KPIs
  const saldoDevedorEstimado = financiamentos.reduce((acc, f) => {
    if (!f.valor_parcela || !f.prazo_meses) return acc
    const faltam = Math.max(0, f.prazo_meses - f.parcelas_pagas)
    return acc + (faltam * f.valor_parcela)
  }, 0)

  const custoMensal = financiamentos.reduce((acc, f) => acc + (f.valor_parcela || 0), 0)

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-page border border-border-subtle rounded-xl p-4">
          <p className="text-[10px] text-fg-tertiary uppercase tracking-widest mb-1">Custo Mensal (Parcelas)</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(custoMensal)}</p>
        </div>
        <div className="bg-page border border-border-subtle rounded-xl p-4">
          <p className="text-[10px] text-fg-tertiary uppercase tracking-widest mb-1">Saldo Devedor Estimado</p>
          <p className="text-2xl font-bold text-fg">{formatCurrency(saldoDevedorEstimado)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6">
        <h2 className="text-sm font-semibold text-fg">🏦 Contratos Ativos</h2>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary text-xs">
          {showForm ? '✕ Cancelar' : '+ Novo Financiamento'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSalvar} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Instituição Financeira / Banco *</label>
              <input className="input mt-1" required value={form.banco} onChange={e => setForm(f => ({...f, banco: e.target.value}))} placeholder="Caixa, Itaú..." />
            </div>
            <div><label className="label">Vencimento (Dia)</label><input type="number" max="31" min="1" className="input mt-1" value={form.vencimento_dia} onChange={e => setForm(f => ({...f, vencimento_dia: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Valor Financiado</label><input type="number" step="0.01" className="input mt-1" value={form.valor_financiado} onChange={e => setForm(f => ({...f, valor_financiado: e.target.value}))} /></div>
            <div><label className="label">Valor Parcela</label><input type="number" step="0.01" className="input mt-1" value={form.valor_parcela} onChange={e => setForm(f => ({...f, valor_parcela: e.target.value}))} /></div>
            <div><label className="label">Taxa Juros (% a.a.)</label><input type="number" step="0.01" className="input mt-1" value={form.taxa_juros} onChange={e => setForm(f => ({...f, taxa_juros: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Prazo (Meses)</label><input type="number" className="input mt-1" value={form.prazo_meses} onChange={e => setForm(f => ({...f, prazo_meses: e.target.value}))} /></div>
            <div><label className="label">Parcelas Pagas (Início)</label><input type="number" className="input mt-1" value={form.parcelas_pagas} onChange={e => setForm(f => ({...f, parcelas_pagas: e.target.value}))} /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">Salvar Financiamento</button>
          </div>
        </form>
      )}

      {financiamentos.length === 0 ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8"><EmptyState message="Nenhum financiamento cadastrado" /></div>
      ) : (
        <div className="space-y-3">
          {financiamentos.map(f => {
             const progresso = f.prazo_meses ? Math.min(100, (f.parcelas_pagas / f.prazo_meses) * 100) : 0
             return (
              <div key={f.id} className="bg-page border border-border-subtle rounded-xl p-5 hover:border-border-subtle transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-fg flex items-center gap-2">🏦 {f.banco}</h3>
                    {f.vencimento_dia && <p className="text-xs text-fg-tertiary mt-0.5">Vence dia {f.vencimento_dia}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-fg-tertiary uppercase tracking-widest">Valor Parcela</p>
                    <p className="text-lg font-bold text-red-400">{f.valor_parcela ? formatCurrency(f.valor_parcela) : '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><p className="text-[10px] text-fg-disabled uppercase tracking-widest">Financiado</p><p className="text-sm font-medium">{f.valor_financiado ? formatCurrency(f.valor_financiado) : '—'}</p></div>
                  <div><p className="text-[10px] text-fg-disabled uppercase tracking-widest">Taxa (a.a.)</p><p className="text-sm text-fg-secondary font-medium">{f.taxa_juros ? `${f.taxa_juros}%` : '—'}</p></div>
                  <div>
                    <p className="text-[10px] text-fg-disabled uppercase tracking-widest">Progresso</p>
                    <p className="text-sm font-medium text-emerald-400">{f.parcelas_pagas} de {f.prazo_meses}</p>
                  </div>
                  <div className="flex items-end justify-end">
                    <button onClick={() => addParcelaPaga(f)} className="btn-ghost text-xs border border-border-subtle">Pagar Parcela ✅</button>
                  </div>
                </div>

                {f.prazo_meses && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${progresso}%` }} />
                    </div>
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
