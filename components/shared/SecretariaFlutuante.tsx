'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ModalRelatorio, buscarDadosRelatorio } from './ModalRelatorio'
import type { } from './ModalRelatorio'

// ── Types ────────────────────────────────────────────────────
interface AttachedFile { base64: string; mime: string; name: string; isImage: boolean; preview?: string }
interface Msg { id: string; role: 'ai' | 'user'; texto: string; acoes?: AcaoIA[]; anexo?: string; created_at?: string }
interface AcaoIA {
  tipo: 'gasto' | 'receita' | 'agenda' | 'ocorrencia' | 'gasto_empresa' | 'receita_empresa' | 'ideia' | 'registro' | 'relatorio' | 'backup_chat'
  dados: Record<string, any>
  label: string
  status?: 'pending' | 'saving' | 'saved' | 'error'
  errorMsg?: string
}

// IDs fixos de categorias financeiras (não mudam)
const CAT_DESPESA_ID  = 'd4f05276-7633-49b3-9d72-09fb0fa07fbe'     // Despesas Operacionais
const CAT_RECEITA_ID  = '2774932e-75c8-4b7e-b88f-12a6f1a0744a'     // Receita Operacional

// ── System Prompt gerado dinamicamente com a data atual ──
function buildSystemPrompt(): string {
  const agora = new Date()
  const dataAtual = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const horaAtual = agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const anoAtual = agora.getFullYear()
  const mesAtual = String(agora.getMonth() + 1).padStart(2, '0')
  const diaAtual = String(agora.getDate()).padStart(2, '0')
  const amanha = new Date(agora); amanha.setDate(amanha.getDate() + 1)
  const amanhaStr = `${amanha.getFullYear()}-${String(amanha.getMonth()+1).padStart(2,'0')}-${String(amanha.getDate()).padStart(2,'0')}`

  return `Você é a Elena, Secretária Executiva Premium do Sistema Cajado.
Você trabalha diretamente para o Sr. Max. Você pode REGISTRAR dados reais no sistema quando o Sr. Max solicitar.

⚠️ DATA E HORA ATUAL: ${dataAtual} às ${horaAtual} (Horário de Brasília)
⚠️ IMPORTANTE: Sempre use o ano ${anoAtual} nas datas. Se o chefe pedir "daqui a X minutos", calcule somando a partir das ${horaAtual}.

AÇÕES ESTRUTURADAS — inclua ao final da resposta:

GASTO PESSOAL (pessoa física do chefe):
\`\`\`json
{"acao":"gasto","valor":50.00,"descricao":"Almoço","categoria":"alimentacao","forma_pagamento":"pix","conta_nome":""}
\`\`\`

RECEITA PESSOAL:
\`\`\`json
{"acao":"receita","valor":1500.00,"descricao":"Freelance","categoria":"pro_labore","conta_nome":""}
\`\`\`

GASTO DA EMPRESA (pessoa jurídica / Cajado):
\`\`\`json
{"acao":"gasto_empresa","valor":300.00,"descricao":"Aluguel escritório","categoria":"operacional","conta_nome":""}
\`\`\`
- O campo "conta_nome" é OPCIONAL. Preencha APENAS se o usuário mencionar um cartão ou conta específica (ex: "Visa", "C6", "Nubank", "Bradesco", "Caixa Físico", "cartão da esposa"). Se não mencionar, deixe vazio.
- Exemplos de conta_nome: "visa", "mastercard", "c6", "nubank", "bradesco", "caixa", "cartão esposa"

RECEITA DA EMPRESA:
\`\`\`json
{"acao":"receita_empresa","valor":5000.00,"descricao":"Serviço prestado","categoria":"servicos","conta_nome":""}
\`\`\`

AGENDA / EVENTO:
\`\`\`json
{"acao":"agenda","titulo":"Reunião com cliente","data_inicio":"${amanhaStr}T14:00:00","tipo":"reuniao"}
\`\`\`

ALARME / LEMBRETE SONORO (use tipo="lembrete" — o sistema tocará som 15 min antes e na hora):
\`\`\`json
{"acao":"agenda","titulo":"⏰ Tomar remédio","data_inicio":"${anoAtual}-${mesAtual}-${diaAtual}T08:00:00","tipo":"lembrete","descricao":"Alarme automático"}
\`\`\`
- Use tipo="lembrete" SEMPRE que o chefe pedir: "me avisa", "toca um alarme", "lembra de mim às X horas", "cria um alerta"
- TIPOS de agenda: reuniao, lembrete, tarefa, prazo, pessoal, vencimento
- Para lembretes de vencimento de cartão, use tipo="vencimento"

OCORRÊNCIA DA EQUIPE:
\`\`\`json
{"acao":"ocorrencia","tipo":"erro","descricao":"Colaborador atrasado","colaborador_nome":"Pedro","impacto":"medio","modulo":"operacional"}
\`\`\`

CATEGORIAS para gastos pessoais: alimentacao, transporte, saude, lazer, educacao, moradia, vestuario, tecnologia, investimento, outros
CATEGORIAS para receitas pessoais: pro_labore, freelance, investimentos, aluguel, vendas, outros
CATEGORIAS para empresa: operacional, marketing, pessoal, infraestrutura, impostos, outros
FORMAS DE PAGAMENTO: pix, cartao_debito, cartao_credito, dinheiro, transferencia
- "cartão visa", "visa", "cartão hiper", "hipercard", "cartão crédito", "crédito", "cartão mastercard", "mastercard" → cartao_credito
- "débito", "cartão débito" → cartao_debito
- "pix", "transferência", "ted", "doc" → pix
- "dinheiro", "espécie", "cash" → dinheiro

IDEIA / PROJETO (guardar uma ideia do chefe):
\`\`\`json
{"acao":"ideia","titulo":"<USE EXATAMENTE O TÍTULO/TEMA DA IDEIA QUE O CHEFE DISSE>","descricao":"<descrição completa da ideia>","categoria":"geral"}
\`\`\`
- SEMPRE que o Sr. Max pedir "guarda essa ideia", "anota essa ideia", "salva essa ideia", "quero registrar uma ideia" → use acao=ideia com o texto EXATO que ele disse como título
- NUNCA use título genérico como 'Ideia via Elena' — use sempre o conteúdo real
- CATEGORIAS para ideias: negocio, produto, pessoal, financeiro, saude, criativo, geral

ANÁLISE DE IMAGENS E PDFs:
Quando o chefe enviar uma imagem ou PDF, analise o conteúdo e:
- FATURA DE CARTÃO DE CRÉDITO: extraia CADA compra com valor, descrição, data e forma_pagamento="cartao_credito". Gere um bloco JSON para CADA item.
- NOTA FISCAL / CUPOM: extraia valor total, fornecedor e gere um gasto.
- LISTA DE CARTÕES: identifique cada cartão, bandeira, limite, vencimento da fatura. Para CADA cartão, crie um evento na agenda no próximo vencimento usando o JSON de agenda abaixo. Exemplo: acao=agenda, titulo=🔴 Vencimento [Banco] [final cartão], data_inicio=${anoAtual}-MM-DDT10:00:00, tipo=lembrete.
- COMPROVANTE DE PAGAMENTO: registre como gasto ou receita conforme o documento.
- CRONOGRAMA: quando pedir cronograma de cartões, monte uma tabela organizada com: Cartão | Vencimento | Valor estimado | Parcelas ativas — e gere um evento de agenda por cartão.

REGRAS DE DECISÃO IMEDIATA — NÃO PERGUNTE se já tiver as informações:
- Se o Sr. Max disser "lançar na PJ", "lança na empresa", "é da empresa", "é PJ" → use acao=gasto_empresa ou receita_empresa (NUNCA pergunte de novo)
- Se disser "é pessoal", "é meu", "é PF" → use acao=gasto ou receita (NUNCA pergunte de novo)
- Se já informou o valor, descrição e forma de pagamento → gere o JSON IMEDIATAMENTE, não pergunte mais nada
- Se o Sr. Max informar MÚLTIPLOS gastos de uma vez → gere UM bloco JSON separado para CADA gasto

REGRAS GERAIS:
- HISTÓRICO: O contexto pode conter mensagens de conversas passadas (marcadas com a data/hora). Responda e atue APENAS na solicitação mais recente. NÃO repita ações ou respostas de mensagens antigas, a menos que o Sr. Max mencione explicitamente.
- TRATAMENTO: Trate sempre o usuário como "Sr. Max" de forma educada, prestativa e profissional.
- Só PERGUNTE se o gasto é PESSOAL ou DA EMPRESA quando o usuário NÃO especificou
- Se faltarem dados essenciais (valor, descrição), PERGUNTE antes de gerar o JSON
- Para ocorrência: pergunte colaborador, tipo (erro/acerto/alerta/elogio), impacto (baixo/medio/alto), descrição
- Responda SEMPRE em português brasileiro, tom profissional e conciso
- Quando tiver todos os dados, inclua o bloco JSON e diga que vai registrar agora
- Nas datas, SEMPRE use o ano ${anoAtual}

RELATÓRIO / RESUMO (quando o chefe pedir um relatório, resumo ou visão geral):
\`\`\`json
{"acao":"relatorio","periodo":"mes_atual"}
\`\`\`
PERÍODOS válidos: mes_atual, ultimos_7_dias, ultimos_30_dias, ano_atual
- Use relatorio SEMPRE que o chefe pedir: "resumo", "relatório", "como estou financeiramente", "visão geral", "quanto gastei", "mostre meus lançamentos"
- O sistema irá buscar os dados reais e abrir um painel visual automáticamente`
}

// ── Extrai JSONs da resposta da IA ──────────────────────────
function extrairAcoes(texto: string): AcaoIA[] {
  const acoes: AcaoIA[] = []
  const regex = /```json\s*([\s\S]*?)```/g
  let match
  while ((match = regex.exec(texto)) !== null) {
    try {
      const d = JSON.parse(match[1].trim())
      if (d.acao === 'gasto') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'gasto', dados: d, label: `💸 Gasto PF R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}${contaInfo}`, status: 'pending' })
      } else if (d.acao === 'receita') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'receita', dados: d, label: `💰 Receita PF R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}${contaInfo}`, status: 'pending' })
      } else if (d.acao === 'gasto_empresa') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'gasto_empresa', dados: d, label: `🏢💸 Despesa Empresa R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}${contaInfo}`, status: 'pending' })
      } else if (d.acao === 'receita_empresa') {
        const contaInfo = d.conta_nome ? ` [${d.conta_nome}]` : ''
        acoes.push({ tipo: 'receita_empresa', dados: d, label: `🏢💰 Receita Empresa R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}${contaInfo}`, status: 'pending' })
      } else if (d.acao === 'ideia') {
        acoes.push({ tipo: 'ideia', dados: d, label: `💡 Ideia: ${d.titulo}`, status: 'pending' })
      } else if (d.acao === 'agenda') {
        acoes.push({ tipo: 'agenda', dados: d, label: `📅 ${d.titulo}`, status: 'pending' })
      } else if (d.acao === 'ocorrencia') {
        acoes.push({ tipo: 'ocorrencia', dados: d, label: `📋 Ocorrência ${d.tipo}: ${d.descricao?.substring(0, 40)}`, status: 'pending' })
      } else if (d.acao === 'registro') {
        acoes.push({ tipo: 'registro', dados: d, label: `🗂️ Registro: ${d.titulo || d.descricao?.substring(0, 40)}`, status: 'pending' })
      } else if (d.acao === 'relatorio') {
        acoes.push({ tipo: 'relatorio', dados: d, label: `\uD83D\uDCC8 Gerar Relat\u00f3rio: ${d.periodo || 'mes_atual'}`, status: 'pending' })
      } else if (d.acao) {
        // Fallback: qualquer acao desconhecida vira um registro generico
        acoes.push({ tipo: 'registro', dados: { ...d, tipo: d.acao }, label: `🗂️ ${d.acao}: ${d.titulo || d.descricao?.substring(0, 40) || JSON.stringify(d).substring(0, 40)}`, status: 'pending' })
      }
    } catch {}
  }
  return acoes
}

function formatarTexto(texto: string) {
  return texto.replace(/```json[\s\S]*?```/g, '').trim()
}

export function SecretariaFlutuante() {
  const supabase = createClient()
  const [isOpen, setIsOpen] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [isClient, setIsClient] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, distance: 0 })
  const [userId, setUserId] = useState('')
  const [sessaoId, setSessaoId] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  const [sessoesAnteriores, setSessoesAnteriores] = useState<{ sid: string, data: string, resumo: string }[]>([])
  const [colaboradores, setColaboradores] = useState<{id: string, nome: string}[]>([])
  // Cache da conta PJ padrão buscada dinamicamente
  const contaPjIdRef = useRef<string | null>(null)
  const initialGreeting: Msg = { id: '1', role: 'ai', texto: 'Olá, Sr. Max! 👋 Sou a **Elena**, sua Secretária Executiva.\n\nPosso **registrar gastos, receitas, agenda e ocorrências** direto no sistema.\n\nExemplos:\n• _"Gastei R$ 80 de gasolina no PIX"_\n• _"Agendar reunião amanhã às 14h"_\n• _"Abrir ocorrência de erro para o Pedro"_' }
  
  const [mensagens, setMensagens] = useState<Msg[]>([initialGreeting])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [attachedFile, setAttachedFileState] = useState<AttachedFile | null>(null)
  const attachedFileRef = useRef<AttachedFile | null>(null)
  const [processingFile, setProcessingFile] = useState(false)
  const [relatorioData, setRelatorioData] = useState<any>(null)
  const [buscandoWeb, setBuscandoWeb] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const historyLoadedRef = useRef(false)
  const isSendingRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Helper: mantém ref e state sincronizados
  const setAttachedFile = (f: AttachedFile | null) => {
    attachedFileRef.current = f
    setAttachedFileState(f)
  }

  // Controle de microfone já autorizado
  const micPermitidoRef = useRef(false)

  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 150 })
    setIsClient(true)
    // Verifica permissão de microfone salva
    if (typeof window !== 'undefined') {
      micPermitidoRef.current = localStorage.getItem('elena_mic_ok') === '1'
    }
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setUserId(uid)

      // Carrega o histórico da ÚLTIMA sessão ou inicia uma nova
      if (!historyLoadedRef.current) {
        historyLoadedRef.current = true
        
        // Pega a última sessão
        const { data: lastMsg } = await supabase.from('elena_conversas').select('sessao_id').eq('user_id', uid).order('created_at', { ascending: false }).limit(1)
        const currentSessaoId = lastMsg && lastMsg.length > 0 ? lastMsg[0].sessao_id : Date.now().toString()
        setSessaoId(currentSessaoId)
        
        const { data: hist } = await (supabase
          .from('elena_conversas') as any)
          .select('id, role, texto, acoes, created_at')
          .eq('user_id', uid)
          .eq('sessao_id', currentSessaoId)
          .order('created_at', { ascending: false }) // Pega os mais recentes daquela sessão
          .limit(40)
        
        if (hist && hist.length > 0) {
          // Reverte para a ordem cronológica correta de exibição
          const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
            id: r.id,
            role: r.role as 'ai' | 'user',
            texto: r.texto,
            acoes: r.acoes ?? undefined,
            created_at: r.created_at,
          }))
          setMensagens([
            { id: '1', role: 'ai', texto: 'Olá, Sr. Max! 👋 Carreguei nossa última conversa. O que faremos agora?' },
            ...historico,
          ])
        }
      }
    })
    supabase.from('funcionarios').select('id, nome').eq('ativo', true).then(({ data }) => {
      if (data) setColaboradores(data as {id: string, nome: string}[])
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens, isOpen])

  // ── Sugestão Automática de Backup de Chat ─────────────────
  useEffect(() => {
    if (mensagens.length >= 40) {
      const jaSugeriu = sessionStorage.getItem('elena_backup_suggested')
      if (!jaSugeriu) {
        sessionStorage.setItem('elena_backup_suggested', '1')
        setTimeout(() => {
          setMensagens(prev => [...prev, {
            id: 'backup-suggest-' + Date.now(),
            role: 'ai',
            texto: 'Sr. Max, chegamos a 40 mensagens acumuladas! Gostaria que eu fizesse um backup completo do nosso histórico em um arquivo de texto e iniciasse uma conversa limpa para continuarmos?',
            acoes: [{
              tipo: 'backup_chat',
              dados: {},
              label: '💾 Baixar Backup (TXT)',
              status: 'pending'
            }]
          }])
        }, 1500)
      }
    }
  }, [mensagens])

  // ── Drag ─────────────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    dragRef.current = { startX: e.clientX, startY: e.clientY, initialX: pos.x, initialY: pos.y, distance: 0 }
  }

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      dragRef.current.distance = Math.sqrt(dx * dx + dy * dy)
      setPos({
        x: Math.max(10, Math.min(dragRef.current.initialX + dx, window.innerWidth - 70)),
        y: Math.max(10, Math.min(dragRef.current.initialY + dy, window.innerHeight - 100))
      })
    }
    const up = () => {
      if (!isDragging) return
      setIsDragging(false)
      if (dragRef.current.distance < 5) setIsOpen(prev => !prev)
    }
    if (isDragging) {
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [isDragging])

  // ── Auto-save ─────────────────────────────────────────────
  const setAcaoStatus = (msgId: string, idx: number, status: AcaoIA['status'], errorMsg?: string) => {
    setMensagens(prev => prev.map(m =>
      m.id === msgId
        ? { ...m, acoes: m.acoes?.map((a, i) => i === idx ? { ...a, status, errorMsg } : a) }
        : m
    ))
  }

  // Busca conta PJ por nome/bandeira mencionada pelo usuário, ou a primeira PJ ativa como fallback
  const resolverContaPj = useCallback(async (contaNome?: string): Promise<{ id: string; nome: string }> => {
    // Busca todas as contas PJ ativas
    const { data: contas } = await (supabase.from('contas') as any)
      .select('id, nome, bandeira, tipo')
      .eq('categoria', 'pj')
      .eq('ativo', true)
      .order('created_at', { ascending: true })

    if (!contas || contas.length === 0) return { id: '', nome: '' }

    // Se o usuário especificou uma conta/cartão, tenta encontrar
    if (contaNome && contaNome.trim()) {
      const busca = contaNome.toLowerCase().trim()
      // Tenta match por bandeira (visa, mastercard, elo, etc.)
      const porBandeira = contas.find((c: any) => c.bandeira && c.bandeira.toLowerCase().includes(busca))
      if (porBandeira) return { id: porBandeira.id, nome: porBandeira.nome }
      // Tenta match por nome da conta (ex: 'C6 Bank PJ', 'Bradesco PJ', 'Nubank')
      const porNome = contas.find((c: any) => {
        const nome = (c.nome || '').toLowerCase()
        return nome.includes(busca) || busca.split(' ').some((p: string) => p.length > 2 && nome.includes(p))
      })
      if (porNome) return { id: porNome.id, nome: porNome.nome }
    }

    // Fallback: primeira conta PJ (cacheia)
    if (!contaPjIdRef.current) contaPjIdRef.current = contas[0].id
    return { id: contas[0].id, nome: contas[0].nome }
  }, [supabase])

  // Mantém getContaPjId para compatibilidade
  const getContaPjId = useCallback(async (): Promise<string> => {
    const { id } = await resolverContaPj()
    return id
  }, [resolverContaPj])

  const salvarAcao = useCallback(async (msgId: string, acaoIdx: number, acao: AcaoIA, uid: string) => {
    try {
      if (acao.tipo === 'gasto') {
        const hoje = new Date().toISOString().split('T')[0]
        const valor = Number(acao.dados.valor) || 0
        // Verifica duplicidade
        const { data: dups } = await supabase.from('gastos_pessoais').select('id')
          .eq('user_id', uid).eq('data', hoje).eq('valor', valor)
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error('⚠️ Duplicidade! Já existe um gasto com este exato valor hoje.')
        }

        const formasPagValidas = ['pix','cartao_debito','cartao_credito','dinheiro','transferencia']
        const forma = formasPagValidas.includes(acao.dados.forma_pagamento) ? acao.dados.forma_pagamento : 'pix'
        
        let notasAdicionais = 'Registrado pela Elena'
        if (acao.dados.conta_nome) {
          notasAdicionais = `Cartão/Conta: ${acao.dados.conta_nome} | Registrado pela Elena`
        }

        const { error } = await (supabase.from('gastos_pessoais') as any).insert({
          user_id: uid,
          descricao: acao.dados.descricao || 'Gasto via Elena',
          valor,
          categoria: acao.dados.categoria || 'outros',
          forma_pagamento: forma,
          data: hoje,
          recorrente: false,
          notas: notasAdicionais,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'receita') {
        const hoje = new Date().toISOString().split('T')[0]
        const valor = Number(acao.dados.valor) || 0
        const { data: dups } = await supabase.from('receitas_pessoais').select('id')
          .eq('user_id', uid).eq('data', hoje).eq('valor', valor)
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error('⚠️ Duplicidade! Já existe uma receita com este exato valor hoje.')
        }

        let notasAdicionais = 'Registrado pela Elena'
        if (acao.dados.conta_nome) {
          notasAdicionais = `Conta: ${acao.dados.conta_nome} | Registrado pela Elena`
        }

        const { error } = await (supabase.from('receitas_pessoais') as any).insert({
          user_id: uid,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor,
          categoria: acao.dados.categoria || 'outros',
          data: hoje,
          recorrente: false,
          notas: notasAdicionais,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'gasto_empresa') {
        const hoje = new Date().toISOString().split('T')[0]
        const valor = Number(acao.dados.valor) || 0
        // Resolve a conta: usa o nome/bandeira mencionado ou fallback para primeira PJ
        const { id: contaId, nome: contaNomeResolvido } = await resolverContaPj(acao.dados.conta_nome)
        if (!contaId) throw new Error('Nenhuma conta PJ cadastrada. Cadastre uma conta PJ em Financeiro > Contas.')
        const { data: dups } = await supabase.from('lancamentos').select('id')
          .eq('conta_id', contaId).eq('data_competencia', hoje).eq('valor', valor).eq('tipo', 'despesa')
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error(`⚠️ Duplicidade! Já existe uma despesa de R$ ${valor} na conta ${contaNomeResolvido} hoje.`)
        }
        const formasPagValidas = ['pix','cartao_debito','cartao_credito','dinheiro','transferencia']
        const formaPag = formasPagValidas.includes(acao.dados.forma_pagamento) ? acao.dados.forma_pagamento : 'pix'
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: contaId,
          descricao: acao.dados.descricao || 'Despesa via Elena',
          valor,
          tipo: 'despesa',
          regime: 'caixa',
          status: 'validado',
          data_competencia: hoje,
          data_caixa: hoje,
          categoria_id: CAT_DESPESA_ID,
          created_by: uid,
          observacoes: `Conta: ${contaNomeResolvido} | Pagamento: ${formaPag} | Registrado pela Elena`,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'receita_empresa') {
        const hoje = new Date().toISOString().split('T')[0]
        const valor = Number(acao.dados.valor) || 0
        const { id: contaId, nome: contaNomeResolvido } = await resolverContaPj(acao.dados.conta_nome)
        if (!contaId) throw new Error('Nenhuma conta PJ cadastrada. Cadastre uma conta PJ em Financeiro > Contas.')
        const { data: dups } = await supabase.from('lancamentos').select('id')
          .eq('conta_id', contaId).eq('data_competencia', hoje).eq('valor', valor).eq('tipo', 'receita')
        if (dups && dups.length > 0 && !acao.dados.forcar) {
          throw new Error(`⚠️ Duplicidade! Já existe uma receita de R$ ${valor} na conta ${contaNomeResolvido} hoje.`)
        }
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: contaId,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor,
          tipo: 'receita',
          regime: 'caixa',
          status: 'validado',
          data_competencia: hoje,
          data_caixa: hoje,
          categoria_id: CAT_RECEITA_ID,
          created_by: uid,
          observacoes: `Conta: ${contaNomeResolvido} | Registrado pela Elena`,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'agenda') {
        let dataInicio = acao.dados.data_inicio
          ? new Date(acao.dados.data_inicio)
          : new Date(Date.now() + 86400000)
        // Corrige o ano se a IA gerou errado (ex: 2025 ao invés de 2026)
        const anoCorreto = new Date().getFullYear()
        if (dataInicio.getFullYear() < anoCorreto) {
          dataInicio.setFullYear(anoCorreto)
        }
        const dataInicioStr = dataInicio.toISOString()
        // Normaliza tipo para valores válidos da tabela
        const tiposValidos = ['compromisso', 'lembrete', 'nota', 'tarefa', 'aniversario', 'reuniao']
        const tipoEvento = tiposValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'compromisso'
        const corMap: Record<string, string> = {
          compromisso: '#3b82f6', lembrete: '#f5a623', nota: '#8b5cf6',
          tarefa: '#10b981', aniversario: '#ec4899', reuniao: '#06b6d4',
        }
        const { error } = await (supabase.from('agenda_eventos') as any).insert({
          user_id: uid,
          titulo: acao.dados.titulo || 'Evento via Elena',
          descricao: acao.dados.descricao || null,
          tipo: tipoEvento,
          data_inicio: dataInicioStr,
          data_fim: null,
          dia_inteiro: false,
          status: 'pendente',
          prioridade: 'normal',
          cor: corMap[tipoEvento] || '#f59e0b',
          origem: 'ia',
        })
        if (error) {
          console.error('[Elena Agenda]', error)
          throw new Error(error.message)
        }
        setAcaoStatus(msgId, acaoIdx, 'saved')
        // Notifica a TabAgenda para recarregar
        window.dispatchEvent(new CustomEvent('elena:agenda-updated'))

      } else if (acao.tipo === 'ocorrencia') {
        let colaboradorId: string | null = null
        if (acao.dados.colaborador_nome) {
          const nomeBusca = acao.dados.colaborador_nome.toLowerCase()
          const enc = colaboradores.find(c =>
            c.nome.toLowerCase().includes(nomeBusca) || nomeBusca.includes(c.nome.toLowerCase().split(' ')[0])
          )
          colaboradorId = enc?.id || null
        }
        const { error } = await (supabase.from('ocorrencias') as any).insert({
          tipo: acao.dados.tipo || 'alerta',
          descricao: acao.dados.descricao || 'Ocorrência via Elena',
          colaborador_id: colaboradorId,
          modulo: acao.dados.modulo || null,
          impacto: acao.dados.impacto || 'medio',
          resolvida: false,
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'ideia') {
        // Ideia — tabela elena_ideias
        const categoriasValidas = ['negocio','produto','pessoal','financeiro','saude','criativo','geral']
        const categoria = categoriasValidas.includes(acao.dados.categoria) ? acao.dados.categoria : 'geral'
        const { error } = await (supabase.from('elena_ideias') as any).insert({
          user_id: uid,
          titulo: acao.dados.titulo || 'Ideia via Elena',
          descricao: acao.dados.descricao || null,
          categoria,
          status: 'rascunho',
          progresso: 5,
          notas: 'Capturada pela Elena durante conversa',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')
        // Notifica TabIdeias para recarregar
        window.dispatchEvent(new CustomEvent('elena:ideia-salva'))

      } else if (acao.tipo === 'registro') {
        // Registro GENÉRICO — tabela elena_registros (fallback universal)
        const tiposValidos = ['contrato', 'emprestimo', 'nota', 'lembrete', 'compra', 'venda', 'outro', 'geral']
        const tipo = tiposValidos.includes(acao.dados.tipo) ? acao.dados.tipo : 'geral'
        const { error } = await (supabase.from('elena_registros') as any).insert({
          user_id: uid,
          tipo,
          titulo: acao.dados.titulo || acao.dados.descricao?.substring(0, 100) || 'Registro via Elena',
          descricao: acao.dados.descricao || null,
          valor: acao.dados.valor ? Number(acao.dados.valor) : null,
          data: new Date().toISOString().split('T')[0],
          metadados: acao.dados, // salva o JSON completo da IA para não perder dados
          origem: 'elena',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'relatorio') {
        // Relatório — busca dados reais no banco e abre o modal
        setAcaoStatus(msgId, acaoIdx, 'saving')
        const dados = await buscarDadosRelatorio(supabase, uid, acao.dados.periodo || 'mes_atual')
        setRelatorioData(dados)
        setAcaoStatus(msgId, acaoIdx, 'saved')
      } else if (acao.tipo === 'backup_chat') {
        // Gera o arquivo TXT
        const textoBackup = mensagens
          .filter(m => m.texto && m.texto !== '...')
          .map(m => {
            const data = m.created_at ? new Date(m.created_at).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR')
            return `[${data}] ${m.role === 'ai' ? 'Elena' : 'Sr. Max'}:\n${m.texto}`
          })
          .join('\n\n----------------------------------------\n\n')
        
        const blob = new Blob([`=== BACKUP DA CONVERSA - ELENA ===\nGerado em: ${new Date().toLocaleString('pt-BR')}\n\n` + textoBackup], { type: 'text/plain;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `Backup_Conversa_Elena_${new Date().toISOString().split('T')[0]}.txt`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        
        setAcaoStatus(msgId, acaoIdx, 'saved')
      }
    } catch (err: any) {
      setAcaoStatus(msgId, acaoIdx, 'error', err.message)
    }
  }, [supabase, colaboradores, resolverContaPj, getContaPjId])

  const executarAcoesAuto = useCallback((msgId: string, acoes: AcaoIA[], uid: string) => {
    acoes.forEach((acao, idx) => {
      setMensagens(prev => prev.map(m =>
        m.id === msgId
          ? { ...m, acoes: m.acoes?.map((a, i) => i === idx ? { ...a, status: 'saving' as const } : a) }
          : m
      ))
      salvarAcao(msgId, idx, acao, uid).catch(() => {})
    })
  }, [salvarAcao])

  // ── Salvar mensagem no histórico do banco ─────────────────
  const salvarHistorico = useCallback(async (uid: string, role: 'user' | 'ai', texto: string, acoes?: AcaoIA[], currentSessao?: string) => {
    if (!uid || !texto || texto === '...') return
    await (supabase.from('elena_conversas') as any).insert({
      user_id: uid,
      role,
      texto,
      acoes: acoes && acoes.length > 0 ? acoes : null,
      sessao_id: currentSessao || sessaoId,
    })
  }, [supabase, sessaoId])

  // ── Carregar arquivo (imagem ou PDF) ────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file) return
    setProcessingFile(true)
    try {
      const isImage = file.type.startsWith('image/')
      const isPDF = file.type === 'application/pdf'
      if (!isImage && !isPDF) {
        alert('Formato não suportado. Envie uma imagem (JPG, PNG, etc.) ou PDF.')
        setProcessingFile(false)
        return
      }

      if (isImage) {
        // Imagem: converte para base64 e mostra preview
        const reader = new FileReader()
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string
          setAttachedFile({ base64: dataUrl.split(',')[1], mime: file.type, name: file.name, isImage: true, preview: dataUrl })
          setProcessingFile(false)
        }
        reader.readAsDataURL(file)
      } else {
        // PDF: extrai texto no navegador usando PDF.js (CDN)
        const extractPdfText = async (): Promise<string> => {
          // Carrega PDF.js do CDN se ainda não estiver carregado
          if (!(window as any).pdfjsLib) {
            await new Promise<void>((resolve, reject) => {
              const s = document.createElement('script')
              s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
              s.onload = () => {
                (window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
                  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
                resolve()
              }
              s.onerror = reject
              document.head.appendChild(s)
            })
          }
          const arrayBuffer = await file.arrayBuffer()
          const pdf = await (window as any).pdfjsLib.getDocument({ data: arrayBuffer }).promise
          let text = ''
          for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
            const page = await pdf.getPage(i)
            const content = await page.getTextContent()
            text += content.items.map((item: any) => item.str).join(' ') + '\n'
          }
          return text.trim().substring(0, 6000)
        }

        try {
          const texto = await extractPdfText()
          if (texto) {
            setAttachedFile({ base64: texto, mime: 'text/plain', name: file.name, isImage: false })
          } else {
            alert('PDF sem texto legível. Tente converter para imagem e envie como foto.')
          }
        } catch {
          alert('Erro ao processar o PDF. Tente novamente ou converta para imagem.')
        }
        setProcessingFile(false)
      }
    } catch {
      setProcessingFile(false)
    }
  }, [])


  // ── Busca Web (Perplexity Sonar) ──────────────────────────
  // Palavras-chave que indicam necessidade de busca na internet
  const KEYWORDS_WEB = [
    'preço', 'preco', 'valor', 'quanto custa', 'custa', 'mercado', 'comparar', 'comparação',
    'mais barato', 'melhor preço', 'promoção', 'oferta', 'cotação', 'cotacao',
    'pesquisa', 'pesquise', 'busque', 'buscar', 'procure', 'procurar',
    'notícia', 'noticia', 'novidade', 'atualidade', 'hoje', 'recente',
    'dólar', 'euro', 'câmbio', 'cambio', 'inflação', 'inflacao', 'ipca', 'selic',
    'concorrente', 'concorrência', 'mercado', 'tendência', 'tendencia',
    'amazon', 'shopee', 'mercado livre', 'magalu', 'americanas', 'casas bahia',
  ]

  const precisaBuscarWeb = (texto: string): boolean => {
    const t = texto.toLowerCase()
    return KEYWORDS_WEB.some(kw => t.includes(kw))
  }

  const buscarWeb = async (query: string, contexto?: string): Promise<string | null> => {
    try {
      setBuscandoWeb(true)
      const res = await fetch('/api/busca-web', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, contexto }),
      })
      const data = await res.json()
      if (!res.ok || data.error) return null
      return data.resultado ?? null
    } catch {
      return null
    } finally {
      setBuscandoWeb(false)
    }
  }

  // ── Enviar ────────────────────────────────────────────────
  const handleEnviar = useCallback(async (textToSubmit?: string) => {
    if (isSendingRef.current) return
    const userText = (textToSubmit ?? input).trim()
    const currentFile = attachedFileRef.current
    if ((!userText && !currentFile) || loading) return
    
    isSendingRef.current = true
    const aiMsgId = (Date.now() + 1).toString()
    const userMsgTexto = userText || (currentFile?.isImage ? `📎 ${currentFile.name}` : `📄 ${currentFile?.name}`)
    setMensagens(prev => [
      ...prev,
      { id: Date.now().toString(), role: 'user', texto: userMsgTexto, anexo: currentFile?.isImage ? currentFile.preview : undefined },
      { id: aiMsgId, role: 'ai', texto: '...' }
    ])
    setInput('')
    transcriptRef.current = ''
    setLoading(true)

    // Obtém uid (pode não estar no state ainda)
    let uid = userId
    if (!uid) {
      const { data: auth } = await supabase.auth.getUser()
      uid = auth.user?.id || ''
      if (uid) setUserId(uid)
    }

    // Captura e limpa o arquivo
    const fileSnap = currentFile
    setAttachedFile(null)

    try {
      // Contexto: usa todas as mensagens em memória, formatadas com data para evitar confusão de tempo
      const contexto = mensagens
        .filter(m => m.texto && m.texto !== '...' && m.texto !== initialGreeting.texto)
        .slice(-20) // envia as últimas 20 interações para contexto
        .map(m => {
          const dtStr = m.created_at ? new Date(m.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Agora'
          return `[${dtStr}] ${m.role === 'ai' ? 'Elena' : 'Sr. Max'}: ${m.texto.substring(0, 300)}`
        })
        .join('\n')

      // Monta o prompt incluindo texto do PDF se for arquivo de texto
      let promptFinal = userText || 'Analise este arquivo e extraia as informações financeiras relevantes.'
      if (fileSnap && !fileSnap.isImage && fileSnap.mime === 'text/plain') {
        promptFinal = `${promptFinal}\n\n[CONTEÚDO DO ARQUIVO: ${fileSnap.name}]\n${fileSnap.base64}`
      }

      // Busca web automática se o usuário perguntar sobre preços/mercado
      if (userText && precisaBuscarWeb(userText) && !fileSnap) {
        // Atualiza o placeholder para mostrar que está buscando
        setMensagens(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, texto: '🌐 Buscando na internet...' } : m
        ))
        const resultadoWeb = await buscarWeb(userText, contexto)
        if (resultadoWeb) {
          promptFinal = `${promptFinal}\n\n---\n[RESULTADO DA BUSCA NA INTERNET - use estas informações para responder com dados reais e atualizados]:\n${resultadoWeb}\n---`
        }
        // Volta para o placeholder padrão
        setMensagens(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, texto: '...' } : m
        ))
      }

      const body: Record<string, any> = {
        prompt: promptFinal,
        context: contexto,
        systemInstruction: buildSystemPrompt(),
      }
      // Se é imagem, manda para visão (GPT-4o)
      if (fileSnap?.isImage) {
        body.imageBase64 = fileSnap.base64
        body.imageMime = fileSnap.mime
      }

      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error)
      const resposta: string = data.result ?? ''
      const acoes = extrairAcoes(resposta)
      const acoesComStatus = acoes.map(a => ({ ...a, status: 'pending' as const }))
      const textoFormatado = formatarTexto(resposta)
      setMensagens(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, texto: textoFormatado, acoes: acoesComStatus.length > 0 ? acoesComStatus : undefined } : m
      ))

      // Salva no histórico do banco
      if (uid) {
        // Garantir que usa a sessão atual do state, mas por precaução, passamos no momento do envio
        salvarHistorico(uid, 'user', userText, undefined, sessaoId)
        salvarHistorico(uid, 'ai', textoFormatado, acoesComStatus.length > 0 ? acoesComStatus : undefined, sessaoId)
      }

      // Auto-save ações após 600ms
      if (acoesComStatus.length > 0 && uid) {
        setTimeout(() => executarAcoesAuto(aiMsgId, acoesComStatus, uid), 600)
      }
    } catch (err: any) {
      const errMsg = err?.message || 'Erro desconhecido'
      console.error('[Elena]', errMsg)
      setMensagens(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, texto: `Perdão, chefe. Tive um problema: ${errMsg.substring(0, 120)}` } : m
      ))
    } finally {
      setLoading(false)
      isSendingRef.current = false
    }
  }, [input, loading, mensagens, userId, supabase, executarAcoesAuto, salvarHistorico])

  // ── Microfone (pede permissão apenas uma vez) ─────────────────
  const iniciarReconhecimento = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Use o Google Chrome para usar o microfone.'); return }
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
    transcriptRef.current = ''
    setInput('')
    setInterimTranscript('')
    const r = new SR()
    recognitionRef.current = r
    r.lang = 'pt-BR'
    r.continuous = true
    r.interimResults = true
    r.onstart = () => setIsListening(true)
    r.onresult = (e: any) => {
      let currentInterim = ''
      let currentFinal = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript
        if (e.results[i].isFinal) currentFinal += transcript
        else currentInterim += transcript
      }
      const newTotal = transcriptRef.current + currentFinal
      if (currentFinal) transcriptRef.current = newTotal
      setInterimTranscript(newTotal + currentInterim)
    }
    r.onerror = (e: any) => {
      setIsListening(false)
      setInterimTranscript('')
      if (e.error === 'not-allowed') {
        localStorage.removeItem('elena_mic_ok')
        micPermitidoRef.current = false
        alert('Permissão de microfone negada. Clique no 🔒 cadeado na barra de endereços e permita o microfone.')
      } else if (e.error === 'audio-capture') {
        alert('Nenhum microfone encontrado.')
      } else if (e.error !== 'no-speech') {
        console.error('Erro no microfone:', e.error)
      }
    }
    r.onend = () => {
      setIsListening(false)
      const finalToSend = transcriptRef.current || interimTranscript
      if (finalToSend.trim()) {
        handleEnviar(finalToSend.trim())
      }
      setInterimTranscript('')
      transcriptRef.current = ''
    }
    r.start()
  }

  const handlePressMic = async () => {
    // 1. Verifica via Permissions API se o microfone já foi autorizado
    //    sem abrir nenhum popup — esse é o comportamento correto e persistente
    if (navigator.permissions) {
      try {
        const status = await navigator.permissions.query({ name: 'microphone' as PermissionName })
        if (status.state === 'granted') {
          // Permissão já concedida — vai direto, sem pedir de novo
          micPermitidoRef.current = true
          localStorage.setItem('elena_mic_ok', '1')
          iniciarReconhecimento()
          return
        }
        if (status.state === 'denied') {
          alert('Permissão de microfone bloqueada. Clique no 🔒 cadeado na barra de endereços e permita o microfone.')
          return
        }
        // state === 'prompt' → primeira vez, precisa pedir
      } catch {
        // Navegador não suporta Permissions API — tenta pelo localStorage
        const jaPermitido = typeof window !== 'undefined' && localStorage.getItem('elena_mic_ok') === '1'
        if (jaPermitido) {
          micPermitidoRef.current = true
          iniciarReconhecimento()
          return
        }
      }
    } else {
      // Fallback: verifica localStorage (compatibilidade)
      const jaPermitido = typeof window !== 'undefined' && localStorage.getItem('elena_mic_ok') === '1'
      micPermitidoRef.current = jaPermitido
      if (jaPermitido) {
        iniciarReconhecimento()
        return
      }
    }

    // 2. Primeira vez: solicita permissão via getUserMedia
    //    (browser mostrará o popup UMA ÚNICA VEZ — depois fica permanente)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach(t => t.stop()) // libera stream de teste imediatamente
      micPermitidoRef.current = true
      localStorage.setItem('elena_mic_ok', '1')
      iniciarReconhecimento()
    } catch {
      localStorage.removeItem('elena_mic_ok')
      micPermitidoRef.current = false
      alert('Permissão de microfone negada. Permita nas configurações do navegador.')
    }
  }

  const handleReleaseMic = () => {
    // Para o reconhecimento mas captura o texto ANTES do onend disparar
    const textCapturado = transcriptRef.current.trim()
    transcriptRef.current = ''
    setInterimTranscript('')
    if (recognitionRef.current) {
      // Remove onend temporariamente para evitar envio duplo
      recognitionRef.current.onend = () => setIsListening(false)
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
    setInput('')
    if (textCapturado) {
      setTimeout(() => handleEnviar(textCapturado), 150)
    }
  }

  const toggleMic = () => {
    if (isListening) handleReleaseMic()
    else handlePressMic()
  }

  const handleClearChat = () => {
    if (!confirm('Deseja iniciar um NOVO assunto? O assunto atual ficará salvo no banco para consultas futuras.')) return
    setMensagens([initialGreeting])
    setSessaoId(Date.now().toString())
  }

  const loadSessoes = async () => {
    if (!userId) return
    const { data } = await supabase.from('elena_conversas').select('sessao_id, created_at, texto, role').eq('user_id', userId).order('created_at', { ascending: false }).limit(200)
    
    const agrupado = new Map<string, { data: string, resumo: string }>()
    if (data) {
      // Varre de trás pra frente para pegar a primeira mensagem do usuário como título da sessão
      const dataReversa = [...data].reverse()
      dataReversa.forEach(m => {
         if (!agrupado.has(m.sessao_id)) {
           agrupado.set(m.sessao_id, { data: m.created_at, resumo: m.texto })
         } else if (m.role === 'user' && (!agrupado.get(m.sessao_id)?.resumo || agrupado.get(m.sessao_id)!.resumo.includes('Olá, Sr. Max'))) {
           agrupado.set(m.sessao_id, { data: m.created_at, resumo: m.texto })
         }
      })
    }
    const arraySessoes = Array.from(agrupado.entries()).map(([sid, info]) => ({ sid, ...info })).sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
    setSessoesAnteriores(arraySessoes)
    setShowHistory(true)
  }

  const loadSpecificSession = async (sid: string) => {
    const { data: hist } = await (supabase
      .from('elena_conversas') as any)
      .select('id, role, texto, acoes, created_at')
      .eq('user_id', userId)
      .eq('sessao_id', sid)
      .order('created_at', { ascending: false })
      .limit(40)
      
    if (hist && hist.length > 0) {
      const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
        id: r.id,
        role: r.role as 'ai' | 'user',
        texto: r.texto,
        acoes: r.acoes ?? undefined,
        created_at: r.created_at,
      }))
      setMensagens([{ id: '1', role: 'ai', texto: 'Histórico carregado! O que faremos com ele?' }, ...historico])
      setSessaoId(sid)
      setShowHistory(false)
    }
  }

  if (!isClient) return null

  return (
    <>
      {/* Botão Flutuante */}
      <div
        className="fixed z-[100] cursor-grab active:cursor-grabbing"
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-20" />
          <div className="w-14 h-14 rounded-full border-[2.5px] border-amber-400 p-0.5 shadow-[0_8px_20px_rgba(251,191,36,0.4)] bg-page transition-transform active:scale-95">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop"
              alt="Elena" className="w-full h-full rounded-full object-cover pointer-events-none"
            />
          </div>
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-[#080b14] rounded-full" />
        </div>
      </div>

      {/* Janela de Chat */}
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-end justify-end p-4 sm:p-6 pointer-events-none">
          <div
            className="w-full max-w-sm bg-[#0a0d16] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
            style={{ height: '520px', animation: 'slideUpElena 0.25s ease-out' }}
          >
            {/* Header */}
            <div className="px-4 py-3 bg-gradient-to-r from-[#0d1522] to-[#080b14] border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <img
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop"
                  alt="Elena" className="w-8 h-8 rounded-full object-cover border border-amber-400/40 cursor-pointer"
                  onClick={() => setShowHistory(false)}
                />
                <div>
                  <p className="text-sm font-bold text-fg cursor-pointer" onClick={() => setShowHistory(false)}>Elena</p>
                  <p className="text-[10px] text-amber-400">Secretária Executiva · Registros automáticos</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={loadSessoes} title="Ver conversas passadas" className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-blue-400 hover:bg-blue-400/10 transition-colors text-xs">🗂️</button>
                <button onClick={handleClearChat} title="Nova conversa (iniciar novo assunto)" className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors text-xs">✨</button>
                <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-red-400 hover:bg-red-400/10 text-sm">✕</button>
              </div>
            </div>

            {/* View do Histórico de Conversas */}
            {showHistory ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#0a0d16]">
                <p className="text-xs font-semibold text-fg-secondary px-2 mb-3 uppercase tracking-wider">Histórico de Chats</p>
                {sessoesAnteriores.map(s => (
                  <button
                    key={s.sid}
                    onClick={() => loadSpecificSession(s.sid)}
                    className={cn("w-full text-left p-3 rounded-xl border transition-all", s.sid === sessaoId ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10 text-fg")}
                  >
                    <p className="text-xs font-semibold truncate mb-1">{s.resumo.replace(/```json[\s\S]*?```/g, '').substring(0, 60) || 'Conversa sem título'}</p>
                    <p className="text-[10px] text-fg-tertiary">{new Date(s.data).toLocaleString('pt-BR')}</p>
                  </button>
                ))}
                {sessoesAnteriores.length === 0 && (
                  <p className="text-xs text-fg-tertiary text-center py-10">Nenhuma conversa encontrada.</p>
                )}
              </div>
            ) : (
              <>
                {/* Chat Normal */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
              {mensagens.map(msg => {
                const isAi = msg.role === 'ai'
                return (
                  <div key={msg.id} className={cn('flex flex-col', isAi ? 'items-start' : 'items-end')}>
                    <div className={cn(
                      'max-w-[88%] px-3 py-2 rounded-2xl leading-relaxed text-xs',
                      isAi ? 'bg-muted text-fg rounded-tl-sm' : 'bg-amber-600 text-white rounded-tr-sm'
                    )}>
                      {msg.texto === '...' ? (
                        <span className="flex gap-1"><span className="animate-bounce">●</span><span className="animate-bounce" style={{animationDelay:'0.1s'}}>●</span><span className="animate-bounce" style={{animationDelay:'0.2s'}}>●</span></span>
                      ) : (
                        <>
                          {msg.anexo && <img src={msg.anexo} alt="anexo" className="max-w-full rounded-lg mb-1 max-h-32 object-contain" />}
                          {msg.texto}
                        </>
                      )}
                    </div>
                    {/* Status badges */}
                    {isAi && msg.acoes && msg.acoes.length > 0 && (
                      <div className="mt-1.5 flex flex-col gap-1 w-full max-w-[88%]">
                        {msg.acoes.map((acao, idx) => (
                          <div key={idx} className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] border',
                            acao.status === 'saving' ? 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300' :
                            acao.status === 'saved'  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                            acao.status === 'error'  ? 'bg-red-500/10 border-red-500/20 text-red-400' :
                            'bg-blue-500/10 border-blue-500/20 text-blue-300 animate-pulse'
                          )}>
                            {acao.status === 'saving' && <svg className="w-3 h-3 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>}
                            {acao.status === 'saved'  && <span>✅</span>}
                            {acao.status === 'error'  && <span>❌</span>}
                            {(!acao.status || acao.status === 'pending') && <span>{acao.tipo === 'gasto' ? '💸' : acao.tipo === 'receita' ? '💰' : acao.tipo === 'ocorrencia' ? '📋' : '📅'}</span>}
                            <span className="truncate">{acao.status === 'saved' ? 'Registrado automaticamente' : acao.status === 'saving' ? 'Salvando...' : acao.status === 'error' ? (acao.errorMsg || 'Erro') : acao.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Preview do Anexo */}
            {attachedFile && (
              <div className="px-3 pb-1 shrink-0">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                  {attachedFile.isImage && attachedFile.preview ? (
                    <img src={attachedFile.preview} alt="preview" className="w-10 h-10 rounded object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-amber-500/20 flex items-center justify-center text-amber-400 text-lg shrink-0">📄</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-amber-400 truncate">{attachedFile.name}</p>
                    <p className="text-[9px] text-fg-tertiary">{attachedFile.isImage ? 'Imagem pronta para análise' : 'PDF extraído — pronto para análise'}</p>
                  </div>
                  <button onClick={() => setAttachedFile(null)} className="text-fg-tertiary hover:text-fg text-sm shrink-0">✕</button>
                </div>
              </div>
            )}

            {/* Input */}
            <div className="p-3 border-t border-border-subtle shrink-0">
              {/* Input oculto para arquivo */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
              />
              <div className="flex items-center gap-2 bg-page rounded-xl p-1 border border-border-subtle focus-within:border-amber-500/40 transition-colors">
                {/* Botão microfone (Toggle) */}
                <button
                  onClick={toggleMic}
                  className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all',
                    isListening ? 'bg-red-500 text-white animate-pulse' : 'text-fg-tertiary hover:text-amber-400')}
                  title={isListening ? 'Parar e enviar' : 'Clique para falar'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </button>
                {/* Botão Anexar */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={processingFile}
                  title="Enviar imagem ou PDF"
                  className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all',
                    processingFile ? 'animate-pulse text-amber-400' :
                    attachedFile ? 'bg-amber-500/20 text-amber-400' :
                    'text-fg-tertiary hover:text-amber-400')}
                >
                  {processingFile
                    ? <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                  }
                </button>
                <input
                  type="text"
                  className="flex-1 bg-transparent border-0 focus:ring-0 text-xs text-fg placeholder-zinc-600 h-8"
                  placeholder={
                    buscandoWeb ? '🌐 Buscando na internet...' :
                    isListening ? '🎙️ Ouvindo... fale seu comando' :
                    attachedFile ? 'Descreva o que quer saber...' :
                    'Diga um comando para a Elena...'
                  }
                  // ✅ FIX 3: mostra o texto capturado em tempo real
                  value={isListening ? interimTranscript : input}
                  onChange={e => !isListening && setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !isListening && handleEnviar()}
                />
                <button
                  onClick={() => handleEnviar()}
                  disabled={(!input.trim() && !attachedFile) || loading || buscandoWeb}
                  className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
                >
                  {buscandoWeb ? (
                    <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" strokeOpacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round"/></svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                  )}
                </button>
              </div>
            </div>
            </>
          )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpElena {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>

      {/* Modal de Relatório — abre quando Elena gera um relatório */}
      {relatorioData && (
        <ModalRelatorio
          dados={relatorioData}
          onClose={() => setRelatorioData(null)}
        />
      )}
    </>
  )
}
