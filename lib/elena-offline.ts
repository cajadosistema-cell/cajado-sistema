/**
 * elena-offline.ts
 * Fila offline para a assistente Elena usando IndexedDB.
 * Quando o usuário registra algo sem internet, salva aqui.
 * Quando a internet volta, a fila é processada automaticamente.
 */

const DB_NAME = 'elena-offline-db'
const DB_VERSION = 1
const STORE_NAME = 'fila_registros'

export interface RegistroOffline {
  id?: number
  acao: Record<string, unknown>       // o mesmo JSON que seria enviado ao Supabase
  tipo: string                         // 'gasto' | 'receita' | 'agenda' | 'ocorrencia' | etc.
  user_id: string
  tentativas: number
  criado_em: string
  processado: boolean
}

// ── Abrir / criar o banco IndexedDB ──────────────────────────────────────────
function abrirDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true })
        store.createIndex('user_id',     'user_id',     { unique: false })
        store.createIndex('processado',  'processado',  { unique: false })
      }
    }

    req.onsuccess  = (e) => resolve((e.target as IDBOpenDBRequest).result)
    req.onerror    = (e) => reject((e.target as IDBOpenDBRequest).error)
  })
}

// ── Enfileirar um registro offline ────────────────────────────────────────────
export async function enqueueOffline(
  user_id: string,
  tipo: string,
  acao: Record<string, unknown>
): Promise<void> {
  try {
    const db = await abrirDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const registro: RegistroOffline = {
      acao,
      tipo,
      user_id,
      tentativas: 0,
      criado_em: new Date().toISOString(),
      processado: false,
    }
    store.add(registro)
    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res()
      tx.onerror    = () => rej(tx.error)
    })
    db.close()
    console.log('[Elena Offline] Registro enfileirado:', tipo, acao)
  } catch (err) {
    console.error('[Elena Offline] Erro ao enfileirar:', err)
  }
}

// ── Buscar fila pendente de um usuário ────────────────────────────────────────
export async function getPendentes(user_id: string): Promise<RegistroOffline[]> {
  try {
    const db = await abrirDB()
    const tx = db.transaction(STORE_NAME, 'readonly')
    const store = tx.objectStore(STORE_NAME)
    const idx = store.index('user_id')
    const pendentes: RegistroOffline[] = []

    await new Promise<void>((resolve, reject) => {
      const req = idx.openCursor(IDBKeyRange.only(user_id))
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          const r = cursor.value as RegistroOffline
          if (!r.processado) pendentes.push(r)
          cursor.continue()
        } else {
          resolve()
        }
      }
      req.onerror = () => reject(req.error)
    })

    db.close()
    return pendentes
  } catch {
    return []
  }
}

// ── Marcar um registro como processado ───────────────────────────────────────
export async function marcarProcessado(id: number): Promise<void> {
  try {
    const db = await abrirDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const req = store.get(id)

    req.onsuccess = (e) => {
      const rec = (e.target as IDBRequest).result as RegistroOffline
      if (rec) {
        rec.processado = true
        store.put(rec)
      }
    }

    await new Promise<void>((res, rej) => {
      tx.oncomplete = () => res()
      tx.onerror    = () => rej(tx.error)
    })
    db.close()
  } catch (err) {
    console.error('[Elena Offline] Erro ao marcar processado:', err)
  }
}

// ── Limpar registros processados (manutenção) ────────────────────────────────
export async function limparProcessados(): Promise<void> {
  try {
    const db = await abrirDB()
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)

    await new Promise<void>((resolve, reject) => {
      const req = store.openCursor()
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          const r = cursor.value as RegistroOffline
          if (r.processado) cursor.delete()
          cursor.continue()
        } else {
          resolve()
        }
      }
      req.onerror = () => reject(req.error)
    })

    db.close()
  } catch {}
}

// ── Contar pendentes ──────────────────────────────────────────────────────────
export async function contarPendentes(user_id: string): Promise<number> {
  const p = await getPendentes(user_id)
  return p.length
}

// ── Registrar Service Worker Background Sync (se disponível) ──────────────────
export async function registrarBackgroundSync(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    const reg = await navigator.serviceWorker.ready
    // @ts-expect-error — SyncManager não tem tipos no TS padrão
    if (reg.sync) {
      // @ts-expect-error
      await reg.sync.register('elena-sync')
      console.log('[Elena Offline] Background Sync registrado')
    }
  } catch {
    // Browser não suporta — o fallback via 'online' event já cobre isso
  }
}
