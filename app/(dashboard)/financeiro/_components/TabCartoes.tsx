'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import { EmptyState } from '@/components/shared/ui'
import { exportarLancamentos } from '@/lib/export-utils'
import { PainelMilhas, ModalEditarMilhas } from '@/components/shared/PainelMilhas'

const COLORS = ['#10b981', '#3b82f6', '#f5a623', '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#facc15']

const BANDEIRAS_PJ = [
  { id: 'visa',       label: 'Visa',       emoji: '💳', cor: '#1a1f71' },
  { id: 'mastercard', label: 'Mastercard', emoji: '🔴', cor: '#eb001b' },
  { id: 'elo',        label: 'Elo',        emoji: '🟡', cor: '#c8a800' },
  { id: 'amex',       label: 'Amex',       emoji: '💎', cor: '#2e77bc' },
  { id: 'hipercard',  label: 'Hipercard',  emoji: '🔶', cor: '#e22c1b' },
  { id: 'outras',     label: 'Outras',     emoji: '💳', cor: '#6b7280' },
]

function ModalEditarCartaoPJ({ conta, onClose, onSave }: { conta: any; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    nome_cartao:    conta.nome_cartao || conta.nome || '',
    bandeira:       conta.bandeira    || 'outras',
    limite:         conta.limite      != null ? String(conta.limite) : '',
    dia_fechamento: conta.dia_fechamento != null ? String(conta.dia_fechamento) : '',
    dia_vencimento: conta.dia_vencimento != null ? String(conta.dia_vencimento) : '',
  })
  const band = BANDEIRAS_PJ.find(b => b.id === form.bandeira) ?? BANDEIRAS_PJ[5]

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await (supabase.from('contas') as any).update({
      nome: form.nome_cartao, nome_cartao: form.nome_cartao,
      bandeira: form.bandeira, cor: band.cor,
      limite:         form.limite         ? Number(form.limite)         : null,
      dia_fechamento: form.dia_fechamento ? Number(form.dia_fechamento) : null,
      dia_vencimento: form.dia_vencimento ? Number(form.dia_vencimento) : null,
    }).eq('id', conta.id)
    setLoading(false); onSave(); onClose()
  }

  const arquivar = async () => {
    if (!confirm(`Arquivar o cartão "${conta.nome_cartao || conta.nome}"?\n\nOs lançamentos vinculados NÃO serão apagados.`)) return
    await (supabase.from('contas') as any).update({ ativo: false }).eq('id', conta.id)
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="h-20 flex items-center justify-between px-4 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${band.cor}cc, ${band.cor}66)` }}>
          <div><p className="text-white font-bold text-sm">{form.nome_cartao || 'Cartão PJ'}</p>
            <p className="text-white/60 text-[10px]">{band.label} · PJ</p></div>
          <span className="text-3xl">{band.emoji}</span>
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">✏️ Editar Cartão PJ</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>
        <div className="bg-amber-500/5 border-b border-amber-500/10 px-5 py-2">
          <p className="text-[10px] text-amber-400">⚠️ Os lançamentos vinculados <strong>não serão alterados</strong>.</p>
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
              {BANDEIRAS_PJ.map(b => (
                <button key={b.id} type="button" onClick={() => setForm(f => ({ ...f, bandeira: b.id }))}
                  className={cn('flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all',
                    form.bandeira === b.id ? 'border-white/40 text-white' : 'border-border-subtle text-fg-tertiary hover:text-fg')}
                  style={form.bandeira === b.id ? { background: b.cor + '33', borderColor: b.cor + '66' } : {}}>
                  {b.emoji} {b.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Limite (R$)</label>
              <input className="input mt-1 w-full" type="number" step="0.01" placeholder="0.00"
                value={form.limite} onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dia Fech.</label>
              <input className="input mt-1 w-full" type="number" min="1" max="31" placeholder="Ex: 15"
                value={form.dia_fechamento} onChange={e => setForm(f => ({ ...f, dia_fechamento: e.target.value }))} />
            </div>
            <div>
              <label className="label">Dia Venc.</label>
              <input className="input mt-1 w-full" type="number" min="1" max="31" placeholder="Ex: 22"
                value={form.dia_vencimento} onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <button type="button" onClick={arquivar}
              className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">
              🗂️ Arquivar Cartão
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
              <button type="submit" disabled={loading} className="btn-primary text-xs">
                {loading ? 'Salvando...' : '💾 Salvar'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function fmt(v: number) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }

function mesAtualYM() { return new Date().toISOString().substring(0, 7) }

// ── Painel duplo Prévia + Fatura Real (PJ) ──────────────────────
function FaturaPainelPJ({ cartaoId, mesRef, gastoSistema }: { cartaoId: string; mesRef: string; gastoSistema: number }) {
  const supabase = createClient()
  const [faturaObj, setFaturaObj] = useState<any>(null)
  const [editPrev, setEditPrev] = useState(false)
  const [editReal, setEditReal] = useState(false)
  const [valPrev, setValPrev] = useState('')
  const [valReal, setValReal] = useState('')
  const [loading, setLoading] = useState(false)

  const carregar = useCallback(async () => {
    const { data } = await (supabase.from('faturas_cartoes') as any)
      .select('*').eq('conta_id', cartaoId).eq('mes_referencia', mesRef).single()
    setFaturaObj(data)
    setValPrev(data?.valor_previsto != null ? String(data.valor_previsto) : '')
    setValReal(data?.valor_fechado  != null ? String(data.valor_fechado)  : '')
  }, [cartaoId, mesRef, supabase])

  useEffect(() => { if (cartaoId && mesRef) carregar() }, [carregar])

  const salvar = async (campo: 'valor_previsto' | 'valor_fechado', raw: string) => {
    setLoading(true)
    const val = parseFloat(raw.replace(',', '.'))
    await (supabase.from('faturas_cartoes') as any).upsert({
      conta_id: cartaoId,
      mes_referencia: mesRef,
      [campo]: isNaN(val) ? null : val,
    }, { onConflict: 'conta_id,mes_referencia' })
    setLoading(false)
    setEditPrev(false); setEditReal(false)
    carregar()
  }

  const prev = faturaObj?.valor_previsto != null ? Number(faturaObj.valor_previsto) : null
  const real = faturaObj?.valor_fechado  != null ? Number(faturaObj.valor_fechado)  : null
  const diff = real != null ? gastoSistema - real : null

  return (
    <div className="bg-surface border border-white/5 rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-fg-secondary font-medium tracking-wider uppercase mb-1">Total no Sistema</p>
          <p className="text-3xl font-bold text-fg">{fmt(gastoSistema)}</p>
        </div>
        <span className="text-3xl">💳</span>
      </div>

      <div className="h-px bg-white/5" />

      {/* Prévia */}
      <div className="flex items-center justify-between gap-2 bg-blue-500/5 border border-blue-500/20 rounded-xl px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-blue-400 font-bold uppercase tracking-wider">📋 Prévia (antes de fechar)</p>
          {editPrev ? (
            <div className="flex gap-1.5 mt-1.5">
              <input type="number" step="0.01" autoFocus className="input text-xs flex-1 py-1 h-7"
                placeholder="Ex: 3500.00" value={valPrev} onChange={e => setValPrev(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvar('valor_previsto', valPrev); if (e.key === 'Escape') setEditPrev(false) }} />
              <button onClick={() => salvar('valor_previsto', valPrev)} disabled={loading}
                className="px-2 h-7 rounded bg-blue-500/20 text-blue-400 text-xs font-bold">{loading ? '...' : '✓'}</button>
              <button onClick={() => setEditPrev(false)} className="px-2 h-7 rounded bg-white/5 text-fg-disabled text-xs">✕</button>
            </div>
          ) : (
            <p className={`text-sm font-bold mt-0.5 ${prev != null ? 'text-blue-300' : 'text-fg-disabled text-xs italic'}`}>
              {prev != null ? fmt(prev) : 'não informada'}
            </p>
          )}
        </div>
        {!editPrev && (
          <button onClick={() => setEditPrev(true)} className="shrink-0 text-[10px] text-blue-400 hover:text-blue-300 border border-blue-500/20 rounded px-2 py-1">
            {prev != null ? '✏️ Editar' : '+ Definir'}
          </button>
        )}
      </div>

      {/* Fatura Real */}
      <div className="flex items-center justify-between gap-2 bg-amber-500/5 border border-amber-500/20 rounded-xl px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">🧾 Fatura Real (após fechar)</p>
          {editReal ? (
            <div className="flex gap-1.5 mt-1.5">
              <input type="number" step="0.01" autoFocus className="input text-xs flex-1 py-1 h-7"
                placeholder="Ex: 3200.00" value={valReal} onChange={e => setValReal(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') salvar('valor_fechado', valReal); if (e.key === 'Escape') setEditReal(false) }} />
              <button onClick={() => salvar('valor_fechado', valReal)} disabled={loading}
                className="px-2 h-7 rounded bg-amber-500/20 text-amber-400 text-xs font-bold">{loading ? '...' : '✓'}</button>
              <button onClick={() => setEditReal(false)} className="px-2 h-7 rounded bg-white/5 text-fg-disabled text-xs">✕</button>
            </div>
          ) : (
            <p className={`text-sm font-bold mt-0.5 ${real != null ? 'text-amber-300' : 'text-fg-disabled text-xs italic'}`}>
              {real != null ? fmt(real) : 'não informada'}
            </p>
          )}
        </div>
        {!editReal && (
          <button onClick={() => setEditReal(true)} className="shrink-0 text-[10px] text-amber-400 hover:text-amber-300 border border-amber-500/20 rounded px-2 py-1">
            {real != null ? '✏️ Editar' : '+ Definir'}
          </button>
        )}
      </div>

      {/* Comparativo */}
      {real != null && (
        <div className={`rounded-xl px-3 py-2 text-center text-xs font-bold ${Math.abs(diff!) <= 0.5 ? 'bg-emerald-500/10 text-emerald-400' : diff! > 0 ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
          {Math.abs(diff!) <= 0.5 ? '✅ Sistema bate com a fatura real!'
            : diff! > 0 ? `⚠️ ${fmt(diff!)} a mais no sistema vs fatura`
            : `✅ ${fmt(Math.abs(diff!))} a menos que a fatura`}
        </div>
      )}
    </div>
  )
}

export function TabCartoes({
  contas,
  lancamentos,
  categorias,
  onNovoGasto
}: {
  contas: any[]
  lancamentos: any[]
  categorias: any[]
  onNovoGasto: () => void
}) {
  const cartoes = contas.filter(c => c.tipo === 'cartao_credito')
  const [cartaoSelecionado, setCartaoSelecionado] = useState<string>(cartoes[0]?.id || 'todos')
  const [mesSel] = useState(mesAtualYM())
  const [editandoCartao, setEditandoCartao] = useState<any>(null)
  const [editandoMilhas, setEditandoMilhas] = useState<any>(null)
  const [listaCartoes, setListaCartoes] = useState<any[]>(cartoes)

  // Recarregar cartões ao salvar milhas
  const supabasePJ = createClient()
  const recarregarCartoes = useCallback(async () => {
    const ids = cartoes.map(c => c.id)
    if (!ids.length) return
    const { data } = await (supabasePJ.from('contas') as any).select('*').in('id', ids)
    if (data) setListaCartoes(data)
  }, [cartoes, supabasePJ])

  useEffect(() => { setListaCartoes(cartoes) }, [cartoes])

  if (cartoes.length === 0) {
    return (
      <div className="bg-surface border border-white/5 rounded-xl p-8 text-center mt-6">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">💳</span>
        </div>
        <h3 className="text-lg font-bold text-fg mb-2">Sem Cartões de Crédito</h3>
        <p className="text-sm text-fg-tertiary mb-6 max-w-md mx-auto">
          Você não possui contas configuradas como Cartão de Crédito. Para utilizar este painel de gestão de faturas, crie uma &ldquo;Nova Conta&rdquo; definindo o tipo como &ldquo;Cartão de Crédito&rdquo;.
        </p>
        <button onClick={onNovoGasto} className="btn-primary">Criar Cadastro de Conta</button>
      </div>
    )
  }

  const gastosTudo = lancamentos.filter(l =>
    l.tipo === 'despesa' &&
    listaCartoes.some(c => c.id === l.conta_id) &&
    (cartaoSelecionado === 'todos' || l.conta_id === cartaoSelecionado)
  )

  const gastosCategoriaTracker: Record<string, number> = {}
  gastosTudo.forEach(g => {
    const nomeCat = g.categoria_id
      ? categorias.find(c => c.id === g.categoria_id)?.nome || 'Outros'
      : 'Sem Categoria'
    gastosCategoriaTracker[nomeCat] = (gastosCategoriaTracker[nomeCat] || 0) + g.valor
  })

  const dataCategorias = Object.entries(gastosCategoriaTracker)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  const totalGasto = dataCategorias.reduce((a, c) => a + c.value, 0)

  const gastosPorConta = cartoes.map(c => {
    const total = lancamentos
      .filter(l => l.conta_id === c.id && l.tipo === 'despesa')
      .reduce((a, l) => a + l.valor, 0)
    return { name: c.nome, total, cat: c.categoria }
  })

  const BAND_CORES: Record<string, string> = {
    visa: '#1a1f71', mastercard: '#eb001b', elo: '#c8a800',
    amex: '#2e77bc', hipercard: '#e22c1b', outras: '#6b7280',
  }
  const BAND_EMOJI: Record<string, string> = {
    visa: '💳', mastercard: '🔴', elo: '🟡', amex: '💎', hipercard: '🔶', outras: '💳',
  }

  return (
    <>
    <div className="space-y-6 mt-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg font-semibold text-fg">Gestão de Cartões de Crédito</h2>
          <p className="text-xs text-fg-tertiary">Controle faturas, veja onde gastou mais e centralize os gastos PF e PJ.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => {
              const filtrados = gastosTudo.filter(l => cartaoSelecionado === 'todos' || l.conta_id === cartaoSelecionado)
              exportarLancamentos(filtrados, [], cartoes, `cartoes_pj${cartaoSelecionado !== 'todos' ? '_' + (cartoes.find(c => c.id === cartaoSelecionado)?.nome_cartao || cartaoSelecionado) : ''}`)
            }}
            className="btn-secondary whitespace-nowrap text-xs">
            📤 Exportar CSV
          </button>
          <button onClick={onNovoGasto} className="btn-primary whitespace-nowrap">
            + Lançar no Cartão
          </button>
        </div>
      </div>

      {/* Seletor visual de cartões */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        <button
          onClick={() => setCartaoSelecionado('todos')}
          className={cn(
            'flex-shrink-0 px-4 py-2 rounded-xl text-xs font-semibold border transition-all',
            cartaoSelecionado === 'todos'
              ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
              : 'border-border-subtle text-fg-tertiary hover:border-border hover:text-fg'
          )}
        >
          🗂️ Todos ({cartoes.length})
        </button>
        {listaCartoes.map(c => {
          const band = c.bandeira || 'outras'
          const cor = BAND_CORES[band] ?? '#6b7280'
          const emoji = BAND_EMOJI[band] ?? '💳'
          const isSel = cartaoSelecionado === c.id
          return (
            <div key={c.id} className="flex-shrink-0 flex items-center">
              <button
                onClick={() => setCartaoSelecionado(c.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-xs font-semibold border transition-all',
                  isSel ? 'rounded-l-xl border-r-0' : 'rounded-xl',
                  isSel ? 'border-white/20 text-white shadow-lg' : 'border-border-subtle text-fg-tertiary hover:border-border hover:text-fg'
                )}
                style={isSel ? { background: cor + '33', borderColor: cor + '66' } : {}}
              >
                <span>{emoji}</span>
                <span>{c.nome_cartao || c.nome}</span>
                {c.limite && <span className="text-[10px] opacity-60">· Lim. {formatCurrency(c.limite)}</span>}
                {(c.dia_fechamento || c.dia_vencimento) && (
                  <span className="text-[10px] opacity-60">· Fech. {c.dia_fechamento} / Venc. {c.dia_vencimento}</span>
                )}
              </button>
              {isSel && (
                <div className="flex">
                  <button onClick={() => setEditandoCartao(c)}
                    className="flex items-center justify-center px-2 py-2 border border-l-0 border-white/20 bg-white/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-colors"
                    style={{ borderColor: cor + '66' }} title="Editar Cartão">✏️</button>
                  <button onClick={() => { if(confirm(`Arquivar o cartão "${c.nome_cartao||c.nome}"?\nLançamentos não serão apagados.`)) { createClient().from('contas').update({ativo:false}).eq('id',c.id).then(()=>onNovoGasto()) } }}
                    className="flex items-center justify-center px-2 py-2 border border-l-0 border-white/20 rounded-r-xl bg-white/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors"
                    style={{ borderColor: cor + '66' }} title="Arquivar Cartão">🗂️</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Painel de Milhas (cartão selecionado) ──────────────── */}
      {cartaoSelecionado !== 'todos' && (() => {
        const cartaoAtual = listaCartoes.find(c => c.id === cartaoSelecionado)
        if (!cartaoAtual) return null
        const gastoCartao = lancamentos
          .filter(l => l.tipo === 'despesa' && l.conta_id === cartaoSelecionado)
          .reduce((a: number, l: any) => a + l.valor, 0)
        return (
          <PainelMilhas
            conta={cartaoAtual}
            gastoMes={gastoCartao}
            onEditar={() => setEditandoMilhas(cartaoAtual)}
          />
        )
      })()}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Painel de Fatura — Prévia + Real */}
        {cartaoSelecionado !== 'todos' ? (
          <FaturaPainelPJ
            cartaoId={cartaoSelecionado}
            mesRef={mesSel}
            gastoSistema={totalGasto}
          />
        ) : (
          <div className="bg-surface border border-white/5 rounded-xl p-5 md:col-span-1 shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[220px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-[40px] pointer-events-none"></div>
            <p className="text-xs text-fg-secondary font-medium tracking-wider uppercase mb-2 relative z-10">Total na Fatura Atual</p>
            <p className="text-4xl font-['Syne'] font-bold text-fg mb-1 relative z-10">
              {formatCurrency(totalGasto)}
            </p>
            <p className="text-[11px] text-fg-tertiary mt-2 relative z-10">
              Com base em <strong className="text-fg-secondary">{gastosTudo.length} transações</strong> não validadas identificadas como compras no crédito.
            </p>
            <p className="text-[10px] text-blue-400 mt-3 relative z-10">💡 Selecione um cartão para ver Prévia e Fatura Real</p>
          </div>
        )}

        {/* Gráfico Onde Gastou Mais (Categorias) */}
        <div className="bg-surface border border-white/5 rounded-xl p-5 md:col-span-2">
          <h3 className="text-sm font-semibold text-fg mb-4">Onde o dinheiro foi gasto?</h3>
          {dataCategorias.length === 0 ? (
            <div className="h-[180px] flex items-center justify-center">
              <EmptyState message="Sem dados de compras neste cartão" />
            </div>
          ) : (
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="h-[180px] w-[180px]">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={dataCategorias}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={5}
                       dataKey="value"
                       stroke="none"
                     >
                       {dataCategorias.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <Tooltip
                       formatter={(value: number) => formatCurrency(value)}
                       contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '8px' }}
                     />
                   </PieChart>
                 </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3 w-full">
                {dataCategorias.slice(0, 5).map((d, i) => (
                  <div key={d.name}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-fg-secondary flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                        {d.name}
                      </span>
                      <span className="font-semibold text-fg">{formatCurrency(d.value)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                      <div className="h-1.5 rounded-full" style={{ width: `${(d.value / totalGasto) * 100}%`, backgroundColor: COLORS[i % COLORS.length] }}></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Histórico Recente do Cartão */}
      <div className="bg-surface border border-white/5 rounded-xl p-5">
        <h3 className="section-title">Últimas Transações no Cartão</h3>
        {gastosTudo.length === 0 ? (
          <EmptyState message="Nenhuma transação com cartão cadastrada" />
        ) : (
          <div className="mt-4 space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
            {gastosTudo.slice(0, 20).map(l => (
              <div key={l.id} className="flex justify-between items-center p-3 rounded-lg border border-white/5 bg-black/20 hover:bg-white/5 transition-colors">
                <div className="flex gap-3 items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center text-xs">
                    💳
                  </div>
                  <div>
                    <p className="text-sm font-medium text-fg">{l.descricao}</p>
                    <p className="text-xs text-fg-tertiary">
                      Venc: {l.data_competencia} • {categorias.find(c => c.id === l.categoria_id)?.nome || 'Outros'}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-semibold text-red-400">
                  - {formatCurrency(l.valor)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
    {editandoCartao && (
      <ModalEditarCartaoPJ
        conta={editandoCartao}
        onClose={() => setEditandoCartao(null)}
        onSave={() => { setEditandoCartao(null); onNovoGasto() }}
      />
    )}
    {editandoMilhas && (
      <ModalEditarMilhas
        conta={editandoMilhas}
        onClose={() => setEditandoMilhas(null)}
        onSave={() => { recarregarCartoes(); setEditandoMilhas(null) }}
      />
    )}
  </>
  )
}
