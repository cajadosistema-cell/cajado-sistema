'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronUp, ArrowRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

// ── Tipagem isolada ────────────────────────────────────────────
type Recorrencia = {
  id: string
  descricao: string
  valor: number
  dia_vencimento: number | null
  frequencia: string
  ativo: boolean
  tipo: string
}

// ── Helpers ────────────────────────────────────────────────────
const LS_KEY = 'cajado_vencimentos_pagos'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getTodayDay() {
  return new Date().getDate()
}

function getStatusVencimento(dia: number | null): 'vencido' | 'urgente' | 'normal' {
  if (!dia) return 'normal'
  const hoje = getTodayDay()
  if (dia < hoje) return 'vencido'
  if (dia - hoje <= 3) return 'urgente'
  return 'normal'
}

// Lê os IDs pagos do localStorage para o mês atual
function lerPagosMes(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    const obj = JSON.parse(raw)
    const mesAtual = new Date().toISOString().substring(0, 7) // YYYY-MM
    return new Set<string>(obj[mesAtual] ?? [])
  } catch {
    return new Set()
  }
}

// Salva IDs pagos no localStorage para o mês atual
function salvarPagosMes(ids: Set<string>) {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const obj = raw ? JSON.parse(raw) : {}
    const mesAtual = new Date().toISOString().substring(0, 7)
    obj[mesAtual] = [...ids]
    localStorage.setItem(LS_KEY, JSON.stringify(obj))
  } catch {
    // silencioso — localStorage pode estar indisponível (SSR)
  }
}

// ── Componente ─────────────────────────────────────────────────
export function VencimentosMes({ onVerDetalhes }: { onVerDetalhes?: () => void }) {
  const [recorrencias, setRecorrencias] = useState<Recorrencia[]>([])
  const [loading, setLoading] = useState(true)
  const [pagos, setPagos] = useState<Set<string>>(new Set())
  const [colapsado, setColapsado] = useState(false)

  // ── Query isolada — não toca em nenhuma query existente ──────
  const fetchRecorrencias = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await (supabase as any)
        .from('recorrencias')
        .select('id, descricao, valor, dia_vencimento, frequencia, ativo, tipo')
        .eq('tipo', 'despesa')
        .eq('ativo', true)
        .order('dia_vencimento', { ascending: true })

      if (!error && data) {
        setRecorrencias(data as Recorrencia[])
      }
    } catch {
      // falha silenciosa — widget não é crítico
    } finally {
      setLoading(false)
    }
  }, [])

  // Hidrata o estado dos pagos do localStorage (client-only)
  useEffect(() => {
    fetchRecorrencias()
    setPagos(lerPagosMes())
  }, [fetchRecorrencias])

  // ── Handlers ─────────────────────────────────────────────────
  const togglePago = (id: string) => {
    setPagos(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      salvarPagosMes(next)
      return next
    })
  }

  // ── Métricas ─────────────────────────────────────────────────
  const totalMes = recorrencias.reduce((a, r) => a + r.valor, 0)
  const totalPago = recorrencias
    .filter(r => pagos.has(r.id))
    .reduce((a, r) => a + r.valor, 0)
  const totalRestante = totalMes - totalPago
  const progresso = totalMes > 0 ? Math.round((totalPago / totalMes) * 100) : 0

  // Ordena: não pagos primeiro (por dia), depois pagos
  const ordenadas = [...recorrencias].sort((a, b) => {
    const aPago = pagos.has(a.id)
    const bPago = pagos.has(b.id)
    if (aPago !== bPago) return aPago ? 1 : -1
    return (a.dia_vencimento ?? 99) - (b.dia_vencimento ?? 99)
  })

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
      {/* ── Header colapsável ── */}
      <button
        onClick={() => setColapsado(c => !c)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-base">📋</span>
          <div className="text-left">
            <p className="text-xs font-bold text-fg uppercase tracking-wider">
              Vencimentos do Mês
            </p>
            {!colapsado && (
              <p className="text-[10px] text-fg-tertiary mt-0.5">
                {recorrencias.length} conta(s) fixa(s) · {progresso}% quitado
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Resumo compacto quando colapsado */}
          {colapsado && !loading && (
            <div className="flex items-center gap-4 text-right">
              <div>
                <p className="text-[10px] text-fg-disabled">Total</p>
                <p className="text-xs font-bold text-fg">{fmt(totalMes)}</p>
              </div>
              <div>
                <p className="text-[10px] text-fg-disabled">Restante</p>
                <p className="text-xs font-bold text-red-400">{fmt(totalRestante)}</p>
              </div>
            </div>
          )}
          {colapsado
            ? <ChevronDown size={15} className="text-fg-tertiary" />
            : <ChevronUp size={15} className="text-fg-tertiary" />
          }
        </div>
      </button>

      {/* ── Corpo (oculto quando colapsado) ── */}
      {!colapsado && (
        <div className="px-5 pb-5 space-y-4">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-page rounded-xl p-3 border border-border-subtle">
              <p className="text-[10px] text-fg-disabled uppercase tracking-widest mb-1">Total do mês</p>
              <p className="text-sm font-bold text-fg tabular-nums">{fmt(totalMes)}</p>
            </div>
            <div className="bg-page rounded-xl p-3 border border-border-subtle">
              <p className="text-[10px] text-fg-disabled uppercase tracking-widest mb-1">Já pago</p>
              <p className="text-sm font-bold text-emerald-400 tabular-nums">{fmt(totalPago)}</p>
            </div>
            <div className="bg-page rounded-xl p-3 border border-border-subtle">
              <p className="text-[10px] text-fg-disabled uppercase tracking-widest mb-1">Restante</p>
              <p className={cn(
                'text-sm font-bold tabular-nums',
                totalRestante <= 0 ? 'text-emerald-400' : 'text-red-400'
              )}>
                {fmt(totalRestante)}
              </p>
            </div>
          </div>

          {/* ── Barra de progresso ── */}
          <div>
            <div className="flex justify-between text-[10px] text-fg-tertiary mb-1.5">
              <span>Progresso do mês</span>
              <span className="font-bold text-fg">{progresso}% quitado</span>
            </div>
            <div className="h-2 bg-page rounded-full overflow-hidden border border-border-subtle">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progresso}%`,
                  background:
                    progresso === 100 ? '#10b981'
                    : progresso > 60  ? '#f59e0b'
                    : '#7c5cfc',
                }}
              />
            </div>
          </div>

          {/* ── Lista de vencimentos ── */}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-10 bg-page rounded-xl animate-pulse border border-border-subtle" />
              ))}
            </div>
          ) : recorrencias.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-xs text-fg-disabled">Nenhuma conta fixa cadastrada.</p>
              <p className="text-[11px] text-fg-tertiary mt-1">
                Cadastre despesas recorrentes para ver o controle aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {ordenadas.map(r => {
                const isPago = pagos.has(r.id)
                const status = isPago ? 'pago' : getStatusVencimento(r.dia_vencimento)
                const pct = totalMes > 0 ? ((r.valor / totalMes) * 100).toFixed(1) : '0'

                return (
                  <div
                    key={r.id}
                    onClick={() => togglePago(r.id)}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all select-none',
                      isPago
                        ? 'bg-emerald-500/5 border-emerald-500/20 opacity-60'
                        : status === 'vencido'
                        ? 'bg-red-500/8 border-red-500/25 hover:bg-red-500/12'
                        : status === 'urgente'
                        ? 'bg-amber-500/8 border-amber-500/25 hover:bg-amber-500/12'
                        : 'bg-page border-border-subtle hover:bg-white/3'
                    )}
                  >
                    {/* Ícone de status */}
                    <span className="shrink-0">
                      {isPago ? (
                        <CheckCircle2 size={16} className="text-emerald-400" />
                      ) : status === 'vencido' ? (
                        <AlertCircle size={16} className="text-red-400" />
                      ) : status === 'urgente' ? (
                        <Clock size={16} className="text-amber-400" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-fg-disabled" />
                      )}
                    </span>

                    {/* Descrição */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-xs font-semibold truncate',
                        isPago ? 'line-through text-fg-tertiary' : 'text-fg-secondary'
                      )}>
                        {r.descricao}
                      </p>
                      <p className="text-[10px] text-fg-disabled">
                        {r.dia_vencimento ? `Vence dia ${r.dia_vencimento}` : 'Sem data'}
                        {status === 'vencido' && !isPago && (
                          <span className="text-red-400 ml-1">· Vencida!</span>
                        )}
                        {status === 'urgente' && !isPago && (
                          <span className="text-amber-400 ml-1">
                            · Vence em {(r.dia_vencimento ?? 0) - getTodayDay()} dia(s)
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Valor + % */}
                    <div className="text-right shrink-0">
                      <p className={cn(
                        'text-xs font-bold tabular-nums',
                        isPago ? 'text-emerald-400 line-through' : 'text-fg'
                      )}>
                        {fmt(r.valor)}
                      </p>
                      <p className="text-[10px] text-fg-disabled">{pct}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Rodapé ── */}
          {recorrencias.length > 0 && (
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-fg-tertiary">
                💡 Clique para marcar como pago · Salvo automaticamente
              </p>
              {onVerDetalhes && (
                <button
                  onClick={e => { e.stopPropagation(); onVerDetalhes() }}
                  className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-semibold transition-colors"
                >
                  Ver lançamentos <ArrowRight size={11} />
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
