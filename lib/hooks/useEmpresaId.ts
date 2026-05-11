'use client'

/**
 * useEmpresaId — Hook compartilhado para obter empresa_id e user_id do usuário logado.
 *
 * Uso:
 *   const { empresaId, userId, loading } = useEmpresaId()
 *
 * Combina com useSupabaseQuery:
 *   useSupabaseQuery('tabela', { filters: { empresa_id: empresaId }, enabled: !!empresaId })
 *
 * IMPORTANTE:
 * - O RLS do Supabase (migration 014) já garante isolamento por empresa no banco.
 * - Passar `enabled: !!empresaId` evita queries desnecessárias antes do auth carregar.
 * - Passar `filters: { empresa_id: empresaId }` é redundante mas melhora performance
 *   (evita que o banco filtre do zero via RLS function).
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useEmpresaId() {
  const [userId,    setUserId]    = useState('')
  const [empresaId, setEmpresaId] = useState('')
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setLoading(false); return }
      setUserId(data.user.id)

      const { data: perfil } = await (supabase.from('perfis') as any)
        .select('empresa_id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (perfil?.empresa_id) setEmpresaId(perfil.empresa_id)
      setLoading(false)
    })
  }, [])

  return { empresaId, userId, loading }
}
