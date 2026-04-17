'use client'

import { useState } from 'react'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { PageHeader } from '@/components/shared/ui'
import type { Colaborador, RegistroPonto, Tarefa, Ocorrencia } from './_components/types'

import { TabPonto }      from './_components/tabs/TabPonto'
import { TabTarefas }   from './_components/tabs/TabTarefas'
import { TabOcorrencias } from './_components/tabs/TabOcorrencias'
import { TabEquipe }    from './_components/tabs/TabEquipe'
import { ModalNovaTarefa }    from './_components/modals/ModalNovaTarefa'
import { ModalNovaOcorrencia } from './_components/modals/ModalNovaOcorrencia'

type TabId = 'ponto' | 'tarefas' | 'ocorrencias' | 'equipe'

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: 'ponto',       label: 'Ponto',       emoji: '🕐' },
  { id: 'tarefas',    label: 'Tarefas',     emoji: '📋' },
  { id: 'ocorrencias', label: 'Ocorrências', emoji: '📝' },
  { id: 'equipe',     label: 'Equipe',      emoji: '👥' },
]

export default function GestaoPessoalClient() {
  const [tab, setTab] = useState<TabId>('ponto')
  const [modalTarefa, setModalTarefa] = useState(false)
  const [modalOcorrencia, setModalOcorrencia] = useState(false)

  // Queries — sem filtros para ver todos os dados da equipe
  const { data: perfis, refetch: refetchPerfis } = useSupabaseQuery<Colaborador>('perfis', {
    orderBy: { column: 'nome', ascending: true },
  })

  const { data: registrosPonto, refetch: refetchPonto } = useSupabaseQuery<RegistroPonto>('registros_ponto', {
    orderBy: { column: 'timestamp', ascending: false },
    limit: 100,
  })

  const { data: tarefas, refetch: refetchTarefas } = useSupabaseQuery<Tarefa>('tarefas', {
    orderBy: { column: 'created_at', ascending: false },
  })

  const { data: ocorrencias, refetch: refetchOcorrencias } = useSupabaseQuery<Ocorrencia>('ocorrencias', {
    orderBy: { column: 'created_at', ascending: false },
  })

  // Nota: colaboradores é alias para perfis (tabela perfis já contém todos os dados principais)
  // Os dados extras de RH ficam em public.colaboradores (join não implementado aqui por simplicidade)
  const colaboradores = perfis as unknown as Colaborador[]

  // ID do usuário atual — pegamos do primeiro perfil (simplificado; em prod usar auth.getUser())
  const userId = colaboradores[0]?.id ?? null

  // KPIs do cabeçalho
  const tarefasAbertas = tarefas.filter(t => t.status === 'a_fazer' || t.status === 'em_andamento').length
  const errosPendentes = ocorrencias.filter(o => o.tipo === 'erro' && !o.resolvida).length

  return (
    <>
      <PageHeader
        title="Equipe"
        subtitle="Ponto · Tarefas · Ocorrências · Desempenho"
      >
        {tab === 'tarefas' && (
          <button onClick={() => setModalTarefa(true)} className="btn-primary">+ Tarefa</button>
        )}
        {tab === 'ocorrencias' && (
          <button onClick={() => setModalOcorrencia(true)} className="btn-primary">+ Ocorrência</button>
        )}
      </PageHeader>

      {/* KPIs resumo */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Colaboradores',    value: colaboradores.filter(c => c.ativo).length, color: 'text-zinc-200' },
          { label: 'Tarefas abertas', value: tarefasAbertas, color: tarefasAbertas > 10 ? 'text-amber-400' : 'text-zinc-200' },
          { label: 'Erros pendentes', value: errosPendentes, color: errosPendentes > 0 ? 'text-red-400' : 'text-emerald-400' },
          { label: 'Acertos do mês',  value: ocorrencias.filter(o => o.tipo === 'acerto').length, color: 'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="bg-[#111827] border border-white/5 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(245,166,35,0.08),transparent_70%)]" />
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

      {/* Conteúdo da tab ativa */}
      {tab === 'ponto' && (
        <TabPonto
          registros={registrosPonto}
          userId={userId}
          onPonto={refetchPonto}
        />
      )}
      {tab === 'tarefas' && (
        <TabTarefas
          tarefas={tarefas}
          colaboradores={colaboradores}
          onUpdate={refetchTarefas}
          onNova={() => setModalTarefa(true)}
        />
      )}
      {tab === 'ocorrencias' && (
        <TabOcorrencias
          ocorrencias={ocorrencias}
          colaboradores={colaboradores}
          onUpdate={refetchOcorrencias}
          onNova={() => setModalOcorrencia(true)}
        />
      )}
      {tab === 'equipe' && (
        <TabEquipe
          colaboradores={colaboradores}
          tarefas={tarefas}
          ocorrencias={ocorrencias}
        />
      )}

      {/* Modais */}
      {modalTarefa && (
        <ModalNovaTarefa
          colaboradores={colaboradores}
          onSave={refetchTarefas}
          onClose={() => setModalTarefa(false)}
        />
      )}
      {modalOcorrencia && (
        <ModalNovaOcorrencia
          colaboradores={colaboradores}
          onSave={refetchOcorrencias}
          onClose={() => setModalOcorrencia(false)}
        />
      )}
    </>
  )
}
