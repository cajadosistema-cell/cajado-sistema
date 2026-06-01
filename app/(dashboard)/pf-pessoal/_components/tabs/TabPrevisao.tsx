'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ReceitaPessoal } from '../types'
import { CATEGORIAS_RECEITA, formatCurrency } from '../types'

type Props = {
  receitas: ReceitaPessoal[]
  onUpdate: () => void
  onNovaReceita: () => void
}

// ── Modal Editar Receita Recorrente ─────────────────────────────
function ModalEditarReceita({
  receita,
  onClose,
  onSave,
}: {
  receita: ReceitaPessoal
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    descricao:  receita.descricao,
    valor:      String(receita.valor),
    categoria:  receita.categoria,
    recorrente: receita.recorrente,
    data:       receita.data,
    notas:      receita.notas ?? '',
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await (supabase.from('receitas_pessoais') as any).update({
      descricao:  form.descricao,
      valor:      parseFloat(form.valor.replace(',', '.')) || 0,
      categoria:  form.categoria,
      recorrente: form.recorrente,
      data:       form.data,
      notas:      form.notas || null,
    }).eq('id', receita.id)
    setLoading(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">Editar Receita Recorrente</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl leading-none">x</button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="label">Descricao *</label>
            <input
              className="input mt-1 w-full" required
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input
                className="input mt-1 w-full" type="number" step="0.01" min="0" required
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select
                className="input mt-1 w-full"
                value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
              >
                {Object.entries(CATEGORIAS_RECEITA).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label">Data de referencia</label>
            <input
              className="input mt-1 w-full" type="date"
              value={form.data}
              onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox" className="w-4 h-4 accent-emerald-500"
              checked={form.recorrente}
              onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))}
            />
            <span className="text-xs text-fg-secondary">Receita recorrente (aparece na previsao)</span>
          </label>

          <div>
            <label className="label">Notas</label>
            <textarea
              className="input mt-1 w-full resize-none" rows={2}
              placeholder="Observacoes opcionais..."
              value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : 'Salvar alteracoes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tab Principal ────────────────────────────────────────────────
export function TabPrevisao({ receitas, onUpdate, onNovaReceita }: Props) {
  const supabase = createClient()
  const mesAtual = new Date().toISOString().slice(0, 7)
  const [editando, setEditando] = useState<ReceitaPessoal | null>(null)
  const [deletando, setDeletando] = useState<ReceitaPessoal | null>(null)
  const [loadingDel, setLoadingDel] = useState(false)

  const recorrentes = receitas.filter(r => r.recorrente)
  const totalRecorrente = recorrentes.reduce((a, r) => a + r.valor, 0)

  const receitasMes = receitas.filter(r => r.data.startsWith(mesAtual))
  const totalMes = receitasMes.reduce((a, r) => a + r.valor, 0)

  const hoje = new Date()
  const diaDoMes = hoje.getDate()
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate()
  const projecaoMes = diaDoMes > 0 ? (totalMes / diaDoMes) * diasNoMes : 0

  const proximosMeses = Array.from({ length: 3 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() + i + 1)
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    return { label, valor: totalRecorrente }
  })

  const handleDeletar = async () => {
    if (!deletando) return
    setLoadingDel(true)
    await (supabase.from('receitas_pessoais') as any).delete().eq('id', deletando.id)
    setLoadingDel(false)
    setDeletando(null)
    onUpdate()
  }

  return (
    <div className="space-y-6">

      {/* KPIs do mes */}
      <div className="bg-page border border-border-subtle rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-fg-secondary mb-4">Previsao para Este Mes</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: 'Recebido ate hoje',    value: formatCurrency(totalMes),        color: 'text-emerald-400' },
            { label: 'Projecao do mes',      value: formatCurrency(projecaoMes),     color: 'text-amber-400',  sub: `Baseado em ${diaDoMes}/${diasNoMes} dias` },
            { label: 'Receitas recorrentes', value: formatCurrency(totalRecorrente), color: 'text-purple-400', sub: 'Confirmado para os proximos meses' },
          ].map(k => (
            <div key={k.label} className="bg-muted/50 rounded-xl p-4">
              <p className="text-xs text-fg-tertiary mb-1">{k.label}</p>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              {k.sub && <p className="text-[10px] text-fg-disabled mt-1">{k.sub}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Receitas recorrentes com editar/deletar */}
      <div className="bg-page border border-border-subtle rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-fg-secondary">Receitas Recorrentes</h3>
          <button onClick={onNovaReceita} className="btn-ghost text-xs">+ Adicionar</button>
        </div>

        {recorrentes.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-xs text-fg-disabled">Nenhuma receita recorrente cadastrada.</p>
            <p className="text-[10px] text-zinc-700 mt-1">Adicione pro-labore, salario ou outras rendas fixas marcando como recorrente.</p>
            <button onClick={onNovaReceita} className="btn-primary text-xs mt-3">+ Adicionar receita recorrente</button>
          </div>
        ) : (
          <div className="space-y-1">
            {recorrentes.map(r => {
              const cat = CATEGORIAS_RECEITA[r.categoria]
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-white/3 border border-transparent hover:border-white/6 transition-all group"
                >
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-fg truncate">{r.descricao}</p>
                    <p className="text-xs text-fg-tertiary">
                      {cat?.icon} {cat?.label ?? r.categoria}
                    </p>
                  </div>

                  {/* Valor */}
                  <p className="text-sm font-semibold text-emerald-400 shrink-0">
                    {formatCurrency(r.valor)}<span className="text-xs text-fg-tertiary">/mes</span>
                  </p>

                  {/* Botoes — aparecem no hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      onClick={() => setEditando(r)}
                      title="Editar"
                      className="p-1.5 rounded-lg text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20 transition-all text-sm"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeletando(r)}
                      title="Excluir"
                      className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 border border-transparent hover:border-red-500/20 transition-all text-sm"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Total */}
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-white/6">
              <span className="text-sm font-semibold text-fg-secondary">Total mensal confirmado</span>
              <span className="text-sm font-bold text-emerald-400">{formatCurrency(totalRecorrente)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Projecao 3 meses */}
      {totalRecorrente > 0 && (
        <div className="bg-page border border-border-subtle rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-fg-secondary mb-4">Projecao Proximos 3 Meses</h3>
          <div className="space-y-2">
            {proximosMeses.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border-subtle/30 last:border-0">
                <span className="text-sm text-fg-secondary capitalize">{m.label}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-emerald-400">{formatCurrency(m.valor)}</span>
                  <span className="text-xs text-fg-disabled ml-1">(recorrentes)</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-fg-disabled mt-3">* Projecao baseada apenas em receitas marcadas como recorrentes.</p>
        </div>
      )}

      {/* Modal Editar */}
      {editando && (
        <ModalEditarReceita
          receita={editando}
          onClose={() => setEditando(null)}
          onSave={() => { setEditando(null); onUpdate() }}
        />
      )}

      {/* Modal Confirmar Exclusao */}
      {deletando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="text-center">
              <span className="text-4xl">🗑️</span>
              <h2 className="text-sm font-bold text-white mt-3">Excluir receita recorrente?</h2>
              <p className="text-xs text-fg-tertiary mt-2">
                <span className="font-semibold text-fg">"{deletando.descricao}"</span>
                <br />sera removida da previsao. Esta acao nao pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletando(null)}
                disabled={loadingDel}
                className="flex-1 btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletar}
                disabled={loadingDel}
                className="flex-1 py-2 rounded-xl text-sm font-semibold bg-red-500/15 text-red-400 border border-red-500/30 hover:bg-red-500/25 transition-colors"
              >
                {loadingDel ? 'Removendo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
