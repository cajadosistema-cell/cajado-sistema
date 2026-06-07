// ── elena-constants.ts ───────────────────────────────────────
// Constantes fixas da Elena. Nunca espalhe UUIDs ou listas pelo código.

// IDs fixos de categorias financeiras da tabela `categorias`
export const CAT_DESPESA_ID = 'd4f05276-7633-49b3-9d72-09fb0fa07fbe' // Despesas Operacionais
export const CAT_RECEITA_ID = '2774932e-75c8-4b7e-b88f-12a6f1a0744a' // Receita Operacional

// Formas de pagamento válidas no banco
export const FORMAS_PAG_VALIDAS = [
  'pix',
  'cartao_debito',
  'cartao_credito',
  'dinheiro',
  'transferencia',
] as const

// Tipos de evento válidos na tabela agenda_eventos
export const TIPOS_EVENTO_VALIDOS = [
  'compromisso',
  'lembrete',
  'nota',
  'tarefa',
  'aniversario',
  'reuniao',
  'vencimento',
  'prazo',
  'pessoal',
] as const

// Cores por tipo de evento (para campo `cor` na agenda)
export const COR_EVENTO: Record<string, string> = {
  compromisso: '#3b82f6',
  lembrete:    '#f5a623',
  nota:        '#8b5cf6',
  tarefa:      '#10b981',
  aniversario: '#ec4899',
  reuniao:     '#06b6d4',
  vencimento:  '#ef4444',
  prazo:       '#f97316',
  pessoal:     '#a78bfa',
}

// Tipos válidos de registro livre (memória da Elena)
export const TIPOS_REGISTRO_LIVRE = [
  'contrato', 'emprestimo', 'nota', 'lembrete', 'compra', 'venda',
  'outro', 'geral', 'preferencia', 'dado_pessoal', 'regra_negocio',
  'anotacao', 'contato', 'acordo',
] as const

// Categorias válidas de ideia
export const CATEGORIAS_IDEIA = [
  'negocio', 'produto', 'pessoal', 'financeiro', 'saude', 'criativo', 'geral',
] as const

// Mapa de módulos para cards de confirmação de salvamento
export const MAPA_CONFIRMACAO: Record<string, { modulo: string; rota: string; icone: string }> = {
  gasto:                { modulo: 'Gastos PF',       rota: '/financeiro', icone: '💸' },
  receita:              { modulo: 'Receitas PF',      rota: '/financeiro', icone: '💰' },
  gasto_empresa:        { modulo: 'Despesas Empresa', rota: '/financeiro', icone: '🏢💸' },
  receita_empresa:      { modulo: 'Receitas Empresa', rota: '/financeiro', icone: '🏢💰' },
  agenda:               { modulo: 'Agenda',           rota: '/agenda',     icone: '📅' },
  fatura_cartao:        { modulo: 'Cartões PF',       rota: '/financeiro', icone: '💳' },
  ocorrencia:           { modulo: 'Cajado Empresa',   rota: '/cajado',     icone: '📋' },
  ideia:                { modulo: 'Ideias',           rota: '/ideias',     icone: '💡' },
  transferencia:        { modulo: 'Financeiro',       rota: '/financeiro', icone: '🔄' },
  definir_meta:         { modulo: 'Metas da Elena',   rota: '/financeiro', icone: '🎯' },
  registro_livre:       { modulo: 'Memória da Elena', rota: '',            icone: '🧠' },
  cadastrar_conta:      { modulo: 'Contas',           rota: '/financeiro', icone: '🏦' },
  cadastrar_cartao:     { modulo: 'Cartões',          rota: '/financeiro', icone: '💳' },
  registrar_patrimonio: { modulo: 'Patrimônio',       rota: '/patrimonio', icone: '🏠' },
  buscar_patrimonio:    { modulo: 'Patrimônio',       rota: '/patrimonio', icone: '🔍' },
}

// Detecção de bandeira pelo nome da conta
export const BANDEIRAS_MAP: Record<string, string> = {
  visa:       'visa',
  master:     'mastercard',
  mastercard: 'mastercard',
  elo:        'elo',
  hipercard:  'hipercard',
  amex:       'amex',
  american:   'amex',
}

// Palavras de confirmação que o usuário usa para confirmar uma ação sugerida
export const PALAVRAS_CONFIRMACAO = [
  'sim', 'pode', 'faz', 'vai lá', 'vai la', 'claro', 'ok', 'certo',
  'isso', 'confirmo', 'confirma', 'registra', 'registre', 'salva',
  'pode fazer', 'pode ser', 'faz isso', 'vai', 's', 'yes', 'yep',
  'exato', 'correto', 'isso mesmo', 'manda ver', 'bora', 'pode mandar',
  'tá', 'ta', 'tá bom', 'ta bom', 'fechado', 'boa', 'manda bala',
  'vai em frente', 'pode ir', 'faz aí', 'pode lançar', 'pode registrar',
  'confirma ai', 'tamo junto', 'pode crer', 'perfeito', 'show', 'top',
  'pode enviar', 'beleza', 'vai nisso', 'manda', 'já', 'faz mesmo',
  'pode fazer isso', 'registra ai',
]

// Keywords que disparam busca na web
export const KEYWORDS_WEB = [
  'preço', 'preco', 'valor', 'quanto custa', 'custa', 'mercado', 'comparar',
  'comparação', 'mais barato', 'melhor preço', 'promoção', 'oferta',
  'cotação', 'cotacao', 'pesquisa', 'pesquise', 'busque', 'buscar',
  'procure', 'procurar', 'notícia', 'noticia', 'novidade', 'atualidade',
  'hoje', 'recente', 'dólar', 'euro', 'câmbio', 'cambio', 'inflação',
  'inflacao', 'ipca', 'selic', 'concorrente', 'concorrência', 'tendência',
  'tendencia', 'amazon', 'shopee', 'mercado livre', 'magalu', 'americanas',
  'casas bahia',
]

// Keywords que disparam busca no histórico de conversas
export const KEYWORDS_HISTORICO = [
  'conversamos', 'falamos', 'disse', 'comentei', 'registrei', 'anotei',
  'que você disse', 'que eu disse', 'lembra quando', 'semana passada',
  'mês passado', 'conversa anterior', 'histórico', 'sessão anterior',
  'o que conversamos', 'já falei', 'você lembra', 'busca nas conversas',
  'relatório', 'relatorio', 'resumo das conversas', 'últimas conversas',
  'o que fizemos', 'o que tratamos', 'recap', 'resumo do dia',
  'conversas de hoje', 'conversas de ontem', 'resuma nossas conversas',
  'balanço', 'balanço do mês', 'resumo financeiro', 'extrato', 'análise do mês',
  'como fui esse mês', 'como foi esse mês', 'quanto gastei', 'quanto recebi',
  'gastos do mês', 'receitas do mês', 'gráfico', 'fluxo do mês',
  'relatorio financeiro', 'relatório financeiro', 'relatorio completo', 'relatório completo',
]
