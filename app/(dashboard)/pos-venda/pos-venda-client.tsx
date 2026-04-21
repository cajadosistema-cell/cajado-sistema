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
        <button onClick={() => alert('Nova automação de template será liberada na próxima atualização!')} className="btn-secondary text-xs">+ Template</button>
        <button onClick={() => alert('Puxando fila de mensagens retidas... (Modo Demo)')} className="btn-primary flex items-center gap-2 hover:scale-105 transition-transform shadow-[0_4px_14px_rgba(20,184,166,0.3)] bg-teal-500 text-zinc-950">Disparar manual</button>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Disparos pendentes" value="12" />
        <MetricCard label="Enviados este mês" value="348" />
        <MetricCard label="Templates ativos" value="3" />
        <MetricCard label="Cards gerados" value="45" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">

        {/* Templates */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Templates configurados</h2>
            <button onClick={() => alert('Nova automação de template será liberada na próxima atualização!')} className="btn-ghost text-xs">+ Novo template</button>
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
                  <button onClick={() => alert(`Editando: ${t.nome}`)} className="btn-ghost text-xs py-1">Editar</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disparos pendentes */}
        <div className="card min-h-[250px]">
          <h2 className="section-title">Disparos pendentes</h2>
          <div className="space-y-3">
            {[
              { cliente: 'Carlos Eduardo', template: 'Agradecimento imediato', agendado: 'Hoje 14:30', status: 'na_fila' },
              { cliente: 'Ana Paula', template: 'Follow-up 7 dias', agendado: 'Amanhã 09:00', status: 'agendado' },
              { cliente: 'Marcos Antônio', template: 'Pedido de indicação', agendado: 'Hoje 16:00', status: 'na_fila' }
            ].map((d, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-zinc-800/30 rounded-lg border border-zinc-800/50">
                <div>
                  <p className="text-sm font-medium text-zinc-200">{d.cliente}</p>
                  <p className="text-xs text-amber-500/80 mt-0.5">{d.template}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 mb-1 inline-block">{d.status === 'na_fila' ? '⏳ Na fila' : '📅 Agendado'}</span>
                  <p className="text-xs text-zinc-500">{d.agendado}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Cards de divulgação */}
        <div className="card min-h-[300px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Cards de divulgação</h2>
            <button onClick={() => alert('O estúdio de criativos de cards chegará na PRÓXIMA versão!')} className="btn-ghost text-xs">+ Card</button>
          </div>
          <p className="text-xs text-zinc-600 mb-6 max-w-sm">
            Cards são gerados automaticamente quando uma "Ordem de Serviço" é concluída e podem ser enviados ao cliente no WhatsApp.
          </p>
          <div className="grid grid-cols-2 gap-3">
             {[
               { cliente: 'Juliana Rocha', servico: 'Placa Mercosul', data: 'Hoje' },
               { cliente: 'Mariana Alves', servico: 'Renovação CNH', data: 'Ontem' },
             ].map((c, i) => (
               <div key={i} className="bg-zinc-800 rounded-xl overflow-hidden border border-zinc-700">
                  <div className="h-24 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 flex items-center justify-center p-4">
                    <div className="text-center">
                      <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider mb-1">MUITO OBRIGADO!</p>
                      <p className="text-xs text-zinc-200 font-medium leading-tight">{c.servico} concluído com sucesso.</p>
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-900 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-zinc-300">{c.cliente}</p>
                      <p className="text-[10px] text-zinc-500">{c.data}</p>
                    </div>
                    <button onClick={() => alert(`Enviando card para ${c.cliente} via WhatsApp...`)} className="text-emerald-400 text-sm hover:scale-110 transition-transform">↗️</button>
                  </div>
               </div>
             ))}
          </div>
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
              {[
                { cliente: 'João Batista', tmpl: 'Agradecimento imediato', time: 'Há 2 horas', status: 'Entregue' },
                { cliente: 'Fernanda Oliveira', tmpl: 'Follow-up 7 dias', time: 'Ontem 15:20', status: 'Lida' },
                { cliente: 'Rafael Souza', tmpl: 'Pedido de indicação', time: '10/04/2026', status: 'Falhou' }
              ].map((h, i) => (
                <tr key={i} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/20 transition-colors">
                  <td className="py-3 px-2 text-sm text-zinc-200">{h.cliente}</td>
                  <td className="py-3 px-2 text-xs text-amber-500/80">{h.tmpl}</td>
                  <td className="py-3 px-2 text-xs text-zinc-500">{h.time}</td>
                  <td className="py-3 px-2 text-xs">
                    <span className={
                      h.status === 'Lida' ? 'text-blue-400' :
                      h.status === 'Entregue' ? 'text-zinc-400' : 'text-red-400'
                    }>{h.status === 'Lida' ? '✓✓ Lida' : h.status === 'Entregue' ? '✓✓ Entregue' : '❌ Falhou'}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
