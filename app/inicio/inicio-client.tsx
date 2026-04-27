'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Chart, DoughnutController, LineController, BarController, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Filler } from 'chart.js'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatCurrency, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import DashboardPessoalClient from '@/app/(dashboard)/dashboard-pessoal/dashboard-pessoal-client'
import { PWAInstallButton } from '@/components/shared/PWAInstallBanner'

Chart.register(DoughnutController, LineController, BarController, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Tooltip, Filler)

const MESES_FULL = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ANOS = [2026, 2025, 2024, 2023, 2022, 2021]

// ── Modal Lançamento inline ──────────────────────────────
function ModalLancamento({ onClose, onSave, contas, categorias }: {
  onClose: () => void
  onSave: () => void
  contas: any[]
  categorias: any[]
}) {
  const { insert, loading } = useSupabaseMutation('lancamentos')
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    conta_id: contas[0]?.id ?? '',
    descricao: '',
    valor: '',
    tipo: 'despesa' as 'receita' | 'despesa' | 'investimento' | 'transferencia',
    regime: 'caixa' as 'caixa' | 'competencia',
    data_competencia: today,
    categoria_id: '',
    total_parcelas: '1',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) return
    const parcelas = parseInt(form.total_parcelas) || 1
    if (parcelas > 1) {
      const supabase = createClient()
      for (let i = 1; i <= parcelas; i++) {
        const data = new Date(form.data_competencia)
        data.setMonth(data.getMonth() + (i - 1))
        await (supabase.from('lancamentos') as any).insert({
          conta_id: form.conta_id, descricao: `${form.descricao} (${i}/${parcelas})`,
          valor: valor / parcelas, tipo: form.tipo, regime: form.regime,
          status: 'pendente', data_competencia: data.toISOString().split('T')[0],
          categoria_id: form.categoria_id || null, parcela_atual: i, total_parcelas: parcelas,
        } as any)
      }
    } else {
      await insert({
        conta_id: form.conta_id, descricao: form.descricao, valor,
        tipo: form.tipo, regime: form.regime, status: 'pendente',
        data_competencia: form.data_competencia,
        categoria_id: form.categoria_id || null, total_parcelas: 1,
      } as any)
    }
    onSave(); onClose()
  }

  const categoriasFiltradas = categorias.filter((c: any) => c.tipo === form.tipo)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">Novo Lançamento</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-1 bg-muted/50 p-1 rounded-lg">
            {(['despesa', 'receita', 'investimento', 'transferencia'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, tipo: t, categoria_id: '' }))}
                className={cn('py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                  form.tipo === t
                    ? t === 'receita' ? 'bg-emerald-500/20 text-emerald-400'
                      : t === 'despesa' ? 'bg-red-500/20 text-red-400'
                        : t === 'investimento' ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-surface-hover text-fg-secondary'
                    : 'text-fg-tertiary hover:text-fg-secondary'
                )}>{t === 'transferencia' ? 'Transf.' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Aluguel, Salário..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input mt-1" required type="number" step="0.01" min="0.01"
                value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="0,00" />
            </div>
            <div>
              <label className="label">Parcelas</label>
              <input className="input mt-1" type="number" min="1" max="60"
                value={form.total_parcelas}
                onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data *</label>
              <input className="input mt-1" type="date" required value={form.data_competencia}
                onChange={e => setForm(f => ({ ...f, data_competencia: e.target.value }))} />
            </div>
            <div>
              <label className="label">Regime</label>
              <select className="input mt-1" value={form.regime}
                onChange={e => setForm(f => ({ ...f, regime: e.target.value as any }))}>
                <option value="caixa">Caixa (recebido)</option>
                <option value="competencia">Competência (vendido)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Conta *</label>
              <select className="input mt-1" required value={form.conta_id}
                onChange={e => setForm(f => ({ ...f, conta_id: e.target.value }))}>
                {contas.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input mt-1" value={form.categoria_id}
                onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                <option value="">Sem categoria</option>
                {categoriasFiltradas.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InicioClient() {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth())
  const [activeTab, setActiveTab] = useState<'visao' | 'competencia' | 'caixa'>('visao')
  const [modalLancamento, setModalLancamento] = useState(false)
  const [dashView, setDashView] = useState<'empresa' | 'pessoal'>('empresa')
  const [modalDetalhe, setModalDetalhe] = useState<null | 'patrimonio' | 'receitas' | 'despesas' | 'leads'>(null)
  const chartRefs = useRef<{ [key: string]: Chart }>({})

  const handleLogout = async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  // ── DADOS REAIS ──────────────────────────────────────────────
  const { data: lancamentos, refetch: refetchLanc } = useSupabaseQuery<any>('lancamentos')
  const { data: contas, refetch: refetchContas } = useSupabaseQuery<any>('contas', { filters: { ativo: true } })
  const { data: leads } = useSupabaseQuery<any>('leads')
  const { data: operacoes } = useSupabaseQuery<any>('operacoes')
  const { data: ativos } = useSupabaseQuery<any>('ativos')
  const { data: categorias } = useSupabaseQuery<any>('categorias_financeiras', {
    orderBy: { column: 'nome', ascending: true },
  })

  const handleRefresh = () => { refetchLanc(); refetchContas() }

  // ── Filtro por mês/ano e regime ──────────────────────────────
  const mesPad = String(selectedMonth + 1).padStart(2, '0')
  const filtroMes = `${selectedYear}-${mesPad}`

  const lancamentosDoMes = lancamentos.filter((l: any) => {
    const noMes = l.data_competencia?.startsWith(filtroMes)
    if (activeTab === 'competencia') return noMes && l.regime === 'competencia'
    if (activeTab === 'caixa') return noMes && l.regime === 'caixa'
    return noMes
  })

  // Saldo total (sempre global)
  const saldoTotal = contas.reduce((a: number, c: any) => a + (c.saldo_atual ?? 0), 0) +
    ativos.reduce((a: number, v: any) => a + (v.valor_atual ?? v.valor_investido ?? 0), 0)

  const receitas = lancamentosDoMes.filter((l: any) => l.tipo === 'receita').reduce((a: number, l: any) => a + l.valor, 0)
  const despesas = lancamentosDoMes.filter((l: any) => l.tipo === 'despesa').reduce((a: number, l: any) => a + l.valor, 0)
  const resultado = receitas - despesas

  const leadsAtivos = leads.filter((l: any) => l.status !== 'perdido').length
  const winRateTrader = operacoes.filter((o: any) => o.resultado !== 'aberta').length > 0
    ? Math.round((operacoes.filter((o: any) => o.resultado === 'gain').length / operacoes.filter((o: any) => o.resultado !== 'aberta').length) * 100)
    : 0

  const mesNome = MESES_FULL[selectedMonth]
  const today = new Date()
  const isCurrentMonth = selectedMonth === today.getMonth() && selectedYear === today.getFullYear()
  const subtitleDate = `${mesNome} ${selectedYear} · ${isCurrentMonth ? 'Atualizado agora' : 'Período selecionado'}`

  // ── DADOS AGREGADOS REAIS ─────────────────────────────
  const receitasNoAno = new Array(12).fill(0)
  const despesasNoAno = new Array(12).fill(0)
  const mapaDespMes = new Map<string, number>()
  const mapaDespAno = new Map<string, number>()
  let totalDespMes = 0; let totalDespAno = 0;

  lancamentos.forEach((l: any) => {
    if (!l.data_competencia || !l.valor) return
    const anoL = parseInt(l.data_competencia.substring(0, 4))
    if (anoL !== selectedYear) return

    const mesL = parseInt(l.data_competencia.substring(5, 7)) - 1
    if (l.tipo === 'receita') {
      receitasNoAno[mesL] += l.valor
    } else if (l.tipo === 'despesa') {
      despesasNoAno[mesL] += l.valor

      const catName = l.categoria_id
        ? (categorias?.find?.((c: any) => c.id === l.categoria_id)?.nome || 'Diversos')
        : 'Outros'

      mapaDespAno.set(catName, (mapaDespAno.get(catName) || 0) + l.valor)
      totalDespAno += l.valor
      if (mesL === selectedMonth) {
        mapaDespMes.set(catName, (mapaDespMes.get(catName) || 0) + l.valor)
        totalDespMes += l.valor
      }
    }
  })

  // Prepara os arrays para os Donuts (Top 5)
  const topCatsMes = Array.from(mapaDespMes.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  while (topCatsMes.length < 5) topCatsMes.push(['-', 0])
  const topCatsAno = Array.from(mapaDespAno.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  while (topCatsAno.length < 5) topCatsAno.push(['-', 0])
  const dColors = ['#7c5cfc', '#22d3ee', '#f472b6', '#f5a623', '#10b981']

  useEffect(() => {
    Chart.defaults.color = '#4a5578'
    Chart.defaults.borderColor = 'rgba(255,255,255,0.05)'
    Chart.defaults.font.family = "'DM Sans', sans-serif"

    const registerChart = (id: string, config: any) => {
      const ctx = document.getElementById(id) as HTMLCanvasElement
      if (!ctx) return
      if (chartRefs.current[id]) chartRefs.current[id].destroy()
      chartRefs.current[id] = new Chart(ctx, config)
    }

    // ── SPARKLINES ──────────────
    const sparkline = (id: string, data: number[], color: string) => {
      registerChart(id, {
        type: 'line',
        data: {
          labels: data.map((_, i) => i),
          datasets: [{
            data, borderColor: color, borderWidth: 1.5, tension: 0.4,
            pointRadius: 0, fill: true,
            backgroundColor: (context: any) => {
              const ctx2 = context.chart.ctx
              const g = ctx2.createLinearGradient(0, 0, 0, 44)
              g.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba'))
              g.addColorStop(1, 'transparent')
              return g
            }
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false as const }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
          animation: { duration: 1200 }
        }
      })
    }

    sparkline('sp1', [saldoTotal * 0.8, saldoTotal * 0.9, saldoTotal * 0.85, saldoTotal], 'rgb(16,185,129)')
    sparkline('sp2', [receitas * 0.7, receitas * 0.8, receitas * 0.9, receitas], 'rgb(124,92,252)')
    sparkline('sp3', [despesas * 1.1, despesas * 1.05, despesas * 0.9, despesas], 'rgb(244,63,94)')
    sparkline('sp4', [resultado * 0.5, resultado * 0.8, resultado * 0.6, resultado], 'rgb(245,166,35)')

    // ── BAR CHART ───────────────
    const months = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    registerChart('barChart', {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Receitas', data: receitasNoAno,
            backgroundColor: 'rgba(124,92,252,0.75)', borderRadius: 4, borderSkipped: false
          },
          {
            label: 'Despesas', data: despesasNoAno,
            backgroundColor: 'rgba(244,114,182,0.65)', borderRadius: 4, borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false as const }, tooltip: {
            callbacks: {
              label: (ctx: any) => ` R$ ${ctx.parsed.y.toLocaleString('pt-BR')}`
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { font: { size: 10 }, callback: (v: any) => `R$ ${(v / 1000).toFixed(0)}k` }
          }
        },
        animation: { duration: 1000, easing: 'easeOutQuart' }
      }
    })

    // ── DONUTS ──────────────────
    const donut = (id: string, data: number[], colors: string[]) => {
      registerChart(id, {
        type: 'doughnut',
        data: { datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 4 }] },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '72%',
          plugins: { legend: { display: false as const }, tooltip: { enabled: false } },
          animation: { duration: 900 }
        }
      })
    }

    const d1Data = topCatsMes.map(t => t[1] as number)
    const d2Data = topCatsAno.map(t => t[1] as number)

    // Fallback if empty to draw empty rings
    donut('d1', d1Data.reduce((a, b) => a + b, 0) === 0 ? [1] : d1Data, d1Data.reduce((a, b) => a + b, 0) === 0 ? ['#2a3045'] : dColors)
    donut('d2', d2Data.reduce((a, b) => a + b, 0) === 0 ? [1] : d2Data, d2Data.reduce((a, b) => a + b, 0) === 0 ? ['#2a3045'] : dColors)

    // ── MINI RINGS ──────────────
    const ring = (id: string, pct: number, color: string) => {
      registerChart(id, {
        type: 'doughnut',
        data: {
          datasets: [{
            data: [pct, Math.max(0, 100 - pct)],
            backgroundColor: [color, 'rgba(255,255,255,0.06)'], borderWidth: 0
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '75%',
          plugins: { legend: { display: false as const }, tooltip: { enabled: false } },
          animation: { duration: 800 }
        }
      })
    }

    // Rings dinamicos baseados nas categorias anuais vs total gasto
    topCatsAno.forEach((cat, idx) => {
      const pct = totalDespAno > 0 ? ((cat[1] as number) / totalDespAno) * 100 : 0
      ring(`r${idx + 1}`, pct, dColors[idx])
    })

    // ── LINE CHART ──────────────
    registerChart('lineChart', {
      type: 'line',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Receitas',
            data: receitasNoAno,
            borderColor: '#7c5cfc', borderWidth: 2, tension: 0.4, pointRadius: 3,
            pointBackgroundColor: '#7c5cfc', fill: true,
            backgroundColor: (context: any) => {
              const ctx2 = context.chart.ctx
              const g = ctx2.createLinearGradient(0, 0, 0, 190)
              g.addColorStop(0, 'rgba(124,92,252,0.25)')
              g.addColorStop(1, 'rgba(124,92,252,0)')
              return g
            }
          },
          {
            label: 'Despesas',
            data: despesasNoAno,
            borderColor: '#f472b6', borderWidth: 2, tension: 0.4, pointRadius: 3,
            pointBackgroundColor: '#f472b6', fill: true,
            backgroundColor: (context: any) => {
              const ctx2 = context.chart.ctx
              const g = ctx2.createLinearGradient(0, 0, 0, 190)
              g.addColorStop(0, 'rgba(244,114,182,0.18)')
              g.addColorStop(1, 'rgba(244,114,182,0)')
              return g
            }
          }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { display: false as const }, tooltip: {
            backgroundColor: '#1a2035', borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1, titleColor: '#8b98b8', bodyColor: '#f0f4ff',
            padding: 10,
            callbacks: { label: (ctx: any) => ` R$ ${ctx.parsed.y.toLocaleString('pt-BR')}` }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 10 } } },
          y: {
            grid: { color: 'rgba(255,255,255,0.04)' },
            ticks: { font: { size: 10 }, callback: (v: any) => `R$ ${(v / 1000).toFixed(0)}k` },
            min: 0
          }
        },
        animation: { duration: 1200, easing: 'easeOutQuart' }
      }
    })

    return () => {
      Object.values(chartRefs.current).forEach(chart => chart.destroy())
    }
  }, [saldoTotal, receitas, despesas, resultado, selectedYear, selectedMonth, activeTab])

  return (
    <>
      {/* ── Toggle Empresa / Pessoal ────────────────────────── */}
      <div style={{
        position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 9999, display: 'flex', gap: 4,
        background: 'rgba(13,17,32,0.92)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: 4,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        {(['empresa', 'pessoal'] as const).map(v => (
          <button
            key={v}
            onClick={() => setDashView(v)}
            style={{
              padding: '6px 20px', borderRadius: 10, fontSize: 12, fontWeight: 700,
              fontFamily: 'Syne, sans-serif', border: 'none', cursor: 'pointer',
              transition: 'all 0.2s',
              background: dashView === v
                ? v === 'empresa'
                  ? 'linear-gradient(135deg, #f5a623, #e07b00)'
                  : 'linear-gradient(135deg, #22c55e, #15803d)'
                : 'transparent',
              color: dashView === v ? '#000' : '#8b98b8',
              boxShadow: dashView === v ? '0 4px 12px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            {v === 'empresa' ? '🏢 Empresa' : '👤 Pessoal'}
          </button>
        ))}
      </div>

      {/* ── Dashboard Pessoal ───────────────────────────────── */}
      {dashView === 'pessoal' && (
        <div style={{ paddingTop: 56, minHeight: '100vh', background: '#080b14' }}>
          <DashboardPessoalClient />
        </div>
      )}

      {/* ── Dashboard Empresa (original) ────────────────────── */}
      <div style={{ display: dashView === 'empresa' ? 'block' : 'none' }}>
      <style dangerouslySetInnerHTML={{
        __html: `
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
        .custom-dashboard * { margin:0; padding:0; box-sizing:border-box; border: none; }
        .custom-dashboard {
          --bg0:#080b14; --bg1:#0d1120; --bg2:#111827; --bg3:#1a2035; --bg4:#1f2744;
          --gold:#f5a623; --gold2:#fbbf24; --gold-dim:rgba(245,166,35,.12);
          --purple:#7c5cfc; --purple2:#a78bfa; --cyan:#22d3ee; --pink:#f472b6;
          --green:#10b981; --red:#f43f5e; --text1:#f0f4ff; --text2:#8b98b8;
          --text3:#4a5578; --border:rgba(255,255,255,.06); --r:14px;
          height: 100vh; font-family: 'DM Sans', sans-serif; background: var(--bg0);
          color: var(--text1); font-size: 14px; overflow: hidden;
        }

        .custom-dashboard .shell { display: grid; grid-template-columns: 220px 1fr; height: 100vh; }
        .custom-dashboard aside {
          background: var(--bg1); border-right: 1px solid var(--border);
          display: flex; flex-direction: column; padding: 0; overflow: hidden; position: relative;
        }
        .custom-dashboard aside::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, var(--gold), transparent);
        }
        .custom-dashboard .logo { padding: 22px 20px 18px; border-bottom: 1px solid var(--border); border-top: none; border-left: none; border-right: none;}
        .custom-dashboard .logo-mark {
          width: 36px; height: 36px; background: linear-gradient(135deg, var(--gold), #e07b00);
          border-radius: 10px; display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 800; font-size: 16px; color: #000;
          margin-bottom: 10px; box-shadow: 0 4px 20px rgba(245,166,35,.35);
        }
        .custom-dashboard .logo h2 { font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 700; color: var(--text1); }
        .custom-dashboard .logo p { font-size: 11px; color: var(--text3); margin-top: 1px; text-decoration: none;}

        .custom-dashboard .years { padding: 12px 14px 8px; display: flex; flex-direction: column; gap: 2px; overflow-y: auto; flex: 1; }
        .custom-dashboard .yr {
          text-align: left; padding: 9px 10px; border-radius: 6px;
          font-size: 13px; font-weight: 600; color: var(--text3); cursor: pointer; transition: .15s;
          border: 1px solid transparent; text-decoration: none; display: flex; align-items: center; justify-content: space-between;
        }
        .custom-dashboard .yr:hover { color: var(--text2); background: rgba(255,255,255,.03); }
        .custom-dashboard .yr.active { background: var(--gold-dim); color: var(--gold); border: 1px solid rgba(245,166,35,.25); }
        .custom-dashboard .yr-arrow { font-size: 9px; transition: transform .2s; }
        .custom-dashboard .yr.active .yr-arrow { transform: rotate(180deg); }
        .custom-dashboard .months-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 3px; padding: 4px 0 8px 0; }
        .custom-dashboard .mo {
          padding: 5px 2px; border-radius: 5px; font-size: 10px; font-weight: 500;
          color: var(--text3); cursor: pointer; transition: .15s; text-align: center;
          border: 1px solid transparent;
        }
        .custom-dashboard .mo:hover { color: var(--text2); background: rgba(255,255,255,.05); }
        .custom-dashboard .mo.active { background: var(--gold-dim); color: var(--gold); border-color: rgba(245,166,35,.25); }

        .custom-dashboard .user-row {
          padding: 14px 16px; border-top: 1px solid var(--border); border-bottom: none; border-left: none; border-right: none;
          display: flex; align-items: center; gap: 10px; margin-top: auto;
        }
        .custom-dashboard .avatar {
          width: 32px; height: 32px; border-radius: 50%;
          background: linear-gradient(135deg, var(--gold), #c07000);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif; font-weight: 700; font-size: 12px; color: #000;
          flex-shrink: 0;
        }
        .custom-dashboard .user-info p:first-child { font-size: 12px; font-weight: 500; color: var(--text1); }
        .custom-dashboard .user-info p:last-child { font-size: 10px; color: var(--text3); }
        .custom-dashboard .logout-btn {
          margin-left: auto; padding: 5px 10px; border-radius: 6px; font-size: 10px;
          font-weight: 600; color: var(--text3); background: rgba(244,63,94,.08);
          border: 1px solid rgba(244,63,94,.2); cursor: pointer; transition: .15s;
          letter-spacing: .03em;
        }
        .custom-dashboard .logout-btn:hover { color: var(--red); background: rgba(244,63,94,.15); border-color: rgba(244,63,94,.4); }

        .custom-dashboard main { display: flex; flex-direction: column; overflow: hidden; background: transparent; }
        .custom-dashboard .topbar {
          padding: 16px 24px; display: flex; align-items: center; justify-content: space-between;
          border-bottom: 1px solid var(--border); border-top: none; border-left: none; border-right: none; flex-shrink: 0;
        }
        .custom-dashboard .topbar-left h1 { font-family: 'Syne', sans-serif; font-size: 18px; font-weight: 700; }
        .custom-dashboard .topbar-left p { font-size: 12px; color: var(--text3); margin-top: 2px; }
        .custom-dashboard .topbar-right { display: flex; align-items: center; gap: 10px; }
        .custom-dashboard .tb-badge {
          padding: 6px 14px; border-radius: 20px; font-size: 11px; font-weight: 500;
          border: 1px solid var(--border); color: var(--text2); cursor: pointer; transition: .15s;
        }
        .custom-dashboard .tb-badge:hover { border-color: var(--gold); color: var(--gold); }
        .custom-dashboard .tb-badge.active { background: var(--gold-dim); border-color: rgba(245,166,35,.4); color: var(--gold); }

        .custom-dashboard .content { flex: 1; overflow-y: auto; padding: 20px 24px 24px; display: flex; flex-direction: column; gap: 16px; }
        .custom-dashboard .cards-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
        .custom-dashboard .metric-card {
          background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r);
          padding: 16px; position: relative; overflow: hidden; transition: .2s; cursor: pointer; border-style: solid;
        }
        .custom-dashboard .metric-card:hover { border-color: rgba(255,255,255,.12); transform: translateY(-1px); }
        .custom-dashboard .metric-card::after {
          content: ''; position: absolute; inset: 0;
          background: radial-gradient(ellipse at 80% 20%, var(--accent-glow, transparent), transparent 70%);
          pointer-events: none;
        }
        .custom-dashboard .mc-label { font-size: 10px; font-weight: 500; color: var(--text3); letter-spacing: .06em; text-transform: uppercase; margin-bottom: 8px; }
        .custom-dashboard .mc-value { font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 700; letter-spacing: -.5px; margin-bottom: 4px; }
        .custom-dashboard .mc-change { font-size: 11px; display: flex; align-items: center; gap: 3px; }
        .custom-dashboard .mc-change.up { color: var(--green); }
        .custom-dashboard .mc-change.down { color: var(--red); }
        .custom-dashboard .sparkline-wrap { position: absolute; bottom: 0; right: 0; width: 100px; height: 44px; opacity: .7; }

        .custom-dashboard .mid-row { display: grid; grid-template-columns: 1.6fr 1fr; gap: 12px; }
        .custom-dashboard .card { background: var(--bg2); border: 1px solid var(--border); border-radius: var(--r); padding: 18px; border-style: solid;}
        .custom-dashboard .card-title {
          font-family: 'Syne', sans-serif; font-size: 13px; font-weight: 600;
          color: var(--text1); margin-bottom: 14px; display: flex; align-items: center; justify-content: space-between;
        }
        .custom-dashboard .card-title span { font-size: 10px; font-weight: 400; color: var(--text3); font-family: 'DM Sans', sans-serif; }
        .custom-dashboard .legend { display: flex; gap: 12px; margin-bottom: 12px; }
        .custom-dashboard .leg-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text2); }
        .custom-dashboard .leg-dot { width: 8px; height: 8px; border-radius: 50%; border: none;}

        .custom-dashboard .bot-row { display: grid; grid-template-columns: 1fr 1.4fr; gap: 12px; }
        .custom-dashboard .rings-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 4px; }
        .custom-dashboard .ring-item { display: flex; flex-direction: column; align-items: center; gap: 5px; }
        .custom-dashboard .ring-label { font-size: 9px; color: var(--text3); text-align: center; }

        .custom-dashboard .bar-list { display: flex; flex-direction: column; gap: 8px; margin-top: 4px; }
        .custom-dashboard .bar-item { display: flex; align-items: center; gap: 8px; }
        .custom-dashboard .bar-name { font-size: 11px; color: var(--text2); width: 80px; flex-shrink: 0; }
        .custom-dashboard .bar-track { flex: 1; height: 5px; background: rgba(255,255,255,.06); border-radius: 3px; overflow: hidden; }
        .custom-dashboard .bar-fill { height: 100%; border-radius: 3px; transition: width 1.2s cubic-bezier(.4,0,.2,1); }
        .custom-dashboard .bar-val { font-size: 11px; font-weight: 500; color: var(--text1); width: 60px; text-align: right; flex-shrink: 0; }

        .custom-dashboard .donut-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .custom-dashboard .donut-card { background: var(--bg2); border: 1px solid var(--border); border-style: solid; border-radius: var(--r); padding: 14px; display: flex; flex-direction: column; align-items: center; }
        .custom-dashboard .donut-card .card-title { margin-bottom: 6px; width: 100%; font-size: 12px; }
        .custom-dashboard .donut-center { position: relative; width: 90px; height: 90px; margin: 0 auto 8px; }
        .custom-dashboard .donut-center canvas { position: absolute; inset: 0; }
        .custom-dashboard .donut-inner { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
        .custom-dashboard .donut-pct { font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 700; }
        .custom-dashboard .donut-sub { font-size: 9px; color: var(--text3); margin-top: 1px; }
        .custom-dashboard .donut-legend { display: flex; flex-direction: column; gap: 4px; width: 100%; }
        .custom-dashboard .dl-item { display: flex; align-items: center; justify-content: space-between; font-size: 10px; }
        .custom-dashboard .dl-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; border: none;}
        .custom-dashboard .dl-name { color: var(--text3); flex: 1; margin-left: 5px; }
        .custom-dashboard .dl-pct { color: var(--text2); font-weight: 500; }

        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .custom-dashboard .cards-row, .custom-dashboard .mid-row, .custom-dashboard .bot-row { animation: fadeUp .5s ease both; }
        .custom-dashboard .cards-row { animation-delay: .05s; }
        .custom-dashboard .mid-row { animation-delay: .12s; }
        .custom-dashboard .bot-row { animation-delay: .2s; }
        
        .custom-dashboard ::-webkit-scrollbar { width: 6px; }
        .custom-dashboard ::-webkit-scrollbar-track { background: transparent; }
        .custom-dashboard ::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }

        .custom-dashboard .nav-btn {
          display: flex; align-items: center; gap: 8px; width: calc(100% - 28px);
          margin: 10px 14px 0; padding: 8px 12px; border-radius: 8px;
          font-size: 11px; font-weight: 600; color: var(--text2); cursor: pointer;
          background: rgba(245,166,35,.07); border: 1px solid rgba(245,166,35,.18);
          transition: .15s; text-decoration: none; letter-spacing: .02em;
        }
        .custom-dashboard .nav-btn:hover {
          background: rgba(245,166,35,.14); color: var(--gold);
          border-color: rgba(245,166,35,.4); transform: translateX(2px);
        }
        .custom-dashboard .nav-btn .nav-icon {
          width: 22px; height: 22px; border-radius: 6px;
          background: linear-gradient(135deg,var(--gold),#e07b00);
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; color: #000; flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .custom-dashboard { height: auto; overflow: visible; }
          .custom-dashboard .shell { grid-template-columns: 1fr; height: auto; }
          .custom-dashboard aside { border-right: none; border-bottom: 1px solid var(--border); }
          .custom-dashboard .years { max-height: 200px; }
          .custom-dashboard .cards-row { grid-template-columns: 1fr 1fr; }
          .custom-dashboard .mid-row { grid-template-columns: 1fr; }
          .custom-dashboard .bot-row { grid-template-columns: 1fr; }
          .custom-dashboard .content { padding: 16px; overflow-y: visible; }
          .custom-dashboard .topbar { flex-direction: column; align-items: flex-start; gap: 12px; }
          .custom-dashboard .topbar-right { flex-wrap: wrap; }
          .custom-dashboard .donut-pair { grid-template-columns: 1fr; gap: 16px; }
          .custom-dashboard .user-row { margin-top: 10px; }
        }
      ` }} />

      <div className="custom-dashboard">
        <div className="shell">
          <aside>
            <div className="logo block cursor-pointer transition-colors">
              <div className="logo-mark">C</div>
              <h2>Sistema Cajado</h2>
              <p>Dashboard Integrado</p>
            </div>

            {/* Botão Painel de Gestão */}
            <a href="/cajado" className="nav-btn">
              <div className="nav-icon">☰</div>
              <span>Painel de Gestão</span>
            </a>

            <PWAInstallButton className="nav-btn text-amber-400" />

            <div className="years">
              {ANOS.map(ano => (
                <React.Fragment key={ano}>
                  <div
                    className={`yr ${selectedYear === ano ? 'active' : ''}`}
                    onClick={() => setSelectedYear(ano)}
                  >
                    <span>{ano}</span>
                    <span className="yr-arrow">▼</span>
                  </div>
                  {selectedYear === ano && (
                    <div className="months-grid">
                      {MESES.map((mes, idx) => (
                        <div
                          key={mes}
                          className={`mo ${selectedMonth === idx ? 'active' : ''}`}
                          onClick={() => setSelectedMonth(idx)}
                        >
                          {mes}
                        </div>
                      ))}
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            <div className="user-row">
              <div className="avatar">M</div>
              <div className="user-info">
                <p>Maiara</p>
                <p>CEO · Cajado</p>
              </div>
              <button className="logout-btn" onClick={handleLogout}>Sair</button>
            </div>
          </aside>

          <main>
            <div className="topbar">
              <div className="topbar-left">
                <h1>Painel Integrado de Gestão</h1>
                <p>
                  {subtitleDate}
                  {activeTab !== 'visao' && (
                    <span style={{
                      marginLeft: '10px', fontSize: '10px', fontWeight: 600,
                      background: activeTab === 'competencia' ? 'rgba(124,92,252,.2)' : 'rgba(34,211,238,.15)',
                      color: activeTab === 'competencia' ? 'var(--purple2)' : 'var(--cyan)',
                      padding: '2px 8px', borderRadius: '20px', letterSpacing: '.04em'
                    }}>
                      {activeTab === 'competencia' ? 'Regime Competência' : 'Regime Caixa'}
                    </span>
                  )}
                </p>
              </div>
              <div className="topbar-right">
                <div
                  className={`tb-badge ${activeTab === 'visao' ? 'active' : ''}`}
                  onClick={() => setActiveTab('visao')}
                >Visão geral</div>
                <div
                  className={`tb-badge ${activeTab === 'competencia' ? 'active' : ''}`}
                  onClick={() => setActiveTab('competencia')}
                >Competência</div>
                <div
                  className={`tb-badge ${activeTab === 'caixa' ? 'active' : ''}`}
                  onClick={() => setActiveTab('caixa')}
                >Caixa</div>
                <button
                  className="tb-badge"
                  onClick={() => setModalLancamento(true)}
                  disabled={contas.length === 0}
                  style={{
                    background: 'linear-gradient(135deg,var(--gold),#e07b00)',
                    border: 'none', color: '#000', fontWeight: 600,
                    boxShadow: '0 2px 12px rgba(245,166,35,.3)', cursor: 'pointer'
                  }}
                >+ Lançamento</button>
              </div>
            </div>

            <div className="content">
              <div className="cards-row">
                <div className="metric-card" style={{ '--accent-glow': 'rgba(16,185,129,.15)' } as React.CSSProperties} onClick={() => setModalDetalhe('patrimonio')}>
                  <div className="mc-label">Patrimônio Líquido</div>
                  <div className="mc-value" style={{ color: 'var(--green)' }}>{formatCurrency(saldoTotal)}</div>
                  <div className="mc-change up">▲ Contas + Imóveis</div>
                  <div className="sparkline-wrap"><canvas id="sp1"></canvas></div>
                </div>
                <div className="metric-card" style={{ '--accent-glow': 'rgba(124,92,252,.12)' } as React.CSSProperties} onClick={() => setModalDetalhe('receitas')}>
                  <div className="mc-label">Receitas Recebidas</div>
                  <div className="mc-value" style={{ color: 'var(--purple2)' }}>{formatCurrency(receitas)}</div>
                  <div className="mc-change up">▲ {lancamentos.filter((l: any) => l.tipo === 'receita').length} entrada(s)</div>
                  <div className="sparkline-wrap"><canvas id="sp2"></canvas></div>
                </div>
                <div className="metric-card" style={{ '--accent-glow': 'rgba(244,63,94,.1)' } as React.CSSProperties} onClick={() => setModalDetalhe('despesas')}>
                  <div className="mc-label">Despesas Efetivadas</div>
                  <div className="mc-value" style={{ color: 'var(--red)' }}>{formatCurrency(despesas)}</div>
                  <div className="mc-change down">▼ {lancamentos.filter((l: any) => l.tipo === 'despesa').length} saída(s)</div>
                  <div className="sparkline-wrap"><canvas id="sp3"></canvas></div>
                </div>
                <div className="metric-card" style={{ '--accent-glow': 'rgba(245,166,35,.1)' } as React.CSSProperties} onClick={() => setModalDetalhe('leads')}>
                  <div className="mc-label">Leads e Win Rate</div>
                  <div className="mc-value" style={{ color: 'var(--gold)' }}>{leadsAtivos} Leads</div>
                  <div className="mc-change up">▲ {winRateTrader}% acerto (Trader)</div>
                  <div className="sparkline-wrap"><canvas id="sp4"></canvas></div>
                </div>
              </div>

              <div className="mid-row">
                <div className="card">
                  <div className="card-title">
                    Balanço Financeiro Global
                    <span>Receitas · Despesas no Ano</span>
                  </div>
                  <div className="legend">
                    <div className="leg-item"><div className="leg-dot" style={{ background: 'var(--purple)' }}></div>Receitas</div>
                    <div className="leg-item"><div className="leg-dot" style={{ background: 'var(--pink)' }}></div>Despesas</div>
                  </div>
                  <div style={{ height: '140px' }}><canvas id="barChart"></canvas></div>
                </div>

                <div className="donut-pair">
                  <div className="donut-card">
                    <div className="card-title">Despesas do Mês</div>
                    <div className="donut-center" style={{ width: '90px', height: '90px' }}>
                      <canvas id="d1"></canvas>
                      <div className="donut-inner">
                        <div className="donut-pct" style={{ color: 'var(--gold)' }}>
                          {(totalDespMes > 0 ? (((topCatsMes[0]?.[1] as number) / totalDespMes) * 100).toFixed(0) : 0)}%
                        </div>
                        <div className="donut-sub">{topCatsMes[0]?.[0]}</div>
                      </div>
                    </div>
                    <div className="donut-legend">
                      {topCatsMes.map((cat, i) => {
                        const pct = totalDespMes > 0 ? ((cat[1] as number) / totalDespMes) * 100 : 0
                        if (pct === 0) return null
                        return (
                          <div className="dl-item" key={'m' + i}>
                            <div className="dl-dot" style={{ background: dColors[i] }}></div>
                            <span className="dl-name">{cat[0] as string}</span>
                            <span className="dl-pct">{pct.toFixed(1).replace('.0', '')}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className="donut-card">
                    <div className="card-title">Despesas no Ano</div>
                    <div className="donut-center" style={{ width: '90px', height: '90px' }}>
                      <canvas id="d2"></canvas>
                      <div className="donut-inner">
                        <div className="donut-pct" style={{ color: 'var(--purple2)' }}>
                          {(totalDespAno > 0 ? (((topCatsAno[0]?.[1] as number) / totalDespAno) * 100).toFixed(0) : 0)}%
                        </div>
                        <div className="donut-sub">{topCatsAno[0]?.[0]}</div>
                      </div>
                    </div>
                    <div className="donut-legend">
                      {topCatsAno.map((cat, i) => {
                        const pct = totalDespAno > 0 ? ((cat[1] as number) / totalDespAno) * 100 : 0
                        if (pct === 0) return null
                        return (
                          <div className="dl-item" key={'a' + i}>
                            <div className="dl-dot" style={{ background: dColors[i] }}></div>
                            <span className="dl-name">{cat[0] as string}</span>
                            <span className="dl-pct">{pct.toFixed(0)}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bot-row">
                <div className="card">
                  <div className="card-title">
                    Detalhamento de Despesas
                    <span style={{ background: 'rgba(124,92,252,.15)', color: 'var(--purple2)', padding: '3px 10px', borderRadius: '20px', fontSize: '10px', fontFamily: "'DM Sans'" }}>Mês Vigente</span>
                  </div>
                  <div className="bar-list">
                    {topCatsMes.filter(c => (c[1] as number) > 0).map((cat, i) => {
                      const val = cat[1] as number
                      let pct = totalDespMes > 0 ? (val / totalDespMes) * 100 : 0
                      if (pct < 5 && val > 0) pct = 5 // minimum visibility

                      const barGradients = [
                        'linear-gradient(90deg,var(--purple),var(--purple2))',
                        'linear-gradient(90deg,var(--cyan),#0ea5e9)',
                        'linear-gradient(90deg,var(--pink),#ec4899)',
                        'linear-gradient(90deg,var(--gold),#d97706)',
                        'linear-gradient(90deg,var(--green),#059669)'
                      ]

                      return (
                        <div className="bar-item" key={i}>
                          <span className="bar-name">{cat[0] as string}</span>
                          <div className="bar-track"><div className="bar-fill" style={{ width: `${pct}%`, background: barGradients[i % barGradients.length] }}></div></div>
                          <span className="bar-val">R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )
                    })}
                    {totalDespMes === 0 && <div className="text-xs text-fg-tertiary mt-4">Nenhuma despesa para este mês.</div>}
                  </div>

                  <div className="card-title" style={{ marginTop: '16px', marginBottom: '6px' }}>Participação anual</div>
                  <div className="rings-row">
                    {topCatsAno.map((cat, idx) => {
                      const pct = totalDespAno > 0 ? ((cat[1] as number) / totalDespAno) * 100 : 0
                      return (
                        <div className="ring-item" key={'ring' + idx}>
                          <div style={{ position: 'relative', width: '46px', height: '46px' }}>
                            <canvas id={`r${idx + 1}`}></canvas>
                            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ fontFamily: 'Syne', fontSize: '11px', fontWeight: 700, color: pct > 0 ? 'var(--text1)' : 'var(--text3)' }}>
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                          </div>
                          <div className="ring-label" style={{ whiteSpace: 'nowrap', maxWidth: '50px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cat[0] as string}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="card">
                  <div className="card-title">
                    Receitas e Despesas Consolidadas
                    <span>Sincronizado via Supabase</span>
                  </div>
                  <div className="legend">
                    <div className="leg-item"><div className="leg-dot" style={{ background: 'var(--purple)' }}></div>Receitas</div>
                    <div className="leg-item"><div className="leg-dot" style={{ background: 'var(--pink)' }}></div>Despesas</div>
                  </div>
                  <div style={{ height: '190px' }}><canvas id="lineChart"></canvas></div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      </div>{/* fim empresa wrapper */}

      {/* ── Drawer detalhe dos cards ─────────────────────── */}
      {modalDetalhe && (() => {
        const receitasList = lancamentosDoMes.filter((l: any) => l.tipo === 'receita').sort((a: any, b: any) => b.valor - a.valor)
        const despesasList = lancamentosDoMes.filter((l: any) => l.tipo === 'despesa').sort((a: any, b: any) => b.valor - a.valor)
        const config: Record<string, { title: string; total: string; subtitle: string; items: { label: string; value: string; color: string; badge: string }[] }> = {
          patrimonio: {
            title: '💰 Patrimônio Líquido', total: formatCurrency(saldoTotal),
            subtitle: `${contas.length} conta(s) ativa(s)`,
            items: [
              ...contas.map((c: any) => ({ label: c.nome, value: formatCurrency(c.saldo_atual ?? 0), color: (c.saldo_atual ?? 0) >= 0 ? '#10b981' : '#f43f5e', badge: c.tipo })),
              ...ativos.map((a: any) => ({ label: a.nome || 'Ativo', value: formatCurrency(a.valor_atual ?? a.valor_investido), color: '#a78bfa', badge: 'investimento' })),
            ]
          },
          receitas: {
            title: '📈 Receitas Recebidas', total: formatCurrency(receitas),
            subtitle: `${receitasList.length} entrada(s) em ${mesNome}`,
            items: receitasList.map((l: any) => ({ label: l.descricao, value: '+' + formatCurrency(l.valor), color: '#10b981', badge: l.data_competencia?.slice(0, 10) ?? '' }))
          },
          despesas: {
            title: '📉 Despesas Efetivadas', total: formatCurrency(despesas),
            subtitle: `${despesasList.length} saída(s) em ${mesNome}`,
            items: despesasList.map((l: any) => ({ label: l.descricao, value: '-' + formatCurrency(l.valor), color: '#f43f5e', badge: l.data_competencia?.slice(0, 10) ?? '' }))
          },
          leads: {
            title: '🤝 Leads & CRM', total: `${leadsAtivos} leads ativos`,
            subtitle: `Win rate trader: ${winRateTrader}%`,
            items: leads.map((l: any) => ({ label: l.nome, value: l.valor_estimado ? formatCurrency(l.valor_estimado) : '—', color: l.status === 'cliente_ativo' ? '#10b981' : l.status === 'perdido' ? '#f43f5e' : '#f5a623', badge: (l.status ?? '').replace('_', ' ') }))
          }
        }
        const cfg = config[modalDetalhe]
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'flex-end' }} onClick={() => setModalDetalhe(null)}>
            <style>{`@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
            <div style={{ width: '380px', maxWidth: '92vw', height: '100vh', background: 'linear-gradient(180deg,#0d1120,#111827)', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)', animation: 'slideInRight 0.28s ease-out' }} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', position: 'relative', flexShrink: 0 }}>
                <div style={{ height: '1px', background: 'linear-gradient(90deg,transparent,#f5a623,transparent)', position: 'absolute', top: 0, left: 0, right: 0 }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div>
                    <p style={{ fontFamily: 'Syne,sans-serif', fontSize: '15px', fontWeight: 700, color: '#f0f4ff', margin: 0 }}>{cfg.title}</p>
                    <p style={{ fontSize: '11px', color: '#4a5578', marginTop: '2px' }}>{cfg.subtitle}</p>
                  </div>
                  <button onClick={() => setModalDetalhe(null)} style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#8b98b8', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(245,166,35,0.08)', border: '1px solid rgba(245,166,35,0.15)' }}>
                  <p style={{ fontSize: '10px', color: '#8b98b8', margin: '0 0 2px' }}>TOTAL</p>
                  <p style={{ fontFamily: 'Syne,sans-serif', fontSize: '22px', fontWeight: 700, color: '#f5a623', margin: 0 }}>{cfg.total}</p>
                </div>
              </div>
              {/* Lista */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '10px 20px' }}>
                {cfg.items.length === 0
                  ? <p style={{ color: '#4a5578', fontSize: '13px', textAlign: 'center', marginTop: '40px' }}>Nenhum dado para este período.</p>
                  : cfg.items.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '13px', color: '#c8d2ea', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>{item.label}</p>
                        <span style={{ fontSize: '9px', fontWeight: 600, padding: '1px 6px', borderRadius: '20px', background: 'rgba(255,255,255,0.06)', color: '#4a5578', marginTop: '3px', display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.badge}</span>
                      </div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: item.color, marginLeft: '8px', whiteSpace: 'nowrap', flexShrink: 0 }}>{item.value}</p>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )
      })()}

      {modalLancamento && contas.length > 0 && (
        <ModalLancamento
          onClose={() => setModalLancamento(false)}
          onSave={handleRefresh}
          contas={contas}
          categorias={categorias}
        />
      )}
    </>
  )
}
