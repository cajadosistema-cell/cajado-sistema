/**
 * lib/open-finance/pluggy-client.ts
 * Cliente para integração com a API Open Finance da Pluggy (Pluggy.ai)
 * Suporta modo real e modo de simulação/mock para testes sem credenciais.
 */

export interface PluggyConnector {
  id: number
  name: string
  primaryColor?: string
  institutionUrl?: string
  country?: string
  type?: string
  imageUrl?: string
  hasMFA?: boolean
}

export interface PluggyItem {
  id: string
  connector: PluggyConnector
  status: 'UPDATED' | 'UPDATING' | 'WAITING_USER_INPUT' | 'LOGIN_ERROR' | 'OUTDATED' | string
  executionStatus?: string
  lastUpdatedAt?: string
  error?: {
    code: string
    message: string
  } | null
  clientUserId?: string
  createdAt?: string
}

export interface PluggyAccount {
  id: string
  type: 'BANK' | 'CREDIT' | string
  subtype: 'CHECKING_ACCOUNT' | 'SAVINGS_ACCOUNT' | 'CREDIT_CARD' | string
  number: string
  name: string
  balance: number
  currencyCode: string
  itemId: string
  bankData?: {
    transferNumber?: string
    closingBalance?: number
  }
  creditData?: {
    creditLimit?: number
    availableCreditLimit?: number
    balanceCloseDate?: string
    balanceDueDate?: string
  }
}

export interface PluggyTransaction {
  id: string
  accountId: string
  description: string
  descriptionRaw?: string
  amount: number
  date: string // YYYY-MM-DD ou ISO
  createdAt?: string
  status: 'PENDING' | 'POSTED' | string
  type: 'DEBIT' | 'CREDIT' | string
  operationType?: string
  operationTypeAdditionalInfo?: string
  category?: string
  merchant?: {
    name?: string
    cnpj?: string
  } | null
  paymentData?: {
    payer?: {
      name?: string
      documentNumber?: { type?: string; value?: string }
      routingNumberISPB?: string
    }
    receiver?: {
      name?: string
      documentNumber?: { type?: string; value?: string }
      routingNumberISPB?: string
    }
    paymentMethod?: string
    reason?: string
    boletoMetadata?: any
  }
}

const PLUGGY_API_URL = process.env.PLUGGY_API_URL || 'https://api.pluggy.ai'
const PLUGGY_CLIENT_ID = process.env.PLUGGY_CLIENT_ID
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET

/**
 * Credenciais customizadas (por empresa) para acessar Items de outra conta Pluggy
 */
export interface PluggyCustomCredentials {
  clientId: string
  clientSecret: string
}

// Cache em memória do token de autenticação da Pluggy (global + por clientId)
const apiKeyCache = new Map<string, { key: string; expiresAt: number }>()

/**
 * Retorna se o cliente está operando em modo Mock / Demonstração
 */
export function isPluggyMockMode(custom?: PluggyCustomCredentials | null): boolean {
  const cid = custom?.clientId || PLUGGY_CLIENT_ID
  const csec = custom?.clientSecret || PLUGGY_CLIENT_SECRET
  return (
    !cid ||
    !csec ||
    cid.startsWith('mock_') ||
    cid === 'demo' ||
    cid === 'mock'
  )
}

/**
 * Obtém ou renova a API Key da Pluggy via POST /auth
 * Suporta credenciais customizadas (por empresa) ou credenciais globais do .env
 */
export async function getPluggyApiKey(custom?: PluggyCustomCredentials | null): Promise<string> {
  if (isPluggyMockMode(custom)) {
    return 'mock_api_key_cajado'
  }

  const clientId = custom?.clientId || PLUGGY_CLIENT_ID!
  const clientSecret = custom?.clientSecret || PLUGGY_CLIENT_SECRET!
  const cacheKey = clientId

  const now = Date.now()
  const cached = apiKeyCache.get(cacheKey)
  if (cached && cached.expiresAt > now + 60000) {
    return cached.key
  }

  const res = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId,
      clientSecret,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Falha na autenticação Pluggy: ${res.status} - ${errText}`)
  }

  const data = await res.json()
  // Pluggy API Keys costumam durar 2 horas (7200s); renovamos preventivamente a cada 1h45m
  apiKeyCache.set(cacheKey, { key: data.apiKey, expiresAt: now + 105 * 60 * 1000 })
  return data.apiKey
}

/**
 * Gera um Connect Token temporário para abertura segura do widget Pluggy Connect no frontend
 */
export async function createPluggyConnectToken(options?: {
  clientUserId?: string
  itemId?: string
  webhookUrl?: string
  customCredentials?: PluggyCustomCredentials | null
}): Promise<{ connectToken: string; isMock: boolean }> {
  if (isPluggyMockMode(options?.customCredentials)) {
    return {
      connectToken: `mock_connect_token_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      isMock: true,
    }
  }

  const apiKey = await getPluggyApiKey(options?.customCredentials)
  const payload: Record<string, unknown> = {}

  if (options?.clientUserId) payload.clientUserId = options.clientUserId
  if (options?.itemId) payload.itemId = options.itemId
  if (options?.webhookUrl) payload.webhookUrl = options.webhookUrl

  const res = await fetch(`${PLUGGY_API_URL}/connect_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': apiKey,
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Erro ao gerar Connect Token Pluggy: ${res.status} - ${errText}`)
  }

  const data = await res.json()
  return { connectToken: data.accessToken, isMock: false }
}

/**
 * Obtém detalhes de um Item (conexão de um banco)
 */
export async function getPluggyItem(itemId: string, custom?: PluggyCustomCredentials | null): Promise<PluggyItem> {
  if (isPluggyMockMode(custom) || itemId.startsWith('mock_item_')) {
    return {
      id: itemId,
      connector: {
        id: 201,
        name: itemId.includes('bradesco') ? 'Banco Bradesco' : itemId.includes('itau') ? 'Banco Itaú' : 'Nubank',
        imageUrl: 'https://cdn.pluggy.ai/assets/logos/201.png',
        primaryColor: itemId.includes('bradesco') ? '#cc092f' : '#820ad1',
      },
      status: 'UPDATED',
      executionStatus: 'SUCCESS',
      lastUpdatedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    }
  }

  const apiKey = await getPluggyApiKey(custom)
  const res = await fetch(`${PLUGGY_API_URL}/items/${itemId}`, {
    headers: { 'X-API-KEY': apiKey },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Erro ao buscar Item Pluggy: ${res.status} - ${errText}`)
  }

  return await res.json()
}

/**
 * Deleta uma conexão de banco na Pluggy
 */
export async function deletePluggyItem(itemId: string, custom?: PluggyCustomCredentials | null): Promise<boolean> {
  if (isPluggyMockMode(custom) || itemId.startsWith('mock_item_')) {
    return true
  }

  const apiKey = await getPluggyApiKey(custom)
  const res = await fetch(`${PLUGGY_API_URL}/items/${itemId}`, {
    method: 'DELETE',
    headers: { 'X-API-KEY': apiKey },
  })

  return res.ok
}

/**
 * Dispara atualização / sincronização forçada de um Item
 */
export async function syncPluggyItem(itemId: string, custom?: PluggyCustomCredentials | null): Promise<PluggyItem> {
  if (isPluggyMockMode(custom) || itemId.startsWith('mock_item_')) {
    return {
      id: itemId,
      connector: { id: 201, name: 'Banco Conectado' },
      status: 'UPDATED',
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  const apiKey = await getPluggyApiKey(custom)
  const res = await fetch(`${PLUGGY_API_URL}/items/${itemId}`, {
    method: 'PATCH',
    headers: { 'X-API-KEY': apiKey },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Erro ao sincronizar Item Pluggy: ${res.status} - ${errText}`)
  }

  return await res.json()
}

/**
 * Lista as contas vinculadas a um Item
 */
export async function getPluggyAccounts(itemId: string, custom?: PluggyCustomCredentials | null): Promise<PluggyAccount[]> {
  if (isPluggyMockMode(custom) || itemId.startsWith('mock_item_')) {
    const isBradesco = itemId.includes('bradesco')
    const isItau = itemId.includes('itau')
    const bancoNome = isBradesco ? 'Bradesco' : isItau ? 'Itaú' : 'Nubank'

    return [
      {
        id: `mock_acc_${itemId}_1`,
        itemId,
        type: 'BANK',
        subtype: 'CHECKING_ACCOUNT',
        name: `Conta Corrente ${bancoNome}`,
        number: '12345-6',
        balance: 14250.75,
        currencyCode: 'BRL',
      },
      {
        id: `mock_acc_${itemId}_2`,
        itemId,
        type: 'CREDIT',
        subtype: 'CREDIT_CARD',
        name: `Cartão de Crédito ${bancoNome}`,
        number: '**** 8892',
        balance: -2340.5,
        currencyCode: 'BRL',
        creditData: {
          creditLimit: 25000,
          availableCreditLimit: 22659.5,
        },
      },
    ]
  }

  const apiKey = await getPluggyApiKey(custom)
  const res = await fetch(`${PLUGGY_API_URL}/accounts?itemId=${encodeURIComponent(itemId)}`, {
    headers: { 'X-API-KEY': apiKey },
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Erro ao buscar Contas Pluggy: ${res.status} - ${errText}`)
  }

  const data = await res.json()
  return data.results || []
}

/**
 * Lista as transações de uma conta usando a API v2 da Pluggy (com paginação por cursor)
 */
export async function getPluggyTransactions(
  accountId: string,
  options?: { from?: string; pageSize?: number; de?: string; ate?: string; customCredentials?: PluggyCustomCredentials | null }
): Promise<PluggyTransaction[]> {
  if (isPluggyMockMode(options?.customCredentials) || accountId.startsWith('mock_acc_')) {
    const today = new Date()
    const d1 = today.toISOString().split('T')[0]
    const d2 = new Date(today.getTime() - 86400000).toISOString().split('T')[0]
    const d3 = new Date(today.getTime() - 2 * 86400000).toISOString().split('T')[0]

    return [
      {
        id: `mock_tx_${accountId}_1`,
        accountId,
        description: 'Pix Recebido - Cliente Contrato 01',
        amount: 3500.0,
        date: d1,
        status: 'POSTED',
        type: 'CREDIT',
        category: 'Receita Operacional',
      },
      {
        id: `mock_tx_${accountId}_2`,
        accountId,
        description: 'Posto Shell Combustível',
        amount: -285.5,
        date: d1,
        status: 'POSTED',
        type: 'DEBIT',
        category: 'Transporte',
      },
      {
        id: `mock_tx_${accountId}_3`,
        accountId,
        description: 'Uber * Viagens Corp',
        amount: -42.8,
        date: d2,
        status: 'POSTED',
        type: 'DEBIT',
        category: 'Transporte',
      },
      {
        id: `mock_tx_${accountId}_4`,
        accountId,
        description: 'Pagamento Fornecedor Material',
        amount: -1250.0,
        date: d3,
        status: 'POSTED',
        type: 'DEBIT',
        category: 'Operacional',
      },
    ]
  }

  const apiKey = await getPluggyApiKey(options?.customCredentials)
  const todas: PluggyTransaction[] = []
  let cursor: string | null = null

  // 24/09/2026: Pluggy aposentou o endpoint /transactions e passou a exigir /v2/transactions.
  // O endpoint v2 não aceita `from`, `to` ou `pageSize` na querystring — apenas `accountId` e `cursor`.
  // Realizamos paginação por cursor (até 15 páginas) e aplicamos o filtro de data em memória.
  for (let pagina = 0; pagina < 15; pagina++) {
    const params = new URLSearchParams({ accountId })
    if (cursor) params.set('cursor', cursor)

    const res = await fetch(`${PLUGGY_API_URL}/v2/transactions?${params.toString()}`, {
      headers: { 'X-API-KEY': apiKey },
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`Erro ao buscar Transações Pluggy (v2): ${res.status} - ${errText}`)
    }

    const data = await res.json()
    const lote = (data.results ?? data.data ?? []) as PluggyTransaction[]
    if (!Array.isArray(lote) || lote.length === 0) break

    todas.push(...lote)
    cursor = data.nextCursor ?? data.next_cursor ?? data.cursor ?? null
    if (!cursor) break
  }

  const de = options?.de || options?.from
  const ate = options?.ate

  if (!de && !ate) {
    return todas
  }

  return todas.filter(t => {
    const d = String(t.date ?? t.createdAt ?? '').slice(0, 10)
    return (!de || d >= de) && (!ate || d <= ate)
  })
}
