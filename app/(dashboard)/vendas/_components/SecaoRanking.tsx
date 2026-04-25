'use client'

import { useState } from 'react'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'

type Venda = {
  id: string
  total: number
  status: string
  status_pagamento: string
  atendente_id: string | null
  data_abertura: string
  atendente?: { nome: string }
}

type MetaVenda = {
  id: string
  atendente_id: string | null
  mes_referencia: string
  valor_meta: number
}

type EntradaRanking = {
  id: string
  nome: string
  total: number
  qtd: number
  ticket_medio: number
  meta: number | null
  pct_meta: number | null
}

const PERIODOS = [
  { id: 'mes', label: 'Este mês' },
  { id: 'trimestre', label: 'Trimestre' },
  { id: 'ano', label: 'Este ano' },
]

function formatCurrency(val: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)
}

export function SecaoRanking() {
  const [periodo, setPeriodo] = useState<'mes' | 'trimestre' | 'ano'>('mes')

  const now = new Date()
  const mesRef = now.toISOString().slice(0, 7)

  const { data: vendas } = useSupabaseQuery<Venda>('vendas', {
    select: '*, atendente:atendente_id(nome)',
    orderBy: { column: 'data_abertura', ascending: false },
    limit: 200,
  })

  const { data: metas } = useSupabaseQuery<MetaVenda>('metas_vendas', {
    filters: { mes_referencia: mesRef },
  } as any)

  // Filtrar por período
  const vendasFiltradas = vendas.filter(v => {
    if (!v.data_abertura) return false
    const d = new Date(v.data_abertura)
    if (periodo === 'mes') {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    }
    if (periodo === 'trimestre') {
      const mesAtual = now.getMonth()
      const trimestreInicio = Math.floor(mesAtual / 3) * 3
      return d.getFullYear() === now.getFullYear() && d.getMonth() >= trimestreInicio && d.getMonth() <= mesAtual
    }
    // ano
    return d.getFullYear() === now.getFullYear()
  }).filter(v => v.status !== 'cancelada')

  // Agregar por atendente
  const mapaAtendente: Record<string, EntradaRanking> = {}
  for (const v of vendasFiltradas) {
    const nome = (v as any).atendente?.nome ?? v.atendente_id ?? 'Sem responsável'
    const key = v.atendente_id ?? 'sem_id'
    if (!mapaAtendente[key]) {
      const metaItem = metas.find(m => m.atendente_id === v.atendente_id)
      mapaAtendente[key] = { id: key, nome, total: 0, qtd: 0, ticket_medio: 0, meta: metaItem?.valor_meta ?? null, pct_meta: null }
    }
    mapaAtendente[key].total += v.total ?? 0
    mapaAtendente[key].qtd += 1
  }

  const ranking: EntradaRanking[] = Object.values(mapaAtendente)
    .map(r => ({
      ...r,
      ticket_medio: r.qtd > 0 ? r.total / r.qtd : 0,
      pct_meta: r.meta && r.meta > 0 ? Math.min((r.total / r.meta) * 100, 100) : null,
    }))
    .sort((a, b) => b.total - a.total)

  const totalGeral = ranking.reduce((a, r) => a + r.total, 0)
  const medalhas = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-surface border border-white/5 rounded-xl p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-sm font-semibold text-fg">🏆 Ranking de Vendas</h2>
          <p className="text-xs text-fg-tertiary mt-0.5">Desempenho por responsável</p>
        </div>

        {/* Seletor de período */}
        <div className="flex items-center gap-1 bg-page border border-border-subtle rounded-lg p-1">
          {PERIODOS.map(p => (
            <button key={p.id} onClick={() => setPeriodo(p.id as any)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                periodo === p.id ? 'bg-surface-hover text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
              }`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {ranking.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-fg-disabled">Nenhuma venda registrada neste período</p>
          <p className="text-xs text-zinc-700 mt-1">Registre vendas atribuídas a um responsável para ver o ranking</p>
        </div>
      ) : (
        <>
          {/* Top 3 em destaque */}
          {ranking.length >= 1 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              {ranking.slice(0, 3).map((r, i) => (
                <div key={r.id}
                  className={`rounded-xl p-4 border relative overflow-hidden ${
                    i === 0
                      ? 'bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20'
                      : i === 1
                      ? 'bg-gradient-to-br from-zinc-400/10 to-transparent border-zinc-600/30'
                      : 'bg-gradient-to-br from-amber-700/10 to-transparent border-amber-700/20'
                  }`}>
                  <p className="text-2xl mb-2">{medalhas[i]}</p>
                  <p className="text-sm font-semibold text-fg truncate">{r.nome}</p>
                  <p className={`text-xl font-bold mt-1 ${i === 0 ? 'text-amber-400' : 'text-fg'}`}>
                    {formatCurrency(r.total)}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-fg-tertiary">{r.qtd} venda{r.qtd !== 1 ? 's' : ''}</span>
                    <span className="text-xs text-fg-tertiary">TM: {formatCurrency(r.ticket_medio)}</span>
                  </div>

                  {/* Barra de meta */}
                  {r.pct_meta !== null && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-fg-tertiary">Meta</span>
                        <span className={r.pct_meta >= 100 ? 'text-emerald-400' : 'text-fg-secondary'}>{r.pct_meta.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${r.pct_meta >= 100 ? 'bg-emerald-500' : r.pct_meta >= 70 ? 'bg-amber-500' : 'bg-zinc-500'}`}
                          style={{ width: `${r.pct_meta}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Tabela completa */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="text-left py-2 px-3 text-[10px] font-medium text-fg-tertiary uppercase tracking-wider">#</th>
                <th className="text-left py-2 px-3 text-[10px] font-medium text-fg-tertiary uppercase tracking-wider">Atendente</th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-fg-tertiary uppercase tracking-wider">Vendas</th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-fg-tertiary uppercase tracking-wider">Total</th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-fg-tertiary uppercase tracking-wider hidden md:table-cell">Ticket Médio</th>
                <th className="text-right py-2 px-3 text-[10px] font-medium text-fg-tertiary uppercase tracking-wider hidden md:table-cell">% do total</th>
                {metas.length > 0 && (
                  <th className="text-right py-2 px-3 text-[10px] font-medium text-fg-tertiary uppercase tracking-wider">Meta</th>
                )}
              </tr>
            </thead>
            <tbody>
              {ranking.map((r, i) => {
                const pctTotal = totalGeral > 0 ? (r.total / totalGeral) * 100 : 0
                return (
                  <tr key={r.id} className="border-b border-border-subtle/40 hover:bg-white/2 transition-colors">
                    <td className="py-3 px-3 text-fg-tertiary text-sm">{medalhas[i] ?? i + 1}</td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-fg-secondary">
                          {r.nome.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium text-fg">{r.nome}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right text-sm text-fg-secondary">{r.qtd}</td>
                    <td className="py-3 px-3 text-right text-sm font-semibold text-fg">{formatCurrency(r.total)}</td>
                    <td className="py-3 px-3 text-right text-sm text-fg-secondary hidden md:table-cell">{formatCurrency(r.ticket_medio)}</td>
                    <td className="py-3 px-3 text-right hidden md:table-cell">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500/70 rounded-full" style={{ width: `${pctTotal}%` }} />
                        </div>
                        <span className="text-xs text-fg-tertiary min-w-[30px]">{pctTotal.toFixed(0)}%</span>
                      </div>
                    </td>
                    {metas.length > 0 && (
                      <td className="py-3 px-3 text-right">
                        {r.pct_meta !== null ? (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                            r.pct_meta >= 100 ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' :
                            r.pct_meta >= 70 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' :
                            'text-fg-tertiary bg-muted border-border-subtle'
                          }`}>
                            {r.pct_meta.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-700">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}
