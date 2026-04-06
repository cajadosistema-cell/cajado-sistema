'use client'

import { PageHeader, MetricCard, EmptyState } from '@/components/shared/ui'
import React from 'react'

const categoriaLabel: Record<string, { label: string; color: string }> = {
  geral:          { label: 'Geral',            color: 'badge-zinc' },
  decisao:        { label: 'Decisão',          color: 'badge-purple' },
  aprendizado:    { label: 'Aprendizado',      color: 'badge-blue' },
  patrimonio:     { label: 'Patrimônio',       color: 'badge-amber' },
  financeiro_pf:  { label: 'Financeiro PF',    color: 'badge-green' },
  financeiro_pj:  { label: 'Financeiro PJ',    color: 'badge-teal' },
  trading:        { label: 'Trading',          color: 'badge-red' },
  mercado:        { label: 'Mercado',          color: 'badge-blue' },
  projeto:        { label: 'Projeto',          color: 'badge-amber' },
  ideia:          { label: 'Ideia',            color: 'badge-purple' },
  reserva:        { label: 'Reserva',          color: 'badge-green' },
  meta:           { label: 'Meta',             color: 'badge-amber' },
}

const humorLabel: Record<string, { label: string; color: string }> = {
  otimo:   { label: 'Ótimo',   color: 'text-emerald-400' },
  bom:     { label: 'Bom',     color: 'text-green-400' },
  neutro:  { label: 'Neutro',  color: 'text-zinc-400' },
  ruim:    { label: 'Ruim',    color: 'text-amber-400' },
  critico: { label: 'Crítico', color: 'text-red-400' },
}

export default function DiarioEstrategicoClient() {
  return (
    <div>
      <PageHeader
        title="Diário Estratégico"
        subtitle="Memória acumulada · Decisões · Snapshots · Linha do tempo"
      >
        <button className="btn-secondary text-xs">Gerar snapshot</button>
        <button className="btn-primary">+ Nova entrada</button>
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Entradas totais" value="0" />
        <MetricCard label="Este mês" value="0" />
        <MetricCard label="Decisões registradas" value="0" />
        <MetricCard label="Snapshots gerados" value="0" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Linha do tempo principal */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Linha do tempo</h2>
            <div className="flex items-center gap-2">
              <select className="input w-auto text-xs py-1 px-2">
                <option value="">Todas as categorias</option>
                {Object.entries(categoriaLabel).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              <select className="input w-auto text-xs py-1 px-2">
                <option value="">Tudo</option>
                <option value="diario">Diário</option>
                <option value="decisao">Decisões</option>
                <option value="snapshot">Snapshots</option>
                <option value="venda">Marcos financeiros</option>
              </select>
            </div>
          </div>

          {/* Estado vazio com exemplo visual */}
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center mb-3">
              <span className="text-zinc-500 text-lg">📓</span>
            </div>
            <p className="text-sm text-zinc-400 mb-1">Nenhuma entrada registrada ainda</p>
            <p className="text-xs text-zinc-600 max-w-sm">
              O diário é a memória do negócio. Registre decisões, aprendizados,
              contexto financeiro e metas — tudo fica aqui cronologicamente.
            </p>
            <button className="btn-primary mt-4 text-xs hover:scale-105 transition-transform shadow-[0_4px_14px_rgba(245,166,35,0.3)]">
              + Criar primeira entrada
            </button>
          </div>
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">

          {/* Entradas fixadas */}
          <div className="card">
            <h2 className="section-title">📌 Fixadas</h2>
            <EmptyState message="Nenhuma entrada fixada" />
          </div>

          {/* Resumo por categoria */}
          <div className="card">
            <h2 className="section-title">Por categoria</h2>
            <div className="space-y-2">
              {Object.entries(categoriaLabel).slice(0, 7).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between text-sm py-1 border-b border-zinc-800/50 last:border-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border border-current ${val.color}`}>{val.label}</span>
                  <span className="text-zinc-500 text-xs font-mono">0</span>
                </div>
              ))}
            </div>
          </div>

          {/* Último snapshot */}
          <div className="card">
            <h2 className="section-title">Último snapshot</h2>
            <EmptyState message="Nenhum snapshot gerado" />
            <button className="btn-secondary w-full mt-3 text-xs">
              Gerar snapshot do mês atual
            </button>
          </div>
        </div>

        {/* Snapshots históricos */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Snapshots de contexto</h2>
            <button className="btn-ghost text-xs">+ Snapshot manual</button>
          </div>
          <p className="text-xs text-zinc-600 mb-4 max-w-2xl">
            Snapshots consolidam o estado do negócio num ponto no tempo —
            saldo PF/PJ, faturamento, decisões, aprendizados e metas do período.
            São a resposta imediata e centralizada para o problema de "recapitule o contexto".
          </p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">Período</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Saldo PF</th>
                <th className="table-header">Saldo PJ</th>
                <th className="table-header">Faturamento</th>
                <th className="table-header">Gerado por</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={7} className="py-10 text-center">
                  <p className="text-sm text-zinc-500">Nenhum snapshot ainda</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}
