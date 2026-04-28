'use client'

import { useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

const MESES_LABEL = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function anoMesStr(offset = 0): string {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return d.toISOString().substring(0, 7)
}

function labelMes(ym: string) {
  const [y, m] = ym.split('-')
  return `${MESES_LABEL[parseInt(m) - 1]}/${y}`
}

interface Lancamento {
  data: string          // YYYY-MM-DD  (PF usa 'data', PJ usa 'data_competencia')
  valor: number
  tipo?: string         // 'receita' | 'despesa' (PJ)
  _tipo?: 'receita' | 'gasto'  // PF interno
}

interface Props {
  /** Array de lançamentos normalizados */
  lancamentos: Lancamento[]
  /** Campo que contém a data no objeto */
  campoData?: 'data' | 'data_competencia'
  /** Campo que indica o tipo do lançamento */
  campoTipo?: 'tipo' | '_tipo'
  /** Valor que identifica uma despesa/gasto */
  valorDespesa?: string
  /** Valor que identifica uma receita */
  valorReceita?: string
  /** Título do painel */
  titulo?: string
}

interface MesMetric {
  ym: string
  label: string
  receitas: number
  despesas: number
  saldo: number
}

export function PainelComparativoMes({
  lancamentos,
  campoData = 'data',
  campoTipo = '_tipo',
  valorDespesa = 'gasto',
  valorReceita = 'receita',
  titulo = 'Comparativo Mensal',
}: Props) {
  // Gera os últimos 12 meses disponíveis
  const mesesDisponiveis = useMemo(() => {
    const set = new Set<string>()
    lancamentos.forEach(l => {
      const d: string = (l as any)[campoData] ?? ''
      if (d.length >= 7) set.add(d.substring(0, 7))
    })
    // Garante os últimos 3 mesmo sem dados
    for (let i = 0; i < 6; i++) set.add(anoMesStr(-i))
    return [...set].sort().reverse().slice(0, 12)
  }, [lancamentos, campoData])

  const [selecionados, setSelecionados] = useState<string[]>([
    mesesDisponiveis[0] ?? anoMesStr(0),
    mesesDisponiveis[1] ?? anoMesStr(-1),
  ])

  const toggleMes = (ym: string) => {
    setSelecionados(prev => {
      if (prev.includes(ym)) {
        if (prev.length <= 1) return prev // mínimo 1
        return prev.filter(m => m !== ym)
      }
      if (prev.length >= 3) return [prev[1], prev[2], ym] // máximo 3
      return [...prev, ym].sort().reverse()
    })
  }

  const metricas: MesMetric[] = useMemo(() => {
    return selecionados.map(ym => {
      const do_mes = lancamentos.filter(l => {
        const d: string = (l as any)[campoData] ?? ''
        return d.startsWith(ym)
      })
      const receitas = do_mes.filter(l => (l as any)[campoTipo] === valorReceita).reduce((a, l) => a + l.valor, 0)
      const despesas = do_mes.filter(l => (l as any)[campoTipo] === valorDespesa).reduce((a, l) => a + l.valor, 0)
      return { ym, label: labelMes(ym), receitas, despesas, saldo: receitas - despesas }
    }).sort((a, b) => a.ym.localeCompare(b.ym))
  }, [selecionados, lancamentos, campoData, campoTipo, valorReceita, valorDespesa])

  const maxVal = Math.max(...metricas.flatMap(m => [m.receitas, m.despesas]), 1)

  // Variações em relação ao mês mais antigo selecionado
  const base = metricas[0]
  const atual = metricas[metricas.length - 1]
  const varReceita = base?.receitas > 0 ? ((atual?.receitas - base?.receitas) / base?.receitas) * 100 : null
  const varDespesa = base?.despesas > 0 ? ((atual?.despesas - base?.despesas) / base?.despesas) * 100 : null

  const COR_MES = ['#7c5cfc', '#10b981', '#f59e0b']

  return (
    <div className="bg-surface border border-white/5 rounded-2xl p-5 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs font-bold text-fg uppercase tracking-wider">📅 {titulo}</p>
        <p className="text-[10px] text-fg-tertiary">Selecione até 3 meses para comparar</p>
      </div>

      {/* Seletor de meses — chips */}
      <div className="flex flex-wrap gap-1.5">
        {mesesDisponiveis.map((ym, i) => {
          const sel = selecionados.includes(ym)
          const idx = selecionados.indexOf(ym)
          const cor = sel ? COR_MES[idx] : undefined
          return (
            <button
              key={ym}
              onClick={() => toggleMes(ym)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all',
                sel
                  ? 'text-white border-transparent'
                  : 'text-fg-tertiary border-border-subtle hover:text-fg hover:border-border',
              )}
              style={sel ? { background: cor + '33', borderColor: cor + '66', color: cor } : {}}
            >
              {labelMes(ym)}
            </button>
          )
        })}
      </div>

      {/* Gráfico de barras comparativo */}
      <div className="flex items-end gap-4 h-32 border-b border-white/8 pb-2">
        {metricas.map((m, i) => {
          const cor = COR_MES[i]
          const hR = maxVal > 0 ? (m.receitas / maxVal) * 100 : 0
          const hD = maxVal > 0 ? (m.despesas / maxVal) * 100 : 0
          return (
            <div key={m.ym} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div className="w-full flex items-end justify-center gap-1 h-24">
                <div className="flex flex-col items-center gap-0.5 flex-1">
                  <span className="text-[8px] font-bold" style={{ color: cor }}>R</span>
                  <div
                    className="w-full rounded-t transition-all"
                    title={`Receitas: ${fmt(m.receitas)}`}
                    style={{ height: `${hR}%`, minHeight: m.receitas > 0 ? '4px' : '0', background: cor + '99' }}
                  />
                </div>
                <div className="flex flex-col items-center gap-0.5 flex-1">
                  <span className="text-[8px] font-bold text-red-400">D</span>
                  <div
                    className="w-full rounded-t transition-all"
                    title={`Despesas: ${fmt(m.despesas)}`}
                    style={{ height: `${hD}%`, minHeight: m.despesas > 0 ? '4px' : '0', background: '#ef444488' }}
                  />
                </div>
              </div>
              <span className="text-[10px] font-semibold" style={{ color: cor }}>{m.label}</span>
            </div>
          )
        })}
      </div>

      {/* Tabela de métricas */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left text-fg-tertiary py-1 font-medium">Métrica</th>
              {metricas.map((m, i) => (
                <th key={m.ym} className="text-right py-1 font-semibold" style={{ color: COR_MES[i] }}>
                  {m.label}
                </th>
              ))}
              {metricas.length >= 2 && (
                <th className="text-right py-1 text-fg-tertiary font-medium">Δ %</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {[
              { label: 'Receitas', key: 'receitas' as const, cor: 'text-emerald-400', var: varReceita, positivo: true },
              { label: 'Despesas', key: 'despesas' as const, cor: 'text-red-400', var: varDespesa, positivo: false },
              { label: 'Saldo',    key: 'saldo'    as const, cor: 'text-amber-400', var: null, positivo: true },
            ].map(row => (
              <tr key={row.key}>
                <td className="py-2 text-fg-tertiary">{row.label}</td>
                {metricas.map((m, i) => (
                  <td key={m.ym} className={cn('py-2 text-right font-semibold tabular-nums', row.cor)}>
                    {fmt(m[row.key])}
                  </td>
                ))}
                {metricas.length >= 2 && (
                  <td className="py-2 text-right">
                    {row.var != null ? (
                      <span className={cn(
                        'px-1.5 py-0.5 rounded text-[10px] font-bold',
                        (row.positivo ? row.var >= 0 : row.var <= 0)
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-red-500/15 text-red-400'
                      )}>
                        {row.var >= 0 ? '+' : ''}{row.var.toFixed(1)}%
                      </span>
                    ) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Insight automático */}
      {metricas.length >= 2 && (
        <div className="bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-[11px] text-fg-secondary leading-relaxed">
          {(() => {
            const msgs: string[] = []
            if (varDespesa != null && varDespesa > 15)
              msgs.push(`⚠️ Despesas aumentaram ${varDespesa.toFixed(1)}% em relação a ${base.label}.`)
            else if (varDespesa != null && varDespesa < -10)
              msgs.push(`✅ Despesas reduziram ${Math.abs(varDespesa).toFixed(1)}% em relação a ${base.label}.`)
            if (varReceita != null && varReceita > 10)
              msgs.push(`📈 Receitas cresceram ${varReceita.toFixed(1)}% em relação a ${base.label}.`)
            else if (varReceita != null && varReceita < -10)
              msgs.push(`📉 Receitas caíram ${Math.abs(varReceita).toFixed(1)}% em relação a ${base.label}.`)
            if (atual.saldo < 0)
              msgs.push(`🚨 Saldo negativo em ${atual.label}: ${fmt(atual.saldo)}.`)
            return msgs.length > 0
              ? msgs.join(' ')
              : `✨ Comparação entre ${metricas.map(m => m.label).join(' vs ')} — nenhum alerta crítico.`
          })()}
        </div>
      )}
    </div>
  )
}
