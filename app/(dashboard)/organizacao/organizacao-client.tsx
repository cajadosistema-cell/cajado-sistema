'use client'

import { useState } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatRelative, formatDate, cn } from '@/lib/utils'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/ui'

// ── Types ───────────────────────────────────────────────────
type Projeto = {
  id: string
  titulo: string
  descricao: string | null
  status: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
  data_inicio: string | null
  data_fim_prevista: string | null
  progresso_percentual: number
  proximos_passos: string | null
  created_at: string
}

type Ideia = {
  id: string
  projeto_id: string | null
  titulo: string
  descricao: string | null
  status: 'ideia' | 'analise' | 'execucao' | 'validada' | 'descartada'
  prazo: 'curto' | 'medio' | 'longo'
  potencial_impacto: 'baixo' | 'medio' | 'alto' | null
  notas: string | null
  created_at: string
}

type Decisao = {
  id: string
  projeto_id: string | null
  titulo: string
  contexto: string
  decisao_tomada: string
  resultado: string | null
  aprendizado: string | null
  data_decisao: string
}

// ── Mock Data Fallbacks ─────────────────────────────────────
const MOCK_PROJETOS: Projeto[] = [
  { id: '1', titulo: 'Automação de WhatsApp', descricao: 'Integrar API Oficial', status: 'ativo', data_inicio: '2026-04-01', data_fim_prevista: '2026-05-01', progresso_percentual: 65, proximos_passos: 'Revisar templates aprovados', created_at: new Date().toISOString() },
  { id: '2', titulo: 'Nova Tabela de Preços', descricao: 'Atualizar valores 2026', status: 'concluido', data_inicio: '2026-03-01', data_fim_prevista: '2026-03-15', progresso_percentual: 100, proximos_passos: null, created_at: new Date().toISOString() },
]

const MOCK_IDEIAS: Ideia[] = [
  { id: '1', projeto_id: null, titulo: 'Oferecer seguro auto junto com licenciamento', descricao: 'Fazer parceria com corretora', status: 'ideia', prazo: 'medio', potencial_impacto: 'alto', notas: null, created_at: new Date().toISOString() },
  { id: '2', projeto_id: null, titulo: 'Café expresso grátis', descricao: 'Comprar máquina de cápsula', status: 'execucao', prazo: 'curto', potencial_impacto: 'baixo', notas: null, created_at: new Date().toISOString() },
]

const MOCK_DECISOES: Decisao[] = [
  { id: '1', projeto_id: null, titulo: 'Migração para API Oficial', contexto: 'Muitos bloqueios no QR Code', decisao_tomada: 'Usar provedor Meta Cloud.', resultado: 'Menos quedas', aprendizado: 'O processo de template é chato, mas vale a pena.', data_decisao: '2026-04-10' }
]

// ── Helpers ─────────────────────────────────────────────────
const PRAZO_CONFIG = {
  curto:  { label: 'Curto Prazo',  color: 'text-red-400',    bg: 'bg-red-500/10',    dot: 'bg-red-500' },
  medio:  { label: 'Médio Prazo',  color: 'text-amber-400',  bg: 'bg-amber-500/10',  dot: 'bg-amber-500' },
  longo:  { label: 'Longo Prazo',  color: 'text-blue-400',   bg: 'bg-blue-500/10',   dot: 'bg-blue-500' },
}

const IDEIA_STATUS_FLOW: Ideia['status'][] = ['ideia', 'analise', 'execucao', 'validada', 'descartada']

const IMPACTO_COLORS = {
  alto:  'text-red-400 bg-red-500/10',
  medio: 'text-amber-400 bg-amber-500/10',
  baixo: 'text-zinc-400 bg-zinc-800',
}

// ── Modal Projeto ───────────────────────────────────────────
function ModalProjeto({ projeto, onClose, onSave }: {
  projeto?: Projeto | null; onClose: () => void; onSave: () => void
}) {
  const { insert, update, loading } = useSupabaseMutation('projetos')
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    titulo: projeto?.titulo ?? '',
    descricao: projeto?.descricao ?? '',
    status: projeto?.status ?? 'ativo' as Projeto['status'],
    data_inicio: projeto?.data_inicio ?? today,
    data_fim_prevista: projeto?.data_fim_prevista ?? '',
    proximos_passos: projeto?.proximos_passos ?? '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      status: form.status,
      data_inicio: form.data_inicio || null,
      data_fim_prevista: form.data_fim_prevista || null,
      proximos_passos: form.proximos_passos || null,
    }
    if (projeto) await update(projeto.id, payload)
    else await insert({ ...payload, progresso_percentual: 0 })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">{projeto ? 'Editar Projeto' : 'Novo Projeto'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Título *</label>
            <input className="input mt-1" required value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Nome do projeto" />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input mt-1 resize-none" rows={2} value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Objetivo do projeto..." />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Projeto['status'] }))}>
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="concluido">Concluído</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
            <div>
              <label className="label">Início</label>
              <input className="input mt-1" type="date" value={form.data_inicio}
                onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))} />
            </div>
            <div>
              <label className="label">Previsão fim</label>
              <input className="input mt-1" type="date" value={form.data_fim_prevista}
                onChange={e => setForm(f => ({ ...f, data_fim_prevista: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Próximos passos</label>
            <textarea className="input mt-1 resize-none" rows={3} value={form.proximos_passos}
              onChange={e => setForm(f => ({ ...f, proximos_passos: e.target.value }))}
              placeholder="O que precisa ser feito agora?" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : projeto ? 'Atualizar' : 'Criar projeto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Ideia ─────────────────────────────────────────────
function ModalIdeia({ projetos, onClose, onSave, ideia }: {
  projetos: Projeto[]; onClose: () => void; onSave: () => void; ideia?: Ideia | null
}) {
  const { insert, update, loading } = useSupabaseMutation('ideias')
  const [form, setForm] = useState({
    titulo: ideia?.titulo ?? '',
    descricao: ideia?.descricao ?? '',
    status: ideia?.status ?? 'ideia' as Ideia['status'],
    prazo: ideia?.prazo ?? 'medio' as Ideia['prazo'],
    potencial_impacto: ideia?.potencial_impacto ?? 'medio' as 'baixo' | 'medio' | 'alto',
    projeto_id: ideia?.projeto_id ?? '',
    notas: ideia?.notas ?? '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      titulo: form.titulo,
      descricao: form.descricao || null,
      status: form.status,
      prazo: form.prazo,
      potencial_impacto: form.potencial_impacto,
      projeto_id: form.projeto_id || null,
      notas: form.notas || null,
    }
    if (ideia) await update(ideia.id, payload)
    else await insert(payload)
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">{ideia ? 'Editar Ideia' : 'Nova Ideia'}</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Ideia *</label>
            <input className="input mt-1" required value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Descreva a ideia em uma frase..." />
          </div>
          <div>
            <label className="label">Detalhes</label>
            <textarea className="input mt-1 resize-none" rows={3} value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Como funciona? Qual o potencial?" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Prazo</label>
              <select className="input mt-1" value={form.prazo}
                onChange={e => setForm(f => ({ ...f, prazo: e.target.value as Ideia['prazo'] }))}>
                <option value="curto">Curto prazo</option>
                <option value="medio">Médio prazo</option>
                <option value="longo">Longo prazo</option>
              </select>
            </div>
            <div>
              <label className="label">Impacto</label>
              <select className="input mt-1" value={form.potencial_impacto}
                onChange={e => setForm(f => ({ ...f, potencial_impacto: e.target.value as 'baixo' | 'medio' | 'alto' }))}>
                <option value="alto">Alto</option>
                <option value="medio">Médio</option>
                <option value="baixo">Baixo</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Ideia['status'] }))}>
                {IDEIA_STATUS_FLOW.map(s => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>
          {projetos.length > 0 && (
            <div>
              <label className="label">Projeto relacionado</label>
              <select className="input mt-1" value={form.projeto_id}
                onChange={e => setForm(f => ({ ...f, projeto_id: e.target.value }))}>
                <option value="">Sem projeto</option>
                {projetos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="label">Notas</label>
            <textarea className="input mt-1 resize-none" rows={2} value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Referências, links, inspirações..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : ideia ? 'Atualizar' : 'Salvar ideia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Progress Bar ─────────────────────────────────────────────
function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn('h-1.5 bg-zinc-800 rounded-full overflow-hidden', className)}>
      <div
        className="h-full bg-amber-500 rounded-full transition-all duration-700"
        style={{ width: `${value}%` }}
      />
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function OrganizacaoClient() {
  const [tab, setTab] = useState<'projetos' | 'ideias' | 'decisoes'>('projetos')
  const [modalProjeto, setModalProjeto] = useState(false)
  const [modalIdeia, setModalIdeia] = useState(false)
  const [editandoProjeto, setEditandoProjeto] = useState<Projeto | null>(null)
  const [editandoIdeia, setEditandoIdeia] = useState<Ideia | null>(null)
  const [projetoSelecionado, setProjetoSelecionado] = useState<string>('todos')

  const { data: projetosDB, refetch: refetchProjetos } = useSupabaseQuery<Projeto>('projetos', {
    orderBy: { column: 'created_at', ascending: false },
  })
  const { data: ideiasDB, refetch: refetchIdeias } = useSupabaseQuery<Ideia>('ideias', {
    orderBy: { column: 'created_at', ascending: false },
  })
  const { data: decisoesDB } = useSupabaseQuery<Decisao>('decisoes', {
    orderBy: { column: 'data_decisao', ascending: false },
  })

  // Injetar mock data se o banco estiver vazio (para demonstração)
  const projetos = projetosDB.length > 0 ? projetosDB : MOCK_PROJETOS
  const ideias = ideiasDB.length > 0 ? ideiasDB : MOCK_IDEIAS
  const decisoes = decisoesDB.length > 0 ? decisoesDB : MOCK_DECISOES
  const { insert: insertDecisao, loading: loadingDecisao } = useSupabaseMutation('decisoes')
  const { update: updateProjeto } = useSupabaseMutation('projetos')
  const { update: updateIdeia } = useSupabaseMutation('ideias')

  const [formDecisao, setFormDecisao] = useState({
    titulo: '', contexto: '', decisao_tomada: '', aprendizado: ''
  })
  const [modalDecisao, setModalDecisao] = useState(false)

  // Métricas
  const projetosAtivos = projetos.filter(p => p.status === 'ativo').length
  const ideiasNaoDescartadas = ideias.filter(i => i.status !== 'descartada')
  const ideiasEmExecucao = ideias.filter(i => i.status === 'execucao').length

  // Filtro de ideias por prazo
  const ideiasFiltered = ideias.filter(i =>
    projetoSelecionado === 'todos' || i.projeto_id === projetoSelecionado
  )

  const handleSaveDecisao = async (e: React.FormEvent) => {
    e.preventDefault()
    await insertDecisao({
      ...formDecisao,
      data_decisao: new Date().toISOString().split('T')[0],
    })
    setFormDecisao({ titulo: '', contexto: '', decisao_tomada: '', aprendizado: '' })
    setModalDecisao(false)
  }

  const TABS = [
    { key: 'projetos', label: '📁 Projetos' },
    { key: 'ideias', label: '💡 Ideias' },
    { key: 'decisoes', label: '📖 Decisões' },
  ] as const

  return (
    <>
      <PageHeader title="Organização" subtitle="Projetos · Ideias · Histórico de decisões">
        {tab === 'projetos' && (
          <button onClick={() => setModalProjeto(true)} className="btn-primary">+ Projeto</button>
        )}
        {tab === 'ideias' && (
          <button onClick={() => setModalIdeia(true)} className="btn-primary">+ Ideia</button>
        )}
        {tab === 'decisoes' && (
          <button onClick={() => setModalDecisao(true)} className="btn-primary">+ Decisão</button>
        )}
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Projetos ativos</p>
          <p className="metric-value text-amber-400">{projetosAtivos}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Ideias ativas</p>
          <p className="metric-value">{ideiasNaoDescartadas.length}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Em execução</p>
          <p className="metric-value text-emerald-400">{ideiasEmExecucao}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Decisões registradas</p>
          <p className="metric-value text-purple-400">{decisoes.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-4 w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t.key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Projetos */}
      {tab === 'projetos' && (
        <div className="space-y-3">
          {projetos.length === 0 ? (
            <div className="card"><EmptyState message="Nenhum projeto criado ainda" /></div>
          ) : (
            projetos.map(p => {
              const statusColors: Record<string, string> = {
                ativo: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
                pausado: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
                concluido: 'text-blue-400 border-blue-500/30 bg-blue-500/5',
                cancelado: 'text-zinc-500 border-zinc-700 bg-zinc-800/50',
              }
              return (
                <div key={p.id} className={cn('card border', statusColors[p.status])}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-semibold text-zinc-100">{p.titulo}</h3>
                        <StatusBadge status={p.status} />
                      </div>
                      {p.descricao && <p className="text-xs text-zinc-500">{p.descricao}</p>}
                    </div>
                    <button
                      onClick={() => setEditandoProjeto(p)}
                      className="text-zinc-600 hover:text-zinc-300 text-sm transition-colors shrink-0"
                    >
                      ✏️
                    </button>
                  </div>

                  {/* Progresso */}
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-500">Progresso</span>
                      <span className="text-zinc-400">{p.progresso_percentual}%</span>
                    </div>
                    <ProgressBar value={p.progresso_percentual} />
                    <input
                      type="range" min="0" max="100" value={p.progresso_percentual}
                      onChange={e => updateProjeto(p.id, { progresso_percentual: parseInt(e.target.value) })
                        .then(() => refetchProjetos())}
                      className="w-full mt-1 accent-amber-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {p.data_inicio && (
                      <div>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Início</p>
                        <p className="text-xs text-zinc-400">{formatDate(p.data_inicio)}</p>
                      </div>
                    )}
                    {p.data_fim_prevista && (
                      <div>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Previsão</p>
                        <p className={cn('text-xs', new Date(p.data_fim_prevista) < new Date() ? 'text-red-400' : 'text-zinc-400')}>
                          {formatDate(p.data_fim_prevista)}
                        </p>
                      </div>
                    )}
                  </div>

                  {p.proximos_passos && (
                    <div className="mt-3 pt-3 border-t border-zinc-800">
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Próximos passos</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">{p.proximos_passos}</p>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tab: Ideias */}
      {tab === 'ideias' && (
        <div className="space-y-4">
          {/* Filtro por projeto */}
          {projetos.length > 0 && (
            <select className="input w-48" value={projetoSelecionado}
              onChange={e => setProjetoSelecionado(e.target.value)}>
              <option value="todos">Todos os projetos</option>
              {projetos.map(p => <option key={p.id} value={p.id}>{p.titulo}</option>)}
            </select>
          )}

          {/* Colunas por prazo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['curto', 'medio', 'longo'] as const).map(prazo => {
              const cfg = PRAZO_CONFIG[prazo]
              const ideia_prazo = ideiasFiltered.filter(i => i.prazo === prazo && i.status !== 'descartada')
              return (
                <div key={prazo}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={cn('w-2 h-2 rounded-full', cfg.dot)} />
                    <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', cfg.bg, cfg.color)}>
                      {ideia_prazo.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {ideia_prazo.length === 0 ? (
                      <div className="border-2 border-dashed border-zinc-800 rounded-xl p-4 text-center">
                        <p className="text-xs text-zinc-700">Nenhuma ideia</p>
                      </div>
                    ) : (
                      ideia_prazo.map(i => (
                        <div key={i.id}
                          onClick={() => setEditandoIdeia(i)}
                          className="card-sm cursor-pointer hover:bg-zinc-800/80 transition-all group space-y-2">
                          <div className="flex items-start justify-between">
                            <p className="text-sm font-medium text-zinc-200 group-hover:text-amber-400 transition-colors leading-tight flex-1 mr-2">
                              {i.titulo}
                            </p>
                            <StatusBadge status={i.status} />
                          </div>
                          {i.descricao && (
                            <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">{i.descricao}</p>
                          )}
                          <div className="flex items-center justify-between">
                            {i.potencial_impacto && (
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize', IMPACTO_COLORS[i.potencial_impacto])}>
                                ↑ {i.potencial_impacto}
                              </span>
                            )}
                            <span className="text-[10px] text-zinc-700 ml-auto">{formatRelative(i.created_at)}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Descartadas (colapsável) */}
          {ideiasFiltered.filter(i => i.status === 'descartada').length > 0 && (
            <details className="group">
              <summary className="cursor-pointer text-xs text-zinc-600 hover:text-zinc-400 flex items-center gap-2 py-2">
                <span className="group-open:rotate-90 transition-transform">▶</span>
                Ideias descartadas ({ideiasFiltered.filter(i => i.status === 'descartada').length})
              </summary>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                {ideiasFiltered.filter(i => i.status === 'descartada').map(i => (
                  <div key={i.id} className="card-sm opacity-50 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setEditandoIdeia(i)}>
                    <p className="text-xs text-zinc-500 line-through">{i.titulo}</p>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* Tab: Decisões */}
      {tab === 'decisoes' && (
        <div className="space-y-3">
          {decisoes.length === 0 ? (
            <div className="card"><EmptyState message="Nenhuma decisão registrada ainda" /></div>
          ) : (
            decisoes.map(d => (
              <div key={d.id} className="card space-y-3">
                <div className="flex items-start justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">{d.titulo}</h3>
                  <span className="text-xs text-zinc-600 shrink-0">{formatDate(d.data_decisao)}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Contexto</p>
                    <p className="text-xs text-zinc-400 leading-relaxed">{d.contexto}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Decisão tomada</p>
                    <p className="text-xs text-zinc-300 font-medium leading-relaxed">{d.decisao_tomada}</p>
                  </div>
                </div>
                {(d.resultado || d.aprendizado) && (
                  <div className="pt-3 border-t border-zinc-800 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {d.resultado && (
                      <div>
                        <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Resultado</p>
                        <p className="text-xs text-zinc-400 leading-relaxed">{d.resultado}</p>
                      </div>
                    )}
                    {d.aprendizado && (
                      <div>
                        <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-1">💡 Aprendizado</p>
                        <p className="text-xs text-amber-400/80 leading-relaxed italic">{d.aprendizado}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Modais */}
      {(modalProjeto || editandoProjeto) && (
        <ModalProjeto
          projeto={editandoProjeto}
          onClose={() => { setModalProjeto(false); setEditandoProjeto(null) }}
          onSave={refetchProjetos}
        />
      )}
      {(modalIdeia || editandoIdeia) && (
        <ModalIdeia
          projetos={projetos}
          ideia={editandoIdeia}
          onClose={() => { setModalIdeia(false); setEditandoIdeia(null) }}
          onSave={refetchIdeias}
        />
      )}
      {modalDecisao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-100">Registrar Decisão</h2>
              <button onClick={() => setModalDecisao(false)} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
            </div>
            <form onSubmit={handleSaveDecisao} className="space-y-4">
              <div>
                <label className="label">Título *</label>
                <input className="input mt-1" required value={formDecisao.titulo}
                  onChange={e => setFormDecisao(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Qual foi a decisão?" />
              </div>
              <div>
                <label className="label">Contexto *</label>
                <textarea className="input mt-1 resize-none" rows={2} required value={formDecisao.contexto}
                  onChange={e => setFormDecisao(f => ({ ...f, contexto: e.target.value }))}
                  placeholder="O que te levou a tomar essa decisão?" />
              </div>
              <div>
                <label className="label">Decisão tomada *</label>
                <textarea className="input mt-1 resize-none" rows={2} required value={formDecisao.decisao_tomada}
                  onChange={e => setFormDecisao(f => ({ ...f, decisao_tomada: e.target.value }))}
                  placeholder="O que foi decidido exatamente?" />
              </div>
              <div>
                <label className="label">Aprendizado (opcional)</label>
                <textarea className="input mt-1 resize-none" rows={2} value={formDecisao.aprendizado}
                  onChange={e => setFormDecisao(f => ({ ...f, aprendizado: e.target.value }))}
                  placeholder="O que você aprendeu com isso?" />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalDecisao(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={loadingDecisao}>
                  {loadingDecisao ? 'Salvando...' : 'Registrar decisão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
