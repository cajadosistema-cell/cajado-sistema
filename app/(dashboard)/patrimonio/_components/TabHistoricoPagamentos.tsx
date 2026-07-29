'use client'

import { useState, useMemo, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresaId } from '@/lib/hooks/useEmpresaId'
import { formatCurrency, cn } from '@/lib/utils'
import { EmptyState } from '@/components/shared/ui'
import { ChevronDown, ChevronUp, Calendar, Search } from 'lucide-react'

// ── Tipos ────────────────────────────────────────────────────
type PagamentoUnificado = {
  id: string
  tipo: 'imovel' | 'veiculo' | 'cartao'
  nome: string
  mes_referencia: string
  valor_pago: number
  data_pagamento: string | null
  conta_nome: string | null
  status: string
}

type MesAgrupado = {
  mes: string          // "2026-07"
  label: string        // "Julho 2026"
  itens: PagamentoUnificado[]
  total: number
}

const TIPO_CONFIG = {
  imovel:  { icon: '🏠', label: 'Imóvel',  color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  veiculo: { icon: '🚗', label: 'Veículo', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  cartao:  { icon: '💳', label: 'Cartão',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
}

const MESES_NOME: Record<string, string> = {
  '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
  '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
  '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro',
}

function mesLabel(mes: string): string {
  const [ano, m] = mes.split('-')
  return `${MESES_NOME[m] || m} ${ano}`
}

// ── Componente Principal ─────────────────────────────────────
export function TabHistoricoPagamentos() {
  const supabase = createClient()
  const { empresaId, loading: loadingEmpresa } = useEmpresaId()

  const [pagamentos, setPagamentos] = useState<PagamentoUnificado[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<'todos' | 'imovel' | 'veiculo' | 'cartao'>('todos')
  const [busca, setBusca] = useState('')
  const [mesesAbertos, setMesesAbertos] = useState<Set<string>>(new Set())

  // ── Fetch de dados ─────────────────────────────────────────
  useEffect(() => {
    if (loadingEmpresa) return
    const carregar = async () => {
      setLoading(true)
      try {
        const resultado: PagamentoUnificado[] = []

        // 1. Pagamentos de imóveis
        let qIm = (supabase.from('pagamentos_imoveis') as any)
          .select('id, imovel_id, mes_referencia, status, valor_pago, data_pagamento, conta_origem_id, imoveis(titulo), contas(nome)')
          .eq('status', 'pago')
          .order('mes_referencia', { ascending: false })
          .limit(200)
        if (empresaId) qIm = qIm.eq('empresa_id', empresaId)
        const { data: imPagos } = await qIm
        for (const p of (imPagos || [])) {
          resultado.push({
            id: p.id,
            tipo: 'imovel',
            nome: p.imoveis?.titulo || 'Imóvel sem nome',
            mes_referencia: p.mes_referencia,
            valor_pago: Number(p.valor_pago) || 0,
            data_pagamento: p.data_pagamento,
            conta_nome: p.contas?.nome || null,
            status: p.status,
          })
        }

        // 2. Pagamentos de veículos
        let qVe = (supabase.from('pagamentos_veiculos') as any)
          .select('id, veiculo_id, mes_referencia, status, valor_pago, data_pagamento, conta_origem_id, veiculos(titulo, marca, modelo), contas(nome)')
          .eq('status', 'pago')
          .order('mes_referencia', { ascending: false })
          .limit(200)
        if (empresaId) qVe = qVe.eq('empresa_id', empresaId)
        const { data: vePagos } = await qVe
        for (const p of (vePagos || [])) {
          const v = p.veiculos
          const nome = v?.titulo || `${v?.marca || ''} ${v?.modelo || ''}`.trim() || 'Veículo sem nome'
          resultado.push({
            id: p.id,
            tipo: 'veiculo',
            nome,
            mes_referencia: p.mes_referencia,
            valor_pago: Number(p.valor_pago) || 0,
            data_pagamento: p.data_pagamento,
            conta_nome: p.contas?.nome || null,
            status: p.status,
          })
        }

        // 3. Faturas de cartões pagas
        const { data: fatPagas } = await (supabase.from('faturas_cartoes') as any)
          .select('id, conta_id, mes_referencia, status, valor_fechado, data_pagamento, conta_pagamento_id, contas!faturas_cartoes_conta_id_fkey(nome)')
          .eq('status', 'pago')
          .order('mes_referencia', { ascending: false })
          .limit(200)
        for (const f of (fatPagas || [])) {
          resultado.push({
            id: f.id,
            tipo: 'cartao',
            nome: f.contas?.nome || 'Cartão sem nome',
            mes_referencia: f.mes_referencia,
            valor_pago: Number(f.valor_fechado) || 0,
            data_pagamento: f.data_pagamento ? String(f.data_pagamento).substring(0, 10) : null,
            conta_nome: null, // faturas não gravam conta de origem diretamente
            status: f.status,
          })
        }

        setPagamentos(resultado)

        // Abre os 2 primeiros meses por padrão
        const mesesUnicos = [...new Set(resultado.map(r => r.mes_referencia))].sort().reverse()
        setMesesAbertos(new Set(mesesUnicos.slice(0, 2)))

      } catch (err) {
        console.error('[TabHistorico] Erro ao carregar pagamentos:', err)
      } finally {
        setLoading(false)
      }
    }
    carregar()

    // Recarrega quando Elena salvar algo
    const handler = () => carregar()
    window.addEventListener('elena:lancamento-salvo', handler)
    return () => window.removeEventListener('elena:lancamento-salvo', handler)
  }, [empresaId, loadingEmpresa]) // eslint-disable-line

  // ── Filtro + Agrupamento ───────────────────────────────────
  const mesesAgrupados = useMemo<MesAgrupado[]>(() => {
    let filtrados = pagamentos
    if (filtroTipo !== 'todos') filtrados = filtrados.filter(p => p.tipo === filtroTipo)
    if (busca.trim()) {
      const b = busca.toLowerCase().trim()
      filtrados = filtrados.filter(p =>
        p.nome.toLowerCase().includes(b) ||
        (p.conta_nome && p.conta_nome.toLowerCase().includes(b))
      )
    }

    const mapa = new Map<string, PagamentoUnificado[]>()
    for (const p of filtrados) {
      const arr = mapa.get(p.mes_referencia) || []
      arr.push(p)
      mapa.set(p.mes_referencia, arr)
    }

    return [...mapa.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, itens]) => ({
        mes,
        label: mesLabel(mes),
        itens: itens.sort((a, b) => (b.data_pagamento || '').localeCompare(a.data_pagamento || '')),
        total: itens.reduce((sum, p) => sum + p.valor_pago, 0),
      }))
  }, [pagamentos, filtroTipo, busca])

  const totalGeral = mesesAgrupados.reduce((s, m) => s + m.total, 0)
  const totalItens = mesesAgrupados.reduce((s, m) => s + m.itens.length, 0)

  const toggleMes = (mes: string) => {
    setMesesAbertos(prev => {
      const next = new Set(prev)
      if (next.has(mes)) next.delete(mes)
      else next.add(mes)
      return next
    })
  }

  // ── Render ─────────────────────────────────────────────────
  if (loading || loadingEmpresa) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* ── Cabeçalho com totalizadores ──────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-surface border border-border-subtle rounded-xl p-3">
          <p className="text-[10px] text-fg-disabled uppercase tracking-wide">📋 Total pago</p>
          <p className="text-lg font-bold text-fg mt-0.5">{formatCurrency(totalGeral)}</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-3">
          <p className="text-[10px] text-fg-disabled uppercase tracking-wide">📊 Parcelas/Faturas</p>
          <p className="text-lg font-bold text-fg mt-0.5">{totalItens}</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-3">
          <p className="text-[10px] text-fg-disabled uppercase tracking-wide">📅 Meses</p>
          <p className="text-lg font-bold text-fg mt-0.5">{mesesAgrupados.length}</p>
        </div>
        <div className="bg-surface border border-border-subtle rounded-xl p-3">
          <p className="text-[10px] text-fg-disabled uppercase tracking-wide">💰 Média/mês</p>
          <p className="text-lg font-bold text-fg mt-0.5">
            {mesesAgrupados.length > 0 ? formatCurrency(totalGeral / mesesAgrupados.length) : '—'}
          </p>
        </div>
      </div>

      {/* ── Filtros ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Filtro por tipo */}
        <div className="flex gap-1">
          {([
            { key: 'todos', label: 'Todos', icon: '📋' },
            { key: 'imovel', label: 'Imóveis', icon: '🏠' },
            { key: 'veiculo', label: 'Veículos', icon: '🚗' },
            { key: 'cartao', label: 'Cartões', icon: '💳' },
          ] as const).map(f => (
            <button
              key={f.key}
              onClick={() => setFiltroTipo(f.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                filtroTipo === f.key
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : 'text-fg-tertiary border-border-subtle hover:text-fg-secondary bg-page'
              )}
            >
              {f.icon} <span className="hidden sm:inline">{f.label}</span>
            </button>
          ))}
        </div>

        {/* Busca */}
        <div className="relative flex-1 min-w-[140px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-fg-disabled" />
          <input
            type="text"
            placeholder="Buscar por nome..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-surface border border-border-subtle rounded-lg text-fg placeholder:text-fg-disabled focus:outline-none focus:border-blue-500/50"
          />
        </div>
      </div>

      {/* ── Timeline por mês ────────────────────────────────── */}
      {mesesAgrupados.length === 0 ? (
        <EmptyState
          message={filtroTipo !== 'todos' || busca ? '📋 Nenhum pagamento encontrado — tente ajustar os filtros.' : '📋 Nenhum pagamento registrado ainda. Quando parcelas e faturas forem pagas, o histórico aparecerá aqui.'}
        />
      ) : (
        <div className="space-y-3">
          {mesesAgrupados.map(grupo => {
            const aberto = mesesAbertos.has(grupo.mes)
            return (
              <div key={grupo.mes} className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
                {/* Header do mês (clicável) */}
                <button
                  onClick={() => toggleMes(grupo.mes)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-fg">{grupo.label}</p>
                      <p className="text-[10px] text-fg-tertiary">
                        {grupo.itens.length} pagamento{grupo.itens.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-emerald-400">{formatCurrency(grupo.total)}</span>
                    {aberto
                      ? <ChevronUp className="w-4 h-4 text-fg-tertiary" />
                      : <ChevronDown className="w-4 h-4 text-fg-tertiary" />
                    }
                  </div>
                </button>

                {/* Lista de pagamentos */}
                {aberto && (
                  <div className="border-t border-border-subtle divide-y divide-border-subtle">
                    {grupo.itens.map(p => {
                      const cfg = TIPO_CONFIG[p.tipo]
                      const dataFmt = p.data_pagamento
                        ? new Date(p.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        : '—'
                      return (
                        <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                          {/* Ícone do tipo */}
                          <div className={cn('shrink-0 w-8 h-8 rounded-lg border flex items-center justify-center text-sm', cfg.color)}>
                            {cfg.icon}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-fg truncate">{p.nome}</p>
                            <div className="flex items-center gap-2 text-[10px] text-fg-tertiary">
                              <span className={cn('px-1.5 py-0.5 rounded border text-[9px] font-medium', cfg.color)}>
                                {cfg.label}
                              </span>
                              <span>📅 {dataFmt}</span>
                              {p.conta_nome && <span>🏦 {p.conta_nome}</span>}
                            </div>
                          </div>

                          {/* Valor */}
                          <div className="shrink-0 text-right">
                            <p className="text-sm font-bold text-fg">{formatCurrency(p.valor_pago)}</p>
                            <p className="text-[10px] text-emerald-400">✅ Pago</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
