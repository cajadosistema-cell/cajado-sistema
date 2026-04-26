'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ModalImportarExtratoIA } from '@/components/shared/ModalImportarExtratoIA'

const BANDEIRAS = [
  { id: 'visa',       label: 'Visa',       emoji: '💳', cor: '#1a1f71' },
  { id: 'mastercard', label: 'Mastercard', emoji: '🔴', cor: '#eb001b' },
  { id: 'elo',        label: 'Elo',        emoji: '🟡', cor: '#c8a800' },
  { id: 'amex',       label: 'Amex',       emoji: '💎', cor: '#2e77bc' },
  { id: 'hipercard',  label: 'Hipercard',  emoji: '🔶', cor: '#e22c1b' },
  { id: 'outras',     label: 'Outras',     emoji: '💳', cor: '#6b7280' },
]

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function getBand(id?: string) {
  return BANDEIRAS.find(b => b.id === id) ?? BANDEIRAS[BANDEIRAS.length - 1]
}

// ── Preview visual do cartão ────────────────────────────────────
function CardVisual({ conta, selected, onClick }: { conta: any; selected: boolean; onClick: () => void }) {
  const band = getBand(conta.bandeira)
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'relative flex flex-col justify-between rounded-2xl p-4 border transition-all cursor-pointer overflow-hidden min-w-[180px] h-[110px]',
        selected ? 'ring-2 ring-white/30 scale-[1.02] shadow-xl' : 'opacity-70 hover:opacity-90'
      )}
      style={{ background: `linear-gradient(135deg, ${band.cor}cc, ${band.cor}88)`, borderColor: band.cor + '44' }}
    >
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 10px)' }} />
      <div className="flex justify-between items-start relative z-10">
        <span className="text-white/80 text-[10px] font-semibold uppercase tracking-wider">👤 PF</span>
        <span className="text-lg">{band.emoji}</span>
      </div>
      <div className="relative z-10">
        <p className="text-white font-bold text-sm truncate">{conta.nome_cartao || conta.nome}</p>
        <p className="text-white/70 text-[10px] mt-0.5">{band.label}{conta.limite ? ` · Lim. ${fmt(conta.limite)}` : ''}</p>
      </div>
    </button>
  )
}

// ── Modal Novo Cartão PF ────────────────────────────────────────
function ModalNovoCarta({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    nome_cartao: '', bandeira: 'visa', tipo: 'cartao_credito',
    limite: '', dia_fechamento: '', dia_vencimento: '',
  })
  const band = getBand(form.bandeira)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome_cartao.trim()) return
    setLoading(true)
    setErro('')
    const { error } = await (supabase.from('contas') as any).insert({
      nome: form.nome_cartao,
      nome_cartao: form.nome_cartao,
      tipo: form.tipo,
      categoria: 'pf',
      bandeira: form.bandeira,
      saldo_inicial: 0,
      saldo_atual: 0,
      ativo: true,
      cor: band.cor,
      limite: form.limite ? Number(form.limite) : null,
      dia_fechamento: form.dia_fechamento ? Number(form.dia_fechamento) : null,
      dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
    })
    setLoading(false)
    if (error) { setErro(error.message); return }
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Preview */}
        <div className="h-28 flex flex-col justify-between p-4 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${band.cor}cc, ${band.cor}66)` }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 10px)' }} />
          <div className="flex justify-between items-start relative z-10">
            <span className="text-white/70 text-[10px] font-bold uppercase tracking-wider">
              {form.tipo === 'cartao_credito' ? 'Crédito' : 'Débito'} · PF
            </span>
            <span className="text-2xl">{band.emoji}</span>
          </div>
          <div className="relative z-10">
            <p className="text-white font-bold text-sm">{form.nome_cartao || 'Nome do Cartão'}</p>
            <p className="text-white/60 text-[10px]">{band.label}</p>
          </div>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">💳 Novo Cartão PF</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Nome do Cartão *</label>
            <input className="input mt-1 w-full" required placeholder="Ex: Nubank PF, Inter Pessoal..."
              value={form.nome_cartao} onChange={e => setForm(f => ({ ...f, nome_cartao: e.target.value }))} />
          </div>

          <div>
            <label className="label mb-2 block">Bandeira *</label>
            <div className="grid grid-cols-3 gap-2">
              {BANDEIRAS.map(b => (
                <button type="button" key={b.id}
                  onClick={() => setForm(f => ({ ...f, bandeira: b.id }))}
                  className={cn('flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all',
                    form.bandeira === b.id
                      ? 'border-white/40 text-white'
                      : 'border-border-subtle text-fg-tertiary hover:text-fg'
                  )}
                  style={form.bandeira === b.id ? { background: b.cor + '33', borderColor: b.cor + '66' } : {}}>
                  {b.emoji} {b.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1 w-full" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}>
                <option value="cartao_credito">Crédito</option>
                <option value="cartao_debito">Débito</option>
              </select>
            </div>
            <div>
              <label className="label">Limite (R$)</label>
              <input className="input mt-1 w-full" type="number" placeholder="0,00"
                value={form.limite} onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dia Fechamento</label>
              <input className="input mt-1 w-full" type="number" min="1" max="31" placeholder="Ex: 15"
                value={form.dia_fechamento} onChange={e => setForm(f => ({ ...f, dia_fechamento: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dia Vencimento</label>
              <input className="input mt-1 w-full" type="number" min="1" max="31" placeholder="Ex: 22"
                value={form.dia_vencimento} onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} />
            </div>
          </div>

          {erro && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{erro}</p>}

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
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

// ── Modal Lançar no Cartão PF → gastos_pessoais ─────────────────
function ModalLancamentoPF({ cartoes, userId, onClose, onSave }: {
  cartoes: any[]; userId: string; onClose: () => void; onSave: () => void
}) {
  const supabase = createClient()
  const [cartaoId, setCartaoId] = useState(cartoes[0]?.id || '')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    descricao: '', valor: '', tipo: 'gasto' as 'gasto' | 'receita',
    data: new Date().toISOString().split('T')[0],
    categoria: 'outros', total_parcelas: '1',
  })

  const CAT_GASTOS = ['alimentacao','transporte','saude','lazer','educacao','moradia','vestuario','tecnologia','investimento','outros']
  const CAT_RECEITAS = ['pro_labore','freelance','investimentos','aluguel','vendas','outros']
  const cartao = cartoes.find(c => c.id === cartaoId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) return
    setLoading(true)

    const parcelas = parseInt(form.total_parcelas) || 1
    const forma = cartao?.tipo === 'cartao_debito' ? 'cartao_debito' : 'cartao_credito'

    for (let i = 1; i <= parcelas; i++) {
      const d = new Date(form.data + 'T12:00:00')
      d.setMonth(d.getMonth() + (i - 1))
      const dataStr = d.toISOString().split('T')[0]
      const desc = parcelas > 1 ? `${form.descricao} (${i}/${parcelas})` : form.descricao

      if (form.tipo === 'gasto') {
        await (supabase.from('gastos_pessoais') as any).insert({
          user_id: userId, descricao: desc,
          valor: valor / parcelas, categoria: form.categoria,
          data: dataStr, forma_pagamento: forma,
        })
      } else {
        await (supabase.from('receitas_pessoais') as any).insert({
          user_id: userId, descricao: desc,
          valor: valor / parcelas, categoria: form.categoria, data: dataStr,
        })
      }
    }

    setLoading(false)
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">Lançar no Cartão PF</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {cartoes.map(c => (
              <CardVisual key={c.id} conta={c} selected={cartaoId === c.id} onClick={() => setCartaoId(c.id)} />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2 bg-white/3 p-1 rounded-lg">
            {(['gasto', 'receita'] as const).map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo: t, categoria: 'outros' }))}
                className={cn('py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                  form.tipo === t
                    ? t === 'gasto' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                    : 'text-fg-tertiary hover:text-fg-secondary'
                )}>
                {t === 'gasto' ? '💸 Gasto' : '💰 Receita/Estorno'}
              </button>
            ))}
          </div>

          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1 w-full" required placeholder="Ex: Mercado, Restaurante..."
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input mt-1 w-full" required type="number" step="0.01" min="0.01"
                value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label className="label">Parcelas</label>
              <input className="input mt-1 w-full" type="number" min="1" max="60"
                value={form.total_parcelas} onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data *</label>
              <input className="input mt-1 w-full" type="date" required
                value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input mt-1 w-full" value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                {(form.tipo === 'gasto' ? CAT_GASTOS : CAT_RECEITAS).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tab Principal ───────────────────────────────────────────────
export function TabCartoesPF({ userId, gastos, receitas, onUpdate }: {
  userId: string
  gastos: any[]
  receitas: any[]
  onUpdate: () => void
}) {
  const supabase = createClient()
  const [contas, setContas] = useState<any[]>([])
  const [cartaoSel, setCartaoSel] = useState('todos')
  const [subAba, setSubAba] = useState<'lancamentos' | 'cadastro'>('lancamentos')
  const [modalLanc, setModalLanc] = useState(false)
  const [modalCriar, setModalCriar] = useState(false)
  const [modalImport, setModalImport] = useState(false)
  const [busca, setBusca] = useState('')

  const carregarContas = useCallback(async () => {
    const { data } = await (supabase.from('contas') as any)
      .select('*')
      .eq('categoria', 'pf')
      .in('tipo', ['cartao_credito', 'cartao_debito'])
      .eq('ativo', true)
    setContas(data || [])
  }, [supabase])

  useState(() => { carregarContas() })

  // Combina gastos + receitas para exibição
  const todosLancamentos = [
    ...gastos.map(g => ({ ...g, _tipoLanc: 'gasto' as const })),
    ...receitas.map(r => ({ ...r, _tipoLanc: 'receita' as const })),
  ].filter(l =>
    (l.forma_pagamento === 'cartao_credito' || l.forma_pagamento === 'cartao_debito')
    && (busca ? l.descricao?.toLowerCase().includes(busca.toLowerCase()) : true)
  ).sort((a, b) => b.data.localeCompare(a.data))

  const totalGastos = gastos.filter(g => g.forma_pagamento === 'cartao_credito' || g.forma_pagamento === 'cartao_debito').reduce((a, g) => a + g.valor, 0)
  const totalReceitas = receitas.filter(r => r.forma_pagamento === 'cartao_credito' || r.forma_pagamento === 'cartao_debito').reduce((a, r) => a + r.valor, 0)

  return (
    <div className="space-y-4">
      {/* Sub-abas */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 bg-page border border-border-subtle rounded-xl p-1">
          {([
            { id: 'lancamentos', label: '💸 Lançamentos' },
            { id: 'cadastro',    label: '💳 Meus Cartões' },
          ] as const).map(t => (
            <button key={t.id} onClick={() => setSubAba(t.id)}
              className={cn('px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                subAba === t.id ? 'bg-muted text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
              )}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setModalImport(true)}
            className="btn-secondary text-xs flex items-center gap-1">
            🤖 Importar Extrato (IA)
          </button>
          {subAba === 'lancamentos'
            ? <button onClick={() => setModalLanc(true)} disabled={contas.length === 0}
                className="btn-primary text-xs disabled:opacity-50">+ Lançar</button>
            : <button onClick={() => setModalCriar(true)}
                className="btn-primary text-xs">+ Novo Cartão</button>
          }
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Gastos no Cartão', v: totalGastos, cor: 'text-red-400' },
          { label: 'Recebido/Estorno', v: totalReceitas, cor: 'text-emerald-400' },
          { label: 'Cartões PF', v: contas.length, cor: 'text-amber-400', isNum: true },
        ].map(k => (
          <div key={k.label} className="bg-surface border border-white/5 rounded-xl p-4">
            <p className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.cor}`}>
              {k.isNum ? k.v : fmt(k.v as number)}
            </p>
          </div>
        ))}
      </div>

      {/* Aba Lançamentos */}
      {subAba === 'lancamentos' && (
        <div className="space-y-3">
          <input className="input w-full text-xs" placeholder="🔍 Buscar lançamentos de cartão..."
            value={busca} onChange={e => setBusca(e.target.value)} />
          {todosLancamentos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">💳</p>
              <p className="text-sm font-bold text-fg mb-1">Nenhum lançamento de cartão</p>
              <p className="text-xs text-fg-tertiary">
                Lance manualmente ou importe um extrato OFX/CSV com IA
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {todosLancamentos.map((l, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-all">
                  <span className="text-[10px] text-fg-disabled w-14 shrink-0">{l.data?.slice(5)}</span>
                  <span className="text-xs text-fg flex-1 truncate">{l.descricao}</span>
                  <span className="text-[10px] text-fg-tertiary capitalize shrink-0">{l.categoria}</span>
                  <span className={cn('text-xs font-bold shrink-0', l._tipoLanc === 'gasto' ? 'text-red-400' : 'text-emerald-400')}>
                    {l._tipoLanc === 'gasto' ? '-' : '+'}{fmt(l.valor)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Aba Cadastro */}
      {subAba === 'cadastro' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map(c => {
            const band = getBand(c.bandeira)
            const gastosCartao = gastos.filter(g => g.forma_pagamento === 'cartao_credito' || g.forma_pagamento === 'cartao_debito').reduce((a, g) => a + g.valor, 0)
            return (
              <div key={c.id} className="bg-surface border border-white/5 rounded-2xl overflow-hidden">
                <div className="h-24 flex flex-col justify-between p-3 relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${band.cor}cc, ${band.cor}66)` }}>
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 10px)' }} />
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-white/70 text-[9px] font-bold uppercase tracking-wider">
                      {c.tipo === 'cartao_credito' ? 'Crédito' : 'Débito'} · PF
                    </span>
                    <span className="text-xl">{band.emoji}</span>
                  </div>
                  <div className="relative z-10">
                    <p className="text-white font-bold text-sm truncate">{c.nome_cartao || c.nome}</p>
                    <p className="text-white/60 text-[9px]">{band.label}</p>
                  </div>
                </div>
                <div className="p-3 space-y-1.5">
                  {c.limite && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-fg-tertiary">Limite</span>
                        <span className="font-semibold text-fg">{fmt(c.limite)}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-red-500/70"
                          style={{ width: `${Math.min((gastosCartao / c.limite) * 100, 100)}%` }} />
                      </div>
                    </>
                  )}
                  {(c.dia_fechamento || c.dia_vencimento) && (
                    <div className="flex justify-between text-[10px] text-fg-tertiary pt-1 border-t border-white/5">
                      <span>Fecha dia {c.dia_fechamento || '—'}</span>
                      <span>Vence dia {c.dia_vencimento || '—'}</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <button onClick={() => setModalCriar(true)}
            className="border-2 border-dashed border-border-subtle rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-fg-disabled hover:border-amber-500/40 hover:text-amber-400 transition-all min-h-[180px]">
            <span className="text-3xl">+</span>
            <span className="text-xs font-semibold">Adicionar Cartão PF</span>
          </button>
        </div>
      )}

      {/* Modais */}
      {modalLanc && (
        <ModalLancamentoPF
          cartoes={contas} userId={userId}
          onClose={() => setModalLanc(false)}
          onSave={() => { setModalLanc(false); onUpdate() }}
        />
      )}
      {modalCriar && (
        <ModalNovoCarta
          onClose={() => setModalCriar(false)}
          onSave={() => { setModalCriar(false); carregarContas() }}
        />
      )}
      {modalImport && (
        <ModalImportarExtratoIA
          userId={userId}
          modo="pf"
          onClose={() => setModalImport(false)}
          onSave={() => { setModalImport(false); onUpdate() }}
        />
      )}
    </div>
  )
}
