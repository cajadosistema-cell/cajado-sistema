'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { EmptyState } from '@/components/shared/ui'
import { formatCurrency, cn } from '@/lib/utils'

type Imovel = {
  id: string
  titulo: string
  endereco: string | null
  tipo_imovel: 'residencial' | 'comercial' | 'terreno' | 'galpao'
  area_m2: number | null
  quartos: number | null
  vagas: number | null
  valor_compra: number | null
  valor_mercado: number | null
  status: 'alugado' | 'disponivel' | 'em_reforma' | 'vendido'
}

const STATUS_CONFIG = {
  alugado:    { label: 'Alugado',     color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  disponivel: { label: 'Disponível',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  em_reforma: { label: 'Em Reforma',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  vendido:    { label: 'Vendido',     color: 'text-fg-secondary bg-muted border-border-subtle' },
}

export function TabImoveis() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    titulo: '', endereco: '', tipo_imovel: 'residencial' as Imovel['tipo_imovel'],
    area_m2: '', quartos: '', vagas: '',
    valor_compra: '', valor_mercado: '', status: 'disponivel' as Imovel['status']
  })

  const { data: imoveis, refetch } = useSupabaseQuery<Imovel>('imoveis', {
    orderBy: { column: 'criado_em', ascending: false }
  } as any)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    await (supabase.from('imoveis') as any).insert({
      titulo: form.titulo,
      endereco: form.endereco || null,
      tipo_imovel: form.tipo_imovel,
      area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
      quartos: form.quartos ? parseInt(form.quartos) : null,
      vagas: form.vagas ? parseInt(form.vagas) : null,
      valor_compra: form.valor_compra ? parseFloat(form.valor_compra) : null,
      valor_mercado: form.valor_mercado ? parseFloat(form.valor_mercado) : null,
      status: form.status,
    })
    setShowForm(false)
    refetch()
    setForm({ titulo: '', endereco: '', tipo_imovel: 'residencial', area_m2: '', quartos: '', vagas: '', valor_compra: '', valor_mercado: '', status: 'disponivel' })
  }

  const mudarStatus = async (id: string, status: Imovel['status']) => {
    await (supabase.from('imoveis') as any).update({ status }).eq('id', id)
    refetch()
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-sm font-semibold text-fg">🏠 Carteira de Imóveis</h2>
        <button onClick={() => setShowForm(s => !s)} className="btn-primary text-xs">
          {showForm ? '✕ Cancelar' : '+ Cadastrar Imóvel'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSalvar} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Título / Apelido *</label>
              <input className="input mt-1" required value={form.titulo}
                onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
                placeholder="Ex: Apto 302 Centro" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo_imovel} onChange={e => setForm(f => ({...f, tipo_imovel: e.target.value as any}))}>
                <option value="residencial">Residencial</option>
                <option value="comercial">Comercial</option>
                <option value="galpao">Galpão</option>
                <option value="terreno">Terreno</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Endereço Completo</label>
            <input className="input mt-1" value={form.endereco}
                onChange={e => setForm(f => ({...f, endereco: e.target.value}))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Área (m²)</label><input type="number" className="input mt-1" value={form.area_m2} onChange={e => setForm(f => ({...f, area_m2: e.target.value}))} /></div>
            <div><label className="label">Quartos</label><input type="number" className="input mt-1" value={form.quartos} onChange={e => setForm(f => ({...f, quartos: e.target.value}))} /></div>
            <div><label className="label">Vagas</label><input type="number" className="input mt-1" value={form.vagas} onChange={e => setForm(f => ({...f, vagas: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Valor Compra (R$)</label><input type="number" step="0.01" className="input mt-1" value={form.valor_compra} onChange={e => setForm(f => ({...f, valor_compra: e.target.value}))} /></div>
            <div><label className="label">Valor Mercado (R$)</label><input type="number" step="0.01" className="input mt-1" value={form.valor_mercado} onChange={e => setForm(f => ({...f, valor_mercado: e.target.value}))} /></div>
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as any}))}>
                <option value="alugado">Alugado</option>
                <option value="disponivel">Disponível</option>
                <option value="em_reforma">Em Reforma</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">Salvar Imóvel</button>
          </div>
        </form>
      )}

      {imoveis.length === 0 ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8"><EmptyState message="Nenhum imóvel detalhado cadastrado" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {imoveis.map(i => (
            <div key={i.id} className="bg-page border border-border-subtle rounded-xl p-5 hover:border-border-subtle transition-colors">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="text-sm font-bold text-fg">{i.titulo}</h3>
                  <p className="text-xs text-fg-tertiary capitalize">{i.tipo_imovel}</p>
                </div>
                <select className={cn("text-[10px] px-2 py-1 rounded-full border bg-page outline-none", STATUS_CONFIG[i.status].color)}
                  value={i.status} onChange={e => mudarStatus(i.id, e.target.value as Imovel['status'])}>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              {i.endereco && <p className="text-[10px] text-fg-secondary mb-4 line-clamp-1">📍 {i.endereco}</p>}

              <div className="flex gap-4 mb-4">
                {i.area_m2 && <div className="text-xs text-fg-tertiary">📏 <span className="text-fg-secondary font-medium">{i.area_m2}m²</span></div>}
                {i.quartos && <div className="text-xs text-fg-tertiary">🛏️ <span className="text-fg-secondary font-medium">{i.quartos}</span></div>}
                {i.vagas && <div className="text-xs text-fg-tertiary">🚗 <span className="text-fg-secondary font-medium">{i.vagas}</span></div>}
              </div>

              <div className="pt-3 border-t border-border-subtle/80 grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[9px] text-fg-disabled uppercase tracking-widest">Valor de Compra</p>
                  <p className="text-sm font-semibold text-fg-secondary">{i.valor_compra ? formatCurrency(i.valor_compra) : '—'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-fg-disabled uppercase tracking-widest">Valor de Mercado</p>
                  <p className="text-sm font-semibold text-emerald-400">{i.valor_mercado ? formatCurrency(i.valor_mercado) : '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
