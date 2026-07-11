// ── elena-history-compressor.ts ─────────────────────────────
// Comprime o histórico de mensagens para manter a janela de contexto
// sob controle em conversas longas. Divide em "recente" (completo) +
// "passado" (resumo estruturado), evitando que a IA confunda dados.

import type { AcaoIA, Msg } from './elena-types'

/** Mensagem formatada para a API OpenRouter */
export interface ApiMsg {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** Resultado da compressão do histórico */
export interface HistoryBlock {
  /** Resumo comprimido do histórico antigo */
  resumoPassado: string
  /** Últimas N mensagens completas (role/content) */
  mensagensRecentes: ApiMsg[]
  /** Tópico ativo detectado na última interação (se houver) */
  topicoAtivo: string | null
  /** Ações pendentes que aguardam confirmação */
  acoesPendentes: AcaoIA[]
  /** Lista de ações já salvas nesta sessão (para anti-repetição) */
  acoesSalvas: string[]
}

// ── Helpers ────────────────────────────────────────────────────

/** Extrai resumo dos dados de uma ação salva */
function resumirAcao(acao: AcaoIA): string {
  const d = acao.dados || {}
  const partes: string[] = [acao.tipo]
  if (d.descricao || d.titulo) partes.push(d.descricao || d.titulo)
  if (d.valor) partes.push(`R$ ${Number(d.valor).toFixed(2)}`)
  if (d.parcelas && Number(d.parcelas) > 1) partes.push(`${d.parcelas}x`)
  if (d.parcelas_pagas && d.parcelas_total) partes.push(`parcela ${d.parcelas_pagas}/${d.parcelas_total}`)
  if (d.data) partes.push(d.data)
  if (d.conta_nome) partes.push(`conta: ${d.conta_nome}`)
  if (d.data_inicio) partes.push(d.data_inicio.substring(0, 16))
  if (d.ticker) partes.push(d.ticker.toUpperCase())
  return partes.join(' | ')
}

/** Classifica uma mensagem da IA em categorias para compressão */
function classificarMsgIA(msg: Msg): 'salvamento' | 'listagem' | 'erro' | 'pergunta' | 'resposta' {
  const t = msg.texto || ''
  if (t.includes('✅') || t.includes('⏳') || t.includes('Registrado') || t.includes('Registrando')) return 'salvamento'
  if (t.includes('📋') || t.includes('Patrimônio encontrado') || t.includes('Lançamentos') || t.includes('**Imóveis') || t.includes('**Veículos')) return 'listagem'
  if (t.startsWith('❌') || t.includes('Ops!') || t.includes('Erro') || t.includes('não consegui')) return 'erro'
  if (t.includes('?') && !t.includes('✅')) return 'pergunta'
  return 'resposta'
}

/** Comprime uma mensagem antiga da IA para um resumo curto */
function comprimirMsgIA(msg: Msg): string {
  const tipo = classificarMsgIA(msg)
  const t = msg.texto || ''

  switch (tipo) {
    case 'salvamento': {
      // Extrair dados das ações salvas
      const acoesSalvas = msg.acoes?.filter(a => a.status === 'saved') || []
      if (acoesSalvas.length > 0) {
        return `[JÁ SALVO: ${acoesSalvas.map(resumirAcao).join('; ')}]`
      }
      // Fallback: resumo do texto
      const resumo = t.replace(/[✅⏳📋🔄]/g, '').trim().split('\n')[0].substring(0, 150)
      return `[JÁ SALVO: ${resumo}]`
    }
    case 'listagem': {
      // Manter apenas cabeçalho + contagem de itens
      const linhas = t.split('\n').filter(l => l.trim())
      const contagem = linhas.filter(l => l.trim().startsWith('•') || l.trim().startsWith('-')).length
      const titulo = linhas[0]?.substring(0, 100) || 'Lista'
      return `[LISTOU ${contagem} itens: ${titulo}]`
    }
    case 'erro':
      return `[ERRO: ${t.substring(0, 100)}]`
    case 'pergunta':
      return `[ELENA PERGUNTOU: ${t.substring(0, 200)}]`
    default:
      return t.substring(0, 200)
  }
}

// ── Compressor principal ──────────────────────────────────────

const MAX_MENSAGENS_RECENTES = 6

/**
 * Comprime o histórico de mensagens da Elena para otimizar a janela de contexto.
 *
 * - Últimas `MAX_MENSAGENS_RECENTES` mensagens vão COMPLETAS
 * - Mensagens anteriores são comprimidas em um resumo estruturado
 * - Ações salvas/pendentes são extraídas para referência rápida
 *
 * @param mensagens - Todas as mensagens da sessão atual
 * @returns HistoryBlock com resumo + mensagens recentes + metadados
 */
export function comprimirHistorico(mensagens: Msg[]): HistoryBlock {
  // Filtrar mensagens úteis (sem placeholder, sem saudação inicial)
  const msgsUteis = mensagens.filter(m =>
    m.texto &&
    m.texto !== '...' &&
    !m.texto.startsWith('Olá, Sr. Max! 👋') &&
    !m.texto.startsWith('Histórico carregado')
  )

  // Separar recentes e passado
  const totalUteis = msgsUteis.length
  const recentes = msgsUteis.slice(-MAX_MENSAGENS_RECENTES)
  const passado = totalUteis > MAX_MENSAGENS_RECENTES
    ? msgsUteis.slice(0, totalUteis - MAX_MENSAGENS_RECENTES)
    : []

  // ── Processar mensagens recentes (completas) ────────────────
  const mensagensRecentes: ApiMsg[] = recentes.map(m => {
    if (m.role === 'ai') {
      const tipo = classificarMsgIA(m)
      let content: string

      if (tipo === 'salvamento') {
        const acoesSalvas = m.acoes?.filter(a => a.status === 'saved') || []
        if (acoesSalvas.length > 0) {
          content = `[JÁ SALVO: ${acoesSalvas.map(resumirAcao).join('; ')}] — NÃO pedir esses dados de novo`
        } else {
          const resumo = m.texto.replace(/[✅⏳📋]/g, '').trim().split('\n')[0].substring(0, 200)
          content = `[JÁ SALVO: ${resumo}] — NÃO pedir esses dados de novo`
        }
      } else if (tipo === 'listagem') {
        const resumo = m.texto.split('\n').slice(0, 8).join('\n').substring(0, 500)
        content = `[LISTOU DADOS: ${resumo}] — dados já exibidos`
      } else if (tipo === 'erro') {
        content = `[ERRO: ${m.texto.substring(0, 150)}]`
      } else {
        content = m.texto.substring(0, 600)
      }

      return { role: 'assistant' as const, content }
    }
    // Mensagens do USUÁRIO: nunca truncar (são dados de entrada)
    return { role: 'user' as const, content: m.texto }
  })

  // ── Processar histórico antigo (comprimido) ─────────────────
  const acoesSalvas: string[] = []
  const linhasResumo: string[] = []

  for (const m of passado) {
    if (m.role === 'ai') {
      // Coletar ações salvas
      const saved = m.acoes?.filter(a => a.status === 'saved') || []
      saved.forEach(a => acoesSalvas.push(resumirAcao(a)))

      // Comprimir texto
      const resumo = comprimirMsgIA(m)
      if (resumo) linhasResumo.push(`  Elena: ${resumo}`)
    } else {
      // Mensagens do usuário no passado: manter resumo curto
      linhasResumo.push(`  Sr. Max: ${m.texto.substring(0, 150)}`)
    }
  }

  // Montar resumo do passado
  let resumoPassado = ''
  if (passado.length > 0) {
    resumoPassado = `[RESUMO DE ${passado.length} MENSAGENS ANTERIORES NESTA SESSÃO]\n`
    resumoPassado += linhasResumo.join('\n')

    if (acoesSalvas.length > 0) {
      resumoPassado += `\n\n[${acoesSalvas.length} REGISTRO(S) JÁ SALVOS NESTA CONVERSA — NÃO PEDIR NOVAMENTE]:\n`
      resumoPassado += acoesSalvas.map((r, i) => `  ${i + 1}. ✅ ${r}`).join('\n')
    }
  }

  // ── Detectar tópico ativo ──────────────────────────────────
  let topicoAtivo: string | null = null
  const ultimaElena = [...recentes].reverse().find(m => m.role === 'ai')
  if (ultimaElena) {
    const tipo = classificarMsgIA(ultimaElena)
    if (tipo === 'pergunta') {
      // A Elena fez uma pergunta — o tópico é sobre o que ela perguntou
      const t = ultimaElena.texto
      if (t.includes('PF') || t.includes('PJ') || t.includes('pessoal') || t.includes('empresa')) {
        topicoAtivo = 'aguardando_confirmacao_pf_pj'
      } else if (t.includes('valor') || t.includes('R$')) {
        topicoAtivo = 'aguardando_valor'
      } else if (t.includes('data') || t.includes('quando')) {
        topicoAtivo = 'aguardando_data'
      } else {
        topicoAtivo = 'aguardando_resposta'
      }
    }
  }

  // ── Extrair ações pendentes ─────────────────────────────────
  const acoesPendentes: AcaoIA[] = []
  for (const m of recentes) {
    if (m.role === 'ai' && m.acoes) {
      const pendentes = m.acoes.filter(a => a.status === 'pending')
      acoesPendentes.push(...pendentes)
    }
  }

  return {
    resumoPassado,
    mensagensRecentes,
    topicoAtivo,
    acoesPendentes,
    acoesSalvas,
  }
}
