'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Tipos ──────────────────────────────────────────────────────
type TipoRegistro = 'contrato' | 'emprestimo' | 'nota' | 'lembrete' | 'compra' | 'venda' | 'outro' | 'geral'

interface Registro {
  id: string
  user_id: string
  tipo: TipoRegistro
  titulo: string
  descricao?: string | null
  valor?: number | null
  data: string
  metadados?: Record<string, any> | null
  origem: string
  created_at: string
}

// ── Config visual por tipo ──────────────────────────────────────
const TIPO_CONFIG: Record<string, { icon: string; label: string; cor: string; badge: string }> = {
  contrato:   { icon: '📝', label: 'Contrato',   cor: '#3b82f6', badge: 'bg-blue-500/10 border-blue-500/20 text-blue-300' },
  emprestimo: { icon: '🤝', label: 'Empréstimo', cor: '#f59e0b', badge: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
  nota:       { icon: '🗒️', label: 'Nota',       cor: '#a3a3a3', badge: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-300' },
  lembrete:   { icon: '🔔', label: 'Lembrete',   cor: '#ec4899', badge: 'bg-pink-500/10 border-pink-500/20 text-pink-300' },
  compra:     { icon: '🛒', label: 'Compra',      cor: '#10b981', badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' },
  venda:      { icon: '💼', label: 'Venda',       cor: '#8b5cf6', badge: 'bg-violet-500/10 border-violet-500/20 text-violet-300' },
  outro:      { icon: '🗂️', label: 'Outro',      cor: '#64748b', badge: 'bg-slate-500/10 border-slate-500/20 text-slate-300' },
  geral:      { icon: '🗂️', label: 'Geral',      cor: '#64748b', badge: 'bg-slate-500/10 border-slate-500/20 text-slate-300' },
}

function getTipo(tipo: string) {
  return TIPO_CONFIG[tipo] ?? { icon: '🗂️', label: tipo, cor: '#64748b', badge: 'bg-slate-500/10 border-slate-500/20 text-slate-300' }
}

function formatCurrency(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── Card de Registro ────────────────────────────────────────────
function RegistroCard({ reg, onDelete }: { reg: Registro; onDelete: (id: string) => void }) {
  const cfg = getTipo(reg.tipo)
  const [expandido, setExpandido] = useState(false)

  return (
    <div className="relative bg-[#0a0d16] border border-white/8 rounded-2xl p-4 flex flex-col gap-3 transition-all hover:border-white/15 group">
      {/* Glow */}
      <div className="absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl pointer-events-none opacity-10"
        style={{ background: cfg.cor }} />

      {/* Header */}
      <div className="flex items-start gap-3 relative z-10">
        <span className="text-2xl shrink-0 mt-0.5">{cfg.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{reg.titulo}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', cfg.badge)}>
              {cfg.label}
            </span>
            <span className="text-[10px] text-fg-disabled">
              {new Date(reg.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
            {reg.origem === 'elena' && (
              <span className="text-[9px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-bold">
                ✦ Elena
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setExpandido(e => !e)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-fg-tertiary flex items-center justify-center text-xs"
            title="Ver detalhes"
          >
            {expandido ? '▲' : '▼'}
          </button>
          <button
            onClick={() => onDelete(reg.id)}
            className="w-7 h-7 rounded-lg bg-red-500/5 hover:bg-red-500/20 text-red-400/50 hover:text-red-400 flex items-center justify-center text-xs transition-all"
            title="Excluir"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Valor (se houver) */}
      {reg.valor != null && reg.valor > 0 && (
        <div className="relative z-10 px-3 py-2 rounded-xl bg-white/3 border border-white/5 flex items-center justify-between">
          <span className="text-xs text-fg-tertiary">Valor</span>
          <span className="text-sm font-bold text-emerald-400">{formatCurrency(reg.valor)}</span>
        </div>
      )}

      {/* Descrição */}
      {reg.descricao && (
        <p className={cn('text-xs text-fg-secondary leading-relaxed relative z-10', !expandido && 'line-clamp-2')}>
          {reg.descricao}
        </p>
      )}

      {/* Metadados expandidos */}
      {expandido && reg.metadados && Object.keys(reg.metadados).length > 0 && (
        <div className="relative z-10 mt-1 p-3 bg-black/20 rounded-xl border border-white/5">
          <p className="text-[10px] text-fg-disabled font-semibold mb-2 uppercase tracking-wide">Dados completos (salvo pela Elena)</p>
          <div className="space-y-1">
            {Object.entries(reg.metadados).filter(([k]) => k !== 'acao').map(([k, v]) => (
              <div key={k} className="flex gap-2 text-[10px]">
                <span className="text-fg-disabled shrink-0 capitalize">{k}:</span>
                <span className="text-fg-secondary">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Modal Novo Registro ─────────────────────────────────────────
function ModalNovoRegistro({ userId, onClose, onSave }: {
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    titulo: '',
    descricao: '',
    tipo: 'nota' as TipoRegistro,
    valor: '',
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setLoading(true)
    await (supabase.from('elena_registros') as any).insert({
      user_id: userId,
      tipo: form.tipo,
      titulo: form.titulo,
      descricao: form.descricao || null,
      valor: form.valor ? Number(form.valor) : null,
      data: new Date().toISOString().split('T')[0],
      origem: 'manual',
    })
    setLoading(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">🗂️ Novo Registro</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-2xl">×</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Título *</label>
            <input className="input mt-1 w-full" required
              placeholder="Ex: Contrato de prestação de serviços..."
              value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>

          <div>
            <label className="label mb-2 block">Tipo</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.entries(TIPO_CONFIG) as [TipoRegistro, any][]).slice(0, 8).map(([k, c]) => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, tipo: k }))}
                  className={cn('flex flex-col items-center py-2 px-1 rounded-xl border text-[9px] font-semibold transition-all gap-1',
                    form.tipo === k ? c.badge + ' border' : 'bg-page/50 border-white/5 text-fg-disabled hover:border-white/10')}>
                  <span className="text-base">{c.icon}</span>
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">Valor (opcional)</label>
            <input className="input mt-1 w-full" type="number" step="0.01" min="0"
              placeholder="0,00"
              value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
          </div>

          <div>
            <label className="label">Descrição / Detalhes</label>
            <textarea className="input mt-1 w-full resize-none" rows={3}
              placeholder="Descreva detalhes importantes..."
              value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳ Salvando...' : '✓ Salvar Registro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Componente principal TabRegistros ───────────────────────────
export function TabRegistros({ userId }: { userId: string }) {
  const supabase = createClient()
  const [registros, setRegistros] = useState<Registro[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroTipo, setFiltroTipo] = useState<string>('todos')
  const [busca, setBusca] = useState('')
  const [modalOpen, setModalOpen] = useState(false)

  const carregar = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    const { data } = await (supabase.from('elena_registros') as any)
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    setRegistros((data as Registro[]) || [])
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { carregar() }, [carregar])

  const excluir = async (id: string) => {
    await (supabase.from('elena_registros') as any).delete().eq('id', id)
    setRegistros(prev => prev.filter(r => r.id !== id))
  }

  const tipos = Array.from(new Set(registros.map(r => r.tipo)))

  const filtrados = registros.filter(r => {
    const matchTipo = filtroTipo === 'todos' || r.tipo === filtroTipo
    const matchBusca = !busca || r.titulo.toLowerCase().includes(busca.toLowerCase()) || r.descricao?.toLowerCase().includes(busca.toLowerCase())
    return matchTipo && matchBusca
  })

  // Estatísticas
  const totalValor = filtrados.filter(r => r.valor).reduce((a, r) => a + (r.valor ?? 0), 0)
  const porElena = registros.filter(r => r.origem === 'elena').length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">🗂️ Registros Universais</h2>
          <p className="text-xs text-fg-tertiary mt-0.5">
            {registros.length} registro{registros.length !== 1 ? 's' : ''} · {porElena} via Elena
            {totalValor > 0 && ` · ${formatCurrency(totalValor)} em valor`}
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className="btn-primary text-xs h-8 px-4 shrink-0">
          + Novo Registro
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: registros.length, icon: '🗂️', cor: 'text-slate-300' },
          { label: 'Via Elena', value: porElena, icon: '✦', cor: 'text-amber-400' },
          { label: 'Tipos', value: tipos.length, icon: '🏷️', cor: 'text-violet-400' },
        ].map(k => (
          <div key={k.label} className="bg-surface border border-white/5 rounded-xl p-3 text-center">
            <p className="text-lg mb-0.5">{k.icon}</p>
            <p className={cn('text-xl font-bold', k.cor)}>{k.value}</p>
            <p className="text-[9px] text-fg-disabled uppercase tracking-wide">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="🔍 Buscar por título ou descrição..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="input flex-1 text-xs h-9"
        />
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setFiltroTipo('todos')}
            className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all',
              filtroTipo === 'todos'
                ? 'bg-white/10 text-white border-white/20'
                : 'text-fg-disabled border-border-subtle hover:text-fg-secondary bg-page')}
          >
            Todos ({registros.length})
          </button>
          {tipos.map(tipo => {
            const cfg = getTipo(tipo)
            const count = registros.filter(r => r.tipo === tipo).length
            return (
              <button key={tipo}
                onClick={() => setFiltroTipo(filtroTipo === tipo ? 'todos' : tipo)}
                className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1',
                  filtroTipo === tipo ? cfg.badge : 'text-fg-disabled border-border-subtle hover:text-fg-secondary bg-page')}
              >
                {cfg.icon} {cfg.label} ({count})
              </button>
            )
          })}
        </div>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-fg-disabled text-sm">Carregando registros...</p>
        </div>
      ) : filtrados.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🗂️</p>
          <p className="text-base font-bold text-fg mb-1">Nenhum registro encontrado</p>
          <p className="text-sm text-fg-tertiary mb-4">
            {busca || filtroTipo !== 'todos'
              ? 'Tente outros filtros'
              : 'A Elena registra automaticamente qualquer pedido especial aqui'}
          </p>
          <button onClick={() => setModalOpen(true)} className="btn-primary mx-auto">
            + Criar primeiro registro
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map(reg => (
            <RegistroCard key={reg.id} reg={reg} onDelete={excluir} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ModalNovoRegistro
          userId={userId}
          onClose={() => setModalOpen(false)}
          onSave={carregar}
        />
      )}
    </div>
  )
}
