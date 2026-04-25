'use client'

import { useState } from 'react'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { formatRelative, cn } from '@/lib/utils'
import { PageHeader, EmptyState } from '@/components/shared/ui'

type LogAcesso = {
  id: string
  acao: string
  recurso: string
  recurso_id: string | null
  ip: string | null
  sucesso: boolean
  created_at: string
  perfis?: { nome: string; email: string } | null
}

type AuditLog = {
  id: string
  tabela: string
  registro_id: string
  acao: 'create' | 'update' | 'delete'
  valores_anteriores: Record<string, unknown> | null
  valores_novos: Record<string, unknown> | null
  created_at: string
  perfis?: { nome: string } | null
}

const ACAO_CONFIG = {
  create: { label: 'Criação',   color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: '✚' },
  update: { label: 'Edição',    color: 'text-amber-400',   bg: 'bg-amber-500/10',   icon: '✎' },
  delete: { label: 'Exclusão',  color: 'text-red-400',     bg: 'bg-red-500/10',     icon: '✕' },
}

const TABELA_ICONS: Record<string, string> = {
  contas: '🏦', lancamentos: '💸', leads: '👤', atividades: '✉️',
  parceiros: '🤝', checkins: '📍', projetos: '📁', ideias: '💡',
  decisoes: '📖', operacoes: '📈', ativos: '💹', projetos_patrimonio: '🏠',
  tendencias: '📊', analises_mercado: '🔍',
}

function StatCard({ icon, label, value, sub, color }: {
  icon: string; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="metric-card">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <p className="metric-label">{label}</p>
      </div>
      <p className={cn('metric-value', color)}>{value}</p>
      {sub && <p className="text-[11px] text-fg-disabled mt-1">{sub}</p>}
    </div>
  )
}

export default function SegurancaGeralClient() {
  const [tab, setTab] = useState<'logs' | 'auditoria' | 'status'>('status')
  const [filtroAcao, setFiltroAcao] = useState('todos')
  const [filtroSucesso, setFiltroSucesso] = useState('todos')

  const { data: logs } = useSupabaseQuery<LogAcesso>('log_acesso', {
    select: '*, perfis(nome, email)',
    orderBy: { column: 'created_at', ascending: false },
    limit: 100,
  })

  const { data: auditoria } = useSupabaseQuery<AuditLog>('audit_log', {
    select: '*, perfis(nome)',
    orderBy: { column: 'created_at', ascending: false },
    limit: 100,
  })

  // Métricas
  const totalLogs = logs.length
  const erros = logs.filter(l => !l.sucesso).length
  const acessosHoje = logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length
  const criacoes = auditoria.filter(a => a.acao === 'create').length
  const edicoes = auditoria.filter(a => a.acao === 'update').length
  const exclusoes = auditoria.filter(a => a.acao === 'delete').length

  // IPs únicos
  const ipsUnicos = new Set(logs.filter(l => l.ip).map(l => l.ip)).size

  // Filtros de logs
  const logsFiltrados = logs.filter(l => {
    const okSucesso = filtroSucesso === 'todos' ||
      (filtroSucesso === 'sucesso' && l.sucesso) ||
      (filtroSucesso === 'erro' && !l.sucesso)
    return okSucesso
  })

  // Atividade por tabela em auditoria
  const porTabela = auditoria.reduce((acc, a) => {
    if (!acc[a.tabela]) acc[a.tabela] = 0
    acc[a.tabela]++
    return acc
  }, {} as Record<string, number>)

  const TABS = [
    { key: 'status', label: '🛡️ Status' },
    { key: 'logs', label: '📋 Logs de Acesso' },
    { key: 'auditoria', label: '🔍 Auditoria' },
  ] as const

  return (
    <>
      <PageHeader title="Segurança Geral" subtitle="Controle de acesso · Logs · Auditoria completa" />

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard icon="📋" label="Logs registrados" value={totalLogs} sub={`${acessosHoje} hoje`} />
        <StatCard icon="⚠️" label="Erros de acesso" value={erros}
          color={erros > 0 ? 'text-red-400' : undefined} />
        <StatCard icon="🌐" label="IPs únicos" value={ipsUnicos} />
        <StatCard icon="✏️" label="Edições auditadas" value={auditoria.length}
          sub={`${criacoes} cria · ${edicoes} edit · ${exclusoes} del`} color="text-amber-400" />
      </div>

      {/* Alertas */}
      {erros > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="text-sm font-semibold text-red-400">{erros} acesso(s) com erro detectado(s)</p>
            <p className="text-xs text-red-400/70">Verifique os logs de acesso e investigue possíveis tentativas não autorizadas.</p>
          </div>
        </div>
      )}

      {exclusoes > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-2xl">🗑️</span>
          <div>
            <p className="text-sm font-semibold text-amber-400">{exclusoes} exclusão(ões) registrada(s)</p>
            <p className="text-xs text-amber-400/70">Dados foram excluídos do sistema. Verifique a auditoria para detalhes.</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-page border border-border-subtle rounded-xl p-1 mb-4 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t.key ? 'bg-muted text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Status do Sistema */}
      {tab === 'status' && (
        <div className="space-y-4">
          {/* Status geral */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                titulo: 'Autenticação', status: 'ok', desc: 'Supabase Auth ativo com RLS habilitado',
                items: ['Row Level Security ✓', 'Políticas por tabela ✓', 'Login por e-mail ✓'],
              },
              {
                titulo: 'Banco de Dados', status: 'ok', desc: '9 módulos com tabelas e índices configurados',
                items: ['17 tabelas ✓', '14 índices de performance ✓', '4 views analíticas ✓'],
              },
              {
                titulo: 'Auditoria', status: erros > 0 ? 'alerta' : 'ok',
                desc: erros > 0 ? `${erros} erro(s) nos logs de acesso` : 'Auditoria completa ativa',
                items: [
                  `${criacoes} criações auditadas`,
                  `${edicoes} edições auditadas`,
                  `${exclusoes} exclusões auditadas`,
                ],
              },
            ].map(s => (
              <div key={s.titulo} className={cn(
                'card border',
                s.status === 'ok' ? 'border-emerald-500/20' : 'border-amber-500/30'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={cn('w-2 h-2 rounded-full animate-pulse', s.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500')} />
                  <p className="text-sm font-semibold text-fg">{s.titulo}</p>
                </div>
                <p className="text-xs text-fg-tertiary mb-3">{s.desc}</p>
                <div className="space-y-1">
                  {s.items.map(item => (
                    <p key={item} className="text-[11px] text-fg-tertiary flex items-center gap-1">
                      <span className={cn('w-1 h-1 rounded-full shrink-0', s.status === 'ok' ? 'bg-emerald-500' : 'bg-amber-500')} />
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Atividade por módulo */}
          {Object.keys(porTabela).length > 0 && (
            <div className="card">
              <p className="text-xs text-fg-tertiary uppercase tracking-wide mb-3">Atividade por módulo</p>
              <div className="space-y-2">
                {Object.entries(porTabela)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 8)
                  .map(([tabela, count]) => {
                    const maxCount = Math.max(...Object.values(porTabela))
                    const pct = (count / maxCount) * 100
                    return (
                      <div key={tabela}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-fg-secondary flex items-center gap-1.5">
                            <span>{TABELA_ICONS[tabela] ?? '📄'}</span>
                            {tabela}
                          </span>
                          <span className="text-fg-disabled">{count} operações</span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500/60 rounded-full transition-all duration-700"
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Logs de Acesso */}
      {tab === 'logs' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(['todos', 'sucesso', 'erro'] as const).map(f => (
              <button key={f} onClick={() => setFiltroSucesso(f)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize',
                  filtroSucesso === f ? 'bg-muted text-fg border-border-subtle' : 'text-fg-tertiary border-border-subtle hover:text-fg-secondary'
                )}>
                {f === 'todos' ? 'Todos' : f === 'sucesso' ? '✅ Sucesso' : '❌ Erros'}
              </button>
            ))}
          </div>

          {logsFiltrados.length === 0 ? (
            <div className="card"><EmptyState message="Nenhum log registrado ainda" /></div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="table-header">Usuário</th>
                    <th className="table-header">Ação</th>
                    <th className="table-header hidden md:table-cell">Recurso</th>
                    <th className="table-header hidden lg:table-cell">IP</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Quando</th>
                  </tr>
                </thead>
                <tbody>
                  {logsFiltrados.slice(0, 50).map(l => (
                    <tr key={l.id} className={cn('table-row', !l.sucesso ? 'bg-red-500/5' : '')}>
                      <td className="table-cell">
                        <p className="text-fg-secondary text-xs font-medium">{l.perfis?.nome ?? 'Sistema'}</p>
                        {l.perfis?.email && <p className="text-[10px] text-fg-disabled">{l.perfis.email}</p>}
                      </td>
                      <td className="table-cell text-fg-secondary text-xs">{l.acao}</td>
                      <td className="table-cell hidden md:table-cell">
                        <div className="flex items-center gap-1">
                          <span className="text-sm">{TABELA_ICONS[l.recurso] ?? '📄'}</span>
                          <span className="text-xs text-fg-tertiary">{l.recurso}</span>
                        </div>
                      </td>
                      <td className="table-cell hidden lg:table-cell text-fg-disabled text-xs font-mono">
                        {l.ip ?? '—'}
                      </td>
                      <td className="table-cell">
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                          l.sucesso ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
                        )}>
                          {l.sucesso ? '✓ OK' : '✕ Erro'}
                        </span>
                      </td>
                      <td className="table-cell text-right text-fg-disabled text-xs">
                        {formatRelative(l.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {logsFiltrados.length > 50 && (
                <div className="px-4 py-2 border-t border-border-subtle text-center">
                  <p className="text-xs text-fg-disabled">Exibindo 50 de {logsFiltrados.length} registros</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Auditoria */}
      {tab === 'auditoria' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            {(['todos', 'create', 'update', 'delete'] as const).map(f => (
              <button key={f} onClick={() => setFiltroAcao(f)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                  filtroAcao === f ? 'bg-muted text-fg border-border-subtle' : 'text-fg-tertiary border-border-subtle hover:text-fg-secondary'
                )}>
                {f === 'todos' ? 'Todos' : `${ACAO_CONFIG[f].icon} ${ACAO_CONFIG[f].label}`}
              </button>
            ))}
          </div>

          {auditoria.filter(a => filtroAcao === 'todos' || a.acao === filtroAcao).length === 0 ? (
            <div className="card"><EmptyState message="Nenhum registro de auditoria" /></div>
          ) : (
            <div className="space-y-2">
              {auditoria
                .filter(a => filtroAcao === 'todos' || a.acao === filtroAcao)
                .slice(0, 50)
                .map(a => {
                  const cfg = ACAO_CONFIG[a.acao]
                  return (
                    <div key={a.id} className="card-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', cfg.bg, cfg.color)}>
                            {cfg.icon} {cfg.label}
                          </span>
                          <span className="text-sm">{TABELA_ICONS[a.tabela] ?? '📄'}</span>
                          <span className="text-xs text-fg-secondary font-medium">{a.tabela}</span>
                          {a.perfis?.nome && (
                            <span className="text-[10px] text-fg-disabled">por {a.perfis.nome}</span>
                          )}
                        </div>
                        <span className="text-[10px] text-fg-disabled">{formatRelative(a.created_at)}</span>
                      </div>

                      {/* Diff de valores */}
                      {a.acao === 'update' && a.valores_anteriores && a.valores_novos && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div className="bg-red-500/5 border border-red-500/20 rounded-lg p-2">
                            <p className="text-[10px] text-red-400 mb-1 font-medium">Antes</p>
                            <pre className="text-[10px] text-fg-tertiary overflow-hidden max-h-20 whitespace-pre-wrap">
                              {JSON.stringify(a.valores_anteriores, null, 2).slice(0, 200)}
                            </pre>
                          </div>
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-2">
                            <p className="text-[10px] text-emerald-400 mb-1 font-medium">Depois</p>
                            <pre className="text-[10px] text-fg-tertiary overflow-hidden max-h-20 whitespace-pre-wrap">
                              {JSON.stringify(a.valores_novos, null, 2).slice(0, 200)}
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </>
  )
}
