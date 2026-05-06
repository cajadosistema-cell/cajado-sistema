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
import { TabAgenda }      from './_components/tabs/TabAgenda'
import { TabIdeias }      from './_components/tabs/TabIdeias'
import { TabRegistros }   from './_components/tabs/TabRegistros'
import { TabCartoesPF }   from './_components/tabs/TabCartoesPF'
import { SecretariaFlutuante }    from '@/components/shared/SecretariaFlutuante'
import { AlarmManager }           from '@/components/shared/AlarmManager'
import { ModalNovoGasto }         from './_components/modals/ModalNovoGasto'
import { ModalNovaReceita }       from './_components/modals/ModalNovaReceita'
import { PainelComparativoMes }   from '@/components/shared/PainelComparativoMes'
import { PainelLimitesOrcamento } from '@/components/shared/LimitesOrcamento'
import { VencimentosMesPF }       from './_components/VencimentosMesPF'

type TabId = 'resumo' | 'lancamentos' | 'orcamentos' | 'limites' | 'previsao' | 'cartoes' | 'registros' | 'agenda' | 'ideias'

// ── 3 grupos visuais — reduz carga cognitiva ──────────────────
const TAB_GROUPS: { label: string; tabs: { id: TabId; label: string; emoji: string }[] }[] = [
  {
    label: '💰 Financeiro',
    tabs: [
      { id: 'resumo',      label: 'Resumo',      emoji: '📊' },
      { id: 'lancamentos', label: 'Lançamentos', emoji: '📋' },
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
  {
    label: '🌟 Rotina',
    tabs: [
      { id: 'agenda', label: 'Agenda', emoji: '📅' },
      { id: 'ideias', label: 'Ideias', emoji: '💡' },
    ],
  },
]

export default function PfPessoalClient() {
  const supabase = createClient()
  const [tab, setTab] = useState<TabId>('resumo')
  const [modalGasto,   setModalGasto]   = useState(false)
  const [modalReceita, setModalReceita] = useState(false)
  const [modalVencimentosPF, setModalVencimentosPF] = useState(false)
  const [gastoEdit,    setGastoEdit]    = useState<any>(null)
  const [receitaEdit,  setReceitaEdit]  = useState<any>(null)
  const [authUserId,   setAuthUserId]   = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAuthUserId(data.user.id)
    })
  }, [supabase])

  const { data: gastos,     refetch: refetchGastos     } = useSupabaseQuery<GastoPessoal>('gastos_pessoais',     { orderBy: { column: 'data',           ascending: false } })
  const { data: receitas,   refetch: refetchReceitas   } = useSupabaseQuery<ReceitaPessoal>('receitas_pessoais', { orderBy: { column: 'data',           ascending: false } })
  const { data: orcamentos, refetch: refetchOrcamentos } = useSupabaseQuery<OrcamentoPessoal>('orcamentos_pessoais', { orderBy: { column: 'mes_referencia', ascending: false } })
  const { data: ativos          } = useSupabaseQuery<any>('ativos')
  const { data: patrimonioFisico} = useSupabaseQuery<any>('projetos_patrimonio')

  const refreshTudo = () => { refetchGastos(); refetchReceitas(); refetchOrcamentos() }

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
          gastos={gastos} receitas={receitas} onUpdate={refreshTudo}
          onNovoGasto={()   => { setGastoEdit(null);   setModalGasto(true)   }}
          onNovaReceita={()  => { setReceitaEdit(null); setModalReceita(true) }}
          onEditGasto={(g)   => { setGastoEdit(g);      setModalGasto(true)   }}
          onEditReceita={(r) => { setReceitaEdit(r);    setModalReceita(true) }}
        />
      )}
      {tab === 'orcamentos' && (
        <TabOrcamentos gastos={gastos} orcamentos={orcamentos} onUpdate={refetchOrcamentos} />
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
      {tab === 'agenda'    && <TabAgenda    userId={authUserId} />}
      {tab === 'ideias'    && <TabIdeias    userId={authUserId} />}

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
          userId={authUserId} gastoEdit={gastoEdit}
          onSave={() => { refetchGastos();   setModalGasto(false);   setGastoEdit(null)   }}
          onClose={() => {                   setModalGasto(false);   setGastoEdit(null)   }}
        />
      )}
      {modalReceita && (
        <ModalNovaReceita
          userId={authUserId} receitaEdit={receitaEdit}
          onSave={() => { refetchReceitas(); setModalReceita(false); setReceitaEdit(null) }}
          onClose={() => {                   setModalReceita(false); setReceitaEdit(null) }}
        />
      )}
    </>
  )
}
