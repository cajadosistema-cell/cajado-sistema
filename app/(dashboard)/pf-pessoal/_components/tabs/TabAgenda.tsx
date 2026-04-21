'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/shared/toast'
import { cn } from '@/lib/utils'

// ── Tipos ────────────────────────────────────────────────────
type TipoEvento = 'compromisso' | 'lembrete' | 'nota' | 'tarefa' | 'aniversario' | 'reuniao'
type Prioridade = 'baixa' | 'normal' | 'alta' | 'urgente'
type StatusEvento = 'pendente' | 'concluido' | 'cancelado'

interface Evento {
  id: string
  titulo: string
  descricao?: string | null
  tipo: TipoEvento
  data_inicio: string
  data_fim?: string | null
  dia_inteiro: boolean
  status: StatusEvento
  prioridade: Prioridade
  cor: string
  origem: 'manual' | 'voz' | 'ia' | 'sistema'
}

// ── Cores e labels ────────────────────────────────────────────
const TIPO_CONFIG: Record<TipoEvento, { icon: string; cor: string; label: string }> = {
  compromisso: { icon: '📅', cor: '#3b82f6', label: 'Compromisso' },
  lembrete:    { icon: '🔔', cor: '#f5a623', label: 'Lembrete'    },
  nota:        { icon: '📝', cor: '#8b5cf6', label: 'Nota'        },
  tarefa:      { icon: '✅', cor: '#10b981', label: 'Tarefa'      },
  aniversario: { icon: '🎂', cor: '#ec4899', label: 'Aniversário' },
  reuniao:     { icon: '🤝', cor: '#06b6d4', label: 'Reunião'     },
}

const PRIORIDADE_CONFIG: Record<Prioridade, { label: string; badge: string }> = {
  baixa:   { label: 'Baixa',   badge: 'text-zinc-400 border-zinc-700 bg-zinc-700/20'       },
  normal:  { label: 'Normal',  badge: 'text-blue-400 border-blue-500/30 bg-blue-500/10'    },
  alta:    { label: 'Alta',    badge: 'text-amber-400 border-amber-500/30 bg-amber-500/10' },
  urgente: { label: 'Urgente', badge: 'text-red-400 border-red-500/30 bg-red-500/10'       },
}

// ── NLP simples: extrai data/hora + tipo + título de texto livre ─
function parseComandoVoz(texto: string): Partial<Evento> & { titulo: string } {
  const lower = texto.toLowerCase()
  const agora = new Date()

  // ── Detectar tipo
  let tipo: TipoEvento = 'compromisso'
  if (/\b(lembr|avisa|alerta)\w*/.test(lower))  tipo = 'lembrete'
  if (/\b(nota|anot|registr)\w*/.test(lower))    tipo = 'nota'
  if (/\b(tarefa|fazer|conclu)\w*/.test(lower))  tipo = 'tarefa'
  if (/\b(reuni[aã]o|call|meet)\w*/.test(lower)) tipo = 'reuniao'
  if (/\b(anivers)\w*/.test(lower))              tipo = 'aniversario'

  // ── Detectar prioridade
  let prioridade: Prioridade = 'normal'
  if (/\burgente\b/.test(lower))                prioridade = 'urgente'
  if (/\bimportante\b|\balta\b/.test(lower))    prioridade = 'alta'
  if (/\bbaixa\b|\bsem pressa\b/.test(lower))   prioridade = 'baixa'

  // ── Detectar data
  const data = new Date(agora)

  if (/\bamanhã\b/.test(lower)) {
    data.setDate(data.getDate() + 1)
  } else if (/\bdepois de amanhã\b/.test(lower)) {
    data.setDate(data.getDate() + 2)
  } else if (/\bsexta\b/.test(lower)) {
    const dia = 5; while (data.getDay() !== dia) data.setDate(data.getDate() + 1)
  } else if (/\bsábado\b|\bsabado\b/.test(lower)) {
    const dia = 6; while (data.getDay() !== dia) data.setDate(data.getDate() + 1)
  } else if (/\bdomingo\b/.test(lower)) {
    const dia = 0; while (data.getDay() !== dia) data.setDate(data.getDate() + 1)
  } else if (/\bsegunda\b/.test(lower)) {
    const dia = 1; while (data.getDay() !== dia) data.setDate(data.getDate() + 1)
  } else if (/\bterça\b|\bterca\b/.test(lower)) {
    const dia = 2; while (data.getDay() !== dia) data.setDate(data.getDate() + 1)
  } else if (/\bquarta\b/.test(lower)) {
    const dia = 3; while (data.getDay() !== dia) data.setDate(data.getDate() + 1)
  } else if (/\bquinta\b/.test(lower)) {
    const dia = 4; while (data.getDay() !== dia) data.setDate(data.getDate() + 1)
  }

  // Dia do mês: "dia 15" / "no dia 20"
  const diaMatch = lower.match(/\bdia\s+(\d{1,2})\b/)
  if (diaMatch) data.setDate(parseInt(diaMatch[1]))

  // ── Detectar hora: "às 14h", "as 14:30", "8 horas"
  const horaMatch = lower.match(/\b(?:às?|as)\s+(\d{1,2})(?:[h:](\d{2})?)?\b|\b(\d{1,2})\s*h(?:oras?)?\b/)
  if (horaMatch) {
    const hora = parseInt(horaMatch[1] ?? horaMatch[3])
    const min  = parseInt(horaMatch[2] ?? '0') || 0
    data.setHours(hora, min, 0, 0)
  } else {
    data.setHours(9, 0, 0, 0) // padrão 09:00 se não tiver hora
  }

  // ── Limpar palavras de controle e extrair título
  let titulo = texto
    .replace(/\b(agendar?|criar?|adicionar?|registrar?|anotar?|lembrar?|definir?|colocar?|colocar?|marcar?)\b/gi, '')
    .replace(/\b(amanhã|depois de amanhã|segunda|terça|terca|quarta|quinta|sexta|sábado|sabado|domingo)\b/gi, '')
    .replace(/\b(às?|as|dia|no dia|lembrete|nota|tarefa|reunião|reuniao|compromisso|urgente|importante|alta|baixa)\b/gi, '')
    .replace(/\b(?:às?|as)\s+\d{1,2}(?:[h:]\d{2}?)?\b/gi, '')
    .replace(/\b\d{1,2}\s*h(?:oras?)?\b/gi, '')
    .replace(/\bdia\s+\d{1,2}\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  if (!titulo || titulo.length < 3) titulo = texto.slice(0, 60).trim()

  return {
    titulo,
    tipo,
    prioridade,
    data_inicio: data.toISOString(),
    cor: TIPO_CONFIG[tipo].cor,
    origem: 'voz',
  }
}

// ── Modal de criação/edição ────────────────────────────────────
function ModalEvento({
  inicial,
  userId,
  onClose,
  onSave,
}: {
  inicial?: Partial<Evento> & { titulo?: string }
  userId: string
  onClose: () => void
  onSave: () => void
}) {
  const { success, error: toastError } = useToast()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const toLocalDateTime = (iso?: string) => {
    if (!iso) return ''
    return new Date(iso).toISOString().slice(0, 16)
  }

  const [form, setForm] = useState({
    titulo:      inicial?.titulo ?? '',
    descricao:   inicial?.descricao ?? '',
    tipo:        (inicial?.tipo ?? 'compromisso') as TipoEvento,
    data_inicio: toLocalDateTime(inicial?.data_inicio) || toLocalDateTime(new Date().toISOString()),
    data_fim:    toLocalDateTime(inicial?.data_fim ?? ''),
    dia_inteiro: inicial?.dia_inteiro ?? false,
    prioridade:  (inicial?.prioridade ?? 'normal') as Prioridade,
    cor:         inicial?.cor ?? '#f5a623',
    origem:      (inicial?.origem ?? 'manual') as 'manual' | 'voz' | 'ia' | 'sistema',
  })

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.titulo.trim()) return
    setLoading(true)
    try {
      const payload = {
        user_id: userId,
        titulo: form.titulo,
        descricao: form.descricao || null,
        tipo: form.tipo,
        data_inicio: new Date(form.data_inicio).toISOString(),
        data_fim: form.data_fim ? new Date(form.data_fim).toISOString() : null,
        dia_inteiro: form.dia_inteiro,
        prioridade: form.prioridade,
        cor: TIPO_CONFIG[form.tipo].cor,
        status: 'pendente',
        origem: form.origem,
      }
      if (inicial?.id) {
        await supabase.from('agenda_eventos').update(payload).eq('id', inicial.id)
      } else {
        await supabase.from('agenda_eventos').insert(payload)
      }
      success(inicial?.id ? 'Evento atualizado!' : `"${form.titulo}" agendado!`)
      onSave()
      onClose()
    } catch (err: any) {
      toastError('Erro ao salvar: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#111827] border border-white/5 rounded-2xl w-full max-w-lg shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-zinc-100 font-['Syne']">
            {inicial?.id ? '✏️ Editar Evento' : '📅 Novo Evento'}
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-2xl leading-none">×</button>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {/* Tipo de evento */}
          <div>
            <label className="label mb-2 block">Tipo</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TIPO_CONFIG) as [TipoEvento, any][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, tipo: key }))}
                  className={cn(
                    'flex flex-col items-center px-2 py-2.5 rounded-xl border text-xs font-semibold transition-all gap-1',
                    form.tipo === key
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-[#080b14]/50 border-white/5 text-zinc-400 hover:border-white/10'
                  )}
                >
                  <span className="text-lg">{cfg.icon}</span>
                  <span>{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="label">Título *</label>
            <input
              className="input mt-1 w-full"
              required
              placeholder="Ex: Reunião com cliente, Lembrar de ligar..."
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            />
          </div>

          {/* Data/Hora */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Início *</label>
              <input
                type="datetime-local"
                className="input mt-1 w-full"
                required
                value={form.data_inicio}
                onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Fim (opcional)</label>
              <input
                type="datetime-local"
                className="input mt-1 w-full"
                value={form.data_fim}
                onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
              />
            </div>
          </div>

          {/* Prioridade */}
          <div>
            <label className="label mb-2 block">Prioridade</label>
            <div className="flex gap-2">
              {(Object.entries(PRIORIDADE_CONFIG) as [Prioridade, any][]).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, prioridade: key }))}
                  className={cn(
                    'flex-1 py-1.5 rounded-lg border text-xs font-semibold transition-all',
                    form.prioridade === key ? cfg.badge : 'border-zinc-800 text-zinc-600 hover:border-zinc-700'
                  )}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="label">Descrição / Notas</label>
            <textarea
              className="input mt-1 w-full resize-none"
              rows={2}
              placeholder="Detalhes, links, observações..."
              value={form.descricao as string}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳ Salvando...' : '✓ Salvar Evento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Componente principal TabAgenda ────────────────────────────
export function TabAgenda({ userId }: { userId: string }) {
  const supabase = createClient()
  const { success, error: toastError } = useToast()

  const [eventos, setEventos]           = useState<Evento[]>([])
  const [loading, setLoading]           = useState(true)
  const [modalOpen, setModalOpen]       = useState(false)
  const [eventoEditar, setEventoEditar] = useState<Evento | null>(null)
  const [viewMode, setViewMode]         = useState<'semana' | 'lista'>('semana')
  const [vozTexto, setVozTexto]         = useState('')
  const [ouvindo, setOuvindo]           = useState(false)
  const [eventoPreview, setEventoPreview] = useState<(Partial<Evento> & { titulo: string }) | null>(null)
  const recognitionRef = useRef<any>(null)

  // ── Carregar eventos ────────────────────────────────────
  const carregar = useCallback(async () => {
    setLoading(true)
    const inicio = new Date()
    inicio.setDate(1)
    inicio.setHours(0, 0, 0, 0)
    const fim = new Date(inicio)
    fim.setMonth(fim.getMonth() + 2)

    const { data, error } = await supabase
      .from('agenda_eventos')
      .select('*')
      .eq('user_id', userId)
      .gte('data_inicio', inicio.toISOString())
      .lte('data_inicio', fim.toISOString())
      .order('data_inicio', { ascending: true })

    if (!error) setEventos((data as Evento[]) || [])
    setLoading(false)
  }, [userId, supabase])

  useEffect(() => { if (userId) carregar() }, [userId, carregar])

  // ── Concluir/Cancelar evento ────────────────────────────
  const handleStatus = async (id: string, status: StatusEvento) => {
    await supabase.from('agenda_eventos').update({ status }).eq('id', id)
    carregar()
    success(status === 'concluido' ? '✅ Marcado como concluído!' : 'Evento cancelado.')
  }

  const handleDelete = async (id: string, titulo: string) => {
    await supabase.from('agenda_eventos').delete().eq('id', id)
    carregar()
    success(`"${titulo}" excluído.`)
  }

  // ── Voz: reconhecimento ─────────────────────────────────
  const iniciarVoz = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      toastError('Reconhecimento de voz não suportado neste navegador.')
      return
    }
    const rec = new SpeechRecognition()
    rec.lang = 'pt-BR'
    rec.continuous = false
    rec.interimResults = false
    rec.onstart  = () => setOuvindo(true)
    rec.onend    = () => setOuvindo(false)
    rec.onerror  = () => { setOuvindo(false); toastError('Erro no microfone.') }
    rec.onresult = (e: any) => {
      const texto = e.results[0][0].transcript
      setVozTexto(texto)
      const parsed = parseComandoVoz(texto)
      setEventoPreview(parsed)
    }
    rec.start()
    recognitionRef.current = rec
  }

  // ── Confirmar evento de voz ─────────────────────────────
  const confirmarVoz = () => {
    if (!eventoPreview) return
    setModalOpen(true)
    setEventoEditar(null)
  }

  // ── Agrupar por dia para view semana ────────────────────
  const agora = new Date()
  const hoje = agora.toDateString()
  const proximosSete = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(agora)
    d.setDate(d.getDate() + i)
    return d
  })

  const eventosDia = (dia: Date) =>
    eventos.filter(e => new Date(e.data_inicio).toDateString() === dia.toDateString())

  const pendentes = eventos.filter(e => e.status === 'pendente')
  const concluidos = eventos.filter(e => e.status === 'concluido')

  const formatHora = (iso: string) =>
    new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const formatDia = (d: Date) =>
    d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-100">📅 Agenda Pessoal</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            {pendentes.length} compromisso{pendentes.length !== 1 ? 's' : ''} pendente{pendentes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
            <button onClick={() => setViewMode('semana')} className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-all', viewMode === 'semana' ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-500 hover:text-zinc-300')}>📆 Semana</button>
            <button onClick={() => setViewMode('lista')} className={cn('px-3 py-1 rounded-lg text-xs font-semibold transition-all', viewMode === 'lista' ? 'bg-amber-500/10 text-amber-400' : 'text-zinc-500 hover:text-zinc-300')}>📋 Lista</button>
          </div>
          <button onClick={() => { setEventoEditar(null); setEventoPreview(null); setModalOpen(true) }} className="btn-primary text-xs h-8 px-4">
            + Novo
          </button>
        </div>
      </div>

      {/* ── Comando de Voz ──────────────────────────────── */}
      <div className={cn(
        'rounded-2xl border p-4 transition-all',
        ouvindo
          ? 'bg-red-500/5 border-red-500/30'
          : 'bg-[#111827] border-white/5'
      )}>
        <p className="text-xs font-semibold text-zinc-400 mb-2">🎙️ Agendar por Voz ou Texto</p>
        <div className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder='Ex: "Reunião amanhã às 14h", "Lembrete: ligar para João na sexta"...'
            value={vozTexto}
            onChange={e => { setVozTexto(e.target.value); setEventoPreview(null) }}
            onKeyDown={e => {
              if (e.key === 'Enter' && vozTexto.trim()) {
                setEventoPreview(parseComandoVoz(vozTexto))
              }
            }}
          />
          <button
            onClick={iniciarVoz}
            disabled={ouvindo}
            className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center border transition-all shrink-0',
              ouvindo
                ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse'
                : 'bg-white/5 border-white/10 text-zinc-400 hover:text-amber-400 hover:border-amber-500/30'
            )}
            title="Falar"
          >
            {ouvindo ? '⏹' : '🎤'}
          </button>
          <button
            onClick={() => { if (vozTexto.trim()) setEventoPreview(parseComandoVoz(vozTexto)) }}
            className="btn-secondary text-xs px-3 h-10 shrink-0"
          >
            Interpretar
          </button>
        </div>

        {/* Preview do evento interpretado */}
        {eventoPreview && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="text-xs text-emerald-400 font-semibold mb-1">✨ IA interpretou:</p>
              <p className="text-sm font-bold text-zinc-100">{TIPO_CONFIG[eventoPreview.tipo!]?.icon} {eventoPreview.titulo}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {eventoPreview.tipo && TIPO_CONFIG[eventoPreview.tipo].label} ·{' '}
                {eventoPreview.data_inicio && new Date(eventoPreview.data_inicio).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} ·{' '}
                {eventoPreview.prioridade && PRIORIDADE_CONFIG[eventoPreview.prioridade].label}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={confirmarVoz} className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 rounded-lg text-xs font-semibold transition-all">
                ✓ Confirmar
              </button>
              <button onClick={() => setEventoPreview(null)} className="px-2 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs">
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── View Semana ─────────────────────────────────── */}
      {viewMode === 'semana' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {proximosSete.slice(0, 7).map((dia, idx) => {
            const evs = eventosDia(dia)
            const isHoje = dia.toDateString() === hoje
            return (
              <div
                key={idx}
                className={cn(
                  'rounded-xl border p-3 min-h-[120px]',
                  isHoje
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-[#111827] border-white/5'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <p className={cn('text-xs font-bold capitalize', isHoje ? 'text-amber-400' : 'text-zinc-400')}>
                    {isHoje ? '⭐ Hoje' : formatDia(dia)}
                  </p>
                  {!isHoje && <p className="text-[10px] text-zinc-600">{formatDia(dia)}</p>}
                </div>
                {evs.length === 0 ? (
                  <p className="text-[10px] text-zinc-700 italic">Livre</p>
                ) : (
                  <div className="space-y-1.5">
                    {evs.map(ev => (
                      <div
                        key={ev.id}
                        className={cn(
                          'group flex items-start gap-1.5 p-1.5 rounded-lg border transition-all cursor-pointer',
                          ev.status === 'concluido'
                            ? 'opacity-40 border-zinc-800 bg-zinc-900'
                            : 'border-white/5 bg-black/20 hover:border-white/10'
                        )}
                        onClick={() => { setEventoEditar(ev); setModalOpen(true) }}
                      >
                        <span className="text-sm shrink-0">{TIPO_CONFIG[ev.tipo]?.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-xs font-semibold truncate', ev.status === 'concluido' ? 'line-through text-zinc-600' : 'text-zinc-200')}>
                            {ev.titulo}
                          </p>
                          <p className="text-[9px] text-zinc-600">{formatHora(ev.data_inicio)}</p>
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleStatus(ev.id, ev.status === 'concluido' ? 'pendente' : 'concluido') }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-emerald-500 hover:text-emerald-400 shrink-0"
                          title="Concluir"
                        >✓</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── View Lista ──────────────────────────────────── */}
      {viewMode === 'lista' && (
        <div className="space-y-2">
          {loading ? (
            <p className="text-zinc-600 text-sm text-center py-8">Carregando agenda...</p>
          ) : eventos.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">📅</p>
              <p className="text-sm text-zinc-500">Nenhum evento nos próximos 60 dias</p>
              <button onClick={() => { setModalOpen(true); setEventoEditar(null) }} className="btn-primary mt-4 text-xs mx-auto block">
                + Criar primeiro evento
              </button>
            </div>
          ) : (
            eventos.map(ev => (
              <div
                key={ev.id}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border transition-all group',
                  ev.status === 'concluido'
                    ? 'opacity-50 border-zinc-800 bg-zinc-900'
                    : 'border-white/5 bg-[#111827] hover:border-white/10'
                )}
              >
                {/* Indicador de cor/tipo */}
                <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
                  <span className="text-xl">{TIPO_CONFIG[ev.tipo]?.icon}</span>
                  <div className="w-0.5 flex-1 rounded-full" style={{ backgroundColor: TIPO_CONFIG[ev.tipo]?.cor + '40', minHeight: 12 }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={cn('text-sm font-semibold', ev.status === 'concluido' ? 'line-through text-zinc-600' : 'text-zinc-100')}>
                      {ev.titulo}
                    </p>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded border', PRIORIDADE_CONFIG[ev.prioridade]?.badge)}>
                      {PRIORIDADE_CONFIG[ev.prioridade]?.label}
                    </span>
                    {ev.origem !== 'manual' && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded border border-violet-500/20 bg-violet-500/10 text-violet-400">
                        {ev.origem === 'voz' ? '🎤 Voz' : ev.origem === 'ia' ? '🤖 IA' : ev.origem}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {new Date(ev.data_inicio).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })}
                    {' às '}
                    {formatHora(ev.data_inicio)}
                    {ev.data_fim && ` → ${formatHora(ev.data_fim)}`}
                  </p>
                  {ev.descricao && <p className="text-xs text-zinc-600 mt-1 line-clamp-1">{ev.descricao}</p>}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  {ev.status !== 'concluido' && (
                    <button
                      onClick={() => handleStatus(ev.id, 'concluido')}
                      title="Concluir"
                      className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 flex items-center justify-center text-sm transition-all"
                    >✓</button>
                  )}
                  <button
                    onClick={() => { setEventoEditar(ev); setModalOpen(true) }}
                    title="Editar"
                    className="w-7 h-7 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 flex items-center justify-center text-sm transition-all"
                  >✎</button>
                  <button
                    onClick={() => handleDelete(ev.id, ev.titulo)}
                    title="Excluir"
                    className="w-7 h-7 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 flex items-center justify-center text-sm transition-all"
                  >✕</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Resumo rápido */}
      {eventos.length > 0 && (
        <div className="flex gap-3 text-xs text-zinc-600 border-t border-white/5 pt-3">
          <span>📌 {pendentes.length} pendente{pendentes.length !== 1 ? 's' : ''}</span>
          <span>✅ {concluidos.length} concluído{concluidos.length !== 1 ? 's' : ''}</span>
          <span className="ml-auto">{eventos.length} evento{eventos.length !== 1 ? 's' : ''} no período</span>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ModalEvento
          inicial={eventoEditar ?? eventoPreview ?? undefined}
          userId={userId}
          onClose={() => { setModalOpen(false); setEventoEditar(null); setEventoPreview(null) }}
          onSave={() => { carregar(); setVozTexto('') }}
        />
      )}
    </div>
  )
}
