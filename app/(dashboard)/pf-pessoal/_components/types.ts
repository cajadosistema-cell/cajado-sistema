// Tipos do módulo PF Pessoal

export type GastoPessoal = {
  id: string
  user_id: string
  descricao: string
  valor: number
  categoria: string
  forma_pagamento: string
  data: string
  recorrente: boolean
  notas: string | null
  parcelas?: number | null
  conta_id?: string | null   // cartão ou conta associada (migration 035)
  created_at: string
}

export type ReceitaPessoal = {
  id: string
  user_id: string
  descricao: string
  valor: number
  categoria: string
  recorrente: boolean
  data: string
  notas: string | null
  created_at: string
}

export type OrcamentoPessoal = {
  id: string
  user_id: string
  categoria: string
  valor_limite: number
  mes_referencia: string
  created_at: string
}

// Categorias de gastos com ícone
export const CATEGORIAS_GASTO: Record<string, { label: string; icon: string; color: string }> = {
  alimentacao:  { label: 'Alimentação',  icon: '🍔', color: '#f97316' },
  transporte:   { label: 'Transporte',   icon: '🚗', color: '#3b82f6' },
  moradia:      { label: 'Moradia',      icon: '🏠', color: '#8b5cf6' },
  saude:        { label: 'Saúde',        icon: '💊', color: '#ef4444' },
  educacao:     { label: 'Educação',     icon: '📚', color: '#10b981' },
  lazer:        { label: 'Lazer',        icon: '🎭', color: '#ec4899' },
  vestuario:    { label: 'Vestuário',    icon: '👕', color: '#f59e0b' },
  tecnologia:   { label: 'Tecnologia',   icon: '💻', color: '#6366f1' },
  outros:       { label: 'Outros',       icon: '📦', color: '#6b7280' },
}

// Categorias de receita
export const CATEGORIAS_RECEITA: Record<string, { label: string; icon: string }> = {
  pro_labore:   { label: 'Pró-labore',   icon: '💼' },
  salario:      { label: 'Salário',      icon: '💰' },
  freelance:    { label: 'Freelance',    icon: '🖥️' },
  dividendos:   { label: 'Dividendos',  icon: '📈' },
  aluguel:      { label: 'Aluguel',      icon: '🏢' },
  outros:       { label: 'Outros',       icon: '💵' },
}

// Detecta categoria por palavra-chave na descrição
export function detectarCategoria(descricao: string): string {
  const d = descricao.toLowerCase()
  if (/uber|taxi|gasolineira|combustível|onibus|metrô|estacionamento|pedágio/.test(d)) return 'transporte'
  if (/ifood|restaurante|padaria|supermercado|mercado|lanche|pizza|hamburguer/.test(d)) return 'alimentacao'
  if (/aluguel|condomínio|iptu|água|luz|energia|gás|internet/.test(d)) return 'moradia'
  if (/farmácia|médico|hospital|plano|academia|dentista/.test(d)) return 'saude'
  if (/escola|faculdade|curso|livro|mensalidade/.test(d)) return 'educacao'
  if (/netflix|spotify|cinema|teatro|viagem|hotel|show/.test(d)) return 'lazer'
  if (/roupa|calçado|shopping/.test(d)) return 'vestuario'
  if (/apple|samsung|celular|notebook|software/.test(d)) return 'tecnologia'
  return 'outros'
}

// ── Compromissos Fixos (migration 060) ──
export type CategoriaCompromisso = 'cartao' | 'boleto_imovel' | 'investimento' | 'conta_fixa' | 'outro'
export type StatusPagamento = 'pendente' | 'pago' | 'parcial' | 'atrasado'

export type CompromissoFixo = {
  id: string
  user_id: string
  categoria: CategoriaCompromisso
  descricao: string
  valor: number
  dia_vencimento: number | null
  recorrente: boolean
  ativo: boolean
  conta_id: string | null
  metadados: Record<string, any> | null
  created_at: string
  updated_at: string
}

export type HistoricoPagamentoMensal = {
  id: string
  user_id: string
  compromisso_id: string
  mes_referencia: string
  status: StatusPagamento
  valor_pago: number | null
  data_pagamento: string | null
  notas: string | null
  created_at: string
}

export const CATEGORIA_COMPROMISSO: Record<CategoriaCompromisso, { label: string; icon: string; cor: string }> = {
  cartao:        { label: 'Cartão',          icon: '💳', cor: '#f59e0b' },
  boleto_imovel: { label: 'Boleto Imóvel',   icon: '🏠', cor: '#3b82f6' },
  investimento:  { label: 'Investimento',     icon: '📈', cor: '#10b981' },
  conta_fixa:    { label: 'Conta Fixa',       icon: '📋', cor: '#8b5cf6' },
  outro:         { label: 'Outro',            icon: '📦', cor: '#6b7280' },
}

export const STATUS_CONFIG: Record<StatusPagamento, { label: string; icon: string; cor: string; bg: string }> = {
  pendente: { label: 'Pendente', icon: '⏳', cor: '#f59e0b', bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400' },
  pago:     { label: 'Pago',     icon: '✅', cor: '#10b981', bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' },
  parcial:  { label: 'Parcial',  icon: '⚡', cor: '#3b82f6', bg: 'bg-blue-500/10 border-blue-500/20 text-blue-400' },
  atrasado: { label: 'Atrasado', icon: '🚨', cor: '#ef4444', bg: 'bg-red-500/10 border-red-500/20 text-red-400' },
}

export function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
