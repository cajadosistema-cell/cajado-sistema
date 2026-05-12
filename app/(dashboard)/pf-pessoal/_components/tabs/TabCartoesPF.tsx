'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ModalImportarExtratoIA } from '@/components/shared/ModalImportarExtratoIA'
import { PainelComparativoMes } from '@/components/shared/PainelComparativoMes'
import { exportarLancamentos } from '@/lib/export-utils'

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
function ModalNovoCarta({ userId, onClose, onSave }: { userId: string; onClose: () => void; onSave: () => void }) {
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
      user_id: userId,
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

// ── Modal Editar Cartao ──────────────────────────────────────────────
function ModalEditarCartao({ conta, onClose, onSave }: { conta: any; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome_cartao: conta.nome_cartao || conta.nome || '',
    bandeira:    conta.bandeira    || 'visa',
    tipo:        conta.tipo        || 'cartao_credito',
    limite:      conta.limite      != null ? String(conta.limite) : '',
    dia_fechamento:  conta.dia_fechamento  != null ? String(conta.dia_fechamento)  : '',
    dia_vencimento:  conta.dia_vencimento  != null ? String(conta.dia_vencimento)  : '',
  })
  const band = getBand(form.bandeira)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await (supabase.from('contas') as any).update({
      nome: form.nome_cartao,
      nome_cartao: form.nome_cartao,
      tipo: form.tipo,
      bandeira: form.bandeira,
      cor: band.cor,
      limite: form.limite ? Number(form.limite) : null,
      dia_fechamento: form.dia_fechamento ? Number(form.dia_fechamento) : null,
      dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
    }).eq('id', conta.id)
    setLoading(false)
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="h-24 flex flex-col justify-between p-4 relative overflow-hidden"
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
          <h2 className="text-sm font-bold text-white">✏️ Editar Cartão</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          <div>
            <label className="label">Nome do Cartão *</label>
            <input className="input mt-1 w-full" required value={form.nome_cartao}
              onChange={e => setForm(f => ({ ...f, nome_cartao: e.target.value }))} />
          </div>
          <div>
            <label className="label mb-2 block">Bandeira</label>
            <div className="grid grid-cols-3 gap-2">
              {BANDEIRAS.map(b => (
                <button type="button" key={b.id} onClick={() => setForm(f => ({ ...f, bandeira: b.id }))}
                  className={cn('flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all',
                    form.bandeira === b.id ? 'border-white/40 text-white' : 'border-border-subtle text-fg-tertiary hover:text-fg'
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
              <input className="input mt-1 w-full" type="number" value={form.limite}
                onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Dia Fechamento</label>
              <input className="input mt-1 w-full" type="number" min="1" max="31" value={form.dia_fechamento}
                onChange={e => setForm(f => ({ ...f, dia_fechamento: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dia Vencimento</label>
              <input className="input mt-1 w-full" type="number" min="1" max="31" value={form.dia_vencimento}
                onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : '✅ Salvar alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

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

// ── Helpers ─────────────────────────────────────────────────────
function getAnoMes(d: string) { return d ? d.substring(0, 7) : '' }
function labelMes(ym: string) {
  if (!ym) return ''
  const [y, m] = ym.split('-')
  const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
  return `${meses[parseInt(m)-1]}/${y}`
}

// ── Modal Editar Limite do Cartão ───────────────────────────────
function ModalLimiteCartao({ conta, onClose, onSave }: { conta: any; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [limite, setLimite] = useState(String(conta.limite_gasto_mensal ?? ''))
  const [loading, setLoading] = useState(false)
  const handleSave = async () => {
    setLoading(true)
    await (supabase.from('contas') as any).update({ limite_gasto_mensal: parseFloat(limite) || null }).eq('id', conta.id)
    setLoading(false)
    onSave()
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-white">🎯 Limite de Gasto Mensal</h2>
        <p className="text-xs text-fg-tertiary">Defina o valor máximo que deseja gastar neste cartão por mês. Alertas serão exibidos ao se aproximar.</p>
        <div>
          <label className="label">Limite Mensal (R$)</label>
          <input className="input mt-1 w-full" type="number" step="0.01" placeholder="Ex: 2000.00"
            value={limite} onChange={e => setLimite(e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary">
            {loading ? 'Salvando...' : '✅ Definir Limite'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Barra de Progresso de Gasto ─────────────────────────────────
function GastoProgressBar({ gasto, limite }: { gasto: number; limite: number | null }) {
  if (!limite) return null
  const pct = Math.min((gasto / limite) * 100, 100)
  const cor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981'
  const alerta = pct >= 100 ? '🚨 LIMITE ATINGIDO!' : pct >= 80 ? '⚠️ Próximo do limite' : null
  return (
    <div className="mt-2 space-y-1">
      <div className="flex justify-between text-[10px]">
        <span className="text-fg-tertiary">Controle de Gasto</span>
        <span style={{ color: cor }} className="font-bold">{pct.toFixed(0)}%</span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="h-2 rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cor }} />
      </div>
      <div className="flex justify-between text-[10px] text-fg-tertiary">
        <span>{fmt(gasto)} gastos</span>
        <span>Limite: {fmt(limite)}</span>
      </div>
      {alerta && (
        <div className={cn('text-[10px] font-bold px-2 py-1 rounded-lg text-center animate-pulse',
          pct >= 100 ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
        )}>
          {alerta}
        </div>
      )}
    </div>
  )
}

// ── Modal Detalhe do Cartão ────────────────────────────────────────────────────────
function ModalDetalheCartao({
  conta, gastos, receitas, faturas, onClose, onLancar, onEditar, onExcluir, onFaturaUpdate
}: {
  conta: any
  gastos: any[]
  receitas: any[]
  faturas: any[]
  onClose: () => void
  onLancar: () => void
  onEditar: () => void
  onExcluir: () => void
  onFaturaUpdate: () => void
}) {
  const supabase = createClient()
  const band = getBand(conta.bandeira)
  const mesAtual = new Date().toISOString().substring(0, 7)
  const [mesSel, setMesSel] = useState(mesAtual)

  // Todos os lançamentos deste cartão
  const todosCombinados = [
    ...gastos.map(g => ({ ...g, _tipo: 'gasto' as const })),
    ...receitas.map(r => ({ ...r, _tipo: 'receita' as const })),
  ].filter(l => l.forma_pagamento === 'cartao_credito' || l.forma_pagamento === 'cartao_debito')

  // Meses disponíveis
  const mesesDisp = Array.from(new Set(todosCombinados.map(l => l.data?.substring(0, 7)))).filter(Boolean).sort().reverse() as string[]
  if (!mesesDisp.includes(mesAtual)) mesesDisp.unshift(mesAtual)

  // Lançamentos do mês selecionado
  const lancMes = todosCombinados
    .filter(l => l.data?.startsWith(mesSel))
    .sort((a, b) => b.data.localeCompare(a.data))

  const totalGastos  = lancMes.filter(l => l._tipo === 'gasto').reduce((a, l) => a + l.valor, 0)
  const totalEstornos = lancMes.filter(l => l._tipo === 'receita').reduce((a, l) => a + l.valor, 0)
  const fatura = totalGastos - totalEstornos

  const faturaManualDoc = faturas.find(f => f.conta_id === conta.id && f.mes_referencia === mesSel)
  const valorFechado = faturaManualDoc?.valor_fechado ?? null
  const [editFaturaManual, setEditFaturaManual] = useState(false)
  const [inputFaturaManual, setInputFaturaManual] = useState('')

  useEffect(() => {
    setInputFaturaManual(valorFechado !== null ? valorFechado.toString() : '')
  }, [valorFechado, mesSel])

  const handleSalvarFaturaManual = async () => {
    const val = parseFloat(inputFaturaManual.replace(',', '.'))
    if (isNaN(val)) {
      await (supabase.from('faturas_cartoes') as any).delete().match({ conta_id: conta.id, mes_referencia: mesSel })
    } else {
      await (supabase.from('faturas_cartoes') as any).upsert({
        conta_id: conta.id,
        mes_referencia: mesSel,
        valor_fechado: val
      }, { onConflict: 'conta_id,mes_referencia' })
    }
    setEditFaturaManual(false)
    onFaturaUpdate()
  }

  const diferencaFatura = valorFechado !== null ? fatura - valorFechado : null

  const limiteCredito = conta.limite ?? null
  const limiteMensal  = conta.limite_gasto_mensal ?? null
  const pctLimite    = limiteMensal ? Math.min((totalGastos / limiteMensal) * 100, 100) : null
  const disponivel   = limiteCredito != null ? limiteCredito - fatura : null

  function labelMes(ym: string) {
    const [y, m] = ym.split('-')
    const meses = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    return `${meses[parseInt(m) - 1]}/${y}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0a0d16] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full sm:max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">

        {/* Cabeçalho visual do cartão */}
        <div className="h-32 flex flex-col justify-between p-5 relative overflow-hidden shrink-0"
          style={{ background: `linear-gradient(135deg, ${band.cor}dd, ${band.cor}88)` }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 10px)' }} />
          <div className="flex justify-between items-start relative z-10">
            <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest">
              {conta.tipo === 'cartao_credito' ? 'Crédito' : 'Débito'} · PF
            </span>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{band.emoji}</span>
              <button onClick={onClose} className="text-white/60 hover:text-white text-lg leading-none">×</button>
            </div>
          </div>
          <div className="relative z-10">
            <p className="text-white font-bold text-lg">{conta.nome_cartao || conta.nome}</p>
            <p className="text-white/60 text-xs">{band.label}</p>
          </div>
          {/* Barra de progresso do limite mensal */}
          {pctLimite != null && (
            <div className="absolute bottom-0 left-0 right-0 h-1">
              <div className="h-full transition-all duration-700"
                style={{ width: `${pctLimite}%`, backgroundColor: pctLimite >= 100 ? '#ef4444' : pctLimite >= 80 ? '#f59e0b' : '#10b981' }} />
            </div>
          )}
        </div>

        {/* KPIs rápidos */}
        <div className="grid grid-cols-3 gap-0 border-b border-white/8 shrink-0">
          {[
            { label: 'Fatura do Sistema', v: fmt(fatura), cor: fatura > 0 ? 'text-red-400' : 'text-fg' },
            { label: 'Estornos', v: fmt(totalEstornos), cor: 'text-emerald-400' },
            { label: disponivel != null ? 'Disponível' : 'Limite', v: disponivel != null ? fmt(disponivel) : limiteCredito ? fmt(limiteCredito) : '—', cor: 'text-blue-400' },
          ].map(k => (
            <div key={k.label} className="py-3 px-4 text-center border-r border-white/5 last:border-0">
              <p className="text-[10px] text-fg-tertiary uppercase tracking-wider">{k.label}</p>
              <p className={`text-sm font-bold ${k.cor} mt-0.5`}>{k.v}</p>
            </div>
          ))}
        </div>

        {/* Fatura Fechada (Manual) */}
        <div className="px-4 py-3 border-b border-white/8 shrink-0 flex items-center justify-between bg-white/5">
          <div>
            <p className="text-[10px] font-bold text-fg-tertiary uppercase tracking-widest">Fatura Real / Fechada</p>
            {editFaturaManual ? (
              <div className="flex gap-2 mt-1">
                <input type="number" step="0.01" className="input text-xs w-28 py-1" placeholder="0.00"
                  value={inputFaturaManual} onChange={e => setInputFaturaManual(e.target.value)} />
                <button onClick={handleSalvarFaturaManual} className="btn-primary text-[10px] px-2 py-1">Salvar</button>
                <button onClick={() => setEditFaturaManual(false)} className="btn-secondary text-[10px] px-2 py-1">X</button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-0.5">
                <p className={cn("text-base font-bold", valorFechado !== null ? "text-amber-400" : "text-fg-disabled")}>
                  {valorFechado !== null ? fmt(valorFechado) : 'Não informada'}
                </p>
                <button onClick={() => setEditFaturaManual(true)} className="text-[10px] text-blue-400 hover:text-blue-300">✏️ Editar</button>
              </div>
            )}
          </div>
          {valorFechado !== null && (
            <div className="text-right">
              <p className="text-[10px] text-fg-tertiary uppercase">Diferença Sist. x Real</p>
              <p className={cn("text-xs font-bold mt-0.5", Math.abs(diferencaFatura!) > 0.01 ? "text-red-400" : "text-emerald-400")}>
                {Math.abs(diferencaFatura!) > 0.01 ? `⚠️ Dif. de ${fmt(Math.abs(diferencaFatura!))}` : '✅ Bateu certo!'}
              </p>
            </div>
          )}
        </div>

        {/* Info de vencimento e seletor de mês */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/8 shrink-0">
          <div className="flex items-center gap-3 text-[11px] text-fg-tertiary">
            {conta.dia_fechamento && <span>🗕️ Fecha dia <strong className="text-fg">{conta.dia_fechamento}</strong></span>}
            {conta.dia_vencimento && <span>⏰ Vence dia <strong className="text-fg">{conta.dia_vencimento}</strong></span>}
            {limiteMensal && (
              <span className={pctLimite! >= 100 ? 'text-red-400' : pctLimite! >= 80 ? 'text-amber-400' : 'text-fg-tertiary'}>
                🎯 {fmt(totalGastos)}/{fmt(limiteMensal)}
              </span>
            )}
          </div>
          <select className="input text-xs w-32 py-1" value={mesSel} onChange={e => setMesSel(e.target.value)}>
            {mesesDisp.map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
          </select>
        </div>

        {/* Lista de lançamentos */}
        <div className="overflow-y-auto flex-1 p-4 space-y-1.5">
          {lancMes.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-3xl mb-2">💳</p>
              <p className="text-sm font-semibold text-fg mb-1">Nenhum lançamento em {labelMes(mesSel)}</p>
              <p className="text-xs text-fg-tertiary">Clique em &ldquo;+ Lançar&rdquo; para registrar um gasto ou estorno neste cartão.</p>
            </div>
          ) : (
            lancMes.map((l, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/3 border border-white/5 hover:border-white/10 transition-all">
                <span className="text-[10px] text-fg-disabled w-10 shrink-0">{l.data?.slice(5)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-fg truncate">{l.descricao}</p>
                  <p className="text-[10px] text-fg-tertiary capitalize">{l.categoria}</p>
                </div>
                <span className={cn('text-sm font-bold shrink-0', l._tipo === 'gasto' ? 'text-red-400' : 'text-emerald-400')}>
                  {l._tipo === 'gasto' ? '-' : '+'}{fmt(l.valor)}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Comparativo mensal deste cartão */}
        <div className="px-4 pb-2">
          <PainelComparativoMes
            lancamentos={todosCombinados.map(l => ({ data: l.data, valor: l.valor, _tipo: l._tipo }))}
            campoData="data"
            campoTipo="_tipo"
            valorDespesa="gasto"
            valorReceita="receita"
            titulo={`Comparativo — ${conta.nome_cartao || conta.nome}`}
          />
        </div>

        {/* Ações */}
        <div className="flex gap-2 p-4 border-t border-white/8 shrink-0">
          <button onClick={onLancar} className="flex-1 btn-primary text-sm py-2">
            + Lançar
          </button>
          <button onClick={onEditar} className="px-4 py-2 rounded-xl text-sm font-medium text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 transition-colors">
            ✏️ Editar
          </button>
          <button onClick={onExcluir} className="px-4 py-2 rounded-xl text-sm font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">
            🗑️
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Fatura Prevista ────────────────────────────────────────
function ModalFaturaPrevista({ conta, mesSel, faturas, onClose, onSave }: { conta: any; mesSel: string; faturas: any[]; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const faturaManual = faturas.find(f => f.conta_id === conta.id && f.mes_referencia === mesSel)
  const [valor, setValor] = useState(faturaManual?.valor_fechado ? String(faturaManual.valor_fechado) : '')
  const [loading, setLoading] = useState(false)
  const handleSave = async () => {
    setLoading(true)
    const val = parseFloat(valor.replace(',', '.'))
    if (isNaN(val)) {
      await (supabase.from('faturas_cartoes') as any).delete().match({ conta_id: conta.id, mes_referencia: mesSel })
    } else {
      await (supabase.from('faturas_cartoes') as any).upsert({
        conta_id: conta.id,
        mes_referencia: mesSel,
        valor_fechado: val
      }, { onConflict: 'conta_id,mes_referencia' })
    }
    setLoading(false); onSave(); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
        <h2 className="text-sm font-bold text-fg">📊 Fatura Prevista — {conta.nome_cartao || conta.nome}</h2>
        <p className="text-xs text-fg-tertiary">Insira o valor que você espera pagar na fatura antes do fechamento. O sistema confrontará com os lançamentos reais.</p>
        <div>
          <label className="label">Valor da Fatura Prevista (R$)</label>
          <input className="input mt-1 w-full" type="number" step="0.01" placeholder="Ex: 2500.00"
            value={valor} onChange={e => setValor(e.target.value)} />
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={loading} className="btn-primary">
            {loading ? 'Salvando...' : '✅ Definir'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Input Inline de Fatura Real (no card) ──────────────────────────────────────
// ── Painel duplo: Prévia + Fatura Real ────────────────────────
function FaturaDupla({
  conta, mesSel, faturaObj, gastoSistema, onSaved,
}: { conta: any; mesSel: string; faturaObj: any; gastoSistema: number; onSaved: () => void }) {
  const supabase = createClient()
  const [editPrev, setEditPrev] = useState(false)
  const [editReal, setEditReal] = useState(false)
  const [valPrev, setValPrev] = useState(faturaObj?.valor_previsto != null ? String(faturaObj.valor_previsto) : '')
  const [valReal, setValReal] = useState(faturaObj?.valor_fechado  != null ? String(faturaObj.valor_fechado)  : '')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setValPrev(faturaObj?.valor_previsto != null ? String(faturaObj.valor_previsto) : '')
    setValReal(faturaObj?.valor_fechado  != null ? String(faturaObj.valor_fechado)  : '')
    setEditPrev(false); setEditReal(false)
  }, [mesSel, faturaObj])

  const salvar = async (campo: 'valor_previsto' | 'valor_fechado', raw: string) => {
    setLoading(true)
    const val = parseFloat(raw.replace(',', '.'))
    await (supabase.from('faturas_cartoes') as any).upsert({
      conta_id: conta.id,
      mes_referencia: mesSel,
      [campo]: isNaN(val) ? null : val,
    }, { onConflict: 'conta_id,mes_referencia' })
    setLoading(false)
    setEditPrev(false); setEditReal(false)
    onSaved()
  }

  const prev  = faturaObj?.valor_previsto != null ? Number(faturaObj.valor_previsto) : null
  const real  = faturaObj?.valor_fechado  != null ? Number(faturaObj.valor_fechado)  : null
  const diff  = real != null ? gastoSistema - real : null

  return (
    <div className="space-y-2" onClick={e => e.stopPropagation()}>
      {/* Linha: Prévia */}
      <div className="flex items-center justify-between gap-2 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2">
        <div className="min-w-0">
          <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider">📋 Prévia (antes de fechar)</p>
          {editPrev ? (
            <div className="flex gap-1 mt-1">
              <input type="number" step="0.01" autoFocus className="input text-xs flex-1 py-0.5 h-6"
                placeholder="Ex: 2000.00" value={valPrev} onChange={e => setValPrev(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvar('valor_previsto', valPrev); if (e.key === 'Escape') setEditPrev(false) }} />
              <button onClick={() => salvar('valor_previsto', valPrev)} disabled={loading}
                className="px-2 h-6 rounded bg-blue-500/20 text-blue-400 text-[10px] font-bold">{loading ? '...' : '✓'}</button>
              <button onClick={() => setEditPrev(false)} className="px-2 h-6 rounded bg-white/5 text-fg-disabled text-[10px]">✕</button>
            </div>
          ) : (
            <p className={`text-sm font-bold mt-0.5 ${prev != null ? 'text-blue-300' : 'text-fg-disabled italic text-xs'}`}>
              {prev != null ? fmt(prev) : 'não informada'}
            </p>
          )}
        </div>
        {!editPrev && (
          <button onClick={() => setEditPrev(true)} className="shrink-0 text-[10px] text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded px-2 py-0.5">
            {prev != null ? '✏️' : '+ Definir'}
          </button>
        )}
      </div>

      {/* Linha: Fatura Real */}
      <div className="flex items-center justify-between gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2">
        <div className="min-w-0">
          <p className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">🧾 Fatura Real (após fechar)</p>
          {editReal ? (
            <div className="flex gap-1 mt-1">
              <input type="number" step="0.01" autoFocus className="input text-xs flex-1 py-0.5 h-6"
                placeholder="Ex: 1850.00" value={valReal} onChange={e => setValReal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvar('valor_fechado', valReal); if (e.key === 'Escape') setEditReal(false) }} />
              <button onClick={() => salvar('valor_fechado', valReal)} disabled={loading}
                className="px-2 h-6 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">{loading ? '...' : '✓'}</button>
              <button onClick={() => setEditReal(false)} className="px-2 h-6 rounded bg-white/5 text-fg-disabled text-[10px]">✕</button>
            </div>
          ) : (
            <p className={`text-sm font-bold mt-0.5 ${real != null ? 'text-amber-300' : 'text-fg-disabled italic text-xs'}`}>
              {real != null ? fmt(real) : 'não informada'}
            </p>
          )}
        </div>
        {!editReal && (
          <button onClick={() => setEditReal(true)} className="shrink-0 text-[10px] text-amber-400 hover:text-amber-300 border border-amber-500/20 rounded px-2 py-0.5">
            {real != null ? '✏️' : '+ Definir'}
          </button>
        )}
      </div>

      {/* Comparativo */}
      {real != null && (
        <div className={`rounded-xl px-3 py-1.5 text-center text-[10px] font-bold ${Math.abs(diff!) <= 0.5 ? 'bg-emerald-500/10 text-emerald-400' : diff! > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {Math.abs(diff!) <= 0.5
            ? '✅ Sistema e fatura real batem!'
            : diff! > 0
              ? `⚠️ ${fmt(diff!)} a mais no sistema vs fatura`
              : `✅ ${fmt(Math.abs(diff!))} a menos — ok`}
        </div>
      )}
    </div>
  )
}

// Mantém FaturaInlineInput como alias para não quebrar ModalDetalheCartao
function FaturaInlineInput({
  conta, mesSel, valorAtual, onSaved,
}: { conta: any; mesSel: string; valorAtual: number | null; onSaved: () => void }) {
  return <FaturaDupla conta={conta} mesSel={mesSel} faturaObj={{ valor_previsto: null, valor_fechado: valorAtual }} gastoSistema={0} onSaved={onSaved} />
}

// ── Modal Nova Conta Bancária PF ────────────────────────────────
function ModalNovaConta({ userId, onClose, onSave }: { userId: string; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ nome: '', tipo: 'corrente', saldo_inicial: '' })
  const TIPOS = [
    { id: 'corrente',     label: 'Conta Corrente', emoji: '🏦' },
    { id: 'poupanca',    label: 'Poupança',        emoji: '🪙' },
    { id: 'digital',     label: 'Conta Digital',   emoji: '📱' },
    { id: 'investimento',label: 'Investimento',    emoji: '📈' },
  ]
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) return
    setLoading(true); setErro('')
    const { error } = await (supabase.from('contas') as any).insert({
      user_id: userId, nome: form.nome, tipo: form.tipo, categoria: 'pf',
      saldo_inicial: form.saldo_inicial ? Number(form.saldo_inicial) : 0,
      saldo_atual: form.saldo_inicial ? Number(form.saldo_inicial) : 0,
      ativo: true,
    })
    setLoading(false)
    if (error) { setErro(error.message); return }
    onSave(); onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">🏦 Nova Conta Bancária PF</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="label">Nome da Conta *</label>
            <input className="input mt-1 w-full" required placeholder="Ex: Nubank, Itaú Corrente, C6 Bank..."
              value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div>
            <label className="label mb-2 block">Tipo de Conta *</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS.map(t => (
                <button key={t.id} type="button" onClick={() => setForm(f => ({ ...f, tipo: t.id }))}
                  className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all',
                    form.tipo === t.id
                      ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-400'
                      : 'border-border-subtle text-fg-tertiary hover:text-fg hover:border-border'
                  )}>
                  <span>{t.emoji}</span><span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Saldo Atual (R$)</label>
            <input className="input mt-1 w-full" type="number" step="0.01" placeholder="0,00"
              value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
            <p className="text-[10px] text-fg-tertiary mt-1">Informe o saldo atual para monitoramento correto.</p>
          </div>
          {erro && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{erro}</p>}
          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Salvando...' : '🏦 Criar Conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function TabCartoesPF({ userId, gastos, receitas, onUpdate }: {
  userId: string
  gastos: any[]
  receitas: any[]
  onUpdate: () => void
}) {
  const supabase = createClient()
  const [contas, setContas] = useState<any[]>([])
  const [contasNormais, setContasNormais] = useState<any[]>([])
  const [faturas, setFaturas] = useState<any[]>([])
  const [cartaoSel, setCartaoSel] = useState('todos')
  const [subAba, setSubAba] = useState<'lancamentos' | 'cadastro'>('lancamentos')
  const [modalNovaConta, setModalNovaConta] = useState(false)
  const [modalLanc, setModalLanc] = useState(false)
  const [modalCriar, setModalCriar] = useState(false)
  const [modalImport, setModalImport] = useState(false)
  const [modalLimite, setModalLimite] = useState<any>(null)
  const [modalEditar, setModalEditar] = useState<any>(null)
  const [modalDetalhe, setModalDetalhe] = useState<any>(null)
  const [modalFatura, setModalFatura] = useState<any>(null)
  const [busca, setBusca] = useState('')
  const mesAtual = new Date().toISOString().substring(0, 7)
  const [mesSel, setMesSel] = useState(mesAtual)

  const carregarContas = useCallback(async () => {
    if (!userId) return
    const { data: contasData } = await (supabase.from('contas') as any)
      .select('*')
      .eq('user_id', userId)
      .eq('categoria', 'pf')
      .in('tipo', ['cartao_credito', 'cartao_debito'])
      .eq('ativo', true)
    setContas(contasData || [])

    const { data: contasNormaisData } = await (supabase.from('contas') as any)
      .select('*')
      .eq('user_id', userId)
      .eq('categoria', 'pf')
      .in('tipo', ['corrente', 'poupanca', 'digital', 'investimento'])
      .eq('ativo', true)
    setContasNormais(contasNormaisData || [])

    const { data: faturasData } = await (supabase.from('faturas_cartoes') as any)
      .select('*')
      .eq('user_id', userId)
    setFaturas(faturasData || [])
  }, [userId, supabase])

  const handleExcluirCartao = async (c: any) => {
    if (!confirm(`Excluir o cartão "${c.nome_cartao || c.nome}"?\nOs lançamentos vinculados não serão removidos.`)) return
    await (supabase.from('contas') as any).update({ ativo: false }).eq('id', c.id)
    carregarContas()
  }

  useEffect(() => { if (userId) carregarContas() }, [userId, carregarContas])

  // Filtro por mês e cartão
  const todosCombinados = [
    ...gastos.map(g => ({ ...g, _tipoLanc: 'gasto' as const })),
    ...receitas.map(r => ({ ...r, _tipoLanc: 'receita' as const })),
  ].filter(l => l.forma_pagamento === 'cartao_credito' || l.forma_pagamento === 'cartao_debito')

  // Meses disponíveis nos lançamentos
  const mesesDisp = Array.from(new Set(todosCombinados.map(l => getAnoMes(l.data)))).sort().reverse()

  const lancFiltrados = todosCombinados.filter(l => {
    const okMes = mesSel ? getAnoMes(l.data) === mesSel : true
    const okCartao = cartaoSel !== 'todos'
      ? (l.conta_id === cartaoSel || l.forma_pagamento === (contas.find(c => c.id === cartaoSel)?.tipo))
      : true
    const okBusca = busca ? l.descricao?.toLowerCase().includes(busca.toLowerCase()) : true
    return okMes && okCartao && okBusca
  }).sort((a, b) => b.data.localeCompare(a.data))

  const totalGastosFiltrados = lancFiltrados.filter(l => l._tipoLanc === 'gasto').reduce((a, l) => a + l.valor, 0)
  const totalReceitasFiltrados = lancFiltrados.filter(l => l._tipoLanc === 'receita').reduce((a, l) => a + l.valor, 0)

  // Calcula gasto por cartão no mês selecionado (para alertas)
  function gastoCartaoMes(contaId: string) {
    return todosCombinados.filter(l => l._tipoLanc === 'gasto' && l.conta_id === contaId && getAnoMes(l.data) === mesSel).reduce((a, l) => a + l.valor, 0)
  }

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
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setModalImport(true)} className="btn-secondary text-xs flex items-center gap-1">
            🤖 Importar Extrato (IA)
          </button>
          <button
            onClick={() => {
              const lancFiltrados = gastos.filter((l: any) => cartaoSel === 'todos' || l.conta_id === cartaoSel)
              const cartaoNome = contas.find((c: any) => c.id === cartaoSel)?.nome_cartao || cartaoSel
              exportarLancamentos(lancFiltrados, [], contas, `cartoes_pf${cartaoSel !== 'todos' ? '_' + cartaoNome : ''}`)
            }}
            className="btn-secondary text-xs flex items-center gap-1">
            📤 Exportar CSV
          </button>
          {subAba === 'lancamentos'
            ? <button onClick={() => setModalLanc(true)} disabled={contas.length === 0} className="btn-primary text-xs disabled:opacity-50">+ Lançar</button>
            : <button onClick={() => setModalCriar(true)} className="btn-primary text-xs">+ Novo Cartão</button>
          }
        </div>
      </div>

      {subAba === 'lancamentos' && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button onClick={() => setCartaoSel('todos')}
            className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
              cartaoSel === 'todos' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-border-subtle text-fg-tertiary hover:text-fg'
            )}>
            🗂️ Todos ({contas.length})
          </button>
          {contas.map(c => (
            <button key={c.id} onClick={() => setCartaoSel(c.id)}
              className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5',
                cartaoSel === c.id ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-border-subtle text-fg-tertiary hover:text-fg'
              )}>
              💳 {c.nome_cartao || c.nome}
            </button>
          ))}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        {[
          { label: `Gastos (${labelMes(mesSel)})`, v: totalGastosFiltrados, cor: 'text-red-400', bg: 'bg-red-500/10' },
          { label: 'Recebido/Estorno', v: totalReceitasFiltrados, cor: 'text-emerald-400', bg: 'bg-emerald-500/10' },
          { label: 'Cartões PF', v: contas.length, cor: 'text-amber-400', bg: 'bg-amber-500/10', isNum: true },
        ].map(k => (
          <div key={k.label} className={`${k.bg} border border-white/5 rounded-xl p-3 sm:p-4`}>
            <p className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1">{k.label}</p>
            <p className={`text-xl font-bold ${k.cor}`}>
              {k.isNum ? k.v : fmt(k.v as number)}
            </p>
          </div>
        ))}
        {/* Confronto Fatura Prevista / Fechada */}
        {cartaoSel !== 'todos' && (() => {
          const cartao = contas.find(c => c.id === cartaoSel)
          const faturaObj = faturas.find(f => f.conta_id === cartaoSel && f.mes_referencia === mesSel)
          const prev = faturaObj?.valor_fechado
          if (prev == null) return (
            <div className="bg-muted/30 border border-border-subtle rounded-xl p-3 sm:p-4 flex flex-col justify-between">
              <p className="text-[10px] text-fg-tertiary uppercase tracking-wider mb-1">📊 Fatura do Mês (Manual)</p>
              <button onClick={() => setModalFatura(cartao)}
                className="text-xs text-amber-400 hover:text-amber-300 text-left">
                + Definir valor p/ {labelMes(mesSel)}
              </button>
            </div>
          )
          const totalDespesas = totalGastosFiltrados - totalReceitasFiltrados
          const diff = totalDespesas - prev
          const pct = Math.min((totalDespesas / prev) * 100, 999)
          return (
            <div className={`border rounded-xl p-3 sm:p-4 ${diff > 0 ? 'bg-red-500/10 border-red-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
              <div className="flex justify-between items-start">
                <p className="text-[10px] text-fg-tertiary uppercase tracking-wider">📊 Fatura do Mês (Manual)</p>
                <button onClick={() => setModalFatura(cartao)} className="text-[9px] text-fg-disabled hover:text-fg">✏️</button>
              </div>
              <p className="text-lg font-bold text-fg mt-1">{fmt(prev)}</p>
              <p className={`text-xs font-semibold mt-0.5 ${diff > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {diff > 0 ? `⚠️ +${fmt(diff)} acima` : `✅ ${fmt(Math.abs(diff))} abaixo`}
              </p>
              <div className="mt-1.5 w-full bg-muted rounded-full h-1">
                <div className="h-1 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: diff > 0 ? '#ef4444' : '#10b981' }} />
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── Comparativo Mensal Geral dos Cartões PF ── */}
      <PainelComparativoMes
        lancamentos={[
          ...gastos.filter(g => g.forma_pagamento === 'cartao_credito' || g.forma_pagamento === 'cartao_debito')
                   .map(g => ({ data: g.data, valor: g.valor, _tipo: 'gasto' as const })),
          ...receitas.filter(r => r.forma_pagamento === 'cartao_credito' || r.forma_pagamento === 'cartao_debito')
                     .map(r => ({ data: r.data, valor: r.valor, _tipo: 'receita' as const })),
        ]}
        campoData="data"
        campoTipo="_tipo"
        valorDespesa="gasto"
        valorReceita="receita"
        titulo="Comparativo Mensal — Todos os Cartões PF"
      />

      {/* Aba Lançamentos */}
      {subAba === 'lancamentos' && (
        <div className="space-y-3">
          {/* Filtros */}
          <div className="flex flex-wrap gap-2">
            {/* Seletor de mês */}
            <select className="input text-xs w-36" value={mesSel} onChange={e => setMesSel(e.target.value)}>
              {mesesDisp.length === 0 && <option value={mesAtual}>{labelMes(mesAtual)}</option>}
              {mesesDisp.map(m => <option key={m} value={m}>{labelMes(m)}</option>)}
            </select>
            {/* Seletor de cartão */}
            <select className="input text-xs flex-1 min-w-[140px]" value={cartaoSel} onChange={e => setCartaoSel(e.target.value)}>
              <option value="todos">🗂️ Todos os cartões</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome_cartao || c.nome}</option>)}
            </select>
            {/* Busca */}
            <input className="input text-xs flex-1 min-w-[140px]" placeholder="🔍 Buscar..."
              value={busca} onChange={e => setBusca(e.target.value)} />
          </div>

          {/* Cards de cartão clicáveis (filtro visual) */}
          {contas.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              <button onClick={() => setCartaoSel('todos')}
                className={cn('flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                  cartaoSel === 'todos' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'border-border-subtle text-fg-tertiary hover:text-fg'
                )}>
                🗂️ Todos
              </button>
              {contas.map(c => {
                const band = BANDEIRAS.find(b => b.id === c.bandeira) ?? BANDEIRAS[BANDEIRAS.length - 1]
                const gasto = gastoCartaoMes(c.id)
                const limite = c.limite_gasto_mensal
                const pct = limite ? (gasto / limite) * 100 : 0
                const alertaCor = pct >= 100 ? 'border-red-500/60 text-red-300' : pct >= 80 ? 'border-amber-500/60 text-amber-300' : ''
                return (
                  <button key={c.id} onClick={() => setCartaoSel(c.id)}
                    className={cn('flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
                      cartaoSel === c.id ? 'ring-2 ring-white/30 scale-[1.02]' : 'opacity-80 hover:opacity-100',
                      alertaCor || 'border-border-subtle text-fg-secondary'
                    )}
                    style={cartaoSel === c.id ? { background: band.cor + '33', borderColor: band.cor + '66' } : {}}>
                    <span>{band.emoji}</span>
                    <span>{c.nome_cartao || c.nome}</span>
                    {pct >= 80 && <span className="animate-pulse">{pct >= 100 ? '🚨' : '⚠️'}</span>}
                  </button>
                )
              })}
            </div>
          )}

          {lancFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">💳</p>
              <p className="text-sm font-bold text-fg mb-1">Nenhum lançamento encontrado</p>
              <p className="text-xs text-fg-tertiary">Tente mudar o filtro de mês ou cartão</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {lancFiltrados.map((l, i) => {
                const cartao = contas.find(c => c.id === l.conta_id)
                const band = BANDEIRAS.find(b => b.id === cartao?.bandeira) ?? BANDEIRAS[BANDEIRAS.length - 1]
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface border border-white/5 hover:border-white/10 transition-all">
                    <span className="text-[10px] text-fg-disabled w-14 shrink-0">{l.data?.slice(5)}</span>
                    <span className="text-sm shrink-0">{band.emoji}</span>
                    <span className="text-xs text-fg flex-1 truncate">{l.descricao}</span>
                    <span className="text-[10px] text-fg-tertiary capitalize shrink-0">{l.categoria}</span>
                    <span className={cn('text-xs font-bold shrink-0', l._tipoLanc === 'gasto' ? 'text-red-400' : 'text-emerald-400')}>
                      {l._tipoLanc === 'gasto' ? '-' : '+'}{fmt(l.valor)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Aba Cadastro */}
      {subAba === 'cadastro' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {contas.map(c => {
            const band = getBand(c.bandeira)
            const gastoMes = gastoCartaoMes(c.id)
            const faturaObj = faturas.find(f => f.conta_id === c.id && f.mes_referencia === mesSel)
            const valorFechado = faturaObj?.valor_fechado ?? null
            const diff = valorFechado !== null ? gastoMes - valorFechado : null
            const pctFatura = valorFechado ? Math.min((gastoMes / valorFechado) * 100, 999) : null

            return (
              <div key={c.id} className="bg-surface border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all">

                {/* Área visual do cartão — clica para abrir detalhe */}
                <div className="h-24 flex flex-col justify-between p-3 relative overflow-hidden cursor-pointer group"
                  style={{ background: `linear-gradient(135deg, ${band.cor}cc, ${band.cor}66)` }}
                  onClick={() => setModalDetalhe(c)}>
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg,white 0,white 1px,transparent 1px,transparent 10px)' }} />
                  <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-all" />
                  <div className="flex justify-between items-start relative z-10">
                    <span className="text-white/70 text-[9px] font-bold uppercase tracking-wider">
                      {c.tipo === 'cartao_credito' ? 'Crédito' : 'Débito'} · PF
                    </span>
                    <span className="text-xl">{band.emoji}</span>
                  </div>
                  <div className="relative z-10">
                    <p className="text-white font-bold text-sm truncate">{c.nome_cartao || c.nome}</p>
                    <p className="text-white/60 text-[9px]">{band.label} · <span className="opacity-70">ver lançamentos →</span></p>
                  </div>
                  {/* Barra de progresso fatura */}
                  {pctFatura !== null && (
                    <div className="absolute bottom-0 left-0 right-0 h-1">
                      <div className="h-full transition-all duration-700"
                        style={{ width: `${Math.min(pctFatura, 100)}%`, backgroundColor: diff! > 0 ? '#ef4444' : '#10b981' }} />
                    </div>
                  )}
                </div>

                <div className="p-3 space-y-2">

                  {/* ── FATURA DO MÊS — prévia + real ── */}
                  <FaturaDupla
                    conta={c}
                    mesSel={mesSel}
                    faturaObj={faturaObj}
                    gastoSistema={gastoMes}
                    onSaved={carregarContas}
                  />

                  {/* GastoProgressBar (limite mensal) */}
                  <GastoProgressBar gasto={gastoMes} limite={c.limite_gasto_mensal ?? null} />

                  {/* Fechamento e vencimento */}
                  {(c.dia_fechamento || c.dia_vencimento) && (
                    <div className="flex justify-between text-[10px] text-fg-tertiary pt-1 border-t border-white/5">
                      <span>Fecha dia {c.dia_fechamento || '—'}</span>
                      <span>Vence dia {c.dia_vencimento || '—'}</span>
                    </div>
                  )}

                  {/* Ações */}
                  <div className="flex gap-1 pt-1">
                    <button onClick={e => { e.stopPropagation(); setModalDetalhe(c) }}
                      className="flex-1 btn-ghost text-xs border border-border-subtle rounded-lg py-1">
                      📊 Detalhe
                    </button>
                    <button onClick={e => { e.stopPropagation(); setModalLanc(true); setCartaoSel(c.id) }}
                      className="flex-1 btn-ghost text-xs border border-border-subtle rounded-lg py-1">
                      + Lançar
                    </button>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={e => { e.stopPropagation(); setModalLimite(c) }}
                      className="flex-1 py-1 rounded-lg text-[11px] font-medium text-amber-400 hover:bg-amber-500/10 border border-amber-500/20 transition-colors">
                      🎯 Limite
                    </button>
                    <button onClick={e => { e.stopPropagation(); setModalEditar(c) }}
                      className="flex-1 py-1 rounded-lg text-[11px] font-medium text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 transition-colors">
                      ✏️ Editar
                    </button>
                    <button onClick={e => { e.stopPropagation(); handleExcluirCartao(c) }}
                      className="flex-1 py-1 rounded-lg text-[11px] font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">
                      🗑️
                    </button>
                  </div>
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
      {/* Aba Contas PF (corrente, poupanca, digital) */}
      {subAba === 'contas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {contasNormais.length === 0 && (
              <div className="col-span-full text-center py-16">
                <p className="text-4xl mb-3">🏦</p>
                <p className="text-sm font-bold text-fg mb-1">Nenhuma conta bancária PF cadastrada</p>
                <p className="text-xs text-fg-tertiary mb-4">Adicione contas corrente, poupança ou digital para selecionar nos seus lançamentos.</p>
                <button onClick={() => setModalNovaConta(true)} className="btn-primary mx-auto">+ Nova Conta</button>
              </div>
            )}
            {contasNormais.map(c => (
              <div key={c.id} className="bg-surface border border-white/5 rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-fg">{c.nome}</p>
                    <p className="text-[10px] text-fg-tertiary capitalize">{c.tipo?.replace('_', ' ')} · PF</p>
                  </div>
                  <span className="text-2xl">🏦</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-muted/30 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-fg-disabled uppercase">Saldo Inicial</p>
                    <p className="text-sm font-bold text-fg">{fmt(c.saldo_inicial ?? 0)}</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-2 text-center">
                    <p className="text-[9px] text-fg-disabled uppercase">Saldo Atual</p>
                    <p className="text-sm font-bold text-emerald-400">{fmt(c.saldo_atual ?? 0)}</p>
                  </div>
                </div>
                <button onClick={async () => {
                  if (!confirm(`Arquivar conta "${c.nome}"?`)) return
                  await (supabase.from('contas') as any).update({ ativo: false }).eq('id', c.id)
                  carregarContas()
                }} className="w-full py-1 rounded-lg text-[11px] text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">
                  🗑️ Arquivar
                </button>
              </div>
            ))}
            <button onClick={() => setModalNovaConta(true)}
              className="border-2 border-dashed border-border-subtle rounded-2xl p-6 flex flex-col items-center justify-center gap-2 text-fg-disabled hover:border-emerald-500/40 hover:text-emerald-400 transition-all min-h-[180px]">
              <span className="text-3xl">+</span>
              <span className="text-xs font-semibold">Adicionar Conta PF</span>
            </button>
          </div>
        </div>
      )}

      {modalNovaConta && (
        <ModalNovaConta
          userId={userId}
          onClose={() => setModalNovaConta(false)}
          onSave={() => { setModalNovaConta(false); carregarContas() }}
        />
      )}
      {modalLanc && (
        <ModalLancamentoPF
          cartoes={contas} userId={userId}
          onClose={() => setModalLanc(false)}
          onSave={() => { setModalLanc(false); onUpdate() }}
        />
      )}
      {modalCriar && (
        <ModalNovoCarta
          userId={userId}
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
      {modalEditar && (
        <ModalEditarCartao
          conta={modalEditar}
          onClose={() => setModalEditar(null)}
          onSave={() => { setModalEditar(null); carregarContas() }}
        />
      )}
      {modalLimite && (
        <ModalLimiteCartao
          conta={modalLimite}
          onClose={() => setModalLimite(null)}
          onSave={() => carregarContas()}
        />
      )}
      {modalDetalhe && (
        <ModalDetalheCartao
          conta={modalDetalhe}
          gastos={gastos}
          receitas={receitas}
          faturas={faturas}
          onClose={() => setModalDetalhe(null)}
          onLancar={() => {
            setCartaoSel(modalDetalhe.id)
            setModalLanc(true)
            setModalDetalhe(null)
          }}
          onEditar={() => {
            setModalEditar(modalDetalhe)
            setModalDetalhe(null)
          }}
          onExcluir={() => {
            handleExcluirCartao(modalDetalhe)
            setModalDetalhe(null)
          }}
          onFaturaUpdate={carregarContas}
        />
      )}
      {modalFatura && (
        <ModalFaturaPrevista
          conta={modalFatura}
          mesSel={mesSel}
          faturas={faturas}
          onClose={() => setModalFatura(null)}
          onSave={() => {
            carregarContas()
            setModalFatura(null)
          }}
        />
      )}
    </div>
  )
}
