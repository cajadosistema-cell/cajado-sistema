'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import {
  formatCurrency,
  CATEGORIA_COMPROMISSO,
  STATUS_CONFIG,
  type CompromissoFixo,
  type HistoricoPagamentoMensal,
  type CategoriaCompromisso,
  type StatusPagamento,
} from '../types'

// ── Helpers ──────────────────────────────────────────────────────
function diaHoje() { return new Date().getDate() }
function mesAtualStr() { return new Date().toISOString().substring(0, 7) }
function labelMes(ym: string) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[parseInt(m) - 1]}/${y}`
}
function proximoMes(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const next = new Date(y, m, 1) // m is already 1-indexed +1 = next month
  return next.toISOString().substring(0, 7)
}
function getStatusDia(dia: number | null): 'vencido' | 'urgente' | 'normal' {
  if (!dia) return 'normal'
  const h = diaHoje()
  if (dia < h) return 'vencido'
  if (dia - h <= 3) return 'urgente'
  return 'normal'
}

// ── Categorias agrupadas (blocos) ──
const BLOCOS: { cat: CategoriaCompromisso; label: string; icon: string; corGrad: string }[] = [
  { cat: 'cartao',        label: 'Cartão',          icon: '💳', corGrad: 'from-amber-500/15 to-amber-500/5' },
  { cat: 'boleto_imovel', label: 'Boletos Imóveis',  icon: '🏠', corGrad: 'from-blue-500/15 to-blue-500/5' },
  { cat: 'investimento',  label: 'Investimentos',     icon: '📈', corGrad: 'from-emerald-500/15 to-emerald-500/5' },
  { cat: 'conta_fixa',    label: 'Contas Fixas',      icon: '📋', corGrad: 'from-violet-500/15 to-violet-500/5' },
]

// ── Modal Novo Compromisso ──────────────────────────────────────
function ModalNovoCompromisso({
  userId, categoriaInicial, onClose, onSave,
}: {
  userId: string; categoriaInicial?: CategoriaCompromisso; onClose: () => void; onSave: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    descricao: '',
    valor: '',
    dia_vencimento: '',
    categoria: categoriaInicial || 'conta_fixa' as CategoriaCompromisso,
    recorrente: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.descricao.trim()) return
    setLoading(true); setErro('')
    const { error } = await (supabase.from('compromissos_fixos') as any).insert({
      user_id: userId,
      categoria: form.categoria,
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      recorrente: form.recorrente,
      ativo: true,
    })
    setLoading(false)
    if (error) { setErro(error.message); return }
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">📋 Novo Compromisso Fixo</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1 w-full" required placeholder="Ex: Parcela Apartamento, Nubank, Plano Saúde..."
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input mt-1 w-full" type="number" step="0.01" min="0" required placeholder="0,00"
                value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dia Vencimento</label>
              <input className="input mt-1 w-full" type="number" min="1" max="31" placeholder="Ex: 10"
                value={form.dia_vencimento} onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label mb-2 block">Categoria *</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(CATEGORIA_COMPROMISSO).map(([k, v]) => (
                <button key={k} type="button"
                  onClick={() => setForm(f => ({ ...f, categoria: k as CategoriaCompromisso }))}
                  className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                    form.categoria === k
                      ? 'border-white/30 text-white'
                      : 'border-border-subtle text-fg-tertiary hover:text-fg'
                  )}
                  style={form.categoria === k ? { background: v.cor + '22', borderColor: v.cor + '55' } : {}}>
                  <span>{v.icon}</span><span>{v.label}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-emerald-500"
              checked={form.recorrente}
              onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))} />
            <span className="text-xs text-fg-secondary">Recorrente (repete todo mês)</span>
          </label>
          {erro && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : '📋 Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Editar Compromisso (apenas edição, não criação) ────────
function ModalEditarCompromisso({
  compromisso, onClose, onSave,
}: {
  compromisso: CompromissoFixo; onClose: () => void; onSave: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    descricao: compromisso.descricao,
    valor: String(compromisso.valor),
    dia_vencimento: compromisso.dia_vencimento ? String(compromisso.dia_vencimento) : '',
    categoria: compromisso.categoria,
    recorrente: compromisso.recorrente,
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await (supabase.from('compromissos_fixos') as any).update({
      descricao: form.descricao.trim(),
      valor: parseFloat(form.valor.replace(',', '.')) || 0,
      dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      categoria: form.categoria,
      recorrente: form.recorrente,
      updated_at: new Date().toISOString(),
    }).eq('id', compromisso.id)
    setLoading(false)
    onSave()
    onClose()
  }

  const handleDesativar = async () => {
    if (!confirm(`Desativar "${compromisso.descricao}"?\nNão será mais listado nos próximos meses.`)) return
    await (supabase.from('compromissos_fixos') as any).update({ ativo: false }).eq('id', compromisso.id)
    onSave()
    onClose()
  }

  const cat = CATEGORIA_COMPROMISSO[compromisso.categoria]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="h-16 flex items-center justify-between px-5 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${cat.cor}33, ${cat.cor}11)` }}>
          <div className="flex items-center gap-2">
            <span className="text-xl">{cat.icon}</span>
            <div>
              <p className="text-sm font-bold text-white">Editar Compromisso</p>
              <p className="text-[10px] text-white/50">{cat.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl">×</button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1 w-full" required value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$)</label>
              <input className="input mt-1 w-full" type="number" step="0.01" value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dia Vencimento</label>
              <input className="input mt-1 w-full" type="number" min="1" max="31" value={form.dia_vencimento}
                onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 accent-emerald-500"
              checked={form.recorrente}
              onChange={e => setForm(f => ({ ...f, recorrente: e.target.checked }))} />
            <span className="text-xs text-fg-secondary">Recorrente (repete todo mês)</span>
          </label>
          <div className="flex justify-between pt-2 border-t border-white/5">
            <button type="button" onClick={handleDesativar}
              className="text-xs text-red-400 hover:text-red-300 px-2 py-1">
              🗑️ Desativar
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
              <button type="submit" disabled={loading} className="btn-primary">
                {loading ? 'Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Card de Compromisso ─────────────────────────────────────────
function CompromissoCard({
  compromisso,
  pagamento,
  mesSel,
  onPagar,
  onDesfazer,
  onEdit,
  contasBancarias,
}: {
  compromisso: CompromissoFixo
  pagamento: HistoricoPagamentoMensal | null
  mesSel: string
  onPagar: (compromissoId: string, dataPag: string, contaPagId: string, notas: string) => void
  onDesfazer: (compromissoId: string) => void
  onEdit: (c: CompromissoFixo) => void
  contasBancarias: any[]
}) {
  const [showForm, setShowForm] = useState(false)
  const [dataPag, setDataPag] = useState(new Date().toISOString().split('T')[0])
  const [contaPagId, setContaPagId] = useState('')
  const [notasPag, setNotasPag] = useState('')

  const cat = CATEGORIA_COMPROMISSO[compromisso.categoria] ?? CATEGORIA_COMPROMISSO.outro
  const status: StatusPagamento = pagamento?.status as StatusPagamento ?? 'pendente'
  const statusCfg = STATUS_CONFIG[status]
  const hoje = diaHoje()
  const isVencido = compromisso.dia_vencimento != null && compromisso.dia_vencimento < hoje && status === 'pendente'
  const isUrgente = compromisso.dia_vencimento != null && (compromisso.dia_vencimento - hoje) <= 3 && (compromisso.dia_vencimento - hoje) >= 0 && status === 'pendente'

  return (
    <div className={cn(
      'rounded-xl border transition-all',
      status === 'pago'
        ? 'bg-emerald-500/5 border-emerald-500/15 opacity-70'
        : isVencido
        ? 'bg-red-500/8 border-red-500/25'
        : isUrgente
        ? 'bg-amber-500/8 border-amber-500/25'
        : 'bg-white/3 border-white/5 hover:border-white/10'
    )}>
      <div className="flex items-center gap-3 px-3 py-2.5 group">
        {/* Status icon */}
        <span className="shrink-0 text-sm" title={statusCfg.label}>
          {status === 'pago' ? '✅' : isVencido ? '🚨' : isUrgente ? '⚠️' : '⏳'}
        </span>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className={cn('text-xs font-semibold truncate',
            status === 'pago' ? 'line-through text-fg-tertiary' : 'text-fg'
          )}>
            {compromisso.descricao}
          </p>
          <p className="text-[10px] text-fg-disabled">
            {compromisso.dia_vencimento ? `Vence dia ${compromisso.dia_vencimento}` : 'Sem dia fixo'}
            {isVencido && <span className="text-red-400 ml-1">· Vencida!</span>}
            {isUrgente && !isVencido && (
              <span className="text-amber-400 ml-1">· Vence em {compromisso.dia_vencimento! - hoje} dia(s)</span>
            )}
            {compromisso.recorrente && <span className="text-violet-400 ml-1">· 🔄 Recorrente</span>}
            {status === 'pago' && pagamento?.data_pagamento && (
              <span className="text-emerald-400/70 ml-1">· Pago {new Date(pagamento.data_pagamento + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
            )}
          </p>
        </div>

        {/* Valor */}
        <div className="text-right shrink-0">
          <p className={cn('text-xs font-bold tabular-nums',
            status === 'pago' ? 'text-emerald-400 line-through' : 'text-fg'
          )}>
            {formatCurrency(compromisso.valor)}
          </p>
          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border inline-block mt-0.5', statusCfg.bg)}>
            {statusCfg.label}
          </span>
        </div>

        {/* Ações */}
        <div className="flex items-center gap-1 shrink-0">
          {status === 'pago' ? (
            <button
              onClick={() => onDesfazer(compromisso.id)}
              className="text-[10px] text-red-400 hover:text-red-300 border border-red-500/20 rounded px-2 py-1 transition-colors"
              title="Desfazer pagamento">
              ↩
            </button>
          ) : (
            <button
              onClick={() => setShowForm(!showForm)}
              className="text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 rounded px-2 py-1 transition-colors"
              title="Pagar">
              💳 Pagar
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onEdit(compromisso) }}
            className="shrink-0 w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-fg-tertiary flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            title="Editar">
            ✏️
          </button>
        </div>
      </div>

      {/* Form de pagamento inline */}
      {showForm && status !== 'pago' && (
        <div className="px-3 pb-3 pt-1 border-t border-white/5 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[9px] text-fg-tertiary uppercase">Data Pagamento</label>
              <input type="date" className="input text-xs w-full py-0.5 h-7 mt-0.5"
                value={dataPag} onChange={e => setDataPag(e.target.value)} />
            </div>
            {contasBancarias.length > 0 && (
              <div>
                <label className="text-[9px] text-fg-tertiary uppercase">Debitar da Conta</label>
                <select className="input text-xs w-full py-0.5 h-7 mt-0.5"
                  value={contaPagId} onChange={e => setContaPagId(e.target.value)}>
                  <option value="">— selecione —</option>
                  {contasBancarias.map(c => (
                    <option key={c.id} value={c.id}>{c.nome} ({formatCurrency(c.saldo_atual ?? 0)})</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <div>
            <label className="text-[9px] text-fg-tertiary uppercase">Observações</label>
            <input className="input text-xs w-full py-0.5 h-7 mt-0.5" placeholder="Ex: débito automático"
              value={notasPag} onChange={e => setNotasPag(e.target.value)} />
          </div>
          <div className="flex gap-1.5 justify-end">
            <button onClick={() => setShowForm(false)}
              className="px-2 h-6 rounded bg-white/5 text-fg-disabled text-[10px]">✕ Cancelar</button>
            <button onClick={() => { onPagar(compromisso.id, dataPag, contaPagId, notasPag); setShowForm(false) }}
              className="px-3 h-6 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold hover:bg-emerald-500/30 transition-colors">
              ✅ Confirmar Pagamento
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// TAB PRINCIPAL — CONTROLE UNIFICADO
// ══════════════════════════════════════════════════════════════════
export function TabControleUnificado({ userId }: { userId: string }) {
  const supabase = createClient()
  const [compromissos, setCompromissos] = useState<CompromissoFixo[]>([])
  const [pagamentos, setPagamentos] = useState<HistoricoPagamentoMensal[]>([])
  const [contasBancarias, setContasBancarias] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [mesSel, setMesSel] = useState(mesAtualStr())
  const [modalNovo, setModalNovo] = useState(false)
  const [catNovo, setCatNovo] = useState<CategoriaCompromisso | undefined>()
  const [modalEditar, setModalEditar] = useState<CompromissoFixo | null>(null)
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaCompromisso | 'todos'>('todos')

  // ── Carregar dados ────────────────────────────────────────────────────
  const carregar = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const [{ data: comp }, { data: pag }, { data: contas }] = await Promise.all([
      (supabase.from('compromissos_fixos') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('ativo', true)
        .order('dia_vencimento', { ascending: true, nullsFirst: false }),
      (supabase.from('historico_pagamentos_mensal') as any)
        .select('*')
        .eq('user_id', userId)
        .eq('mes_referencia', mesSel),
      (supabase.from('contas') as any)
        .select('id, nome, tipo, saldo_atual, ativo')
        .eq('user_id', userId)
        .eq('ativo', true)
        .in('tipo', ['corrente', 'poupanca', 'digital', 'investimento']),
    ])
    setCompromissos(comp || [])
    setPagamentos(pag || [])
    setContasBancarias(contas || [])
    setLoading(false)
  }, [userId, mesSel, supabase])

  useEffect(() => { carregar() }, [carregar])

  // ── Pagar compromisso (com débito na conta) ─────────────────────
  const pagarCompromisso = async (compromissoId: string, dataPag: string, contaPagId: string, notas: string) => {
    const comp = compromissos.find(c => c.id === compromissoId)
    if (!comp) return
    const existing = pagamentos.find(p => p.compromisso_id === compromissoId)

    const payload: any = {
      status: 'pago',
      data_pagamento: dataPag || new Date().toISOString().split('T')[0],
      valor_pago: comp.valor,
      notas: notas || null,
    }

    if (existing) {
      await (supabase.from('historico_pagamentos_mensal') as any).update(payload).eq('id', existing.id)
    } else {
      await (supabase.from('historico_pagamentos_mensal') as any).insert({
        user_id: userId,
        compromisso_id: compromissoId,
        mes_referencia: mesSel,
        ...payload,
      })
    }

    // Tenta salvar conta_pagamento_id separadamente (migration 070 pode não existir)
    if (contaPagId) {
      const pagId = existing?.id || (await (supabase.from('historico_pagamentos_mensal') as any)
        .select('id').eq('compromisso_id', compromissoId).eq('mes_referencia', mesSel).single())?.data?.id
      if (pagId) {
        await (supabase.from('historico_pagamentos_mensal') as any)
          .update({ conta_pagamento_id: contaPagId })
          .eq('id', pagId)
          .then(({ error: e }: any) => { if (e) console.warn('conta_pagamento_id não salva:', e.message) })
      }

      // Debitar saldo da conta
      const conta = contasBancarias.find(c => c.id === contaPagId)
      if (conta) {
        const novoSaldo = (conta.saldo_atual ?? 0) - comp.valor
        await (supabase.from('contas') as any)
          .update({ saldo_atual: novoSaldo })
          .eq('id', contaPagId)
      }
    }

    carregar()
  }

  // ── Desfazer pagamento (creditar de volta) ─────────────────────
  const desfazerPagamento = async (compromissoId: string) => {
    const existing = pagamentos.find(p => p.compromisso_id === compromissoId)
    if (!existing) return
    const comp = compromissos.find(c => c.id === compromissoId)

    // Se tinha conta de pagamento, creditar de volta
    if ((existing as any).conta_pagamento_id && comp) {
      const conta = contasBancarias.find(c => c.id === (existing as any).conta_pagamento_id)
      if (conta) {
        const novoSaldo = (conta.saldo_atual ?? 0) + comp.valor
        await (supabase.from('contas') as any)
          .update({ saldo_atual: novoSaldo })
          .eq('id', (existing as any).conta_pagamento_id)
      }
    }

    await (supabase.from('historico_pagamentos_mensal') as any).update({
      status: 'pendente',
      data_pagamento: null,
      valor_pago: null,
      notas: null,
    }).eq('id', existing.id)

    // Limpar conta_pagamento_id
    await (supabase.from('historico_pagamentos_mensal') as any)
      .update({ conta_pagamento_id: null })
      .eq('id', existing.id)
      .then(() => {}) // ignora se coluna não existe

    carregar()
  }

  // ── Métricas ──────────────────────────────────────────────────
  const compFiltrados = filtroCategoria === 'todos'
    ? compromissos
    : compromissos.filter(c => c.categoria === filtroCategoria)

  const totalMes = compFiltrados.reduce((a, c) => a + c.valor, 0)
  const totalPago = compFiltrados.reduce((a, c) => {
    const pag = pagamentos.find(p => p.compromisso_id === c.id)
    return a + (pag?.status === 'pago' ? c.valor : 0)
  }, 0)
  const totalRestante = totalMes - totalPago
  const progresso = totalMes > 0 ? Math.round((totalPago / totalMes) * 100) : 0

  // Soma por dia do mês
  const somasPorDia = useMemo(() => {
    const map = new Map<number, { total: number; pago: number; itens: string[] }>()
    compFiltrados.forEach(c => {
      const dia = c.dia_vencimento ?? 0
      const entry = map.get(dia) ?? { total: 0, pago: 0, itens: [] }
      entry.total += c.valor
      const pag = pagamentos.find(p => p.compromisso_id === c.id)
      if (pag?.status === 'pago') entry.pago += c.valor
      entry.itens.push(c.descricao)
      map.set(dia, entry)
    })
    return Array.from(map.entries())
      .filter(([dia]) => dia > 0)
      .sort((a, b) => a[0] - b[0])
  }, [compFiltrados, pagamentos])

  // Projeção próximo mês
  const compRecorrentes = compromissos.filter(c => c.recorrente)
  const totalProjecao = compRecorrentes.reduce((a, c) => a + c.valor, 0)
  const mesProximo = proximoMes(mesSel)

  // Meses disponíveis
  const mesesDisp = useMemo(() => {
    const meses = new Set<string>([mesAtualStr()])
    compromissos.forEach(() => meses.add(mesAtualStr()))
    pagamentos.forEach(p => meses.add(p.mes_referencia))
    // Adiciona 2 meses anteriores
    for (let i = 1; i <= 2; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() - i)
      meses.add(d.toISOString().substring(0, 7))
    }
    return Array.from(meses).sort().reverse()
  }, [compromissos, pagamentos])

  // Agrupamento por categoria
  const porCategoria = useMemo(() => {
    const map = new Map<CategoriaCompromisso, CompromissoFixo[]>()
    compFiltrados.forEach(c => {
      const list = map.get(c.categoria) ?? []
      list.push(c)
      map.set(c.categoria, list)
    })
    return map
  }, [compFiltrados])

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ── Header com mês e ações ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <select className="input text-xs w-32 py-1.5" value={mesSel} onChange={e => setMesSel(e.target.value)}>
            {mesesDisp.map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
          <span className="text-[10px] text-fg-disabled">{compromissos.length} compromissos ativos</span>
        </div>
        <button onClick={() => { setCatNovo(undefined); setModalNovo(true) }}
          className="btn-primary text-xs">
          + Novo Compromisso
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: `Total (${labelMes(mesSel)})`, value: formatCurrency(totalMes), cor: 'text-fg', bg: 'rgba(139,92,246,0.08)' },
          { label: 'Já Pago', value: formatCurrency(totalPago), cor: 'text-emerald-400', bg: 'rgba(16,185,129,0.1)' },
          { label: 'Restante', value: formatCurrency(totalRestante), cor: totalRestante <= 0 ? 'text-emerald-400' : 'text-red-400', bg: 'rgba(239,68,68,0.08)' },
          { label: 'Progresso', value: `${progresso}%`, cor: progresso >= 80 ? 'text-emerald-400' : 'text-amber-400', bg: 'rgba(245,158,11,0.08)' },
        ].map(k => (
          <div key={k.label} className="bg-surface border border-white/5 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 80% 20%,${k.bg},transparent 70%)` }} />
            <p className="text-[10px] font-medium text-fg-secondary tracking-[0.06em] uppercase mb-2">{k.label}</p>
            <p className={`text-[22px] font-bold ${k.cor}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Barra de progresso ── */}
      <div className="bg-surface border border-white/5 rounded-xl p-4">
        <div className="flex justify-between text-[10px] text-fg-tertiary mb-2">
          <span>Progresso de pagamento — {labelMes(mesSel)}</span>
          <span className="font-bold text-fg">{progresso}% quitado</span>
        </div>
        <div className="h-3 bg-page rounded-full overflow-hidden border border-border-subtle">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progresso}%`,
              background: progresso === 100 ? '#10b981' : progresso > 60 ? '#f59e0b' : '#7c5cfc',
            }}
          />
        </div>
      </div>

      {/* ── Filtros de categoria ── */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFiltroCategoria('todos')}
          className={cn('px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all',
            filtroCategoria === 'todos'
              ? 'bg-white/10 text-white border-white/20'
              : 'text-fg-tertiary border-border-subtle hover:text-fg'
          )}>
          🗂️ Todos ({compromissos.length})
        </button>
        {BLOCOS.map(b => {
          const count = compromissos.filter(c => c.categoria === b.cat).length
          if (count === 0) return null
          const catCfg = CATEGORIA_COMPROMISSO[b.cat]
          return (
            <button key={b.cat}
              onClick={() => setFiltroCategoria(b.cat)}
              className={cn('px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all',
                filtroCategoria === b.cat
                  ? 'text-white border-white/20'
                  : 'text-fg-tertiary border-border-subtle hover:text-fg'
              )}
              style={filtroCategoria === b.cat ? { background: catCfg.cor + '22', borderColor: catCfg.cor + '44' } : {}}>
              {b.icon} {b.label} ({count})
            </button>
          )
        })}
      </div>

      {/* ── Lista por blocos (cronológica) ── */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-12 bg-surface rounded-xl animate-pulse border border-white/5" />)}
        </div>
      ) : compFiltrados.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-border-subtle rounded-2xl">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm font-bold text-fg mb-2">Nenhum compromisso cadastrado</p>
          <p className="text-xs text-fg-tertiary mb-4 max-w-sm mx-auto">
            Adicione cartões, boletos de imóveis, investimentos e contas fixas para controle mensal.
          </p>
          <button onClick={() => setModalNovo(true)} className="btn-primary text-xs mx-auto">
            + Cadastrar Primeiro Compromisso
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {BLOCOS.map(bloco => {
            const itens = porCategoria.get(bloco.cat)
            if (!itens || itens.length === 0) return null
            const subtotal = itens.reduce((a, c) => a + c.valor, 0)
            const subPago = itens.reduce((a, c) => {
              const p = pagamentos.find(pg => pg.compromisso_id === c.id)
              return a + (p?.status === 'pago' ? c.valor : 0)
            }, 0)

            return (
              <div key={bloco.cat} className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
                {/* Header do bloco */}
                <div className={cn('flex items-center justify-between px-4 py-3 bg-gradient-to-r', bloco.corGrad)}>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{bloco.icon}</span>
                    <div>
                      <p className="text-xs font-bold text-fg">{bloco.label}</p>
                      <p className="text-[10px] text-fg-tertiary">
                        {itens.length} item(ns) · Total: {formatCurrency(subtotal)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn('text-xs font-bold', subPago >= subtotal ? 'text-emerald-400' : 'text-amber-400')}>
                      {formatCurrency(subPago)} / {formatCurrency(subtotal)}
                    </p>
                    <button
                      onClick={() => { setCatNovo(bloco.cat); setModalNovo(true) }}
                      className="text-[10px] text-fg-tertiary hover:text-fg mt-0.5">
                      + Adicionar
                    </button>
                  </div>
                </div>
                {/* Itens */}
                <div className="p-3 space-y-1.5">
                  {itens
                    .sort((a, b) => (a.dia_vencimento ?? 99) - (b.dia_vencimento ?? 99))
                    .map(c => (
                      <CompromissoCard
                        key={c.id}
                        compromisso={c}
                        pagamento={pagamentos.find(p => p.compromisso_id === c.id) ?? null}
                        mesSel={mesSel}
                        onPagar={pagarCompromisso}
                        onDesfazer={desfazerPagamento}
                        onEdit={setModalEditar}
                        contasBancarias={contasBancarias}
                      />
                    ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Soma por dia do mês ── */}
      {somasPorDia.length > 0 && (
        <div className="bg-surface border border-white/5 rounded-2xl p-4">
          <p className="text-xs font-bold text-fg-secondary mb-3">📅 Vencimentos por Dia do Mês</p>
          <div className="space-y-1.5">
            {somasPorDia.map(([dia, info]) => {
              const status = getStatusDia(dia)
              const pctPago = info.total > 0 ? Math.round((info.pago / info.total) * 100) : 0
              return (
                <div key={dia} className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-xl border',
                  status === 'vencido' ? 'bg-red-500/5 border-red-500/15' :
                  status === 'urgente' ? 'bg-amber-500/5 border-amber-500/15' :
                  'bg-white/2 border-white/5'
                )}>
                  <span className={cn('text-xs font-bold w-10 shrink-0 tabular-nums',
                    status === 'vencido' ? 'text-red-400' : status === 'urgente' ? 'text-amber-400' : 'text-fg'
                  )}>
                    Dia {dia}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-fg-tertiary truncate">{info.itens.join(' · ')}</p>
                    <div className="h-1 bg-page rounded-full mt-1 overflow-hidden">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pctPago}%` }} />
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-fg tabular-nums">{formatCurrency(info.total)}</p>
                    <p className="text-[10px] text-emerald-400 tabular-nums">{pctPago}% pago</p>
                  </div>
                </div>
              )
            })}
          </div>
          {/* Total parcial: soma de todos os dias até hoje */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <span className="text-xs text-fg-tertiary">Total vencido até dia {diaHoje()}</span>
            <span className="text-xs font-bold text-fg tabular-nums">
              {formatCurrency(somasPorDia.filter(([d]) => d <= diaHoje()).reduce((a, [, i]) => a + i.total, 0))}
            </span>
          </div>
        </div>
      )}

      {/* ── Projeção próximo mês ── */}
      {compRecorrentes.length > 0 && (
        <div className="bg-surface border border-white/5 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-fg-secondary">🔮 Projeção — {labelMes(mesProximo)}</p>
            <span className="text-xs text-fg-disabled">{compRecorrentes.length} compromisso(s) recorrente(s)</span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-page rounded-xl p-3 border border-border-subtle">
              <p className="text-[10px] text-fg-disabled uppercase tracking-wide mb-1">Mês Atual</p>
              <p className="text-sm font-bold text-fg">{formatCurrency(totalMes)}</p>
            </div>
            <div className="bg-page rounded-xl p-3 border border-border-subtle">
              <p className="text-[10px] text-fg-disabled uppercase tracking-wide mb-1">Projeção {labelMes(mesProximo)}</p>
              <p className="text-sm font-bold text-amber-400">{formatCurrency(totalProjecao)}</p>
            </div>
          </div>
          <div className="space-y-1">
            {compRecorrentes
              .sort((a, b) => (a.dia_vencimento ?? 99) - (b.dia_vencimento ?? 99))
              .map(c => {
                const cat = CATEGORIA_COMPROMISSO[c.categoria]
                return (
                  <div key={c.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/3 border border-white/5">
                    <span className="text-sm shrink-0">{cat.icon}</span>
                    <span className="text-xs text-fg truncate flex-1">{c.descricao}</span>
                    <span className="text-[10px] text-fg-disabled shrink-0">
                      {c.dia_vencimento ? `Dia ${c.dia_vencimento}` : '—'}
                    </span>
                    <span className="text-xs font-bold text-fg shrink-0 tabular-nums">{formatCurrency(c.valor)}</span>
                  </div>
                )
              })}
          </div>
          <p className="text-[10px] text-fg-disabled mt-3">
            * Projeção baseada nos compromissos recorrentes. Valores podem variar.
          </p>
        </div>
      )}

      {/* ── Histórico resumido ── */}
      <div className="bg-surface border border-white/5 rounded-2xl p-4">
        <p className="text-xs font-bold text-fg-secondary mb-3">📊 Sequência Cronológica Resumida</p>
        <div className="space-y-1">
          {compFiltrados
            .sort((a, b) => (a.dia_vencimento ?? 99) - (b.dia_vencimento ?? 99))
            .map((c, i) => {
              const pag = pagamentos.find(p => p.compromisso_id === c.id)
              const cat = CATEGORIA_COMPROMISSO[c.categoria]
              const status: StatusPagamento = (pag?.status as StatusPagamento) ?? 'pendente'
              const statusCfg = STATUS_CONFIG[status]
              return (
                <div key={c.id} className="flex items-center gap-2 text-[11px]">
                  <span className="text-fg-disabled w-10 shrink-0 tabular-nums text-right">
                    {c.dia_vencimento ? `Dia ${c.dia_vencimento}` : '—'}
                  </span>
                  <span className="shrink-0">{cat.icon}</span>
                  <span className="text-fg truncate flex-1">{c.descricao}</span>
                  <span className="text-fg font-bold tabular-nums shrink-0">{formatCurrency(c.valor)}</span>
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0', statusCfg.bg)}>
                    {statusCfg.icon} {statusCfg.label}
                  </span>
                </div>
              )
            })}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
          <span className="text-xs font-semibold text-fg-secondary">Total do Mês</span>
          <span className="text-sm font-bold text-fg">{formatCurrency(totalMes)}</span>
        </div>
      </div>

      {/* ── Modais ── */}
      {modalNovo && (
        <ModalNovoCompromisso
          userId={userId}
          categoriaInicial={catNovo}
          onClose={() => setModalNovo(false)}
          onSave={carregar}
        />
      )}
      {modalEditar && (
        <ModalEditarCompromisso
          compromisso={modalEditar}
          onClose={() => setModalEditar(null)}
          onSave={carregar}
        />
      )}
    </div>
  )
}
