'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'

// ── Tipos ──────────────────────────────────────────────────────

type Lead = {
  id: string
  nome: string
  telefone: string
  valor_estimado: number | null
}

type Lancamento = {
  id: string
  descricao: string
  valor: number
  tipo: string
  status: string
  data_competencia: string
}

type PagamentoParcial = {
  id: string
  lancamento_id: string
  valor_pago: number
  data_pagamento: string
  forma_pagamento: string
  observacoes: string | null
  created_at: string
}

// ── Calcula saldo pendente de um lançamento ───────────────────

function calcPendente(lancamento: Lancamento, parciais: PagamentoParcial[]): number {
  const pago = parciais
    .filter(p => p.lancamento_id === lancamento.id)
    .reduce((a, p) => a + p.valor_pago, 0)
  return Math.max(lancamento.valor - pago, 0)
}

// ── Modal: Registrar Pagamento Parcial ────────────────────────

function ModalPagamentoParcial({
  lancamento,
  pendente,
  onClose,
  onSave,
}: {
  lancamento: Lancamento
  pendente: number
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    valor_pago: String(pendente.toFixed(2)),
    data_pagamento: new Date().toISOString().split('T')[0],
    forma_pagamento: 'pix',
    observacoes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseFloat(form.valor_pago.replace(',', '.'))
    if (!valor || valor <= 0) return
    setLoading(true)

    await (supabase.from('pagamentos_parciais') as any).insert({
      lancamento_id: lancamento.id,
      valor_pago: valor,
      data_pagamento: form.data_pagamento,
      forma_pagamento: form.forma_pagamento,
      observacoes: form.observacoes || null,
    })

    // Se quitado totalmente, marcar lançamento como validado
    if (valor >= pendente) {
      await (supabase.from('lancamentos') as any)
        .update({ status: 'validado' })
        .eq('id', lancamento.id)
    }

    setLoading(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-fg">Registrar Entrada Parcial</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">{lancamento.descricao}</p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl leading-none">×</button>
        </div>

        {/* Resumo do lançamento */}
        <div className="grid grid-cols-2 gap-2 mb-5">
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="text-[10px] text-fg-tertiary">Valor total</p>
            <p className="text-base font-bold text-fg">{formatCurrency(lancamento.valor)}</p>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <p className="text-[10px] text-fg-tertiary">Saldo pendente</p>
            <p className="text-base font-bold text-amber-400">{formatCurrency(pendente)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor recebido (R$) *</label>
              <input
                className="input mt-1" required type="number" step="0.01" min="0.01"
                max={pendente}
                value={form.valor_pago}
                onChange={e => setForm(f => ({ ...f, valor_pago: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Data</label>
              <input
                className="input mt-1" type="date"
                value={form.data_pagamento}
                onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="label">Forma de pagamento</label>
            <select
              className="input mt-1"
              value={form.forma_pagamento}
              onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}
            >
              <option value="pix">PIX</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao_debito">Cartão Débito</option>
              <option value="cartao_credito">Cartão Crédito</option>
              <option value="transferencia">Transferência</option>
              <option value="boleto">Boleto</option>
            </select>
          </div>

          <div>
            <label className="label">Observações</label>
            <input
              className="input mt-1"
              placeholder="Ex: Restante será pago na semana que vem"
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Registrando...' : '✅ Confirmar Entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────

type Props = {
  lancamentos: Lancamento[]
  refetch: () => void
}

export function SecaoPagamentosParciais({ lancamentos, refetch }: Props) {
  const [parciais, setParciais] = useState<PagamentoParcial[]>([])
  const [carregado, setCarregado] = useState(false)
  const [modalLanc, setModalLanc] = useState<Lancamento | null>(null)
  const supabase = createClient()

  // Carrega parciais na primeira renderização
  const carregarParciais = async () => {
    const { data } = await (supabase.from('pagamentos_parciais') as any)
      .select('*')
      .order('created_at', { ascending: false })
    if (data) {
      setParciais(data)
      setCarregado(true)
    }
  }

  if (!carregado) {
    carregarParciais()
  }

  // Filtra apenas lançamentos de receita pendentes (a receber)
  const receitasPendentes = lancamentos.filter(
    l => l.tipo === 'receita' && l.status !== 'validado'
  )

  // Calcula saldo pendente por lançamento
  const comPendente = receitasPendentes.map(l => ({
    lancamento: l,
    pendente: calcPendente(l, parciais),
    parciais: parciais.filter(p => p.lancamento_id === l.id),
  })).sort((a, b) => b.pendente - a.pendente)

  const totalPendente = comPendente.reduce((a, c) => a + c.pendente, 0)

  return (
    <>
      <div className="bg-surface border border-white/5 rounded-xl p-5 lg:col-span-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="section-title mb-0">💰 Contas a Receber — Entradas Parciais</h2>
            <p className="text-xs text-fg-disabled mt-0.5">Acompanhe pagamentos parciais e saldo pendente por cliente</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-fg-tertiary">Total pendente</p>
            <p className="text-lg font-bold text-amber-400">{formatCurrency(totalPendente)}</p>
          </div>
        </div>

        {comPendente.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-sm text-fg-disabled">✅ Nenhuma receita pendente de recebimento.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {comPendente.map(({ lancamento, pendente, parciais: ps }) => {
              const pct = lancamento.valor > 0
                ? Math.round(((lancamento.valor - pendente) / lancamento.valor) * 100)
                : 100

              return (
                <div key={lancamento.id} className="border border-white/5 bg-black/20 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="text-sm font-medium text-fg">{lancamento.descricao}</p>
                      <p className="text-xs text-fg-tertiary mt-0.5">
                        Total: {formatCurrency(lancamento.valor)} · Recebido: {formatCurrency(lancamento.valor - pendente)}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-bold ${pendente > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {pendente > 0 ? `Falta: ${formatCurrency(pendente)}` : '✅ Quitado'}
                      </p>
                    </div>
                  </div>

                  {/* Barra de progresso */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  {/* Histórico de parciais */}
                  {ps.length > 0 && (
                    <div className="space-y-1 mb-3">
                      {ps.map(p => (
                        <div key={p.id} className="flex items-center justify-between text-xs text-fg-tertiary">
                          <span>📥 {new Date(p.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')} · {p.forma_pagamento}</span>
                          <span className="text-emerald-400 font-medium">+{formatCurrency(p.valor_pago)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendente > 0 && (
                    <button
                      onClick={() => setModalLanc(lancamento)}
                      className="text-xs text-amber-400 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      + Registrar entrada
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {modalLanc && (
        <ModalPagamentoParcial
          lancamento={modalLanc}
          pendente={calcPendente(modalLanc, parciais)}
          onClose={() => setModalLanc(null)}
          onSave={() => { refetch(); carregarParciais() }}
        />
      )}
    </>
  )
}
