// ── elena-history-compressor.ts ─────────────────────────────
// Comprime o histórico de mensagens para manter a janela de contexto
// sob controle em conversas longas — SEM destruir contexto.
//
// CORREÇÕES CRÍTICAS (v2):
//   1. NÃO substitui mais o texto real da Elena por "[JÁ SALVO: ...]".
//      Antes, se ela dizia "Registrando... quer no cartão ou débito?",
//      o compressor apagava a PERGUNTA. O usuário respondia "cartão" e
//      a Elena não sabia do quê. Agora o texto é PRESERVADO e o marcador
//      é ANEXADO.
//   2. PERGUNTA ABERTA: a última pergunta da Elena é extraída literalmente
//      para ser reinjetada no system prompt.
//   3. FATOS FIXADOS: valores, datas e nomes ditos pelo usuário são
//      extraídos em formato estruturado e NUNCA são comprimidos.
//   4. COMPRESSÃO EM 2 NÍVEIS com TETO. Antes o resumo crescia
//      linearmente pra sempre (100 msgs = 100 linhas).
//   5. Roles normalizados: garante início em 'user' e faz merge de
//      mensagens consecutivas do mesmo role (exigência da API).

import type { AcaoIA, Msg } from './elena-types'

/** Mensagem formatada para a API OpenRouter */
export interface ApiMsg {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/** Fatos estruturados extraídos da conversa — NUNCA comprimidos */
export interface FatosSessao {
  /** Registros já salvos no banco nesta sessão */
  registrosSalvos: string[]
  /** Valores monetários mencionados pelo usuário (mais recentes primeiro) */
  valoresMencionados: string[]
  /** Datas mencionadas pelo usuário */
  datasMencionadas: string[]
}

/** Resultado da compressão do histórico */
export interface HistoryBlock {
  /** Resumo comprimido do histórico antigo */
  resumoPassado: string
  /** Últimas N mensagens (role/content) — texto PRESERVADO */
  mensagensRecentes: ApiMsg[]
  /** Tópico ativo detectado na última interação (se houver) */
  topicoAtivo: string | null
  /** ✅ NOVO: última pergunta da Elena, LITERAL. Reinjetar no system. */
  perguntaAberta: string | null
  /** Ações pendentes que aguardam confirmação */
  acoesPendentes: AcaoIA[]
  /** Lista de ações já salvas nesta sessão (para anti-repetição) */
  acoesSalvas: string[]
  /** ✅ NOVO: fatos estruturados que nunca se perdem */
  fatos: FatosSessao
  /** ✅ NOVO: bloco de texto pronto para injetar no system prompt */
  blocoContexto: string
}

// ── Configuração ───────────────────────────────────────────────

/** Mensagens recentes mantidas na íntegra (era 6 = só 3 turnos — muito pouco) */
const MAX_MENSAGENS_RECENTES = 12

/** Teto de linhas no resumo do passado (nível 1) */
const MAX_LINHAS_RESUMO = 25

/** Truncamento de mensagens da IA no histórico recente (era 600 — cortava no meio) */
const MAX_CHARS_IA_RECENTE = 1500

/** Truncamento de mensagens da IA no resumo do passado */
const MAX_CHARS_IA_PASSADO = 220

/** Truncamento de mensagens do usuário no resumo do passado (era 150 — perdia dados) */
const MAX_CHARS_USER_PASSADO = 300

// ── Helpers ────────────────────────────────────────────────────

/** Extrai resumo dos dados de uma ação salva */
function resumirAcao(acao: AcaoIA): string {
  const d: any = acao.dados || {}
  const partes: string[] = [acao.tipo]
  if (d.descricao || d.titulo) partes.push(d.descricao || d.titulo)
  if (d.valor) partes.push(`R$ ${Number(d.valor).toFixed(2)}`)
  if (d.parcelas && Number(d.parcelas) > 1) partes.push(`${d.parcelas}x`)
  if (d.parcelas_pagas && d.parcelas_total) partes.push(`parcela ${d.parcelas_pagas}/${d.parcelas_total}`)
  if (d.data) partes.push(d.data)
  if (d.conta_nome) partes.push(`conta: ${d.conta_nome}`)
  if (d.data_inicio) partes.push(String(d.data_inicio).substring(0, 16))
  if (d.ticker) partes.push(String(d.ticker).toUpperCase())
  return partes.filter(Boolean).join(' | ')
}

/** Classifica uma mensagem da IA em categorias para compressão */
function classificarMsgIA(msg: Msg): 'salvamento' | 'listagem' | 'erro' | 'pergunta' | 'resposta' {
  const t = msg.texto || ''
  const temAcaoSalva = (msg.acoes || []).some(a => a.status === 'saved')

  if (temAcaoSalva || t.includes('✅') || t.includes('⏳') || /\bRegistr(ado|ando)\b/i.test(t)) return 'salvamento'
  if (t.includes('📋') || /Patrim[oô]nio encontrado|Lan[çc]amentos|\*\*Im[oó]veis|\*\*Ve[ií]culos/i.test(t)) return 'listagem'
  if (t.startsWith('❌') || /Ops!|Erro|n[ãa]o consegui/i.test(t)) return 'erro'
  if (t.includes('?')) return 'pergunta'
  return 'resposta'
}

/**
 * Extrai a última pergunta LITERAL de um texto da Elena.
 * Pega a frase que termina em "?" — é o que o usuário está respondendo.
 */
function extrairPergunta(texto: string): string | null {
  if (!texto || !texto.includes('?')) return null

  // Quebra em frases, pega as que terminam em "?"
  const frases = texto
    .split(/\n+/)
    .flatMap(l => l.split(/(?<=[.!?])\s+/))
    .map(f => f.trim())
    .filter(f => f.endsWith('?') && f.length > 5)

  if (frases.length === 0) return null

  // Se há várias perguntas, junta (a Elena às vezes pergunta 2 coisas)
  return frases.slice(-2).join(' ').substring(0, 300)
}

/** Extrai valores monetários de um texto */
function extrairValores(texto: string): string[] {
  const out: string[] = []
  const re = /R\$\s*[\d.]+(?:,\d{2})?|\b\d{1,3}(?:\.\d{3})+(?:,\d{2})?\b|\b\d+(?:,\d{2})\b/g
  const m = texto.match(re)
  if (m) out.push(...m.map(s => s.trim()))
  return out
}

/** Extrai datas de um texto */
function extrairDatas(texto: string): string[] {
  const out: string[] = []
  const re = /\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b|\b\d{4}-\d{2}-\d{2}\b/g
  const m = texto.match(re)
  if (m) out.push(...m.map(s => s.trim()))
  return out
}

/** Comprime uma mensagem antiga da IA para um resumo curto */
function comprimirMsgIA(msg: Msg): string {
  const tipo = classificarMsgIA(msg)
  const t = msg.texto || ''

  switch (tipo) {
    case 'salvamento': {
      const salvas = (msg.acoes || []).filter(a => a.status === 'saved')
      if (salvas.length > 0) return `[JÁ SALVO: ${salvas.map(resumirAcao).join('; ')}]`
      const resumo = t.replace(/[✅⏳📋🔄]/g, '').trim().split('\n')[0].substring(0, 150)
      return `[JÁ SALVO: ${resumo}]`
    }
    case 'listagem': {
      const linhas = t.split('\n').filter(l => l.trim())
      const contagem = linhas.filter(l => /^\s*[•\-*]/.test(l)).length
      const titulo = (linhas[0] || 'Lista').substring(0, 90)
      return `[LISTOU ${contagem} itens: ${titulo}]`
    }
    case 'erro':
      return `[ERRO: ${t.substring(0, 100)}]`
    case 'pergunta': {
      const p = extrairPergunta(t)
      return `[PERGUNTOU: ${(p || t).substring(0, MAX_CHARS_IA_PASSADO)}]`
    }
    default:
      return t.substring(0, MAX_CHARS_IA_PASSADO)
  }
}

/**
 * Normaliza o array para a API:
 *  - Remove mensagens vazias
 *  - Garante que começa com 'user'
 *  - Faz MERGE de mensagens consecutivas do mesmo role
 * (OpenRouter/Anthropic rejeitam ou se confundem com roles alternando errado)
 */
function normalizarParaApi(msgs: ApiMsg[]): ApiMsg[] {
  const limpo = msgs.filter(m => m.content && m.content.trim())

  // Descarta 'assistant' iniciais órfãos
  let inicio = 0
  while (inicio < limpo.length && limpo[inicio].role !== 'user') inicio++
  const cortado = limpo.slice(inicio)

  // Merge de roles consecutivos
  const out: ApiMsg[] = []
  for (const m of cortado) {
    const ultimo = out[out.length - 1]
    if (ultimo && ultimo.role === m.role) {
      ultimo.content += '\n\n' + m.content
    } else {
      out.push({ ...m })
    }
  }
  return out
}

// ── Compressor principal ──────────────────────────────────────

/**
 * Comprime o histórico de mensagens da Elena para otimizar a janela de contexto,
 * SEM destruir o contexto conversacional.
 *
 * @param mensagens - Todas as mensagens da sessão atual
 * @returns HistoryBlock com resumo + mensagens recentes + fatos + bloco pronto
 */
export function comprimirHistorico(mensagens: Msg[]): HistoryBlock {
  // ── Filtrar mensagens úteis ────────────────────────────────
  const msgsUteis = (mensagens || []).filter(m =>
    m &&
    m.texto &&
    m.texto.trim() !== '' &&
    m.texto !== '...' &&
    !/^Ol[áa], Sr\. Max/i.test(m.texto) &&
    !/^Hist[óo]rico carregado/i.test(m.texto)
  )

  const total = msgsUteis.length
  const recentes = msgsUteis.slice(-MAX_MENSAGENS_RECENTES)
  const passado = total > MAX_MENSAGENS_RECENTES
    ? msgsUteis.slice(0, total - MAX_MENSAGENS_RECENTES)
    : []

  // ══════════════════════════════════════════════════════════
  // 1. MENSAGENS RECENTES — TEXTO PRESERVADO
  //    ⚠️ Aqui estava o bug: o texto real da Elena era SUBSTITUÍDO
  //    pelo marcador, apagando perguntas dela. Agora ANEXAMOS.
  // ══════════════════════════════════════════════════════════
  const recentesApi: ApiMsg[] = recentes.map(m => {
    if (m.role !== 'ai') {
      // Usuário: NUNCA truncar (são dados de entrada)
      return { role: 'user' as const, content: m.texto }
    }

    let content = m.texto.length > MAX_CHARS_IA_RECENTE
      ? m.texto.substring(0, MAX_CHARS_IA_RECENTE) + '\n[…resposta truncada]'
      : m.texto

    // Anexa marcadores SEM apagar o texto original
    const salvas = (m.acoes || []).filter(a => a.status === 'saved')
    if (salvas.length > 0) {
      content += `\n\n[✅ CONFIRMADO PELO SISTEMA — JÁ SALVO: ${salvas.map(resumirAcao).join('; ')}]`
      content += `\n[⛔ NÃO peça esses dados de novo. NÃO registre de novo.]`
    }

    const falhas = (m.acoes || []).filter(a => a.status === 'error')
    if (falhas.length > 0) {
      content += `\n\n[❌ FALHOU AO SALVAR: ${falhas.map(a => a.label || a.tipo).join('; ')}]`
    }

    return { role: 'assistant' as const, content }
  })

  const mensagensRecentes = normalizarParaApi(recentesApi)

  // ══════════════════════════════════════════════════════════
  // 2. FATOS FIXADOS — extraídos de TODA a sessão, nunca comprimidos
  // ══════════════════════════════════════════════════════════
  const registrosSalvos: string[] = []
  const valores: string[] = []
  const datas: string[] = []

  for (const m of msgsUteis) {
    if (m.role === 'ai') {
      for (const a of (m.acoes || [])) {
        if (a.status === 'saved') registrosSalvos.push(resumirAcao(a))
      }
    } else {
      valores.push(...extrairValores(m.texto))
      datas.push(...extrairDatas(m.texto))
    }
  }

  const fatos: FatosSessao = {
    registrosSalvos,
    valoresMencionados: [...new Set(valores)].slice(-12).reverse(),
    datasMencionadas: [...new Set(datas)].slice(-12).reverse(),
  }

  // ══════════════════════════════════════════════════════════
  // 3. RESUMO DO PASSADO — 2 NÍVEIS COM TETO
  //    Nível 1: últimas MAX_LINHAS_RESUMO trocas → resumo por linha
  //    Nível 2: tudo antes disso → apenas contagem + registros salvos
  // ══════════════════════════════════════════════════════════
  let resumoPassado = ''

  if (passado.length > 0) {
    const nivel1 = passado.slice(-MAX_LINHAS_RESUMO)
    const nivel2Qtd = passado.length - nivel1.length

    const linhas: string[] = []
    for (const m of nivel1) {
      if (m.role === 'ai') {
        linhas.push(`  Elena: ${comprimirMsgIA(m)}`)
      } else {
        linhas.push(`  Sr. Max: ${m.texto.substring(0, MAX_CHARS_USER_PASSADO)}`)
      }
    }

    resumoPassado = `[HISTÓRICO ANTERIOR DESTA SESSÃO — ${passado.length} mensagens]`
    if (nivel2Qtd > 0) {
      resumoPassado += `\n  (… ${nivel2Qtd} mensagens mais antigas omitidas — os registros salvos delas estão listados abaixo)`
    }
    resumoPassado += '\n' + linhas.join('\n')
  }

  // ══════════════════════════════════════════════════════════
  // 4. PERGUNTA ABERTA — o elo que estava faltando
  //    Se a última fala da Elena foi uma pergunta, o "sim"/"500" do
  //    usuário se refere a ELA. Precisa ir no system prompt.
  // ══════════════════════════════════════════════════════════
  let perguntaAberta: string | null = null
  let topicoAtivo: string | null = null

  const ultimaMsg = msgsUteis[msgsUteis.length - 1]
  const ultimaElena = [...msgsUteis].reverse().find(m => m.role === 'ai')

  // Só há pergunta aberta se a Elena falou por último OU se o usuário
  // respondeu com algo curto (continuação)
  if (ultimaElena) {
    const p = extrairPergunta(ultimaElena.texto)
    const elenaFalouPorUltimo = ultimaMsg === ultimaElena
    const respostaCurta = !elenaFalouPorUltimo && (ultimaMsg?.texto || '').trim().split(/\s+/).length <= 6

    if (p && (elenaFalouPorUltimo || respostaCurta)) {
      perguntaAberta = p

      const pl = p.toLowerCase()
      if (/\bpf\b|\bpj\b|pessoal|empresa/.test(pl)) topicoAtivo = 'aguardando_confirmacao_pf_pj'
      else if (/valor|r\$|quanto/.test(pl)) topicoAtivo = 'aguardando_valor'
      else if (/data|quando|dia|hora/.test(pl)) topicoAtivo = 'aguardando_data'
      else if (/conta|cart[ãa]o/.test(pl)) topicoAtivo = 'aguardando_conta'
      else topicoAtivo = 'aguardando_resposta'
    }
  }

  // ══════════════════════════════════════════════════════════
  // 5. AÇÕES PENDENTES (janela recente)
  // ══════════════════════════════════════════════════════════
  const acoesPendentes: AcaoIA[] = []
  for (const m of recentes) {
    if (m.role === 'ai' && m.acoes) {
      acoesPendentes.push(...m.acoes.filter(a => a.status === 'pending'))
    }
  }

  // ══════════════════════════════════════════════════════════
  // 6. BLOCO DE CONTEXTO — texto pronto para colar no SYSTEM prompt
  //    ⚠️ Isso vai no SYSTEM, não como mensagem de user/assistant.
  // ══════════════════════════════════════════════════════════
  const bloco: string[] = []

  if (perguntaAberta) {
    bloco.push(
      `🔴 PERGUNTA EM ABERTO — VOCÊ (Elena) PERGUNTOU:\n` +
      `"${perguntaAberta}"\n` +
      `⚠️ A próxima mensagem do Sr. Max é a RESPOSTA a essa pergunta. ` +
      `Interprete-a nesse contexto. NÃO mude de assunto. NÃO repergunte.`
    )
  }

  if (acoesPendentes.length > 0) {
    bloco.push(
      `⏳ AÇÕES AGUARDANDO CONFIRMAÇÃO (${acoesPendentes.length}):\n` +
      acoesPendentes.map((a, i) => `  ${i + 1}. ${a.label || a.tipo}`).join('\n') +
      `\n⚠️ Se o Sr. Max confirmar, NÃO gere o JSON de novo — o sistema já tem a ação pendente.`
    )
  }

  if (fatos.registrosSalvos.length > 0) {
    bloco.push(
      `✅ ${fatos.registrosSalvos.length} REGISTRO(S) JÁ SALVO(S) NESTA CONVERSA — NÃO PEDIR NOVAMENTE, NÃO REGISTRAR DE NOVO:\n` +
      fatos.registrosSalvos.map((r, i) => `  ${i + 1}. ${r}`).join('\n')
    )
  }

  if (fatos.valoresMencionados.length > 0) {
    bloco.push(
      `🔢 VALORES QUE O SR. MAX MENCIONOU (use EXATAMENTE estes, nunca arredonde):\n` +
      `  ${fatos.valoresMencionados.join(' | ')}`
    )
  }

  if (fatos.datasMencionadas.length > 0) {
    bloco.push(`📅 DATAS MENCIONADAS: ${fatos.datasMencionadas.join(' | ')}`)
  }

  if (resumoPassado) {
    bloco.push(resumoPassado)
  }

  const blocoContexto = bloco.length > 0
    ? `\n\n═══ CONTEXTO DA SESSÃO ═══\n\n${bloco.join('\n\n')}\n\n═══ FIM DO CONTEXTO ═══`
    : ''

  return {
    resumoPassado,
    mensagensRecentes,
    topicoAtivo,
    perguntaAberta,
    acoesPendentes,
    acoesSalvas: fatos.registrosSalvos,
    fatos,
    blocoContexto,
  }
}
