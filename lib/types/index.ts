// ============================================================
// TIPOS GLOBAIS - SISTEMA CAJADO
// ============================================================

export type UUID = string
export type Timestamp = string
export type DateString = string

export type Status = 'ativo' | 'inativo' | 'pendente' | 'arquivado'
export type AuditAction = 'create' | 'update' | 'delete'

// ============================================================
// M01 - FINANCEIRO
// ============================================================

export type ContaTipo = 'corrente' | 'poupanca' | 'investimento' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'
export type ContaCategoria = 'pf' | 'pj'
export type LancamentoTipo = 'receita' | 'despesa' | 'investimento' | 'transferencia'
export type LancamentoStatus = 'automatico' | 'pendente' | 'validado'
export type RegimeTipo = 'competencia' | 'caixa'
export type RecorrenciaTipo = 'diaria' | 'semanal' | 'mensal' | 'anual' | 'personalizada'

export interface Conta {
  id: UUID
  nome: string
  tipo: ContaTipo
  categoria: ContaCategoria
  banco?: string
  agencia?: string
  numero?: string
  saldo_atual: number
  saldo_inicial: number
  cor?: string
  ativo: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Lancamento {
  id: UUID
  conta_id: UUID
  conta?: Conta
  descricao: string
  valor: number
  tipo: LancamentoTipo
  regime: RegimeTipo
  status: LancamentoStatus
  data_competencia: DateString
  data_caixa?: DateString
  categoria?: string
  subcategoria?: string
  parcela_atual?: number
  total_parcelas?: number
  recorrencia_id?: UUID
  conciliado: boolean
  observacoes?: string
  anexos?: string[]
  created_by: UUID
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Recorrencia {
  id: UUID
  descricao: string
  valor: number
  tipo: LancamentoTipo
  conta_id: UUID
  frequencia: RecorrenciaTipo
  dia_vencimento?: number
  data_inicio: DateString
  data_fim?: DateString
  ativo: boolean
  created_at: Timestamp
}

export interface ConciliacaoItem {
  id: UUID
  lancamento_id?: UUID
  descricao: string
  valor: number
  data: DateString
  origem: 'extrato' | 'sistema'
  status: 'conciliado' | 'divergente' | 'nao_identificado'
  created_at: Timestamp
}

export interface PrevisaoCaixa {
  data: DateString
  entradas_previstas: number
  saidas_previstas: number
  saldo_previsto: number
  saldo_acumulado: number
}

// ============================================================
// M02 - CAJADO EMPRESA
// ============================================================

export type LeadStatus = 'novo' | 'proposta' | 'retomar' | 'cliente_ativo' | 'perdido'
export type LeadOrigem = 'whatsapp' | 'indicacao' | 'instagram' | 'google' | 'outro'
export type AtividadeTipo = 'mensagem' | 'ligacao' | 'reuniao' | 'proposta' | 'visita' | 'outro'
export type ParceiroStatus = 'ativo' | 'inativo' | 'suspenso'
export type CampanhaStatus = 'rascunho' | 'agendada' | 'enviando' | 'concluida' | 'pausada'

export interface Lead {
  id: UUID
  nome: string
  telefone: string
  email?: string
  origem: LeadOrigem
  servico_interesse?: string
  status: LeadStatus
  valor_estimado?: number
  atendente_id?: UUID
  parceiro_id?: UUID
  notas?: string
  ultimo_contato?: Timestamp
  proximo_followup?: Timestamp
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Atividade {
  id: UUID
  lead_id?: UUID
  cliente_id?: UUID
  tipo: AtividadeTipo
  descricao: string
  resultado?: string
  duracao_minutos?: number
  realizado_por: UUID
  realizado_em: Timestamp
  created_at: Timestamp
}

export interface MembroEquipe {
  id: UUID
  user_id: UUID
  nome: string
  cargo: string
  foto_url?: string
  meta_mensal?: number
  ativo: boolean
  created_at: Timestamp
}

export interface Parceiro {
  id: UUID
  nome: string
  telefone: string
  email?: string
  status: ParceiroStatus
  comissao_percentual: number
  total_indicacoes: number
  total_convertidas: number
  total_comissao: number
  meta_mensal?: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CheckIn {
  id: UUID
  membro_id: UUID
  membro?: MembroEquipe
  tipo: 'entrada' | 'saida'
  latitude?: number
  longitude?: number
  endereco?: string
  servico_descricao?: string
  foto_evidencia_url?: string
  tempo_execucao_minutos?: number
  observacoes?: string
  timestamp: Timestamp
}

export interface Campanha {
  id: UUID
  titulo: string
  mensagem: string
  status: CampanhaStatus
  numero_origem_id: UUID
  total_destinatarios: number
  enviados: number
  erros: number
  agendado_para?: Timestamp
  concluido_em?: Timestamp
  created_by: UUID
  created_at: Timestamp
}

export interface MensagemPadrao {
  id: UUID
  titulo: string
  conteudo: string
  categoria: string
  variaveis?: string[]
  created_at: Timestamp
}

// ============================================================
// M03 - SEGURANÇA WHATSAPP
// ============================================================

export type NumeroStatus = 'ativo' | 'backup' | 'bloqueado' | 'inativo'

export interface NumeroWhatsApp {
  id: UUID
  numero: string
  nome: string
  status: NumeroStatus
  instancia_id?: string
  limite_diario: number
  enviados_hoje: number
  intervalo_minimo_segundos: number
  is_backup: boolean
  notas?: string
  created_at: Timestamp
  updated_at: Timestamp
}

export interface BackupContatos {
  id: UUID
  numero_id: UUID
  total_contatos: number
  arquivo_url?: string
  created_at: Timestamp
}

// ============================================================
// M04 - ORGANIZAÇÃO
// ============================================================

export type ProjetoStatus = 'ativo' | 'pausado' | 'concluido' | 'cancelado'
export type IdeiaStatus = 'ideia' | 'analise' | 'execucao' | 'validada' | 'descartada'
export type PrazoTipo = 'curto' | 'medio' | 'longo'

export interface Projeto {
  id: UUID
  titulo: string
  descricao?: string
  status: ProjetoStatus
  data_inicio?: DateString
  data_fim_prevista?: DateString
  data_fim_real?: DateString
  responsavel_id?: UUID
  progresso_percentual: number
  proximos_passos?: string
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Ideia {
  id: UUID
  projeto_id?: UUID
  titulo: string
  descricao?: string
  status: IdeiaStatus
  prazo: PrazoTipo
  potencial_impacto?: 'baixo' | 'medio' | 'alto'
  notas?: string
  created_at: Timestamp
  updated_at: Timestamp
}

export interface Decisao {
  id: UUID
  projeto_id?: UUID
  titulo: string
  contexto: string
  decisao_tomada: string
  alternativas_consideradas?: string
  resultado?: string
  aprendizado?: string
  data_decisao: DateString
  created_by: UUID
  created_at: Timestamp
}

// ============================================================
// M05 - TRADER
// ============================================================

export type OperacaoTipo = 'compra' | 'venda' | 'opcao_call' | 'opcao_put'
export type OperacaoResultado = 'gain' | 'loss' | 'breakeven' | 'aberta'
export type MercadoTipo = 'acoes' | 'futuros' | 'cripto' | 'forex' | 'opcoes' | 'fii'

export interface Operacao {
  id: UUID
  ativo: string
  mercado: MercadoTipo
  tipo: OperacaoTipo
  data_entrada: Timestamp
  data_saida?: Timestamp
  preco_entrada: number
  preco_saida?: number
  quantidade: number
  stop_loss?: number
  take_profit?: number
  resultado: OperacaoResultado
  lucro_prejuizo?: number
  percentual?: number
  erros_cometidos?: string
  aprendizado?: string
  conta_id?: UUID
  created_at: Timestamp
}

export interface RegraRisco {
  id: UUID
  descricao: string
  valor_maximo_operacao: number
  percentual_max_capital: number
  max_operacoes_dia: number
  horario_inicio?: string
  horario_fim?: string
  ativo: boolean
  created_at: Timestamp
}

// ============================================================
// M06 - INVESTIMENTOS
// ============================================================

export type AtivoTipo = 'acao' | 'fii' | 'fundo' | 'cdb' | 'lci' | 'lca' | 'tesouro' | 'cripto' | 'outro'
export type LiquidezTipo = 'diaria' | 'semanal' | 'mensal' | 'no_vencimento'

export interface Ativo {
  id: UUID
  ticker?: string
  nome: string
  tipo: AtivoTipo
  quantidade: number
  preco_medio: number
  preco_atual?: number
  valor_investido: number
  valor_atual?: number
  liquidez: LiquidezTipo
  data_vencimento?: DateString
  rentabilidade_percentual?: number
  risco_nivel: 1 | 2 | 3 | 4 | 5
  corretora?: string
  conta_id?: UUID
  created_at: Timestamp
  updated_at: Timestamp
}

export interface MovimentacaoAtivo {
  id: UUID
  ativo_id: UUID
  tipo: 'compra' | 'venda' | 'dividendo' | 'jscp' | 'amortizacao'
  quantidade?: number
  valor: number
  data: DateString
  created_at: Timestamp
}

// ============================================================
// M07 - PATRIMÔNIO
// ============================================================

export type PatrimonioProjeto = 'imovel' | 'veiculo' | 'equipamento' | 'reforma' | 'outro'

export interface ProjetoPatrimonio {
  id: UUID
  titulo: string
  tipo: PatrimonioProjeto
  descricao?: string
  valor_investido_total: number
  valor_mercado_atual?: number
  roi_percentual?: number
  data_aquisicao?: DateString
  status: ProjetoStatus
  created_at: Timestamp
  updated_at: Timestamp
}

export interface CustoPatrimonio {
  id: UUID
  projeto_id: UUID
  descricao: string
  valor: number
  data: DateString
  categoria: string
  created_at: Timestamp
}

// ============================================================
// M08 - INTELIGÊNCIA
// ============================================================

export type AnaliseStatus = 'processando' | 'concluida' | 'erro'
export type TendenciaStatus = 'monitorando' | 'ativa' | 'descartada'

export interface AnaliseMercado {
  id: UUID
  titulo: string
  tipo: 'concorrente' | 'preco' | 'oportunidade' | 'tendencia'
  conteudo: string
  fonte?: string
  status: AnaliseStatus
  ia_gerada: boolean
  created_at: Timestamp
}

export interface Tendencia {
  id: UUID
  titulo: string
  descricao: string
  categoria: 'servico' | 'tecnologia' | 'mercado' | 'comportamento'
  status: TendenciaStatus
  impacto_estimado?: 'baixo' | 'medio' | 'alto'
  fontes?: string[]
  created_at: Timestamp
  updated_at: Timestamp
}

// ============================================================
// M09 - SEGURANÇA GERAL
// ============================================================

export interface LogAcesso {
  id: UUID
  user_id: UUID
  acao: string
  recurso: string
  recurso_id?: string
  ip?: string
  user_agent?: string
  sucesso: boolean
  detalhes?: Record<string, unknown>
  created_at: Timestamp
}

export interface AuditLog {
  id: UUID
  tabela: string
  registro_id: string
  acao: AuditAction
  valores_anteriores?: Record<string, unknown>
  valores_novos?: Record<string, unknown>
  user_id: UUID
  created_at: Timestamp
}

// ============================================================
// TIPOS UTILITÁRIOS
// ============================================================

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface ApiResponse<T = unknown> {
  data?: T
  error?: string
  message?: string
}

export interface DashboardMetrica {
  titulo: string
  valor: number | string
  variacao?: number
  variacao_tipo?: 'positiva' | 'negativa' | 'neutra'
  unidade?: string
  icone?: string
}
