// ── elena-module-detector.ts ────────────────────────────────
// Detecta o "módulo ativo" baseado nas keywords da mensagem do usuário.
//
// CORREÇÕES CRÍTICAS (v2):
//   1. Match por WORD BOUNDARY (\b) — antes era substring, e "Perfeito"
//      disparava o módulo 'agenda' (por conter "feito"), "confirma"
//      disparava 'financeiro' (por conter "nf"), etc.
//   2. Normalização de acentos — "orçamento" e "orcamento" viram a mesma coisa.
//   3. THRESHOLD relativo — só retorna módulos com score >= 35% do módulo top.
//      Antes, qualquer score > 0 entrava, poluindo o prompt.
//   4. DETECÇÃO STICKY — respostas curtas ("sim", "500", "amanhã") NÃO
//      redetectam módulo. Elas HERDAM o módulo do turno anterior.
//      Esse era o bug que fazia a Elena perder o contexto no meio do fluxo.

export type ElenaModulo =
  | 'financeiro'
  | 'agenda'
  | 'patrimonio'
  | 'investimentos'
  | 'equipe'
  | 'diario'
  | 'cartoes'
  | 'relatorio'
  | 'geral'

interface ModuloKeywords {
  modulo: ElenaModulo
  /** Keywords escritas SEM acento e em minúsculo (o texto é normalizado antes) */
  keywords: string[]
  /**
   * Keywords que casam por PREFIXO (radical), não por palavra inteira.
   * Ex.: 'agend' casa em "agendar", "agendei", "agendamento".
   */
  prefixos?: string[]
}

// ── Normalização ───────────────────────────────────────────────

/** Remove acentos, baixa caixa, normaliza espaços. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/** Escapa caracteres especiais de regex */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ── Mapa de módulos ────────────────────────────────────────────
// IMPORTANTE: keywords SEM acento (o texto de entrada é normalizado).
// Palavras curtas e ambíguas foram movidas para termos compostos.

const MAPA_MODULOS: ModuloKeywords[] = [
  {
    modulo: 'financeiro',
    keywords: [
      'gasto', 'gastos', 'gastei', 'gastar', 'comprei', 'paguei', 'pagar',
      'receita', 'receitas', 'recebi', 'receber', 'freelance', 'freela',
      'salario', 'pro labore', 'prolabore',
      'transferencia', 'transferir', 'transferi',
      'pix', 'boleto', 'fatura', 'saldo', 'extrato',
      'lancamento', 'lancamentos', 'lancar', 'lancei',
      'despesa', 'despesas', 'custo', 'custos',
      'fluxo de caixa', 'caixa', 'dinheiro',
      'nota fiscal', 'imposto', 'impostos',
      'parcela', 'parcelas', 'parcelado', 'parcelar',
      'debito', 'credito',
      'conta de luz', 'conta de agua', 'conta de energia',
      'aluguel', 'condominio', 'financiamento', 'mensalidade',
      'anuidade', 'seguro',
      'recorrente', 'recorrentes', 'vencimento', 'vencimentos',
      'vencer', 'vence', 'venceu',
      'quanto gastei', 'quanto recebi', 'quanto paguei',
      'meta de gasto', 'meta', 'metas',
      'projecao', 'previsao', 'orcamento', 'economia', 'economizar',
      'pf', 'pj', 'pessoa fisica', 'pessoa juridica',
    ],
    prefixos: ['gast', 'lancament', 'parcelament'],
  },
  {
    modulo: 'cartoes',
    keywords: [
      'cartao', 'cartoes', 'nubank', 'itaucard', 'c6',
      'limite', 'limite do cartao', 'fatura', 'fechamento',
      'bandeira', 'visa', 'mastercard', 'elo', 'hipercard', 'amex',
      'cadastrar cartao', 'cartao de credito', 'cartao de debito',
    ],
  },
  {
    modulo: 'agenda',
    keywords: [
      'agenda', 'compromisso', 'compromissos',
      'reuniao', 'reunioes', 'lembrete', 'lembretes', 'lembrar',
      'alerta', 'alertas', 'alarme', 'aviso',
      'evento', 'eventos', 'tarefa', 'tarefas', 'prazo', 'prazos',
      'amanha', 'hoje', 'depois de amanha',
      'semana que vem', 'proxima semana', 'mes que vem',
      'adiar', 'reagendar', 'remarcar', 'cancelar evento',
      'deletar evento', 'apagar evento',
      'checklist', 'check list',
      'o que tenho hoje', 'minha agenda', 'compromissos de hoje',
      'concluido', 'concluir', 'ja fiz', 'ja paguei',
      'dar baixa', 'ta pago', 'esta pago',
      'aniversario', 'aniversarios',
    ],
    prefixos: ['agend', 'reagend', 'conclu'],
  },
  {
    modulo: 'patrimonio',
    keywords: [
      'patrimonio', 'bens',
      'imovel', 'imoveis', 'apartamento', 'apto', 'casa',
      'terreno', 'lote', 'chacara', 'sitio', 'fazenda',
      'veiculo', 'veiculos', 'carro', 'moto', 'caminhao', 'caminhonete',
      'equipamento', 'equipamentos', 'maquinario', 'maquina',
      'reforma', 'obra',
      'construtora', 'construtor', 'unidade', 'bloco',
      'placa', 'quilometragem', 'chassi', 'renavam',
      'escritura', 'matricula do imovel',
    ],
  },
  {
    modulo: 'investimentos',
    keywords: [
      'investimento', 'investimentos', 'investir', 'investi',
      'acao', 'acoes', 'fii', 'fiis', 'fundo', 'fundos',
      'cdb', 'lci', 'lca', 'tesouro', 'tesouro direto',
      'cripto', 'criptomoeda', 'bitcoin', 'btc', 'ethereum', 'eth',
      'poupanca', 'previdencia', 'corretora',
      'ticker', 'petr4', 'vale3', 'itub4', 'bbdc4', 'bova11',
      'rentabilidade', 'carteira', 'portfolio',
      'dividendo', 'dividendos', 'yield', 'rendimento', 'proventos',
      'comprei acoes', 'vendi acoes', 'aporte',
    ],
    prefixos: ['invest'],
  },
  {
    modulo: 'equipe',
    keywords: [
      'ocorrencia', 'ocorrencias',
      'colaborador', 'colaboradores', 'funcionario', 'funcionarios',
      'equipe', 'time', 'staff',
      'atrasou', 'atraso', 'falta', 'faltou', 'faltas',
      'advertencia', 'elogio', 'performance', 'desempenho',
      'relatorio de colaboradores', 'folha de pagamento',
    ],
  },
  {
    modulo: 'diario',
    keywords: [
      'diario', 'reflexao', 'anotar', 'anotacao', 'anotacoes',
      'decisao', 'marco', 'sentimento', 'humor',
      'como me sinto', 'gratidao', 'oracao', 'espiritual',
      'intencao', 'aprendizado', 'snapshot', 'desabafo',
    ],
  },
  {
    modulo: 'relatorio',
    keywords: [
      'relatorio', 'relatorios', 'resumo', 'balanco',
      'resumo mensal', 'resumo do mes',
      'relatorio financeiro',
      'como estou esse mes', 'como fui esse mes',
      'fechamento do mes',
      'dashboard', 'painel', 'grafico', 'graficos',
      'analise', 'exportar', 'backup',
    ],
  },
]

// ── Pré-compilação dos regex (feito 1x, não a cada chamada) ────

interface ModuloCompilado {
  modulo: ElenaModulo
  regexes: { re: RegExp; peso: number }[]
}

const MODULOS_COMPILADOS: ModuloCompilado[] = MAPA_MODULOS.map(entry => {
  const regexes: { re: RegExp; peso: number }[] = []

  // Keywords: match por palavra inteira (word boundary)
  for (const kw of entry.keywords) {
    const kwNorm = normalizar(kw)
    regexes.push({
      re: new RegExp(`\\b${escapeRegex(kwNorm)}\\b`, 'i'),
      // Termos compostos (com espaço) pesam mais — são mais específicos
      peso: kwNorm.includes(' ') ? kwNorm.length * 2 : kwNorm.length,
    })
  }

  // Prefixos: match por radical (início de palavra)
  for (const px of entry.prefixos || []) {
    const pxNorm = normalizar(px)
    regexes.push({
      re: new RegExp(`\\b${escapeRegex(pxNorm)}\\w*`, 'i'),
      peso: pxNorm.length,
    })
  }

  return { modulo: entry.modulo, regexes }
})

// ── Detecção de respostas curtas / continuações ────────────────

/** Confirmações puras — NÃO devem redetectar módulo */
const CONFIRMACOES = new Set([
  'sim', 's', 'ss', 'ok', 'okay', 'oke', 'okey', 'pode', 'pode sim',
  'confirma', 'confirmado', 'confirmar', 'certo', 'correto', 'exato',
  'isso', 'isso mesmo', 'e isso', 'perfeito', 'beleza', 'blz',
  'show', 'top', 'bora', 'vamos', 'manda', 'manda bala',
  'pode mandar', 'pode lancar', 'pode registrar', 'pode salvar',
  'vai em frente', 'vai nisso', 'faz isso', 'vai la', 'segue',
  'positivo', 'afirmativo', 'uhum', 'aham', 'sim sim', 'ta bom',
  'tudo certo', 'fechado', 'combinado', 'ta certo', 'claro',
  // Negações também são continuação do mesmo tópico
  'nao', 'n', 'nao mesmo', 'negativo', 'cancela', 'deixa pra la',
])

/**
 * Uma mensagem é "continuação" se for:
 *   - uma confirmação/negação pura
 *   - só um número / valor (ex: "500", "R$ 1.200,00")
 *   - só uma data/hora (ex: "amanhã 10h", "15/03")
 *   - muito curta (<= 3 palavras) SEM keyword forte
 *
 * Continuações herdam o módulo do turno anterior em vez de redetectar.
 */
export function ehContinuacao(texto: string): boolean {
  const t = normalizar(texto).replace(/[!.,?]+$/g, '')

  if (!t) return true
  if (CONFIRMACOES.has(t)) return true

  // Só valor monetário / número
  if (/^(r\$\s*)?[\d.,]+(\s*(reais|conto|pila|mil|k))?$/i.test(t)) return true

  // Só data e/ou hora
  if (/^(\d{1,2}[\/-]\d{1,2}([\/-]\d{2,4})?)?\s*(as\s*)?(\d{1,2}([:h]\d{0,2})?)?$/i.test(t) && /\d/.test(t)) return true

  // Frase curta sem nenhuma keyword de módulo
  const palavras = t.split(' ').filter(Boolean)
  if (palavras.length <= 3) {
    const temKeyword = MODULOS_COMPILADOS.some(m => m.regexes.some(r => r.re.test(t)))
    if (!temKeyword) return true
  }

  return false
}

// ── Detecção principal ────────────────────────────────────────

/** Score mínimo relativo ao módulo top para um módulo entrar no resultado */
const THRESHOLD_RELATIVO = 0.35

/** Máximo de módulos retornados (evita prompt inchado) */
const MAX_MODULOS = 3

/**
 * Detecta os módulos relevantes para UMA mensagem, isoladamente.
 * Retorna [] se nada for detectado (diferente de ['geral']).
 */
export function detectarModulosBrutos(texto: string): ElenaModulo[] {
  const t = normalizar(texto)
  if (!t) return []

  const scores = new Map<ElenaModulo, number>()

  for (const entry of MODULOS_COMPILADOS) {
    let score = 0
    for (const { re, peso } of entry.regexes) {
      if (re.test(t)) score += peso
    }
    if (score > 0) scores.set(entry.modulo, score)
  }

  if (scores.size === 0) return []

  const ordenados = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])
  const topScore = ordenados[0][1]

  return ordenados
    .filter(([, score]) => score >= topScore * THRESHOLD_RELATIVO)
    .slice(0, MAX_MODULOS)
    .map(([modulo]) => modulo)
}

/**
 * API PÚBLICA COMPATÍVEL com a versão antiga.
 * Detecta módulos de uma mensagem isolada. Retorna ['geral'] se nada casar.
 *
 * ⚠️ Prefira `detectarModulosContexto()` — esta função não tem memória
 *    e é justamente a causa do bug de perda de contexto em conversas longas.
 */
export function detectarModulos(texto: string): ElenaModulo[] {
  const m = detectarModulosBrutos(texto)
  return m.length > 0 ? m : ['geral']
}

export interface ContextoDeteccao {
  /** Módulos ativos no turno anterior (persistir no estado do componente) */
  modulosAnteriores?: ElenaModulo[]
  /** Há ações aguardando confirmação? Se sim, o tópico NÃO muda. */
  temAcoesPendentes?: boolean
  /** A Elena fez uma pergunta e está esperando resposta? */
  aguardandoResposta?: boolean
  /** Últimas mensagens do usuário (mais recente primeiro), para janela deslizante */
  textosRecentesUsuario?: string[]
}

/**
 * ✅ FUNÇÃO RECOMENDADA — detecção STICKY, com memória de contexto.
 *
 * Regras:
 *   1. Se a mensagem é uma CONTINUAÇÃO ("sim", "500", "amanhã 10h") →
 *      HERDA os módulos anteriores. Não redetecta. Não vira 'geral'.
 *   2. Se há AÇÕES PENDENTES ou a Elena está aguardando resposta →
 *      os módulos anteriores são MANTIDOS e unidos aos novos.
 *   3. Caso contrário → detecta normalmente, mas usando também os
 *      últimos 2 turnos do usuário como reforço (peso menor).
 *   4. Nunca retorna ['geral'] se havia um módulo ativo antes.
 */
export function detectarModulosContexto(
  textoAtual: string,
  ctx: ContextoDeteccao = {},
): ElenaModulo[] {
  const anteriores: ElenaModulo[] = (ctx.modulosAnteriores || []).filter(m => m !== 'geral')
  const fluxoAberto = !!ctx.temAcoesPendentes || !!ctx.aguardandoResposta

  const detectadosAgora = detectarModulosBrutos(textoAtual)

  // ── REGRA 1: continuação → herda o contexto anterior ───────
  if (ehContinuacao(textoAtual)) {
    if (anteriores.length > 0) return anteriores
    if (detectadosAgora.length > 0) return detectadosAgora
    return ['geral']
  }

  // ── REGRA 2: fluxo aberto → une anterior + novo ────────────
  if (fluxoAberto && anteriores.length > 0) {
    const uniao = [...anteriores]
    for (const m of detectadosAgora) {
      if (!uniao.includes(m)) uniao.push(m)
    }
    return uniao.slice(0, MAX_MODULOS + 1)
  }

  // ── REGRA 3: assunto novo → detecta, com reforço da janela ─
  if (detectadosAgora.length > 0) {
    return detectadosAgora
  }

  // Nada detectado na mensagem atual: tenta os 2 turnos anteriores
  const janela = (ctx.textosRecentesUsuario || []).slice(0, 2)
  for (const txt of janela) {
    const m = detectarModulosBrutos(txt)
    if (m.length > 0) return m
  }

  // ── REGRA 4: fallback ─────────────────────────────────────
  if (anteriores.length > 0) return anteriores
  return ['geral']
}

/**
 * Verifica se um módulo específico está entre os detectados.
 */
export function moduloInclui(modulos: ElenaModulo[], ...alvos: ElenaModulo[]): boolean {
  return alvos.some(a => modulos.includes(a))
}

/**
 * Retorna quais blocos de dados do banco devem ser injetados,
 * baseado nos módulos detectados.
 */
export function dadosNecessarios(modulos: ElenaModulo[]): {
  contas: boolean
  cartoes: boolean
  imoveis: boolean
  veiculos: boolean
  investimentos: boolean
  agendaHoje: boolean
  vencimentos: boolean
  recorrentes: boolean
  financeiro: boolean
  financeiroPj: boolean
} {
  const isGeral = modulos.includes('geral')
  const isRelatorio = modulos.includes('relatorio')
  const amplo = isGeral || isRelatorio

  return {
    contas:        amplo || moduloInclui(modulos, 'financeiro', 'cartoes'),
    cartoes:       amplo || moduloInclui(modulos, 'financeiro', 'cartoes'),
    imoveis:       amplo || moduloInclui(modulos, 'patrimonio'),
    veiculos:      amplo || moduloInclui(modulos, 'patrimonio'),
    investimentos: amplo || moduloInclui(modulos, 'investimentos'),
    agendaHoje:    amplo || moduloInclui(modulos, 'agenda'),
    vencimentos:   amplo || moduloInclui(modulos, 'agenda', 'financeiro'),
    recorrentes:   amplo || moduloInclui(modulos, 'financeiro', 'agenda'),
    financeiro:    amplo || moduloInclui(modulos, 'financeiro'),
    financeiroPj:  amplo || moduloInclui(modulos, 'financeiro'),
  }
}
