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
        <button onClick={() => alert('Coletando indicadores do módulo Inteligência para gerar Snapshot... (Emulação)')} className="btn-secondary text-xs">Gerar snapshot</button>
        <button onClick={() => alert('O modal de nova Entrada de Diário está sendo ativado na V3.')} className="btn-primary">+ Nova entrada</button>
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Entradas totais" value="84" />
        <MetricCard label="Este mês" value="12" />
        <MetricCard label="Decisões registradas" value="15" />
        <MetricCard label="Snapshots gerados" value="4" />
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

          <div className="space-y-4">
            {[
              { id: 1, data: 'Hoje, 09:30', cat: 'decisao', titulo: 'Pausa na contratação do marketing', texto: 'Decidimos focar em melhorar a conversão interna antes de trazer mais leads pagos. O CAC estava subindo rápido demais.', cor: 'badge-purple' },
              { id: 2, data: 'Ontem, 18:00', cat: 'financeiro_pj', titulo: 'Fechamento da semana positivo', texto: 'Semana muito boa! Entraram R$ 4.500 no caixa. O mês está se desenhando excelente.', cor: 'badge-teal' },
              { id: 3, data: '10/Abr, 14:00', cat: 'aprendizado', titulo: 'Não podemos subestimar a qualificação', texto: 'Cliente reclamou de demora não por causa de nós, mas porque o atendente anterior não qualificou a venda. Precisamos de script.', cor: 'badge-blue' },
              { id: 4, data: '08/Abr, 20:00', cat: 'trading', titulo: 'Violinada dolorosa em PETR4', texto: 'Tinha um setup perfeito, mas deixei o stop muito colado e pegou antes de voar. Lição: respeitar o backtest.', cor: 'badge-red' },
            ].map(item => (
              <div key={item.id} className="p-4 border-l-2 border-zinc-700 bg-zinc-800/20 rounded-r-lg hover:border-amber-500 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-[10px] text-zinc-500 font-mono">{item.data}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border border-current opacity-80 ${categoriaLabel[item.cat]?.color || 'text-zinc-400'}`}>
                    {categoriaLabel[item.cat]?.label || 'Geral'}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-zinc-100 mb-1">{item.titulo}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.texto}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">

          {/* Entradas fixadas */}
          <div className="card">
            <h2 className="section-title">📌 Fixadas</h2>
            <div className="space-y-3">
              <div className="text-sm border-b border-zinc-800/50 pb-2">
                <p className="font-medium text-amber-400">Meta do Semestre</p>
                <p className="text-xs text-zinc-500 mt-1">Atingir 150 mil faturados no trimestre finalizando as pendências estruturais.</p>
              </div>
              <div className="text-sm">
                <p className="font-medium text-purple-400">Filosofia Atual</p>
                <p className="text-xs text-zinc-500 mt-1">"Acelerar através da organização. Uma base arrumada escala sem quebrar."</p>
              </div>
            </div>
          </div>

          {/* Resumo por categoria */}
          <div className="card">
            <h2 className="section-title">Por categoria</h2>
            <div className="space-y-2">
              {[
                { k: 'decisao', v: 15 },
                { k: 'aprendizado', v: 22 },
                { k: 'financeiro_pj', v: 18 },
                { k: 'trading', v: 41 },
              ].map((item) => (
                <div key={item.k} className="flex items-center justify-between text-sm py-1 border-b border-zinc-800/50 last:border-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border border-current ${categoriaLabel[item.k].color}`}>{categoriaLabel[item.k].label}</span>
                  <span className="text-zinc-500 text-xs font-mono">{item.v}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Último snapshot */}
          <div className="card">
            <h2 className="section-title">Último snapshot</h2>
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-lg">
              <p className="text-xs text-blue-400 font-bold mb-1">Março de 2026</p>
              <p className="text-[10px] text-zinc-400 mb-2">Resumo da situação PJ/PF gerado no fim do Q1.</p>
              <button onClick={() => alert('Abrindo painel do Snapshot de Contexto (Modo Offline)')} className="text-[10px] font-medium text-blue-300 hover:underline">Ver completo</button>
            </div>
            <button onClick={() => alert('IA extraindo logs financeiros e dados da semana para montar Snapshot...')} className="btn-secondary w-full mt-3 text-xs">
              Gerar snapshot do mês atual
            </button>
          </div>
        </div>

        {/* Snapshots históricos */}
        <div className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Snapshots de contexto</h2>
            <button onClick={() => alert('O construtor manual de Snapshot abrirá em pop-up na próxima update!')} className="btn-ghost text-xs">+ Snapshot manual</button>
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
              {[
                { per: 'Q1 / Mar 26', tipo: 'Mensal', spf: 'R$ 12.450', spj: 'R$ 8.900', fat: 'R$ 14.500', por: 'Sistema' },
                { per: 'Fev 26', tipo: 'Mensal', spf: 'R$ 10.100', spj: 'R$ 5.400', fat: 'R$ 9.200', por: 'Sistema' },
                { per: 'Jan 26', tipo: 'Mensal', spf: 'R$ 7.200', spj: 'R$ 3.100', fat: 'R$ 6.800', por: 'Maiara' },
              ].map((s, i) => (
                <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="py-3 px-2 text-xs font-bold text-zinc-200">{s.per}</td>
                  <td className="py-3 text-xs text-zinc-400">{s.tipo}</td>
                  <td className="py-3 text-xs text-emerald-400">{s.spf}</td>
                  <td className="py-3 text-xs text-blue-400">{s.spj}</td>
                  <td className="py-3 text-xs font-medium">{s.fat}</td>
                  <td className="py-3 text-xs text-zinc-500">{s.por}</td>
                  <td className="py-3 text-right">
                    <button onClick={() => alert(`Visualizando Snapshot: ${s.per}`)} className="text-xs text-blue-400 hover:underline">Ver</button>
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
