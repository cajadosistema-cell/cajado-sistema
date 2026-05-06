'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { detectarCategoria, CATEGORIAS_GASTO } from '../types'

type Props = {
  userId: string
  onSave: () => void
  onClose: () => void
  gastoEdit?: any
}

export function ModalNovoGasto({ userId, onSave, onClose, gastoEdit }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    descricao:       gastoEdit?.descricao         ?? '',
    valor:           gastoEdit?.valor?.toString() ?? '',
    categoria:       gastoEdit?.categoria         ?? 'outros',
    forma_pagamento: gastoEdit?.forma_pagamento   ?? 'pix',
    data:            gastoEdit?.data              ?? today,
    recorrente:      gastoEdit?.recorrente        ?? false,
    notas:           gastoEdit?.notas             ?? '',
    parcelas:        gastoEdit?.parcelas?.toString() ?? '1',
  })

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleDescricao = (desc: string) => {
    const cat = detectarCategoria(desc)
    setForm(f => ({ ...f, descricao: desc, categoria: cat }))
  }

  const isCartaoCredito = form.forma_pagamento === 'cartao_credito'
  const numParcelas  = parseInt(form.parcelas) || 1
  const valorTotal   = parseFloat(form.valor.replace(',', '.')) || 0
  const valorParcela = numParcelas > 1 ? valorTotal / numParcelas : valorTotal

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!valorTotal || valorTotal <= 0) return
    setLoading(true)

    const payload = {
      user_id:         userId,
      descricao:       form.descricao,
      valor:           valorTotal,
      categoria:       form.categoria,
      forma_pagamento: form.forma_pagamento,
      data:            form.data,
      recorrente:      form.recorrente,
      notas:           form.notas || null,
      parcelas:        isCartaoCredito && numParcelas > 1 ? numParcelas : null,
    }

    if (gastoEdit) {
      await (supabase.from('gastos_pessoais') as any).update(payload).eq('id', gastoEdit.id)
    } else {
      await (supabase.from('gastos_pessoais') as any).insert(payload)
    }
    setLoading(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border-subtle">
          <div>
            <h2 className="text-base font-semibold text-fg">
              {gastoEdit ? '✏️ Editar Gasto' : '💸 Novo Gasto Pessoal'}
            </h2>
            {!gastoEdit && (
              <p className="text-xs text-fg-tertiary mt-0.5">Categoria detectada automaticamente</p>
            )}
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          {/* Descrição */}
          <div>
            <label className="label">Descrição *</label>
            <input
              className="input mt-1" required value={form.descricao}
              placeholder="Ex: Supermercado, Uber, Netflix..."
              onChange={e => handleDescricao(e.target.value)}
            />
            {form.descricao && (
              <p className="text-[10px] text-fg-tertiary mt-1">
                Categoria detectada: {CATEGORIAS_GASTO[form.categoria]?.icon} {CATEGORIAS_GASTO[form.categoria]?.label}
              </p>
            )}
          </div>

          {/* Valor + Data */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor total (R$) *</label>
              <input
                className="input mt-1" required type="number" step="0.01" min="0.01"
                placeholder="0.00" value={form.valor}
                onChange={e => set('valor', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Data</label>
              <input className="input mt-1" type="date" value={form.data}
                onChange={e => set('data', e.target.value)} />
            </div>
          </div>

          {/* Categoria + Pagamento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select className="input mt-1" value={form.categoria}
                onChange={e => set('categoria', e.target.value)}>
                {Object.entries(CATEGORIAS_GASTO).map(([k, v]) => (
                  <option key={k} value={k}>{(v as any).icon} {(v as any).label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Pagamento</label>
              <select className="input mt-1" value={form.forma_pagamento}
                onChange={e => set('forma_pagamento', e.target.value)}>
                <option value="pix">PIX</option>
                <option value="cartao_debito">Cartão Débito</option>
                <option value="cartao_credito">Cartão Crédito</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="transferencia">Transferência</option>
              </select>
            </div>
          </div>

          {/* ── Parcelas — só aparece para Cartão Crédito ── */}
          {isCartaoCredito && (
            <div className="bg-blue-500/8 border border-blue-500/20 rounded-xl p-3 space-y-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">📅 Parcelamento</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Nº de parcelas</label>
                  <select className="input mt-1" value={form.parcelas}
                    onChange={e => set('parcelas', e.target.value)}>
                    {[1,2,3,4,5,6,7,8,9,10,11,12,15,18,21,24,30,36,48].map(n => (
                      <option key={n} value={n}>{n}x</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">Valor por parcela</label>
                  <div className="input mt-1 flex items-center">
                    <span className={`text-sm font-bold ${numParcelas > 1 ? 'text-blue-400' : 'text-fg-disabled'}`}>
                      {numParcelas > 1 && valorTotal > 0
                        ? `${numParcelas}x de R$\u00a0${valorParcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>
              {numParcelas > 1 && valorTotal > 0 && (
                <p className="text-[10px] text-blue-300">
                  💡 Total R$\u00a0{valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} dividido em {numParcelas} parcelas
                </p>
              )}
            </div>
          )}

          {/* Recorrente */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" checked={form.recorrente}
              onChange={e => set('recorrente', e.target.checked)} />
            <span className="text-sm text-fg-secondary">Gasto recorrente (mensal)</span>
          </label>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳ Salvando...' : gastoEdit ? '💾 Salvar Alterações' : '💸 Registrar Gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
