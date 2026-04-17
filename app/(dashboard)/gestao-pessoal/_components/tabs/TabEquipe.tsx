'use client'

import type { Colaborador, Tarefa, Ocorrencia } from '../types'

type Props = {
  colaboradores: Colaborador[]
  tarefas: Tarefa[]
  ocorrencias: Ocorrencia[]
}

function initials(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function CardColaborador({ colab, tarefas, ocorrencias }: {
  colab: Colaborador
  tarefas: Tarefa[]
  ocorrencias: Ocorrencia[]
}) {
  const minhasTarefas = tarefas.filter(t => t.responsavel_id === colab.id)
  const tarefasConcluidas = minhasTarefas.filter(t => t.status === 'concluida').length
  const tarefasAtivas = minhasTarefas.filter(t => t.status === 'em_andamento').length
  const meuErros = ocorrencias.filter(o => o.colaborador_id === colab.id && o.tipo === 'erro').length
  const meusAcertos = ocorrencias.filter(o => o.colaborador_id === colab.id && o.tipo === 'acerto').length

  const taxaAcerto = (meuErros + meusAcertos) > 0
    ? Math.round((meusAcertos / (meuErros + meusAcertos)) * 100)
    : 100

  // Score de performance simples (0-100)
  const meta = colab.meta_tarefas_mes ?? 20
  const tarefaScore = Math.min((tarefasConcluidas / meta) * 60, 60)
  const acertoScore = (taxaAcerto / 100) * 40
  const score = Math.round(tarefaScore + acertoScore)

  const scoreColor = score >= 80 ? 'text-emerald-400 bg-emerald-500/10'
    : score >= 60 ? 'text-amber-400 bg-amber-500/10'
    : 'text-red-400 bg-red-500/10'

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 hover:border-zinc-700 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {colab.foto_url ? (
            <img src={colab.foto_url} alt={colab.nome} className="w-10 h-10 rounded-full object-cover" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-600/30 border border-amber-500/20 flex items-center justify-center text-sm font-bold text-amber-400">
              {initials(colab.nome)}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-zinc-200">{colab.nome}</p>
            <p className="text-xs text-zinc-500">{colab.cargo ?? colab.setor ?? 'Colaborador'}</p>
          </div>
        </div>
        <div className={`text-xs font-bold px-2.5 py-1 rounded-lg ${scoreColor}`}>
          {score}pts
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {[
          { label: 'Tarefas feitas',   value: tarefasConcluidas, sub: `meta: ${meta}` },
          { label: 'Em andamento',     value: tarefasAtivas,     sub: 'ativas agora' },
          { label: 'Acertos',          value: meusAcertos,       sub: 'registrados' },
          { label: 'Erros',            value: meuErros,          sub: 'registrados' },
        ].map(k => (
          <div key={k.label} className="bg-zinc-800/50 rounded-lg p-2.5">
            <p className="text-[10px] text-zinc-500">{k.label}</p>
            <p className="text-base font-bold text-zinc-200">{k.value}</p>
            <p className="text-[10px] text-zinc-600">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Barra de taxa acerto */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-zinc-500">Taxa de acerto</span>
          <span className={taxaAcerto >= 80 ? 'text-emerald-400' : taxaAcerto >= 60 ? 'text-amber-400' : 'text-red-400'}>
            {taxaAcerto}%
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              taxaAcerto >= 80 ? 'bg-emerald-500' : taxaAcerto >= 60 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            style={{ width: `${taxaAcerto}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function TabEquipe({ colaboradores, tarefas, ocorrencias }: Props) {
  if (colaboradores.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-16 text-center">
        <p className="text-3xl mb-3">👥</p>
        <p className="text-sm text-zinc-500">Nenhum colaborador cadastrado ainda.</p>
        <p className="text-xs text-zinc-600 mt-1">Os colaboradores são criados automaticamente quando um usuário faz login pela primeira vez.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Ranking rápido */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-zinc-300 mb-3">📊 Visão Consolidada da Equipe</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total colaboradores', value: colaboradores.filter(c => c.ativo).length },
            { label: 'Tarefas concluídas', value: tarefas.filter(t => t.status === 'concluida').length },
            { label: 'Em andamento', value: tarefas.filter(t => t.status === 'em_andamento').length },
            { label: 'Ocorrências abertas', value: ocorrencias.filter(o => !o.resolvida && o.tipo === 'erro').length },
          ].map(k => (
            <div key={k.label} className="bg-zinc-800/50 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">{k.label}</p>
              <p className="text-2xl font-bold text-zinc-200 mt-1">{k.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cards individuais */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {colaboradores
          .filter(c => c.ativo)
          .map(c => (
            <CardColaborador
              key={c.id}
              colab={c}
              tarefas={tarefas}
              ocorrencias={ocorrencias}
            />
          ))}
      </div>
    </div>
  )
}
