'use client'

import { useState } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatRelative, cn } from '@/lib/utils'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/ui'

// ── Types ───────────────────────────────────────────────────
type NumeroWA = {
  id: string
  numero: string
  nome: string
  status: 'ativo' | 'backup' | 'bloqueado' | 'inativo'
  limite_diario: number
  enviados_hoje: number
  intervalo_minimo_segundos: number
  is_backup: boolean
  notas: string | null
  created_at: string
}

type MensagemPadrao = {
  id: string
  titulo: string
  conteudo: string
  categoria: string
  variaveis: string[] | null
}

type BackupContato = {
  id: string
  numero_id: string
  total_contatos: number
  created_at: string
}

// ── Mock Data Fallbacks ─────────────────────────────────────
const MOCK_NUMEROS: NumeroWA[] = [
  { id: '1', numero: '5511999998888', nome: 'Atendimento', status: 'ativo', limite_diario: 250, enviados_hoje: 190, intervalo_minimo_segundos: 15, is_backup: false, notas: 'Número quente', created_at: new Date().toISOString() },
  { id: '2', numero: '5511988887777', nome: 'Vendas Secundário', status: 'ativo', limite_diario: 100, enviados_hoje: 45, intervalo_minimo_segundos: 20, is_backup: false, notas: null, created_at: new Date().toISOString() },
  { id: '3', numero: '5511977776666', nome: 'Reserva 1', status: 'backup', limite_diario: 0, enviados_hoje: 0, intervalo_minimo_segundos: 30, is_backup: true, notas: null, created_at: new Date().toISOString() },
  { id: '4', numero: '5511966665555', nome: 'Antigo Banido', status: 'bloqueado', limite_diario: 50, enviados_hoje: 50, intervalo_minimo_segundos: 10, is_backup: false, notas: 'Março', created_at: new Date().toISOString() },
]

const MOCK_MENSAGENS: MensagemPadrao[] = [
  { id: '1', titulo: 'Saudação Inicial', conteudo: 'Olá {{nome}}! Aqui é do atendimento Cajado.', categoria: 'prospeccao', variaveis: ['nome'] },
  { id: '2', titulo: 'Cobrança', conteudo: 'Bom dia {{nome}}, identificamos um valor pendente. Podemos enviar o PIX?', categoria: 'followup', variaveis: ['nome'] },
]

const MOCK_CHECKINS = [
  { id: '1', tipo: 'entrada', endereco: 'Av. Paulista, 1000', servico_descricao: 'Chegada no escritório', timestamp: new Date(Date.now() - 8 * 3600000).toISOString(), perfis: { nome: 'Carlos' } },
  { id: '2', tipo: 'saida', endereco: 'Av. Paulista, 1000', servico_descricao: 'Fim do expediente', timestamp: new Date(Date.now() - 1 * 3600000).toISOString(), perfis: { nome: 'Carlos' } }
]

// ── Card de Número ─────────────────────────────────────────
function NumeroCard({
  numero, onEdit,
}: { numero: NumeroWA; onEdit: () => void }) {
  const pct = numero.limite_diario > 0
    ? Math.min(Math.round((numero.enviados_hoje / numero.limite_diario) * 100), 100)
    : 0

  const statusColor = {
    ativo: 'text-emerald-400',
    backup: 'text-blue-400',
    bloqueado: 'text-red-400',
    inativo: 'text-zinc-500',
  }[numero.status]

  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'

  return (
    <div className="card hover:bg-zinc-800/60 transition-all">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{numero.status === 'ativo' ? '🟢' : numero.status === 'backup' ? '🔵' : numero.status === 'bloqueado' ? '🔴' : '⚪'}</span>
            <div>
              <p className="text-sm font-semibold text-zinc-100">{numero.nome}</p>
              <p className="text-xs font-mono text-zinc-500">{numero.numero}</p>
            </div>
          </div>
          {numero.is_backup && (
            <span className="text-[10px] bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full mt-1.5 inline-block">
              ★ Backup
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={numero.status} />
          <button onClick={onEdit} className="text-zinc-600 hover:text-zinc-300 text-sm transition-colors">✏️</button>
        </div>
      </div>

      {/* Barra de uso */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-zinc-500">Enviados hoje</span>
          <span className={pct > 80 ? 'text-red-400 font-semibold' : 'text-zinc-400'}>
            {numero.enviados_hoje} / {numero.limite_diario} ({pct}%)
          </span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-zinc-800">
        <span className="text-xs text-zinc-600">
          ⏱ Intervalo: {numero.intervalo_minimo_segundos}s entre msgs
        </span>
        {pct >= 80 && (
          <span className="text-[10px] text-red-400 font-medium animate-pulse">⚠ Limite próximo</span>
        )}
      </div>

      {numero.notas && (
        <p className="text-xs text-zinc-600 mt-2 italic">{numero.notas}</p>
      )}
    </div>
  )
}

// ── Modal Número ────────────────────────────────────────────
function ModalNumero({
  numero, onClose, onSave,
}: { numero?: NumeroWA | null; onClose: () => void; onSave: () => void }) {
  const { insert, update, loading } = useSupabaseMutation('numeros_whatsapp')
  const [form, setForm] = useState({
    numero: numero?.numero ?? '',
    nome: numero?.nome ?? '',
    status: numero?.status ?? 'ativo' as NumeroWA['status'],
    limite_diario: numero?.limite_diario?.toString() ?? '200',
    intervalo_minimo_segundos: numero?.intervalo_minimo_segundos?.toString() ?? '10',
    is_backup: numero?.is_backup ?? false,
    notas: numero?.notas ?? '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      numero: form.numero,
      nome: form.nome,
      status: form.status,
      limite_diario: parseInt(form.limite_diario),
      intervalo_minimo_segundos: parseInt(form.intervalo_minimo_segundos),
      is_backup: form.is_backup,
      notas: form.notas || null,
    }
    if (numero) {
      await update(numero.id, payload)
    } else {
      await insert({ ...payload, enviados_hoje: 0 })
    }
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">
            {numero ? 'Editar Número' : 'Cadastrar Número'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Número *</label>
              <input className="input mt-1" required value={form.numero}
                onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                placeholder="5511999999999" />
            </div>
            <div>
              <label className="label">Nome/Apelido *</label>
              <input className="input mt-1" required value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: WA Principal" />
            </div>
          </div>
          <div>
            <label className="label">Status</label>
            <select className="input mt-1" value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value as NumeroWA['status'] }))}>
              <option value="ativo">Ativo</option>
              <option value="backup">Backup</option>
              <option value="inativo">Inativo</option>
              <option value="bloqueado">Bloqueado</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Limite diário de envios</label>
              <input className="input mt-1" type="number" min="1" value={form.limite_diario}
                onChange={e => setForm(f => ({ ...f, limite_diario: e.target.value }))} />
            </div>
            <div>
              <label className="label">Intervalo mínimo (seg)</label>
              <input className="input mt-1" type="number" min="5" value={form.intervalo_minimo_segundos}
                onChange={e => setForm(f => ({ ...f, intervalo_minimo_segundos: e.target.value }))} />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer group">
            <div
              onClick={() => setForm(f => ({ ...f, is_backup: !f.is_backup }))}
              className={cn('w-10 h-5 rounded-full transition-colors relative',
                form.is_backup ? 'bg-blue-500' : 'bg-zinc-700'
              )}>
              <div className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all',
                form.is_backup ? 'left-5' : 'left-0.5'
              )} />
            </div>
            <span className="text-sm text-zinc-300">Marcar como número reserva/backup</span>
          </label>
          <div>
            <label className="label">Notas</label>
            <textarea className="input mt-1 resize-none" rows={2} value={form.notas}
              onChange={e => setForm(f => ({ ...f, notas: e.target.value }))}
              placeholder="Observações sobre este número..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : numero ? 'Atualizar' : 'Cadastrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────
export default function SegurancaWAClient() {
  const [tab, setTab] = useState<'numeros' | 'mensagens' | 'checkins'>('numeros')
  const [modalNumero, setModalNumero] = useState(false)
  const [editando, setEditando] = useState<NumeroWA | null>(null)

  const { data: numerosDB, refetch: refetchNumeros } = useSupabaseQuery<NumeroWA>('numeros_whatsapp', {
    orderBy: { column: 'status', ascending: true },
  })
  const { data: mensagensDB, refetch: refetchMensagens } = useSupabaseQuery<MensagemPadrao>('mensagens_padrao', {
    orderBy: { column: 'categoria', ascending: true },
  })
  const { insert: insertMensagem, loading: loadingMsg } = useSupabaseMutation('mensagens_padrao')
  const [formMsg, setFormMsg] = useState({ titulo: '', conteudo: '', categoria: 'prospeccao' })
  const [modalMsg, setModalMsg] = useState(false)

  const { data: checkinsDB } = useSupabaseQuery<{
    id: string; tipo: string; endereco: string | null;
    servico_descricao: string | null; timestamp: string;
    perfis?: { nome: string }
  }>('checkins', {
    select: '*, perfis(nome)',
    orderBy: { column: 'timestamp', ascending: false },
    limit: 20,
  })

  // Injetar mock data se o banco estiver vazio (para demonstração)
  const numeros = numerosDB.length > 0 ? numerosDB : MOCK_NUMEROS
  const mensagens = mensagensDB.length > 0 ? mensagensDB : MOCK_MENSAGENS
  const checkins = checkinsDB.length > 0 ? checkinsDB : MOCK_CHECKINS
  
  const { insert: insertCheckin, loading: loadingCheckin } = useSupabaseMutation('checkins')

  // Métricas rápidas
  const ativos = numeros.filter(n => n.status === 'ativo').length
  const bloqueados = numeros.filter(n => n.status === 'bloqueado').length
  const backups = numeros.filter(n => n.is_backup).length
  const totalEnviadosHoje = numeros.reduce((a, n) => a + (n.enviados_hoje ?? 0), 0)
  const emRisco = numeros.filter(n =>
    n.status === 'ativo' && n.limite_diario > 0 &&
    (n.enviados_hoje / n.limite_diario) > 0.8
  ).length

  const handleSaveMsg = async (e: React.FormEvent) => {
    e.preventDefault()
    await insertMensagem({ ...formMsg, variaveis: [] })
    refetchMensagens()
    setFormMsg({ titulo: '', conteudo: '', categoria: 'prospeccao' })
    setModalMsg(false)
  }

  const handleCheckin = async (tipo: 'entrada' | 'saida') => {
    // Tenta usar geolocalização do browser
    navigator.geolocation?.getCurrentPosition(
      async pos => {
        await insertCheckin({
          tipo,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: new Date().toISOString(),
        })
        refetchNumeros()
      },
      async () => {
        // Sem GPS - registra sem localização
        await insertCheckin({ tipo, timestamp: new Date().toISOString() })
      }
    )
  }

  const TABS = [
    { key: 'numeros', label: '📱 Números WA' },
    { key: 'mensagens', label: '💬 Mensagens Padrão' },
    { key: 'checkins', label: '📍 Check-in / Check-out' },
  ] as const

  return (
    <>
      <PageHeader title="Segurança WhatsApp" subtitle="Gestão de números · Proteção · Campanhas · Operação">
        {tab === 'numeros' && (
          <button onClick={() => setModalNumero(true)} className="btn-primary">+ Número</button>
        )}
        {tab === 'mensagens' && (
          <button onClick={() => setModalMsg(true)} className="btn-primary">+ Mensagem</button>
        )}
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Ativos</p>
          <p className="metric-value text-emerald-400">{ativos}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Bloqueados</p>
          <p className={cn('metric-value', bloqueados > 0 ? 'text-red-400' : 'text-zinc-100')}>{bloqueados}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Backups</p>
          <p className="metric-value text-blue-400">{backups}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Enviados hoje</p>
          <p className="metric-value">{totalEnviadosHoje}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Em risco (80%+)</p>
          <p className={cn('metric-value', emRisco > 0 ? 'text-amber-400' : 'text-zinc-100')}>{emRisco}</p>
        </div>
      </div>

      {/* Alerta de bloqueio */}
      {bloqueados > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-red-400 text-xl">🚨</span>
          <div>
            <p className="text-sm font-semibold text-red-400">{bloqueados} número(s) bloqueado(s)</p>
            <p className="text-xs text-red-400/70">Ative um número backup imediatamente e verifique os contatos afetados.</p>
          </div>
        </div>
      )}

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

      {/* Tab: Números */}
      {tab === 'numeros' && (
        <div className="space-y-4">
          {numeros.length === 0 ? (
            <div className="card"><EmptyState message="Nenhum número cadastrado. Clique em '+ Número' para começar." /></div>
          ) : (
            <>
              {/* Ativos em destaque */}
              {numeros.filter(n => n.status === 'ativo').length > 0 && (
                <div>
                  <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2 px-1">● Números ativos</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {numeros.filter(n => n.status === 'ativo').map(n => (
                      <NumeroCard key={n.id} numero={n} onEdit={() => setEditando(n)} />
                    ))}
                  </div>
                </div>
              )}
              {/* Backups */}
              {numeros.filter(n => n.status === 'backup').length > 0 && (
                <div>
                  <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2 px-1">● Números backup</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {numeros.filter(n => n.status === 'backup').map(n => (
                      <NumeroCard key={n.id} numero={n} onEdit={() => setEditando(n)} />
                    ))}
                  </div>
                </div>
              )}
              {/* Outros */}
              {numeros.filter(n => !['ativo', 'backup'].includes(n.status)).length > 0 && (
                <div>
                  <p className="text-xs text-zinc-600 uppercase tracking-widest mb-2 px-1">● Inativos / Bloqueados</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {numeros.filter(n => !['ativo', 'backup'].includes(n.status)).map(n => (
                      <NumeroCard key={n.id} numero={n} onEdit={() => setEditando(n)} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab: Mensagens Padrão */}
      {tab === 'mensagens' && (
        <div className="space-y-4">
          {mensagens.length === 0 ? (
            <div className="card"><EmptyState message="Nenhuma mensagem cadastrada" /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {mensagens.map(m => (
                <div key={m.id} className="card space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-100">{m.titulo}</p>
                      <span className="text-[10px] text-zinc-600 uppercase tracking-wide">{m.categoria}</span>
                    </div>
                    <button
                      onClick={() => navigator.clipboard.writeText(m.conteudo)}
                      className="text-xs text-zinc-500 hover:text-amber-400 transition-colors px-2 py-1 rounded"
                      title="Copiar mensagem"
                    >
                      📋 Copiar
                    </button>
                  </div>
                  <p className="text-sm text-zinc-400 leading-relaxed bg-zinc-800 rounded-lg p-3 font-mono text-xs">
                    {m.conteudo}
                  </p>
                  {m.variaveis && m.variaveis.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {m.variaveis.map(v => (
                        <span key={v} className="text-[10px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded-full">
                          {`{{${v}}}`}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Check-in / Check-out */}
      {tab === 'checkins' && (
        <div className="space-y-4">
          {/* Ação rápida */}
          <div className="card">
            <p className="text-sm font-semibold text-zinc-200 mb-4">Registro rápido de presença</p>
            <div className="flex gap-3">
              <button
                onClick={() => handleCheckin('entrada')}
                disabled={loadingCheckin}
                className="flex-1 py-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/25 transition-all"
              >
                ✅ Check-in (Entrada)
              </button>
              <button
                onClick={() => handleCheckin('saida')}
                disabled={loadingCheckin}
                className="flex-1 py-4 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 font-semibold text-sm hover:bg-red-500/25 transition-all"
              >
                🚪 Check-out (Saída)
              </button>
            </div>
            <p className="text-xs text-zinc-600 mt-2 text-center">
              A localização GPS será capturada automaticamente pelo navegador
            </p>
          </div>

          {/* Histórico */}
          <div className="card p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800">
              <p className="text-xs text-zinc-500 uppercase tracking-wide font-medium">Histórico de check-ins</p>
            </div>
            {checkins.length === 0 ? (
              <div className="p-6"><EmptyState message="Nenhum check-in registrado" /></div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {checkins.map(c => (
                  <div key={c.id} className="px-4 py-3 flex items-center justify-between hover:bg-zinc-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl shrink-0">
                        {c.tipo === 'entrada' ? '✅' : '🚪'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">
                          {c.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                          {c.perfis?.nome && <span className="text-zinc-500"> · {c.perfis.nome}</span>}
                        </p>
                        {c.endereco && <p className="text-xs text-zinc-600">📍 {c.endereco}</p>}
                        {c.servico_descricao && <p className="text-xs text-zinc-500">{c.servico_descricao}</p>}
                      </div>
                    </div>
                    <span className="text-xs text-zinc-600 shrink-0">{formatRelative(c.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modais */}
      {(modalNumero || editando) && (
        <ModalNumero
          numero={editando}
          onClose={() => { setModalNumero(false); setEditando(null) }}
          onSave={() => { refetchNumeros(); setEditando(null) }}
        />
      )}

      {modalMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-zinc-100">Nova Mensagem Padrão</h2>
              <button onClick={() => setModalMsg(false)} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
            </div>
            <form onSubmit={handleSaveMsg} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Título *</label>
                  <input className="input mt-1" required value={formMsg.titulo}
                    onChange={e => setFormMsg(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="Nome da mensagem" />
                </div>
                <div>
                  <label className="label">Categoria</label>
                  <select className="input mt-1" value={formMsg.categoria}
                    onChange={e => setFormMsg(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="prospeccao">Prospecção</option>
                    <option value="proposta">Proposta</option>
                    <option value="followup">Follow-up</option>
                    <option value="pos_venda">Pós-venda</option>
                    <option value="renovacao">Renovação</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Conteúdo *</label>
                <textarea className="input mt-1 resize-none font-mono text-xs" rows={5} required
                  value={formMsg.conteudo}
                  onChange={e => setFormMsg(f => ({ ...f, conteudo: e.target.value }))}
                  placeholder="Use {{nome}}, {{servico}} para variáveis dinâmicas..." />
                <p className="text-[10px] text-zinc-600 mt-1">Use {'{{variavel}}'} para personalizar</p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setModalMsg(false)} className="btn-secondary">Cancelar</button>
                <button type="submit" className="btn-primary" disabled={loadingMsg}>
                  {loadingMsg ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
