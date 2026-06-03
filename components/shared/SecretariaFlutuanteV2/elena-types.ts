// ── elena-types.ts ───────────────────────────────────────────
// Todos os tipos compartilhados da Elena. Importe daqui — nunca redefina em outro arquivo.

export interface AttachedFile {
  base64: string
  mime: string
  name: string
  isImage: boolean
  preview?: string
}

export interface ConfirmacaoSalvamento {
  tipo: string
  descricao: string
  valor?: number
  contaNome?: string
  data?: string
  categoria?: string
  modulo: string
  rota?: string
  icone: string
  ultimoId?: string
  ultimaTabela?: string
}

export interface Msg {
  id: string
  role: 'ai' | 'user'
  texto: string
  acoes?: AcaoIA[]
  anexo?: string
  created_at?: string
  confirmacao?: ConfirmacaoSalvamento
}

export type AcaoTipo =
  | 'gasto'
  | 'receita'
  | 'agenda'
  | 'ocorrencia'
  | 'gasto_empresa'
  | 'receita_empresa'
  | 'ideia'
  | 'registro'
  | 'relatorio'
  | 'backup_chat'
  | 'transferencia'
  | 'cancelar'
  | 'definir_meta'
  | 'gerar_checklist'
  | 'relatorio_colaboradores'
  | 'gerar_dashboard'
  | 'importar_extrato'
  | 'projecao_mes'
  | 'registro_livre'
  | 'buscar_lancamento'
  | 'editar_lancamento'
  | 'fatura_cartao'
  | 'cadastrar_conta'
  | 'cadastrar_cartao'

export interface AcaoIA {
  tipo: AcaoTipo
  dados: Record<string, any>
  label: string
  status?: 'pending' | 'saving' | 'saved' | 'error'
  errorMsg?: string
}

export interface ContaResolvida {
  id: string
  nome: string
  categoria?: string
}
