'use client'

import { createClient } from '@/lib/supabase/client'
import type { RegistroPonto } from '../types'
import { TIPO_PONTO_LABEL } from '../types'

type Props = {
  registros: RegistroPonto[]
  userId: string | null
  onPonto: () => void
}

function formatHora(ts: string) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatData(ts: string) {
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}

function calcHorasTrabalhadas(registros: RegistroPonto[]): string {
  const hoje = new Date().toISOString().split('T')[0]
  const diaAtual = registros.filter(r => r.timestamp.startsWith(hoje))

  let totalMs = 0
  let entradaTs: string | null = null

  for (const r of diaAtual.sort((a, b) => a.timestamp.localeCompare(b.timestamp))) {
    if (r.tipo === 'entrada') entradaTs = r.timestamp
    if (r.tipo === 'saida' && entradaTs) {
      totalMs += new Date(r.timestamp).getTime() - new Date(entradaTs).getTime()
      entradaTs = null
    }
  }

  // Se ainda em serviço (entrada sem saída correspondente)
  if (entradaTs) {
    totalMs += Date.now() - new Date(entradaTs).getTime()
  }

  const horas = Math.floor(totalMs / 3600000)
  const minutos = Math.floor((totalMs % 3600000) / 60000)
  return `${horas}h${minutos.toString().padStart(2, '0')}min`
}

export function TabPonto({ registros, userId, onPonto }: Props) {
  const supabase = createClient()
  const hoje = new Date().toISOString().split('T')[0]
  const registrosHoje = registros.filter(r => r.timestamp.startsWith(hoje))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  const ultimoRegistro = registrosHoje[registrosHoje.length - 1]
  const emServico = ultimoRegistro?.tipo === 'entrada' || ultimoRegistro?.tipo === 'pausa_fim'
  const emPausa = ultimoRegistro?.tipo === 'pausa_inicio'

  const baterPonto = async (tipo: RegistroPonto['tipo']) => {
    if (!userId) return
    await (supabase.from('registros_ponto') as any).insert({
      user_id: userId,
      tipo,
      timestamp: new Date().toISOString(),
    })
    onPonto()
  }

  const BOTOES = emServico
    ? [
        { tipo: 'pausa_inicio' as const, label: '⏸ Iniciar Pausa', style: 'btn-secondary' },
        { tipo: 'saida' as const, label: '🔴 Bater Saída', style: 'bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl px-4 py-2 text-sm font-medium hover:bg-red-500/30 transition-colors' },
      ]
    : emPausa
    ? [{ tipo: 'pausa_fim' as const, label: '▶️ Voltar da Pausa', style: 'btn-primary' }]
    : [{ tipo: 'entrada' as const, label: '🟢 Bater Entrada', style: 'btn-primary' }]

  return (
    <div className="space-y-6">
      {/* Status atual */}
      <div className="bg-page border border-border-subtle rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs text-fg-tertiary uppercase tracking-wider mb-1">Status Hoje</p>
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${emServico ? 'bg-emerald-400 animate-pulse' : emPausa ? 'bg-amber-400' : 'bg-zinc-600'}`} />
              <p className="text-lg font-bold text-fg">
                {emServico ? 'Em serviço' : emPausa ? 'Em pausa' : 'Fora do expediente'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-fg-tertiary">Horas trabalhadas</p>
            <p className="text-2xl font-bold text-amber-400 font-mono">{calcHorasTrabalhadas(registros)}</p>
          </div>
        </div>

        {/* Botões de ponto */}
        <div className="flex gap-3 flex-wrap">
          {BOTOES.map(b => (
            <button key={b.tipo} onClick={() => baterPonto(b.tipo)} className={b.style}>
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline do dia */}
      <div className="bg-page border border-border-subtle rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-fg-secondary mb-4">Timeline de Hoje</h3>
        {registrosHoje.length === 0 ? (
          <p className="text-sm text-fg-disabled text-center py-8">Nenhum registro hoje. Bata o ponto para começar.</p>
        ) : (
          <div className="relative pl-5">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-muted" />
            <div className="space-y-3">
              {registrosHoje.map((r, i) => (
                <div key={r.id} className="relative flex items-start gap-3">
                  <div className={`absolute -left-[13px] top-1 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${
                    r.tipo === 'entrada' || r.tipo === 'pausa_fim' ? 'bg-emerald-400'
                    : r.tipo === 'saida' ? 'bg-red-400'
                    : 'bg-amber-400'
                  }`} />
                  <div>
                    <p className="text-sm font-medium text-fg">{TIPO_PONTO_LABEL[r.tipo]}</p>
                    <p className="text-xs text-fg-tertiary">{formatHora(r.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Histórico recente */}
      {registros.filter(r => !r.timestamp.startsWith(hoje)).length > 0 && (
        <div className="bg-page border border-border-subtle rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-fg-secondary mb-4">Histórico Recente</h3>
          <div className="space-y-2">
            {registros
              .filter(r => !r.timestamp.startsWith(hoje))
              .slice(0, 10)
              .map(r => (
                <div key={r.id} className="flex items-center justify-between py-2 border-b border-border-subtle/50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      r.tipo === 'entrada' || r.tipo === 'pausa_fim' ? 'bg-emerald-400'
                      : r.tipo === 'saida' ? 'bg-red-400' : 'bg-amber-400'
                    }`} />
                    <span className="text-sm text-fg-secondary">{TIPO_PONTO_LABEL[r.tipo]}</span>
                  </div>
                  <span className="text-xs text-fg-tertiary">{formatData(r.timestamp)} — {formatHora(r.timestamp)}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
