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

export function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}
