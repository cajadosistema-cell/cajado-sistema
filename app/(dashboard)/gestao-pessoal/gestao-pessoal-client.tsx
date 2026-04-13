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
        <MetricCard label="Meu Saldo (Disponível)" value="R$ 12.450,00" />
        <MetricCard label="Receitas Mes" value="R$ 15.000,00" />
        <MetricCard label="Gastos Pessoais" value="R$ 4.350,00" />
        <MetricCard label="Fatura Atual (Cartão)" value="R$ 2.800,00" />
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

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl min-h-[400px]">
        {activeTab === 'movimentacoes' && (
          <div className="p-4 md:p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-6">Últimos Lançamentos Pessoais</h2>
            <div className="space-y-4">
              {[
                { data: 'Hoje', nome: 'Supermercado Extra', categoria: 'Alimentação', tipo: 'despesa', valor: -450.50, conta: 'Conta Corrente' },
                { data: 'Ontem', nome: 'Retirada Pró-labore', categoria: 'Receita', tipo: 'receita', valor: 15000.00, conta: 'Conta Corrente' },
                { data: 'Há 2 dias', nome: 'Uber', categoria: 'Transporte', tipo: 'despesa', valor: -25.90, conta: 'Cartão Nubank' },
                { data: 'Há 3 dias', nome: 'Mensalidade Academia', categoria: 'Saúde', tipo: 'despesa', valor: -120.00, conta: 'Cartão Nubank' },
                { data: 'Há 4 dias', nome: 'Restaurante Madero', categoria: 'Lazer', tipo: 'despesa', valor: -180.00, conta: 'Conta Corrente' },
              ].map((item, i) => (
                <div key={i} className="flex justify-between items-center py-3 border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20 px-2 rounded -mx-2 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl shadow-lg border border-white/5 ${item.tipo === 'receita' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                      {item.tipo === 'receita' ? '💰' : '💳'}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200">{item.nome}</p>
                      <p className="text-xs text-zinc-500">{item.data} • {item.categoria} • {item.conta}</p>
                    </div>
                  </div>
                  <p className={`text-sm font-bold ${item.tipo === 'receita' ? 'text-emerald-400' : 'text-zinc-200'}`}>
                    {item.tipo === 'receita' ? '+ ' : ''}R$ {Math.abs(item.valor).toFixed(2)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'cartoes' && (
          <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { nome: 'Nubank Ultravioleta', final: '4321', limite: 15000, gasto: 2800, vencimento: '10/Mai', cor: 'bg-purple-600' },
              { nome: 'Itaú Azul Infinite', final: '9876', limite: 25000, gasto: 6500, vencimento: '15/Mai', cor: 'bg-blue-600' }
            ].map((cartao, i) => {
              const pct = (cartao.gasto / cartao.limite) * 100
              return (
                <div key={i} className="card border border-zinc-800/50 shadow-xl relative overflow-hidden">
                  <div className={`absolute top-0 right-0 w-32 h-32 ${cartao.cor} rounded-full blur-[60px] opacity-20 -mr-10 -mt-10 pointer-events-none`} />
                  <div className="flex justify-between items-start mb-6 tracking-wide">
                    <div>
                      <h3 className="text-base font-semibold text-zinc-100">{cartao.nome}</h3>
                      <p className="text-xs text-zinc-500 mt-0.5">**** **** **** {cartao.final}</p>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-zinc-800 text-zinc-300 border border-zinc-700">Aberta</span>
                  </div>
                  
                  <div className="mb-4">
                    <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-1">Fatura Atual</p>
                    <p className="text-2xl font-bold text-zinc-100">R$ {cartao.gasto.toLocaleString('pt-BR', {minimumFractionDigits:2})}</p>
                  </div>

                  <div className="space-y-1 mt-6">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500">Limite disponível: R$ {(cartao.limite - cartao.gasto).toLocaleString('pt-BR')}</span>
                      <span className="text-zinc-500">{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div className={`h-full ${cartao.cor.replace('bg-', 'bg-')} bg-opacity-80 rounded-full`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <p className="text-[10px] text-zinc-500 mt-4 text-center">Vence em {cartao.vencimento}</p>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'orcamentos' && (
          <div className="p-4 md:p-6">
            <h2 className="text-lg font-semibold text-zinc-100 mb-6">Acompanhamento do Mês</h2>
            <div className="space-y-6 max-w-2xl">
              {[
                { nome: 'Alimentação (Mercado + Ifood)', total: 1500, gasto: 850, icone: '🍔' },
                { nome: 'Transporte (Uber + Gasolina)', total: 800, gasto: 350, icone: '🚗' },
                { nome: 'Lazer e Passeios', total: 1000, gasto: 950, icone: '🍿' },
                { nome: 'Educação / Livros', total: 500, gasto: 120, icone: '📚' },
              ].map((orc, i) => {
                const pct = (orc.gasto / orc.total) * 100
                const isCritico = pct > 90
                return (
                  <div key={i}>
                    <div className="flex justify-between items-center mb-2">
                       <span className="text-sm font-medium text-zinc-200 flex items-center gap-2">
                         <span className="text-lg">{orc.icone}</span> {orc.nome}
                       </span>
                       <span className="text-xs font-semibold text-zinc-300">
                         R$ {orc.gasto} <span className="text-zinc-600 font-normal">/ R$ {orc.total}</span>
                       </span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden border border-zinc-700/50">
                      <div 
                        className={`h-full rounded-full transition-all duration-700 ${isCritico ? 'bg-rose-500' : 'bg-emerald-500'}`} 
                        style={{ width: `${Math.min(pct, 100)}%` }} 
                      />
                    </div>
                    {isCritico && <p className="text-[10px] text-rose-400 mt-1 text-right">Atenção: Limite do orçamento quase esgotado.</p>}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
