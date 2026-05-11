'use client'

import React, { useState, useCallback } from 'react'
import { EmptyState } from '@/components/shared/ui'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatRelative, cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

type EntradaDiario = {
  id: string
  titulo: string
  texto: string
  categoria: string
  humor: string | null
  fixada: boolean
  tipo: 'diario' | 'decisao' | 'snapshot' | 'marco' | 'espiritual'
  gratidao: string | null
  intencao: string | null
  created_at: string
}

const categoriaConfig: Record<string, { label: string; color: string }> = {
  geral:          { label: 'Geral',            color: 'text-fg-secondary border-border-subtle' },
  decisao:        { label: 'Decisão',          color: 'text-purple-400 border-purple-700' },
  aprendizado:    { label: 'Aprendizado',      color: 'text-blue-400 border-blue-700' },
  patrimonio:     { label: 'Patrimônio',       color: 'text-amber-400 border-amber-700' },
  financeiro_pf:  { label: 'Financeiro PF',   color: 'text-green-400 border-green-700' },
  projeto:        { label: 'Projeto',          color: 'text-amber-400 border-amber-700' },
  ideia:          { label: 'Ideia',            color: 'text-purple-400 border-purple-700' },
  meta:           { label: 'Meta',             color: 'text-amber-400 border-amber-700' },
  escrita:        { label: 'Escrita Livre',    color: 'text-pink-400 border-pink-700' },
}

const humorConfig: Record<string, { label: string; color: string; emoji: string }> = {
  otimo:   { label: 'Ótimo',   color: 'text-emerald-400', emoji: '😄' },
  bom:     { label: 'Bom',     color: 'text-green-400',   emoji: '🙂' },
  neutro:  { label: 'Neutro',  color: 'text-fg-secondary',    emoji: '😐' },
  ruim:    { label: 'Ruim',    color: 'text-amber-400',   emoji: '😕' },
  critico: { label: 'Crítico', color: 'text-red-400',     emoji: '😰' },
}

const tipoConfig: Record<string, { label: string; icon: string; borderColor: string }> = {
  diario:    { label: 'Diário',            icon: '📓', borderColor: 'border-zinc-600' },
  decisao:   { label: 'Decisão',           icon: '⚡', borderColor: 'border-purple-500' },
  snapshot:  { label: 'Snapshot',           icon: '📸', borderColor: 'border-blue-500' },
  marco:     { label: 'Marco / Resultado',  icon: '🏆', borderColor: 'border-amber-500' },
  espiritual:{ label: 'Esp. / Gratidão',   icon: '🙏', borderColor: 'border-emerald-500' },
}

function ModalNovaEntrada({ userId, onClose, onSave }: { userId: string; onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('diario_entradas')
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    titulo: '',
    texto: '',
    tipo: 'diario',
    categoria: 'geral',
    humor: 'neutro',
    fixada: false,
    gratidao: '',
    intencao: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    if (!form.texto.trim()) { setErro('O texto da entrada é obrigatório.'); return }
    const result = await insert({
      user_id: userId, // Certificando que o user_id seja passado se a tabela permitir
      titulo: form.titulo || null,
      texto: form.texto,
      tipo: form.tipo,
      categoria: form.categoria,
      humor: form.humor || null,
      fixada: form.fixada,
      gratidao: form.gratidao || null,
      intencao: form.intencao || null,
    })
    if (result.error) { setErro(`Erro: ${result.error}`); return }
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">📓</span>
            <h2 className="text-lg font-bold text-white">Nova Entrada</h2>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        {erro && <div className="mb-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 relative z-10">⚠️ {erro}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="label">Título (opcional)</label>
            <input className="input mt-1" value={form.titulo} onChange={e => setForm(f => ({...f, titulo: e.target.value}))} placeholder="Ex: Reflexão do dia, Decisão importante..." autoFocus />
          </div>
          <div>
            <label className="label">Texto / Conteúdo *</label>
            <textarea className="input mt-1 resize-none" rows={5} required value={form.texto}
              onChange={e => setForm(f => ({...f, texto: e.target.value}))}
              placeholder="Descreva seus pensamentos, sentimentos ou eventos do dia..." />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo} onChange={e => setForm(f => ({...f, tipo: e.target.value}))}>
                {Object.entries(tipoConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input mt-1" value={form.categoria} onChange={e => setForm(f => ({...f, categoria: e.target.value}))}>
                {Object.entries(categoriaConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Humor</label>
              <select className="input mt-1" value={form.humor} onChange={e => setForm(f => ({...f, humor: e.target.value}))}>
                {Object.entries(humorConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
          </div>
          
          {form.tipo === 'espiritual' && (
            <div className="space-y-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <p className="text-[10px] text-emerald-400 font-semibold uppercase">🙏 Desenvolvimento Espiritual</p>
              <div>
                <label className="label text-[11px]">Gratidão (Pelo que você é grato hoje?)</label>
                <textarea className="input mt-1 resize-none h-16 text-xs" value={form.gratidao}
                  onChange={e => setForm(f => ({...f, gratidao: e.target.value}))}
                  placeholder="Liste 3 motivos de gratidão..." />
              </div>
              <div>
                <label className="label text-[11px]">Intenção / Propósito</label>
                <textarea className="input mt-1 resize-none h-14 text-xs" value={form.intencao}
                  onChange={e => setForm(f => ({...f, intencao: e.target.value}))}
                  placeholder="Qual seu foco ou oração hoje?" />
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <input type="checkbox" id="fixada" className="w-4 h-4 accent-amber-500" checked={form.fixada} onChange={e => setForm(f => ({...f, fixada: e.target.checked}))} />
            <label htmlFor="fixada" className="text-sm text-fg-secondary cursor-pointer">📌 Fixar no painel</label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-white/5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? '⏳ Salvando...' : '✓ Salvar Entrada'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function TabDiario({ userId }: { userId: string }) {
  const supabase = createClient()
  const [modalAberto, setModalAberto] = useState(false)
  const [filtroCat, setFiltroCat] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [analiseIA, setAnaliseIA] = useState('')
  const [loadingAnalise, setLoadingAnalise] = useState(false)

  const { data: entradas, refetch } = useSupabaseQuery<EntradaDiario>('diario_entradas', {
    orderBy: { column: 'created_at', ascending: false },
  })

  const analisarComIA = async () => {
    if (entradas.length === 0) return
    setLoadingAnalise(true)
    setAnaliseIA('')
    try {
      const resumo = entradas.slice(0, 20).map(e =>
        `[${e.tipo}][${e.categoria}][humor:${e.humor || '?'}] ${e.titulo || ''}: ${e.texto}`
      ).join('\n---\n')

      const prompt = `Analise meu diário pessoal e espiritual. Identifique padrões de comportamento, tendências de humor e dê sugestões para meu desenvolvimento pessoal e espiritual. Aqui estão as últimas entradas:\n\n${resumo}`

      const resp = await fetch('/api/elena/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message: prompt, contexto: 'diario_pessoal' }),
      })
      
      const d = await resp.json()
      setAnaliseIA(d.response || d.message || 'Elena não conseguiu processar a análise no momento.')
    } catch (e) {
      setAnaliseIA('⚠️ Falha ao conectar com a Elena.')
    }
    setLoadingAnalise(false)
  }

  const entradasFiltradas = entradas.filter(e => {
    if (filtroCat && e.categoria !== filtroCat) return false
    if (filtroTipo && e.tipo !== filtroTipo) return false
    return true
  })

  const fixadas = entradas.filter(e => e.fixada)

  return (
    <div className="space-y-6">
      {/* Header Contextual */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            📖 Diário & Escrita
            <span className="text-[10px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-wider">Pessoal</span>
          </h2>
          <p className="text-xs text-fg-tertiary">Registre sua jornada, sentimentos e reflexões espirituais.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setFiltroTipo('espiritual'); setModalAberto(true); }} className="btn-secondary text-xs">🙏 Espiritual</button>
          <button onClick={() => setModalAberto(true)} className="btn-primary text-xs">+ Nova Entrada</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <select className="input text-xs w-auto py-1.5" value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
              <option value="">Todas Categorias</option>
              {Object.entries(categoriaConfig).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className="input text-xs w-auto py-1.5" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
              <option value="">Todos Tipos</option>
              {Object.entries(tipoConfig).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
            </select>
          </div>

          {entradasFiltradas.length === 0 ? (
            <div className="bg-surface border border-white/5 rounded-2xl p-12 text-center">
              <p className="text-4xl mb-4">✍️</p>
              <p className="text-sm font-medium text-fg mb-1">Comece a escrever sua história</p>
              <p className="text-xs text-fg-tertiary mb-6">Suas reflexões ajudam a Elena a te conhecer melhor.</p>
              <button onClick={() => setModalAberto(true)} className="btn-primary text-xs">Escrever agora</button>
            </div>
          ) : (
            <div className="space-y-4">
              {entradasFiltradas.map(entry => {
                const tipo = tipoConfig[entry.tipo] || tipoConfig.diario
                const cat = categoriaConfig[entry.categoria] || categoriaConfig.geral
                const hum = entry.humor ? humorConfig[entry.humor] : null
                return (
                  <div key={entry.id} className={cn(
                    "bg-surface border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all border-l-4",
                    tipo.borderColor.replace('border-', 'border-l-')
                  )}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{tipo.icon}</span>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase", cat.color)}>
                          {cat.label}
                        </span>
                        {hum && <span className="text-xs">{hum.emoji}</span>}
                      </div>
                      <span className="text-[10px] text-fg-disabled">{formatRelative(entry.created_at)}</span>
                    </div>
                    {entry.titulo && <h3 className="text-sm font-bold text-white mb-2">{entry.titulo}</h3>}
                    <p className="text-xs text-fg-secondary leading-relaxed whitespace-pre-wrap">{entry.texto}</p>
                    
                    {(entry.gratidao || entry.intencao) && (
                      <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {entry.gratidao && (
                          <div className="bg-emerald-500/5 p-2.5 rounded-xl border border-emerald-500/10">
                            <p className="text-[9px] text-emerald-400 font-bold uppercase mb-1">🙏 Gratidão</p>
                            <p className="text-[10px] text-fg-tertiary italic">{entry.gratidao}</p>
                          </div>
                        )}
                        {entry.intencao && (
                          <div className="bg-blue-500/5 p-2.5 rounded-xl border border-blue-500/10">
                            <p className="text-[9px] text-blue-400 font-bold uppercase mb-1">🎯 Intenção</p>
                            <p className="text-[10px] text-fg-tertiary italic">{entry.intencao}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Análise IA */}
          <div className="bg-surface border border-white/5 rounded-2xl p-5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-[60px] pointer-events-none" />
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-white">🔮 Análise Elena IA</h3>
              <button onClick={analisarComIA} disabled={loadingAnalise || entradas.length === 0} 
                className="text-[10px] bg-amber-500 text-black px-3 py-1 rounded-full font-bold hover:bg-amber-400 transition-colors disabled:opacity-50">
                {loadingAnalise ? 'Analisando...' : '✨ Analisar'}
              </button>
            </div>
            {analiseIA ? (
              <div className="text-[11px] text-fg-secondary leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5 whitespace-pre-wrap">
                {analiseIA}
              </div>
            ) : (
              <p className="text-xs text-fg-tertiary italic">
                {loadingAnalise ? 'A Elena está lendo suas memórias para identificar padrões...' : 'Deixe a Elena analisar seus registros para te dar insights sobre seu comportamento e crescimento.'}
              </p>
            )}
          </div>

          {/* Fixadas */}
          {fixadas.length > 0 && (
            <div className="bg-surface border border-white/5 rounded-2xl p-5">
              <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">📌 Fixadas</h3>
              <div className="space-y-4">
                {fixadas.map(f => (
                  <div key={f.id} className="border-b border-white/5 pb-3 last:border-0">
                    <p className="text-xs font-bold text-fg mb-1">{f.titulo || 'Sem título'}</p>
                    <p className="text-[10px] text-fg-tertiary line-clamp-3">{f.texto}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Mini Calendário / Streak (Placeholder) */}
          <div className="bg-surface border border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-white mb-2">🔥 Streak</h3>
            <p className="text-xs text-fg-tertiary">Você escreveu 3 dias seguidos esta semana. Mantenha o foco!</p>
          </div>
        </div>
      </div>

      {modalAberto && (
        <ModalNovaEntrada
          userId={userId}
          onClose={() => setModalAberto(false)}
          onSave={() => { refetch(); setModalAberto(false); }}
        />
      )}
    </div>
  )
}
