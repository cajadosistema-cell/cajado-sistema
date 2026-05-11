'use client'

import { useState, useEffect } from 'react'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { PageHeader } from '@/components/shared/ui'
import { AppPatraoTabs } from '@/components/shared/AppPatraoTabs'
import type { GastoPessoal, ReceitaPessoal, OrcamentoPessoal } from './_components/types'
import { formatCurrency } from './_components/types'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

import { TabResumo }      from './_components/tabs/TabResumo'
import { TabLancamentos } from './_components/tabs/TabLancamentos'
import { TabOrcamentos }  from './_components/tabs/TabOrcamentos'
import { TabPrevisao }    from './_components/tabs/TabPrevisao'
import { TabRegistros }   from './_components/tabs/TabRegistros'
import { TabCartoesPF }   from './_components/tabs/TabCartoesPF'
import { SecretariaFlutuante }    from '@/components/shared/SecretariaFlutuante'
import { AlarmManager }           from '@/components/shared/AlarmManager'
import { ModalNovoGasto }         from './_components/modals/ModalNovoGasto'
import { ModalNovaReceita }       from './_components/modals/ModalNovaReceita'
import { PainelComparativoMes }   from '@/components/shared/PainelComparativoMes'
import { PainelLimitesOrcamento } from '@/components/shared/LimitesOrcamento'
import { VencimentosMesPF }       from './_components/VencimentosMesPF'

type TabId = 'resumo' | 'lancamentos' | 'orcamentos' | 'limites' | 'previsao' | 'cartoes' | 'registros' | 'contas'

// ── 3 grupos visuais — reduz carga cognitiva ──────────────────
const TAB_GROUPS: { label: string; tabs: { id: TabId; label: string; emoji: string }[] }[] = [
  {
    label: '💰 Financeiro',
    tabs: [
      { id: 'resumo',      label: 'Resumo',      emoji: '📊' },
      { id: 'lancamentos', label: 'Lançamentos', emoji: '📋' },
      { id: 'contas',      label: 'Contas',      emoji: '🏦' },
      { id: 'orcamentos',  label: 'Orçamentos',  emoji: '🎯' },
      { id: 'limites',     label: 'Limites',      emoji: '⚠️'  },
    ],
  },
  {
    label: '📅 Planejamento',
    tabs: [
      { id: 'previsao',  label: 'Previsão',   emoji: '🔮' },
      { id: 'cartoes',   label: 'Cartões PF', emoji: '💳' },
      { id: 'registros', label: 'Registros',  emoji: '🗂️' },
    ],
  },
]

export default function PfPessoalClient() {
  const supabase = createClient()
  const [tab, setTab] = useState<TabId>('resumo')
  const [modalGasto,      setModalGasto]      = useState(false)
  const [modalReceita,    setModalReceita]    = useState(false)
  const [modalVencimentosPF, setModalVencimentosPF] = useState(false)
  const [modalNovaConta,  setModalNovaConta]  = useState(false)
  const [gastoEdit,    setGastoEdit]    = useState<any>(null)
  const [receitaEdit,  setReceitaEdit]  = useState<any>(null)
  const [authUserId,   setAuthUserId]   = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAuthUserId(data.user.id)
    })
  }, [supabase])

  const { data: gastos,     refetch: refetchGastos     } = useSupabaseQuery<GastoPessoal>('gastos_pessoais',     { filters: { user_id: authUserId }, orderBy: { column: 'data',           ascending: false }, enabled: !!authUserId })
  const { data: receitas,   refetch: refetchReceitas   } = useSupabaseQuery<ReceitaPessoal>('receitas_pessoais', { filters: { user_id: authUserId }, orderBy: { column: 'data',           ascending: false }, enabled: !!authUserId })
  const { data: orcamentos, refetch: refetchOrcamentos } = useSupabaseQuery<OrcamentoPessoal>('orcamentos_pessoais', { filters: { user_id: authUserId }, orderBy: { column: 'mes_referencia', ascending: false }, enabled: !!authUserId })
  const { data: contas          } = useSupabaseQuery<any>('contas', { filters: { ativo: true, categoria: 'pf', user_id: authUserId }, enabled: !!authUserId })
  // ativos e projetos_patrimonio são isolados por empresa_id via RLS — sem filtro user_id
  const { data: ativos          } = useSupabaseQuery<any>('ativos', { enabled: !!authUserId })
  const { data: patrimonioFisico} = useSupabaseQuery<any>('projetos_patrimonio', { enabled: !!authUserId })
  const refreshTudo = () => { refetchGastos(); refetchReceitas(); refetchOrcamentos() }

  // Quando o authUserId chega (assíncrono), força recarregar todos os dados
  useEffect(() => {
    if (authUserId) refreshTudo()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId])

  useEffect(() => {
    const handleElenaLancamento = () => refreshTudo()
    window.addEventListener('elena:lancamento-salvo', handleElenaLancamento)
    return () => window.removeEventListener('elena:lancamento-salvo', handleElenaLancamento)
  }, [refetchGastos, refetchReceitas, refetchOrcamentos])

  const mesAtual      = new Date().toISOString().slice(0, 7)
  const gastosMes     = gastos.filter(g  => g.data.startsWith(mesAtual))
  const receitasMes   = receitas.filter(r => r.data.startsWith(mesAtual))
  const totalGastos   = gastosMes.reduce((a,  g) => a + g.valor, 0)
  const totalReceitas = receitasMes.reduce((a, r) => a + r.valor, 0)
  const saldo         = totalReceitas - totalGastos

  const netWorthAtivos = ativos.reduce((acc, a)          => acc + (a.valor_atual           ?? a.valor_investido),       0)
  const netWorthFisico = patrimonioFisico.reduce((acc, p) => acc + (p.valor_mercado_atual   ?? p.valor_investido_total),  0)
  const netWorthTotal  = netWorthAtivos + netWorthFisico + saldo

  // Ações contextuais: muda com a aba ativa
  const renderHeaderActions = () => {
    if (tab === 'resumo' || tab === 'lancamentos') return (
      <>
        <button onClick={() => setModalVencimentosPF(true)} title="Ver agenda mensal de contas fixas" className="btn-secondary text-xs h-8 px-3 whitespace-nowrap hidden md:flex">📅 Contas do Mês</button>
        <button onClick={() => setModalReceita(true)} className="btn-secondary text-xs h-8 px-3 whitespace-nowrap hidden md:flex">+ Receita</button>
        <button onClick={() => setModalGasto(true)}   className="btn-primary   text-xs h-8 px-3 whitespace-nowrap">+ Gasto</button>
      </>
    )
    if (tab === 'contas') return (
      <button onClick={() => setModalNovaConta(true)} className="btn-primary text-xs h-8 px-4 whitespace-nowrap">🏦 Nova Conta</button>
    )
    if (tab === 'previsao') return (
      <button onClick={() => setModalReceita(true)} className="btn-secondary text-xs h-8 px-3 whitespace-nowrap">+ Receita Recorrente</button>
    )
    if (tab === 'orcamentos' || tab === 'limites') return (
      <button onClick={() => setModalGasto(true)} className="btn-secondary text-xs h-8 px-3 whitespace-nowrap">+ Gasto</button>
    )
    return null
  }

  return (
    <>
      <PageHeader title="Finanças Pessoais" subtitle="Caixa · Orçamento · Planejamento · Rotina">
        {renderHeaderActions()}
      </PageHeader>

      <AppPatraoTabs />

      {/* ── Hero Net Worth ── */}
      <div className="bg-gradient-to-br from-[#0d1522] to-[#080b14] border border-white/10 rounded-2xl p-5 md:p-8 relative overflow-hidden mb-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10  rounded-full blur-[80px] pointer-events-none" />
        <p className="text-[10px] md:text-xs font-semibold text-fg-secondary tracking-[0.1em] uppercase mb-1 relative z-10">Patrimônio Líquido</p>
        <p className="text-3xl md:text-5xl font-extrabold tracking-tight text-white mb-4 md:mb-6 relative z-10">
          {formatCurrency(netWorthTotal)}
        </p>
        <div className="grid grid-cols-3 gap-2 md:gap-4 relative z-10">
          {[
            { label: 'Caixa',     value: saldo,           color: 'text-amber-400'  },
            { label: 'Investido', value: netWorthAtivos,  color: 'text-blue-400'   },
            { label: 'Bens',      value: netWorthFisico,  color: 'text-indigo-400' },
          ].map(({ label, value, color }) => (
            <div key={label}>
              <p className="text-[9px] md:text-[10px] text-fg-tertiary uppercase tracking-widest mb-0.5">{label}</p>
              <p className={`text-sm md:text-lg font-bold ${color}`}>{formatCurrency(value)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── KPIs do mês ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Receitas do mês', value: formatCurrency(totalReceitas), color: 'text-emerald-400', grad: 'rgba(16,185,129,0.12)'  },
          { label: 'Gastos do mês',   value: formatCurrency(totalGastos),   color: 'text-red-400',     grad: 'rgba(239,68,68,0.1)'    },
          { label: 'Saldo',           value: formatCurrency(saldo),          color: saldo >= 0 ? 'text-amber-400' : 'text-red-400', grad: 'rgba(245,158,11,0.1)' },
          { label: 'Lançamentos',     value: gastosMes.length + receitasMes.length, color: 'text-fg',   grad: 'rgba(139,92,246,0.08)' },
        ].map(k => (
          <div key={k.label} className="bg-surface border border-white/5 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 80% 20%,${k.grad},transparent 70%)` }} />
            <p className="text-[10px] font-medium text-fg-secondary tracking-[0.06em] uppercase mb-2">{k.label}</p>
            <p className={`text-[22px] font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* ── Comparativo Mensal ── */}
      <div className="mb-6">
        <PainelComparativoMes
          lancamentos={[
            ...gastos.map(g   => ({ data: g.data, valor: g.valor, _tipo: 'gasto'   as const })),
            ...receitas.map(r => ({ data: r.data, valor: r.valor, _tipo: 'receita' as const })),
          ]}
          campoData="data" campoTipo="_tipo"
          valorDespesa="gasto" valorReceita="receita"
          titulo="Comparativo Mensal PF"
        />
      </div>

      {/* ── Navegação por grupos — 3 seções ── */}
      <div className="mb-6 space-y-3">
        {TAB_GROUPS.map((group, gi) => (
          <div key={gi}>
            {/* Rótulo do grupo */}
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-fg-disabled px-1 mb-1.5">
              {group.label}
            </p>
            {/* Chips de abas do grupo */}
            <div className="flex gap-1.5 flex-wrap">
              {group.tabs.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'px-3.5 py-1.5 rounded-xl text-[13px] font-semibold border transition-all',
                    tab === t.id
                      ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30 shadow-sm'
                      : 'text-fg-tertiary border-border-subtle hover:text-fg-secondary hover:border-border bg-page'
                  )}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            {/* Separador entre grupos (exceto o último) */}
            {gi < TAB_GROUPS.length - 1 && (
              <div className="mt-3 border-t border-white/5" />
            )}
          </div>
        ))}
      </div>

      {/* ── Conteúdo das abas ── */}
      {tab === 'resumo' && (
        <TabResumo gastos={gastos} receitas={receitas} orcamentos={orcamentos}
          onNovoGasto={() => setModalGasto(true)} onNovaReceita={() => setModalReceita(true)} />
      )}
      {tab === 'lancamentos' && (
        <TabLancamentos
          gastos={gastos} receitas={receitas} contas={contas} onUpdate={refreshTudo}
          onNovoGasto={()   => { setGastoEdit(null);   setModalGasto(true)   }}
          onNovaReceita={()  => { setReceitaEdit(null); setModalReceita(true) }}
          onEditGasto={(g)   => { setGastoEdit(g);      setModalGasto(true)   }}
          onEditReceita={(r) => { setReceitaEdit(r);    setModalReceita(true) }}
        />
      )}
      {tab === 'orcamentos' && (
        <TabOrcamentos userId={authUserId} gastos={gastos} orcamentos={orcamentos} onUpdate={refetchOrcamentos} />
      )}
      {tab === 'limites' && (
        <div className="card"><PainelLimitesOrcamento tipo="pf" /></div>
      )}
      {tab === 'previsao' && (
        <TabPrevisao receitas={receitas} onUpdate={refetchReceitas}
          onNovaReceita={() => setModalReceita(true)} />
      )}
      {tab === 'cartoes' && (
        <TabCartoesPF userId={authUserId} gastos={gastos} receitas={receitas} onUpdate={refreshTudo} />
      )}
      {tab === 'registros' && <TabRegistros userId={authUserId} />}
      {tab === 'contas' && (
        <TabContasPFInline
          userId={authUserId}
          contas={contas}
          modalAberto={modalNovaConta}
          onModalClose={() => setModalNovaConta(false)}
        />
      )}

      <SecretariaFlutuante />
      <AlarmManager userId={authUserId} />

      {/* ── Modais ── */}
      <VencimentosMesPF
        isOpen={modalVencimentosPF}
        onClose={() => setModalVencimentosPF(false)}
        onVerDetalhes={() => {
          setModalVencimentosPF(false)
          setTab('lancamentos')
        }}
      />
      {modalGasto && (
        <ModalNovoGasto
          userId={authUserId} gastoEdit={gastoEdit} contas={contas}
          onSave={() => { refetchGastos();   setModalGasto(false);   setGastoEdit(null)   }}
          onClose={() => {                   setModalGasto(false);   setGastoEdit(null)   }}
        />
      )}
      {modalReceita && (
        <ModalNovaReceita
          userId={authUserId} receitaEdit={receitaEdit} contas={contas}
          onSave={() => { refetchReceitas(); setModalReceita(false); setReceitaEdit(null) }}
          onClose={() => {                   setModalReceita(false); setReceitaEdit(null) }}
        />
      )}
    </>
  )
}

// ── Aba Contas PF (inline no client para acessar refetch) ─────────
function TabContasPFInline({
  userId, contas, modalAberto, onModalClose
}: { userId: string; contas: any[]; modalAberto: boolean; onModalClose: () => void }) {
  const supabase = createClient()
  const { data: todasContas, refetch } = useSupabaseQuery<any>('contas', {
    filters: { ativo: true, categoria: 'pf', user_id: userId },
    enabled: !!userId,
  })

  const [form, setForm] = useState({ nome: '', tipo: 'corrente', saldo_inicial: '' })
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const TIPOS = [
    { id: 'corrente',    label: 'Conta Corrente', emoji: '🏦', desc: 'Bradesco, Itaú, BB...' },
    { id: 'poupanca',   label: 'Poupança',        emoji: '🪙', desc: 'Reserva de emergência' },
    { id: 'digital',    label: 'Conta Digital',   emoji: '📱', desc: 'C6, Nubank, Inter...' },
    { id: 'cartao_credito', label: 'Cartão de Crédito', emoji: '💳', desc: 'Crédito PF' },
    { id: 'cartao_debito',  label: 'Cartão Débito',     emoji: '💸', desc: 'Débito PF' },
    { id: 'investimento',   label: 'Investimento',       emoji: '📈', desc: 'XP, Rico, etc.' },
  ]

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nome.trim()) return
    setLoading(true); setErro('')
    const { error } = await (supabase.from('contas') as any).insert({
      user_id: userId,
      nome: form.nome,
      tipo: form.tipo,
      categoria: 'pf',
      saldo_inicial: form.saldo_inicial ? Number(form.saldo_inicial) : 0,
      saldo_atual: form.saldo_inicial ? Number(form.saldo_inicial) : 0,
      ativo: true,
    })
    setLoading(false)
    if (error) { setErro(error.message); return }
    setForm({ nome: '', tipo: 'corrente', saldo_inicial: '' })
    onModalClose()
    refetch()
  }

  const arquivar = async (id: string, nome: string) => {
    if (!confirm(`Arquivar a conta "${nome}"?\n\nOs lançamentos vinculados a ela NÃO serão apagados. A conta ficará inativa.`)) return
    await (supabase.from('contas') as any).update({ ativo: false }).eq('id', id)
    refetch()
  }

  const tipoConfig: Record<string, { emoji: string; cor: string; label: string }> = {
    corrente:       { emoji: '🏦', cor: '#3b82f6', label: 'Corrente' },
    poupanca:      { emoji: '🪙', cor: '#10b981', label: 'Poupança' },
    digital:       { emoji: '📱', cor: '#8b5cf6', label: 'Digital' },
    cartao_credito:{ emoji: '💳', cor: '#f59e0b', label: 'Crédito' },
    cartao_debito: { emoji: '💸', cor: '#ef4444', label: 'Débito' },
    investimento:  { emoji: '📈', cor: '#06b6d4', label: 'Investimento' },
  }

  const lista = todasContas || []
  const [editando, setEditando] = useState<any>(null)
  const [formEdit, setFormEdit] = useState({ nome: '', tipo: 'corrente', saldo_atual: '' })
  const [salvandoEdit, setSalvandoEdit] = useState(false)

  const abrirEditar = (c: any) => {
    setFormEdit({ nome: c.nome, tipo: c.tipo, saldo_atual: c.saldo_atual != null ? String(c.saldo_atual) : '' })
    setEditando(c)
  }

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editando) return
    setSalvandoEdit(true)
    await (supabase.from('contas') as any).update({
      nome: formEdit.nome,
      tipo: formEdit.tipo,
      saldo_atual: formEdit.saldo_atual ? Number(formEdit.saldo_atual) : 0,
    }).eq('id', editando.id)
    setSalvandoEdit(false)
    setEditando(null)
    refetch()
  }

  return (
    <div className="space-y-4">
      {/* Grid de contas */}
      {lista.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-border-subtle rounded-2xl">
          <p className="text-5xl mb-4">🏦</p>
          <p className="text-base font-bold text-fg mb-2">Nenhuma conta cadastrada</p>
          <p className="text-sm text-fg-tertiary mb-6 max-w-sm mx-auto">
            Adicione suas contas bancárias: Bradesco, C6 Bank, Nubank, Itaú, poupança... Elas aparecem como opção ao registrar um gasto ou receita.
          </p>
          <button onClick={onModalClose} className="btn-primary mx-auto">🏦 Adicionar Primeira Conta</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lista.map((c: any) => {
            const cfg = tipoConfig[c.tipo] ?? { emoji: '🏦', cor: '#6b7280', label: c.tipo }
            return (
              <div key={c.id} className="bg-surface border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-all group">
                {/* Header colorido */}
                <div className="h-16 flex items-center justify-between px-4 relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, ${cfg.cor}33, ${cfg.cor}11)`, borderBottom: `1px solid ${cfg.cor}22` }}>
                  <div>
                    <p className="text-sm font-bold text-fg">{c.nome}</p>
                    <p className="text-[10px]" style={{ color: cfg.cor }}>{cfg.label} · PF</p>
                  </div>
                  <span className="text-2xl">{cfg.emoji}</span>
                </div>
                {/* Saldos */}
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-muted/30 rounded-xl p-2.5 text-center">
                      <p className="text-[9px] text-fg-disabled uppercase tracking-wide">Saldo Inicial</p>
                      <p className="text-sm font-bold text-fg">{(c.saldo_inicial ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                    <div className="bg-muted/30 rounded-xl p-2.5 text-center">
                      <p className="text-[9px] text-fg-disabled uppercase tracking-wide">Saldo Atual</p>
                      <p className="text-sm font-bold text-emerald-400">{(c.saldo_atual ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => abrirEditar(c)}
                      className="flex-1 py-1.5 rounded-xl text-[11px] font-medium text-blue-400 hover:bg-blue-500/10 border border-blue-500/20 transition-colors">
                      ✏️ Editar
                    </button>
                    <button onClick={() => arquivar(c.id, c.nome)}
                      className="flex-1 py-1.5 rounded-xl text-[11px] font-medium text-red-400 hover:bg-red-500/10 border border-red-500/20 transition-colors">
                      🗂️ Arquivar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {/* Card para adicionar */}
          <button onClick={onModalClose}
            className="border-2 border-dashed border-border-subtle rounded-2xl p-6 flex flex-col items-center justify-center gap-3 text-fg-disabled hover:border-emerald-500/40 hover:text-emerald-400 transition-all min-h-[160px]">
            <span className="text-4xl">+</span>
            <div className="text-center">
              <p className="text-xs font-bold">Adicionar Conta</p>
              <p className="text-[10px] mt-0.5">C6, Nubank, Itaú, Bradesco...</p>
            </div>
          </button>
        </div>
      )}

      {/* Modal Criar */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h2 className="text-sm font-bold text-white">🏦 Nova Conta Bancária PF</h2>
              <button onClick={onModalClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-5">
              <div>
                <label className="label">Nome do Banco / Conta *</label>
                <input className="input mt-1 w-full" required
                  placeholder="Ex: C6 Bank, Bradesco Corrente, Nubank, Itaú Poupança..."
                  value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="label mb-2 block">Tipo de Conta *</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TIPOS.map(t => (
                    <button key={t.id} type="button"
                      onClick={() => setForm(f => ({ ...f, tipo: t.id }))}
                      className={cn(
                        'flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl text-xs font-medium border transition-all',
                        form.tipo === t.id
                          ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-300'
                          : 'border-border-subtle text-fg-tertiary hover:text-fg hover:border-border'
                      )}>
                      <span className="text-base">{t.emoji} {t.label}</span>
                      <span className="text-[9px] opacity-60">{t.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Saldo Atual (R$)</label>
                <input className="input mt-1 w-full" type="number" step="0.01" placeholder="0,00"
                  value={form.saldo_inicial} onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
                <p className="text-[10px] text-fg-tertiary mt-1">Informe o saldo atual para controle correto. Pode ser 0.</p>
              </div>
              {erro && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-2">{erro}</p>}
              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button type="button" onClick={onModalClose} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? 'Salvando...' : '🏦 Cadastrar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar Conta */}
      {editando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
              <h2 className="text-sm font-bold text-white">✏️ Editar Conta — {editando.nome}</h2>
              <button onClick={() => setEditando(null)} className="text-fg-tertiary hover:text-fg text-xl">×</button>
            </div>
            <div className="bg-amber-500/5 border-b border-amber-500/10 px-5 py-2">
              <p className="text-[10px] text-amber-400">⚠️ Os lançamentos vinculados a esta conta <strong>não serão alterados</strong>. Apenas os dados cadastrais serão atualizados.</p>
            </div>
            <form onSubmit={salvarEdicao} className="p-5 space-y-4">
              <div>
                <label className="label">Nome da Conta *</label>
                <input className="input mt-1 w-full" required value={formEdit.nome}
                  onChange={e => setFormEdit(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div>
                <label className="label mb-2 block">Tipo</label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS.map(t => (
                    <button key={t.id} type="button" onClick={() => setFormEdit(f => ({ ...f, tipo: t.id }))}
                      className={cn('flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all',
                        formEdit.tipo === t.id ? 'border-blue-500/60 bg-blue-500/10 text-blue-300' : 'border-border-subtle text-fg-tertiary hover:text-fg')}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Saldo Atual (R$)</label>
                <input className="input mt-1 w-full" type="number" step="0.01"
                  value={formEdit.saldo_atual} onChange={e => setFormEdit(f => ({ ...f, saldo_atual: e.target.value }))} />
                <p className="text-[10px] text-fg-tertiary mt-1">Corrija se houve erro. Não reconstrói histórico automático.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button type="button" onClick={() => setEditando(null)} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={salvandoEdit} className="btn-primary">
                  {salvandoEdit ? 'Salvando...' : '💾 Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

