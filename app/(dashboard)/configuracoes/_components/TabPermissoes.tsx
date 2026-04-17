'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ROLE_LABELS, ROLE_PERMISSOES } from '@/lib/rbac/roles'
import type { RoleSlug } from '@/lib/rbac/roles'

type Perfil = {
  id: string
  nome: string
  email: string
  cargo: string | null
}

type UserRole = {
  id: string
  user_id: string
  role_id: string
  roles: {
    id: string
    nome: RoleSlug
  }
}

type Role = {
  id: string
  nome: RoleSlug
  descricao: string
  permissoes: string[]
}

function initials(nome: string) {
  return nome.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

export function TabPermissoes() {
  const supabase = createClient()
  const [perfis, setPerfis] = useState<Perfil[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null)

  const carregar = async () => {
    setCarregando(true)
    const [{ data: p }, { data: r }, { data: ur }] = await Promise.all([
      (supabase.from('perfis') as any).select('id,nome,email,cargo').order('nome'),
      (supabase.from('roles') as any).select('*').order('nome'),
      (supabase.from('user_roles') as any).select('id,user_id,role_id,roles(id,nome)'),
    ])
    setPerfis(p ?? [])
    setRoles(r ?? [])
    setUserRoles(ur ?? [])
    setCarregando(false)
  }

  useEffect(() => { carregar() }, [])

  const getRoleDoUser = (userId: string): string | null => {
    const ur = userRoles.find(r => r.user_id === userId)
    return ur?.roles?.nome ?? null
  }

  const getRoleIdBySlug = (slug: string): string | null => {
    return roles.find(r => r.nome === slug)?.id ?? null
  }

  const atribuirRole = async (userId: string, roleSlug: string) => {
    setSalvando(userId)
    setMsg(null)

    const roleId = getRoleIdBySlug(roleSlug)
    if (!roleId) return

    const existente = userRoles.find(ur => ur.user_id === userId)

    if (existente) {
      await (supabase.from('user_roles') as any)
        .update({ role_id: roleId })
        .eq('id', existente.id)
    } else {
      await (supabase.from('user_roles') as any).insert({
        user_id: userId,
        role_id: roleId,
      })
    }

    setMsg({ ok: true, texto: 'Permissão atualizada com sucesso!' })
    setTimeout(() => setMsg(null), 3000)
    setSalvando(null)
    await carregar()
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-zinc-600">Carregando permissões...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold text-zinc-300 mb-1">🔐 Controle de Acesso por Role</h2>
        <p className="text-xs text-zinc-500">
          Atribua um papel a cada colaborador. O sistema controlará automaticamente o acesso aos módulos.
        </p>
      </div>

      {/* Legenda de roles */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {roles.map(r => {
          const info = ROLE_LABELS[r.nome as RoleSlug]
          if (!info) return null
          return (
            <div key={r.id} className={`border rounded-xl p-3 ${info.cor}`}>
              <p className="text-xs font-semibold">{info.label}</p>
              <p className="text-[10px] mt-0.5 opacity-70">{info.descricao}</p>
            </div>
          )
        })}
      </div>

      {/* Notificação */}
      {msg && (
        <div className={`text-xs px-4 py-2.5 rounded-lg border ${
          msg.ok
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
            : 'bg-red-500/10 border-red-500/20 text-red-300'
        }`}>
          {msg.ok ? '✅' : '❌'} {msg.texto}
        </div>
      )}

      {/* Lista de usuários */}
      <div className="space-y-3">
        {perfis.length === 0 ? (
          <p className="text-sm text-zinc-600 text-center py-8">Nenhum usuário cadastrado ainda.</p>
        ) : (
          perfis.map(perfil => {
            const roleAtual = getRoleDoUser(perfil.id)
            const info = roleAtual ? ROLE_LABELS[roleAtual as RoleSlug] : null

            return (
              <div key={perfil.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap">
                {/* Info do usuário */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                    {initials(perfil.nome)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{perfil.nome}</p>
                    <p className="text-xs text-zinc-500">{perfil.email}</p>
                  </div>
                </div>

                {/* Role atual */}
                <div className="flex items-center gap-3">
                  {info ? (
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${info.cor}`}>
                      {info.label}
                    </span>
                  ) : (
                    <span className="text-xs text-zinc-600 px-2.5 py-1 rounded-lg border border-zinc-700">
                      Sem role (admin padrão)
                    </span>
                  )}
                </div>

                {/* Selector de role */}
                <div className="flex items-center gap-2">
                  <select
                    className="input text-xs py-1.5 w-auto"
                    value={roleAtual ?? 'admin'}
                    onChange={e => atribuirRole(perfil.id, e.target.value)}
                    disabled={salvando === perfil.id}
                  >
                    {roles.map(r => (
                      <option key={r.id} value={r.nome}>
                        {ROLE_LABELS[r.nome as RoleSlug]?.label ?? r.nome}
                      </option>
                    ))}
                  </select>
                  {salvando === perfil.id && (
                    <span className="text-xs text-zinc-500">Salvando...</span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Tabela de permissões por role */}
      <details className="group">
        <summary className="text-xs text-zinc-500 hover:text-zinc-300 cursor-pointer select-none list-none flex items-center gap-1">
          <span className="group-open:rotate-90 transition-transform">▶</span>
          Ver detalhes de permissões por role
        </summary>
        <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-zinc-500 pb-2 pr-4">Role</th>
                <th className="text-left text-zinc-500 pb-2">Permissões</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(ROLE_LABELS).map(([slug, info]) => (
                <tr key={slug} className="border-b border-zinc-800/50 last:border-0">
                  <td className="py-2 pr-4">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${info.cor}`}>
                      {info.label}
                    </span>
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {ROLE_PERMISSOES[slug as RoleSlug].map(p => (
                        <span key={p} className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[9px] font-mono">
                          {p}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
