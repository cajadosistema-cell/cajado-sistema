'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { detectarCategoria, CATEGORIAS_GASTO } from '../types'

type Props = {
  userId: string
  onSave: () => void
  onClose: () => void
}

export function ModalNovoGasto({ userId, onSave, onClose }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    categoria: 'outros',
    forma_pagamento: 'pix',
    data: today,
    recorrente: false,
    notas: '',
  })

  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  // Auto categorizar quando descrição muda
  const handleDescricao = (desc: string) => {
    const cat = detectarCategoria(desc)
    setForm(f => ({ ...f, descricao: desc, categoria: cat }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) return
    setLoading(true)
    await (supabase.from('gastos_pessoais') as any).insert({
      user_id: userId,
      descricao: form.descricao,
      valor,
      categoria: form.categoria,
      forma_pagamento: form.forma_pagamento,
      data: form.data,
      recorrente: form.recorrente,
      notas: form.notas || null,
    })
    setLoading(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Novo Gasto Pessoal</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Categoria detectada automaticamente</p>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              placeholder="Ex: Supermercado, Uber, Netflix..."
              onChange={e => handleDescricao(e.target.value)} />
            {/* Preview da categoria detectada */}
            {form.descricao && (
              <p className="text-[10px] text-zinc-500 mt-1">
                Categoria detectada: {CATEGORIAS_GASTO[form.categoria]?.icon} {CATEGORIAS_GASTO[form.categoria]?.label}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input mt-1" required type="number" step="0.01" min="0.01"
                placeholder="0.00" value={form.valor}
                onChange={e => set('valor', e.target.value)} />
            </div>
            <div>
              <label className="label">Data</label>
              <input className="input mt-1" type="date" value={form.data}
                onChange={e => set('data', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select className="input mt-1" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                {Object.entries(CATEGORIAS_GASTO).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Pagamento</label>
              <select className="input mt-1" value={form.forma_pagamento} onChange={e => set('forma_pagamento', e.target.value)}>
                <option value="pix">PIX</option>
                <option value="cartao_debito">Cartão Débito</option>
                <option value="cartao_credito">Cartão Crédito</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
          </div>

          {/* Recorrente */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" checked={form.recorrente}
              onChange={e => set('recorrente', e.target.checked)} />
            <span className="text-sm text-zinc-400">Gasto recorrente (mensal)</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : '💸 Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
