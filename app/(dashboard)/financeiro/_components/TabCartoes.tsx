'use client'

import { useState } from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { EmptyState } from '@/components/shared/ui'

// Cores para os gráficos baseados em categorias (UI premium)
const COLORS = ['#10b981', '#3b82f6', '#f5a623', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#facc15']

export function TabCartoes({
  contas,
  lancamentos,
  categorias,
  onNovoGasto
}: {
  contas: any[]
  lancamentos: any[]
  categorias: any[]
  onNovoGasto: () => void
}) {
  // 1. Filtrar contas que são "Cartão de Crédito"
  const cartoes = contas.filter(c => c.tipo === 'cartao_credito')
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>(cartoes[0]?.id || 'todos')

  if (cartoes.length === 0) {
    return (
      <div className="bg-surface border border-white/5 rounded-xl p-8 text-center mt-6">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">💳</span>
        </div>
        <h3 className="text-lg font-bold text-fg mb-2">Sem Cartões de Crédito</h3>
        <p className="text-sm text-fg-tertiary mb-6 max-w-md mx-auto">
          Você não possui contas configuradas como Cartão de Crédito. Para utilizar este painel de gestão de faturas, crie uma "Nova Conta" definindo o tipo como "Cartão de Crédito".
        </p>
        <button onClick={onNovoGasto} className="btn-primary">Criar Cadastro de Conta</button>
      </div>
    )
  }

  // 2. Extrair os gastos no cartão (despesas que estão vinculadas aos cartões de crédito)
  const gastosTudo = lancamentos.filter(l => 
    l.tipo === 'despesa' && 
    cartoes.some(c => c.id === l.conta_id) &&
    (cartaoSelecionado === 'todos' || l.conta_id === cartaoSelecionado)
  )

  // 3. Montar dados agregados por CATEGORIA (para o gráfico Pie)
  const gastosCategoriaTracker: Record<string, number> = {}
  gastosTudo.forEach(g => {
    const nomeCat = g.categoria_id 
      ? categorias.find(c => c.id === g.categoria_id)?.nome || 'Outros'
      : 'Sem Categoria'
    gastosCategoriaTracker[nomeCat] = (gastosCategoriaTracker[nomeCat] || 0) + g.valor
  })

  const dataCategorias = Object.entries(gastosCategoriaTracker)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const totalGasto = dataCategorias.reduce((a, c) => a + c.value, 0)

  // 4. Montar dados para gastos por FUNCIONÁRIO/PESSOA vs EMPRESA se o cliente mistura tudo
  // Por default, a divisão PF x PJ será baseada pela classificação da Conta "cartao_credito"
  const gastosPorConta = cartoes.map(c => {
    const total = lancamentos
      .filter(l => l.conta_id === c.id && l.tipo === 'despesa')
      .reduce((a, l) => a + l.valor, 0)
    return { name: c.nome, total, cat: c.categoria }
  })

  // Bandeiras inline (sem importar de fora)
  const BAND_CORES: Record<string, string> = {
    visa: '#1a1f71', mastercard: '#eb001b', elo: '#c8a800',
    amex: '#2e77bc', hipercard: '#e22c1b', outras: '#6b7280',
  }
  const BAND_EMOJI: Record<string, string> = {
    visa: '💳', mastercard: '🔴', elo: '🟡', amex: '💎', hipercard: '🔶', outras: '💳',
  }

  return (
    <div className="space-y-6 mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-fg">Gestão de Cartões de Crédito</h2>
          <p className="text-xs text-fg-tertiary">Controle faturas, veja onde gastou mais e centralize os gastos PF e PJ.</p>
        </div>
        <button onClick={onNovoGasto} className="btn-primary whitespace-nowrap">
          + Lançar no Cartão
        </button>
      </div>

      {/* Seletor visual de cartões */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <button
          onClick={() => setCartaoSelecionado('todos')}
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
            cartaoSelecionado === 'todos'
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'border-border-subtle text-fg-tertiary hover:border-border hover:text-fg'
          )}
        >
          🗂️ Todos ({cartoes.length})
        </button>
        {cartoes.map(c => {
          const band = c.bandeira || 'outras'
          const cor = BAND_CORES[band] ?? '#6b7280'
          const emoji = BAND_EMOJI[band] ?? '💳'
          return (
            <button
              key={c.id}
              onClick={() => setCartaoSelecionado(c.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
                cartaoSelecionado === c.id
                  ? 'border-white/20 text-white shadow-lg'
                  : 'border-border-subtle text-fg-tertiary hover:border-border hover:text-fg'
              )}
              style={cartaoSelecionado === c.id ? { background: cor + '33', borderColor: cor + '66' } : {}}
            >
              <span>{emoji}</span>
              <span>{c.nome_cartao || c.nome}</span>
              {c.limite && (
                <span className="text-[10px] opacity-60">· Lim. {formatCurrency(c.limite)}</span>
              )}
              {(c.dia_fechamento || c.dia_vencimento) && (
                <span className="text-[10px] opacity-60">
                  · Fech. {c.dia_fechamento} / Venc. {c.dia_vencimento}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Gasto / Fatura Resumo */}
        <div className="bg-surface border border-white/5 rounded-xl p-5 md:col-span-1 shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[220px]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none"></div>
          <p className="text-xs text-fg-secondary font-medium tracking-wider uppercase mb-2 relative z-10">Total na Fatura Atual</p>
          <p className="text-4xl font-['Syne'] font-bold text-fg mb-1 relative z-10">
            {formatCurrency(totalGasto)}
          </p>
          <p className="text-[11px] text-fg-tertiary mt-2 relative z-10">
            Com base em <strong className="text-fg-secondary">{gastosTudo.length} transações</strong> não validadas identificadas como compras no crédito.
          </p>
        </div>

        {/* Gráfico Onde Gastou Mais (Categorias) */}
        <div className="bg-surface border border-white/5 rounded-xl p-5 md:col-span-2">
          <h3 className="text-sm font-semibold text-fg mb-4">Onde o dinheiro foi gasto?</h3>
          {dataCategorias.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center">
              <EmptyState message="Sem dados de compras neste cartão" />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="h-[180px] w-[180px]">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={dataCategorias}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                       stroke="none"
                     >
                       {dataCategorias.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <Tooltip 
                       formatter={(value: number) => formatCurrency(value)}
                       contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }} 
                     />
                   </PieChart>
                 </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3 w-full">
                {dataCategorias.slice(0, 5).map((d, i) => (
                  <div key={d.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-fg-secondary flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                        {d.name}
                      </span>
                      <span className="font-semibold text-fg">{formatCurrency(d.value)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${(d.value / totalGasto) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Histórico Recente do Cartão */}
      <div className="bg-surface border border-white/5 rounded-xl p-5">
        <h3 className="section-title">Últimas Transações no Cartão</h3>
        {gastosTudo.length === 0 ? (
          <EmptyState message="Nenhuma transação com cartão cadastrada" />
        ) : (
          <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {gastosTudo.slice(0, 20).map(l => (
              <div key={l.id} className="flex justify-between items-center p-3 rounded-lg border border-white/5 bg-black/20 hover:bg-white/5 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs">
                    💳
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg">{l.descricao}</p>
                    <p className="text-xs text-fg-tertiary">
                      Venc: {l.data_competencia} • {categorias.find(c => c.id === l.categoria_id)?.nome || 'Outros'}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-red-400">
                  - {formatCurrency(l.valor)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
