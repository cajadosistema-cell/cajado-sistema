'use client'

import { PageHeader, MetricCard, EmptyState } from '@/components/shared/ui'
import React from 'react'

export default function PosVendaClient() {
  return (
    <div>
      <PageHeader
        title="Pós-venda"
        subtitle="Mensagens automáticas · Cards de divulgação · Follow-up"
      >
        <button className="btn-secondary text-xs">+ Template</button>
        <button className="btn-primary flex items-center gap-2 hover:scale-105 transition-transform shadow-[0_4px_14px_rgba(20,184,166,0.3)] bg-teal-500 text-zinc-950">Disparar manual</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Disparos pendentes" value="0" />
        <MetricCard label="Enviados este mês" value="0" />
        <MetricCard label="Templates ativos" value="3" />
        <MetricCard label="Cards gerados" value="0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Templates */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Templates configurados</h2>
            <button className="btn-ghost text-xs">+ Novo template</button>
          </div>
          <div className="space-y-3">
            {[
              { nome: 'Agradecimento imediato', gatilho: 'Ao concluir OS', ativo: true },
              { nome: 'Follow-up 7 dias', gatilho: '7 dias após conclusão', ativo: true },
              { nome: 'Pedido de indicação 15 dias', gatilho: '15 dias após conclusão', ativo: true },
            ].map(t => (
              <div key={t.nome} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-zinc-300">{t.nome}</p>
                  <p className="text-xs text-zinc-500">{t.gatilho}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border border-current ${t.ativo ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    {t.ativo ? 'Ativo' : 'Inativo'}
                  </span>
                  <button className="btn-ghost text-xs py-1">Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disparos pendentes */}
        <div className="card min-h-[250px]">
          <h2 className="section-title">Disparos pendentes</h2>
          <EmptyState message="Nenhum disparo pendente" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Cards de divulgação */}
        <div className="card min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Cards de divulgação</h2>
            <button className="btn-ghost text-xs">+ Card</button>
          </div>
          <p className="text-xs text-zinc-600 mb-8 max-w-sm">
            Cards são gerados automaticamente quando uma "Ordem de Serviço" é concluída e podem ser enviados ao cliente no WhatsApp para que ele compartilhe nos Stories.
          </p>
          <EmptyState message="Nenhum card gerado ainda" />
        </div>

        {/* Histórico de disparos */}
        <div className="card">
          <h2 className="section-title">Histórico de disparos</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">Cliente</th>
                <th className="table-header">Template</th>
                <th className="table-header">Enviado em</th>
                <th className="table-header">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={4} className="py-16 text-center">
                  <p className="text-sm text-zinc-500">Nenhum disparo realizado</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
