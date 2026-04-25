'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────
interface Msg { id: string; role: 'ai' | 'user'; texto: string; acoes?: AcaoIA[] }
interface AcaoIA {
  tipo: 'gasto' | 'receita' | 'agenda' | 'ocorrencia' | 'gasto_empresa' | 'receita_empresa' | 'ideia'
  dados: Record<string, any>
  label: string
  status?: 'pending' | 'saving' | 'saved' | 'error'
  errorMsg?: string
}

// IDs das contas e categorias padrão da empresa (obtidos do banco)
const CONTA_PADRAO_ID = 'e1371ffd-6ada-485c-9a21-53da97fe31ac'     // Bradesco PJ
const CAT_DESPESA_ID  = 'd4f05276-7633-49b3-9d72-09fb0fa07fbe'     // Despesas Operacionais
const CAT_RECEITA_ID  = '2774932e-75c8-4b7e-b88f-12a6f1a0744a'     // Receita Operacional

// ── System Prompt gerado dinamicamente com a data atual ──
function buildSystemPrompt(): string {
  const agora = new Date()
  const dataAtual = agora.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
  const anoAtual = agora.getFullYear()
  const mesAtual = String(agora.getMonth() + 1).padStart(2, '0')
  const diaAtual = String(agora.getDate()).padStart(2, '0')
  const amanha = new Date(agora); amanha.setDate(amanha.getDate() + 1)
  const amanhaStr = `${amanha.getFullYear()}-${String(amanha.getMonth()+1).padStart(2,'0')}-${String(amanha.getDate()).padStart(2,'0')}`

  return `Você é a Elena, Secretária Executiva Premium do Sistema Cajado.
Você pode REGISTRAR dados reais no sistema quando o chefe solicitar.

⚠️ DATA ATUAL: ${dataAtual} (${anoAtual}-${mesAtual}-${diaAtual})
⚠️ IMPORTANTE: Sempre use o ano ${anoAtual} nas datas. NUNCA use anos anteriores.

AÇÕES ESTRUTURADAS — inclua ao final da resposta:

GASTO PESSOAL (pessoa física do chefe):
\`\`\`json
{"acao":"gasto","valor":50.00,"descricao":"Almoço","categoria":"alimentacao","forma_pagamento":"pix"}
\`\`\`

RECEITA PESSOAL:
\`\`\`json
{"acao":"receita","valor":1500.00,"descricao":"Freelance","categoria":"pro_labore"}
\`\`\`

GASTO DA EMPRESA (pessoa jurídica / Cajado):
\`\`\`json
{"acao":"gasto_empresa","valor":300.00,"descricao":"Aluguel escritório","categoria":"operacional"}
\`\`\`

RECEITA DA EMPRESA:
\`\`\`json
{"acao":"receita_empresa","valor":5000.00,"descricao":"Serviço prestado","categoria":"servicos"}
\`\`\`

AGENDA:
\`\`\`json
{"acao":"agenda","titulo":"Reunião com cliente","data_inicio":"${amanhaStr}T14:00:00","tipo":"reuniao"}
\`\`\`

OCORRÊNCIA DA EQUIPE:
\`\`\`json
{"acao":"ocorrencia","tipo":"erro","descricao":"Colaborador atrasado","colaborador_nome":"Pedro","impacto":"medio","modulo":"operacional"}
\`\`\`

CATEGORIAS para gastos pessoais: alimentacao, transporte, saude, lazer, educacao, moradia, vestuario, tecnologia, investimento, outros
CATEGORIAS para receitas pessoais: pro_labore, freelance, investimentos, aluguel, vendas, outros
CATEGORIAS para empresa: operacional, marketing, pessoal, infraestrutura, impostos, outros
FORMAS DE PAGAMENTO: pix, cartao_debito, cartao_credito, dinheiro, transferencia

IDEIA / PROJETO (pedido para guardar uma ideia):
\`\`\`json
{"acao":"ideia","titulo":"App de rastreamento de treinos de bicicleta","descricao":"Ideia surgida pedalando: criar app que registra rota, cadência e evolução","categoria":"produto"}
\`\`\`

CATEGORIAS para ideias: negocio, produto, pessoal, financeiro, saude, criativo, geral

REGRAS:
- PERGUNTE se o gasto é PESSOAL ou DA EMPRESA antes de registrar
- Se faltarem dados essenciais, PERGUNTE antes de gerar o JSON
- Para ocorrência: pergunte colaborador, tipo (erro/acerto/alerta/elogio), impacto (baixo/medio/alto), descrição
- Responda SEMPRE em português brasileiro, tom profissional e conciso
- Quando tiver todos os dados, inclua o bloco JSON e diga que vai registrar agora
- Nas datas, SEMPRE use o ano ${anoAtual}`
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
        acoes.push({ tipo: 'gasto', dados: d, label: `💸 Gasto PF R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}`, status: 'pending' })
      } else if (d.acao === 'receita') {
        acoes.push({ tipo: 'receita', dados: d, label: `💰 Receita PF R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}`, status: 'pending' })
      } else if (d.acao === 'gasto_empresa') {
        acoes.push({ tipo: 'gasto_empresa', dados: d, label: `🏢💸 Despesa Empresa R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}`, status: 'pending' })
      } else if (d.acao === 'receita_empresa') {
        acoes.push({ tipo: 'receita_empresa', dados: d, label: `🏢💰 Receita Empresa R$ ${Number(d.valor).toFixed(2)} — ${d.descricao}`, status: 'pending' })
      } else if (d.acao === 'ideia') {
        acoes.push({ tipo: 'ideia', dados: d, label: `💡 Ideia: ${d.titulo}`, status: 'pending' })
      } else if (d.acao === 'agenda') {
        acoes.push({ tipo: 'agenda', dados: d, label: `📅 ${d.titulo}`, status: 'pending' })
      } else if (d.acao === 'ocorrencia') {
        acoes.push({ tipo: 'ocorrencia', dados: d, label: `📋 Ocorrência ${d.tipo}: ${d.descricao?.substring(0, 40)}`, status: 'pending' })
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
  const [colaboradores, setColaboradores] = useState<{id: string, nome: string}[]>([])
  const [mensagens, setMensagens] = useState<Msg[]>([
    { id: '1', role: 'ai', texto: 'Olá, chefe! 👋 Sou a **Elena**, sua Secretária Executiva.\n\nPosso **registrar gastos, receitas, agenda e ocorrências** direto no sistema.\n\nExemplos:\n• _"Gastei R$ 80 de gasolina no PIX"_\n• _"Agendar reunião amanhã às 14h"_\n• _"Abrir ocorrência de erro para o Pedro"_' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const transcriptRef = useRef('')
  const historyLoadedRef = useRef(false)
  // sessão = dia atual, agrupa mensagens por dia
  const sessaoId = new Date().toISOString().split('T')[0]

  useEffect(() => {
    setPos({ x: window.innerWidth - 80, y: window.innerHeight - 150 })
    setIsClient(true)
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const uid = data.user.id
      setUserId(uid)

      // Carrega histórico de conversas do banco
      if (!historyLoadedRef.current) {
        historyLoadedRef.current = true
        const { data: hist } = await (supabase
          .from('elena_conversas') as any)
          .select('id, role, texto, acoes, created_at')
          .eq('user_id', uid)
          .order('created_at', { ascending: false })
          .limit(40)
        if (hist && hist.length > 0) {
          const historico: Msg[] = (hist as any[]).reverse().map((r: any) => ({
            id: r.id,
            role: r.role as 'ai' | 'user',
            texto: r.texto,
            acoes: r.acoes ?? undefined,
          }))
          setMensagens(prev => [
            { id: '1', role: 'ai', texto: `Olá, chefe! 👋 Já carregamos ${hist.length} mensagens do seu histórico. Do que precisa hoje?` },
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

  const salvarAcao = useCallback(async (msgId: string, acaoIdx: number, acao: AcaoIA, uid: string) => {
    try {
      if (acao.tipo === 'gasto') {
        // Gasto PESSOAL — tabela gastos_pessoais
        // Colunas: id, user_id, descricao, valor, categoria, forma_pagamento, data, recorrente, notas
        const formasPagValidas = ['pix','cartao_debito','cartao_credito','dinheiro','transferencia']
        const forma = formasPagValidas.includes(acao.dados.forma_pagamento) ? acao.dados.forma_pagamento : 'pix'
        const { error } = await (supabase.from('gastos_pessoais') as any).insert({
          user_id: uid,
          descricao: acao.dados.descricao || 'Gasto via Elena',
          valor: Number(acao.dados.valor) || 0,
          categoria: acao.dados.categoria || 'outros',
          forma_pagamento: forma,
          data: new Date().toISOString().split('T')[0],
          recorrente: false,
          notas: 'Registrado pela Elena',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'receita') {
        // Receita PESSOAL — tabela receitas_pessoais
        // Colunas: id, user_id, descricao, valor, categoria, recorrente, data, notas
        const { error } = await (supabase.from('receitas_pessoais') as any).insert({
          user_id: uid,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor: Number(acao.dados.valor) || 0,
          categoria: acao.dados.categoria || 'outros',
          data: new Date().toISOString().split('T')[0],
          recorrente: false,
          notas: 'Registrado pela Elena',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'gasto_empresa') {
        // Despesa EMPRESA — tabela lancamentos
        // Colunas: conta_id, descricao, valor, tipo, regime, status, data_competencia, data_caixa, categoria_id, created_by
        const hoje = new Date().toISOString().split('T')[0]
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: CONTA_PADRAO_ID,
          descricao: acao.dados.descricao || 'Despesa via Elena',
          valor: Number(acao.dados.valor) || 0,
          tipo: 'despesa',
          regime: 'caixa',
          status: 'validado',
          data_competencia: hoje,
          data_caixa: hoje,
          categoria_id: CAT_DESPESA_ID,
          created_by: uid,
          observacoes: 'Registrado pela Elena',
        })
        if (error) throw new Error(error.message)
        setAcaoStatus(msgId, acaoIdx, 'saved')

      } else if (acao.tipo === 'receita_empresa') {
        // Receita EMPRESA — tabela lancamentos
        const hoje = new Date().toISOString().split('T')[0]
        const { error } = await (supabase.from('lancamentos') as any).insert({
          conta_id: CONTA_PADRAO_ID,
          descricao: acao.dados.descricao || 'Receita via Elena',
          valor: Number(acao.dados.valor) || 0,
          tipo: 'receita',
          regime: 'caixa',
          status: 'validado',
          data_competencia: hoje,
          data_caixa: hoje,
          categoria_id: CAT_RECEITA_ID,
          created_by: uid,
          observacoes: 'Registrado pela Elena',
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
      }
    } catch (err: any) {
      setAcaoStatus(msgId, acaoIdx, 'error', err.message)
    }
  }, [supabase, colaboradores])

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
  const salvarHistorico = useCallback(async (uid: string, role: 'user' | 'ai', texto: string, acoes?: AcaoIA[]) => {
    if (!uid || !texto || texto === '...') return
    await (supabase.from('elena_conversas') as any).insert({
      user_id: uid,
      role,
      texto,
      acoes: acoes && acoes.length > 0 ? acoes : null,
      sessao_id: sessaoId,
    })
  }, [supabase, sessaoId])

  // ── Enviar ────────────────────────────────────────────────
  const handleEnviar = useCallback(async (textToSubmit?: string) => {
    const userText = (textToSubmit ?? input).trim()
    if (!userText || loading) return
    const aiMsgId = (Date.now() + 1).toString()
    setMensagens(prev => [
      ...prev,
      { id: Date.now().toString(), role: 'user', texto: userText },
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

    try {
      // Contexto: usa todas as mensagens em memória (inclui histórico carregado do DB)
      const contexto = mensagens
        .filter(m => m.texto && m.texto !== '...')
        .slice(-20)
        .map(m => `${m.role === 'ai' ? 'Elena' : 'Chefe'}: ${m.texto.substring(0, 300)}`)
        .join('\n')
      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText, context: contexto, systemInstruction: buildSystemPrompt() })
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
        salvarHistorico(uid, 'user', userText)
        salvarHistorico(uid, 'ai', textoFormatado, acoesComStatus.length > 0 ? acoesComStatus : undefined)
      }

      // Auto-save ações após 600ms
      if (acoesComStatus.length > 0 && uid) {
        setTimeout(() => executarAcoesAuto(aiMsgId, acoesComStatus, uid), 600)
      }
    } catch {
      setMensagens(prev => prev.map(m =>
        m.id === aiMsgId ? { ...m, texto: 'Perdão, chefe. Tive um problema de comunicação. Tente novamente.' } : m
      ))
    } finally {
      setLoading(false)
    }
  }, [input, loading, mensagens, userId, supabase, executarAcoesAuto, salvarHistorico])

  // ── Microfone ─────────────────────────────────────────────
  const handlePressMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) { alert('Use o Google Chrome para usar o microfone.'); return }
    // Para qualquer reconhecimento anterior
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} }
    transcriptRef.current = ''
    setInput('')
    const r = new SR()
    recognitionRef.current = r
    r.lang = 'pt-BR'
    r.continuous = true
    r.interimResults = true
    r.onstart = () => setIsListening(true)
    r.onresult = (e: any) => {
      // Acumula só os resultados finais + o interim atual para evitar duplicações
      let finalText = ''
      let interimText = ''
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
        else interimText += e.results[i][0].transcript
      }
      const combined = (finalText + interimText).trim()
      setInput(combined)
      transcriptRef.current = finalText + interimText
    }
    r.onerror = () => setIsListening(false)
    r.onend = () => setIsListening(false)
    r.start()
  }

  const handleReleaseMic = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      recognitionRef.current = null
    }
    setIsListening(false)
    // Aguarda o último onresult disparar antes de enviar
    setTimeout(() => {
      const text = transcriptRef.current.trim()
      if (text) handleEnviar(text)
      transcriptRef.current = ''
    }, 400)
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
                  alt="Elena" className="w-8 h-8 rounded-full object-cover border border-amber-400/40"
                />
                <div>
                  <p className="text-sm font-bold text-fg">Elena</p>
                  <p className="text-[10px] text-amber-400">Secretária Executiva · Registros automáticos</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-fg-tertiary hover:text-fg text-sm">✕</button>
            </div>

            {/* Chat */}
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
                      ) : msg.texto}
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

            {/* Input */}
            <div className="p-3 border-t border-border-subtle shrink-0">
              <div className="flex items-center gap-2 bg-page rounded-xl p-1 border border-border-subtle focus-within:border-amber-500/40 transition-colors">
                <button
                  onPointerDown={handlePressMic} onPointerUp={handleReleaseMic} onPointerLeave={handleReleaseMic}
                  style={{ touchAction: 'none' }}
                  className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all',
                    isListening ? 'bg-red-500 text-white animate-pulse' : 'text-fg-tertiary hover:text-amber-400')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </button>
                <input
                  type="text"
                  className="flex-1 bg-transparent border-0 focus:ring-0 text-xs text-fg placeholder-zinc-600 h-8"
                  placeholder="Diga um comando para a Elena..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEnviar()}
                />
                <button
                  onClick={() => handleEnviar()}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 flex items-center justify-center shrink-0 disabled:opacity-40 transition-colors"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpElena {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
    </>
  )
}
