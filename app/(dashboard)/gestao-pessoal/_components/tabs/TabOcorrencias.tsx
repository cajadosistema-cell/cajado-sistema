'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Ocorrencia, Colaborador } from '../types'
import { TIPO_OCORRENCIA_COLOR, TIPO_OCORRENCIA_ICON } from '../types'

type Props = {
  ocorrencias: Ocorrencia[]
  colaboradores: Colaborador[]
  onUpdate: () => void
  onNova: () => void
}

function formatData(ts: string) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function nomeColaborador(id: string | null, colaboradores: Colaborador[]): string {
  if (!id) return 'Geral'
  return colaboradores.find(c => c.id === id)?.nome ?? '—'
}

export function TabOcorrencias({ ocorrencias, colaboradores, onUpdate, onNova }: Props) {
  const supabase = createClient()
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [filtroColaborador, setFiltroColaborador] = useState<string>('todos')

  const resolver = async (id: string) => {
    await (supabase.from('ocorrencias') as any).update({ resolvida: true }).eq('id', id)
    onUpdate()
  }

  const filtradas = ocorrencias.filter(o => {
    if (filtroTipo !== 'todos' && o.tipo !== filtroTipo) return false
    if (filtroColaborador !== 'todos' && o.colaborador_id !== filtroColaborador) return false
    return true
  })

  // KPIs
  const totalErros = ocorrencias.filter(o => o.tipo === 'erro').length
  const totalAcertos = ocorrencias.filter(o => o.tipo === 'acerto').length
  const taxaAcerto = ocorrencias.length > 0
    ? Math.round((totalAcertos / ocorrencias.length) * 100)
    : 0

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Erros',   value: totalErros,   color: 'text-red-400' },
          { label: 'Acertos', value: totalAcertos, color: 'text-emerald-400' },
          { label: 'Alertas', value: ocorrencias.filter(o => o.tipo === 'alerta').length, color: 'text-amber-400' },
          { label: 'Taxa acerto', value: `${taxaAcerto}%`, color: taxaAcerto >= 70 ? 'text-emerald-400' : 'text-amber-400' },
        ].map(k => (
          <div key={k.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <p className="text-xs text-zinc-500 mb-1">{k.label}</p>
            <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Filtros + Botão */}
      <div className="flex flex-wrap items-center gap-2">
        <select className="input text-xs w-auto" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
          <option value="todos">Todos os tipos</option>
          <option value="erro">❌ Erros</option>
          <option value="acerto">✅ Acertos</option>
          <option value="alerta">⚠️ Alertas</option>
          <option value="elogio">⭐ Elogios</option>
        </select>
        <select className="input text-xs w-auto" value={filtroColaborador} onChange={e => setFiltroColaborador(e.target.value)}>
          <option value="todos">Todos os colaboradores</option>
          {colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <button onClick={onNova} className="btn-primary text-xs ml-auto">+ Registrar</button>
      </div>

      {/* Lista */}
      <div className="space-y-3">
        {filtradas.length === 0 ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-10 text-center">
            <p className="text-zinc-600 text-sm">Nenhuma ocorrência encontrada.</p>
          </div>
        ) : (
          filtradas.map(o => (
            <div key={o.id} className={`bg-zinc-900 border rounded-xl p-4 ${TIPO_OCORRENCIA_COLOR[o.tipo]} ${o.resolvida ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl mt-0.5">{TIPO_OCORRENCIA_ICON[o.tipo]}</span>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{o.descricao}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-zinc-500">{nomeColaborador(o.colaborador_id, colaboradores)}</span>
                      {o.modulo && <span className="text-xs text-zinc-600 capitalize">{o.modulo}</span>}
                      {o.impacto && (
                        <span className={`text-[10px] font-semibold uppercase ${
                          o.impacto === 'alto' ? 'text-red-400' : o.impacto === 'medio' ? 'text-amber-400' : 'text-zinc-400'
                        }`}>
                          ● {o.impacto}
                        </span>
                      )}
                      <span className="text-xs text-zinc-600">{formatData(o.created_at)}</span>
                    </div>
                  </div>
                </div>
                {!o.resolvida && o.tipo === 'erro' && (
                  <button
                    onClick={() => resolver(o.id)}
                    className="text-xs text-zinc-400 hover:text-emerald-400 border border-zinc-700 hover:border-emerald-500/40 px-2 py-1 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Resolver ✓
                  </button>
                )}
                {o.resolvida && <span className="text-xs text-emerald-400 whitespace-nowrap shrink-0">Resolvido ✓</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
