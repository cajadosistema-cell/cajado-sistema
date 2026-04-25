'use client'

import { useState, useCallback } from 'react'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { formatCurrency } from '@/lib/utils'
import Link from 'next/link'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend,
} from 'recharts'

// ── Types ────────────────────────────────────────────────────
type Gasto    = { id: string; descricao: string; valor: number; categoria: string; data: string; forma_pagamento?: string }
type Receita  = { id: string; descricao: string; valor: number; categoria: string; data: string }
type Evento   = { id: string; titulo: string; tipo: string; data_inicio: string; status: string }
type Ativo    = { id: string; valor_investido: number; valor_atual: number | null; nome?: string; tipo?: string }
type Imovel   = { id: string; valor_investido_total: number; valor_mercado_atual: number | null; titulo?: string }

const CAT_CORES: Record<string, string> = {
  alimentacao: '#f97316', transporte: '#3b82f6', saude: '#10b981',
  lazer: '#8b5cf6', educacao: '#06b6d4', moradia: '#f59e0b',
  vestuario: '#ec4899', tecnologia: '#6366f1', investimento: '#22c55e',
  outros: '#71717a', pro_labore: '#a3e635', freelance: '#fb923c',
  investimentos: '#38bdf8', aluguel: '#c084fc', vendas: '#4ade80',
}

const CAT_LABEL: Record<string, string> = {
  alimentacao: '🍽️ Alimentação', transporte: '🚗 Transporte', saude: '💊 Saúde',
  lazer: '🎮 Lazer', educacao: '📚 Educação', moradia: '🏠 Moradia',
  vestuario: '👕 Vestuário', tecnologia: '💻 Tecnologia', investimento: '📈 Investimento',
  outros: '📦 Outros', pro_labore: '💼 Pró-labore', freelance: '🎨 Freelance',
  investimentos: '📊 Investimentos', aluguel: '🏢 Aluguel', vendas: '💰 Vendas',
}

// ── DrillDown Modal ───────────────────────────────────────────
function DrillModal({ title, items, onClose }: {
  title: string
  items: { descricao: string; valor: number; data: string; extra?: string }[]
  onClose: () => void
}) {
  const total = items.reduce((a, i) => a + i.valor, 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-[#0d1522] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div>
            <h3 className="font-bold text-fg text-sm">{title}</h3>
            <p className="text-xs text-fg-tertiary mt-0.5">{items.length} lançamentos · Total: <span className="text-amber-400 font-semibold">{formatCurrency(total)}</span></p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-fg">✕</button>
        </div>
        <div className="overflow-y-auto max-h-[60vh] divide-y divide-white/5">
          {items.length === 0 ? (
            <p className="text-center text-fg-tertiary text-sm py-10">Nenhum lançamento</p>
          ) : items.map((item, i) => (
            <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors">
              <div className="min-w-0">
                <p className="text-sm text-fg truncate">{item.descricao}</p>
                <p className="text-xs text-fg-tertiary">{new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR')} {item.extra ? `· ${item.extra}` : ''}</p>
              </div>
              <p className="text-sm font-semibold text-red-400 shrink-0 ml-3">{formatCurrency(item.valor)}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 bg-muted/30 border-t border-white/5 flex justify-between text-xs text-fg-tertiary">
          <span>Média por lançamento</span>
          <span className="font-semibold text-fg">{items.length > 0 ? formatCurrency(total / items.length) : '—'}</span>
        </div>
      </div>
    </div>
  )
}

// ── Donut clicável ────────────────────────────────────────────
function DonutChart({ data, title, onSliceClick }: {
  data: { name: string; value: number; cat: string }[]
  title: string
  onSliceClick: (cat: string) => void
}) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  return (
    <div className="bg-[#0d1522] border border-white/8 rounded-2xl p-4 hover:border-amber-500/30 transition-colors">
      <p className="text-xs text-fg-tertiary uppercase tracking-wider mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"cy="50%"
            innerRadius={52} outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            onClick={(d, idx) => onSliceClick(data[idx]?.cat ?? '')}
            style={{ cursor: 'pointer' }}
            onMouseEnter={(_, idx) => setActiveIdx(idx)}
            onMouseLeave={() => setActiveIdx(null)}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={CAT_CORES[entry.cat] ?? '#71717a'}
                opacity={activeIdx === null || activeIdx === i ? 1 : 0.5}
                stroke={activeIdx === i ? '#fff' : 'transparent'}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ background: '#0d1522', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
            formatter={(v: number) => formatCurrency(v)}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-2 space-y-1.5">
        {data.slice(0, 5).map((d, i) => (
          <button
            key={i}
            onClick={() => onSliceClick(d.cat)}
            className="w-full flex items-center gap-2 text-xs hover:bg-white/5 rounded-lg px-1.5 py-1 transition-colors group"
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CAT_CORES[d.cat] ?? '#71717a' }} />
            <span className="flex-1 text-left text-fg-secondary truncate group-hover:text-fg">{CAT_LABEL[d.cat] ?? d.name}</span>
            <span className="text-fg-tertiary font-medium">{formatCurrency(d.value)}</span>
          </button>
        ))}
        {data.length > 5 && <p className="text-[10px] text-fg-disabled text-center">+ {data.length - 5} categorias</p>}
      </div>
      <p className="text-[10px] text-fg-disabled text-center mt-2">👆 Clique em uma fatia para ver detalhes</p>
    </div>
  )
}

// ── Bar chart clicável por mês ────────────────────────────────
function MonthlyBarChart({ gastos, receitas }: { gastos: Gasto[]; receitas: Receita[] }) {
  const [drill, setDrill] = useState<{ title: string; items: any[] } | null>(null)

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
    return d.toISOString().slice(0, 7)
  })

  const data = months.map(m => {
    const label = new Date(m + '-01').toLocaleDateString('pt-BR', { month: 'short' })
    return {
      mes: label, ym: m,
      Receitas: receitas.filter(r => r.data.startsWith(m)).reduce((a, r) => a + r.valor, 0),
      Despesas: gastos.filter(g => g.data.startsWith(m)).reduce((a, g) => a + g.valor, 0),
    }
  })

  const handleBarClick = (barData: any, tipo: 'Receitas' | 'Despesas') => {
    if (!barData?.ym) return
    if (tipo === 'Despesas') {
      const items = gastos.filter(g => g.data.startsWith(barData.ym)).map(g => ({ descricao: g.descricao, valor: g.valor, data: g.data, extra: g.forma_pagamento }))
      setDrill({ title: `Despesas — ${barData.mes}`, items })
    } else {
      const items = receitas.filter(r => r.data.startsWith(barData.ym)).map(r => ({ descricao: r.descricao, valor: r.valor, data: r.data }))
      setDrill({ title: `Receitas — ${barData.mes}`, items })
    }
  }

  return (
    <>
      <div className="bg-[#0d1522] border border-white/8 rounded-2xl p-4 hover:border-amber-500/30 transition-colors">
        <p className="text-xs text-fg-tertiary uppercase tracking-wider mb-4">Fluxo dos Últimos 6 Meses</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="mes" tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} axisLine={false} tickLine={false} width={55} tickFormatter={v => `R$${(v/1000).toFixed(0)}k`} />
            <Tooltip
              contentStyle={{ background: '#0d1522', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 11 }}
              formatter={(v: number) => formatCurrency(v)}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            />
            <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
            <Bar dataKey="Receitas" fill="#22c55e" radius={[4, 4, 0, 0]} cursor="pointer" onClick={d => handleBarClick(d, 'Receitas')} />
            <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} cursor="pointer" onClick={d => handleBarClick(d, 'Despesas')} />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-fg-disabled text-center mt-1">👆 Clique em uma barra para ver os lançamentos do mês</p>
      </div>
      {drill && <DrillModal title={drill.title} items={drill.items} onClose={() => setDrill(null)} />}
    </>
  )
}

// ── Sparkline ─────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 80}`).join(' ')
  return (
    <svg viewBox="0 0 100 100" className="w-16 h-8" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── KPI Card ──────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, spark, href }: {
  label: string; value: string; sub?: string; color?: string; spark?: number[]; href?: string
}) {
  const inner = (
    <div className="bg-[#0d1522] border border-white/8 rounded-2xl p-4 hover:border-amber-500/30 transition-all hover:-translate-y-0.5 group">
      <p className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight ${color ?? 'text-fg'} group-hover:text-amber-400 transition-colors`}>{value}</p>
      <div className="flex items-end justify-between mt-1">
        {sub && <p className="text-[11px] text-fg-disabled">{sub}</p>}
        {spark && <Sparkline data={spark} color={color === 'text-emerald-400' ? '#22c55e' : color === 'text-red-400' ? '#ef4444' : '#f59e0b'} />}
      </div>
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

// ── Main Dashboard ────────────────────────────────────────────
export default function DashboardPessoalClient() {
  const { data: gastos }   = useSupabaseQuery<Gasto>('gastos_pessoais',   { orderBy: { column: 'data', ascending: false } })
  const { data: receitas } = useSupabaseQuery<Receita>('receitas_pessoais', { orderBy: { column: 'data', ascending: false } })
  const { data: eventos }  = useSupabaseQuery<Evento>('agenda_eventos',   { orderBy: { column: 'data_inicio', ascending: true } })
  const { data: ativos }   = useSupabaseQuery<Ativo>('ativos')
  const { data: imoveis }  = useSupabaseQuery<Imovel>('projetos_patrimonio')

  const [drill, setDrill] = useState<{ title: string; items: any[] } | null>(null)

  const mes = new Date().toISOString().slice(0, 7)
  const gastosMes    = gastos.filter(g => g.data.startsWith(mes))
  const receitasMes  = receitas.filter(r => r.data.startsWith(mes))
  const totalGastos  = gastosMes.reduce((a, g) => a + g.valor, 0)
  const totalReceitas = receitasMes.reduce((a, r) => a + r.valor, 0)
  const saldo        = totalReceitas - totalGastos

  const netWorthInvest  = ativos.reduce((a, v) => a + (v.valor_atual ?? v.valor_investido), 0)
  const netWorthImoveis = imoveis.reduce((a, p) => a + (p.valor_mercado_atual ?? p.valor_investido_total), 0)
  const netWorth        = netWorthInvest + netWorthImoveis + saldo

  // Spark por mês
  const spark6 = (arr: { data: string; valor: number }[]) =>
    Array.from({ length: 6 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() - (5 - i))
      const m = d.toISOString().slice(0, 7)
      return arr.filter(x => x.data.startsWith(m)).reduce((a, x) => a + x.valor, 0)
    })

  // Agrupamento por categoria
  const groupBy = useCallback((arr: { categoria: string; valor: number; descricao: string; data: string; forma_pagamento?: string }[]) => {
    const map: Record<string, { value: number; items: any[] }> = {}
    arr.forEach(item => {
      const cat = item.categoria || 'outros'
      if (!map[cat]) map[cat] = { value: 0, items: [] }
      map[cat].value += item.valor
      map[cat].items.push({ descricao: item.descricao, valor: item.valor, data: item.data, extra: item.forma_pagamento })
    })
    return Object.entries(map)
      .map(([cat, { value, items }]) => ({ name: cat, cat, value, items }))
      .sort((a, b) => b.value - a.value)
  }, [])

  const gastosAgrup  = groupBy(gastosMes)
  const receitasAgrup = groupBy(receitasMes)

  const handleCatGasto = (cat: string) => {
    const grupo = gastosAgrup.find(g => g.cat === cat)
    if (!grupo) return
    setDrill({ title: `Gastos · ${CAT_LABEL[cat] ?? cat}`, items: grupo.items })
  }
  const handleCatReceita = (cat: string) => {
    const grupo = receitasAgrup.find(g => g.cat === cat)
    if (!grupo) return
    setDrill({ title: `Receitas · ${CAT_LABEL[cat] ?? cat}`, items: grupo.items })
  }

  const proximosEventos = eventos
    .filter(e => new Date(e.data_inicio) >= new Date() && e.status !== 'cancelado')
    .slice(0, 5)

  const saudacao = (() => { const h = new Date().getHours(); return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite' })()

  return (
    <div className="space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-fg-tertiary uppercase tracking-wider mb-1">Dashboard Pessoal</p>
          <h1 className="text-2xl font-bold text-fg">{saudacao} 👤</h1>
          <p className="text-sm text-fg-tertiary mt-0.5">Sua vida financeira em um só lugar</p>
        </div>
        <Link href="/inicio" className="text-xs text-fg-tertiary hover:text-amber-400 transition-colors border border-border-subtle rounded-lg px-3 py-1.5">
          ← Dashboard Empresa
        </Link>
      </div>

      {/* Net Worth Hero */}
      <div className="bg-gradient-to-br from-[#0d1522] to-[#080b14] border border-white/10 rounded-2xl p-5 md:p-7 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-60 h-60 bg-emerald-500/8 rounded-full blur-[70px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-60 h-60 bg-amber-500/8 rounded-full blur-[70px] pointer-events-none" />
        <p className="text-[10px] text-fg-tertiary uppercase tracking-[0.12em] mb-1 relative z-10">Patrimônio Líquido Pessoal</p>
        <p className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-5 relative z-10">{formatCurrency(netWorth)}</p>
        <div className="grid grid-cols-3 gap-3 relative z-10">
          {[
            { label: 'Saldo Mês', val: saldo, color: saldo >= 0 ? 'text-emerald-400' : 'text-red-400' },
            { label: 'Investimentos', val: netWorthInvest, color: 'text-blue-400' },
            { label: 'Patrimônio', val: netWorthImoveis, color: 'text-amber-400' },
          ].map(({ label, val, color }) => (
            <div key={label}>
              <p className="text-[9px] text-fg-disabled uppercase tracking-wider mb-0.5">{label}</p>
              <p className={`text-base md:text-lg font-bold ${color}`}>{formatCurrency(val)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Receitas do mês"  value={formatCurrency(totalReceitas)} color="text-emerald-400" spark={spark6(receitas)} href="/pf-pessoal" sub={`${receitasMes.length} lançamentos`} />
        <KpiCard label="Gastos do mês"    value={formatCurrency(totalGastos)}   color="text-red-400"     spark={spark6(gastos)}   href="/pf-pessoal" sub={`${gastosMes.length} lançamentos`} />
        <KpiCard label="Saldo"            value={formatCurrency(saldo)}          color={saldo >= 0 ? 'text-emerald-400' : 'text-red-400'} sub={saldo >= 0 ? '✅ Positivo' : '⚠️ Negativo'} />
        <KpiCard label="Investimentos"    value={formatCurrency(netWorthInvest)} color="text-blue-400"   sub={`${ativos.length} ativos`} href="/investimentos" />
      </div>

      {/* Gráficos de categoria */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DonutChart
          data={gastosAgrup.map(g => ({ name: g.cat, cat: g.cat, value: g.value }))}
          title="Gastos por Categoria (mês)"
          onSliceClick={handleCatGasto}
        />
        <DonutChart
          data={receitasAgrup.map(g => ({ name: g.cat, cat: g.cat, value: g.value }))}
          title="Receitas por Categoria (mês)"
          onSliceClick={handleCatReceita}
        />
      </div>

      {/* Fluxo mensal */}
      <MonthlyBarChart gastos={gastos} receitas={receitas} />

      {/* Próximos eventos + Últimos gastos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Agenda */}
        <div className="bg-[#0d1522] border border-white/8 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-fg-tertiary uppercase tracking-wider">📅 Próximos Eventos</p>
            <Link href="/pf-pessoal" className="text-[10px] text-fg-disabled hover:text-amber-400">Ver agenda →</Link>
          </div>
          {proximosEventos.length === 0 ? (
            <p className="text-xs text-fg-disabled py-6 text-center">Nenhum evento próximo</p>
          ) : (
            <div className="space-y-2.5">
              {proximosEventos.map(e => (
                <div key={e.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center text-base shrink-0">
                    {e.tipo === 'reuniao' ? '🤝' : e.tipo === 'prazo' ? '⏰' : '📌'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-fg truncate">{e.titulo}</p>
                    <p className="text-[10px] text-fg-tertiary">
                      {new Date(e.data_inicio).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimos gastos */}
        <div className="bg-[#0d1522] border border-white/8 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-fg-tertiary uppercase tracking-wider">💸 Últimos Gastos</p>
            <Link href="/pf-pessoal" className="text-[10px] text-fg-disabled hover:text-amber-400">Ver tudo →</Link>
          </div>
          {gastos.length === 0 ? (
            <p className="text-xs text-fg-disabled py-6 text-center">Nenhum gasto registrado</p>
          ) : (
            <div className="space-y-2">
              {gastos.slice(0, 6).map(g => (
                <div key={g.id} className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-red-500/10 flex items-center justify-center text-sm shrink-0">
                    {CAT_LABEL[g.categoria]?.slice(0, 2) ?? '📦'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-fg truncate">{g.descricao}</p>
                    <p className="text-[10px] text-fg-tertiary">{CAT_LABEL[g.categoria]?.slice(3) ?? g.categoria}</p>
                  </div>
                  <p className="text-xs font-semibold text-red-400 shrink-0">{formatCurrency(g.valor)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* DrillDown global */}
      {drill && <DrillModal title={drill.title} items={drill.items} onClose={() => setDrill(null)} />}
    </div>
  )
}
