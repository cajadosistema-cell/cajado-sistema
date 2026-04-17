'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Colaborador } from '../types'

type Props = {
  colaboradores: Colaborador[]
  onSave: () => void
  onClose: () => void
}

export function ModalNovaTarefa({ colaboradores, onSave, onClose }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    responsavel_id: colaboradores[0]?.id ?? '',
    prioridade: 'media' as 'baixa' | 'media' | 'alta' | 'urgente',
    prazo: '',
    modulo: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await (supabase.from('tarefas') as any).insert({
      titulo: form.titulo,
      descricao: form.descricao || null,
      responsavel_id: form.responsavel_id || null,
      prioridade: form.prioridade,
      prazo: form.prazo || null,
      modulo: form.modulo || null,
      status: 'a_fazer',
    })
    setLoading(false)
    onSave()
    onClose()
  }

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Nova Tarefa</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Título *</label>
            <input className="input mt-1" required value={form.titulo} placeholder="Ex: Ligar para cliente X"
              onChange={e => set('titulo', e.target.value)} />
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea className="input mt-1 min-h-[80px] resize-none" value={form.descricao} placeholder="Detalhes da tarefa..."
              onChange={e => set('descricao', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Responsável</label>
              <select className="input mt-1" value={form.responsavel_id} onChange={e => set('responsavel_id', e.target.value)}>
                <option value="">Sem responsável</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Prioridade</label>
              <select className="input mt-1" value={form.prioridade} onChange={e => set('prioridade', e.target.value as any)}>
                <option value="baixa">🟢 Baixa</option>
                <option value="media">🔵 Média</option>
                <option value="alta">🟡 Alta</option>
                <option value="urgente">🔴 Urgente</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Prazo</label>
              <input className="input mt-1" type="date" value={form.prazo} onChange={e => set('prazo', e.target.value)} />
            </div>
            <div>
              <label className="label">Módulo</label>
              <select className="input mt-1" value={form.modulo} onChange={e => set('modulo', e.target.value)}>
                <option value="">Geral</option>
                <option value="financeiro">Financeiro</option>
                <option value="crm">CRM / Cajado</option>
                <option value="inbox">Inbox</option>
                <option value="vendas">Vendas</option>
                <option value="trader">Trader</option>
                <option value="operacional">Operacional</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
