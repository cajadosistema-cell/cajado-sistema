'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PageHeader, EmptyState } from '@/components/shared/ui'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatRelative } from '@/lib/utils'
import { cn } from '@/lib/utils'
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
  financeiro_pj:  { label: 'Financeiro PJ',   color: 'text-teal-400 border-teal-700' },
  trading:        { label: 'Trading',          color: 'text-red-400 border-red-700' },
  mercado:        { label: 'Mercado',          color: 'text-blue-400 border-blue-700' },
  projeto:        { label: 'Projeto',          color: 'text-amber-400 border-amber-700' },
  ideia:          { label: 'Ideia',            color: 'text-purple-400 border-purple-700' },
  reserva:        { label: 'Reserva',          color: 'text-green-400 border-green-700' },
  meta:           { label: 'Meta',             color: 'text-amber-400 border-amber-700' },
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

function ModalNovaEntrada({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-white/5 rounded-2xl w-full max-w-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div className="flex items-center gap-2">
            <span className="text-xl">📓</span>
            <h2 className="text-lg font-bold text-fg">Nova Entrada</h2>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        {erro && <div className="mb-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 relative z-10">⚠️ {erro}</div>}
        <form onSubmit={handleSubmit} className="space-y-4 relative z-10">
          <div>
            <label className="label">Título (opcional)</label>
            <input className="input mt-1" value={form.titulo} onChange={e => setForm(f => ({...f, titulo: e.target.value}))} placeholder="Ex: Decisão sobre expansão, Reflexão da semana..." autoFocus />
          </div>
          <div>
            <label className="label">Texto / Conteúdo *</label>
            <textarea className="input mt-1 resize-none" rows={5} required value={form.texto}
              onChange={e => setForm(f => ({...f, texto: e.target.value}))}
              placeholder="O que aconteceu? O que você aprendeu? Qual decisão foi tomada?" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className="label">Tipo de entrada</label>
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
              <label className="label">Humor do dia</label>
              <select className="input mt-1" value={form.humor} onChange={e => setForm(f => ({...f, humor: e.target.value}))}>
                {Object.entries(humorConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.emoji} {v.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="fixada" className="w-4 h-4 accent-amber-500" checked={form.fixada} onChange={e => setForm(f => ({...f, fixada: e.target.checked}))} />
            <label htmlFor="fixada" className="text-sm text-fg-secondary cursor-pointer">📌 Fixar esta entrada no painel lateral</label>
          </div>
          {/* Campos espirituais — aparecem quando tipo = espiritual */}
          {form.tipo === 'espiritual' && (
            <div className="space-y-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
              <p className="text-[10px] text-emerald-400 font-semibold uppercase">🙏 Desenvolvimento Pessoal & Espiritual</p>
              <div>
                <label className="label">3 Coisas pelas quais sou grato hoje</label>
                <textarea className="input mt-1 resize-none h-16 text-xs" value={form.gratidao}
                  onChange={e => setForm(f => ({...f, gratidao: e.target.value}))}
                  placeholder="1. ...
2. ...
3. ..." />
              </div>
              <div>
                <label className="label">Intenção / Orção do dia</label>
                <textarea className="input mt-1 resize-none h-14 text-xs" value={form.intencao}
                  onChange={e => setForm(f => ({...f, intencao: e.target.value}))}
                  placeholder="Senhor, hoje eu preciso de..." />
              </div>
            </div>
          )}
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

export default function DiarioEstrategicoClient() {
  const supabase = createClient()
  const [modalAberto, setModalAberto] = useState(false)
  const [filtroCat, setFiltroCat] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [analiseIA, setAnaliseIA] = useState('')
  const [loadingAnalise, setLoadingAnalise] = useState(false)

  const analisarComIA = async (entradas: EntradaDiario[]) => {
    if (entradas.length === 0) return
    setLoadingAnalise(true)
    setAnaliseIA('')
    try {
      const resumo = entradas.slice(0, 30).map(e =>
        `[${e.tipo}][${e.categoria}][humor:${e.humor||'?'}] ${e.titulo ? e.titulo + ': ' : ''}${e.texto.slice(0, 200)}`
      ).join('
---
')
      const { data: { user } } = await supabase.auth.getUser()
      const resp = await fetch('/api/elena/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          message: `Analise meu diário pessoal. Identifique:
1. Padrões de comportamento (positivos e negativos)
2. Tendências de humor ao longo do tempo
3. Categorias mais frequentes e o que isso revela
4. Pontos de crescimento pessoal percebidos
5. 3 sugestões práticas para desenvolvimento
6. Uma palavra de encoraja mentou espiritual

Entradas do diário:
${resumo}`,
          contexto: 'diario'
        })
      })
      if (resp.ok) {
        const d = await resp.json()
        setAnaliseIA(d.response || d.message || 'Sem resposta da IA.')
      } else {
        setAnaliseIA('⚠️ Erro ao conectar com a Elena. Tente novamente.')
      }
    } catch {
      setAnaliseIA('⚠️ Falha na conexão com a IA.')
    }
    setLoadingAnalise(false)
  }

  const { data: entradas, refetch } = useSupabaseQuery<EntradaDiario>('diario_entradas', {
    orderBy: { column: 'created_at', ascending: false },
  })

  const entradasFiltradas = entradas.filter(e => {
    if (filtroCat && e.categoria !== filtroCat) return false
    if (filtroTipo && e.tipo !== filtroTipo) return false
    return true
  })

  const fixadas = entradas.filter(e => e.fixada)
  const totalDecisoes = entradas.filter(e => e.tipo === 'decisao').length
  const totalSnapshots = entradas.filter(e => e.tipo === 'snapshot').length
  const totalMes = entradas.filter(e => {
    const mes = new Date().toISOString().slice(0, 7)
    return e.created_at?.startsWith(mes)
  }).length

  // Contagem por categoria
  const catCounts: Record<string, number> = {}
  entradas.forEach(e => { catCounts[e.categoria] = (catCounts[e.categoria] || 0) + 1 })

  return (
    <>
      <PageHeader
        title="📓 Diário Pessoal"
        subtitle="Memória acumulada · Decisões · Aprendizados · Desenvolvimento Pessoal · Espiritual"
      >
        <button onClick={() => setModalAberto(true)} className="btn-secondary text-xs">🙏 Entrada Espiritual</button>
        <button onClick={() => setModalAberto(true)} className="btn-primary">+ Nova entrada</button>
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Entradas totais',      value: entradas.length,  color: 'text-fg' },
          { label: 'Este mês',             value: totalMes,         color: 'text-amber-400' },
          { label: 'Decisões registradas', value: totalDecisoes,    color: 'text-purple-400' },
          { label: 'Snapshots gerados',    value: totalSnapshots,   color: 'text-blue-400' },
        ].map(k => (
          <div key={k.label} className="bg-surface border border-white/5 rounded-xl p-4 relative overflow-hidden">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(245,166,35,0.06),transparent_70%)]" />
            <p className="text-[10px] font-medium text-fg-secondary tracking-[0.06em] uppercase mb-2">{k.label}</p>
            <p className={`text-[22px] font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Linha do tempo principal */}
        <div className="card lg:col-span-2 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="section-title mb-0">📜 Linha do tempo</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <select className="input w-auto text-xs py-1 px-2" value={filtroCat} onChange={e => setFiltroCat(e.target.value)}>
                <option value="">Todas as categorias</option>
                {Object.entries(categoriaConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <select className="input w-auto text-xs py-1 px-2" value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                <option value="">Todos os tipos</option>
                {Object.entries(tipoConfig).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {entradasFiltradas.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              {entradas.length === 0 ? (
                <div className="text-center">
                  <p className="text-fg-tertiary text-sm mb-3">Seu diário estratégico está vazio.</p>
                  <p className="text-fg-disabled text-xs mb-4">Registre decisões, aprendizados e marcos do seu negócio.</p>
                  <button onClick={() => setModalAberto(true)} className="btn-primary text-xs">Criar primeira entrada</button>
                </div>
              ) : (
                <EmptyState message="Nenhuma entrada com esses filtros" />
              )}
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto">
              {entradasFiltradas.map(item => {
                const tipo = tipoConfig[item.tipo] || tipoConfig.diario
                const cat = categoriaConfig[item.categoria] || categoriaConfig.geral
                const h = item.humor ? humorConfig[item.humor] : null
                return (
                  <div key={item.id} className={cn(
                    'p-4 border-l-2 bg-muted/20 rounded-r-xl hover:bg-muted/40 transition-colors group',
                    tipo.borderColor
                  )}>
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <span className="text-sm">{tipo.icon}</span>
                      <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wide', cat.color)}>
                        {cat.label}
                      </span>
                      {h && <span className="text-xs">{h.emoji} <span className={cn('text-[10px]', h.color)}>{h.label}</span></span>}
                      {item.fixada && <span className="text-amber-400 text-xs">📌</span>}
                      <span className="text-[10px] text-fg-disabled ml-auto font-mono">{formatRelative(item.created_at)}</span>
                    </div>
                    {item.titulo && (
                      <h3 className="text-sm font-bold text-fg mb-1">{item.titulo}</h3>
                    )}
                    <p className="text-xs text-fg-secondary leading-relaxed whitespace-pre-wrap">{item.texto}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Painel lateral */}
        <div className="space-y-4">

          {/* Entradas fixadas */}
          <div className="card">
            <h2 className="section-title">📌 Fixadas</h2>
            {fixadas.length === 0 ? (
              <p className="text-xs text-fg-disabled">Nenhuma entrada fixada. Ao criar uma entrada, marque "Fixar" para ela aparecer aqui.</p>
            ) : (
              <div className="space-y-3">
                {fixadas.slice(0, 3).map(f => {
                  const cat = categoriaConfig[f.categoria] || categoriaConfig.geral
                  return (
                    <div key={f.id} className="border-b border-border-subtle/50 pb-2 last:border-0">
                      <p className={cn('text-xs font-medium mb-1', cat.color.split(' ')[0])}>
                        {f.titulo || categoriaConfig[f.categoria]?.label || 'Sem título'}
                      </p>
                      <p className="text-xs text-fg-tertiary line-clamp-2">{f.texto}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Resumo por categoria */}
          <div className="card">
            <h2 className="section-title">Por categoria</h2>
            {Object.keys(catCounts).length === 0 ? (
              <p className="text-xs text-fg-disabled">Sem entradas ainda.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(catCounts)
                  .sort(([,a],[,b]) => b - a)
                  .slice(0, 6)
                  .map(([k, v]) => {
                    const cfg = categoriaConfig[k] || categoriaConfig.geral
                    return (
                      <div key={k} className="flex items-center justify-between text-sm py-1 border-b border-border-subtle/50 last:border-0">
                        <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-medium border', cfg.color)}>
                          {cfg.label}
                        </span>
                        <span className="text-fg-tertiary text-xs font-mono">{v}</span>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Análise IA */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="section-title mb-0">🧠 Análise IA</h2>
              <button
                onClick={() => analisarComIA(entradas)}
                disabled={loadingAnalise || entradas.length === 0}
                className="btn-primary text-xs py-1 px-3 disabled:opacity-50"
              >
                {loadingAnalise ? '⏳ Analisando...' : '✨ Analisar'}
              </button>
            </div>
            {!analiseIA && !loadingAnalise && (
              <p className="text-xs text-fg-disabled">
                Clique em <strong className="text-amber-400">✨ Analisar</strong> para a Elena ler seus registros e identificar padrões de comportamento, humor e sugestões de crescimento pessoal.
              </p>
            )}
            {loadingAnalise && (
              <div className="flex items-center gap-2 py-4">
                <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-fg-tertiary">Elena está lendo seus registros...</p>
              </div>
            )}
            {analiseIA && (
              <div className="text-xs text-fg-secondary leading-relaxed whitespace-pre-wrap mt-2 max-h-[400px] overflow-y-auto">
                {analiseIA}
              </div>
            )}
          </div>

          {/* Gráfico de humor */}
          {entradas.length > 0 && (() => {
            const ordem = ['otimo','bom','neutro','ruim','critico']
            const humores = entradas.slice(0, 14).reverse()
            return (
              <div className="card">
                <h2 className="section-title">📈 Humor — úItimas entradas</h2>
                <div className="flex items-end gap-1 h-16 mt-2">
                  {humores.map((e, i) => {
                    const idx = ordem.indexOf(e.humor || 'neutro')
                    const h = 100 - (idx * 20)
                    const cor = idx === 0 ? '#10b981' : idx === 1 ? '#34d399' : idx === 2 ? '#6b7280' : idx === 3 ? '#f59e0b' : '#ef4444'
                    return (
                      <div key={e.id} className="flex-1 flex flex-col items-center gap-1" title={`${e.humor} — ${formatRelative(e.created_at)}`}>
                        <div className="w-full rounded-t" style={{ height: `${h}%`, backgroundColor: cor, opacity: 0.8 }} />
                        <span className="text-[8px] text-fg-disabled">{humorConfig[e.humor||'neutro']?.emoji}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {modalAberto && (
        <ModalNovaEntrada
          onClose={() => setModalAberto(false)}
          onSave={() => { refetch(); setModalAberto(false) }}
        />
      )}
    </>
  )
}
