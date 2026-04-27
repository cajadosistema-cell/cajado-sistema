'use client'

import { useState } from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { EmptyState } from '@/components/shared/ui'
import { createClient } from '@/lib/supabase/client'

type Conta = { id: string; nome: string; tipo: string; categoria: string; saldo_atual: number; cor?: string }
type Lancamento = { id: string; descricao: string; valor: number; tipo: string; status: string; data_competencia: string; conta_id: string; categoria_id?: string }
type Categoria = { id: string; nome: string; tipo: string }

// ── Modal lançamento de conta ────────────────────────────────
function ModalLancamentoConta({ contas, categorias, onClose, onSave }: {
  contas: Conta[]; categorias: Categoria[]; onClose: () => void; onSave: () => void
}) {
  const { insert, loading } = useSupabaseMutation('lancamentos')
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const contasBancarias = contas.filter(c => ['corrente', 'poupanca', 'dinheiro', 'investimento'].includes(c.tipo))
  const [form, setForm] = useState({
    conta_id: contasBancarias[0]?.id ?? '',
    descricao: '', valor: '',
    tipo: 'despesa' as 'despesa' | 'receita' | 'transferencia' | 'investimento',
    regime: 'caixa' as 'caixa' | 'competencia',
    data_competencia: today,
    categoria_id: '',
    total_parcelas: '1',
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const contaSel = contasBancarias.find(c => c.id === form.conta_id)
  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || !form.conta_id) return
    const parcelas = parseInt(form.total_parcelas) || 1
    if (parcelas > 1) {
      for (let i = 1; i <= parcelas; i++) {
        const d = new Date(form.data_competencia)
        d.setMonth(d.getMonth() + (i - 1))
        await (supabase.from('lancamentos') as any).insert({
          conta_id: form.conta_id,
          descricao: `${form.descricao} (${i}/${parcelas})`,
          valor: valor / parcelas, tipo: form.tipo, regime: form.regime,
          status: 'pendente', data_competencia: d.toISOString().split('T')[0],
          categoria_id: form.categoria_id || null, parcela_atual: i, total_parcelas: parcelas,
        })
      }
    } else {
      await insert({
        conta_id: form.conta_id, descricao: form.descricao, valor, tipo: form.tipo,
        regime: form.regime, status: 'pendente', data_competencia: form.data_competencia,
        categoria_id: form.categoria_id || null, total_parcelas: 1,
      } as any)
    }
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-fg">Novo Lançamento — Conta Bancária</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo */}
          <div className="grid grid-cols-4 gap-1 bg-muted/50 p-1 rounded-lg">
            {(['despesa', 'receita', 'investimento', 'transferencia'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => set('tipo', t)}
                className={cn('py-1.5 rounded-md text-xs font-medium transition-colors',
                  form.tipo === t
                    ? t === 'receita' ? 'bg-emerald-500/20 text-emerald-400'
                    : t === 'despesa' ? 'bg-red-500/20 text-red-400'
                    : t === 'investimento' ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-surface-hover text-fg-secondary'
                    : 'text-fg-tertiary hover:text-fg-secondary'
                )}>
                {t === 'transferencia' ? 'Transf.' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Conta selecionada */}
          <div>
            <label className="label">Conta *</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {contasBancarias.map(c => (
                <button key={c.id} type="button" onClick={() => set('conta_id', c.id)}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all text-left',
                    form.conta_id === c.id
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                      : 'border-border-subtle text-fg-tertiary hover:border-border hover:text-fg'
                  )}>
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: c.cor || '#6b7280' }} />
                  <span className="truncate">{c.nome}</span>
                  <span className="ml-auto text-[9px] opacity-60">{c.categoria.toUpperCase()}</span>
                </button>
              ))}
            </div>
            {contaSel && (
              <p className="text-[11px] text-fg-tertiary mt-1.5">
                Saldo atual: <span className={`font-semibold ${contaSel.saldo_atual >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(contaSel.saldo_atual)}</span>
              </p>
            )}
          </div>

          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              placeholder="Ex: Aluguel, Salário, Fornecedor..."
              onChange={e => set('descricao', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input mt-1" required type="number" step="0.01" min="0.01"
                value={form.valor} placeholder="0.00"
                onChange={e => set('valor', e.target.value)} />
            </div>
            <div>
              <label className="label">Parcelas</label>
              <input className="input mt-1" type="number" min="1" max="60"
                value={form.total_parcelas} onChange={e => set('total_parcelas', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data *</label>
              <input className="input mt-1" type="date" required value={form.data_competencia}
                onChange={e => set('data_competencia', e.target.value)} />
            </div>
            <div>
              <label className="label">Regime</label>
              <select className="input mt-1" value={form.regime} onChange={e => set('regime', e.target.value)}>
                <option value="caixa">Caixa (pago/recebido)</option>
                <option value="competencia">Competência</option>
              </select>
            </div>
          </div>

          <div>
            <label className="label">Categoria</label>
            <select className="input mt-1" value={form.categoria_id} onChange={e => set('categoria_id', e.target.value)}>
              <option value="">Sem categoria</option>
              {categoriasFiltradas.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : 'Registrar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── TabContas principal ──────────────────────────────────────
export function TabContas({ contas, lancamentos, categorias, onNovaConta, onImportar, onValidar, onEditLancamento, onDeleteLancamento, onDeleteConta }: {
  contas: Conta[]; lancamentos: Lancamento[]; categorias: Categoria[];
  onNovaConta: () => void; onImportar: () => void;
  onValidar: (id: string, desc: string) => void
  onEditLancamento: (l: any) => void
  onDeleteLancamento: (id: string) => void
  onDeleteConta: (id: string) => void
}) {
  const contasBancarias = contas.filter(c => ['corrente', 'poupanca', 'dinheiro', 'investimento'].includes(c.tipo))
  const [contaSel, setContaSel] = useState<string>('todas')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [modalLanc, setModalLanc] = useState(false)
  const today = new Date().toISOString().substring(0, 10)
  const mes = new Date().toISOString().substring(0, 7)

  const lancamentosContas = lancamentos.filter(l =>
    contasBancarias.some(c => c.id === l.conta_id) &&
    (contaSel === 'todas' || l.conta_id === contaSel)
  )

  const filtrados = lancamentosContas.filter(l => {
    const okTipo = filtroTipo ? l.tipo === filtroTipo : true
    const okBusca = busca ? l.descricao?.toLowerCase().includes(busca.toLowerCase()) : true
    return okTipo && okBusca
  })

  const receitasMes = lancamentosContas.filter(l => l.tipo === 'receita' && l.data_competencia?.startsWith(mes)).reduce((a, l) => a + l.valor, 0)
  const despesasMes = lancamentosContas.filter(l => l.tipo === 'despesa' && l.data_competencia?.startsWith(mes)).reduce((a, l) => a + l.valor, 0)
  const saldoContas = contasBancarias.filter(c => contaSel === 'todas' || c.id === contaSel).reduce((a, c) => a + c.saldo_atual, 0)
  const pendentes = lancamentosContas.filter(l => l.data_competencia <= today && l.status !== 'validado')

  return (
    <div className="space-y-5 mt-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-fg">Contas Bancárias</h2>
          <p className="text-xs text-fg-tertiary">Corrente · Poupança · Caixa · Importar extrato</p>
        </div>
        <div className="flex gap-2">
          <button onClick={onImportar} className="btn-secondary text-xs">📥 Importar Extrato</button>
          <button onClick={onNovaConta} className="btn-ghost text-xs">+ Conta</button>
          <button onClick={() => setModalLanc(true)} className="btn-primary text-xs">+ Lançamento</button>
        </div>
      </div>

      {/* Seletor de contas */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setContaSel('todas')}
          className={cn('flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
            contaSel === 'todas' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-border-subtle text-fg-tertiary hover:text-fg')}>
          🏦 Todas ({contasBancarias.length})
        </button>
        {contasBancarias.map(c => (
          <div key={c.id} className="relative flex-shrink-0 group flex">
            <button onClick={() => setContaSel(c.id)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                contaSel === c.id ? 'border-white/20 text-white bg-white/10' : 'border-border-subtle text-fg-tertiary hover:text-fg',
                contaSel === c.id ? 'rounded-r-none border-r-0' : ''
              )}>
              <span className="w-2 h-2 rounded-full" style={{ background: c.cor || '#6b7280' }} />
              {c.nome}
              <span className="text-[9px] opacity-60">{formatCurrency(c.saldo_atual)}</span>
            </button>
            {contaSel === c.id && (
              <button
                onClick={() => onDeleteConta(c.id)}
                className="flex items-center justify-center px-2 border border-l-0 border-white/20 rounded-r-xl bg-white/10 text-red-400 hover:text-white hover:bg-red-500 transition-colors"
                title="Excluir Conta Bancária"
              >
                🗑️
              </button>
            )}
          </div>
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Saldo em Contas', val: saldoContas, color: saldoContas >= 0 ? 'text-emerald-400' : 'text-red-400', bg: 'bg-emerald-500/10' },
          { label: 'Receitas do Mês', val: receitasMes, color: 'text-purple-400', bg: 'bg-purple-500/10' },
          { label: 'Despesas do Mês', val: despesasMes, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map(({ label, val, color, bg }) => (
          <div key={label} className={`${bg} border border-white/5 rounded-xl p-4`}>
            <p className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{formatCurrency(val)}</p>
          </div>
        ))}
      </div>

      {/* Filtros e lista */}
      <div className="bg-surface border border-white/5 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <input className="input text-xs flex-1 min-w-[140px]" placeholder="🔍 Buscar lançamento..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          <select className="input text-xs w-36" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
            <option value="">Todos os tipos</option>
            <option value="receita">Receitas</option>
            <option value="despesa">Despesas</option>
            <option value="investimento">Investimentos</option>
          </select>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState message="Nenhum lançamento encontrado" />
        ) : (
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {filtrados.slice(0, 50).map(l => {
              const conta = contasBancarias.find(c => c.id === l.conta_id)
              return (
                <div key={l.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-white/5 bg-black/20 hover:bg-white/5 transition-colors group">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${l.tipo === 'receita' ? 'bg-emerald-400' : l.tipo === 'despesa' ? 'bg-red-400' : 'bg-blue-400'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-fg truncate">{l.descricao}</p>
                      <p className="text-[10px] text-fg-tertiary">{l.data_competencia} · {conta?.nome || '—'}</p>
                    </div>
                  </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <div className="text-right flex items-center gap-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${l.status === 'validado' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-400'}`}>
                          {l.status === 'validado' ? '✓ Validado' : '⏳ Pendente'}
                        </span>
                        <p className={`text-xs font-semibold ${l.tipo === 'receita' ? 'text-emerald-400' : l.tipo === 'despesa' ? 'text-red-400' : 'text-blue-400'}`}>
                          {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                        </p>
                      </div>
                      {l.status !== 'validado' && (
                        <button onClick={() => onValidar(l.id, l.descricao)}
                          className="opacity-0 group-hover:opacity-100 text-[10px] px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-lg hover:bg-emerald-500/30 transition-all ml-1">
                          ✓
                        </button>
                      )}
                      <div className="flex items-center gap-1">
                        <button onClick={() => onEditLancamento(l)}
                          className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 transition-opacity ml-1" title="Editar Lançamento">
                          ✏️
                        </button>
                        <button onClick={() => onDeleteLancamento(l.id)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity ml-1" title="Excluir Lançamento">
                          🗑️
                        </button>
                      </div>
                    </div>
                </div>
              )
            })}
          </div>
        )}

        {pendentes.length > 0 && (
          <div className="mt-3 px-3 py-2 bg-amber-500/8 border border-amber-500/20 rounded-lg">
            <p className="text-xs text-amber-400 font-medium">⚠️ {pendentes.length} lançamento(s) vencido(s) pendente(s) de validação</p>
          </div>
        )}
      </div>

      {modalLanc && (
        <ModalLancamentoConta
          contas={contas} categorias={categorias}
          onClose={() => setModalLanc(false)} onSave={() => setModalLanc(false)}
        />
      )}
    </div>
  )
}
