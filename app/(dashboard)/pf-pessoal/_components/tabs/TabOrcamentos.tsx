'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { GastoPessoal, OrcamentoPessoal } from '../types'
import { CATEGORIAS_GASTO, formatCurrency } from '../types'

type Props = {
  gastos: GastoPessoal[]
  orcamentos: OrcamentoPessoal[]
  onUpdate: () => void
}

export function TabOrcamentos({ gastos, orcamentos, onUpdate }: Props) {
  const supabase = createClient()
  const [editando, setEditando] = useState<string | null>(null)
  const [novoLimite, setNovoLimite] = useState('')
  const mesAtual = new Date().toISOString().slice(0, 7)

  const gastosMes = gastos.filter(g => g.data.startsWith(mesAtual))

  const salvarOrcamento = async (categoria: string) => {
    const limite = parseFloat(novoLimite)
    if (!limite || limite <= 0) return

    const existente = orcamentos.find(o => o.categoria === categoria && o.mes_referencia === mesAtual)
    if (existente) {
      await (supabase.from('orcamentos_pessoais') as any)
        .update({ valor_limite: limite })
        .eq('id', existente.id)
    } else {
      await (supabase.from('orcamentos_pessoais') as any).insert({
        categoria,
        valor_limite: limite,
        mes_referencia: mesAtual,
      })
    }

    setEditando(null)
    setNovoLimite('')
    onUpdate()
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-fg-secondary mb-1">Orçamentos de {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h3>
        <p className="text-xs text-fg-tertiary">Defina limites por categoria e acompanhe se está dentro do planejado.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.entries(CATEGORIAS_GASTO).map(([cat, info]) => {
          const gasto = gastosMes.filter(g => g.categoria === cat).reduce((a, g) => a + g.valor, 0)
          const orcamento = orcamentos.find(o => o.categoria === cat && o.mes_referencia === mesAtual)
          const limite = orcamento?.valor_limite ?? 0
          const pct = limite > 0 ? Math.min((gasto / limite) * 100, 100) : 0
          const isCritico = limite > 0 && pct > 90
          const isAlerta = limite > 0 && pct > 70

          return (
            <div key={cat} className="bg-page border border-border-subtle rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{info.icon}</span>
                  <span className="text-sm font-medium text-fg">{info.label}</span>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${gasto > 0 ? 'text-fg' : 'text-fg-disabled'}`}>
                    {formatCurrency(gasto)}
                  </p>
                  {limite > 0 && (
                    <p className="text-xs text-fg-tertiary">de {formatCurrency(limite)}</p>
                  )}
                </div>
              </div>

              {/* Barra de progresso */}
              <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                {limite > 0 ? (
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCritico ? 'bg-red-500' : isAlerta ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                ) : (
                  <div className="h-full w-full bg-surface-hover/30 rounded-full" />
                )}
              </div>

              {/* Alertas */}
              {isCritico && (
                <p className="text-[10px] text-red-400 mb-2">⚠️ Quase no limite! ({pct.toFixed(0)}%)</p>
              )}

              {/* Campo de edição */}
              {editando === cat ? (
                <div className="flex gap-2 mt-2">
                  <input
                    type="number"
                    step="50"
                    min="1"
                    className="input text-xs flex-1 py-1.5"
                    placeholder="Limite R$"
                    value={novoLimite}
                    onChange={e => setNovoLimite(e.target.value)}
                    autoFocus
                  />
                  <button onClick={() => salvarOrcamento(cat)} className="btn-primary text-xs px-3">✓</button>
                  <button onClick={() => setEditando(null)} className="btn-secondary text-xs px-2">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditando(cat); setNovoLimite(limite ? String(limite) : '') }}
                  className="text-xs text-fg-tertiary hover:text-amber-400 transition-colors"
                >
                  {limite > 0 ? '✏️ Editar limite' : '+ Definir limite'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
