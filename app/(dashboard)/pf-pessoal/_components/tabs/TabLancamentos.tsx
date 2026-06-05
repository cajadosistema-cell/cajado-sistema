'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GastoPessoal, ReceitaPessoal } from '../types'
import { CATEGORIAS_GASTO, CATEGORIAS_RECEITA, formatCurrency } from '../types'

// Badge de forma de pagamento
const PAGAMENTO_BADGE: Record<string, { label: string; cls: string }> = {
  cartao_credito: { label: '💳 Crédito',     cls: 'bg-blue-500/10 text-blue-400'    },
  cartao_debito:  { label: '💳 Débito',      cls: 'bg-indigo-500/10 text-indigo-400' },
  pix:            { label: '⚡ PIX',          cls: 'bg-emerald-500/10 text-emerald-400' },
  dinheiro:       { label: '💵 Dinheiro',    cls: 'bg-amber-500/10 text-amber-400'   },
  transferencia:  { label: '🔄 Transferência',cls: 'bg-purple-500/10 text-purple-400' },
}

type Props = {
  gastos: GastoPessoal[]
  receitas: ReceitaPessoal[]
  contas: any[]
  onUpdate: () => void
  onNovoGasto: () => void
  onNovaReceita: () => void
  onEditGasto: (g: GastoPessoal) => void
  onEditReceita: (r: ReceitaPessoal) => void
}

function formatData(data: string) {
  return new Date(data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

export function TabLancamentos({ gastos, receitas, contas, onUpdate, onNovoGasto, onNovaReceita, onEditGasto, onEditReceita }: Props) {
  const supabase = createClient()
  const [filtro, setFiltro] = useState<'todos' | 'gastos' | 'receitas'>('todos')
  const [filtroPag, setFiltroPag] = useState<string>('todos')

  // Mesclar e ordenar por data
  const todos = [
    ...gastos.map(g => ({ ...g, _tipo: 'gasto' as const })),
    ...receitas.map(r => ({ ...r, _tipo: 'receita' as const })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  const filtrados = todos.filter(item => {
    const tipoOk = filtro === 'todos' || item._tipo === (filtro === 'gastos' ? 'gasto' : 'receita')
    const pagOk  = filtroPag === 'todos' || (item as any).forma_pagamento === filtroPag
    return tipoOk && pagOk
  })

  const excluirGasto = async (id: string) => {
    if (!confirm('Deseja realmente excluir este gasto?')) return
    const { error } = await (supabase.from('gastos_pessoais') as any).delete().eq('id', id)
    if (error) { alert('Erro ao excluir gasto: ' + error.message); return }
    onUpdate()
  }

  const excluirReceita = async (id: string) => {
    if (!confirm('Deseja realmente excluir esta receita?')) return
    const { error } = await (supabase.from('receitas_pessoais') as any).delete().eq('id', id)
    if (error) { alert('Erro ao excluir receita: ' + error.message); return }
    onUpdate()
  }

  const avulsos    = filtrados.filter(item => !item.recorrente && (!(item as any).parcelas || (item as any).parcelas <= 1))
  const fixos      = filtrados.filter(item => item.recorrente)   // todos recorrentes = fixos
  const parcelados = filtrados.filter(item => !item.recorrente && (item as any).parcelas && (item as any).parcelas > 1)

  const somaAvulsos     = avulsos.filter(i => i._tipo === 'gasto').reduce((s, i) => s + i.valor, 0)
  const somaFixos       = fixos.filter(i => i._tipo === 'gasto').reduce((s, i) => s + i.valor, 0)
  const somaParcelados  = parcelados.filter(i => i._tipo === 'gasto').reduce((s, i) => s + i.valor, 0)
  const somaTotal       = somaAvulsos + somaFixos + somaParcelados
  const somaReceitas    = filtrados.filter(i => i._tipo === 'receita').reduce((s, i) => s + i.valor, 0)

  const renderItem = (item: any) => {
    const isGasto  = item._tipo === 'gasto'
    const catInfo  = isGasto ? CATEGORIAS_GASTO[item.categoria] : CATEGORIAS_RECEITA[item.categoria]
    const pagInfo  = PAGAMENTO_BADGE[item.forma_pagamento]
    // Encontra nome do cartão se for cartão de crédito/débito
    const contaNome = item.conta_id
      ? contas.find(c => c.id === item.conta_id)?.nome_cartao || contas.find(c => c.id === item.conta_id)?.nome
      : null

    return (
      <div key={item.id} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-muted/50 transition-colors group">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
            isGasto ? 'bg-red-500/10' : 'bg-emerald-500/10'
          }`}>
            {catInfo?.icon ?? (isGasto ? '💸' : '💰')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-fg truncate">{item.descricao}</p>
            <div className="flex flex-wrap gap-1.5 items-center mt-0.5">
              <p className="text-[10px] text-fg-disabled">{catInfo?.label ?? item.categoria} · {formatData(item.data)}</p>
              {/* Badge forma de pagamento */}
              {pagInfo && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${pagInfo.cls}`}>
                  {pagInfo.label}
                </span>
              )}
              {/* Nome do cartão */}
              {contaNome && (
                <span className="text-[9px] bg-white/5 text-fg-tertiary px-1.5 py-0.5 rounded-full">
                  {contaNome}
                </span>
              )}
              {/* Parcelas */}
              {item.parcelas && item.parcelas > 1 && (
                <span className="text-[9px] bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded-full">
                  {item.parcelas}x
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <p className={`text-xs font-semibold ${isGasto ? 'text-red-400' : 'text-emerald-400'}`}>
            {isGasto ? '-' : '+'}{formatCurrency(item.valor)}
          </p>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => isGasto ? onEditGasto(item as any) : onEditReceita(item as any)} className="text-[10px] text-blue-400 hover:text-blue-300">✏️</button>
            <button onClick={() => isGasto ? excluirGasto(item.id) : excluirReceita(item.id)} className="text-[10px] text-red-400 hover:text-red-300">✕</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filtros e ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-1 bg-page border border-border-subtle rounded-xl p-1">
          {(['todos', 'gastos', 'receitas'] as const).map(f => (
            <button key={f} onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
                filtro === f ? 'bg-muted text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
              }`}>
              {f === 'todos' ? '📋 Todos' : f === 'gastos' ? '💸 Gastos' : '💰 Receitas'}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onNovaReceita} className="btn-secondary text-xs">+ Receita</button>
          <button onClick={onNovoGasto}   className="btn-primary   text-xs">+ Gasto</button>
        </div>
      </div>

      {/* Filtro de forma de pagamento */}
      <div className="flex flex-wrap gap-1.5">
        {['todos', 'pix', 'cartao_credito', 'cartao_debito', 'dinheiro', 'transferencia'].map(p => (
          <button key={p} onClick={() => setFiltroPag(p)}
            className={`text-[10px] px-2.5 py-1 rounded-full border transition-all font-medium ${
              filtroPag === p
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'border-white/10 text-fg-disabled hover:border-white/20 hover:text-fg-secondary'
            }`}>
            {p === 'todos' ? '🔎 Todos' : PAGAMENTO_BADGE[p]?.label ?? p}
          </button>
        ))}
      </div>

      {/* Barra de total geral */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: '💸 Avulsos',     soma: somaAvulsos,   count: avulsos.length,   cor: 'text-red-400',          bg: 'bg-red-500/5   border-red-500/10'   },
          { label: '📌 Fixos',       soma: somaFixos,     count: fixos.length,     cor: 'text-amber-400',        bg: 'bg-amber-500/5 border-amber-500/10' },
          { label: '💳 Parcelados',  soma: somaParcelados,count: parcelados.length, cor: 'text-blue-400',         bg: 'bg-blue-500/5  border-blue-500/10'  },
          { label: '📊 Total Gasto', soma: somaTotal,     count: avulsos.length + fixos.length + parcelados.length, cor: 'text-red-300 font-bold', bg: 'bg-red-500/10 border-red-500/20' },
        ].map(({ label, soma, count, cor, bg }) => (
          <div key={label} className={`rounded-xl border px-3 py-2 ${bg}`}>
            <p className="text-[9px] text-fg-tertiary uppercase tracking-wider mb-0.5">{label}</p>
            <p className={`text-sm font-bold ${cor}`}>{formatCurrency(soma)}</p>
            <p className="text-[10px] text-fg-disabled">{count} item(s)</p>
          </div>
        ))}
      </div>

      {/* Listas */}
      {filtrados.length === 0 ? (
        <div className="bg-page border border-border-subtle rounded-2xl overflow-hidden p-16 text-center">
          <p className="text-3xl mb-3">📋</p>
          <p className="text-sm text-fg-tertiary">Nenhum lançamento encontrado.</p>
          <div className="flex gap-2 justify-center mt-4">
            <button onClick={onNovoGasto}    className="btn-secondary text-xs">+ Registrar gasto</button>
            <button onClick={onNovaReceita}  className="btn-primary   text-xs">+ Registrar receita</button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Avulsos */}
          <div className="bg-page border border-border-subtle rounded-xl overflow-hidden flex flex-col max-h-[600px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-red-500/5">
              <h3 className="text-sm font-semibold text-fg">💸 Avulsos</h3>
              <div className="text-right">
                <p className="text-xs font-bold text-red-400">{formatCurrency(somaAvulsos)}</p>
                <p className="text-[10px] text-fg-tertiary">{avulsos.length} itens</p>
              </div>
            </div>
            <div className="p-2 space-y-0.5 overflow-y-auto flex-1">
              {avulsos.length === 0
                ? <p className="text-xs text-fg-disabled text-center py-8">Nenhum gasto avulso.</p>
                : avulsos.map(renderItem)}
            </div>
          </div>

          {/* Fixos / Recorrentes — todos com recorrente: true */}
          <div className="bg-page border border-border-subtle rounded-xl overflow-hidden flex flex-col max-h-[600px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-amber-500/5">
              <div>
                <h3 className="text-sm font-semibold text-fg">📌 Fixos / Recorrentes</h3>
                <p className="text-[10px] text-fg-disabled mt-0.5">Gastos marcados como recorrentes</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold text-amber-400">{formatCurrency(somaFixos)}</p>
                <p className="text-[10px] text-fg-tertiary">{fixos.length} itens</p>
              </div>
            </div>
            <div className="p-2 space-y-0.5 overflow-y-auto flex-1">
              {fixos.length === 0
                ? <p className="text-xs text-fg-disabled text-center py-8">Nenhum gasto fixo.{"\n"}Ao registrar um gasto, marque "Gasto recorrente".</p>
                : fixos.map(renderItem)}
            </div>
          </div>

          {/* Parcelados */}
          <div className="bg-page border border-border-subtle rounded-xl overflow-hidden flex flex-col max-h-[600px]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle bg-blue-500/5">
              <h3 className="text-sm font-semibold text-fg">💳 Parcelados</h3>
              <div className="text-right">
                <p className="text-xs font-bold text-blue-400">{formatCurrency(somaParcelados)}</p>
                <p className="text-[10px] text-fg-tertiary">{parcelados.length} itens</p>
              </div>
            </div>
            <div className="p-2 space-y-0.5 overflow-y-auto flex-1">
              {parcelados.length === 0
                ? <p className="text-xs text-fg-disabled text-center py-8">Nenhum item parcelado.</p>
                : parcelados.map(renderItem)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
