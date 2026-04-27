'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIAS_RECEITA } from '../types'

type Props = {
  userId: string
  onSave: () => void
  onClose: () => void
  receitaEdit?: any
}

export function ModalNovaReceita({ userId, onSave, onClose, receitaEdit }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    descricao: receitaEdit?.descricao ?? '',
    valor: receitaEdit?.valor?.toString() ?? '',
    categoria: receitaEdit?.categoria ?? 'pro_labore',
    data: receitaEdit?.data ?? today,
    recorrente: receitaEdit?.recorrente ?? true,
    notas: receitaEdit?.notas ?? '',
  })

  const set = (k: keyof typeof form, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) return
    setLoading(true)
    const payload = {
      user_id: userId,
      descricao: form.descricao,
      valor,
      categoria: form.categoria,
      data: form.data,
      recorrente: form.recorrente,
      notas: form.notas || null,
    }

    if (receitaEdit) {
      await (supabase.from('receitas_pessoais') as any).update(payload).eq('id', receitaEdit.id)
    } else {
      await (supabase.from('receitas_pessoais') as any).insert(payload)
    }
    setLoading(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">{receitaEdit ? '✏️ Editar Receita' : 'Nova Receita Pessoal'}</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              placeholder="Ex: Pró-labore abril, Freelance site..."
              onChange={e => set('descricao', e.target.value)} />
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

          <div>
            <label className="label">Categoria</label>
            <select className="input mt-1" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
              {Object.entries(CATEGORIAS_RECEITA).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded" checked={form.recorrente}
              onChange={e => set('recorrente', e.target.checked)} />
            <span className="text-sm text-fg-secondary">Receita recorrente (aparece na previsão de meses futuros)</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : receitaEdit ? 'Salvar Alterações' : '💰 Registrar Receita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
