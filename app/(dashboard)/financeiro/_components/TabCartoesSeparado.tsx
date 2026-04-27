'use client'

import { useState } from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { EmptyState } from '@/components/shared/ui'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'

// ── Bandeiras ────────────────────────────────────────────────
const BANDEIRAS = [
  { id: 'visa',       label: 'Visa',        emoji: '💳', cor: '#1a1f71' },
  { id: 'mastercard', label: 'Mastercard',  emoji: '🔴', cor: '#eb001b' },
  { id: 'elo',        label: 'Elo',         emoji: '🟡', cor: '#c8a800' },
  { id: 'amex',       label: 'Amex',        emoji: '💎', cor: '#2e77bc' },
  { id: 'hipercard',  label: 'Hipercard',   emoji: '🔶', cor: '#e22c1b' },
  { id: 'outras',     label: 'Outras',      emoji: '💳', cor: '#6b7280' },
]

const COLORS = ['#10b981', '#3b82f6', '#f5a623', '#8b5cf6', '#ec4899', '#f43f5e']

function BandeiraBadge({ bandeira, size = 'sm' }: { bandeira?: string; size?: 'sm' | 'lg' }) {
  const b = BANDEIRAS.find(x => x.id === bandeira) ?? BANDEIRAS[BANDEIRAS.length - 1]
  const cls = size === 'lg'
    ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider'
    : 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider'
  return (
    <span className={cls} style={{ background: b.cor + '22', color: b.cor, border: `1px solid ${b.cor}44` }}>
      {b.emoji} {b.label}
    </span>
  )
}

// ── Mini card visual ─────────────────────────────────────────
function CardVisual({ conta, selected, onClick }: { conta: any; selected: boolean; onClick: () => void }) {
  const band = BANDEIRAS.find(b => b.id === conta.bandeira) ?? BANDEIRAS[BANDEIRAS.length - 1]
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'relative flex flex-col justify-between rounded-2xl p-4 border transition-all cursor-pointer overflow-hidden min-w-[180px] h-[110px]',
        selected ? 'ring-2 ring-white/30 scale-[1.02] shadow-xl' : 'opacity-70 hover:opacity-90'
      )}
      style={{ background: `linear-gradient(135deg, ${band.cor}cc, ${band.cor}88)`, borderColor: band.cor + '44' }}
    >
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 1px, transparent 10px)' }} />
      <div className="flex justify-between items-start relative z-10">
        <span className="text-white/80 text-[10px] font-semibold uppercase tracking-wider">{conta.categoria === 'pj' ? '🏢 PJ' : '👤 PF'}</span>
        <span className="text-lg">{band.emoji}</span>
      </div>
      <div className="relative z-10">
        <p className="text-white font-bold text-sm truncate">{conta.nome_cartao || conta.nome}</p>
        <p className="text-white/70 text-[10px] mt-0.5">{band.label} {conta.limite ? `· Lim. ${formatCurrency(conta.limite)}` : ''}</p>
      </div>
    </button>
  )
}

// ── Modal Lançamento Cartão ──────────────────────────────────
function ModalLancamentoCartao({ cartoes, categorias, onClose, onSave, cartaoInicial }: {
  cartoes: any[]; categorias: any[]; onClose: () => void; onSave: () => void; cartaoInicial?: string
}) {
  const supabase = createClient()
  const today = new Date().toISOString().split('T')[0]
  const [cartaoId, setCartaoId] = useState(cartaoInicial || cartoes[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    descricao: '', valor: '', tipo: 'despesa' as 'despesa' | 'receita',
    data_competencia: today, categoria_id: '', total_parcelas: '1',
  })
  const cartaoSel = cartoes.find(c => c.id === cartaoId)
  const band = BANDEIRAS.find(b => b.id === cartaoSel?.bandeira) ?? BANDEIRAS[BANDEIRAS.length - 1]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) { setErro('Informe um valor válido.'); return }
    if (!cartaoId) { setErro('Selecione um cartão.'); return }
    setLoading(true)
    setErro('')

    const parcelas = parseInt(form.total_parcelas) || 1
    let errFinal: any = null

    if (parcelas > 1) {
      // Parcelado — insere cada parcela
      for (let i = 1; i <= parcelas; i++) {
        const d = new Date(form.data_competencia)
        d.setMonth(d.getMonth() + (i - 1))
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: cartaoId,
          descricao: `${form.descricao} (${i}/${parcelas})`,
          valor: valor / parcelas,
          tipo: form.tipo,
          regime: 'competencia',
          status: 'pendente',
          data_competencia: d.toISOString().split('T')[0],
          categoria_id: form.categoria_id || null,
          parcela_atual: i,
          total_parcelas: parcelas,
        })
        if (error) { errFinal = error; break }
      }
    } else {
      // Simples
      const { error } = await (supabase.from('lancamentos') as any).insert({
        conta_id: cartaoId,
        descricao: form.descricao,
        valor,
        tipo: form.tipo,
        regime: 'competencia',
        status: 'pendente',
        data_competencia: form.data_competencia,
        categoria_id: form.categoria_id || null,
        total_parcelas: 1,
      })
      if (error) errFinal = error
    }

    setLoading(false)
    if (errFinal) {
      // Tenta sem campos opcionais que podem não existir
      const { error: err2 } = await (supabase.from('lancamentos') as any).insert({
        conta_id: cartaoId,
        descricao: form.descricao,
        valor,
        tipo: form.tipo,
        status: 'pendente',
        data_competencia: form.data_competencia,
        categoria_id: form.categoria_id || null,
      })
      if (err2) {
        setErro(`Erro: ${err2.message}`)
        return
      }
    }

    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-fg">Lançamento no Cartão</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Seletor de cartão visual */}
          <div>
            <label className="label mb-2">Selecione o Cartão *</label>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {cartoes.map(c => (
                <CardVisual key={c.id} conta={c} selected={cartaoId === c.id} onClick={() => setCartaoId(c.id)} />
              ))}
            </div>
            {cartaoSel && (
              <div className="flex items-center gap-2 mt-2 px-3 py-2 bg-muted/50 rounded-xl border border-border-subtle">
                <BandeiraBadge bandeira={cartaoSel.bandeira} size="lg" />
                <span className="text-sm text-fg font-medium">{cartaoSel.nome_cartao || cartaoSel.nome}</span>
                {cartaoSel.dia_fechamento && (
                  <span className="text-xs text-fg-tertiary ml-auto">Fecha dia {cartaoSel.dia_fechamento} · Vence dia {cartaoSel.dia_vencimento}</span>
                )}
              </div>
            )}
          </div>

          {/* Tipo */}
          <div className="grid grid-cols-2 gap-2 bg-muted/50 p-1 rounded-lg">
            {(['despesa', 'receita'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, tipo: t, categoria_id: '' }))}
                className={cn('py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                  form.tipo === t
                    ? t === 'despesa' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    : 'text-fg-tertiary hover:text-fg-secondary'
                )}>
                {t === 'despesa' ? '💸 Despesa' : '💰 Receita/Estorno'}
              </button>
            ))}
          </div>

          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              placeholder={`Ex: Compra ${cartaoSel?.nome_cartao || 'cartão'}...`}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input mt-1" required type="number" step="0.01" min="0.01"
                value={form.valor} placeholder="0.00"
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
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
              <label className="label">Data da Compra *</label>
              <input className="input mt-1" type="date" required value={form.data_competencia}
                onChange={e => setForm(f => ({ ...f, data_competencia: e.target.value }))} />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input mt-1" value={form.categoria_id}
                onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                <option value="">Sem categoria</option>
                {categorias.filter(c => c.tipo === form.tipo).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>

          {erro && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
              {erro}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading || !cartaoId} className="btn-primary">
              {loading ? 'Salvando...' : `Registrar no ${cartaoSel?.nome_cartao || cartaoSel?.nome || 'Cartão'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Criar Cartão ───────────────────────────────────────
function ModalCriarCartao({ onClose, onSave, categoriaDefault = 'pj' }: {
  onClose: () => void; onSave: () => void; categoriaDefault?: string
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    nome_cartao: '',
    bandeira: 'visa',
    categoria: categoriaDefault as 'pj' | 'pf',
    tipo: 'cartao_credito' as 'cartao_credito' | 'cartao_debito',
  })
  const band = BANDEIRAS.find(b => b.id === form.bandeira) ?? BANDEIRAS[0]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome_cartao.trim()) return
    setLoading(true)
    setErro('')

    // Tentativa 1: com todos os campos de cartão
    const { error: err1 } = await (supabase.from('contas') as any).insert({
      nome: form.nome_cartao,
      nome_cartao: form.nome_cartao,
      tipo: form.tipo,
      categoria: form.categoria,
      bandeira: form.bandeira,
      saldo_inicial: 0,
      saldo_atual: 0,
      ativo: true,
      cor: band.cor,
    })

    if (!err1) {
      setLoading(false)
      onSave(); onClose()
      return
    }

    // Tentativa 2: fallback sem colunas extras (se ainda não existirem no BD)
    const { error: err2 } = await (supabase.from('contas') as any).insert({
      nome: `[${band.emoji} ${form.bandeira.toUpperCase()}] ${form.nome_cartao}`,
      tipo: form.tipo,
      categoria: form.categoria,
      saldo_inicial: 0,
      saldo_atual: 0,
      ativo: true,
      cor: band.cor,
    })

    setLoading(false)
    if (!err2) {
      // Salvou sem as colunas extras — avisar sobre migração
      setErro('⚠️ Cartão salvo sem bandeira/nome específico. Execute a migração SQL no Supabase para habilitar todos os campos.')
      setTimeout(() => { onSave(); onClose() }, 3000)
    } else {
      setErro(`Erro ao salvar: ${err2.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
        {/* Preview do cartão */}
        <div
          className="h-28 flex flex-col justify-between p-4 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${band.cor}cc, ${band.cor}66)` }}
        >
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 1px, transparent 10px)' }} />
          <div className="flex justify-between items-start relative z-10">
            <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider">
              {form.tipo === 'cartao_credito' ? 'Crédito' : 'Débito'} · {form.categoria.toUpperCase()}
            </span>
            <span className="text-2xl">{band.emoji}</span>
          </div>
          <div className="relative z-10">
            <p className="text-white font-bold text-sm">{form.nome_cartao || 'Nome do Cartão'}</p>
            <p className="text-white/60 text-[10px]">{band.label}</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-fg">Novo Cartão</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Nome do Cartão *</label>
            <input className="input mt-1" required value={form.nome_cartao}
              placeholder="Ex: Cartão da Esposa, Nubank PJ, Inter PF..."
              onChange={e => setForm(f => ({ ...f, nome_cartao: e.target.value }))} />
          </div>

          <div>
            <label className="label">Bandeira *</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {BANDEIRAS.map(b => (
                <button type="button" key={b.id}
                  onClick={() => setForm(f => ({ ...f, bandeira: b.id }))}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all',
                    form.bandeira === b.id
                      ? 'border-white/40 text-white shadow-md'
                      : 'border-border-subtle text-fg-tertiary hover:border-border hover:text-fg'
                  )}
                  style={form.bandeira === b.id ? { background: b.cor + '33', borderColor: b.cor + '66' } : {}}>
                  <span>{b.emoji}</span> {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as any }))}>
                <option value="cartao_credito">Crédito</option>
                <option value="cartao_debito">Débito</option>
              </select>
            </div>
            <div>
              <label className="label">Classificação</label>
              <select className="input mt-1" value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value as any }))}>
                <option value="pj">🏢 PJ (Empresa)</option>
                <option value="pf">👤 PF (Pessoal)</option>
              </select>
            </div>
          </div>

          {erro && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400">
              {erro}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : '💳 Criar Cartão'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function TabCartoesSeparado({ contas, lancamentos, categorias, onImportar, onRefresh, onEditLancamento, onDeleteLancamento, onDeleteConta }: {
  contas: any[]; lancamentos: any[]; categorias: any[];
  onImportar: () => void; onRefresh?: () => void;
  onEditLancamento: (l: any) => void;
  onDeleteLancamento: (id: string) => void;
  onDeleteConta: (id: string) => void;
}) {
  const cartoes = contas.filter(c => c.tipo === 'cartao_credito' || c.tipo === 'cartao_debito')
  const [cartaoSel, setCartaoSel] = useState(cartoes[0]?.id ?? 'todos')
  const [modalLanc, setModalLanc] = useState(false)
  const [modalCriar, setModalCriar] = useState(false)
  const [subAba, setSubAba] = useState<'lancamentos' | 'cadastro'>('lancamentos')
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')

  if (cartoes.length === 0 && subAba === 'lancamentos') {
    // Mantém sub-abas visíveis mas mostra vazio dentro do lançamentos
  }

  const gastosTudo = lancamentos.filter(l =>
    cartoes.some(c => c.id === l.conta_id) &&
    (cartaoSel === 'todos' || l.conta_id === cartaoSel)
  )
  const despesas = gastosTudo.filter(l => l.tipo === 'despesa')
  const receitas = gastosTudo.filter(l => l.tipo === 'receita')
  const totalDespesas = despesas.reduce((a, l) => a + l.valor, 0)
  const totalReceitas = receitas.reduce((a, l) => a + l.valor, 0)

  // Agrupamento por categoria
  const catMap: Record<string, number> = {}
  despesas.forEach(g => {
    const cat = g.categoria_id
      ? categorias.find((c: any) => c.id === g.categoria_id)?.nome || 'Outros'
      : 'Sem Categoria'
    catMap[cat] = (catMap[cat] || 0) + g.valor
  })
  const dataCat = Object.entries(catMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)

  const lancFiltrados = gastosTudo.filter(l => {
    const okTipo = filtroTipo ? l.tipo === filtroTipo : true
    const okBusca = busca ? l.descricao?.toLowerCase().includes(busca.toLowerCase()) : true
    return okTipo && okBusca
  })

  return (
    <div className="space-y-4 mt-4">

      {/* Sub-abas internas — sempre visíveis */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 bg-page border border-border-subtle rounded-xl p-1">
          {([
            { id: 'lancamentos', label: '💸 Lançamentos' },
            { id: 'cadastro',    label: '💳 Cadastro de Cartões' },
          ] as const).map(tab => (
            <button key={tab.id} onClick={() => setSubAba(tab.id)}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                subAba === tab.id ? 'bg-muted text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
              )}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={onImportar} className="btn-secondary text-xs">📥 Importar Extrato</button>
          {subAba === 'lancamentos'
            ? <button onClick={() => setModalLanc(true)} disabled={cartoes.length === 0} className="btn-primary text-xs disabled:opacity-50">+ Lançar no Cartão</button>
            : <button onClick={() => setModalCriar(true)} className="btn-primary text-xs">+ Novo Cartão</button>
          }
        </div>
      </div>

      {/* ── ABA LANÇAMENTOS ─────────────────────────────────── */}
      {subAba === 'lancamentos' && (
        <div className="space-y-4">
          {cartoes.length === 0 ? (
            <div className="bg-surface border border-white/5 rounded-xl p-10 text-center">
              <div className="text-4xl mb-3">💳</div>
              <h3 className="text-sm font-bold text-fg mb-2">Nenhum cartão cadastrado ainda</h3>
              <p className="text-xs text-fg-tertiary mb-4">
                Vá para a aba <strong className="text-amber-400">Cadastro de Cartões</strong> para adicionar seu primeiro cartão.
              </p>
              <button onClick={() => setSubAba('cadastro')} className="btn-primary text-xs">
                💳 Ir para Cadastro
              </button>
            </div>
          ) : (
            <>
          {/* Seletor de cartão */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            <button onClick={() => setCartaoSel('todos')}
              className={cn('flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
                cartaoSel === 'todos' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-border-subtle text-fg-tertiary hover:text-fg'
              )}>
              🗂️ Todos ({cartoes.length})
            </button>
            {cartoes.map(c => (
              <CardVisual key={c.id} conta={c} selected={cartaoSel === c.id} onClick={() => setCartaoSel(c.id)} />
            ))}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Despesas', val: totalDespesas, color: 'text-red-400', bg: 'bg-red-500/10' },
              { label: 'Receitas/Estornos', val: totalReceitas, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Saldo Fatura', val: totalReceitas - totalDespesas, color: (totalReceitas - totalDespesas) >= 0 ? 'text-emerald-400' : 'text-red-400', bg: 'bg-blue-500/10' },
            ].map(({ label, val, color, bg }) => (
              <div key={label} className={`${bg} border border-white/5 rounded-xl p-4`}>
                <p className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-xl font-bold ${color}`}>{formatCurrency(val)}</p>
              </div>
            ))}
          </div>

          {/* Gráfico + Lista completa */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Gráfico de categorias */}
            <div className="bg-surface border border-white/5 rounded-xl p-4 md:col-span-2">
              <p className="text-xs text-fg-tertiary uppercase tracking-wider mb-3">Por Categoria</p>
              {dataCat.length === 0 ? (
                <EmptyState message="Nenhum gasto no cartão" />
              ) : (
                <div className="flex items-center gap-4">
                  <div className="h-[150px] w-[150px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={dataCat} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                          paddingAngle={3} dataKey="value" stroke="none">
                          {dataCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => formatCurrency(v)}
                          contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: 8, fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {dataCat.slice(0, 5).map((d, i) => (
                      <div key={d.name}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="text-fg-secondary flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                            {d.name}
                          </span>
                          <span className="font-semibold text-fg">{formatCurrency(d.value)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1">
                          <div className="h-1 rounded-full" style={{ width: `${(d.value / totalDespesas) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Lista de lançamentos com filtro */}
            <div className="bg-surface border border-white/5 rounded-xl p-4 md:col-span-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-fg-tertiary uppercase tracking-wider">Lançamentos</p>
                <span className="text-[10px] text-fg-disabled">{lancFiltrados.length} registro(s)</span>
              </div>
              <div className="flex gap-2 mb-3">
                <input className="input text-xs flex-1" placeholder="🔍 Buscar..."
                  value={busca} onChange={e => setBusca(e.target.value)} />
                <select className="input text-xs w-28" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="despesa">Despesas</option>
                  <option value="receita">Receitas</option>
                </select>
              </div>
              {lancFiltrados.length === 0 ? (
                <EmptyState message="Nenhum lançamento encontrado" />
              ) : (
                <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {lancFiltrados.map(l => {
                    const cartao = cartoes.find(c => c.id === l.conta_id)
                    return (
                      <div key={l.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-black/20 border border-white/5 hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-2 min-w-0">
                          <BandeiraBadge bandeira={cartao?.bandeira} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-fg truncate">{l.descricao}</p>
                            <p className="text-[10px] text-fg-tertiary">{l.data_competencia} · {cartao?.nome_cartao || cartao?.nome}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <p className={`text-xs font-semibold ${l.tipo === 'despesa' ? 'text-red-400' : 'text-emerald-400'}`}>
                            {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                          </p>
                          <div className="flex items-center gap-1">
                            <button onClick={() => onEditLancamento(l)}
                              className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 transition-opacity" title="Editar Lançamento">
                              ✏️
                            </button>
                            <button onClick={() => onDeleteLancamento(l.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity" title="Excluir Lançamento">
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
            </>
          )}
        </div>
      )}

      {/* ── ABA CADASTRO ────────────────────────────────────── */}
      {subAba === 'cadastro' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {cartoes.map(c => {
              const band = BANDEIRAS.find(b => b.id === c.bandeira) ?? BANDEIRAS[BANDEIRAS.length - 1]
              const gastos = lancamentos.filter(l => l.conta_id === c.id && l.tipo === 'despesa').reduce((a: number, l: any) => a + l.valor, 0)
              return (
                <div key={c.id} className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
                  {/* Visual do cartão */}
                  <div className="h-24 relative flex flex-col justify-between p-3 overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${band.cor}cc, ${band.cor}66)` }}>
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, white 0, white 1px, transparent 1px, transparent 10px)' }} />
                    <div className="flex justify-between items-start relative z-10">
                      <span className="text-white/70 text-[9px] font-bold uppercase tracking-wider">
                        {c.tipo === 'cartao_credito' ? 'Crédito' : 'Débito'} · {c.categoria?.toUpperCase()}
                      </span>
                      <span className="text-xl">{band.emoji}</span>
                    </div>
                    <div className="relative z-10">
                      <p className="text-white font-bold text-sm truncate">{c.nome_cartao || c.nome}</p>
                      <p className="text-white/60 text-[9px]">{band.label}</p>
                    </div>
                  </div>
                  {/* Detalhes */}
                  <div className="p-3 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="text-fg-tertiary">Gasto no mês</span>
                      <span className="font-semibold text-red-400">{formatCurrency(gastos)}</span>
                    </div>
                    {c.limite && (
                      <>
                        <div className="flex justify-between text-xs">
                          <span className="text-fg-tertiary">Limite</span>
                          <span className="font-semibold text-fg">{formatCurrency(c.limite)}</span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
                          <div className="h-1.5 rounded-full bg-red-500/70 transition-all"
                            style={{ width: `${Math.min((gastos / c.limite) * 100, 100)}%` }} />
                        </div>
                        <p className="text-[9px] text-fg-disabled text-right">
                          {((gastos / c.limite) * 100).toFixed(0)}% do limite usado
                        </p>
                      </>
                    )}
                    {(c.dia_fechamento || c.dia_vencimento) && (
                      <div className="flex justify-between text-[10px] text-fg-tertiary pt-1 border-t border-border-subtle">
                        <span>Fecha dia {c.dia_fechamento || '—'}</span>
                        <span>Vence dia {c.dia_vencimento || '—'}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => { setCartaoSel(c.id); setSubAba('lancamentos'); setModalLanc(true) }}
                        className="flex-1 btn-ghost text-xs">
                        + Lançar
                      </button>
                      <button
                        onClick={() => onDeleteConta(c.id)}
                        className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                        title="Excluir Cartão"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
            {/* Card para adicionar novo */}
            <button onClick={() => setModalCriar(true)}
              className="border-2 border-dashed border-border-subtle rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-fg-disabled hover:border-amber-500/40 hover:text-amber-400 transition-all min-h-[180px]">
              <span className="text-3xl">+</span>
              <span className="text-xs font-semibold">Adicionar Cartão</span>
            </button>
          </div>
        </div>
      )}

      {modalLanc && (
        <ModalLancamentoCartao
          cartoes={cartoes}
          categorias={categorias}
          cartaoInicial={cartaoSel !== 'todos' ? cartaoSel : cartoes[0]?.id}
          onClose={() => setModalLanc(false)}
          onSave={() => setModalLanc(false)}
        />
      )}
      {modalCriar && (
        <ModalCriarCartao
          onClose={() => setModalCriar(false)}
          onSave={() => { setModalCriar(false); onRefresh?.() }}
        />
      )}
    </div>
  )
}
