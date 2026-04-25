'use client'

import type { GastoPessoal, ReceitaPessoal, OrcamentoPessoal } from '../types'
import { CATEGORIAS_GASTO, formatCurrency } from '../types'

type Props = {
  gastos: GastoPessoal[]
  receitas: ReceitaPessoal[]
  orcamentos: OrcamentoPessoal[]
  onNovoGasto: () => void
  onNovaReceita: () => void
}

export function TabResumo({ gastos, receitas, orcamentos, onNovoGasto, onNovaReceita }: Props) {
  const mesAtual = new Date().toISOString().slice(0, 7)

  const gastosMes = gastos.filter(g => g.data.startsWith(mesAtual))
  const receitasMes = receitas.filter(r => r.data.startsWith(mesAtual))

  const totalGastos = gastosMes.reduce((a, g) => a + g.valor, 0)
  const totalReceitas = receitasMes.reduce((a, r) => a + r.valor, 0)
  const saldo = totalReceitas - totalGastos

  // Gastos por categoria
  const gastosPorCategoria = Object.entries(CATEGORIAS_GASTO).map(([cat, info]) => {
    const total = gastosMes.filter(g => g.categoria === cat).reduce((a, g) => a + g.valor, 0)
    const orcamento = orcamentos.find(o => o.categoria === cat && o.mes_referencia === mesAtual)
    const pct = orcamento ? Math.min((total / orcamento.valor_limite) * 100, 100) : 0
    return { cat, info, total, orcamento, pct }
  }).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  // Top 5 maiores gastos
  const top5 = [...gastosMes].sort((a, b) => b.valor - a.valor).slice(0, 5)

  // Recomendações automáticas
  const recomendacoes: { icon: string; texto: string; tipo: 'alerta' | 'dica' | 'ok' }[] = []

  if (saldo < 0) {
    recomendacoes.push({ icon: '🔴', texto: `Você está no vermelho em ${formatCurrency(Math.abs(saldo))} este mês.`, tipo: 'alerta' })
  } else if (saldo < totalReceitas * 0.1) {
    recomendacoes.push({ icon: '🟡', texto: 'Você está guardando menos de 10% da sua renda. Considere reduzir gastos variáveis.', tipo: 'alerta' })
  }

  if (gastosPorCategoria[0] && gastosPorCategoria[0].total > totalReceitas * 0.3) {
    recomendacoes.push({
      icon: '⚠️',
      texto: `${gastosPorCategoria[0].info.label} representa mais de 30% da sua renda este mês.`,
      tipo: 'alerta'
    })
  }

  if (saldo > totalReceitas * 0.2) {
    recomendacoes.push({ icon: '✅', texto: 'Ótimo! Você está guardando mais de 20% da renda este mês.', tipo: 'ok' })
  }

  if (recomendacoes.length === 0) {
    recomendacoes.push({ icon: '💡', texto: 'Adicione mais lançamentos para ver recomendações personalizadas.', tipo: 'dica' })
  }

  return (
    <div className="space-y-6">
      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Receitas do mês',  value: formatCurrency(totalReceitas), color: 'text-emerald-400', grad: 'rgba(16,185,129,0.12)' },
          { label: 'Gastos do mês',    value: formatCurrency(totalGastos),   color: 'text-red-400',     grad: 'rgba(239,68,68,0.1)' },
          { label: 'Saldo disponível', value: formatCurrency(saldo),         color: saldo >= 0 ? 'text-amber-400' : 'text-red-400', grad: 'rgba(245,158,11,0.1)' },
          { label: 'Taxa poupança',    value: totalReceitas > 0 ? `${Math.round((saldo / totalReceitas) * 100)}%` : '—', color: saldo >= 0 ? 'text-purple-400' : 'text-red-400', grad: 'rgba(139,92,246,0.1)' },
        ].map(k => (
          <div key={k.label} className="bg-surface border border-white/5 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 80% 20%,${k.grad},transparent 70%)` }} />
            <p className="text-[10px] font-medium text-fg-secondary tracking-[0.06em] uppercase mb-2">{k.label}</p>
            <p className={`text-[20px] font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Gastos por categoria */}
        <div className="bg-page border border-border-subtle rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-fg-secondary">Gastos por Categoria</h3>
            <button onClick={onNovoGasto} className="btn-ghost text-xs">+ Gasto</button>
          </div>
          {gastosPorCategoria.length === 0 ? (
            <p className="text-xs text-fg-disabled text-center py-8">Nenhum gasto registrado este mês.</p>
          ) : (
            <div className="space-y-3">
              {gastosPorCategoria.map(({ cat, info, total, orcamento, pct }) => (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-fg-secondary flex items-center gap-1.5">
                      <span>{info.icon}</span> {info.label}
                    </span>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-fg">{formatCurrency(total)}</span>
                      {orcamento && (
                        <span className="text-xs text-fg-disabled ml-1">/ {formatCurrency(orcamento.valor_limite)}</span>
                      )}
                    </div>
                  </div>
                  {orcamento && (
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${pct}%`, backgroundColor: pct < 70 ? info.color : undefined }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Layout direito: Top 5 + Recomendações */}
        <div className="space-y-4">
          {/* Top 5 maiores gastos */}
          <div className="bg-page border border-border-subtle rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-fg-secondary mb-3">🔝 Maiores Gastos do Mês</h3>
            {top5.length === 0 ? (
              <p className="text-xs text-fg-disabled text-center py-4">Sem dados.</p>
            ) : (
              <div className="space-y-2">
                {top5.map((g, i) => (
                  <div key={g.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-fg-disabled w-4">#{i + 1}</span>
                      <span className="text-sm text-fg-secondary">{g.descricao}</span>
                    </div>
                    <span className="text-sm font-semibold text-red-400">{formatCurrency(g.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recomendações */}
          <div className="bg-page border border-border-subtle rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-fg-secondary mb-3">🧠 Recomendações</h3>
            <div className="space-y-2">
              {recomendacoes.map((r, i) => (
                <div key={i} className={`text-xs px-3 py-2.5 rounded-lg border ${
                  r.tipo === 'alerta' ? 'bg-amber-500/5 border-amber-500/20 text-amber-300'
                  : r.tipo === 'ok' ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                  : 'bg-muted/50 border-border-subtle/50 text-fg-secondary'
                }`}>
                  {r.icon} {r.texto}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
