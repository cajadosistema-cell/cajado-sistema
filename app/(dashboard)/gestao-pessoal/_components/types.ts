// Tipos compartilhados do módulo Equipe
// Importar em todos os _components do módulo

export type Colaborador = {
  id: string
  nome: string
  email: string
  cargo: string | null
  foto_url: string | null
  meta_mensal: number | null
  ativo: boolean
  created_at: string
  // joined from colaboradores
  setor: string | null
  matricula: string | null
  data_admissao: string | null
  cargo_detalhado: string | null
  perfil_disc: string | null
  carga_horaria_semanal: number | null
  meta_tarefas_mes: number | null
}

export type RegistroPonto = {
  id: string
  user_id: string
  tipo: 'entrada' | 'saida' | 'pausa_inicio' | 'pausa_fim'
  timestamp: string
  observacoes: string | null
  created_at: string
}

export type Tarefa = {
  id: string
  titulo: string
  descricao: string | null
  responsavel_id: string | null
  criado_por: string | null
  status: 'a_fazer' | 'em_andamento' | 'concluida' | 'cancelada'
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente'
  prazo: string | null
  modulo: string | null
  concluida_em: string | null
  created_at: string
  updated_at: string
}

export type Ocorrencia = {
  id: string
  tipo: 'erro' | 'acerto' | 'alerta' | 'elogio'
  descricao: string
  colaborador_id: string | null
  registrado_por: string | null
  modulo: string | null
  impacto: 'baixo' | 'medio' | 'alto' | null
  resolvida: boolean
  resolucao: string | null
  created_at: string
}

// Helpers de labels
export const TIPO_PONTO_LABEL: Record<RegistroPonto['tipo'], string> = {
  entrada: 'Entrada',
  saida: 'Saída',
  pausa_inicio: 'Pausa',
  pausa_fim: 'Retorno',
}

export const STATUS_TAREFA_LABEL: Record<Tarefa['status'], string> = {
  a_fazer: 'A fazer',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const PRIORIDADE_COLOR: Record<Tarefa['prioridade'], string> = {
  baixa: 'text-zinc-400 bg-zinc-800',
  media: 'text-blue-400 bg-blue-500/10',
  alta: 'text-amber-400 bg-amber-500/10',
  urgente: 'text-red-400 bg-red-500/10',
}

export const TIPO_OCORRENCIA_COLOR: Record<Ocorrencia['tipo'], string> = {
  erro: 'text-red-400 bg-red-500/10 border-red-500/20',
  acerto: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  alerta: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  elogio: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
}

export const TIPO_OCORRENCIA_ICON: Record<Ocorrencia['tipo'], string> = {
  erro: '❌',
  acerto: '✅',
  alerta: '⚠️',
  elogio: '⭐',
}
