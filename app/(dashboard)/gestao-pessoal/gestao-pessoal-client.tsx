'use client'

import { PageHeader, EmptyState, MetricCard } from '@/components/shared/ui'
import { useState } from 'react'

export default function GestaoPessoalClient() {
  const [activeTab, setActiveTab] = useState<'movimentacoes' | 'cartoes' | 'orcamentos'>('movimentacoes')

  return (
    <>
      <PageHeader
        title="Gestão Pessoal"
        subtitle="Controle suas finanças pessoais: despesas da casa, receitamentos e cartões."
      >
        <button className="btn-primary flex gap-2 items-center shadow-[0_4px_14px_rgba(244,114,182,0.3)] bg-rose-500 text-white hover:bg-rose-400">
          <span>+ Nova Transação Pessoal</span>
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Meu Saldo (Contas)" value="R$ 0,00" />
        <MetricCard label="Receitas (Salário/Rendimentos)" value="R$ 0,00" />
        <MetricCard label="Gastos Pessoais" value="R$ 0,00" />
        <MetricCard label="Fatura Atual (Cartão)" value="R$ 0,00" />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-4 w-fit">
        <button 
          onClick={() => setActiveTab('movimentacoes')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'movimentacoes' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          💳 Resumo e Lançamentos
        </button>
        <button 
          onClick={() => setActiveTab('cartoes')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'cartoes' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          💳 Faturas de Cartão
        </button>
        <button 
          onClick={() => setActiveTab('orcamentos')}
          className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${activeTab === 'orcamentos' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          📊 Orçamentos (Limites)
        </button>
      </div>

      <div className="card border border-white/5 bg-[#080b14]/80 backdrop-blur-sm min-h-[400px] flex items-center justify-center">
         <EmptyState message="Nenhuma movimentação pessoal registrada ainda. Este módulo será seu gestor financeiro isolado da empresa." />
      </div>
    </>
  )
}
