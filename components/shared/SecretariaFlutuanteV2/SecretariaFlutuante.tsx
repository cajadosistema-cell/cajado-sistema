'use client'
// ── SecretariaFlutuante.tsx ───────────────────────────────────
// Orquestrador principal. Conecta todos os hooks e renderiza o widget.
// NUNCA contém lógica de negócio — tudo fica nos hooks.

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ModalRelatorio } from '../ModalRelatorio'
import { ElenaErrorBoundary } from './ElenaErrorBoundary'

// Hooks
import { useElenaSession }  from './useElenaSession'
import { useElenaSalvar }   from './useElenaSalvar'
import { useElenaVoz }      from './useElenaVoz'
import { useElenaOffline }  from './useElenaOffline'
import { useElenaAlertas }  from './useElenaAlertas'

// Lib
import { buildSystemPrompt, extrairAcoes, formatarTexto, renderMarkdownHtml } from './elena-prompt'
import { PALAVRAS_CONFIRMACAO, KEYWORDS_WEB, KEYWORDS_HISTORICO } from './elena-constants'
import type { AcaoIA, AttachedFile, Msg } from './elena-types'

// ── processarArquivo: processa imagens e PDFs ──────────────────────
async function processarArquivo(
  file: File,
  setAttachedFile: (f: AttachedFile | null) => void,
  setProcessingFile: (v: boolean) => void,
) {
  setProcessingFile(true)
  try {
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = e => {
        const base64 = (e.target?.result as string).split(',')[1]
        const preview = e.target?.result as string
        setAttachedFile({ base64, mime: file.type, name: file.name, isImage: true, preview })
        setProcessingFile(false)
      }
      reader.readAsDataURL(file)
    } else if (file.type === 'application/pdf') {
      const extractPdfText = async (): Promise<string> => {
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
          console.error('[Elena] PDF sem texto legível')
          setAttachedFile(null)
        }
      } catch (e) {
        console.error('[Elena] Erro ao processar PDF:', e)
        setAttachedFile(null)
      }
      setProcessingFile(false)
    }
  } catch {
    setProcessingFile(false)
  }
}

// ── Componente interno ───────────────────────────────────────
function SecretariaFlutuanteWidget() {
  const supabase = createClient()

  // ── Estado local simples (apenas UI) ─────────────────────────
  const [isOpen, setIsOpen]       = useState(false)
  const [isClient, setIsClient]   = useState(false)
  const [pos, setPos]             = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [input, setInput]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [buscandoWeb, setBuscandoWeb] = useState(false)
  const [processingFile, setProcessingFile] = useState(false)
  const [relatorioData, setRelatorioData]   = useState<any>(null)

  // Refs de UI
  const dragRef       = useRef({ startX: 0, startY: 0, initialX: 0, initialY: 0, distance: 0 })
  const chatEndRef    = useRef<HTMLDivElement>(null)
  const fileInputRef  = useRef<HTMLInputElement>(null)
  const isSendingRef  = useRef(false)
  const sessionMsgCountRef   = useRef(0)
  const userMsgCountRef      = useRef(0)
  const sugestaoCountRef     = useRef(0)
  const gerandoSugestaoRef   = useRef(false)
  const atualizandoPerfilRef = useRef(false)
  const alertasDisparadosRef = useRef<Set<string>>(new Set())
  const ultimoRegistroRef    = useRef<{ tabela: string; id: string } | null>(null)
  const confirmRetryRef      = useRef(0) // P5: anti-loop de confirmação

  // Arquivo anexado: ref + state sincronizados
  const attachedFileRef = useRef<AttachedFile | null>(null)
  const [attachedFile, setAttachedFileState] = useState<AttachedFile | null>(null)
  const setAttachedFile = (f: AttachedFile | null) => {
    attachedFileRef.current = f
    setAttachedFileState(f)
  }

  // ── Hooks ─────────────────────────────────────────────────────
  const session = useElenaSession(supabase)

  // Ref de mensagens para evitar stale closure no backup_chat
  const mensagensRef = useRef<Msg[]>([])
  useEffect(() => { mensagensRef.current = session.mensagens }, [session.mensagens])

  const salvar = useElenaSalvar({
    supabase,
    userIdRef:        session.userIdRef,
    sessaoIdRef:      session.sessaoIdRef,
    mensagensRef,
    colaboradores:    session.colaboradores,
    ultimoRegistroRef,
    setMensagens:     session.setMensagens,
    setRelatorioData,
  })

  const offline = useElenaOffline({
    userId:           session.userId,
    executarAcoesAuto: salvar.executarAcoesAuto,
    adicionarMensagem: (msg) => session.setMensagens(prev => [...prev, msg]),
  })

  const voz = useElenaVoz({
    onEnviar:            (texto) => handleEnviar(texto),
    onErro:              (msg) => session.setMensagens(prev => [...prev, {
                           id: `voz-err-${Date.now()}`, role: 'ai',
                           texto: `⚠️ ${msg}`,
                         }]),
    userId:              session.userId,
    salvarMicAutorizado: session.salvarMicAutorizado,
    micPermitidoRef:     session.micPermitidoRef,
  })

  const alertas = useElenaAlertas(supabase, session.userId, session.setMensagens)

  // ── Inicialização ─────────────────────────────────────────────
  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 150 })
    setIsClient(true)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.mensagens, isOpen])

  // ── Drag ──────────────────────────────────────────────────────
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
        y: Math.max(10, Math.min(dragRef.current.initialY + dy, window.innerHeight - 100)),
      })
    }
    const up = () => {
      if (!isDragging) return
      setIsDragging(false)
      if (dragRef.current.distance < 5) {
        setIsOpen(prev => !prev)
        alertas.unlockAudioAndNotifications()
      }
    }
    if (isDragging) {
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
    }
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [isDragging, alertas])

  // ── Carregar resumo financeiro ────────────────────────────────
  const carregarResumoFinanceiro = useCallback(async (uid: string) => {
    // mantido simplificado
  }, [supabase]) // eslint-disable-line

  useEffect(() => {
    if (!session.userId) return
    carregarResumoFinanceiro(session.userId)
    const t = setInterval(() => carregarResumoFinanceiro(session.userId), 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [session.userId, carregarResumoFinanceiro])

  // ── Busca web ─────────────────────────────────────────────────
  const precisaBuscarWeb = (texto: string) =>
    KEYWORDS_WEB.some(kw => texto.toLowerCase().includes(kw))

  const precisaBuscarHistorico = (texto: string) =>
    KEYWORDS_HISTORICO.some(kw => texto.toLowerCase().includes(kw))

  const buscarWeb = async (query: string, contexto?: string): Promise<string | null> => {
    try {
      setBuscandoWeb(true)
      const res = await fetch('/api/busca-web', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, contexto }),
      })
      const data = await res.json()
      return res.ok && !data.error ? (data.resultado ?? null) : null
    } catch { return null }
    finally { setBuscandoWeb(false) }
  }

  // ── handleEnviar ──────────────────────────────────────────────
  const handleEnviar = useCallback(async (textToSubmit?: string) => {
    if (isSendingRef.current) return
    const userText = (textToSubmit ?? input).trim()
    const currentFile = attachedFileRef.current
    if ((!userText && !currentFile) || loading) return

    isSendingRef.current = true
    const aiMsgId = (Date.now() + 1).toString()
    const userMsgTexto = userText || (currentFile?.isImage ? `ðŸ“Ž ${currentFile.name}` : `ðŸ“„ ${currentFile?.name}`)

    session.setMensagens(prev => [
      ...prev,
      { id: Date.now().toString(), role: 'user', texto: userMsgTexto, anexo: currentFile?.isImage ? currentFile.preview : undefined },
      { id: aiMsgId, role: 'ai', texto: '...' },
    ])
    setInput('')
    setLoading(true)

    let uid = session.userIdRef.current
    if (!uid) {
      try {
        const { data: auth } = await supabase.auth.getUser()
        uid = auth.user?.id || ''
        if (uid) session.setUserId(uid)
      } catch {
        // Auth falhou — uid continua vazio
      }
    }

    // ⚠️ Guard: se uid ainda vazio, mostra erro amigável e libera o lock
    if (!uid) {
      session.setMensagens(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, texto: '🔐 Sessão expirada. Por favor, recarregue a página e faça login novamente.' }
          : m
      ))
      setLoading(false)
      isSendingRef.current = false
      return
    }

    const fileSnap = currentFile
    setAttachedFile(null)


    try {
      const colaboradoresCtx = session.colaboradores.length > 0
        ? `\n[COLABORADORES ATIVOS: ${session.colaboradores.map(c => c.nome).join(', ')}]`
        : ''
      // Contexto simplificado (só usado na busca web)
      const contexto = session.mensagens
        .filter(m => m.texto && m.texto !== '...')
        .slice(-5)
        .map(m => `${m.role === 'ai' ? 'Elena' : 'Sr. Max'}: ${m.texto.substring(0, 200)}`)
        .join('\n') + colaboradoresCtx


      let promptFinal = userText || 'Analise este arquivo e extraia as informações financeiras relevantes.'
      if (fileSnap && !fileSnap.isImage && fileSnap.mime === 'text/plain') {
        promptFinal = `${promptFinal}\n\n[CONTEÚDO DO ARQUIVO: ${fileSnap.name}]\n${fileSnap.base64}`
      }

      const textoLower = userText?.trim().toLowerCase() || ''
      const eConfirmacao = PALAVRAS_CONFIRMACAO.some(p => textoLower === p || textoLower === p + '!' || textoLower === p + '.')
      if (eConfirmacao && session.mensagens.length >= 2 && !fileSnap) {
        confirmRetryRef.current += 1

        // P5: Anti-loop — se já confirmou 2x sem resultado, pede para repetir
        if (confirmRetryRef.current > 2) {
          confirmRetryRef.current = 0
          session.setMensagens(prev => prev.map(m =>
            m.id === aiMsgId ? { ...m, texto: '😅 Desculpe, Sr. Max — não consegui entender o que confirmar. Pode repetir o pedido completo? Por exemplo: "Gastei R$ 50 de almoço no pix"' } : m
          ))
          setLoading(false)
          isSendingRef.current = false
          return
        }

        const ultimaElena = [...session.mensagens].reverse().find(m => m.role === 'ai' && m.texto && m.texto !== '...')

        // ── ATALHO DIRETO: ações pendentes → executa sem re-consultar IA ──
        const acoesPendentes = ultimaElena?.acoes?.filter(a => a.status === 'pending')
        if (acoesPendentes && acoesPendentes.length > 0 && ultimaElena && uid) {
          confirmRetryRef.current = 0 // Reset: ações encontradas, sucesso

          // Verifica se alguma ação de agenda tem horário expirado (passou o tempo)
          const agora = Date.now()
          const temAgendaExpirada = acoesPendentes.some(a => {
            if (a.tipo !== 'agenda') return false
            const dataAcao = new Date(a.dados.data_inicio || 0)
            return !isNaN(dataAcao.getTime()) && dataAcao.getTime() < agora
          })

          if (!temAgendaExpirada) {
            session.setMensagens(prev => prev.filter(m => m.id !== aiMsgId))
            setLoading(false)
            try {
              await salvar.executarAcoesAuto(ultimaElena.id, acoesPendentes, uid)
            } finally {
              isSendingRef.current = false
            }
            return
          }

          // Horário expirado → recalcular
          const horaAtual = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          if (ultimaElena) {
            promptFinal = `[INSTRUÇÃO PRIORITÁRIA DO SISTEMA]: O usuário confirmou agora (${horaAtual}), mas o horário proposto já passou. RECALCULE o horário relativo a partir de AGORA (${horaAtual}) e gere o JSON IMEDIATAMENTE com o novo horário.

Mensagem anterior da Elena: "${ultimaElena.texto.substring(0, 500)}"

Ação: recalcule os minutos/horas relativas do pedido original, somando ao horário atual ${horaAtual}. Execute agora.`
          }
        }

        // Fallback: re-consulta IA se Elena só fez pergunta textual
        if (ultimaElena) {
          promptFinal = `[INSTRUÇÃO PRIORITÁRIA DO SISTEMA]: O usuário está CONFIRMANDO. Gere o bloco JSON IMEDIATAMENTE.\n\nMensagem anterior da Elena: "${ultimaElena.texto.substring(0, 500)}"\n\nEXECUTE usando EXATAMENTE os dados (data, hora, valor) já informados — NÃO recalcule.`
        }
      } else {
        // Mensagem normal (não confirmação) → reset do contador
        confirmRetryRef.current = 0
      }

      if (userText && precisaBuscarHistorico(userText) && !fileSnap) {
        try {
          session.setMensagens(prev => prev.map(m => m.id === aiMsgId ? { ...m, texto: 'ðŸ” Buscando nas conversas anteriores...' } : m))
          const isRelatorio = ['relatório','relatorio','resumo','balanço'].some(kw => userText.toLowerCase().includes(kw))
          const res = await fetch('/api/elena-busca', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ termo: userText, limite: isRelatorio ? 30 : 8 }),
          })
          if (res.ok) {
            const { mensagens: msgsHistorico } = await res.json()
            if (msgsHistorico?.length > 0) {
              const blocoHistorico = msgsHistorico.map((m: any) => {
                const dt = m.created_at ? new Date(m.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
                return `[${dt}] ${m.role === 'ai' ? 'Elena' : 'Sr. Max'}: ${m.texto}`
              }).join('\n---\n')
              promptFinal = `${promptFinal}\n\n[CONVERSAS HISTÓRICAS RELEVANTES]\n${blocoHistorico}`
            }
          }
          session.setMensagens(prev => prev.map(m => m.id === aiMsgId ? { ...m, texto: '...' } : m))
        } catch { /* silencioso */ }
      }

      if (userText && precisaBuscarWeb(userText) && !fileSnap) {
        session.setMensagens(prev => prev.map(m => m.id === aiMsgId ? { ...m, texto: 'ðŸŒ Buscando na internet...' } : m))
        const resultadoWeb = await buscarWeb(userText, contexto)
        if (resultadoWeb) {
          promptFinal = `${promptFinal}\n\n---\n[RESULTADO DA BUSCA NA INTERNET]\n${resultadoWeb}\n---`
        }
        session.setMensagens(prev => prev.map(m => m.id === aiMsgId ? { ...m, texto: '...' } : m))
      }

      // ── Busca dados reais do banco para injetar no prompt ─────
      // Isso resolve: Elena voltando a perguntar dados já salvos,
      // e Elena confundindo/alterando datas e vencimentos de cartões.
        let blocoCartoes = ''
      try {
        const { data: contasMax } = await (supabase.from('contas') as any)
          .select('nome, tipo, dia_vencimento, dia_fechamento, limite, categoria, bandeira')
          .eq('user_id', uid).eq('ativo', true).order('nome', { ascending: true })

        const { data: imoveisMax } = await (supabase.from('imoveis') as any)
          .select('titulo, parcelas_total, parcelas_pagas')
          .eq('user_id', uid).not('parcelas_total', 'is', null)

        if ((contasMax && contasMax.length > 0) || (imoveisMax && imoveisMax.length > 0)) {
          blocoCartoes = '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'
          blocoCartoes += '[DADOS REAIS DO SISTEMA — USE EXATAMENTE ESSES DADOS]\n'
          blocoCartoes += '⚠️ REGRA CRÍTICA: Esses dados já estão cadastrados. NÃO volte a perguntar.\n'
          blocoCartoes += 'NÃO altere datas ou valores sem ordem explícita do Sr. Max.\n\n'

          if (contasMax && contasMax.length > 0) {
            const cartoes   = contasMax.filter((c: any) => c.tipo === 'cartao_credito' || c.tipo === 'cartao_debito')
            const bancarias = contasMax.filter((c: any) => c.tipo !== 'cartao_credito' && c.tipo !== 'cartao_debito')

            if (cartoes.length > 0) {
              blocoCartoes += '💳 CARTÕES CADASTRADOS:\n'
              cartoes.forEach((c: any) => {
                const venc = c.dia_vencimento ? `vencimento: dia ${c.dia_vencimento}` : 'vencimento: não informado'
                const fech = c.dia_fechamento ? ` | fechamento: dia ${c.dia_fechamento}` : ''
                const lim  = c.limite         ? ` | limite: R$ ${Number(c.limite).toLocaleString('pt-BR')}` : ''
                blocoCartoes += `  • "${c.nome}" | ${venc}${fech}${lim}\n`
              })
              blocoCartoes += '\n'
            }

            if (bancarias.length > 0) {
              blocoCartoes += '🏦 CONTAS BANCÁRIAS CADASTRADAS:\n'
              bancarias.forEach((c: any) => {
                blocoCartoes += `  • "${c.nome}" | tipo: ${c.tipo}\n`
              })
              blocoCartoes += '\n'
            }
          }

          if (imoveisMax && imoveisMax.length > 0) {
            blocoCartoes += '🏠 IMÓVEIS PARCELADOS (EM ABERTO):\n'
            imoveisMax.forEach((im: any) => {
              blocoCartoes += `  • "${im.titulo}" | parcelas pagas: ${im.parcelas_pagas||0}/${im.parcelas_total}\n`
            })
            blocoCartoes += '\n'
          }

          blocoCartoes += 'INSTRUÇÕES: NUNCA cadastre novamente algo que já aparece na lista acima.\n'
          blocoCartoes += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        }
      } catch { /* não bloqueia se falhar */ }

      // ── Montar array de mensagens nativo (role/content) ────────
      // Isso dá à IA separação clara de turnos, em vez de contexto plano.
      const mensagensApi: { role: string; content: any }[] = []

      // ── Helper: extrair dados-chave de ações salvas para contexto ──
      const resumirAcoesSalvas = (acoes?: AcaoIA[]): string => {
        if (!acoes || acoes.length === 0) return ''
        return acoes
          .filter(a => a.status === 'saved')
          .map(a => {
            const d = a.dados || {}
            const partes: string[] = [a.tipo]
            if (d.descricao || d.titulo) partes.push(d.descricao || d.titulo)
            if (d.valor) partes.push(`R$ ${Number(d.valor).toFixed(2)}`)
            if (d.parcelas && Number(d.parcelas) > 1) partes.push(`${d.parcelas}x`)
            if (d.parcelas_pagas && d.parcelas_total) partes.push(`parcela ${d.parcelas_pagas}/${d.parcelas_total}`)
            if (d.data) partes.push(d.data)
            if (d.conta_nome) partes.push(`conta: ${d.conta_nome}`)
            if (d.data_inicio) partes.push(d.data_inicio.substring(0, 16))
            return partes.join(' | ')
          })
          .join('; ')
      }

      // Pega últimas 25 mensagens úteis da sessão (sem lixo)
      const msgsUteis = session.mensagens
        .filter(m => m.texto && m.texto !== '...' && !m.texto.startsWith('Olá, Sr. Max!') && !m.texto.startsWith('Histórico carregado'))
        .slice(-25)

      // ── Construir estado da sessão (resumo de tudo já salvo) ────
      const acoesSalvasNaSessao: string[] = []

      for (const m of msgsUteis) {
        if (m.role === 'ai') {
          const t = m.texto
          let content: string

          // Confirmações de salvamento → PRESERVAR dados numéricos
          if (t.includes('✅') || t.includes('Registrado') || t.includes('Registrando') || t.includes('⏳')) {
            const dadosAcoes = resumirAcoesSalvas(m.acoes)
            if (dadosAcoes) {
              content = `[JÁ SALVO: ${dadosAcoes}] — NÃO pedir esses dados de novo`
              acoesSalvasNaSessao.push(dadosAcoes)
            } else {
              const resumo = t.replace(/[✅⏳📋]/g, '').trim().split('\n')[0].substring(0, 200)
              content = `[JÁ SALVO: ${resumo}] — NÃO pedir esses dados de novo`
            }
          } else if (t.includes('📋') || t.includes('🏠 **Imóveis') || t.includes('🚗 **Veículos') || t.includes('💳 **Compromissos') || t.includes('Patrimônio encontrado') || t.includes('Lançamentos')) {
            const resumo = t.replace(/[📋🏠🚗💳]/g, '').trim().split('\n').slice(0, 5).join(' | ').substring(0, 300)
            content = `[LISTOU: ${resumo}] — dados já exibidos`
          } else if (t.startsWith('❌') || t.includes('Ops!')) {
            content = `[ERRO: ${t.substring(0, 120)}]`
          } else {
            content = t.substring(0, 800)
          }
          mensagensApi.push({ role: 'assistant', content })
        } else {
          // Mensagens do USUÁRIO: NUNCA truncar — são os dados de entrada!
          mensagensApi.push({ role: 'user', content: m.texto })
        }
      }

      // ── Injetar resumo de estado da sessão (anti-confusão) ─────
      if (acoesSalvasNaSessao.length > 0) {
        const estadoResumo = `[ESTADO DA SESSÃO — ${acoesSalvasNaSessao.length} registro(s) já salvo(s) nesta conversa]:\n${acoesSalvasNaSessao.map((r, i) => `  ${i + 1}. ${r}`).join('\n')}\n⚠️ NÃO peça dados desses itens novamente. Use EXATAMENTE esses valores se precisar recapitular.`
        mensagensApi.push({ role: 'user', content: `[SISTEMA] ${estadoResumo}` })
      }

      // Adiciona a mensagem atual do usuário
      const userContentParts: any[] = []
      userContentParts.push({ type: 'text', text: promptFinal })
      if (fileSnap?.isImage) {
        userContentParts.push({
          type: 'image_url',
          image_url: { url: `data:${fileSnap.mime || 'image/jpeg'};base64,${fileSnap.base64}`, detail: 'high' },
        })
      }

      mensagensApi.push({
        role: 'user',
        content: fileSnap?.isImage ? userContentParts : promptFinal,
      })

      const body: Record<string, any> = {
        messages: mensagensApi,
        systemInstruction: buildSystemPrompt(session.perfilRef.current, alertas.resumoFinanceiro) + blocoCartoes,
        // model, temperature e max_tokens são controlados pelo route.ts
      }

      sessionMsgCountRef.current += 1
      userMsgCountRef.current   += 1
      sugestaoCountRef.current  += 1

      // ── Fetch com retry automático (1x) ────────────────────────
      const chamarIA = async (): Promise<{ result: string }> => {
        const res = await fetch('/api/openrouter', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || `Erro ${res.status}`)
        return data
      }

      let data: { result: string }
      try {
        data = await chamarIA()
      } catch (firstErr: any) {
        // Retry 1x após 2s (cobre timeout, rate limit, rede instável)
        session.setMensagens(prev => prev.map(m =>
          m.id === aiMsgId ? { ...m, texto: '🔄 Tentando novamente...' } : m
        ))
        await new Promise(r => setTimeout(r, 2000))
        try {
          data = await chamarIA()
        } catch (retryErr: any) {
          // Ambas falharam — erro definitivo
          const errMsg = retryErr?.message || retryErr?.details || retryErr?.error_description || 'Erro desconhecido'
          throw new Error(errMsg)
        }
      }

      const resposta: string = data.result ?? ''
      const acoes = extrairAcoes(resposta)
      const acoesComStatus = acoes.map(a => ({ ...a, status: 'pending' as const }))
      const textoFormatado = formatarTexto(resposta)

      session.setMensagens(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, texto: textoFormatado, acoes: acoesComStatus.length > 0 ? acoesComStatus : undefined }
          : m
      ))

      if (uid) {
        session.salvarHistorico(uid, 'user', userText, undefined, session.sessaoIdRef.current)
        session.salvarHistorico(uid, 'ai', textoFormatado, acoesComStatus.length > 0 ? acoesComStatus : undefined, session.sessaoIdRef.current)
      }

      if (acoesComStatus.length > 0 && uid) {
        setTimeout(() => salvar.executarAcoesAuto(aiMsgId, acoesComStatus, uid), 600)
      }

    } catch (err: any) {
      const errMsg = err?.message || err?.details || err?.error_description || 'Erro desconhecido'
      session.setMensagens(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, texto: `Perdão, chefe. Tive um problema: ${errMsg.substring(0, 120)}. Pode repetir o pedido?` } : m
      ))
    } finally {
      setLoading(false)
      isSendingRef.current = false
      if (voz.modoVozRef.current) {
        setTimeout(() => { if (voz.modoVozRef.current) voz.handlePressMic() }, 1200)
      }
    }
  }, [input, loading, session, salvar, voz, supabase, alertas.resumoFinanceiro]) // eslint-disable-line

  if (!isClient) return null

  // ── JSX ───────────────────────────────────────────────────────
  // (mantenha o JSX exatamente igual ao original a partir da linha 3182)
  // O JSX não foi incluído aqui pois não tem lógica — é pura renderização.
  // Substitua apenas os imports e as chamadas de função/state pelos nomes do hook:

  

  return (
    <>
      {/* Botão Flutuante */}
      <div
        className="fixed z-[100] cursor-grab active:cursor-grabbing"
        style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
        onPointerDown={handlePointerDown}
      >
        <div className="relative">
          {/* Pulso só quando há itens offline pendentes */}
          {offline.offlineQueue.length > 0 && (
            <div className="absolute inset-0 bg-amber-500 rounded-full animate-ping opacity-25" />
          )}
          <div className={cn(
            'w-14 h-14 rounded-full p-0.5 transition-all shadow-[0_8px_20px_rgba(251,191,36,0.4)] bg-page active:scale-95',
            offline.isOnline
              ? 'border-[2.5px] border-amber-400'
              : 'border-[2.5px] border-red-500 shadow-[0_8px_20px_rgba(239,68,68,0.4)]'
          )}>
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=200&auto=format&fit=crop"
              alt="Elena" className="w-full h-full rounded-full object-cover pointer-events-none"
            />
          </div>
          {/* Badge de itens offline pendentes */}
          {offline.offlineQueue.length > 0 ? (
            <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-amber-500 border-2 border-[#080b14] rounded-full flex items-center justify-center">
              <span className="text-[9px] font-black text-black leading-none px-0.5">{offline.offlineQueue.length}</span>
            </div>
          ) : (
            /* Indicador online/offline */
            <div className={cn(
              'absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-[#080b14] rounded-full transition-colors',
              offline.isOnline ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'
            )} />
          )}
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
                  onClick={() => session.setShowHistory(false)}
                />
                <div>
                  <p className="text-sm font-bold text-fg cursor-pointer" onClick={() => session.setShowHistory(false)}>Elena</p>
                  <p className="text-[10px] text-amber-400">Secretária Executiva · Registros automáticos</p>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <button onClick={() => {
                  // Injeta uma mensagem de ajuda se o cliente clicar no botão de interrogação ou abre o painel visual
                  session.setMensagens(prev => [
                    ...prev,
                    {
                      id: String(Date.now()),
                      role: 'ai',
                      texto: `📖 **Guia Rápido de Comandos da Elena Premium** 🚀

Aqui está tudo o que você pode me pedir para fazer:

📅 **Agenda & Lembretes**
* *"Agendar reunião amanhã às 14h"*
* *"Me lembra de ligar pro fornecedor dia 28 às 10h"* (cria alarme)

💰 **Controle Financeiro**
* *"Gastei R$ 150 no mercadinho no pix"*
* *"Recebi R$ 5.000 de pro-labore"*
* *"Transferir R$ 200 do Itaú para o Bradesco"*
* *"Definir meta de gastos de R$ 2.000 em alimentação"*

🏢 **Gestão Empresarial (PJ)**
* *"Gasto de 500 no escritório"*
* *"Faturamento de 15.000 da consultoria"*
* *Nota: Gastos PJ acima de R$ 1.000 exigem sua aprovação verbal!*

📊 **Visão de Negócios & Equipe**
* *"Gerar meu checklist executivo"* (cria tarefas prioritárias)
* *"Como está a performance da equipe?"* (busca ocorrências)
* *"Mostrar meu dashboard financeiro"* (exibe gráficos de barras)
* *"Extrato bancário"* (pode colar o extrato direto no chat!)

🎙️ **Modo Hands-Free (Voz Contínua)**
* Clique no ícone **🎙️∞** para ativar o modo contínuo de voz (ótimo para usar no trânsito!).`
                    }
                  ])
                }} title="Ver guia de recursos da Elena" className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-amber-400 hover:bg-amber-400/10 transition-colors text-xs">❓</button>
                <button onClick={session.loadSessoes} title="Ver conversas passadas" className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-blue-400 hover:bg-blue-400/10 transition-colors text-xs">🗂️</button>
                <button onClick={session.handleClearChat} title="Nova conversa (iniciar novo assunto)" className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-emerald-400 hover:bg-emerald-400/10 transition-colors text-xs">✨</button>
                <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-red-400 hover:bg-red-400/10 text-sm">✕</button>
              </div>
            </div>

            {/* Banner Offline / Sync pendente */}
            {!offline.isOnline ? (
              <div className="px-3 py-1.5 bg-red-500/15 border-b border-red-500/20 flex items-center gap-2 shrink-0">
                <span className="text-red-400 text-xs animate-pulse">📵</span>
                <p className="text-[10px] text-red-400 font-semibold flex-1">
                  Sem internet {offline.offlineQueue.length > 0 ? `— ${offline.offlineQueue.length} item(s) na fila` : '— registros serão salvos ao reconectar'}
                </p>
              </div>
            ) : offline.offlineQueue.length > 0 ? (
              <div className="px-3 py-1.5 bg-amber-500/15 border-b border-amber-500/20 flex items-center gap-2 shrink-0">
                <span className="text-amber-400 text-xs">📶</span>
                <p className="text-[10px] text-amber-400 font-semibold flex-1">
                  {offline.offlineQueue.length} item(s) aguardando sync...
                </p>
                <button
                  onClick={offline.processarFilaOffline}
                  className="text-[9px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full hover:bg-amber-500/30 transition-colors"
                >
                  Sync agora
                </button>
              </div>
            ) : null}


            {/* View do Histórico de Conversas */}
            {session.showHistory ? (
              <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#0a0d16]">
                <p className="text-xs font-semibold text-fg-secondary px-2 mb-3 uppercase tracking-wider">Histórico de Chats</p>
                {session.sessoesAnteriores.map(s => (
                  <button
                    key={s.sid}
                    onClick={() => session.loadSpecificSession(s.sid)}
                    className={cn("w-full text-left p-3 rounded-xl border transition-all", s.sid === session.sessaoId ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/10 text-fg")}
                  >
                    <p className="text-xs font-semibold truncate mb-1">{s.resumo.replace(/```json[\s\S]*?```/g, '').substring(0, 60) || 'Conversa sem título'}</p>
                    <p className="text-[10px] text-fg-tertiary">{new Date(s.data).toLocaleString('pt-BR')}</p>
                  </button>
                ))}
                {session.sessoesAnteriores.length === 0 && (
                  <p className="text-xs text-fg-tertiary text-center py-10">Nenhuma conversa encontrada.</p>
                )}
              </div>
            ) : (
              <>
                {/* Offline Form ou Chat Normal */}
                {!offline.isOnline ? (
                  <div className="flex-1 overflow-y-auto p-4 bg-[#0a0d16] flex flex-col gap-3">
                    {/* Header offline */}
                    <div className="text-center pt-2 pb-1">
                      <div className="w-11 h-11 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl mx-auto mb-2">📵</div>
                      <p className="text-sm font-bold text-fg">Modo Offline</p>
                      <p className="text-[11px] text-fg-tertiary mt-0.5">Registre aqui — sincroniza ao reconectar</p>
                    </div>

                    {/* Tipo */}
                    <div className="flex gap-1.5">
                      {(['gasto', 'receita', 'agenda'] as const).map(t => (
                        <button
                          key={t}
                          onClick={() => offline.setOfflineForm(prev => ({ ...prev, tipo: t }))}
                          className={cn(
                            'flex-1 py-2 rounded-lg text-[11px] font-bold transition-all',
                            offline.offlineForm.tipo === t
                              ? t === 'gasto'   ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : t === 'receita' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                              : 'bg-white/5 text-fg-tertiary border border-white/5 hover:border-white/10'
                          )}
                        >
                          {t === 'gasto' ? '💸 Gasto' : t === 'receita' ? '💰 Receita' : '📅 Agenda'}
                        </button>
                      ))}
                    </div>

                    {/* Valor */}
                    {offline.offlineForm.tipo !== 'agenda' && (
                      <input
                        type="number" inputMode="decimal"
                        placeholder="Valor (R$)"
                        value={offline.offlineForm.valor}
                        onChange={e => offline.setOfflineForm(prev => ({ ...prev, valor: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-fg placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 transition-colors"
                      />
                    )}

                    {/* Descrição / Título */}
                    <input
                      type="text"
                      placeholder={offline.offlineForm.tipo === 'agenda' ? 'Título do evento' : 'Descrição'}
                      value={offline.offlineForm.descricao}
                      onChange={e => offline.setOfflineForm(prev => ({ ...prev, descricao: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-fg placeholder-zinc-600 focus:outline-none focus:border-amber-400/50 transition-colors"
                    />

                    {/* Data+Hora ou Categoria */}
                    {offline.offlineForm.tipo === 'agenda' ? (
                      <div className="flex gap-2">
                        <input type="date" value={offline.offlineForm.data}
                          onChange={e => offline.setOfflineForm(prev => ({ ...prev, data: e.target.value }))}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-fg focus:outline-none focus:border-amber-400/50"
                        />
                        <input type="time" value={offline.offlineForm.hora}
                          onChange={e => offline.setOfflineForm(prev => ({ ...prev, hora: e.target.value }))}
                          className="w-[90px] bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-fg focus:outline-none focus:border-amber-400/50"
                        />
                      </div>
                    ) : (
                      <select value={offline.offlineForm.categoria}
                        onChange={e => offline.setOfflineForm(prev => ({ ...prev, categoria: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus:border-amber-400/50"
                      >
                        {offline.offlineForm.tipo === 'gasto' ? (<>
                          <option value="alimentacao">🍽️ Alimentação</option>
                          <option value="transporte">🚗 Transporte</option>
                          <option value="saude">❤️ Saúde</option>
                          <option value="lazer">🎮 Lazer</option>
                          <option value="moradia">🏠 Moradia</option>
                          <option value="tecnologia">💻 Tecnologia</option>
                          <option value="outros">📦 Outros</option>
                        </>) : (<>
                          <option value="pro_labore">💼 Pró-labore</option>
                          <option value="freelance">🔧 Freelance</option>
                          <option value="investimentos">📈 Investimentos</option>
                          <option value="aluguel">🏠 Aluguel</option>
                          <option value="vendas">🛒 Vendas</option>
                          <option value="outros">📦 Outros</option>
                        </>)}
                      </select>
                    )}

                    {/* Botão salvar */}
                    <button
                      onClick={offline.salvarOffline}
                      disabled={!offline.offlineForm.descricao.trim() || (offline.offlineForm.tipo !== 'agenda' && !offline.offlineForm.valor)}
                      className={cn(
                        'w-full py-2.5 rounded-xl text-sm font-bold transition-all',
                        offline.offlineSaved
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 disabled:opacity-30 disabled:cursor-not-allowed'
                      )}
                    >
                      {offline.offlineSaved ? '✅ Salvo na fila!' : '📥 Salvar na Fila Offline'}
                    </button>

                    {/* Fila pendente */}
                    {offline.offlineQueue.length > 0 && (
                      <div className="bg-white/3 rounded-xl p-3 border border-white/5">
                        <p className="text-[10px] text-fg-tertiary uppercase tracking-wider font-semibold mb-2">
                          ⏳ Aguardando sync ({offline.offlineQueue.length})
                        </p>
                        <div className="space-y-1.5">
                          {offline.offlineQueue.slice(0, 6).map((item: any, i: number) => (
                            <div key={i} className="flex items-center gap-2 text-[11px]">
                              <span className="shrink-0">
                                {item.tipo === 'gasto' ? '💸' : item.tipo === 'receita' ? '💰' : '📅'}
                              </span>
                              <span className="flex-1 text-fg-secondary truncate">
                                {String(item.acao.descricao || item.acao.titulo || item.tipo)}
                              </span>
                              {item.acao.valor && (
                                <span className="text-amber-400 shrink-0 font-semibold">
                                  R$ {Number(item.acao.valor).toFixed(2)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
              {session.mensagens.map(msg => {
                const isAi = msg.role === 'ai'

                // ── Card de Confirmação de Salvamento ────────────────────
                if (msg.confirmacao) {
                  const c = msg.confirmacao
                  const podeDesfazer = !!(c.ultimoId && c.ultimaTabela)
                  return (
                    <div key={msg.id} className="flex flex-col items-start">
                      <div className="w-full max-w-[92%] rounded-2xl rounded-tl-sm overflow-hidden border border-emerald-500/25 bg-emerald-500/5">
                        {/* Cabeçalho do card */}
                        <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border-b border-emerald-500/15">
                          <span className="text-base leading-none">{c.icone}</span>
                          <span className="text-[11px] font-bold text-emerald-400 flex-1">✅ Registrado com sucesso</span>
                          <span className="text-[9px] text-emerald-400/60 font-semibold uppercase tracking-wider">{c.modulo}</span>
                        </div>
                        {/* Corpo do card */}
                        <div className="px-3 py-2 space-y-1">
                          {c.descricao && (
                            <p className="text-xs text-fg font-medium truncate">📋 {c.descricao}</p>
                          )}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                            {c.valor !== undefined && (
                              <span className="text-[11px] text-amber-400 font-bold">R$ {c.valor.toFixed(2)}</span>
                            )}
                            {c.contaNome && (
                              <span className="text-[11px] text-fg-secondary">💳 {c.contaNome}</span>
                            )}
                            {c.data && (
                              <span className="text-[11px] text-fg-tertiary">📅 {c.data}</span>
                            )}
                            {c.categoria && (
                              <span className="text-[11px] text-fg-tertiary">#{c.categoria}</span>
                            )}
                          </div>
                        </div>
                        {/* Botões de ação */}
                        <div className="px-3 py-2 border-t border-emerald-500/10 flex gap-2">
                          {c.rota && (
                            <button
                              onClick={() => { window.location.href = c.rota! }}
                              className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors flex items-center justify-center gap-1"
                            >
                              Ver em {c.modulo} →
                            </button>
                          )}
                          {podeDesfazer && (
                            <button
                              onClick={async () => {
                                try {
                                  await (supabase.from(c.ultimaTabela!) as any).delete().eq('id', c.ultimoId!)
                                  session.setMensagens(prev => prev.filter(m => m.id !== msg.id))
                                  session.setMensagens(prev => [...prev, {
                                    id: 'undo-ok-' + Date.now(),
                                    role: 'ai' as const,
                                    texto: '↩️ **Registro desfeito com sucesso!** O lançamento foi removido.',
                                  }])
                                  window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))
                                } catch {
                                  session.setMensagens(prev => [...prev, {
                                    id: 'undo-err-' + Date.now(),
                                    role: 'ai' as const,
                                    texto: '❌ Não foi possível desfazer. Remova manualmente no módulo correspondente.',
                                  }])
                                }
                              }}
                              className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1"
                            >
                              ↩ Desfazer
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                }

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
                          {isAi ? (
                            <span dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(msg.texto) }} />
                          ) : (
                            msg.texto
                          )}
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
                )} {/* fim offline/online */}

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

            {/* Input — desativado quando offline */}
            {!offline.isOnline ? (
              <div className="p-3 border-t border-border-subtle shrink-0">
                <div className="flex items-center justify-center gap-2 bg-white/3 rounded-xl py-2.5 border border-white/5">
                  <span className="text-xs">📵</span>
                  <p className="text-[11px] text-fg-tertiary">Chat indisponível offline — use o formulário acima</p>
                </div>
              </div>
            ) : (
            <div className="p-3 border-t border-border-subtle shrink-0">
              {/* Input oculto para arquivo */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processarArquivo(f, setAttachedFile, setProcessingFile); e.target.value = '' }}
              />
              <div className="flex items-center gap-2 bg-page rounded-xl p-1 border border-border-subtle focus-within:border-amber-500/40 transition-colors">
                {/* Botão microfone (Toggle) — iOS Safari suporta webkitSpeechRecognition */}
                <button
                  onClick={voz.toggleMic}
                  className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all',
                    voz.isListening ? 'bg-red-500 text-white animate-pulse' : 'text-fg-tertiary hover:text-amber-400')}
                  title={voz.isListening ? 'Parar e enviar' : 'Clique para falar'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </button>
                {/* Botão Modo Voz Contínua */}
                <button
                  onClick={() => {
                    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
                    if (isIOS) {
                      session.setMensagens(prev => [...prev, {
                        id: `ios-${Date.now()}`, role: 'ai',
                        texto: '📱 **Modo Mãos-Livres** não é suportado no iPhone (restrição da Apple).\n\nUse o botão do **microfone 🎙️** para falar normalmente!',
                      }])
                      return
                    }
                    const novo = !voz.modoVozContinuo
                    voz.setModoVozContinuo(novo)
                    voz.modoVozRef.current = novo
                    if (novo && !voz.isListening) voz.handlePressMic()
                    if (!novo && voz.isListening) voz.handleReleaseMic()
                  }}
                  className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all text-[10px] font-bold',
                    voz.modoVozContinuo ? 'bg-emerald-500 text-white animate-pulse' : 'text-fg-tertiary hover:text-emerald-400 opacity-60')}
                  title={voz.modoVozContinuo ? 'Modo mãos-livres ATIVO — clique para desativar' : 'Ativar modo mãos-livres (Elena ouve automaticamente)'}
                >
                  ∞
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
                    voz.isListening ? '🎙️ Ouvindo... clique novamente no microfone para enviar' :
                    attachedFile ? 'Descreva o que quer saber...' :
                    'Diga um comando para a Elena...'
                  }
                  // Fix #5: correção ortográfica nativa browser/mobile
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  autoComplete="off"
                  // Fix #3: mostra texto capturado em tempo real
                  value={voz.isListening ? voz.interimTranscript : input}
                  onChange={e => !voz.isListening && setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !voz.isListening && handleEnviar()}
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
            )} {/* fim input offline/online */}
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

// ── Exportação com ErrorBoundary ─────────────────────────────
// Envolve o widget com ErrorBoundary para não quebrar a página
export function SecretariaFlutuante() {
  return (
    <ElenaErrorBoundary>
      <SecretariaFlutuanteWidget />
    </ElenaErrorBoundary>
  )
}
