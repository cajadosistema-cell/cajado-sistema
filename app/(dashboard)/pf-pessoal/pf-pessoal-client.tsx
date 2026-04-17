'use client'

import { useState } from 'react'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { PageHeader } from '@/components/shared/ui'
import { AppPatraoTabs } from '@/components/shared/AppPatraoTabs'
import type { GastoPessoal, ReceitaPessoal, OrcamentoPessoal } from './_components/types'
import { formatCurrency } from './_components/types'

import { TabResumo }      from './_components/tabs/TabResumo'
import { TabLancamentos } from './_components/tabs/TabLancamentos'
import { TabOrcamentos }  from './_components/tabs/TabOrcamentos'
import { TabPrevisao }    from './_components/tabs/TabPrevisao'
import { SecretariaFlutuante } from '@/components/shared/SecretariaFlutuante'
import { ModalNovoGasto }   from './_components/modals/ModalNovoGasto'
import { ModalNovaReceita } from './_components/modals/ModalNovaReceita'

type TabId = 'resumo' | 'lancamentos' | 'orcamentos' | 'previsao'

const TABS = [
  { id: 'resumo'       as TabId, label: 'Resumo',      emoji: '📊' },
  { id: 'lancamentos'  as TabId, label: 'Lançamentos', emoji: '📋' },
  { id: 'orcamentos'   as TabId, label: 'Orçamentos',  emoji: '🎯' },
  { id: 'previsao'     as TabId, label: 'Previsão',    emoji: '🔮' },
]

export default function PfPessoalClient() {
  const [tab, setTab] = useState<TabId>('resumo')
  const [modalGasto, setModalGasto] = useState(false)
  const [modalReceita, setModalReceita] = useState(false)

  const { data: gastos, refetch: refetchGastos } = useSupabaseQuery<GastoPessoal>('gastos_pessoais', {
    orderBy: { column: 'data', ascending: false },
  })

  const { data: receitas, refetch: refetchReceitas } = useSupabaseQuery<ReceitaPessoal>('receitas_pessoais', {
    orderBy: { column: 'data', ascending: false },
  })

  const { data: orcamentos, refetch: refetchOrcamentos } = useSupabaseQuery<OrcamentoPessoal>('orcamentos_pessoais', {
    orderBy: { column: 'mes_referencia', ascending: false },
  })
  
  // App do Patrão: Valores de Patrimônio & Investimentos
  const { data: ativos } = useSupabaseQuery<any>('ativos')
  const { data: patrimonioFisico } = useSupabaseQuery<any>('projetos_patrimonio')

  const refreshTudo = () => { refetchGastos(); refetchReceitas(); refetchOrcamentos() }

  const mesAtual = new Date().toISOString().slice(0, 7)
  const gastosMes = gastos.filter(g => g.data.startsWith(mesAtual))
  const receitasMes = receitas.filter(r => r.data.startsWith(mesAtual))
  const totalGastos = gastosMes.reduce((a, g) => a + g.valor, 0)
  const totalReceitas = receitasMes.reduce((a, r) => a + r.valor, 0)
  const saldo = totalReceitas - totalGastos

  // Total Patrimonio = Investimentos (ações) + Patrimonio Físico + (Receitas - Despesas geral ou Saldo de caixa? Apenas o que temos em Ativos + Imoveis)
  const netWorthAtivos = ativos.reduce((acc, a) => acc + (a.valor_atual ?? a.valor_investido), 0)
  const netWorthFisico = patrimonioFisico.reduce((acc, p) => acc + (p.valor_mercado_atual ?? p.valor_investido_total), 0)
  const netWorthTotal = netWorthAtivos + netWorthFisico + saldo

  // Pegar userId do primeiro gasto ou receita (fallback; em prod usar auth.getUser())
  const userId = gastos[0]?.user_id ?? receitas[0]?.user_id ?? ''

  return (
    <>
      <PageHeader
        title="App do Patrão"
        subtitle="Gestão Pessoal · Patrimônio · Investimentos"
      >
        <button onClick={() => setModalReceita(true)} className="btn-secondary text-xs h-8 px-3 md:flex hidden">+ Receita</button>
        <button onClick={() => setModalGasto(true)} className="btn-primary text-xs h-8 px-3 shadow-[0_0_10px_rgba(16,185,129,0.2)]">+ Lançar Gasto</button>
      </PageHeader>

      <AppPatraoTabs />

      {/* App do Patrão: Hero Card (Net Worth) */}
      <div className="bg-gradient-to-br from-[#0d1522] to-[#080b14] border border-white/10 rounded-2xl p-6 md:p-8 relative overflow-hidden mb-6 shadow-2xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none"></div>
        
        <p className="text-xs md:text-sm font-semibold text-[#8b98b8] tracking-[0.1em] uppercase mb-1 relative z-10">Patrimônio Líquido Total</p>
        <p className="text-4xl md:text-5xl font['Syne'] font-extrabold tracking-tight text-white mb-6 relative z-10 drop-shadow-md">
          {formatCurrency(netWorthTotal)}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 relative z-10">
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Caixa / Saldo</p>
            <p className="text-lg font-bold text-amber-400">{formatCurrency(saldo)}</p>
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Investido</p>
            <p className="text-lg font-bold text-blue-400">{formatCurrency(netWorthAtivos)}</p>
          </div>
          <div className="col-span-2 md:col-span-1">
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Bens & Imóveis</p>
            <p className="text-lg font-bold text-indigo-400">{formatCurrency(netWorthFisico)}</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Receitas do mês',  value: formatCurrency(totalReceitas), color: 'text-emerald-400', grad: 'rgba(16,185,129,0.12)' },
          { label: 'Gastos do mês',    value: formatCurrency(totalGastos),   color: 'text-red-400',     grad: 'rgba(239,68,68,0.1)' },
          { label: 'Saldo',            value: formatCurrency(saldo),          color: saldo >= 0 ? 'text-amber-400' : 'text-red-400', grad: 'rgba(245,158,11,0.1)' },
          {
            label: 'Lançamentos',
            value: gastosMes.length + receitasMes.length,
            color: 'text-zinc-200',
            grad: 'rgba(139,92,246,0.08)',
          },
        ].map(k => (
          <div key={k.label} className="bg-[#111827] border border-white/5 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at 80% 20%,${k.grad},transparent 70%)` }} />
            <p className="text-[10px] font-medium text-[#8b98b8] tracking-[0.06em] uppercase mb-2">{k.label}</p>
            <p className={`text-[22px] font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-6 w-fit overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {tab === 'resumo' && (
        <TabResumo
          gastos={gastos}
          receitas={receitas}
          orcamentos={orcamentos}
          onNovoGasto={() => setModalGasto(true)}
          onNovaReceita={() => setModalReceita(true)}
        />
      )}
      {tab === 'lancamentos' && (
        <TabLancamentos
          gastos={gastos}
          receitas={receitas}
          onUpdate={refreshTudo}
          onNovoGasto={() => setModalGasto(true)}
          onNovaReceita={() => setModalReceita(true)}
        />
      )}
      {tab === 'orcamentos' && (
        <TabOrcamentos
          gastos={gastos}
          orcamentos={orcamentos}
          onUpdate={refetchOrcamentos}
        />
      )}
      {tab === 'previsao' && (
        <TabPrevisao
          receitas={receitas}
          onUpdate={refetchReceitas}
          onNovaReceita={() => setModalReceita(true)}
        />
      )}

      {/* Secretária Flutuante do Patrão */}
      <SecretariaFlutuante />

      {/* Modais */}
      {modalGasto && userId && (
        <ModalNovoGasto
          userId={userId}
          onSave={refetchGastos}
          onClose={() => setModalGasto(false)}
        />
      )}
      {modalGasto && !userId && (
        /* Usuário ainda sem ID — toast simples */
        <div className="fixed bottom-4 right-4 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs px-4 py-3 rounded-xl z-50">
          Faça um lançamento de receita primeiro para inicializar seu perfil.
          <button onClick={() => setModalGasto(false)} className="ml-3 text-amber-400 hover:text-amber-200">✕</button>
        </div>
      )}
      {modalReceita && (
        <ModalNovaReceita
          userId={userId || 'temp'}
          onSave={refetchReceitas}
          onClose={() => setModalReceita(false)}
        />
      )}
    </>
  )
}
