'use client'

import { useState } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatCurrency, formatRelative, formatDate, cn } from '@/lib/utils'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/ui'

// ── Types ───────────────────────────────────────────────────
type Lead = {
  id: string
  nome: string
  telefone: string
  email: string | null
  origem: 'whatsapp' | 'indicacao' | 'instagram' | 'google' | 'outro'
  servico_interesse: string | null
  status: 'novo' | 'proposta' | 'retomar' | 'cliente_ativo' | 'perdido'
  valor_estimado: number | null
  notas: string | null
  ultimo_contato: string | null
  proximo_followup: string | null
  created_at: string
  atendente_id: string | null
  parceiro_id: string | null
  parceiros?: { nome: string } | null
  perfis?: { nome: string } | null
}

type Atividade = {
  id: string
  lead_id: string
  tipo: 'mensagem' | 'ligacao' | 'reuniao' | 'proposta' | 'visita' | 'outro'
  descricao: string
  resultado: string | null
  realizado_em: string
  perfis?: { nome: string }
}

type Parceiro = {
  id: string
  nome: string
  telefone: string
  email: string | null
  status: 'ativo' | 'inativo' | 'suspenso'
  comissao_percentual: number
  total_indicacoes: number
  total_convertidas: number
  total_comissao: number
  meta_mensal: number | null
}

// ── Helpers ─────────────────────────────────────────────────
const STATUS_COLUMNS: Lead['status'][] = ['novo', 'proposta', 'retomar', 'cliente_ativo']

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  novo:          { label: 'Novo',          color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
  proposta:      { label: 'Proposta',      color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
  retomar:       { label: 'Retomar',       color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30' },
  cliente_ativo: { label: 'Cliente Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  perdido:       { label: 'Perdido',       color: 'text-zinc-500',    bg: 'bg-zinc-800',       border: 'border-zinc-700' },
}

const ORIGEM_ICONS: Record<string, string> = {
  whatsapp: '💬',
  indicacao: '🤝',
  instagram: '📸',
  google: '🔍',
  outro: '📌',
}

const ATIVIDADE_ICONS: Record<string, string> = {
  mensagem: '💬',
  ligacao: '📞',
  reuniao: '👥',
  proposta: '📋',
  visita: '🏠',
  outro: '📌',
}

// ── Modal Lead ───────────────────────────────────────────────
function ModalLead({
  onClose, onSave, lead,
}: {
  onClose: () => void
  onSave: () => void
  lead?: Lead | null
}) {
  const { insert, update, loading } = useSupabaseMutation('leads')
  const [form, setForm] = useState({
    nome: lead?.nome ?? '',
    telefone: lead?.telefone ?? '',
    email: lead?.email ?? '',
    origem: lead?.origem ?? 'whatsapp' as Lead['origem'],
    servico_interesse: lead?.servico_interesse ?? '',
    status: lead?.status ?? 'novo' as Lead['status'],
    valor_estimado: lead?.valor_estimado?.toString() ?? '',
    notas: lead?.notas ?? '',
    proximo_followup: lead?.proximo_followup?.split('T')[0] ?? '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      nome: form.nome,
      telefone: form.telefone,
      email: form.email || null,
      origem: form.origem,
      servico_interesse: form.servico_interesse || null,
      status: form.status,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado.replace(',', '.')) : null,
      notas: form.notas || null,
      proximo_followup: form.proximo_followup ? new Date(form.proximo_followup).toISOString() : null,
      ultimo_contato: new Date().toISOString(),
    }

    if (lead) {
      await update(lead.id, payload)
    } else {
      await insert(payload)
    }
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">
            {lead ? 'Editar Lead' : 'Novo Lead'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nome *</label>
              <input className="input mt-1" required value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo" />
            </div>
            <div>
              <label className="label">Telefone *</label>
              <input className="input mt-1" required value={form.telefone}
                onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))}
                placeholder="(11) 99999-9999" />
            </div>
          </div>

          <div>
            <label className="label">E-mail</label>
            <input className="input mt-1" type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@exemplo.com" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Origem</label>
              <select className="input mt-1" value={form.origem}
                onChange={e => setForm(f => ({ ...f, origem: e.target.value as Lead['origem'] }))}>
                <option value="whatsapp">WhatsApp</option>
                <option value="indicacao">Indicação</option>
                <option value="instagram">Instagram</option>
                <option value="google">Google</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as Lead['status'] }))}>
                <option value="novo">Novo</option>
                <option value="proposta">Proposta</option>
                <option value="retomar">Retomar</option>
                <option value="cliente_ativo">Cliente Ativo</option>
                <option value="perdido">Perdido</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Serviço de interesse</label>
              <input className="input mt-1" value={form.servico_interesse}
                onChange={e => setForm(f => ({ ...f, servico_interesse: e.target.value }))}
                placeholder="Ex: Porteiro, CFTV..." />
            </div>
            <div>
              <label className="label">Valor estimado (R$)</label>
              <input className="input mt-1" type="number" step="0.01" value={form.valor_estimado}
                onChange={e => setForm(f => ({ ...f, valor_estimado: e.target.value }))}
                placeholder="0,00" />
            </div>
          </div>

          <div>
            <label className="label">Próximo follow-up</label>
            <input className="input mt-1" type="datetime-local" value={form.proximo_followup}
              onChange={e => setForm(f => ({ ...f, proximo_followup: e.target.value }))} />
          </div>

          <div>
            <label className="label">Notas</label>
            <textarea className="input mt-1 resize-none" rows={3} value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Observações sobre o lead..." />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : lead ? 'Atualizar' : 'Criar lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Atividade ──────────────────────────────────────────
function ModalAtividade({
  leadId, onClose, onSave,
}: {
  leadId: string
  onClose: () => void
  onSave: () => void
}) {
  const { insert, loading } = useSupabaseMutation('atividades')
  const [form, setForm] = useState({
    tipo: 'mensagem' as Atividade['tipo'],
    descricao: '',
    resultado: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Precisamos do ID do perfil logado — por ora usamos um placeholder
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    await insert({
      lead_id: leadId,
      tipo: form.tipo,
      descricao: form.descricao,
      resultado: form.resultado || null,
      realizado_por: user?.id ?? '',
      realizado_em: new Date().toISOString(),
    })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Registrar Atividade</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Tipo de Atividade</label>
            <div className="grid grid-cols-3 gap-1 bg-zinc-800/50 p-1 rounded-lg mt-1">
              {(['mensagem', 'ligacao', 'reuniao', 'proposta', 'visita', 'outro'] as const).map(t => (
                <button key={t} type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: t }))}
                  className={cn('py-1.5 rounded-md text-xs font-medium transition-colors',
                    form.tipo === t ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                  )}>
                  {ATIVIDADE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Descrição *</label>
            <textarea className="input mt-1 resize-none" rows={3} required value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="O que aconteceu neste contato?" />
          </div>
          <div>
            <label className="label">Resultado</label>
            <input className="input mt-1" value={form.resultado}
              onChange={e => setForm(f => ({ ...f, resultado: e.target.value }))}
              placeholder="Ex: Enviou proposta, agendou reunião..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Drawer de Lead ───────────────────────────────────────────
function LeadDrawer({
  lead, onClose, onEdit, onRefresh,
}: {
  lead: Lead
  onClose: () => void
  onEdit: () => void
  onRefresh: () => void
}) {
  const [modalAtividade, setModalAtividade] = useState(false)
  const { data: atividades } = useSupabaseQuery<Atividade>('atividades', {
    filters: { lead_id: lead.id },
    select: '*, perfis(nome)',
    orderBy: { column: 'realizado_em', ascending: false },
  })
  const { update } = useSupabaseMutation('leads')

  const changeStatus = async (status: Lead['status']) => {
    await update(lead.id, { status, ultimo_contato: new Date().toISOString() })
    onRefresh()
  }

  const cfg = STATUS_CONFIG[lead.status]

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-zinc-900 border-l border-zinc-800 flex flex-col h-screen overflow-y-auto">
        {/* Header */}
        <div className="p-5 border-b border-zinc-800">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{ORIGEM_ICONS[lead.origem]}</span>
              <div>
                <h2 className="text-base font-semibold text-zinc-100">{lead.nome}</h2>
                <p className="text-xs text-zinc-500">{lead.telefone}</p>
              </div>
            </div>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
          </div>

          {/* Troca de status rápida */}
          <div className="flex flex-wrap gap-1.5">
            {STATUS_COLUMNS.map(s => (
              <button key={s} onClick={() => changeStatus(s)}
                className={cn(
                  'px-2.5 py-1 rounded-full text-xs font-medium transition-all border',
                  lead.status === s
                    ? `${STATUS_CONFIG[s].bg} ${STATUS_CONFIG[s].color} ${STATUS_CONFIG[s].border}`
                    : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:border-zinc-500'
                )}>
                {STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Infos */}
        <div className="p-5 space-y-3 border-b border-zinc-800">
          <div className="grid grid-cols-2 gap-3">
            <div className="card-sm">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Valor estimado</p>
              <p className="text-sm font-bold text-amber-400 mt-0.5">
                {lead.valor_estimado ? formatCurrency(lead.valor_estimado) : '—'}
              </p>
            </div>
            <div className="card-sm">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide">Serviço</p>
              <p className="text-sm font-medium text-zinc-300 mt-0.5 truncate">
                {lead.servico_interesse ?? '—'}
              </p>
            </div>
          </div>
          {lead.notas && (
            <div className="card-sm">
              <p className="text-[10px] text-zinc-600 uppercase tracking-wide mb-1">Notas</p>
              <p className="text-sm text-zinc-400 leading-relaxed">{lead.notas}</p>
            </div>
          )}
          {lead.proximo_followup && (
            <div className={cn(
              'card-sm flex items-center gap-2',
              new Date(lead.proximo_followup) < new Date() ? 'border-red-500/30' : 'border-amber-500/20'
            )}>
              <span className="text-base">📅</span>
              <div>
                <p className="text-[10px] text-zinc-600">Próximo follow-up</p>
                <p className={cn('text-sm font-medium', new Date(lead.proximo_followup) < new Date() ? 'text-red-400' : 'text-zinc-300')}>
                  {formatDate(lead.proximo_followup)} — {formatRelative(lead.proximo_followup)}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="p-5 flex gap-2 border-b border-zinc-800">
          <button onClick={onEdit} className="btn-secondary text-xs flex-1">✏️ Editar</button>
          <a href={`https://wa.me/${lead.telefone.replace(/\D/g, '')}`}
            target="_blank" rel="noopener noreferrer"
            className="btn-primary text-xs flex-1 text-center no-underline">
            💬 WhatsApp
          </a>
          <button onClick={() => setModalAtividade(true)} className="btn-secondary text-xs flex-1">
            + Atividade
          </button>
        </div>

        {/* Histórico */}
        <div className="p-5 flex-1">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">
            Histórico de atividades ({atividades.length})
          </p>
          {atividades.length === 0 ? (
            <p className="text-sm text-zinc-600 text-center py-8">Nenhuma atividade registrada</p>
          ) : (
            <div className="space-y-2">
              {atividades.map(a => (
                <div key={a.id} className="card-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm">{ATIVIDADE_ICONS[a.tipo]}</span>
                      <span className="text-xs font-medium text-zinc-300 capitalize">{a.tipo}</span>
                    </div>
                    <span className="text-[10px] text-zinc-600">{formatRelative(a.realizado_em)}</span>
                  </div>
                  <p className="text-sm text-zinc-400">{a.descricao}</p>
                  {a.resultado && (
                    <p className="text-xs text-emerald-400 mt-1">→ {a.resultado}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalAtividade && (
        <ModalAtividade
          leadId={lead.id}
          onClose={() => setModalAtividade(false)}
          onSave={onRefresh}
        />
      )}
    </div>
  )
}

// ── Card de Lead (Kanban) ────────────────────────────────────
function LeadCard({ lead, onClick }: { lead: Lead; onClick: () => void }) {
  const atrasado = lead.proximo_followup && new Date(lead.proximo_followup) < new Date()

  return (
    <div
      onClick={onClick}
      className="card-sm cursor-pointer hover:bg-zinc-800/80 transition-all group space-y-2"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-base">{ORIGEM_ICONS[lead.origem]}</span>
          <p className="text-sm font-medium text-zinc-200 group-hover:text-amber-400 transition-colors leading-tight">
            {lead.nome}
          </p>
        </div>
        {atrasado && <span className="text-red-400 text-xs shrink-0">⚠</span>}
      </div>
      {lead.servico_interesse && (
        <p className="text-xs text-zinc-500 truncate">{lead.servico_interesse}</p>
      )}
      <div className="flex items-center justify-between">
        {lead.valor_estimado ? (
          <span className="text-xs font-semibold text-amber-400">{formatCurrency(lead.valor_estimado)}</span>
        ) : <span />}
        <span className="text-[10px] text-zinc-600">{formatRelative(lead.created_at)}</span>
      </div>
    </div>
  )
}

// ── Aba Parceiros ────────────────────────────────────────────
function TabParceiros() {
  const [modalOpen, setModalOpen] = useState(false)
  const { data: parceiros, refetch } = useSupabaseQuery<Parceiro>('parceiros', {
    orderBy: { column: 'total_comissao', ascending: false },
  })
  const { insert, loading } = useSupabaseMutation('parceiros')
  const [form, setForm] = useState({ nome: '', telefone: '', email: '', comissao_percentual: '10', meta_mensal: '' })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    await insert({
      nome: form.nome,
      telefone: form.telefone,
      email: form.email || null,
      comissao_percentual: parseFloat(form.comissao_percentual),
      meta_mensal: form.meta_mensal ? parseInt(form.meta_mensal) : null,
      status: 'ativo',
    })
    refetch()
    setModalOpen(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setModalOpen(true)} className="btn-primary">+ Parceiro</button>
      </div>

      {parceiros.length === 0 ? (
        <div className="card"><EmptyState message="Nenhum parceiro cadastrado" /></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">Parceiro</th>
                <th className="table-header">Status</th>
                <th className="table-header text-right">Indicações</th>
                <th className="table-header text-right">Convertidas</th>
                <th className="table-header text-right">Comissão</th>
                <th className="table-header text-right">Total ganho</th>
              </tr>
            </thead>
            <tbody>
              {parceiros.map((p, i) => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 bg-amber-500/20 rounded-full flex items-center justify-center text-amber-400 text-xs font-bold shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-zinc-200 font-medium text-sm">{p.nome}</p>
                        <p className="text-xs text-zinc-600">{p.telefone}</p>
                      </div>
                    </div>
                  </td>
                  <td className="table-cell"><StatusBadge status={p.status} /></td>
                  <td className="table-cell text-right text-zinc-300">{p.total_indicacoes}</td>
                  <td className="table-cell text-right">
                    <span className="text-emerald-400 font-medium">{p.total_convertidas}</span>
                  </td>
                  <td className="table-cell text-right text-zinc-400">{p.comissao_percentual}%</td>
                  <td className="table-cell text-right font-semibold text-amber-400">
                    {formatCurrency(p.total_comissao)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-100">Novo Parceiro</h2>
              <button onClick={() => setModalOpen(false)} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Nome *</label>
                <input className="input mt-1" required value={form.nome}
                  onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Telefone *</label>
                  <input className="input mt-1" required value={form.telefone}
                    onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} />
                </div>
                <div>
                  <label className="label">E-mail</label>
                  <input className="input mt-1" type="email" value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Comissão (%)</label>
                  <input className="input mt-1" type="number" step="0.5" min="0" max="100"
                    value={form.comissao_percentual}
                    onChange={e => setForm(f => ({ ...f, comissao_percentual: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Meta mensal (indicações)</label>
                  <input className="input mt-1" type="number" min="1" value={form.meta_mensal}
                    onChange={e => setForm(f => ({ ...f, meta_mensal: e.target.value }))} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading ? 'Salvando...' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Relatório Diário ─────────────────────────────────────────
function TabRelatorio({ leads }: { leads: Lead[] }) {
  const semResposta = leads.filter(l =>
    l.status === 'novo' && l.ultimo_contato &&
    (new Date().getTime() - new Date(l.ultimo_contato).getTime()) > 24 * 60 * 60 * 1000
  )
  const atrasados = leads.filter(l =>
    l.proximo_followup && new Date(l.proximo_followup) < new Date() && l.status !== 'perdido'
  )
  const paraRetomar = leads.filter(l => l.status === 'retomar')
  const propostas = leads.filter(l => l.status === 'proposta')

  const items = [
    { icon: '⚠️', label: 'Leads sem resposta +24h', items: semResposta, color: 'text-red-400' },
    { icon: '📅', label: 'Follow-ups atrasados', items: atrasados, color: 'text-amber-400' },
    { icon: '🔄', label: 'Para retomar contato', items: paraRetomar, color: 'text-purple-400' },
    { icon: '📋', label: 'Propostas sem resposta', items: propostas, color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {items.map(item => (
          <div key={item.label} className="card-sm text-center">
            <p className="text-2xl mb-1">{item.icon}</p>
            <p className={cn('text-2xl font-bold', item.color)}>{item.items.length}</p>
            <p className="text-[10px] text-zinc-500 mt-1 leading-tight">{item.label}</p>
          </div>
        ))}
      </div>

      {items.filter(i => i.items.length > 0).map(item => (
        <div key={item.label} className="card">
          <p className={cn('text-xs font-semibold mb-3', item.color)}>
            {item.icon} {item.label}
          </p>
          <div className="space-y-2">
            {item.items.slice(0, 5).map(l => (
              <div key={l.id} className="flex items-center justify-between py-1 border-b border-zinc-800 last:border-0">
                <div>
                  <p className="text-sm text-zinc-300">{l.nome}</p>
                  <p className="text-xs text-zinc-600">{l.telefone} · {l.servico_interesse ?? 'sem serviço'}</p>
                </div>
                <a href={`https://wa.me/${l.telefone.replace(/\D/g, '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors" onClick={e => e.stopPropagation()}>
                  💬 WA
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}

      {items.every(i => i.items.length === 0) && (
        <div className="card">
          <div className="flex flex-col items-center py-10 gap-2">
            <span className="text-4xl">✅</span>
            <p className="text-zinc-400 font-medium">Tudo em dia!</p>
            <p className="text-zinc-600 text-sm">Nenhuma pendência no momento</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────
export default function CajadoClient() {
  const [tab, setTab] = useState<'kanban' | 'lista' | 'parceiros' | 'relatorio'>('kanban')
  const [modalLead, setModalLead] = useState(false)
  const [leadSelecionado, setLeadSelecionado] = useState<Lead | null>(null)
  const [leadEditando, setLeadEditando] = useState<Lead | null>(null)
  const [busca, setBusca] = useState('')

  const { data: leads, refetch } = useSupabaseQuery<Lead>('leads', {
    select: '*, parceiros(nome), perfis(nome)',
    orderBy: { column: 'updated_at', ascending: false },
  })

  // Métricas
  const leadsAtivos = leads.filter(l => l.status !== 'perdido')
  const clientesAtivos = leads.filter(l => l.status === 'cliente_ativo')
  const pipelineTotal = leads.filter(l => l.valor_estimado && l.status !== 'perdido')
    .reduce((a, l) => a + (l.valor_estimado ?? 0), 0)
  const followupsAtrasados = leads.filter(l =>
    l.proximo_followup && new Date(l.proximo_followup) < new Date() && l.status !== 'perdido'
  )

  // Filtro de busca
  const leadsFiltrados = leads.filter(l =>
    !busca || l.nome.toLowerCase().includes(busca.toLowerCase()) ||
    l.telefone.includes(busca) ||
    l.servico_interesse?.toLowerCase().includes(busca.toLowerCase())
  )

  const handleRefresh = () => refetch()

  const TABS = [
    { key: 'kanban', label: 'Kanban' },
    { key: 'lista', label: 'Lista' },
    { key: 'parceiros', label: 'Parceiros' },
    { key: 'relatorio', label: 'Relatório Diário' },
  ] as const

  return (
    <>
      <PageHeader title="Cajado Empresa" subtitle="CRM · Leads · Parceiros · Equipe">
        <button onClick={() => setModalLead(true)} className="btn-primary">+ Lead</button>
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Leads ativos</p>
          <p className="metric-value">{leadsAtivos.length}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Clientes ativos</p>
          <p className="metric-value text-emerald-400">{clientesAtivos.length}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Pipeline total</p>
          <p className="metric-value text-amber-400">{formatCurrency(pipelineTotal)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Follow-ups atrasados</p>
          <p className={cn('metric-value', followupsAtrasados.length > 0 ? 'text-red-400' : 'text-zinc-100')}>
            {followupsAtrasados.length}
          </p>
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

      {/* Tab: Kanban */}
      {tab === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map(status => {
            const cfg = STATUS_CONFIG[status]
            const leadsColuna = leadsFiltrados.filter(l => l.status === status)
            return (
              <div key={status}>
                <div className={cn('flex items-center justify-between mb-3 px-1')}>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</span>
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', cfg.bg, cfg.color)}>
                      {leadsColuna.length}
                    </span>
                  </div>
                  {leadsColuna.length > 0 && (
                    <span className="text-[10px] text-zinc-600">
                      {formatCurrency(leadsColuna.reduce((a, l) => a + (l.valor_estimado ?? 0), 0))}
                    </span>
                  )}
                </div>
                <div className="space-y-2 min-h-[120px]">
                  {leadsColuna.length === 0 ? (
                    <div className={cn('border-2 border-dashed rounded-xl p-4 text-center', cfg.border)}>
                      <p className="text-xs text-zinc-600">Sem leads aqui</p>
                    </div>
                  ) : (
                    leadsColuna.map(l => (
                      <LeadCard key={l.id} lead={l} onClick={() => setLeadSelecionado(l)} />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Lista */}
      {tab === 'lista' && (
        <div className="space-y-3">
          <input
            className="input max-w-sm"
            placeholder="Buscar por nome, telefone ou serviço..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
          />
          <div className="card p-0 overflow-hidden">
            {leadsFiltrados.length === 0 ? (
              <div className="p-6"><EmptyState message="Nenhum lead encontrado" /></div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="table-header">Lead</th>
                    <th className="table-header hidden md:table-cell">Origem</th>
                    <th className="table-header hidden lg:table-cell">Serviço</th>
                    <th className="table-header">Status</th>
                    <th className="table-header hidden md:table-cell">Follow-up</th>
                    <th className="table-header text-right">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsFiltrados.map(l => {
                    const atrasado = l.proximo_followup && new Date(l.proximo_followup) < new Date()
                    return (
                      <tr key={l.id} className="table-row cursor-pointer"
                        onClick={() => setLeadSelecionado(l)}>
                        <td className="table-cell">
                          <p className="text-zinc-200 font-medium text-sm">{l.nome}</p>
                          <p className="text-xs text-zinc-600">{l.telefone}</p>
                        </td>
                        <td className="table-cell hidden md:table-cell">
                          <span className="text-base">{ORIGEM_ICONS[l.origem]}</span>
                        </td>
                        <td className="table-cell hidden lg:table-cell text-zinc-400 text-xs">
                          {l.servico_interesse ?? '—'}
                        </td>
                        <td className="table-cell"><StatusBadge status={l.status} /></td>
                        <td className="table-cell hidden md:table-cell">
                          {l.proximo_followup ? (
                            <span className={cn('text-xs', atrasado ? 'text-red-400 font-medium' : 'text-zinc-500')}>
                              {atrasado ? '⚠ ' : ''}{formatDate(l.proximo_followup)}
                            </span>
                          ) : <span className="text-zinc-700">—</span>}
                        </td>
                        <td className="table-cell text-right">
                          {l.valor_estimado
                            ? <span className="text-amber-400 font-semibold text-sm">{formatCurrency(l.valor_estimado)}</span>
                            : <span className="text-zinc-700">—</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab: Parceiros */}
      {tab === 'parceiros' && <TabParceiros />}

      {/* Tab: Relatório */}
      {tab === 'relatorio' && <TabRelatorio leads={leads} />}

      {/* Modais */}
      {modalLead && (
        <ModalLead onClose={() => setModalLead(false)} onSave={handleRefresh} />
      )}
      {leadEditando && (
        <ModalLead
          lead={leadEditando}
          onClose={() => setLeadEditando(null)}
          onSave={() => { handleRefresh(); setLeadSelecionado(null) }}
        />
      )}

      {/* Drawer de detalhes do lead */}
      {leadSelecionado && (
        <LeadDrawer
          lead={leadSelecionado}
          onClose={() => setLeadSelecionado(null)}
          onEdit={() => { setLeadEditando(leadSelecionado); setLeadSelecionado(null) }}
          onRefresh={() => { handleRefresh(); setLeadSelecionado(null) }}
        />
      )}
    </>
  )
}
