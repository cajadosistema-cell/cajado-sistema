'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  {
    group: 'Visão Geral',
    items: [
      { href: '/inicio', label: 'Início', icon: '⬡', color: 'text-amber-400' },
    ],
  },
  {
    group: 'Principal',
    items: [
      { href: '/financeiro', label: 'Financeiro', icon: '◈', color: 'text-teal-400' },
      { href: '/cajado', label: 'Cajado Empresa', icon: '◈', color: 'text-amber-400' },
      { href: '/vendas', label: 'Vendas / OS', icon: '◈', color: 'text-emerald-400' },
      { href: '/comissoes', label: 'Comissões/Parceiros', icon: '◈', color: 'text-amber-400' },
    ],
  },
  {
    group: 'Operações',
    items: [
      { href: '/seguranca-wa', label: 'Seg. WhatsApp', icon: '◈', color: 'text-green-400' },
      { href: '/inbox', label: 'Inbox WhatsApp', icon: '◈', color: 'text-green-400' },
      { href: '/organizacao', label: 'Organização', icon: '◈', color: 'text-cyan-400' },
      { href: '/pos-venda', label: 'Pós-venda', icon: '◈', color: 'text-teal-400' },
    ],
  },
  {
    group: 'Financeiro Pessoal',
    items: [
      { href: '/gestao-pessoal', label: 'Gestão Pessoal', icon: '◈', color: 'text-rose-400' },
      { href: '/trader', label: 'Trader', icon: '◈', color: 'text-teal-400' },
      { href: '/investimentos', label: 'Investimentos', icon: '◈', color: 'text-blue-400' },
      { href: '/patrimonio', label: 'Patrimônio', icon: '◈', color: 'text-indigo-400' },
    ],
  },
  {
    group: 'Sistemas',
    items: [
      { href: '/inteligencia', label: 'Inteligência', icon: '◈', color: 'text-purple-400' },
      { href: '/diario', label: 'Diário Estratégico', icon: '◈', color: 'text-fuchsia-400' },
      { href: '/seguranca-geral', label: 'Segurança Geral', icon: '◈', color: 'text-pink-400' },
      { href: '/configuracoes', label: 'Configurações', icon: '⬡', color: 'text-zinc-400' },
    ],
  },

]

export function Sidebar() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(true) // Padrão admin até descobrir
  const [permissoes, setPermissoes] = useState<string[]>([])
  const [userData, setUserData] = useState<{nome: string, cargo: string} | null>(null)

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data } = await supabase.from('usuarios').select('*').eq('email', user.email || '').single()
        const func = data as any
        if (func) {
          const isUserAdmin = func.role === 'admin' || func.setor === 'todos'
          setIsAdmin(isUserAdmin)
          setPermissoes(func.permissoes || [])
          setUserData({ nome: func.nome, cargo: func.cargo || (isUserAdmin ? 'Administrador' : 'Membro') })
        } else {
          // É o dono / admin
          setIsAdmin(true)
          setUserData({ nome: 'Maiara', cargo: 'CEO · Cajado' })
        }
      }
    }
    loadUser()
  }, [])

  const filteredNavItems = navItems.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (isAdmin) return true
      const modName = item.href.replace('/', '')
      return permissoes.includes(modName)
    })
  })).filter(group => group.items.length > 0)

  return (
    <aside className="w-56 shrink-0 bg-[#0d1120] border-r border-white/5 flex flex-col h-screen sticky top-0 relative">
      <div className="px-4 py-5 border-b border-white/5 relative z-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f5a623] to-transparent"></div>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center shrink-0 shadow-[0_4px_12px_rgba(245,166,35,0.3)]">
            <span className="text-zinc-950 font-bold text-sm">C</span>
          </div>
          <span className="font-semibold text-sm text-zinc-100 font-['Syne']">Sistema Cajado</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {filteredNavItems.map(group => (
          <div key={group.group} className="mb-5">
            <p className="text-[10px] font-semibold text-[#8b98b8] uppercase tracking-widest px-2 mb-2 opacity-80">
              {group.group}
            </p>
            {group.items.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all mb-1',
                    isActive
                      ? 'bg-[#1f2744] text-white shadow-sm'
                      : 'text-[#8b98b8] hover:text-white hover:bg-white/5'
                  )}
                >
                  <span className={cn('text-base', isActive ? item.color : 'text-zinc-500 group-hover:text-zinc-300')}>
                    {item.icon}
                  </span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-white/5">
        <SidebarUser userData={userData} />
      </div>
    </aside>
  )
}

function SidebarUser({ userData }: { userData: {nome: string, cargo: string} | null }) {
  const router = useRouter()
  
  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const nome = userData?.nome || 'Carregando...'
  const cargo = userData?.cargo || ''
  const inicial = userData?.nome ? userData.nome.charAt(0).toUpperCase() : '?'

  return (
    <div className="flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f5a623] to-[#c07000] flex items-center justify-center shadow-lg shrink-0">
        <span className="font-['Syne'] text-black text-xs font-bold">{inicial}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-zinc-100 truncate">{nome}</p>
        <p className="text-[10px] text-[#8b98b8] truncate">{cargo}</p>
      </div>
      <button 
        onClick={handleLogout}
        className="ml-auto px-2 py-1 rounded-md text-[10px] font-semibold text-[#8b98b8] bg-red-500/10 border border-red-500/20 hover:text-red-400 hover:bg-red-500/20 hover:border-red-500/40 transition-all"
        title="Sair do sistema"
      >
        Sair
      </button>
    </div>
  )
}
