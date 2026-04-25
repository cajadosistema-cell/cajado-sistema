'use client'

import { useState } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatRelative, cn } from '@/lib/utils'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/ui'
import { TabAutomacoes } from './_components/TabAutomacoes'

type Analise = {
  id: string
  titulo: string
  tipo: 'concorrente' | 'preco' | 'oportunidade' | 'tendencia'
  conteudo: string
  fonte: string | null
  status: 'processando' | 'concluida' | 'erro'
  ia_gerada: boolean
  created_at: string
}

type Tendencia = {
  id: string
  titulo: string
  descricao: string
  categoria: 'servico' | 'tecnologia' | 'mercado' | 'comportamento'
  status: 'monitorando' | 'ativa' | 'descartada'
  impacto_estimado: 'baixo' | 'medio' | 'alto' | null
  fontes: string[] | null
  created_at: string
}

const TIPO_CONFIG: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  concorrente:  { label: 'Concorrente',    icon: '🔍', color: 'text-red-400',    bg: 'bg-red-500/10' },
  preco:        { label: 'Preço/Mercado',  icon: '💰', color: 'text-amber-400',  bg: 'bg-amber-500/10' },
  oportunidade: { label: 'Oportunidade',   icon: '🚀', color: 'text-emerald-400',bg: 'bg-emerald-500/10' },
  tendencia:    { label: 'Tendência',      icon: '📈', color: 'text-blue-400',   bg: 'bg-blue-500/10' },
}

const CATEGORIA_CONFIG: Record<string, { icon: string; color: string }> = {
  servico:      { icon: '🔧', color: 'text-amber-400' },
  tecnologia:   { icon: '💻', color: 'text-blue-400' },
  mercado:      { icon: '📊', color: 'text-emerald-400' },
  comportamento:{ icon: '🧠', color: 'text-purple-400' },
}

const IMPACTO_STYLE: Record<string, string> = {
  alto:  'text-red-400 bg-red-500/10',
  medio: 'text-amber-400 bg-amber-500/10',
  baixo: 'text-fg-secondary bg-muted',
}

function ModalAnalise({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('analises_mercado')
  const [form, setForm] = useState({
    titulo: '', tipo: 'oportunidade' as Analise['tipo'],
    conteudo: '', fonte: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await insert({
      titulo: form.titulo, tipo: form.tipo,
      conteudo: form.conteudo, fonte: form.fonte || null,
      status: 'concluida', ia_gerada: false,
    })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">Nova Análise</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Título *</label>
              <input className="input mt-1" required value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Analise['tipo'] }))}>
                <option value="oportunidade">🚀 Oportunidade</option>
                <option value="tendencia">📈 Tendência</option>
                <option value="concorrente">🔍 Concorrente</option>
                <option value="preco">💰 Preço/Mercado</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Análise / Insights *</label>
            <textarea className="input mt-1 resize-none" rows={5} required value={form.conteudo}
              onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
              placeholder="Descreva sua análise, o que você observou, impacto no negócio..." />
          </div>
          <div>
            <label className="label">Fonte</label>
            <input className="input mt-1" value={form.fonte}
              onChange={e => setForm(f => ({ ...f, fonte: e.target.value }))}
              placeholder="Ex: Google, LinkedIn, cliente X..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar análise'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalAnaliseIA({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading: dbLoading } = useSupabaseMutation('analises_mercado')
  const [topic, setTopic] = useState('')
  const [tipo, setTipo] = useState<Analise['tipo']>('oportunidade')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Gere uma análise de mercado curta, direta e técnica sobre o tópico "${topic}". 
Foque em impacto nos negócios, oportunidades ocultas ou ameaças de concorrentes. Formate como um parágrafo denso e profissional.`,
          systemInstruction: 'Você é um estrategista sênior de inteligência competitiva e negócios B2B/B2C.',
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao gerar análise')

      await insert({
        titulo: `Análise IA: ${topic.substring(0, 30)}...`,
        tipo: tipo,
        conteudo: data.result,
        fonte: 'OpenRouter / LLM',
        status: 'concluida',
        ia_gerada: true,
      })
      onSave()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-purple-500/30 rounded-2xl w-full max-w-lg p-6 shadow-[0_0_40px_rgba(168,85,247,0.15)] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-blue-500"></div>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="text-xl">✨</span>
            <h2 className="text-base font-semibold text-fg">Gerar Análise com Inteligência Artificial</h2>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        
        {error && <div className="mb-4 text-xs text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">{error}</div>}

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="label">Sobre o que você quer saber? *</label>
            <input className="input mt-1 border-purple-500/30 focus:border-purple-500 focus:ring-purple-500/20" 
              required value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Ex: Impacto da nova política fiscal no setor de serviços..." />
          </div>
          <div>
            <label className="label">Classificação sugerida</label>
            <select className="input mt-1" value={tipo} onChange={e => setTipo(e.target.value as Analise['tipo'])}>
              <option value="oportunidade">🚀 Oportunidade</option>
              <option value="tendencia">📈 Tendência</option>
              <option value="concorrente">🔍 Concorrente</option>
              <option value="preco">💰 Preço/Mercado</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-bold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all shadow-lg shadow-purple-500/25" disabled={loading || dbLoading}>
              {loading || dbLoading ? '⏳ Processando Analista IA...' : '⚙️ Gerar Insight'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalTendencia({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('tendencias')
  const [form, setForm] = useState({
    titulo: '', descricao: '',
    categoria: 'mercado' as Tendencia['categoria'],
    impacto_estimado: 'medio' as 'baixo' | 'medio' | 'alto',
    fontes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await insert({
      titulo: form.titulo, descricao: form.descricao,
      categoria: form.categoria,
      status: 'monitorando',
      impacto_estimado: form.impacto_estimado,
      fontes: form.fontes ? form.fontes.split(',').map(s => s.trim()) : null,
    })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">Nova Tendência</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Título *</label>
            <input className="input mt-1" required value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Ex: IA substituindo porteiros, expansão de câmeras IP..." />
          </div>
          <div>
            <label className="label">Descrição *</label>
            <textarea className="input mt-1 resize-none" rows={3} required value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="O que é essa tendência? Como ela afeta seu mercado?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoria</label>
              <select className="input mt-1" value={form.categoria}
                onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Tendencia['categoria'] }))}>
                <option value="servico">🔧 Serviço</option>
                <option value="tecnologia">💻 Tecnologia</option>
                <option value="mercado">📊 Mercado</option>
                <option value="comportamento">🧠 Comportamento</option>
              </select>
            </div>
            <div>
              <label className="label">Impacto estimado</label>
              <select className="input mt-1" value={form.impacto_estimado}
                onChange={e => setForm(f => ({ ...f, impacto_estimado: e.target.value as 'baixo' | 'medio' | 'alto' }))}>
                <option value="alto">🔴 Alto</option>
                <option value="medio">🟡 Médio</option>
                <option value="baixo">🟢 Baixo</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Fontes (separadas por vírgula)</label>
            <input className="input mt-1" value={form.fontes}
              onChange={e => setForm(f => ({ ...f, fontes: e.target.value }))}
              placeholder="Google Trends, LinkedIn, cliente x..." />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Monitorar tendência'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InteligenciaClient() {
  const [tab, setTab] = useState<'analises' | 'tendencias' | 'assistente' | 'automacoes'>('analises')
  const [modalAnalise, setModalAnalise] = useState(false)
  const [modalAnaliseIA, setModalAnaliseIA] = useState(false)
  const [modalTendencia, setModalTendencia] = useState(false)

  // Chatbot state
  // Chatbot state
  const [chatMessages, setChatMessages] = useState<{role: 'user'|'vivi', text: string}[]>([
     { role: 'vivi', text: 'Olá! Sou a Vivi, assistente do Sistema Cajado v2.0.\n\nFui treinada com o nosso novo manual completo! Se tiver dúvidas sobre o CRM, Financeiro, Pós-venda ou qualquer módulo, é só perguntar!' }
  ])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || chatLoading) return
    
    const userText = chatInput.trim()
    setChatInput('')
    setChatMessages(prev => [...prev, { role: 'user', text: userText }])
    setChatLoading(true)
    
    try {
      const historyContext = chatMessages.slice(-8).map(m => `${m.role === 'user' ? 'Usuário' : 'Vivi'}: ${m.text}`).join('\n')
      
      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userText,
          context: `Histórico da conversa:\n${historyContext}`,
          systemInstruction: `Você é a VIVI, Assistente de IA do Sistema Cajado v2.0.
Sua missão é ajudar os funcionários avaliando as regras base e informando como usar a plataforma.

REGRAS:
1. Seja direta, paciente, amigável e profissional.
2. Explique sempre em etapas numeradas curtas.
3. Não invente telas, botões ou módulos. Se não souber dizer, fale: "Recomendo que você fale com o administrador ou gestor do sistema para tirar essa dúvida."
4. Use emojis simples para organizar o texto.

MAPA DE MÓDULOS DO SISTEMA:
- CRM Cajado: Pipeline de vendas, gerenciar leads.
- Vendas / OS: Ordens de serviço e faturamento concluído.
- Parceiros: Comissões automáticas.
- Pós-venda: Disparos de automação de satisfação via WhatsApp.
- Financeiro: Fluxo de caixa, Receitas, Despesas, DRE, saldo de contas.
- Patrimônio: Bens materiais, imóveis, depreciação, ROI.
- Investimentos: Ações, CDBs, Carteira da empresa.
- Trader: Day trade, Swing trade, Win rate, Gain/Loss.
- Equipe: Ponto (check-in/out), Tarefas (a fazer/em andamento/concluída), Ocorrências, Pessoal.
- Segurança WA: Números de WhatsApp, evitar bloqueio.
- Inbox: Atendimento ao cliente unificado.
- Diário Estratégico: Memória corporativa, decisões.
- Inteligência: Análise de concorrentes, IA insights, tendências.
- Organização: Projetos e banco de ideias.

COMO OPERAR:
- Cadastrar novo Lead: Ir no [CRM Cajado] e clicar no botao verde "+ Lead".
- Calcular comissões de parceiro: Isso é automático. Quando um Lead possui parceiro vinculado e o status dele for movido para "Cliente Ativo", a comissão é validada e calculada, subindo os indicadores do Parceiro.
- Agradecimento: Disparos são no [Pós-venda].
- Registrar pagamentos e saídas: Ir no módulo [Financeiro] -> clicar em "+ Lançamento" -> Selecionar Despesa ou Receita.
- Criar OS após venda: [Vendas / OS] -> "+ Nova OS / Venda".
- Marcar o ponto ou bater cartao: Ir em [Equipe] -> aba Ponto -> clicar em "Registrar Entrada/Saída".
- Criar tarefas para o time: Ir em [Equipe] -> aba Tarefas.
- Pausar um atendimento de BOT para fazer na mão: Ir no módulo [Inbox], selecionar a conversa do cliente, e clicar no botão de "Pausar Vivi" na conversa.
- Mudar regras de acesso dos colaboradores: Vá em [Configurações] / [Organização Geral] e edite as restrições.`
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      setChatMessages(prev => [...prev, { role: 'vivi', text: data.result }])
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'vivi', text: `Desculpe, deu um erro: ${err.message}` }])
    } finally {
      setChatLoading(false)
    }
  }

  const { data: analises, refetch: refetchAnalises } = useSupabaseQuery<Analise>('analises_mercado', {
    orderBy: { column: 'created_at', ascending: false },
  })
  const { data: tendencias, refetch: refetchTendencias } = useSupabaseQuery<Tendencia>('tendencias', {
    orderBy: { column: 'created_at', ascending: false },
  })
  const { update: updateTendencia } = useSupabaseMutation('tendencias')

  // Métricas
  const ativas = tendencias.filter(t => t.status === 'ativa').length
  const monitorando = tendencias.filter(t => t.status === 'monitorando').length
  const altoImpacto = tendencias.filter(t => t.impacto_estimado === 'alto' && t.status !== 'descartada').length
  const oportunidades = analises.filter(a => a.tipo === 'oportunidade').length

  const TABS = [
    { key: 'analises', label: '🔍 Análises' },
    { key: 'tendencias', label: '📈 Tendências' },
    { key: 'assistente', label: '🤖 Assistente (Treinamento)' },
    { key: 'automacoes', label: '⚙️ Relatórios & Alertas' },
  ] as const

  return (
    <>
      <PageHeader title="Inteligência" subtitle="Análise de mercado · Tendências · Oportunidades">
        {tab === 'analises' && (
          <div className="flex gap-2">
            <button onClick={() => setModalAnaliseIA(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 shadow-lg shadow-purple-500/20 transition-opacity">
              ✨ Análise IA
            </button>
            <button onClick={() => setModalAnalise(true)} className="btn-primary">+ Análise Manual</button>
          </div>
        )}
        {tab === 'tendencias' && (
          <button onClick={() => setModalTendencia(true)} className="btn-primary">+ Tendência</button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Oportunidades</p>
          <p className="metric-value text-emerald-400">{oportunidades}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Tendências ativas</p>
          <p className="metric-value text-blue-400">{ativas}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Monitorando</p>
          <p className="metric-value text-amber-400">{monitorando}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Alto impacto</p>
          <p className={cn('metric-value', altoImpacto > 0 ? 'text-red-400' : 'text-fg')}>{altoImpacto}</p>
        </div>
      </div>

      {/* Alerta de tendências de alto impacto */}
      {altoImpacto > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
          <span className="text-red-400 text-xl">🚨</span>
          <div>
            <p className="text-sm font-semibold text-red-400">{altoImpacto} tendência(s) de alto impacto</p>
            <p className="text-xs text-red-400/70">Revise e planeje ações para essas tendências urgentemente.</p>
          </div>
        </div>
      )}

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

      {/* Análises */}
      {tab === 'analises' && (
        <div className="space-y-3">
          {analises.length === 0 ? (
            <div className="card"><EmptyState message="Nenhuma análise registrada ainda" /></div>
          ) : (
            analises.map(a => {
              const cfg = TIPO_CONFIG[a.tipo]
              return (
                <div key={a.id} className={cn('card border-l-4', `border-l-[${cfg.color.replace('text-', '')}]`)}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cfg.icon}</span>
                      <div>
                        <p className="text-sm font-semibold text-fg">{a.titulo}</p>
                        <span className={cn('text-[10px] font-medium', cfg.color)}>{cfg.label}</span>
                        {a.ia_gerada && <span className="text-[10px] text-purple-400 ml-2">✨ IA</span>}
                      </div>
                    </div>
                    <span className="text-xs text-fg-disabled shrink-0">{formatRelative(a.created_at)}</span>
                  </div>
                  <p className="text-sm text-fg-secondary leading-relaxed">{a.conteudo}</p>
                  {a.fonte && (
                    <p className="text-[10px] text-fg-disabled mt-2">📎 Fonte: {a.fonte}</p>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Tendências */}
      {tab === 'tendencias' && (
        <div className="space-y-3">
          {/* Alto impacto primeiro */}
          {['ativa', 'monitorando', 'descartada'].map(statusGrupo => {
            const grupo = tendencias.filter(t => t.status === statusGrupo)
            if (grupo.length === 0) return null
            return (
              <div key={statusGrupo}>
                <p className="text-xs text-fg-disabled uppercase tracking-widest mb-2 px-1">
                  {statusGrupo === 'ativa' ? '🟢 Ativas' : statusGrupo === 'monitorando' ? '🟡 Monitorando' : '⚫ Descartadas'}
                </p>
                <div className="space-y-2">
                  {grupo.map(t => {
                    const catCfg = CATEGORIA_CONFIG[t.categoria]
                    return (
                      <div key={t.id} className={cn('card', statusGrupo === 'descartada' ? 'opacity-50' : '')}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{catCfg.icon}</span>
                            <div>
                              <p className="text-sm font-semibold text-fg">{t.titulo}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className={cn('text-[10px] font-medium capitalize', catCfg.color)}>{t.categoria}</span>
                                {t.impacto_estimado && (
                                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize', IMPACTO_STYLE[t.impacto_estimado])}>
                                    ↑ {t.impacto_estimado}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {statusGrupo !== 'ativa' && (
                              <button
                                onClick={() => { updateTendencia(t.id, { status: 'ativa' }); refetchTendencias() }}
                                className="text-[10px] text-emerald-400 hover:text-emerald-300 px-2 py-1 rounded border border-emerald-500/30 transition-colors"
                              >
                                Ativar
                              </button>
                            )}
                            {statusGrupo !== 'descartada' && (
                              <button
                                onClick={() => { updateTendencia(t.id, { status: 'descartada' }); refetchTendencias() }}
                                className="text-[10px] text-fg-disabled hover:text-fg-secondary px-2 py-1 rounded border border-border-subtle transition-colors"
                              >
                                Descartar
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-fg-secondary leading-relaxed">{t.descricao}</p>
                        {t.fontes && t.fontes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {t.fontes.map(f => (
                              <span key={f} className="text-[10px] bg-muted text-fg-tertiary px-1.5 py-0.5 rounded">📎 {f}</span>
                            ))}
                          </div>
                        )}
                        <p className="text-[10px] text-zinc-700 mt-2">{formatRelative(t.created_at)}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
          {tendencias.length === 0 && (
            <div className="card"><EmptyState message="Nenhuma tendência monitorada ainda" /></div>
          )}
        </div>
      )}

      {/* Assistente IA (Chatbot de Treinamento) */}
      {tab === 'assistente' && (
        <div className="flex flex-col h-[550px] bg-page border border-border-subtle rounded-2xl overflow-hidden shadow-2xl relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-600 to-indigo-500 z-10"></div>
          <div className="bg-sidebar px-5 py-4 border-b border-border-subtle flex items-center justify-between z-10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-600/20 text-purple-400 rounded-full flex items-center justify-center text-xl shadow-[0_0_15px_rgba(168,85,247,0.3)]">✨</div>
              <div>
                <h3 className="text-sm font-bold text-fg">Vivi Assistente</h3>
                <p className="text-[11px] text-fg-tertiary">I.A. treinada no Manual do Sistema Cajado</p>
              </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-5 py-3 text-[14px] leading-relaxed shadow-md",
                  msg.role === 'user' 
                    ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-br-sm" 
                    : "bg-muted text-fg-secondary border border-border-subtle rounded-bl-sm"
                )}>
                  {msg.role === 'vivi' && <div className="text-[10px] text-purple-400 font-bold mb-1 tracking-wider">VIVI</div>}
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-muted text-fg-secondary border border-border-subtle rounded-2xl rounded-bl-sm px-5 py-3 text-sm flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                  <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                </div>
              </div>
            )}
          </div>
          
          <form onSubmit={handleSendChatMessage} className="p-4 bg-sidebar border-t border-border-subtle flex gap-2">
            <input 
              className="flex-1 bg-page border border-border-subtle rounded-xl px-4 py-3 text-fg text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 shadow-inner"
              placeholder="Pergunte como usar um módulo..."
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              disabled={chatLoading}
            />
            <button 
              type="submit" 
              disabled={chatLoading || !chatInput.trim()}
              className="bg-purple-600 hover:bg-purple-500 text-white px-6 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-purple-900/50"
            >
              Enviar <span className="opacity-70 text-xs">🚀</span>
            </button>
          </form>
        </div>
      )}
      {tab === 'automacoes' && <TabAutomacoes />}

      {modalAnalise && <ModalAnalise onClose={() => setModalAnalise(false)} onSave={refetchAnalises} />}
      {modalAnaliseIA && <ModalAnaliseIA onClose={() => setModalAnaliseIA(false)} onSave={refetchAnalises} />}
      {modalTendencia && <ModalTendencia onClose={() => setModalTendencia(false)} onSave={refetchTendencias} />}
    </>
  )
}
