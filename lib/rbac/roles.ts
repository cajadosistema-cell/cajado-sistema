// ── Definição de roles e permissões do Sistema Cajado ────────

export type RoleSlug =
  | 'admin'
  | 'financeiro'
  | 'comercial'
  | 'atendimento'
  | 'trader'
  | 'visualizador'

export type Permissao =
  | '*'
  | 'financeiro:read' | 'financeiro:write'
  | 'crm:read' | 'crm:write'
  | 'vendas:read' | 'vendas:write'
  | 'inbox:read' | 'inbox:write'
  | 'trader:read' | 'trader:write'
  | 'investimentos:read'
  | 'relatorios:read'
  | 'equipe:read'
  | 'pos_venda:read' | 'pos_venda:write'
  | 'seguranca:read'
  | 'configuracoes:read' | 'configuracoes:write'
  | '*:read'

// Mapeamento de role → permissões
export const ROLE_PERMISSOES: Record<RoleSlug, Permissao[]> = {
  admin: ['*'],
  financeiro: ['financeiro:read', 'financeiro:write', 'relatorios:read', 'configuracoes:read'],
  comercial: ['vendas:read', 'vendas:write', 'crm:read', 'crm:write', 'inbox:read'],
  atendimento: ['inbox:read', 'inbox:write', 'pos_venda:read', 'pos_venda:write'],
  trader: ['trader:read', 'trader:write', 'investimentos:read'],
  visualizador: ['*:read'],
}

// Mapeamento de rota → permissão necessária
export const ROTA_PERMISSAO: Record<string, Permissao> = {
  '/financeiro':      'financeiro:read',
  '/cajado':          'crm:read',
  '/vendas':          'vendas:read',
  '/inbox':           'inbox:read',
  '/pos-venda':       'pos_venda:read',
  '/trader':          'trader:read',
  '/investimentos':   'investimentos:read',
  '/patrimonio':      'financeiro:read',
  '/pf-pessoal':      'financeiro:read',
  '/gestao-pessoal':  'equipe:read',
  '/seguranca-geral': 'seguranca:read',
  '/configuracoes':   'configuracoes:read',
  '/organizacao':     'relatorios:read',
  '/inteligencia':    'relatorios:read',
}

// Labels amigáveis dos roles
export const ROLE_LABELS: Record<RoleSlug, { label: string; descricao: string; cor: string }> = {
  admin:        { label: 'Administrador', descricao: 'Acesso total ao sistema',          cor: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  financeiro:   { label: 'Financeiro',    descricao: 'Módulos financeiros e relatórios', cor: 'text-teal-400 bg-teal-500/10 border-teal-500/20' },
  comercial:    { label: 'Comercial',     descricao: 'Vendas, CRM e Inbox',              cor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  atendimento:  { label: 'Atendimento',   descricao: 'Inbox e pós-venda',                cor: 'text-green-400 bg-green-500/10 border-green-500/20' },
  trader:       { label: 'Trader',        descricao: 'Trader e investimentos',           cor: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  visualizador: { label: 'Visualizador',  descricao: 'Somente leitura',                 cor: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' },
}

// Verifica se um array de permissões inclui a permissão necessária
export function temPermissao(permissoesUsuario: string[], permissaoNecessaria: Permissao): boolean {
  if (permissoesUsuario.includes('*')) return true
  if (permissoesUsuario.includes(permissaoNecessaria)) return true

  // Verificar wildcard de categoria: 'financeiro:*' cobre 'financeiro:read' e 'financeiro:write'
  const [modulo] = permissaoNecessaria.split(':')
  if (permissoesUsuario.includes(`${modulo}:*`)) return true

  // '*:read' cobre qualquer ':read'
  if (permissaoNecessaria.endsWith(':read') && permissoesUsuario.includes('*:read')) return true

  return false
}
