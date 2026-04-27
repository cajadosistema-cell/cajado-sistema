'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GastoPessoal, ReceitaPessoal } from '../types'
import { CATEGORIAS_GASTO, CATEGORIAS_RECEITA, formatCurrency } from '../types'

type Props = {
  gastos: GastoPessoal[]
  receitas: ReceitaPessoal[]
  onUpdate: () => void
  onNovoGasto: () => void
  onNovaReceita: () => void
  onEditGasto: (g: GastoPessoal) => void
  onEditReceita: (r: ReceitaPessoal) => void
}

function formatData(data: string) {
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function TabLancamentos({ gastos, receitas, onUpdate, onNovoGasto, onNovaReceita, onEditGasto, onEditReceita }: Props) {
  const supabase = createClient()
  const [filtro, setFiltro] = useState<'todos' | 'gastos' | 'receitas'>('todos')

  // Mesclar e ordenar por data
  const todos = [
    ...gastos.map(g => ({ ...g, _tipo: 'gasto' as const })),
    ...receitas.map(r => ({ ...r, _tipo: 'receita' as const })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  const filtrados = todos.filter(item => {
    if (filtro === 'gastos') return item._tipo === 'gasto'
    if (filtro === 'receitas') return item._tipo === 'receita'
    return true
  })

  const excluirGasto = async (id: string) => {
    if (!confirm('Deseja realmente excluir este gasto?')) return
    await (supabase.from('gastos_pessoais') as any).delete().eq('id', id)
    onUpdate()
  }

  const excluirReceita = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta receita?')) return
    await (supabase.from('receitas_pessoais') as any).delete().eq('id', id)
    onUpdate()
  }

  return (
    <div className="space-y-4">
      {/* Filtros e ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-page border border-border-subtle rounded-xl p-1">
          {(['todos', 'gastos', 'receitas'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                filtro === f ? 'bg-muted text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
              }`}
            >
              {f === 'todos' ? '📋 Todos' : f === 'gastos' ? '💸 Gastos' : '💰 Receitas'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onNovaReceita} className="btn-secondary text-xs">+ Receita</button>
          <button onClick={onNovoGasto} className="btn-primary text-xs">+ Gasto</button>
        </div>
      </div>

      {/* Lista */}
      <div className="bg-page border border-border-subtle rounded-2xl overflow-hidden">
        {filtrados.length === 0 ? (
          <div className="p-16 text-center">
            <p className="text-3xl mb-3">📋</p>
            <p className="text-sm text-fg-tertiary">Nenhum lançamento encontrado.</p>
            <div className="flex gap-2 justify-center mt-4">
              <button onClick={onNovoGasto} className="btn-secondary text-xs">+ Registrar gasto</button>
              <button onClick={onNovaReceita} className="btn-primary text-xs">+ Registrar receita</button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle/50">
            {filtrados.map(item => {
              const isGasto = item._tipo === 'gasto'
              const catInfo = isGasto
                ? CATEGORIAS_GASTO[item.categoria]
                : CATEGORIAS_RECEITA[item.categoria]

              return (
                <div key={item.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors group">
                  {/* Ícone categoria */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-base shrink-0 ${
                    isGasto ? 'bg-red-500/10' : 'bg-emerald-500/10'
                  }`}>
                    {catInfo?.icon ?? (isGasto ? '💸' : '💰')}
                  </div>

                  {/* Descrição + categoria */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{item.descricao}</p>
                    <p className="text-xs text-fg-tertiary">
                      {catInfo?.label ?? item.categoria} · {formatData(item.data)}
                      {item.recorrente && ' · 🔄 Recorrente'}
                    </p>
                  </div>

                  {/* Valor */}
                  <p className={`text-sm font-semibold shrink-0 ${isGasto ? 'text-red-400' : 'text-emerald-400'}`}>
                    {isGasto ? '-' : '+'}{formatCurrency(item.valor)}
                  </p>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => isGasto ? onEditGasto(item as any) : onEditReceita(item as any)}
                      className="text-zinc-700 hover:text-blue-400 text-sm transition-colors opacity-0 group-hover:opacity-100"
                      title="Editar"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => isGasto ? excluirGasto(item.id) : excluirReceita(item.id)}
                      className="text-zinc-700 hover:text-red-400 text-sm transition-colors opacity-0 group-hover:opacity-100"
                      title="Excluir"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
