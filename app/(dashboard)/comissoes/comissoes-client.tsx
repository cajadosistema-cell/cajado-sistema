'use client'

import { PageHeader, MetricCard, EmptyState } from '@/components/shared/ui'
import React from 'react'

const motivoLabel: Record<string, string> = {
  servico_nao_oferecido: 'Serviço não oferecido',
  deixou_pra_depois:     'Deixou pra depois',
  preco:                 'Preço',
  concorrente:           'Concorrente',
  sem_resposta:          'Sem resposta',
  outro:                 'Outro',
}

const comissaoStatusColor: Record<string, string> = {
  pendente:  'badge-amber',
  aprovada:  'badge-blue',
  paga:      'badge-green',
  cancelada: 'badge-red',
}

export default function ComissoesClient() {
  return (
    <div>
      <PageHeader
        title="Parceiros e Comissões"
        subtitle="Comissões automáticas · Motivos de perda · Análise de conversão"
      >
        <button className="btn-secondary text-xs">+ Parceiro</button>
        <button className="btn-primary">Registrar pagamento</button>
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Comissões pendentes" value="R$ 450,00" />
        <MetricCard label="Pagas este mês" value="R$ 1.850,00" />
        <MetricCard label="Parceiros ativos" value="8" />
        <MetricCard label="Taxa de conversão" value="28%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* Comissões a pagar */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Comissões geradas</h2>
            <select className="input w-auto text-xs py-1 px-2">
              <option>Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="aprovada">Aprovada</option>
              <option value="paga">Paga</option>
            </select>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">Parceiro</th>
                <th className="table-header">OS / Venda</th>
                <th className="table-header">Valor venda</th>
                <th className="table-header">%</th>
                <th className="table-header">Comissão</th>
                <th className="table-header">Status</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {[
                { parceiro: 'Despachante Silva', os: 'OS-2026/0401', valor: 4500, pct: 10, comissao: 450, status: 'pendente' },
                { parceiro: 'Autoescola Líder', os: 'OS-2026/0402', valor: 1800, pct: 15, comissao: 270, status: 'aprovada' },
                { parceiro: 'João Corretor', os: 'OS-2026/0390', valor: 3500, pct: 10, comissao: 350, status: 'paga' },
              ].map((c, i) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                  <td className="py-3 text-sm text-zinc-200">{c.parceiro}</td>
                  <td className="py-3 text-xs text-zinc-500">{c.os}</td>
                  <td className="py-3 text-sm">R$ {c.valor.toFixed(2)}</td>
                  <td className="py-3 text-sm">{c.pct}%</td>
                  <td className="py-3 text-sm font-semibold text-emerald-400">R$ {c.comissao.toFixed(2)}</td>
                  <td className="py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-bold bg-opacity-15 border border-current ${
                    c.status === 'pendente' ? 'text-amber-400' :
                    c.status === 'aprovada' ? 'text-blue-400' : 'text-emerald-400'
                  }`}>{c.status}</span></td>
                  <td className="py-3 text-right"><button className="text-xs text-blue-400 hover:text-blue-300">Detalhes</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Ranking de parceiros */}
        <div className="card">
          <h2 className="section-title">Ranking de parceiros</h2>
          <div className="space-y-1 mt-4">
            {[
              { nome: 'Autoescola Líder', vendas: 12, valor: 18500 },
              { nome: 'Despachante Silva', vendas: 8, valor: 12400 },
              { nome: 'Pedro Moraes', vendas: 5, valor: 5800 },
            ].map((p,i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/20 rounded px-2 transition-colors">
                <div>
                  <span className="text-xs text-amber-500 font-bold w-5 inline-block">{i+1}º</span>
                  <span className="text-sm text-zinc-200">{p.nome}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-400">R$ {p.valor.toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-zinc-500">{p.vendas} vendas concluídas</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Análise de perdas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Leads perdidos por motivo</h2>
            <button className="btn-ghost text-xs">Ver leads perdidos</button>
          </div>
          <div className="space-y-3">
            {Object.entries(motivoLabel).map(([key, label]) => {
              const mockValues: Record<string, number> = {
                preco: 32, concorrente: 18, deixou_pra_depois: 15, sem_resposta: 25, servico_nao_oferecido: 5, outro: 5
              }
              const val = mockValues[key] || 0
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">{label}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${val}%` }} />
                    </div>
                    <span className="text-xs text-zinc-500 w-6 text-right">{val}%</span>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-zinc-600 mt-4">
            Preencha o motivo ao mover um lead para "perdido" no CRM para ver esta análise
          </p>
        </div>

        {/* Taxa de conversão por origem */}
        <div className="card">
          <h2 className="section-title">Conversão por origem</h2>
          <div className="space-y-3">
            {[
              { label: 'Indicação direta', total: 45, fechados: 25 },
              { label: 'Parceiro', total: 30, fechados: 18 },
              { label: 'Instagram', total: 60, fechados: 12 },
              { label: 'WhatsApp orgânico', total: 120, fechados: 40 },
              { label: 'Tráfego pago', total: 200, fechados: 35 },
            ].map(item => {
              const pct = item.total > 0 ? Math.round((item.fechados / item.total) * 100) : 0
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-400">{item.label}</span>
                    <span className="text-xs text-zinc-500">{item.fechados}/{item.total} · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
