'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// ── Tipos ──────────────────────────────────────────────────────
type Categoria = 'negocio' | 'produto' | 'pessoal' | 'financeiro' | 'saude' | 'criativo' | 'geral'
type StatusIdeia = 'rascunho' | 'desenvolvendo' | 'validando' | 'concluida' | 'arquivada'

interface Ideia {
  id: string
  user_id: string
  titulo: string
  descricao?: string | null
  categoria: Categoria
  status: StatusIdeia
  progresso: number
  notas?: string | null
  created_at: string
}

// ── Config visual ──────────────────────────────────────────────
const CAT_CONFIG: Record<Categoria, { icon: string; label: string; cor: string; bg: string }> = {
  negocio:    { icon: '🏢', label: 'Negócio',    cor: '#3b82f6', bg: 'bg-blue-500/10 border-blue-500/20 text-blue-300' },
  produto:    { icon: '📦', label: 'Produto',    cor: '#8b5cf6', bg: 'bg-violet-500/10 border-violet-500/20 text-violet-300' },
  pessoal:    { icon: '🧍', label: 'Pessoal',    cor: '#f59e0b', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-300' },
  financeiro: { icon: '💰', label: 'Financeiro', cor: '#10b981', bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' },
  saude:      { icon: '🏃', label: 'Saúde',      cor: '#ec4899', bg: 'bg-pink-500/10 border-pink-500/20 text-pink-300' },
  criativo:   { icon: '🎨', label: 'Criativo',   cor: '#f97316', bg: 'bg-orange-500/10 border-orange-500/20 text-orange-300' },
  geral:      { icon: '💡', label: 'Geral',      cor: '#a3a3a3', bg: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-300' },
}

const STATUS_CONFIG: Record<StatusIdeia, { label: string; badge: string; next?: StatusIdeia }> = {
  rascunho:    { label: '✏️ Rascunho',    badge: 'bg-zinc-500/10 border-zinc-500/20 text-zinc-400',     next: 'desenvolvendo' },
  desenvolvendo:{ label: '🔧 Desenvolvendo',badge: 'bg-blue-500/10 border-blue-500/20 text-blue-400',   next: 'validando' },
  validando:   { label: '🔍 Validando',   badge: 'bg-amber-500/10 border-amber-500/20 text-amber-400',  next: 'concluida' },
  concluida:   { label: '✅ Concluída',   badge: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400', next: undefined },
  arquivada:   { label: '🗄️ Arquivada',  badge: 'bg-zinc-800/50 border-zinc-700/30 text-zinc-600',    next: undefined },
}

const STATUS_ORDER: StatusIdeia[] = ['rascunho', 'desenvolvendo', 'validando', 'concluida']

// ── Barra de progresso animada ─────────────────────────────────
function ProgressBar({ value, cor }: { value: number; cor: string }) {
  return (
    <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
        style={{ width: `${value}%`, background: `linear-gradient(90deg, ${cor}80, ${cor})` }}
      />
    </div>
  )
}

// ── Card de ideia (modo slide) ─────────────────────────────────
function IdeiaCard({ ideia, onEdit, onProgress, onStatus }: {
  ideia: Ideia
  onEdit: (i: Ideia) => void
  onProgress: (id: string, p: number) => void
  onStatus: (id: string, s: StatusIdeia) => void
}) {
  const cat = CAT_CONFIG[ideia.categoria]
  const st = STATUS_CONFIG[ideia.status]

  return (
    <div className={cn(
      'relative bg-[#0a0d16] border rounded-2xl p-5 flex flex-col gap-4',
      'transition-all hover:border-white/10',
      ideia.status === 'arquivada' ? 'opacity-40 border-white/5' : 'border-white/8'
    )}>
      {/* Glow de cor da categoria */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ background: cat.cor }} />

      {/* Header */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-2xl shrink-0">{cat.icon}</span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{ideia.titulo}</p>
            <p className="text-[10px] text-fg-disabled mt-0.5">
              {new Date(ideia.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <button
          onClick={() => onEdit(ideia)}
          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-fg-tertiary hover:text-fg-secondary flex items-center justify-center text-xs transition-all shrink-0"
        >✎</button>
      </div>

      {/* Descrição */}
      {ideia.descricao && (
        <p className="text-xs text-fg-secondary leading-relaxed line-clamp-3 relative z-10">
          {ideia.descricao}
        </p>
      )}

      {/* Status pipeline */}
      <div className="relative z-10">
        <div className="flex gap-1 mb-3">
          {STATUS_ORDER.map((s, i) => {
            const idx = STATUS_ORDER.indexOf(ideia.status as any)
            const done = i <= idx
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn(
                  'w-full h-1 rounded-full transition-all duration-500',
                  done ? 'opacity-100' : 'opacity-20'
                )} style={{ background: done ? cat.cor : '#ffffff20' }} />
                <span className="text-[8px] text-fg-disabled hidden sm:block capitalize">
                  {STATUS_CONFIG[s].label.replace(/[^\w\s]/g, '').trim()}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Progresso */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-fg-tertiary">Progresso</span>
          <span className="text-sm font-bold" style={{ color: cat.cor }}>{ideia.progresso}%</span>
        </div>
        <ProgressBar value={ideia.progresso} cor={cat.cor} />
        <input
          type="range" min={0} max={100} value={ideia.progresso}
          onChange={e => onProgress(ideia.id, Number(e.target.value))}
          className="w-full h-1 opacity-0 cursor-pointer -mt-3 relative z-10"
          title="Ajustar progresso"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 relative z-10">
        <span className={cn('text-[9px] font-bold px-2 py-1 rounded border', st.badge)}>
          {st.label}
        </span>
        {st.next && ideia.status !== 'arquivada' && (
          <button
            onClick={() => onStatus(ideia.id, st.next!)}
            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg transition-all"
            style={{ background: `${cat.cor}20`, color: cat.cor, border: `1px solid ${cat.cor}30` }}
          >
            Avançar →
          </button>
        )}
      </div>
    </div>
  )
}

// ── Modal criar/editar ideia ───────────────────────────────────
function ModalIdeia({ inicial, userId, onClose, onSave }: {
  inicial?: Partial<Ideia>
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    titulo: inicial?.titulo ?? '',
    descricao: inicial?.descricao ?? '',
    categoria: (inicial?.categoria ?? 'geral') as Categoria,
    status: (inicial?.status ?? 'rascunho') as StatusIdeia,
    progresso: inicial?.progresso ?? 0,
    notas: inicial?.notas ?? '',
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setLoading(true)
    const payload = { ...form, user_id: userId, descricao: form.descricao || null, notas: form.notas || null }
    if (inicial?.id) {
      await (supabase.from('elena_ideias') as any).update(payload).eq('id', inicial.id)
    } else {
      await (supabase.from('elena_ideias') as any).insert(payload)
    }
    setLoading(false)
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">
            {inicial?.id ? '✏️ Editar Ideia' : '💡 Nova Ideia'}
          </h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-2xl">×</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Título */}
          <div>
            <label className="label">Título da Ideia *</label>
            <input className="input mt-1 w-full" required
              placeholder="Ex: App de controle de treinos de bicicleta..."
              value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
          </div>

          {/* Categoria */}
          <div>
            <label className="label mb-2 block">Categoria</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.entries(CAT_CONFIG) as [Categoria, any][]).map(([k, c]) => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, categoria: k }))}
                  className={cn('flex flex-col items-center py-2 px-1 rounded-xl border text-xs font-semibold transition-all gap-1',
                    form.categoria === k ? c.bg + ' border' : 'bg-page/50 border-white/5 text-fg-disabled hover:border-white/10')}>
                  <span className="text-base">{c.icon}</span>
                  <span className="text-[9px]">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="label">Descrição / Contexto</label>
            <textarea className="input mt-1 w-full resize-none" rows={3}
              placeholder="Descreva a ideia com detalhes, contexto, motivação..."
              value={form.descricao as string} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>

          {/* Progresso */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label">Progresso</label>
              <span className="text-sm font-bold text-amber-400">{form.progresso}%</span>
            </div>
            <input type="range" min={0} max={100} value={form.progresso}
              onChange={e => setForm(f => ({ ...f, progresso: Number(e.target.value) }))}
              className="w-full accent-amber-500" />
            <ProgressBar value={form.progresso} cor="#f59e0b" />
          </div>

          {/* Status */}
          <div>
            <label className="label mb-2 block">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.entries(STATUS_CONFIG) as [StatusIdeia, any][]).map(([k, c]) => (
                <button key={k} type="button" onClick={() => setForm(f => ({ ...f, status: k }))}
                  className={cn('px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all',
                    form.status === k ? c.badge : 'border-border-subtle text-fg-disabled hover:border-border-subtle')}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="label">Notas / Próximos passos</label>
            <textarea className="input mt-1 w-full resize-none" rows={2}
              placeholder="Ações necessárias, referências, links..."
              value={form.notas as string} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳ Salvando...' : '✓ Salvar Ideia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Componente principal TabIdeias ─────────────────────────────
export function TabIdeias({ userId }: { userId: string }) {
  const supabase = createClient()
  const [ideias, setIdeias] = useState<Ideia[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<StatusIdeia | 'todas'>('todas')
  const [slide, setSlide] = useState(0)
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Ideia | null>(null)
  const [viewMode, setViewMode] = useState<'slide' | 'grid'>('slide')

  const carregar = useCallback(async () => {
    setLoading(true)
    const { data } = await (supabase.from('elena_ideias') as any)
      .select('*').eq('user_id', userId)
      .order('created_at', { ascending: false })
    setIdeias((data as Ideia[]) || [])
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { if (userId) carregar() }, [userId, carregar])

  // Escuta Elena salvar nova ideia
  useEffect(() => {
    const h = () => { if (userId) carregar() }
    window.addEventListener('elena:ideia-salva', h)
    return () => window.removeEventListener('elena:ideia-salva', h)
  }, [userId, carregar])

  const atualizarProgresso = useCallback(async (id: string, progresso: number) => {
    setIdeias(prev => prev.map(i => i.id === id ? { ...i, progresso } : i))
    await (supabase.from('elena_ideias') as any).update({ progresso }).eq('id', id)
  }, [supabase])

  const atualizarStatus = useCallback(async (id: string, status: StatusIdeia) => {
    // Auto-progresso ao avançar status
    const autoProgress: Record<StatusIdeia, number> = {
      rascunho: 10, desenvolvendo: 30, validando: 70, concluida: 100, arquivada: 0
    }
    setIdeias(prev => prev.map(i => i.id === id ? { ...i, status, progresso: autoProgress[status] } : i))
    await (supabase.from('elena_ideias') as any)
      .update({ status, progresso: autoProgress[status] }).eq('id', id)
  }, [supabase])

  const ideiasVisiveis = filtro === 'todas'
    ? ideias.filter(i => i.status !== 'arquivada')
    : ideias.filter(i => i.status === filtro)

  // Estatísticas
  const ativas = ideias.filter(i => i.status !== 'arquivada')
  const concluidas = ideias.filter(i => i.status === 'concluida').length
  const mediaProgresso = ativas.length > 0
    ? Math.round(ativas.reduce((a, i) => a + i.progresso, 0) / ativas.length)
    : 0

  const slideAtual = ideiasVisiveis[slide]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white">💡 Banco de Ideias</h2>
          <p className="text-xs text-fg-tertiary mt-0.5">
            {ativas.length} ativa{ativas.length !== 1 ? 's' : ''} · {concluidas} concluída{concluidas !== 1 ? 's' : ''} · média {mediaProgresso}%
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex gap-1 bg-page border border-border-subtle rounded-xl p-1">
            <button onClick={() => setViewMode('slide')}
              className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                viewMode === 'slide' ? 'bg-amber-500/10 text-amber-400' : 'text-fg-tertiary hover:text-fg-secondary')}>
              🎠 Slide
            </button>
            <button onClick={() => setViewMode('grid')}
              className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                viewMode === 'grid' ? 'bg-amber-500/10 text-amber-400' : 'text-fg-tertiary hover:text-fg-secondary')}>
              ⊞ Grid
            </button>
          </div>
          <button onClick={() => { setEditando(null); setModalOpen(true) }} className="btn-primary text-xs h-8 px-4">
            + Nova Ideia
          </button>
        </div>
      </div>

      {/* Barra de progresso geral */}
      <div className="bg-surface border border-white/5 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-fg-secondary">📊 Progresso Geral do Portfólio</p>
          <span className="text-lg font-extrabold text-amber-400">{mediaProgresso}%</span>
        </div>
        <ProgressBar value={mediaProgresso} cor="#f59e0b" />
        <div className="grid grid-cols-4 gap-2 pt-1">
          {STATUS_ORDER.map(s => {
            const count = ideias.filter(i => i.status === s).length
            return (
              <button key={s} onClick={() => setFiltro(filtro === s ? 'todas' : s)}
                className={cn('text-center p-2 rounded-xl border transition-all',
                  filtro === s ? STATUS_CONFIG[s].badge + ' border' : 'border-white/5 bg-page/50')}>
                <p className="text-xl font-bold text-white">{count}</p>
                <p className="text-[9px] text-fg-disabled mt-0.5">{STATUS_CONFIG[s].label.replace(/[^\w\s]/g,'').trim()}</p>
              </button>
            )
          })}
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-fg-disabled text-sm">Carregando ideias...</p>
        </div>
      ) : ideiasVisiveis.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">💡</p>
          <p className="text-base font-bold text-fg mb-1">Nenhuma ideia aqui ainda</p>
          <p className="text-sm text-fg-tertiary mb-4">
            Peça à Elena: <span className="italic">"Guarda essa ideia: ..."</span>
          </p>
          <button onClick={() => { setEditando(null); setModalOpen(true) }} className="btn-primary mx-auto">
            + Criar primeira ideia
          </button>
        </div>
      ) : viewMode === 'slide' ? (
        /* ── Modo Slide ── */
        <div className="space-y-4">
          {/* Slide principal */}
          {slideAtual && (
            <IdeiaCard
              ideia={slideAtual}
              onEdit={i => { setEditando(i); setModalOpen(true) }}
              onProgress={atualizarProgresso}
              onStatus={atualizarStatus}
            />
          )}
          {/* Navegação */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setSlide(s => Math.max(0, s - 1))}
              disabled={slide === 0}
              className="w-9 h-9 rounded-xl border border-white/10 bg-page flex items-center justify-center text-fg-secondary hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"
            >←</button>
            {/* Dots */}
            <div className="flex gap-1.5 items-center">
              {ideiasVisiveis.map((_, i) => (
                <button key={i} onClick={() => setSlide(i)}
                  className={cn('rounded-full transition-all', i === slide
                    ? 'w-6 h-2 bg-amber-500'
                    : 'w-2 h-2 bg-white/20 hover:bg-white/40')} />
              ))}
            </div>
            <button
              onClick={() => setSlide(s => Math.min(ideiasVisiveis.length - 1, s + 1))}
              disabled={slide === ideiasVisiveis.length - 1}
              className="w-9 h-9 rounded-xl border border-white/10 bg-page flex items-center justify-center text-fg-secondary hover:text-white hover:border-white/20 disabled:opacity-30 transition-all"
            >→</button>
          </div>
          {/* Mini-lista das outras */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ideiasVisiveis.map((ideia, i) => {
              if (i === slide) return null
              const cat = CAT_CONFIG[ideia.categoria]
              return (
                <button key={ideia.id} onClick={() => setSlide(i)}
                  className="text-left p-3 bg-surface border border-white/5 rounded-xl hover:border-white/10 transition-all">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span>{cat.icon}</span>
                    <span className="text-xs font-semibold text-fg truncate">{ideia.titulo}</span>
                  </div>
                  <ProgressBar value={ideia.progresso} cor={cat.cor} />
                  <p className="text-[9px] text-fg-disabled mt-1">{ideia.progresso}%</p>
                </button>
              )
            })}
          </div>
        </div>
      ) : (
        /* ── Modo Grid ── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ideiasVisiveis.map(ideia => (
            <IdeiaCard key={ideia.id} ideia={ideia}
              onEdit={i => { setEditando(i); setModalOpen(true) }}
              onProgress={atualizarProgresso}
              onStatus={atualizarStatus}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ModalIdeia
          inicial={editando ?? undefined}
          userId={userId}
          onClose={() => { setModalOpen(false); setEditando(null) }}
          onSave={carregar}
        />
      )}
    </div>
  )
}
