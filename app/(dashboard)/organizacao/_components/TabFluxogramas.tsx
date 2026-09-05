'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEmpresaId } from '@/lib/hooks/useEmpresaId'
import { EmptyState } from '@/components/shared/ui'
import { cn } from '@/lib/utils'

// ── Tipos de Nós e Conexões ──────────────────────────────────────
export type TipoNo = 'inicio' | 'processo' | 'decisao' | 'documento' | 'fim'

export interface NoFluxo {
  id: string
  tipo: TipoNo
  titulo: string
  descricao?: string
  responsavel?: string
  checklist?: string[]
  // Posição no grid do fluxograma
  x: number // px
  y: number // px
  largura?: number
  altura?: number
}

export interface ConexaoFluxo {
  id: string
  deNoId: string
  paraNoId: string
  rotulo?: string // ex: 'Sim', 'Não', 'Aprovado'
  tipoLinha?: 'sucesso' | 'erro' | 'padrao'
}

export interface Fluxograma {
  id: string
  empresa_id?: string
  titulo: string
  categoria: string // 'Empresa' | 'Programação' | 'Financeiro' | 'Vendas' | 'Operações' | string
  descricao?: string
  versao?: string
  responsavel?: string
  tags?: string[]
  nos: NoFluxo[]
  conexoes: ConexaoFluxo[]
  created_at?: string
  updated_at?: string
}

// ── Categorias Padrão ───────────────────────────────────────────
const CATEGORIAS_PADRAO = [
  { id: 'todas', label: 'Todos os Fluxos', icon: '🌐' },
  { id: 'Empresa', label: 'Empresa', icon: '🏢' },
  { id: 'Programação', label: 'Programação', icon: '💻' },
  { id: 'Financeiro', label: 'Financeiro', icon: '💰' },
  { id: 'Vendas', label: 'Vendas & CRM', icon: '📦' },
  { id: 'Operações', label: 'Operações & POPs', icon: '⚙️' },
]

// ── Templates Pré-carregados (Incluindo o modelo do Sr. Max) ───
const TEMPLATES_PADRAO: Fluxograma[] = [
  {
    id: 'tpl-nota-fiscal',
    titulo: 'Conferência e Pagamento de Nota Fiscal',
    categoria: 'Empresa',
    descricao: 'Processo de validação de notas fiscais de fornecedores, checagem de itens e autorização para liquidação financeira.',
    versao: '1.2',
    responsavel: 'Financeiro / Administrativo',
    tags: ['Nota Fiscal', 'Fornecedores', 'Contas a Pagar', 'Compliance'],
    nos: [
      {
        id: 'no-1',
        tipo: 'inicio',
        titulo: 'Início',
        descricao: 'Entrada da nota fiscal enviada pelo fornecedor por e-mail ou WhatsApp.',
        x: 350,
        y: 40,
        largura: 200,
        altura: 52,
      },
      {
        id: 'no-2',
        tipo: 'processo',
        titulo: 'Receber nota fiscal do fornecedor',
        descricao: 'Verificar CNPJ emissor, data de emissão, descrição dos serviços/produtos e valor total.',
        responsavel: 'Administrativo',
        checklist: [
          'Conferir se o CNPJ é do emissor contratado',
          'Checar se o valor bate com a Ordem de Compra/Serviço',
          'Verificar se os dados bancários/PIX estão descritos',
        ],
        x: 330,
        y: 150,
        largura: 240,
        altura: 74,
      },
      {
        id: 'no-3',
        tipo: 'decisao',
        titulo: 'As informações estão corretas?',
        descricao: 'Ponto de decisão: se houver divergência de valor ou dados, recusa e pede nova emissão.',
        responsavel: 'Conferente',
        x: 320,
        y: 290,
        largura: 260,
        altura: 110,
      },
      {
        id: 'no-4',
        tipo: 'processo',
        titulo: 'Solicitar reemissão',
        descricao: 'Notificar o fornecedor imediatamente apontando a inconsistência e aguardar a nova nota.',
        responsavel: 'Administrativo',
        checklist: [
          'Enviar mensagem detalhando o erro',
          'Acompanhar prazo de cancelamento da NF original',
        ],
        x: 60,
        y: 310,
        largura: 190,
        altura: 70,
      },
      {
        id: 'no-5',
        tipo: 'processo',
        titulo: 'Realizar pagamento',
        descricao: 'Lançar no contas a pagar do Cajado Sistema, agendar ou efetuar PIX/boleto com comprovante.',
        responsavel: 'Financeiro',
        checklist: [
          'Registrar despesa no módulo Financeiro',
          'Anexar comprovante de transferência',
          'Enviar comprovante para o fornecedor',
        ],
        x: 650,
        y: 310,
        largura: 210,
        altura: 70,
      },
      {
        id: 'no-6',
        tipo: 'fim',
        titulo: 'Fim',
        descricao: 'Processo concluído com nota arquivada e despesa conciliada no sistema.',
        x: 675,
        y: 440,
        largura: 160,
        altura: 52,
      },
    ],
    conexoes: [
      { id: 'c-1', deNoId: 'no-1', paraNoId: 'no-2', tipoLinha: 'padrao' },
      { id: 'c-2', deNoId: 'no-2', paraNoId: 'no-3', tipoLinha: 'padrao' },
      { id: 'c-3', deNoId: 'no-3', paraNoId: 'no-4', rotulo: 'Não', tipoLinha: 'erro' },
      { id: 'c-4', deNoId: 'no-4', paraNoId: 'no-2', rotulo: 'Retorno', tipoLinha: 'padrao' },
      { id: 'c-5', deNoId: 'no-3', paraNoId: 'no-5', rotulo: 'Sim', tipoLinha: 'sucesso' },
      { id: 'c-6', deNoId: 'no-5', paraNoId: 'no-6', tipoLinha: 'padrao' },
    ],
  },
  {
    id: 'tpl-deploy-ti',
    titulo: 'Deploy Seguro & Atualização em Produção',
    categoria: 'Programação',
    descricao: 'Rito de validação de testes automatizados, revisão de migrações e publicação no servidor sem downtime.',
    versao: '2.0',
    responsavel: 'Desenvolvimento & DevOps',
    tags: ['Git', 'Vitest', 'Vercel', 'CI/CD'],
    nos: [
      { id: 'p-1', tipo: 'inicio', titulo: 'Início (Pull Request)', x: 350, y: 40, largura: 220, altura: 50 },
      { id: 'p-2', tipo: 'processo', titulo: 'Executar Suíte de Testes (Vitest)', x: 320, y: 140, largura: 280, altura: 70 },
      { id: 'p-3', tipo: 'decisao', titulo: 'Todos os testes passaram?', x: 330, y: 270, largura: 260, altura: 110 },
      { id: 'p-4', tipo: 'processo', titulo: 'Corrigir falhas & Regressões', x: 70, y: 290, largura: 200, altura: 70 },
      { id: 'p-5', tipo: 'processo', titulo: 'Publicar em Produção (Main)', x: 650, y: 290, largura: 220, altura: 70 },
      { id: 'p-6', tipo: 'fim', titulo: 'Fim (Versão Estável)', x: 670, y: 420, largura: 180, altura: 50 },
    ],
    conexoes: [
      { id: 'cp-1', deNoId: 'p-1', paraNoId: 'p-2' },
      { id: 'cp-2', deNoId: 'p-2', paraNoId: 'p-3' },
      { id: 'cp-3', deNoId: 'p-3', paraNoId: 'p-4', rotulo: 'Não', tipoLinha: 'erro' },
      { id: 'cp-4', deNoId: 'p-4', paraNoId: 'p-2', rotulo: 'Re-testar' },
      { id: 'cp-5', deNoId: 'p-3', paraNoId: 'p-5', rotulo: 'Sim', tipoLinha: 'sucesso' },
      { id: 'cp-6', deNoId: 'p-5', paraNoId: 'p-6' },
    ],
  },
  {
    id: 'tpl-vendas-crm',
    titulo: 'Qualificação de Lead & Fechamento',
    categoria: 'Vendas',
    descricao: 'Triagem de novos leads no WhatsApp pela Elena, agendamento de apresentação e envio de proposta.',
    versao: '1.0',
    responsavel: 'Equipe Comercial',
    tags: ['Leads', 'CRM', 'WhatsApp', 'Contrato'],
    nos: [
      { id: 'v-1', tipo: 'inicio', titulo: 'Novo Lead no WhatsApp', x: 350, y: 40, largura: 220, altura: 50 },
      { id: 'v-2', tipo: 'processo', titulo: 'Atendimento & Triagem pela IA Elena', x: 310, y: 140, largura: 300, altura: 70 },
      { id: 'v-3', tipo: 'decisao', titulo: 'Perfil de compra qualificado?', x: 330, y: 270, largura: 260, altura: 110 },
      { id: 'v-4', tipo: 'processo', titulo: 'Nutrir com Conteúdo / Remarketing', x: 50, y: 290, largura: 220, altura: 70 },
      { id: 'v-5', tipo: 'processo', titulo: 'Agendar Reunião & Apresentar Proposta', x: 650, y: 290, largura: 250, altura: 70 },
      { id: 'v-6', tipo: 'fim', titulo: 'Fechamento & Contrato Assinado', x: 670, y: 420, largura: 210, altura: 50 },
    ],
    conexoes: [
      { id: 'cv-1', deNoId: 'v-1', paraNoId: 'v-2' },
      { id: 'cv-2', deNoId: 'v-2', paraNoId: 'v-3' },
      { id: 'cv-3', deNoId: 'v-3', paraNoId: 'v-4', rotulo: 'Não', tipoLinha: 'erro' },
      { id: 'cv-4', deNoId: 'v-3', paraNoId: 'v-5', rotulo: 'Sim', tipoLinha: 'sucesso' },
      { id: 'cv-5', deNoId: 'v-5', paraNoId: 'v-6' },
    ],
  },
]

export function TabFluxogramas() {
  const supabase = createClient()
  const { empresaId } = useEmpresaId()

  const [categoriaAtiva, setCategoriaAtiva] = useState<string>('todas')
  const [fluxos, setFluxos] = useState<Fluxograma[]>(TEMPLATES_PADRAO)
  const [fluxoSelecionadoId, setFluxoSelecionadoId] = useState<string>(TEMPLATES_PADRAO[0].id)
  const [busca, setBusca] = useState('')

  // Visualização e Interatividade
  const [zoom, setZoom] = useState<number>(1)
  const [noSelecionadoId, setNoSelecionadoId] = useState<string | null>(null)
  const [modoExecucao, setModoExecucao] = useState(false)
  const [noAtualExecucaoId, setNoAtualExecucaoId] = useState<string | null>(null)
  const [historicoExecucao, setHistoricoExecucao] = useState<string[]>([])

  // Modal de Edição / Criação
  const [modalNovoFluxo, setModalNovoFluxo] = useState(false)
  const [modalEditarNo, setModalEditarNo] = useState(false)
  const [formFluxo, setFormFluxo] = useState({
    titulo: '',
    categoria: 'Empresa',
    descricao: '',
    responsavel: '',
  })

  // Carregar do Supabase ou LocalStorage
  useEffect(() => {
    async function carregarFluxos() {
      try {
        if (empresaId) {
          const { data, error } = await (supabase.from('fluxogramas_processos') as any)
            .select('*')
            .eq('empresa_id', empresaId)
            .order('created_at', { ascending: false })

          if (!error && data && data.length > 0) {
            setFluxos([...data, ...TEMPLATES_PADRAO.filter(t => !data.some((d: any) => d.titulo === t.titulo))])
            return
          }
        }
      } catch (err) {
        console.warn('Fallback para templates locais de fluxograma:', err)
      }

      // Fallback localStorage
      const salvoLocal = typeof window !== 'undefined' ? localStorage.getItem('cajado_fluxogramas_custom') : null
      if (salvoLocal) {
        try {
          const custom = JSON.parse(salvoLocal)
          setFluxos([...custom, ...TEMPLATES_PADRAO])
        } catch {}
      }
    }
    carregarFluxos()
  }, [empresaId])

  // Fluxo em visualização
  const fluxoAtivo = useMemo(() => {
    return fluxos.find(f => f.id === fluxoSelecionadoId) || fluxos[0] || TEMPLATES_PADRAO[0]
  }, [fluxos, fluxoSelecionadoId])

  // Nós e conexões do fluxo ativo
  const noSelecionado = useMemo(() => {
    if (!fluxoAtivo || !noSelecionadoId) return null
    return fluxoAtivo.nos.find(n => n.id === noSelecionadoId) || null
  }, [fluxoAtivo, noSelecionadoId])

  // Filtragem por categoria e busca
  const fluxosFiltrados = useMemo(() => {
    return fluxos.filter(f => {
      const matchCat = categoriaAtiva === 'todas' || f.categoria.toLowerCase() === categoriaAtiva.toLowerCase()
      const matchBusca = !busca || f.titulo.toLowerCase().includes(busca.toLowerCase()) || (f.descricao && f.descricao.toLowerCase().includes(busca.toLowerCase()))
      return matchCat && matchBusca
    })
  }, [fluxos, categoriaAtiva, busca])

  // Iniciar Execução Passo a Passo
  const iniciarExecucao = () => {
    if (!fluxoAtivo) return
    const noInicio = fluxoAtivo.nos.find(n => n.tipo === 'inicio') || fluxoAtivo.nos[0]
    if (noInicio) {
      setModoExecucao(true)
      setNoAtualExecucaoId(noInicio.id)
      setHistoricoExecucao([noInicio.id])
      setNoSelecionadoId(noInicio.id)
    }
  }

  // Avançar no modo de execução
  const avancarExecucao = (paraNoId: string) => {
    setNoAtualExecucaoId(paraNoId)
    setHistoricoExecucao(prev => [...prev, paraNoId])
    setNoSelecionadoId(paraNoId)
  }

  // Salvar novo fluxograma
  const handleSalvarNovoFluxo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formFluxo.titulo.trim()) return

    const novoFluxo: Fluxograma = {
      id: `fluxo-${Date.now()}`,
      empresa_id: empresaId || undefined,
      titulo: formFluxo.titulo.trim(),
      categoria: formFluxo.categoria,
      descricao: formFluxo.descricao.trim() || undefined,
      responsavel: formFluxo.responsavel.trim() || undefined,
      versao: '1.0',
      nos: [
        { id: 'n-1', tipo: 'inicio', titulo: 'Início', x: 350, y: 40, largura: 180, altura: 50 },
        { id: 'n-2', tipo: 'processo', titulo: 'Etapa 1: Executar Ação', x: 330, y: 150, largura: 220, altura: 70 },
        { id: 'n-3', tipo: 'decisao', titulo: 'Validação Conforme?', x: 320, y: 280, largura: 240, altura: 100 },
        { id: 'n-4', tipo: 'fim', titulo: 'Fim do Processo', x: 350, y: 440, largura: 180, altura: 50 },
      ],
      conexoes: [
        { id: 'c-1', deNoId: 'n-1', paraNoId: 'n-2' },
        { id: 'c-2', deNoId: 'n-2', paraNoId: 'n-3' },
        { id: 'c-3', deNoId: 'n-3', paraNoId: 'n-4', rotulo: 'Sim', tipoLinha: 'sucesso' },
      ],
      created_at: new Date().toISOString(),
    }

    // Salva no banco se possível
    try {
      if (empresaId) {
        await (supabase.from('fluxogramas_processos') as any).insert({
          empresa_id: empresaId,
          titulo: novoFluxo.titulo,
          categoria: novoFluxo.categoria,
          descricao: novoFluxo.descricao,
          responsavel: novoFluxo.responsavel,
          nos: novoFluxo.nos,
          conexoes: novoFluxo.conexoes,
        })
      }
    } catch {}

    // Atualiza estado local
    const novos = [novoFluxo, ...fluxos]
    setFluxos(novos)
    setFluxoSelecionadoId(novoFluxo.id)
    if (typeof window !== 'undefined') {
      localStorage.setItem('cajado_fluxogramas_custom', JSON.stringify(novos.filter(f => !TEMPLATES_PADRAO.some(t => t.id === f.id))))
    }
    setModalNovoFluxo(false)
    setFormFluxo({ titulo: '', categoria: 'Empresa', descricao: '', responsavel: '' })
  }

  // Obter saídas de um nó (para navegação e execução)
  const obterConexoesSaida = (noId: string) => {
    if (!fluxoAtivo) return []
    return fluxoAtivo.conexoes.filter(c => c.deNoId === noId)
  }

  return (
    <div className="space-y-6">
      {/* ── 1. CABEÇALHO & CATEGORIAS (Como na foto do Max) ─── */}
      <div className="flex flex-col gap-4">
        {/* Barra de Categorias estilo Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
          {CATEGORIAS_PADRAO.map(cat => {
            const ativa = categoriaAtiva === cat.id
            const count = fluxos.filter(f => cat.id === 'todas' || f.categoria.toLowerCase() === cat.id.toLowerCase()).length
            return (
              <button
                key={cat.id}
                onClick={() => setCategoriaAtiva(cat.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shadow-sm',
                  ativa
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-amber-500/10'
                    : 'bg-page/60 border-border-subtle text-fg-secondary hover:bg-surface-hover hover:text-fg'
                )}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className={cn(
                  'px-1.5 py-0.5 rounded-full text-[10px]',
                  ativa ? 'bg-amber-500/20 text-amber-200' : 'bg-muted text-fg-tertiary'
                )}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Barra de Ações Rápidas & Lista de Processos */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-border-subtle p-3 rounded-2xl">
          {/* Seletor rápido do Fluxo Ativo */}
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-xs font-medium text-fg-tertiary">Processo Ativo:</span>
            <select
              value={fluxoSelecionadoId}
              onChange={e => {
                setFluxoSelecionadoId(e.target.value)
                setNoSelecionadoId(null)
                setModoExecucao(false)
              }}
              className="input text-xs py-1.5 font-semibold bg-page border-border-subtle max-w-md truncate"
            >
              {fluxosFiltrados.map(f => (
                <option key={f.id} value={f.id}>
                  [{f.categoria}] {f.titulo}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setModalNovoFluxo(true)}
              className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <span>+</span>
              <span>Novo Fluxograma</span>
            </button>

            <button
              onClick={iniciarExecucao}
              className={cn(
                'btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5 transition-all',
                modoExecucao ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10' : ''
              )}
            >
              <span>{modoExecucao ? '🔄 Reiniciar Guia' : '▶ Executar Processo'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. VISUALIZADOR PRINCIPAL DO FLUXOGRAMA ─────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
        {/* Painel do Diagrama Interativo (Canvas SVG com Estilo 3D) */}
        <div className="xl:col-span-3 bg-page border border-border-subtle rounded-2xl shadow-xl overflow-hidden relative min-h-[580px] flex flex-col">
          {/* Barra de Ferramentas Superior do Diagrama */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface/80 backdrop-blur-md border-b border-border-subtle z-10">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-fg flex items-center gap-1.5">
                <span>📊</span>
                <span>{fluxoAtivo?.titulo}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 font-medium">
                {fluxoAtivo?.categoria} · v{fluxoAtivo?.versao || '1.0'}
              </span>
            </div>

            {/* Controles de Zoom */}
            <div className="flex items-center gap-1 bg-surface border border-border-subtle rounded-lg p-0.5">
              <button
                onClick={() => setZoom(z => Math.max(0.6, z - 0.1))}
                className="w-7 h-7 flex items-center justify-center text-xs text-fg-secondary hover:text-fg hover:bg-surface-hover rounded"
                title="Diminuir Zoom"
              >
                🔍-
              </button>
              <span className="text-[10px] font-mono px-1.5 text-fg-tertiary">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
                className="w-7 h-7 flex items-center justify-center text-xs text-fg-secondary hover:text-fg hover:bg-surface-hover rounded"
                title="Aumentar Zoom"
              >
                🔍+
              </button>
              <button
                onClick={() => setZoom(1)}
                className="px-2 h-7 text-[10px] text-fg-tertiary hover:text-fg hover:bg-surface-hover rounded"
                title="Resetar Zoom"
              >
                100%
              </button>
            </div>
          </div>

          {/* Banner de Modo Execução */}
          {modoExecucao && (
            <div className="bg-emerald-500/15 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs text-emerald-300 z-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold">Modo de Execução Ativo:</span>
                <span>Clique nos botões da etapa para avançar no processo</span>
              </div>
              <button
                onClick={() => setModoExecucao(false)}
                className="text-[10px] underline hover:text-emerald-200"
              >
                Sair do Modo Guia
              </button>
            </div>
          )}

          {/* Área Interativa SVG com Renderização 3D */}
          <div className="flex-1 overflow-auto p-8 relative flex items-center justify-center bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:16px_16px]">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease-out',
                width: '920px',
                minHeight: '520px',
              }}
              className="relative select-none"
            >
              {/* Conexões / Setas em SVG */}
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                style={{ overflow: 'visible' }}
              >
                <defs>
                  {/* Marcadores de Setas */}
                  <marker
                    id="arrow-padrao"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#71717a" />
                  </marker>
                  <marker
                    id="arrow-sucesso"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                  </marker>
                  <marker
                    id="arrow-erro"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#ef4444" />
                  </marker>
                </defs>

                {fluxoAtivo?.conexoes.map(conn => {
                  const deNo = fluxoAtivo.nos.find(n => n.id === conn.deNoId)
                  const paraNo = fluxoAtivo.nos.find(n => n.id === conn.paraNoId)
                  if (!deNo || !paraNo) return null

                  // Coordenadas centrais
                  const deLargura = deNo.largura || 200
                  const deAltura = deNo.altura || 60
                  const paraLargura = paraNo.largura || 200
                  const paraAltura = paraNo.altura || 60

                  const deCentroX = deNo.x + deLargura / 2
                  const deCentroY = deNo.y + deAltura / 2
                  const paraCentroX = paraNo.x + paraLargura / 2
                  const paraCentroY = paraNo.y + paraAltura / 2

                  // Calcula pontos de saída e entrada
                  let startX = deCentroX
                  let startY = deNo.y + deAltura
                  let endX = paraCentroX
                  let endY = paraNo.y

                  // Se o nó de destino estiver à esquerda
                  if (paraNo.x + paraLargura < deNo.x) {
                    startX = deNo.x
                    startY = deCentroY
                    endX = paraNo.x + paraLargura
                    endY = paraCentroY
                  }
                  // Se o nó de destino estiver à direita
                  else if (paraNo.x > deNo.x + deLargura) {
                    startX = deNo.x + deLargura
                    startY = deCentroY
                    endX = paraNo.x
                    endY = paraCentroY
                  }
                  // Se for retorno para cima
                  else if (paraNo.y + paraAltura < deNo.y) {
                    startX = deNo.x
                    startY = deCentroY
                    endX = paraNo.x
                    endY = paraNo.y + paraAltura / 2
                  }

                  // Cor e marcador
                  let strokeColor = '#71717a'
                  let markerId = 'arrow-padrao'
                  if (conn.tipoLinha === 'sucesso' || conn.rotulo?.toLowerCase() === 'sim') {
                    strokeColor = '#10b981'
                    markerId = 'arrow-sucesso'
                  } else if (conn.tipoLinha === 'erro' || conn.rotulo?.toLowerCase() === 'não') {
                    strokeColor = '#ef4444'
                    markerId = 'arrow-erro'
                  }

                  // Traçado com cotovelos ortogonais elegantes
                  let pathData = `M ${startX} ${startY} L ${endX} ${endY}`
                  if (Math.abs(startX - endX) > 10 && Math.abs(startY - endY) > 10) {
                    if (startX === deNo.x && endY < startY) {
                      // Curva de retorno pela esquerda (como na foto do Max)
                      const recuo = Math.min(startX, endX) - 50
                      pathData = `M ${startX} ${startY} L ${recuo} ${startY} L ${recuo} ${endY} L ${endX} ${endY}`
                    } else {
                      const midY = (startY + endY) / 2
                      pathData = `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`
                    }
                  }

                  const midLabelX = (startX + endX) / 2
                  const midLabelY = (startY + endY) / 2

                  return (
                    <g key={conn.id}>
                      <path
                        d={pathData}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        markerEnd={`url(#${markerId})`}
                        className="transition-all duration-300"
                      />
                      {conn.rotulo && (
                        <g transform={`translate(${midLabelX}, ${midLabelY - 10})`}>
                          <rect
                            x="-22"
                            y="-10"
                            width="44"
                            height="20"
                            rx="5"
                            fill="#18181b"
                            stroke={strokeColor}
                            strokeWidth="1.5"
                          />
                          <text
                            x="0"
                            y="4"
                            fill={strokeColor}
                            fontSize="11"
                            fontWeight="bold"
                            textAnchor="middle"
                          >
                            {conn.rotulo}
                          </text>
                        </g>
                      )}
                    </g>
                  )
                })}
              </svg>

              {/* Renderização dos Nós com Efeito 3D / Sombra idêntico ao modelo */}
              {fluxoAtivo?.nos.map(no => {
                const isSelected = noSelecionadoId === no.id
                const isAtivoExecucao = modoExecucao && noAtualExecucaoId === no.id
                const isPassado = modoExecucao && historicoExecucao.includes(no.id) && !isAtivoExecucao

                const w = no.largura || 200
                const h = no.altura || 60

                return (
                  <div
                    key={no.id}
                    onClick={() => setNoSelecionadoId(no.id)}
                    style={{
                      left: `${no.x}px`,
                      top: `${no.y}px`,
                      width: `${w}px`,
                      minHeight: `${h}px`,
                    }}
                    className={cn(
                      'absolute cursor-pointer transition-all duration-200 transform hover:scale-[1.03] group z-20',
                      isSelected ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-black' : '',
                      isAtivoExecucao ? 'ring-4 ring-emerald-400 ring-offset-4 ring-offset-black animate-bounce' : '',
                      isPassado ? 'opacity-80' : ''
                    )}
                  >
                    {/* TIPO: INÍCIO / FIM (Cápsula 3D com Degradê Roxo/Azul) */}
                    {(no.tipo === 'inicio' || no.tipo === 'fim') && (
                      <div className="w-full h-full rounded-full bg-gradient-to-b from-[#5b4cb8] to-[#40338f] text-white flex items-center justify-center font-bold text-sm tracking-wide shadow-[0_8px_0_#2b2260,0_12px_20px_rgba(0,0,0,0.6)] border border-[#7464d8]/40 hover:brightness-110 active:translate-y-1 active:shadow-[0_4px_0_#2b2260]">
                        <span>{no.titulo}</span>
                      </div>
                    )}

                    {/* TIPO: PROCESSO / AÇÃO (Retângulo 3D com Sombra Profunda) */}
                    {no.tipo === 'processo' && (
                      <div className="w-full h-full rounded-xl bg-gradient-to-b from-[#4e3fa3] to-[#3a2e80] text-white p-3 flex flex-col justify-center items-center text-center shadow-[0_8px_0_#251d54,0_12px_20px_rgba(0,0,0,0.6)] border border-[#6b5bc9]/40 hover:brightness-110 active:translate-y-1 active:shadow-[0_4px_0_#251d54]">
                        <span className="font-bold text-xs md:text-sm leading-tight text-white drop-shadow">
                          {no.titulo}
                        </span>
                        {no.responsavel && (
                          <span className="text-[10px] text-purple-200/70 mt-1">
                            👤 {no.responsavel}
                          </span>
                        )}
                      </div>
                    )}

                    {/* TIPO: DECISÃO (Losango 3D com Sombra & Gradiente) */}
                    {no.tipo === 'decisao' && (
                      <div className="relative w-full h-full flex items-center justify-center">
                        {/* Fundo Losango com SVG */}
                        <svg
                          viewBox="0 0 260 110"
                          className="w-full h-full filter drop-shadow-[0_8px_0_#251d54] drop-shadow-[0_12px_20px_rgba(0,0,0,0.6)]"
                        >
                          <polygon
                            points="130,5 255,55 130,105 5,55"
                            fill="url(#losangoGrad)"
                            stroke="#7665d8"
                            strokeWidth="2"
                          />
                          <defs>
                            <linearGradient id="losangoGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#5443b0" />
                              <stop offset="100%" stopColor="#352877" />
                            </linearGradient>
                          </defs>
                        </svg>

                        {/* Texto dentro do Losango */}
                        <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                          <span className="font-bold text-xs md:text-sm text-white drop-shadow leading-tight">
                            {no.titulo}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rodapé Informativo do Diagrama */}
          <div className="px-4 py-3 bg-surface border-t border-border-subtle flex flex-wrap items-center justify-between text-xs text-fg-tertiary">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-[#5b4cb8]" />
                <span>Início / Fim</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-[#4e3fa3]" />
                <span>Etapa / Processo</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rotate-45 bg-[#5443b0]" />
                <span>Decisão / Validação</span>
              </span>
            </div>
            <span>💡 Clique em qualquer bloco para ver detalhes, checklist e responsáveis.</span>
          </div>
        </div>

        {/* ── 3. PAINEL LATERAL DE DETALHES & GUIA POP ────────── */}
        <div className="bg-surface border border-border-subtle rounded-2xl p-5 shadow-lg space-y-5">
          {noSelecionado ? (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
                    Etapa Selecionada
                  </span>
                  <h3 className="text-base font-bold text-fg mt-0.5">{noSelecionado.titulo}</h3>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-semibold uppercase',
                  noSelecionado.tipo === 'inicio' ? 'bg-blue-500/20 text-blue-300' :
                  noSelecionado.tipo === 'fim' ? 'bg-emerald-500/20 text-emerald-300' :
                  noSelecionado.tipo === 'decisao' ? 'bg-purple-500/20 text-purple-300' :
                  'bg-amber-500/20 text-amber-300'
                )}>
                  {noSelecionado.tipo}
                </span>
              </div>

              {noSelecionado.descricao && (
                <div className="text-xs text-fg-secondary bg-page/60 p-3 rounded-xl border border-border-subtle">
                  {noSelecionado.descricao}
                </div>
              )}

              {noSelecionado.responsavel && (
                <div className="flex items-center gap-2 text-xs text-fg-secondary">
                  <span className="text-fg-tertiary">Responsável:</span>
                  <span className="font-semibold text-fg bg-muted px-2 py-0.5 rounded-md">
                    👤 {noSelecionado.responsavel}
                  </span>
                </div>
              )}

              {/* Checklist de Validação da Etapa */}
              {noSelecionado.checklist && noSelecionado.checklist.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border-subtle">
                  <span className="text-xs font-bold text-fg">Checklist Obrigatório:</span>
                  <div className="space-y-1.5">
                    {noSelecionado.checklist.map((item, idx) => (
                      <label key={idx} className="flex items-start gap-2 text-xs text-fg-secondary cursor-pointer hover:text-fg">
                        <input type="checkbox" className="mt-0.5 rounded border-border-subtle text-amber-500 focus:ring-amber-500" />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Próximos Passos & Navegação Rápida */}
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <span className="text-xs font-bold text-fg">Próximos Passos:</span>
                {obterConexoesSaida(noSelecionado.id).length > 0 ? (
                  <div className="space-y-2">
                    {obterConexoesSaida(noSelecionado.id).map(conn => {
                      const prox = fluxoAtivo?.nos.find(n => n.id === conn.paraNoId)
                      if (!prox) return null
                      return (
                        <button
                          key={conn.id}
                          onClick={() => {
                            if (modoExecucao) avancarExecucao(prox.id)
                            else setNoSelecionadoId(prox.id)
                          }}
                          className={cn(
                            'w-full text-left p-2.5 rounded-xl border text-xs font-medium flex items-center justify-between transition-all',
                            conn.tipoLinha === 'sucesso' || conn.rotulo?.toLowerCase() === 'sim'
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
                              : conn.tipoLinha === 'erro' || conn.rotulo?.toLowerCase() === 'não'
                              ? 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20'
                              : 'bg-page border-border-subtle text-fg-secondary hover:text-fg hover:bg-surface-hover'
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            {conn.rotulo && (
                              <span className="font-bold px-1.5 py-0.5 rounded text-[10px] bg-black/40">
                                {conn.rotulo}
                              </span>
                            )}
                            <span className="truncate">{prox.titulo}</span>
                          </div>
                          <span>➔</span>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-fg-tertiary italic">Fim da ramificação.</p>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-8 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center text-xl mx-auto border border-amber-500/20">
                👆
              </div>
              <h4 className="text-sm font-semibold text-fg">Selecione uma Etapa</h4>
              <p className="text-xs text-fg-tertiary">
                Clique em qualquer bloco do fluxograma ao lado para visualizar os detalhes, instruções de trabalho e checklist.
              </p>
            </div>
          )}

          {/* Resumo do POP */}
          <div className="pt-4 border-t border-border-subtle space-y-2">
            <span className="text-xs font-bold text-fg">Sobre este Procedimento:</span>
            <p className="text-xs text-fg-secondary leading-relaxed">
              {fluxoAtivo?.descricao || 'Procedimento operacional padrão registrado para alinhamento da equipe.'}
            </p>
          </div>
        </div>
      </div>

      {/* ── 4. MODAL NOVO FLUXOGRAMA ─────────────────────────── */}
      {modalNovoFluxo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <span>➕</span>
                <span>Novo Fluxograma de Processo</span>
              </h3>
              <button
                onClick={() => setModalNovoFluxo(false)}
                className="text-fg-tertiary hover:text-fg text-xl"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSalvarNovoFluxo} className="space-y-3">
              <div>
                <label className="label text-xs">Título do Processo *</label>
                <input
                  type="text"
                  required
                  value={formFluxo.titulo}
                  onChange={e => setFormFluxo(f => ({ ...f, titulo: e.target.value }))}
                  placeholder="Ex: Aprovação de Pedidos de Compra"
                  className="input text-xs mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Categoria</label>
                  <select
                    value={formFluxo.categoria}
                    onChange={e => setFormFluxo(f => ({ ...f, categoria: e.target.value }))}
                    className="input text-xs mt-1"
                  >
                    <option value="Empresa">🏢 Empresa</option>
                    <option value="Programação">💻 Programação</option>
                    <option value="Financeiro">💰 Financeiro</option>
                    <option value="Vendas">📦 Vendas & CRM</option>
                    <option value="Operações">⚙️ Operações</option>
                  </select>
                </div>
                <div>
                  <label className="label text-xs">Responsável</label>
                  <input
                    type="text"
                    value={formFluxo.responsavel}
                    onChange={e => setFormFluxo(f => ({ ...f, responsavel: e.target.value }))}
                    placeholder="Ex: Financeiro / Max"
                    className="input text-xs mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="label text-xs">Descrição do Objetivo (POP)</label>
                <textarea
                  rows={3}
                  value={formFluxo.descricao}
                  onChange={e => setFormFluxo(f => ({ ...f, descricao: e.target.value }))}
                  placeholder="Descreva o que este processo resolve e as regras principais..."
                  className="input text-xs mt-1 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNovoFluxo(false)}
                  className="btn-secondary text-xs"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary text-xs"
                >
                  Criar Fluxograma
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
