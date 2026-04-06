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
        <MetricCard label="Comissões pendentes" value="R$ 0,00" />
        <MetricCard label="Pagas este mês" value="R$ 0,00" />
        <MetricCard label="Parceiros ativos" value="0" />
        <MetricCard label="Taxa de conversão" value="0%" />
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
              <tr>
                <td colSpan={7} className="py-12 text-center">
                  <p className="text-sm text-zinc-500">Nenhuma comissão gerada ainda</p>
                  <p className="text-xs text-zinc-600 mt-1">Comissões são geradas automaticamente ao concluir uma OS vinculada a parceiro</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Ranking de parceiros */}
        <div className="card">
          <h2 className="section-title">Ranking de parceiros</h2>
          <EmptyState message="Nenhuma venda via parceiro ainda" />
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
            {Object.entries(motivoLabel).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">{label}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-zinc-600 rounded-full" style={{ width: '0%' }} />
                  </div>
                  <span className="text-xs text-zinc-500 w-6 text-right">0</span>
                </div>
              </div>
            ))}
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
              { label: 'Indicação direta', total: 0, fechados: 0 },
              { label: 'Parceiro', total: 0, fechados: 0 },
              { label: 'Instagram', total: 0, fechados: 0 },
              { label: 'WhatsApp orgânico', total: 0, fechados: 0 },
              { label: 'Tráfego pago', total: 0, fechados: 0 },
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
