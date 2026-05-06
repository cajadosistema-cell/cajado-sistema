'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ArrowRight, CheckCircle2, Clock, AlertCircle } from 'lucide-react'

// ── Helpers ────────────────────────────────────────────────────
const LS_KEY = 'cajado_vencimentos_pagos_pf'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getTodayDay() {
  return new Date().getDate()
}

function getStatusVencimento(dia: number): 'vencido' | 'urgente' | 'normal' {
  const hoje = getTodayDay()
  if (dia < hoje) return 'vencido'
  if (dia - hoje <= 3) return 'urgente'
  return 'normal'
}

function lerPagosMes(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return new Set()
    const obj = JSON.parse(raw)
    const mesAtual = new Date().toISOString().substring(0, 7)
    return new Set<string>(obj[mesAtual] ?? [])
  } catch {
    return new Set()
  }
}

function salvarPagosMes(ids: Set<string>) {
  try {
    const raw = localStorage.getItem(LS_KEY)
    const obj = raw ? JSON.parse(raw) : {}
    const mesAtual = new Date().toISOString().substring(0, 7)
    obj[mesAtual] = [...ids]
    localStorage.setItem(LS_KEY, JSON.stringify(obj))
  } catch {}
}

// ── Tipagem Local ──────────────────────────────────────────────
type GastoRecorrente = {
  id: string // Usaremos a descricao como ID único
  descricao: string
  valor: number
  dia_vencimento: number
}

// ── Componente ─────────────────────────────────────────────────
export function VencimentosMesPF({ 
  isOpen, 
  onClose, 
  onVerDetalhes 
}: { 
  isOpen: boolean
  onClose: () => void
  onVerDetalhes?: () => void 
}) {
  const [recorrencias, setRecorrencias] = useState<GastoRecorrente[]>([])
  const [loading, setLoading] = useState(true)
  const [pagos, setPagos] = useState<Set<string>>(new Set())

  // Busca gastos recorrentes para montar as contas fixas
  useEffect(() => {
    if (!isOpen) return

    const fetchPF = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: user } = await supabase.auth.getUser()
        if (!user.user) return

        // Pega os últimos 3 meses de gastos recorrentes para ter uma base sólida
        const limite = new Date()
        limite.setMonth(limite.getMonth() - 3)
        
        const { data, error } = await (supabase.from('gastos_pessoais') as any)
          .select('descricao, valor, data')
          .eq('user_id', user.user.id)
          .eq('recorrente', true)
          .gte('data', limite.toISOString().split('T')[0])
          .order('data', { ascending: false }) // Os mais recentes primeiro

        if (!error && data) {
          // Extrai contas únicas por descrição (pegando o valor e dia do mais recente)
          const map = new Map<string, GastoRecorrente>()
          for (const row of data) {
            const desc = row.descricao.trim()
            const id = desc.toLowerCase() // ID baseado na descrição
            if (!map.has(id)) {
              // Extrai o dia da data (ex: '2023-10-15' -> 15)
              const dia = parseInt(row.data.split('-')[2], 10) || 1
              map.set(id, {
                id,
                descricao: desc,
                valor: row.valor,
                dia_vencimento: dia
              })
            }
          }
          
          setRecorrencias(Array.from(map.values()).sort((a, b) => a.dia_vencimento - b.dia_vencimento))
        }
      } catch {
      } finally {
        setLoading(false)
      }
    }

    fetchPF()
    setPagos(lerPagosMes())
  }, [isOpen])

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
  const totalPago = recorrencias.filter(r => pagos.has(r.id)).reduce((a, r) => a + r.valor, 0)
  const totalRestante = totalMes - totalPago
  const progresso = totalMes > 0 ? Math.round((totalPago / totalMes) * 100) : 0

  const ordenadas = useMemo(() => {
    return [...recorrencias].sort((a, b) => {
      const aPago = pagos.has(a.id)
      const bPago = pagos.has(b.id)
      if (aPago !== bPago) return aPago ? 1 : -1
      return a.dia_vencimento - b.dia_vencimento
    })
  }, [recorrencias, pagos])

  // ── Render ───────────────────────────────────────────────────
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface border border-white/5 rounded-2xl overflow-hidden w-full max-w-md shadow-2xl relative max-h-[90vh] flex flex-col">
        
        {/* ── Header do Modal ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0 bg-page">
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div className="text-left">
              <p className="text-sm font-bold text-fg uppercase tracking-wider">
                Vencimentos do Mês <span className="text-[10px] text-fg-tertiary ml-1 font-normal">(PF)</span>
              </p>
              <p className="text-[10px] text-fg-tertiary mt-0.5">
                {recorrencias.length} conta(s) fixa(s) identificadas · {progresso}% quitado
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl p-1 leading-none">
            ×
          </button>
        </div>

        {/* ── Corpo com scroll ── */}
        <div className="px-5 py-5 space-y-4 overflow-y-auto">

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
              <p className="text-xs text-fg-disabled">Nenhum gasto recorrente identificado.</p>
              <p className="text-[11px] text-fg-tertiary mt-1 px-4 leading-relaxed">
                Ao registrar um novo gasto, marque a opção <strong>"Gasto recorrente (mensal)"</strong>. Ele aparecerá automaticamente aqui nos próximos meses.
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
                        Vence dia {r.dia_vencimento}
                        {status === 'vencido' && !isPago && (
                          <span className="text-red-400 ml-1">· Vencida!</span>
                        )}
                        {status === 'urgente' && !isPago && (
                          <span className="text-amber-400 ml-1">
                            · Vence em {(r.dia_vencimento) - getTodayDay()} dia(s)
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
        </div>

        {/* ── Rodapé ── */}
        <div className="px-5 py-4 border-t border-white/5 bg-page shrink-0 flex items-center justify-between">
          <p className="text-[10px] text-fg-tertiary">
            💡 Extraído automaticamente dos gastos mensais
          </p>
          {onVerDetalhes && (
            <button
              onClick={() => { onClose(); onVerDetalhes(); }}
              className="flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300 font-semibold transition-colors"
            >
              Lançamentos PF <ArrowRight size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
