'use client'

import { useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { formatCurrency, formatRelative } from '@/lib/utils'

export function TabEquityCurve({ operacoes }: { operacoes: any[] }) {
  const chartData = useMemo(() => {
    // Pegar apenas operações encerradas e ordenar cronologicamente correta (mais antiga primeiro)
    const ops = [...operacoes]
      .filter(o => o.resultado !== 'aberta' && o.lucro_prejuizo !== null)
      .sort((a, b) => new Date(a.data_saida || a.data_entrada).getTime() - new Date(b.data_saida || b.data_entrada).getTime())

    let saldoAcumulado = 0
    let maxDrawdownAbs = 0
    let pico = 0

    const data = ops.map((op, index) => {
      saldoAcumulado += (op.lucro_prejuizo || 0)
      if (saldoAcumulado > pico) pico = saldoAcumulado
      const drawdown = pico - saldoAcumulado
      if (drawdown > maxDrawdownAbs) maxDrawdownAbs = drawdown

      return {
        name: `Op ${index + 1}`,
        date: formatRelative(op.data_saida || op.data_entrada),
        ativo: op.ativo,
        pnl: op.lucro_prejuizo || 0,
        equity: saldoAcumulado,
        drawdown: -drawdown
      }
    })

    return { data, maxDrawdownAbs }
  }, [operacoes])

  if (chartData.data.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
        Registre operações finalizadas (com gain ou loss) para visualizar a curva de capital.
      </div>
    )
  }

  const balancoFinal = chartData.data[chartData.data.length - 1].equity

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Resultado Líquido</p>
          <p className={`text-2xl font-bold ${balancoFinal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(balancoFinal)}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Max Drawdown (Rebaixamento)</p>
          <p className="text-2xl font-bold text-red-500">
            {formatCurrency(-chartData.maxDrawdownAbs)}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Total de Trades</p>
          <p className="text-2xl font-bold text-zinc-100">
            {chartData.data.length}
          </p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Recovery Factor</p>
          <p className="text-2xl font-bold text-blue-400">
             {chartData.maxDrawdownAbs > 0 ? (balancoFinal > 0 ? (balancoFinal / chartData.maxDrawdownAbs).toFixed(2) : '0.00') : '∞'}
          </p>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 md:p-6 h-[400px]">
        <h3 className="text-sm font-bold text-zinc-200 mb-6">Evolução do Capital (Equity Curve)</h3>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData.data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
            <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickMargin={10} />
            <YAxis stroke="#52525b" fontSize={11} tickFormatter={(val) => `R$ ${val}`} />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', fontSize: '12px' }}
              itemStyle={{ color: '#a1a1aa' }}
              labelStyle={{ color: '#fff', fontWeight: 'bold', marginBottom: '4px' }}
              formatter={(value: number, name: string) => [formatCurrency(value), name === 'equity' ? 'Saldo' : 'Drawdown']}
              labelFormatter={(_, payload) => {
                if(payload && payload.length > 0) return `${payload[0].payload.name} (${payload[0].payload.ativo})`
                return ''
              }}
            />
            <ReferenceLine y={0} stroke="#52525b" strokeDasharray="3 3" />
            <Line type="monotone" dataKey="equity" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="drawdown" stroke="#ef4444" strokeWidth={2} dot={false} strokeOpacity={0.5} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
