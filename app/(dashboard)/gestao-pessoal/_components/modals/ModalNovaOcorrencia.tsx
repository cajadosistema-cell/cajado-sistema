'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Colaborador } from '../types'

type Props = {
  colaboradores: Colaborador[]
  onSave: () => void
  onClose: () => void
}

export function ModalNovaOcorrencia({ colaboradores, onSave, onClose }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    tipo: 'acerto' as 'erro' | 'acerto' | 'alerta' | 'elogio',
    descricao: '',
    colaborador_id: '',
    modulo: '',
    impacto: 'medio' as 'baixo' | 'medio' | 'alto',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await (supabase.from('ocorrencias') as any).insert({
      tipo: form.tipo,
      descricao: form.descricao,
      colaborador_id: form.colaborador_id || null,
      modulo: form.modulo || null,
      impacto: form.impacto,
      resolvida: false,
    })
    setLoading(false)
    onSave()
    onClose()
  }

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  const TIPOS = [
    { value: 'acerto',  label: '✅ Acerto',  desc: 'Algo que foi bem feito' },
    { value: 'elogio',  label: '⭐ Elogio',  desc: 'Reconhecimento positivo' },
    { value: 'alerta',  label: '⚠️ Alerta',  desc: 'Ponto de atenção' },
    { value: 'erro',    label: '❌ Erro',    desc: 'Problema identificado' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Registrar Ocorrência</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div>
            <label className="label mb-2 block">Tipo *</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(t => (
                <button
                  key={t.value} type="button"
                  onClick={() => set('tipo', t.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${
                    form.tipo === t.value
                      ? t.value === 'erro' ? 'border-red-500/60 bg-red-500/5'
                      : t.value === 'acerto' ? 'border-emerald-500/60 bg-emerald-500/5'
                      : t.value === 'alerta' ? 'border-amber-500/60 bg-amber-500/5'
                      : 'border-purple-500/60 bg-purple-500/5'
                      : 'border-zinc-700 bg-zinc-800/30 hover:border-zinc-600'
                  }`}
                >
                  <p className="text-sm font-medium text-zinc-200">{t.label}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="label">Descrição *</label>
            <textarea required className="input mt-1 min-h-[80px] resize-none" value={form.descricao}
              placeholder="Descreva o que aconteceu..."
              onChange={e => set('descricao', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Colaborador</label>
              <select className="input mt-1" value={form.colaborador_id} onChange={e => set('colaborador_id', e.target.value)}>
                <option value="">Selecionar...</option>
                {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Impacto</label>
              <select className="input mt-1" value={form.impacto} onChange={e => set('impacto', e.target.value as any)}>
                <option value="baixo">🟢 Baixo</option>
                <option value="medio">🟡 Médio</option>
                <option value="alto">🔴 Alto</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Módulo relacionado</label>
            <select className="input mt-1" value={form.modulo} onChange={e => set('modulo', e.target.value)}>
              <option value="">Geral</option>
              <option value="financeiro">Financeiro</option>
              <option value="crm">CRM / Cajado</option>
              <option value="inbox">Inbox / Atendimento</option>
              <option value="vendas">Vendas</option>
              <option value="operacional">Operacional</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Registrando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
