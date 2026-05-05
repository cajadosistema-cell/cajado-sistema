'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

// ── Tipos ─────────────────────────────────────────────────────
export type LimiteOrcamento = {
  id: string
  nome: string
  categoria: string
  tipo: 'pf' | 'pj'
  limite_mensal: number
  cor: string
  ativo: boolean
}

export type LimiteComGasto = LimiteOrcamento & {
  gasto_atual: number
  percentual: number  // 0-100+
  status: 'ok' | 'atencao' | 'critico'  // <70% | 70-90% | >90%
}

// ── Barra de progresso colorida ────────────────────────────────
export function BarraLimite({
  gasto, limite, nome, cor, showValues = true, compact = false
}: {
  gasto: number; limite: number; nome: string; cor?: string; showValues?: boolean; compact?: boolean
}) {
  const pct = limite > 0 ? Math.min((gasto / limite) * 100, 100) : 0
  const overflow = limite > 0 ? Math.max(((gasto - limite) / limite) * 100, 0) : 0

  const barColor =
    pct >= 90 ? 'from-red-500 to-red-400' :
    pct >= 70 ? 'from-amber-500 to-yellow-400' :
    'from-emerald-500 to-emerald-400'

  const textColor =
    pct >= 90 ? 'text-red-400' :
    pct >= 70 ? 'text-amber-400' :
    'text-emerald-400'

  const status =
    pct >= 90 ? '🔴' :
    pct >= 70 ? '🟡' :
    '🟢'

  return (
    <div className={compact ? 'space-y-1' : 'space-y-2'}>
      <div className="flex items-center justify-between">
        <span className={`${compact ? 'text-[11px]' : 'text-xs'} font-medium text-fg flex items-center gap-1.5`}>
          {status} {nome}
        </span>
        {showValues && (
          <div className="text-right">
            <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-semibold ${textColor}`}>
              {formatCurrency(gasto)}
            </span>
            <span className={`${compact ? 'text-[9px]' : 'text-[10px]'} text-fg-disabled`}>
              {' '}/ {formatCurrency(limite)}
            </span>
          </div>
        )}
      </div>

      {/* Track */}
      <div className="relative h-2.5 bg-muted rounded-full overflow-hidden">
        {/* Barra principal */}
        <div
          className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-700`}
          style={{ width: `${pct}%` }}
        />
        {/* Pulso quando crítico */}
        {pct >= 90 && (
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-red-500/30 animate-pulse"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>

      {/* Overflow warning */}
      {overflow > 0 && (
        <p className="text-[10px] text-red-400 font-medium">
          ⚠️ Limite ultrapassado em {formatCurrency(gasto - limite)} ({overflow.toFixed(0)}%)
        </p>
      )}

      {!compact && (
        <p className={`text-[10px] ${textColor}`}>
          {pct.toFixed(0)}% utilizado · Restam {formatCurrency(Math.max(limite - gasto, 0))}
        </p>
      )}
    </div>
  )
}

// ── Popup de alerta ao abrir o sistema ─────────────────────────
export function BudgetAlertBanner() {
  const supabase = createClient()
  const [alertas, setAlertas] = useState<LimiteComGasto[]>([])
  const [visivel, setVisivel] = useState(false)
  const [minimizado, setMinimizado] = useState(false)

  const verificarLimites = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: limites } = await (supabase
      .from('limites_orcamento') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('ativo', true)

    if (!limites || limites.length === 0) return

    const mesAtual = new Date().toISOString().substring(0, 7)

    // Busca gastos PF do mês
    const { data: gastosPF } = await supabase
      .from('gastos_pessoais')
      .select('categoria, valor')
      .eq('user_id', user.id)
      .gte('data', `${mesAtual}-01`)

    // Busca despesas PJ do mês (lançamentos)
    const { data: gastosPJ } = await (supabase
      .from('lancamentos') as any)
      .select('valor')
      .eq('tipo', 'despesa')
      .gte('data_competencia', `${mesAtual}-01`)

    const totalPFGasto = (gastosPF || []).reduce((a: number, g: any) => a + Number(g.valor), 0)
    const totalPJGasto = (gastosPJ || []).reduce((a: number, g: any) => a + Number(g.valor), 0)

    const limitesComGasto: LimiteComGasto[] = limites.map((l: LimiteOrcamento) => {
      const gasto = l.tipo === 'pf' ? totalPFGasto : totalPJGasto
      const percentual = l.limite_mensal > 0 ? (gasto / l.limite_mensal) * 100 : 0
      return {
        ...l,
        gasto_atual: gasto,
        percentual,
        status: percentual >= 90 ? 'critico' : percentual >= 70 ? 'atencao' : 'ok',
      }
    })

    // Mostra apenas os que estão em atenção ou crítico
    const emAlerta = limitesComGasto.filter(l => l.status !== 'ok')
    if (emAlerta.length > 0) {
      setAlertas(emAlerta)
      // Só mostra uma vez por sessão
      const jaViu = sessionStorage.getItem('cajado_budget_alert')
      if (!jaViu) {
        sessionStorage.setItem('cajado_budget_alert', '1')
        setTimeout(() => setVisivel(true), 2000) // atraso para não sustar na carga
      }
    }
  }, [supabase])

  useEffect(() => {
    verificarLimites()
  }, [verificarLimites])

  if (!visivel || alertas.length === 0) return null

  const temCritico = alertas.some(a => a.status === 'critico')

  return (
    <div className="fixed bottom-24 right-5 z-[200] max-w-sm w-full">
      {/* Sombra pulsante ao redor do card quando crítico */}
      {temCritico && (
        <div className="absolute inset-0 rounded-2xl bg-red-500/20 animate-ping" style={{ animationDuration: '2s' }} />
      )}

      <div className={`relative rounded-2xl border shadow-2xl overflow-hidden transition-all duration-300 ${
        temCritico
          ? 'bg-[#0d0505] border-red-500/40'
          : 'bg-[#0a0d05] border-amber-500/30'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-4 py-3 border-b ${
          temCritico ? 'border-red-500/20 bg-red-500/10' : 'border-amber-500/20 bg-amber-500/8'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`text-lg ${temCritico ? 'animate-bounce' : ''}`}>
              {temCritico ? '🚨' : '⚠️'}
            </span>
            <div>
              <p className={`text-xs font-bold ${temCritico ? 'text-red-400' : 'text-amber-400'}`}>
                {temCritico ? 'Limite Crítico Atingido!' : 'Atenção: Limite de Orçamento'}
              </p>
              <p className="text-[10px] text-fg-disabled">
                {alertas.length} limite(s) com alerta este mês
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setMinimizado(!minimizado)}
              className="text-fg-disabled hover:text-fg text-xs px-2 py-1 rounded"
            >
              {minimizado ? '▲' : '▼'}
            </button>
            <button
              onClick={() => setVisivel(false)}
              className="text-fg-disabled hover:text-fg text-base leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Barras de limite */}
        {!minimizado && (
          <div className="p-4 space-y-4">
            {alertas.map(a => (
              <BarraLimite
                key={a.id}
                gasto={a.gasto_atual}
                limite={a.limite_mensal}
                nome={a.nome}
                cor={a.cor}
                compact
              />
            ))}
            <p className="text-[10px] text-fg-disabled text-center pt-1">
              Configure os limites em <span className="text-amber-400">Configurações → Orçamento</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Painel de configuração de limites ──────────────────────────
export function PainelLimitesOrcamento({ tipo }: { tipo: 'pf' | 'pj' }) {
  const supabase = createClient()
  const [limites, setLimites] = useState<LimiteOrcamento[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ nome: '', limite_mensal: '', cor: '#10B981' })
  const [salvando, setSalvando] = useState(false)

  const CORES = ['#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#06B6D4']

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await (supabase
      .from('limites_orcamento') as any)
      .select('*')
      .eq('user_id', user.id)
      .eq('tipo', tipo)
      .eq('ativo', true)
      .order('created_at')
    setLimites(data || [])
    setLoading(false)
  }, [supabase, tipo])

  useEffect(() => { carregar() }, [carregar])

  const salvar = async () => {
    if (!form.nome || !form.limite_mensal) return
    setSalvando(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await (supabase.from('limites_orcamento') as any).insert({
      user_id: user.id,
      nome: form.nome,
      categoria: form.nome.toLowerCase().replace(/\s+/g, '_'),
      tipo,
      limite_mensal: parseFloat(form.limite_mensal.replace(',', '.')),
      cor: form.cor,
    })
    setForm({ nome: '', limite_mensal: '', cor: '#10B981' })
    setShowForm(false)
    setSalvando(false)
    carregar()
  }

  const excluir = async (id: string) => {
    if (!confirm('Remover este limite?')) return
    await (supabase.from('limites_orcamento') as any).update({ ativo: false }).eq('id', id)
    carregar()
  }

  if (loading) return <p className="text-xs text-fg-tertiary py-4 text-center">Carregando...</p>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-fg">
            🎯 Limites de Orçamento {tipo.toUpperCase()}
          </h3>
          <p className="text-xs text-fg-tertiary mt-0.5">
            Defina metas mensais e receba alertas ao se aproximar
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary text-xs">
          + Novo Limite
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border-subtle">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nome do limite *</label>
              <input
                className="input text-xs mt-1"
                placeholder={tipo === 'pf' ? 'Ex: Pró-labore, Alimentação' : 'Ex: Operacional, Folha'}
                value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Valor mensal (R$) *</label>
              <input
                className="input text-xs mt-1"
                type="number" min="0" step="100"
                placeholder="Ex: 5000"
                value={form.limite_mensal}
                onChange={e => setForm(f => ({ ...f, limite_mensal: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label className="label">Cor</label>
            <div className="flex gap-2 mt-1">
              {CORES.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, cor: c }))}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${form.cor === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowForm(false)} className="btn-secondary text-xs">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="btn-primary text-xs">
              {salvando ? 'Salvando...' : '✓ Criar Limite'}
            </button>
          </div>
        </div>
      )}

      {/* Lista */}
      {limites.length === 0 ? (
        <div className="text-center py-8 bg-muted/30 rounded-xl border border-border-subtle">
          <p className="text-2xl mb-2">🎯</p>
          <p className="text-sm font-medium text-fg-secondary">Nenhum limite configurado</p>
          <p className="text-xs text-fg-tertiary mt-1">Crie um limite para receber alertas ao gastar demais</p>
        </div>
      ) : (
        <div className="space-y-3">
          {limites.map(l => (
            <div key={l.id} className="bg-surface border border-border-subtle rounded-xl p-4 group relative">
              <button
                onClick={() => excluir(l.id)}
                className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-fg-disabled hover:text-red-400 text-xs transition-opacity"
              >
                ✕
              </button>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ background: l.cor }} />
                <span className="text-xs font-semibold text-fg">{l.nome}</span>
                <span className="text-[10px] text-fg-tertiary ml-auto pr-6">
                  Limite: {formatCurrency(l.limite_mensal)}/mês
                </span>
              </div>
              <LimiteBarraComDados limite={l} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Barra com dados reais do banco ─────────────────────────────
function LimiteBarraComDados({ limite }: { limite: LimiteOrcamento }) {
  const supabase = createClient()
  const [gasto, setGasto] = useState(0)
  const [carregou, setCarregou] = useState(false)
  const mesAtual = new Date().toISOString().substring(0, 7)

  useEffect(() => {
    const buscar = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let total = 0
      if (limite.tipo === 'pf') {
        const { data } = await supabase
          .from('gastos_pessoais')
          .select('valor')
          .eq('user_id', user.id)
          .gte('data', `${mesAtual}-01`)
        total = (data || []).reduce((a, g) => a + Number(g.valor), 0)
      } else {
        const { data } = await (supabase.from('lancamentos') as any)
          .select('valor')
          .eq('tipo', 'despesa')
          .gte('data_competencia', `${mesAtual}-01`)
        total = (data || []).reduce((a: number, g: any) => a + Number(g.valor), 0)
      }
      setGasto(total)
      setCarregou(true)
    }
    buscar()
  }, [limite, mesAtual, supabase])

  if (!carregou) return <div className="h-2.5 bg-muted rounded-full animate-pulse" />

  return (
    <BarraLimite
      gasto={gasto}
      limite={limite.limite_mensal}
      nome=""
      cor={limite.cor}
      showValues
    />
  )
}
