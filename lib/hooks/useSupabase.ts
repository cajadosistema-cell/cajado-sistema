'use client'

import { createClient } from '@/lib/supabase/client'
import { useEffect, useState, useCallback } from 'react'

// Hook genérico para buscar dados de qualquer tabela
export function useSupabaseQuery<T>(
  table: string,
  options?: {
    select?: string
    filters?: Record<string, unknown>
    orderBy?: { column: string; ascending?: boolean }
    limit?: number
    enabled?: boolean
  }
) {
  const [data, setData] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Stable serialised key so useCallback doesn't need JSON.stringify in deps
  const optionsKey = JSON.stringify(options)

  const fetch = useCallback(async () => {
    if (options?.enabled === false) return
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query: any = supabase
        .from(table)
        .select(options?.select ?? '*')

      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          query = query.eq(key, value)
        }
      }

      if (options?.orderBy) {
        query = query.order(options.orderBy.column, {
          ascending: options.orderBy.ascending ?? false,
        })
      }

      if (options?.limit) {
        query = query.limit(options.limit)
      }

      const { data: result, error: err } = await query

      if (err) throw err
      setData((result as T[]) ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar dados')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, optionsKey])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// Hook para buscar um único registro
export function useSupabaseRecord<T>(
  table: string,
  id: string | null,
  select = '*'
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    const supabase = createClient()
    supabase
      .from(table)
      .select(select)
      .eq('id', id)
      .single()
      .then(({ data: result, error: err }) => {
        if (err) setError(err.message)
        else setData(result as T)
        setLoading(false)
      })
  }, [table, id, select])

  return { data, loading, error }
}

// Hook para mutações (insert, update, delete)
export function useSupabaseMutation(table: string) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const insert = async (data: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder = supabase.from(table) as any
    const { data: result, error: err } = await builder
      .insert(data)
      .select()
      .single()
    setLoading(false)
    if (err) { setError(err.message as string); return null }
    return result
  }

  const update = async (id: string, data: Record<string, unknown>) => {
    setLoading(true)
    setError(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const builder = supabase.from(table) as any
    const { data: result, error: err } = await builder
      .update(data)
      .eq('id', id)
      .select()
      .single()
    setLoading(false)
    if (err) { setError(err.message as string); return null }
    return result
  }

  const remove = async (id: string) => {
    setLoading(true)
    setError(null)
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    setLoading(false)
    if (err) { setError(err.message); return false }
    return true
  }

  return { insert, update, remove, loading, error }
}
