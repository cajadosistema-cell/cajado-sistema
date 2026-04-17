'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { RoleSlug, Permissao } from './roles'
import { temPermissao } from './roles'

type UserRole = {
  role_id: string
  roles: {
    nome: RoleSlug
    permissoes: string[]
  }
}

type UseRoleReturn = {
  role: RoleSlug | null
  permissoes: string[]
  isAdmin: boolean
  carregando: boolean
  pode: (permissao: Permissao) => boolean
}

/**
 * Hook para verificar o role e permissões do usuário logado.
 *
 * Uso:
 * const { pode, isAdmin, carregando } = useRole()
 * if (!pode('financeiro:write')) return <Sem acesso />
 */
export function useRole(): UseRoleReturn {
  const [role, setRole] = useState<RoleSlug | null>(null)
  const [permissoes, setPermissoes] = useState<string[]>(['*']) // padrão admin até confirmar
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function loadRole() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCarregando(false)
        return
      }

      // Buscar role do usuário
      const { data } = await (supabase.from('user_roles') as any)
        .select('role_id, roles(nome, permissoes)')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data?.roles) {
        const ur = data as unknown as UserRole
        setRole(ur.roles.nome)
        setPermissoes(ur.roles.permissoes ?? [])
      } else {
        // Sem role definido = admin por padrão (dono do sistema)
        setRole('admin')
        setPermissoes(['*'])
      }

      setCarregando(false)
    }

    loadRole()
  }, [])

  return {
    role,
    permissoes,
    isAdmin: role === 'admin' || permissoes.includes('*'),
    carregando,
    pode: (p: Permissao) => temPermissao(permissoes, p),
  }
}
