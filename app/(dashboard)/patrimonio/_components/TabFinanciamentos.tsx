'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { useEmpresaId } from '@/lib/hooks/useEmpresaId'
import { EmptyState } from '@/components/shared/ui'
import { formatCurrency } from '@/lib/utils'

type Financiamento = {
  id: string
  credor: string
  bem_id: string | null
  valor_financiado: number | null
  taxa_juros_anual: number | null
  parcelas_total: number | null
  parcelas_pagas: number
  valor_parcela: number | null
  dia_vencimento: number | null
}

type InvestimentoContrato = {
  id: string
  nome_contrato: string
  instituicao: string
  parcela_atual: number
  parcela_total: number
  valor_mensal: number
  valor_variavel: boolean
  mes_referencia: string
  proximo_vencimento: string | null
  status: string
  data_pagamento: string | null
}

export function TabFinanciamentos() {
  const supabase = createClient()
  const { empresaId } = useEmpresaId()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    credor: '', valor_financiado: '', taxa_juros_anual: '', parcelas_total: '',
    parcelas_pagas: '0', valor_parcela: '', dia_vencimento: ''
  })

  const { data: financiamentos, refetch } = useSupabaseQuery<Financiamento>('financiamentos', {
    filters: { empresa_id: empresaId || undefined },
    orderBy: { column: 'criado_em', ascending: false },
    enabled: !!empresaId,
  } as any)

  const { data: contratosInv } = useSupabaseQuery<InvestimentoContrato>('investimentos_contratos', {
    filters: { empresa_id: empresaId || undefined },
    orderBy: { column: 'proximo_vencimento', ascending: true },
    enabled: !!empresaId,
  } as any)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      credor: form.credor,
      valor_financiado: form.valor_financiado ? parseFloat(form.valor_financiado) : null,
      taxa_juros_anual: form.taxa_juros_anual ? parseFloat(form.taxa_juros_anual) : null,
      parcelas_total: form.parcelas_total ? parseInt(form.parcelas_total) : null,
      parcelas_pagas: parseInt(form.parcelas_pagas) || 0,
      valor_parcela: form.valor_parcela ? parseFloat(form.valor_parcela) : null,
      dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
    }

    if (editId) {
      const { error } = await (supabase.from('financiamentos') as any).update(payload).eq('id', editId)
      if (error) { alert('Erro ao atualizar financiamento: ' + error.message); return }
    } else {
      const insertPayload = { ...payload, ...(empresaId ? { empresa_id: empresaId } : {}) }
      const { error } = await (supabase.from('financiamentos') as any).insert(insertPayload)
      if (error) { alert('Erro ao cadastrar financiamento: ' + error.message); return }
    }

    setShowForm(false)
    setEditId(null)
    refetch()
    setForm({ credor: '', valor_financiado: '', taxa_juros_anual: '', parcelas_total: '', parcelas_pagas: '0', valor_parcela: '', dia_vencimento: '' })
  }

  const handleExcluir = async (id: string, credor: string) => {
    if (!confirm(`Tem certeza que deseja excluir o financiamento de "${credor}"?`)) return
    const { error } = await (supabase.from('financiamentos') as any).delete().eq('id', id)
    if (error) { alert('Erro ao excluir financiamento: ' + error.message); return }
    refetch()
  }

  const handleEdit = (financiamento: Financiamento) => {
    setForm({
      credor: financiamento.credor,
      valor_financiado: financiamento.valor_financiado ? String(financiamento.valor_financiado) : '',
      taxa_juros_anual: financiamento.taxa_juros_anual ? String(financiamento.taxa_juros_anual) : '',
      parcelas_total: financiamento.parcelas_total ? String(financiamento.parcelas_total) : '',
      parcelas_pagas: String(financiamento.parcelas_pagas),
      valor_parcela: financiamento.valor_parcela ? String(financiamento.valor_parcela) : '',
      dia_vencimento: financiamento.dia_vencimento ? String(financiamento.dia_vencimento) : '',
    })
    setEditId(financiamento.id)
    setShowForm(true)
  }

  const addParcelaPaga = async (f: Financiamento) => {
    const { error } = await (supabase.from('financiamentos') as any).update({ parcelas_pagas: f.parcelas_pagas + 1 }).eq('id', f.id)
    if (error) { alert('Erro ao registrar parcela: ' + error.message); return }
    refetch()
  }

  // KPIs
  const saldoDevedorEstimado = financiamentos.reduce((acc, f) => {
    if (!f.valor_parcela || !f.parcelas_total) return acc
    const faltam = Math.max(0, f.parcelas_total - f.parcelas_pagas)
    return acc + (faltam * f.valor_parcela)
  }, 0)

  const saldoDevedorContratos = contratosInv.reduce((acc, c) => {
    if (!c.valor_mensal || !c.parcela_total) return acc
    const faltam = Math.max(0, c.parcela_total - (c.parcela_atual || 0))
    return acc + (faltam * c.valor_mensal)
  }, 0)

  const custoMensalBancos = financiamentos.reduce((acc, f) => acc + (f.valor_parcela || 0), 0)
  const custoMensalContratos = contratosInv.reduce((acc, c) => acc + (c.valor_mensal || 0), 0)

  const custoMensal = custoMensalBancos + custoMensalContratos
  const saldoTotal = saldoDevedorEstimado + saldoDevedorContratos

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
          <p className="text-2xl font-bold text-fg">{formatCurrency(saldoTotal)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6">
        <h2 className="text-sm font-semibold text-fg">🏦 Financiamentos Bancários</h2>
        <button onClick={() => {
          if (showForm) {
            setShowForm(false)
            setEditId(null)
            setForm({ credor: '', valor_financiado: '', taxa_juros_anual: '', parcelas_total: '', parcelas_pagas: '0', valor_parcela: '', dia_vencimento: '' })
          } else {
            setShowForm(true)
          }
        }} className="btn-primary text-xs">
          {showForm ? '✕ Cancelar' : '+ Novo Financiamento'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSalvar} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Instituição Financeira / Banco *</label>
              <input className="input mt-1" required value={form.credor} onChange={e => setForm(f => ({...f, credor: e.target.value}))} placeholder="Caixa, Itaú..." />
            </div>
            <div><label className="label">Vencimento (Dia)</label><input type="number" max="31" min="1" className="input mt-1" value={form.dia_vencimento} onChange={e => setForm(f => ({...f, dia_vencimento: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Valor Financiado</label><input type="number" step="0.01" className="input mt-1" value={form.valor_financiado} onChange={e => setForm(f => ({...f, valor_financiado: e.target.value}))} /></div>
            <div><label className="label">Valor Parcela</label><input type="number" step="0.01" className="input mt-1" value={form.valor_parcela} onChange={e => setForm(f => ({...f, valor_parcela: e.target.value}))} /></div>
            <div><label className="label">Taxa Juros (% a.a.)</label><input type="number" step="0.01" className="input mt-1" value={form.taxa_juros_anual} onChange={e => setForm(f => ({...f, taxa_juros_anual: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Prazo (Meses)</label><input type="number" className="input mt-1" value={form.parcelas_total} onChange={e => setForm(f => ({...f, parcelas_total: e.target.value}))} /></div>
            <div><label className="label">Parcelas Pagas (Início)</label><input type="number" className="input mt-1" value={form.parcelas_pagas} onChange={e => setForm(f => ({...f, parcelas_pagas: e.target.value}))} /></div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">
              {editId ? 'Salvar Alterações' : 'Salvar Financiamento'}
            </button>
          </div>
        </form>
      )}

      {financiamentos.length === 0 ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8"><EmptyState message="Nenhum financiamento cadastrado" /></div>
      ) : (
        <div className="space-y-3">
          {financiamentos.map(f => {
             const progresso = f.parcelas_total ? Math.min(100, (f.parcelas_pagas / f.parcelas_total) * 100) : 0
             return (
              <div key={f.id} className="bg-page border border-border-subtle rounded-xl p-5 hover:border-border-subtle transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-fg flex items-center gap-2">🏦 {f.credor}</h3>
                    {f.dia_vencimento && <p className="text-xs text-fg-tertiary mt-0.5">Vence dia {f.dia_vencimento}</p>}
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="flex gap-2 mb-1">
                      <button onClick={() => handleEdit(f)} className="text-fg-tertiary hover:text-blue-400 transition-colors" title="Editar">✏️</button>
                      <button onClick={() => handleExcluir(f.id, f.credor)} className="text-fg-tertiary hover:text-red-400 transition-colors" title="Excluir">🗑️</button>
                    </div>
                    <p className="text-xs text-fg-tertiary uppercase tracking-widest">Valor Parcela</p>
                    <p className="text-lg font-bold text-red-400">{f.valor_parcela ? formatCurrency(f.valor_parcela) : '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><p className="text-[10px] text-fg-disabled uppercase tracking-widest">Financiado</p><p className="text-sm font-medium">{f.valor_financiado ? formatCurrency(f.valor_financiado) : '—'}</p></div>
                  <div><p className="text-[10px] text-fg-disabled uppercase tracking-widest">Taxa (a.a.)</p><p className="text-sm text-fg-secondary font-medium">{f.taxa_juros_anual ? `${f.taxa_juros_anual}%` : '—'}</p></div>
                  <div>
                    <p className="text-[10px] text-fg-disabled uppercase tracking-widest">Progresso</p>
                    <p className="text-sm font-medium text-emerald-400">{f.parcelas_pagas} de {f.parcelas_total}</p>
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

      {/* Seção: Contratos de Investimento (Consórcios, Lotes, etc.) */}
      {contratosInv.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-fg mb-4">📈 Contratos de Investimento (Consórcios, Terrenos, etc.)</h2>
          <div className="space-y-3">
            {contratosInv.map(c => {
               const progresso = c.parcela_total ? Math.min(100, ((c.parcela_atual || 0) / c.parcela_total) * 100) : 0
               return (
                <div key={c.id} className="bg-page border border-border-subtle rounded-xl p-5 hover:border-border-subtle transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-fg flex items-center gap-2">📄 {c.nome_contrato}</h3>
                      <p className="text-xs text-fg-tertiary mt-0.5">{c.instituicao}</p>
                      {c.proximo_vencimento && <p className="text-xs text-fg-tertiary mt-0.5">Vence: {c.proximo_vencimento.substring(8, 10)}/{c.proximo_vencimento.substring(5, 7)}/{c.proximo_vencimento.substring(0, 4)}</p>}
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-xs text-fg-tertiary uppercase tracking-widest">Valor Mensal</p>
                      <p className="text-lg font-bold text-red-400">{c.valor_mensal ? formatCurrency(c.valor_mensal) : '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] text-fg-disabled uppercase tracking-widest">Progresso</p>
                      <p className="text-sm font-medium text-emerald-400">
                        {c.parcela_atual || 0} de {c.parcela_total || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-fg-disabled uppercase tracking-widest">Status</p>
                      <p className="text-sm text-fg-secondary font-medium uppercase">{c.status}</p>
                    </div>
                  </div>

                  {c.parcela_total && (
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
        </div>
      )}
    </div>
  )
}
