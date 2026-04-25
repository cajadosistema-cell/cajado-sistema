'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ReceitaPessoal } from '../types'
import { CATEGORIAS_RECEITA, formatCurrency } from '../types'

type Props = {
  receitas: ReceitaPessoal[]
  onUpdate: () => void
  onNovaReceita: () => void
}

export function TabPrevisao({ receitas, onUpdate, onNovaReceita }: Props) {
  const mesAtual = new Date().toISOString().slice(0, 7)

  // Receitas recorrentes = previsão para próximos meses
  const recorrentes = receitas.filter(r => r.recorrente)
  const totalRecorrente = recorrentes.reduce((a, r) => a + r.valor, 0)

  // Receitas do mês atual
  const receitasMes = receitas.filter(r => r.data.startsWith(mesAtual))
  const totalMes = receitasMes.reduce((a, r) => a + r.valor, 0)

  // Projeção: dia do mês atual / dias totais → projetar o mês completo
  const hoje = new Date()
  const diaDoMes = hoje.getDate()
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const projecaoMes = diaDoMes > 0 ? (totalMes / diaDoMes) * diasNoMes : 0

  // Próximos 3 meses
  const proximosMeses = Array.from({ length: 3 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() + i + 1)
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return { label, valor: totalRecorrente }
  })

  return (
    <div className="space-y-6">
      {/* Previsão mês atual */}
      <div className="bg-page border border-border-subtle rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-fg-secondary mb-4">📅 Previsão para Este Mês</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Recebido até hoje',     value: formatCurrency(totalMes),         color: 'text-emerald-400' },
            { label: 'Projeção do mês',       value: formatCurrency(projecaoMes),      color: 'text-amber-400', sub: `Baseado em ${diaDoMes}/${diasNoMes} dias` },
            { label: 'Receitas recorrentes',  value: formatCurrency(totalRecorrente),  color: 'text-purple-400', sub: 'Confirmado para os próximos meses' },
          ].map(k => (
            <div key={k.label} className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs text-fg-tertiary mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              {k.sub && <p className="text-[10px] text-fg-disabled mt-1">{k.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Receitas recorrentes confirmadas */}
      <div className="bg-page border border-border-subtle rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-fg-secondary">🔄 Receitas Recorrentes</h3>
          <button onClick={onNovaReceita} className="btn-ghost text-xs">+ Adicionar</button>
        </div>
        {recorrentes.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-fg-disabled">Nenhuma receita recorrente cadastrada.</p>
            <p className="text-[10px] text-zinc-700 mt-1">Adicione pró-labore, salário ou outras rendas fixas marcando como recorrente.</p>
            <button onClick={onNovaReceita} className="btn-primary text-xs mt-3">+ Adicionar receita recorrente</button>
          </div>
        ) : (
          <div className="space-y-2">
            {recorrentes.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-border-subtle/50 last:border-0">
                <div>
                  <p className="text-sm text-fg">{r.descricao}</p>
                  <p className="text-xs text-fg-tertiary capitalize">{CATEGORIAS_RECEITA[r.categoria]?.label ?? r.categoria}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-400">{formatCurrency(r.valor)}<span className="text-xs text-fg-tertiary">/mês</span></p>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-fg-secondary">Total mensal confirmado</span>
              <span className="text-sm font-bold text-emerald-400">{formatCurrency(totalRecorrente)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Projeção próximos meses */}
      {totalRecorrente > 0 && (
        <div className="bg-page border border-border-subtle rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-fg-secondary mb-4">📈 Projeção Próximos 3 Meses</h3>
          <div className="space-y-2">
            {proximosMeses.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border-subtle/30 last:border-0">
                <span className="text-sm text-fg-secondary capitalize">{m.label}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-emerald-400">{formatCurrency(m.valor)}</span>
                  <span className="text-xs text-fg-disabled ml-1">(recorrentes)</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-fg-disabled mt-3">* Projeção baseada apenas em receitas marcadas como recorrentes. Receitas variáveis não estão incluídas.</p>
        </div>
      )}
    </div>
  )
}
