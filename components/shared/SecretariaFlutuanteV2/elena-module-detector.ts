// ── elena-module-detector.ts ────────────────────────────────
// Detecta o "módulo ativo" baseado nas keywords da mensagem do usuário.
// Usado para:
//   1. Incluir apenas os blocos de instrução relevantes no system prompt
//   2. Injetar apenas os dados do banco relevantes (cartões, agenda, etc.)
//   3. Reduzir drasticamente o tamanho do contexto enviado à IA

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
  keywords: string[]
  /** Se verdadeiro, match exato da palavra (não substring). Padrão: false (substring) */
  exact?: boolean
}

const MAPA_MODULOS: ModuloKeywords[] = [
  {
    modulo: 'financeiro',
    keywords: [
      'gasto', 'gastei', 'comprei', 'paguei', 'receita', 'receb',
      'freelance', 'salário', 'salario', 'pro labore', 'transferência',
      'transferencia', 'transferir', 'pix', 'boleto', 'fatura',
      'saldo', 'extrato', 'lançamento', 'lancamento', 'despesa',
      'entrada', 'saída', 'saida', 'fluxo', 'caixa',
      'dinheiro', 'nota fiscal', 'nf', 'imposto', 'taxa',
      'parcel', 'débito', 'debito', 'crédito', 'credito',
      'conta de luz', 'conta de água', 'conta de agua', 'aluguel',
      'condomínio', 'condominio', 'internet', 'telefone', 'plano',
      'financiamento', 'mensalidade', 'anuidade', 'seguro',
      'recorrente', 'vencimento', 'vencer', 'vence',
      'quanto gastei', 'quanto recebi', 'meta de gasto',
      'projeção', 'projecao', 'previsão', 'previsao',
      'orçamento', 'orcamento', 'economia', 'economiz',
      'pf', 'pj', 'empresa', 'pessoal',
    ],
  },
  {
    modulo: 'cartoes',
    keywords: [
      'cartão', 'cartao', 'card', 'nubank', 'inter card', 'c6 card',
      'itaucard', 'limite', 'fatura', 'fechamento', 'bandeira',
      'visa', 'mastercard', 'elo', 'hipercard', 'amex',
      'cadastrar cartão', 'cadastrar cartao',
    ],
  },
  {
    modulo: 'agenda',
    keywords: [
      'agenda', 'agendar', 'agend', 'reunião', 'reuniao',
      'lembrete', 'lembra', 'alerta', 'alarme', 'aviso',
      'compromisso', 'evento', 'tarefa', 'prazo',
      'amanhã', 'amanha', 'hoje', 'semana que vem', 'próxima semana',
      'proxima semana', 'daqui', 'minuto', 'hora',
      'adiar', 'reagendar', 'muda pra', 'troca o horário',
      'cancelar evento', 'deletar evento', 'apagar evento',
      'checklist', 'check list', 'compromissos de hoje',
      'o que tenho hoje', 'minha agenda',
      'concluí', 'conclui', 'já fiz', 'ja fiz', 'já paguei', 'ja paguei',
      'pode dar baixa', 'tá pago', 'ta pago', 'feito',
      'aniversário', 'aniversario',
    ],
  },
  {
    modulo: 'patrimonio',
    keywords: [
      'patrimônio', 'patrimonio', 'imóvel', 'imovel', 'imóveis', 'imoveis',
      'apartamento', 'casa', 'terreno', 'lote', 'chácara', 'chacara',
      'veículo', 'veiculo', 'carro', 'moto', 'caminhão', 'caminhao',
      'equipamento', 'maquinário', 'maquinario', 'reforma',
      'parcelas do imóvel', 'parcelas do imovel', 'financiado',
      'construtor', 'construtora', 'unidade', 'bloco',
      'placa', 'modelo', 'marca', 'km', 'quilometragem',
    ],
  },
  {
    modulo: 'investimentos',
    keywords: [
      'investimento', 'invest', 'ação', 'acao', 'ações', 'acoes',
      'fii', 'fundo', 'cdb', 'lci', 'lca', 'tesouro', 'cripto',
      'bitcoin', 'btc', 'ethereum', 'poupança', 'poupanca',
      'previdência', 'previdencia', 'corretora',
      'ticker', 'petr4', 'vale3', 'itub4', 'bbdc4',
      'rentabilidade', 'carteira', 'portfólio', 'portfolio',
      'dividendo', 'yield', 'rendimento',
      'comprei ações', 'comprei acoes', 'vendi ações', 'vendi acoes',
    ],
  },
  {
    modulo: 'equipe',
    keywords: [
      'ocorrência', 'ocorrencia', 'colaborador', 'funcionário', 'funcionario',
      'equipe', 'time', 'atrasou', 'atraso', 'falta', 'faltou',
      'advertência', 'advertencia', 'elogio', 'performance',
      'relatório de colaboradores', 'relatorio de colaboradores',
    ],
  },
  {
    modulo: 'diario',
    keywords: [
      'diário', 'diario', 'reflexão', 'reflexao', 'anotar',
      'anotação', 'anotacao', 'decisão', 'decisao', 'marco',
      'sentimento', 'humor', 'como me sinto', 'gratidão', 'gratidao',
      'oração', 'oracao', 'espiritual', 'intenção', 'intencao',
      'aprendizado', 'snapshot',
    ],
  },
  {
    modulo: 'relatorio',
    keywords: [
      'relatório', 'relatorio', 'resumo', 'balanço', 'balanco',
      'resumo mensal', 'resumo do mês', 'resumo do mes',
      'relatório financeiro', 'relatorio financeiro',
      'como estou esse mês', 'como fui esse mês',
      'fechamento do mês', 'fechamento do mes',
      'dashboard', 'painel', 'gráfico', 'grafico',
      'análise', 'analise', 'exportar', 'backup',
    ],
  },
]

/**
 * Detecta quais módulos são relevantes para a mensagem do usuário.
 * Retorna uma lista de módulos ordenada por relevância.
 * Se nenhum módulo for detectado, retorna ['geral'].
 *
 * @param texto - Mensagem do usuário
 * @returns Lista de módulos detectados (1 a N)
 */
export function detectarModulos(texto: string): ElenaModulo[] {
  const textoLower = texto.toLowerCase()
  const modulosDetectados = new Map<ElenaModulo, number>()

  for (const entry of MAPA_MODULOS) {
    let score = 0
    for (const kw of entry.keywords) {
      if (textoLower.includes(kw)) {
        score += kw.length // Keywords mais longas = mais específicas = mais peso
      }
    }
    if (score > 0) {
      modulosDetectados.set(entry.modulo, score)
    }
  }

  if (modulosDetectados.size === 0) {
    return ['geral']
  }

  // Ordenar por score (maior = mais relevante) e retornar
  return Array.from(modulosDetectados.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([modulo]) => modulo)
}

/**
 * Verifica se um módulo específico está entre os detectados.
 * Helper para decisões rápidas.
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

  return {
    contas:         isGeral || isRelatorio || moduloInclui(modulos, 'financeiro', 'cartoes'),
    cartoes:        isGeral || isRelatorio || moduloInclui(modulos, 'financeiro', 'cartoes'),
    imoveis:        isGeral || isRelatorio || moduloInclui(modulos, 'patrimonio'),
    veiculos:       isGeral || isRelatorio || moduloInclui(modulos, 'patrimonio'),
    investimentos:  isGeral || isRelatorio || moduloInclui(modulos, 'investimentos'),
    agendaHoje:     isGeral || isRelatorio || moduloInclui(modulos, 'agenda'),
    vencimentos:    isGeral || isRelatorio || moduloInclui(modulos, 'agenda', 'financeiro'),
    recorrentes:    isGeral || isRelatorio || moduloInclui(modulos, 'financeiro', 'agenda'),
    financeiro:     isGeral || isRelatorio || moduloInclui(modulos, 'financeiro'),
    financeiroPj:   isGeral || isRelatorio || moduloInclui(modulos, 'financeiro'),
  }
}
