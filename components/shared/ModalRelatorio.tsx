'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Tipos ──────────────────────────────────────────────────────
interface RelatorioData {
  titulo: string
  periodo: string
  geradoEm: string
  financeiro: {
    totalReceitas: number
    totalGastos: number
    saldo: number
    gastos: { descricao: string; valor: number; categoria: string; data: string; forma: string }[]
    receitas: { descricao: string; valor: number; categoria: string; data: string }[]
  }
  agenda: { titulo: string; data_inicio: string; tipo: string }[]
  registros: { titulo: string; tipo: string; valor: number | null; data: string; descricao: string | null }[]
  ideias: { titulo: string; categoria: string; status: string }[]
}

interface Props {
  dados: RelatorioData
  onClose: () => void
}

// ── Helpers ─────────────────────────────────────────────────────
function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtDate(d: string) {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short'
  })
}

// ── Barra proporcional ─────────────────────────────────────────
function MiniBar({ valor, max, cor }: { valor: number; max: number; cor: string }) {
  const pct = max > 0 ? Math.min(100, (valor / max) * 100) : 0
  return (
    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden flex-1">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: cor }} />
    </div>
  )
}

// ── Componente Principal ────────────────────────────────────────
export function ModalRelatorio({ dados, onClose }: Props) {
  const [secao, setSecao] = useState<'financeiro' | 'agenda' | 'registros'>('financeiro')

  // Agrupa gastos por categoria
  const gastosPorCat = dados.financeiro.gastos.reduce<Record<string, number>>((acc, g) => {
    const cat = g.categoria || 'outros'
    acc[cat] = (acc[cat] || 0) + g.valor
    return acc
  }, {})
  const maxGasto = Math.max(...Object.values(gastosPorCat), 1)

  const totalItens = dados.financeiro.gastos.length + dados.financeiro.receitas.length
  const saldoColor = dados.financeiro.saldo >= 0 ? '#10b981' : '#ef4444'

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body > *:not(#relatorio-print) { display: none !important; }
          #relatorio-print { position: fixed; inset: 0; z-index: 99999; background: white; color: black; padding: 24px; }
          .no-print { display: none !important; }
          .print-section { page-break-inside: avoid; }
        }
      `}</style>

      {/* Overlay */}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4 no-print"
        onClick={e => e.target === e.currentTarget && onClose()}>

        <div id="relatorio-print"
          className="bg-[#080c15] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">

          {/* ── Header ──────────────────────────────────────── */}
          <div className="relative p-5 pb-4 border-b border-white/8 shrink-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-transparent to-emerald-500/10 pointer-events-none" />
            <div className="relative z-10 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-400 text-lg">✦</span>
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Elena · Relatório</span>
                </div>
                <h2 className="text-lg font-extrabold text-white">{dados.titulo}</h2>
                <p className="text-xs text-fg-tertiary mt-0.5">{dados.periodo} · Gerado em {dados.geradoEm}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 no-print">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-fg-secondary hover:bg-white/10 hover:text-white transition-all"
                >
                  🖨️ PDF
                </button>
                <button onClick={onClose}
                  className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 text-fg-tertiary hover:text-white hover:bg-white/10 flex items-center justify-center text-lg transition-all">
                  ×
                </button>
              </div>
            </div>
          </div>

          {/* ── KPIs ────────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-3 p-5 pb-0 shrink-0">
            {[
              { label: 'Receitas', value: dados.financeiro.totalReceitas, cor: '#10b981', icon: '📈' },
              { label: 'Gastos',   value: dados.financeiro.totalGastos,   cor: '#ef4444', icon: '📉' },
              { label: 'Saldo',    value: dados.financeiro.saldo,         cor: saldoColor, icon: '💰' },
            ].map(k => (
              <div key={k.label} className="bg-white/3 border border-white/6 rounded-xl p-3 text-center">
                <p className="text-base mb-0.5">{k.icon}</p>
                <p className="text-[11px] font-extrabold" style={{ color: k.cor }}>{fmt(k.value)}</p>
                <p className="text-[9px] text-fg-disabled uppercase tracking-wide mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* ── Tabs ────────────────────────────────────────── */}
          <div className="flex gap-1 px-5 pt-4 shrink-0 no-print">
            {([
              { id: 'financeiro', label: `💳 Financeiro (${totalItens})` },
              { id: 'agenda',     label: `📅 Agenda (${dados.agenda.length})` },
              { id: 'registros',  label: `🗂️ Registros (${dados.registros.length + dados.ideias.length})` },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setSecao(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                  secao === t.id
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'text-fg-disabled border-border-subtle hover:text-fg-secondary bg-page'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Conteúdo com scroll ──────────────────────────── */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0">

            {/* Aba Financeiro */}
            {secao === 'financeiro' && (
              <div className="space-y-4 print-section">
                {/* Gastos por categoria */}
                {Object.keys(gastosPorCat).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-fg-secondary mb-2">📊 Gastos por Categoria</p>
                    <div className="space-y-2">
                      {Object.entries(gastosPorCat).sort((a, b) => b[1] - a[1]).map(([cat, val]) => (
                        <div key={cat} className="flex items-center gap-3">
                          <span className="text-[10px] text-fg-tertiary w-24 shrink-0 capitalize">{cat}</span>
                          <MiniBar valor={val} max={maxGasto} cor="#f59e0b" />
                          <span className="text-[10px] font-bold text-amber-400 w-20 text-right shrink-0">{fmt(val)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista de Gastos */}
                {dados.financeiro.gastos.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-fg-secondary mb-2">📉 Gastos ({dados.financeiro.gastos.length})</p>
                    <div className="space-y-1">
                      {dados.financeiro.gastos.map((g, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/2 border border-white/5 hover:bg-white/4 transition-all">
                          <span className="text-[10px] text-fg-disabled w-12 shrink-0">{fmtDate(g.data)}</span>
                          <span className="text-xs text-fg flex-1 truncate">{g.descricao}</span>
                          <span className="text-[10px] text-fg-tertiary w-20 shrink-0 text-right capitalize">{g.categoria}</span>
                          <span className="text-xs font-bold text-red-400 w-20 shrink-0 text-right">{fmt(g.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Lista de Receitas */}
                {dados.financeiro.receitas.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-fg-secondary mb-2">📈 Receitas ({dados.financeiro.receitas.length})</p>
                    <div className="space-y-1">
                      {dados.financeiro.receitas.map((r, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/2 border border-white/5 hover:bg-white/4 transition-all">
                          <span className="text-[10px] text-fg-disabled w-12 shrink-0">{fmtDate(r.data)}</span>
                          <span className="text-xs text-fg flex-1 truncate">{r.descricao}</span>
                          <span className="text-[10px] text-fg-tertiary w-20 shrink-0 text-right capitalize">{r.categoria}</span>
                          <span className="text-xs font-bold text-emerald-400 w-20 shrink-0 text-right">{fmt(r.valor)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {dados.financeiro.gastos.length === 0 && dados.financeiro.receitas.length === 0 && (
                  <p className="text-center text-fg-disabled text-sm py-8">Nenhum lançamento no período.</p>
                )}
              </div>
            )}

            {/* Aba Agenda */}
            {secao === 'agenda' && (
              <div className="print-section">
                {dados.agenda.length === 0 ? (
                  <p className="text-center text-fg-disabled text-sm py-8">Nenhum evento na agenda.</p>
                ) : (
                  <div className="space-y-1">
                    {dados.agenda.map((ev, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/2 border border-white/5">
                        <span className="text-[10px] text-fg-disabled w-16 shrink-0">{fmtDate(ev.data_inicio)}</span>
                        <span className="text-xs text-fg flex-1">{ev.titulo}</span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 capitalize shrink-0">{ev.tipo}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Aba Registros + Ideias */}
            {secao === 'registros' && (
              <div className="space-y-4 print-section">
                {dados.registros.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-fg-secondary mb-2">🗂️ Registros Gerais</p>
                    <div className="space-y-1">
                      {dados.registros.map((r, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/2 border border-white/5">
                          <span className="text-[10px] text-fg-disabled w-12 shrink-0">{fmtDate(r.data)}</span>
                          <span className="text-xs text-fg flex-1 truncate">{r.titulo}</span>
                          {r.valor != null && r.valor > 0 && (
                            <span className="text-xs font-bold text-amber-400 shrink-0">{fmt(r.valor)}</span>
                          )}
                          <span className="text-[9px] text-fg-disabled capitalize shrink-0">{r.tipo}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {dados.ideias.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-fg-secondary mb-2">💡 Ideias</p>
                    <div className="space-y-1">
                      {dados.ideias.map((id, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/2 border border-white/5">
                          <span className="text-xs text-fg flex-1">{id.titulo}</span>
                          <span className="text-[9px] text-violet-400 shrink-0 capitalize">{id.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {dados.registros.length === 0 && dados.ideias.length === 0 && (
                  <p className="text-center text-fg-disabled text-sm py-8">Nenhum registro ou ideia encontrados.</p>
                )}
              </div>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────── */}
          <div className="shrink-0 px-5 py-3 border-t border-white/8 flex items-center justify-between no-print">
            <p className="text-[10px] text-fg-disabled">
              ✦ Relatório gerado pela Elena · {dados.geradoEm}
            </p>
            <button
              onClick={() => window.print()}
              className="text-xs font-semibold px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-all"
            >
              🖨️ Exportar como PDF
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ── Hook para buscar dados do relatório ──────────────────────────
export async function buscarDadosRelatorio(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  periodo: string = 'mes_atual'
): Promise<RelatorioData> {
  const agora = new Date()
  const mesAtual = agora.toISOString().slice(0, 7)

  let dataInicio: string
  let dataFim: string
  let tituloPeriodo: string

  if (periodo === 'mes_atual' || periodo === 'mes') {
    dataInicio = `${mesAtual}-01`
    dataFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().split('T')[0]
    tituloPeriodo = agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  } else if (periodo === 'ultimos_30_dias' || periodo === '30_dias') {
    const d = new Date(); d.setDate(d.getDate() - 30)
    dataInicio = d.toISOString().split('T')[0]
    dataFim = agora.toISOString().split('T')[0]
    tituloPeriodo = 'Últimos 30 dias'
  } else if (periodo === 'ultimos_7_dias' || periodo === '7_dias') {
    const d = new Date(); d.setDate(d.getDate() - 7)
    dataInicio = d.toISOString().split('T')[0]
    dataFim = agora.toISOString().split('T')[0]
    tituloPeriodo = 'Últimos 7 dias'
  } else if (periodo === 'ano_atual' || periodo === 'ano') {
    dataInicio = `${agora.getFullYear()}-01-01`
    dataFim = `${agora.getFullYear()}-12-31`
    tituloPeriodo = `Ano ${agora.getFullYear()}`
  } else {
    // fallback: mês atual
    dataInicio = `${mesAtual}-01`
    dataFim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0).toISOString().split('T')[0]
    tituloPeriodo = agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
  }

  // Busca paralela em todas as tabelas
  const [gastosRes, receitasRes, agendaRes, registrosRes, ideiasRes] = await Promise.all([
    (supabase.from('gastos_pessoais') as any)
      .select('descricao,valor,categoria,data,forma_pagamento')
      .eq('user_id', userId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false }),

    (supabase.from('receitas_pessoais') as any)
      .select('descricao,valor,categoria,data')
      .eq('user_id', userId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false }),

    (supabase.from('agenda_eventos') as any)
      .select('titulo,data_inicio,tipo')
      .eq('user_id', userId)
      .gte('data_inicio', dataInicio + 'T00:00:00')
      .lte('data_inicio', dataFim + 'T23:59:59')
      .order('data_inicio'),

    (supabase.from('elena_registros') as any)
      .select('titulo,tipo,valor,data,descricao')
      .eq('user_id', userId)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false }),

    (supabase.from('elena_ideias') as any)
      .select('titulo,categoria,status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const gastos = (gastosRes.data || []).map((g: any) => ({
    descricao: g.descricao,
    valor: Number(g.valor),
    categoria: g.categoria || 'outros',
    data: g.data,
    forma: g.forma_pagamento || '',
  }))

  const receitas = (receitasRes.data || []).map((r: any) => ({
    descricao: r.descricao,
    valor: Number(r.valor),
    categoria: r.categoria || 'outros',
    data: r.data,
  }))

  const totalReceitas = receitas.reduce((a: number, r: any) => a + r.valor, 0)
  const totalGastos = gastos.reduce((a: number, g: any) => a + g.valor, 0)

  return {
    titulo: 'Relatório Financeiro Pessoal',
    periodo: tituloPeriodo,
    geradoEm: agora.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
    financeiro: {
      totalReceitas,
      totalGastos,
      saldo: totalReceitas - totalGastos,
      gastos,
      receitas,
    },
    agenda: (agendaRes.data || []).map((e: any) => ({ titulo: e.titulo, data_inicio: e.data_inicio, tipo: e.tipo })),
    registros: (registrosRes.data || []).map((r: any) => ({ titulo: r.titulo, tipo: r.tipo, valor: r.valor ? Number(r.valor) : null, data: r.data, descricao: r.descricao })),
    ideias: (ideiasRes.data || []).map((i: any) => ({ titulo: i.titulo, categoria: i.categoria, status: i.status })),
  }
}
