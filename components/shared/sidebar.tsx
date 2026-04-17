'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const navItems = [
  {
    group: '💰 Financeiro Corporativo',
    id: 'fin',
    items: [
      { href: '/financeiro', label: 'Painel Geral & Cartões', icon: '◈', color: 'text-teal-400' },
      { href: '/comissoes', label: 'Comissões & Parceiros', icon: '◈', color: 'text-amber-400' },
    ],
  },
  {
    group: '🤝 Comercial & WhatsApp',
    id: 'crm',
    items: [
      { href: '/inbox', label: 'Central Inbox (WhatsApp)', icon: '◈', color: 'text-green-400' },
      { href: '/cajado', label: 'Pipeline de Vendas (Cajado)', icon: '◈', color: 'text-amber-400' },
      { href: '/vendas', label: 'Fechamentos & OS', icon: '◈', color: 'text-emerald-400' },
      { href: '/pos-venda', label: 'Automação Pós-venda', icon: '◈', color: 'text-teal-400' },
      { href: '/seguranca-wa', label: 'Anti-Ban WhatsApp', icon: '◈', color: 'text-green-400' },
    ],
  },
  {
    group: '🚀 Estratégia Corporativa',
    id: 'est',
    items: [
      { href: '/expansao', label: 'Expansão & OKRs', icon: '◈', color: 'text-purple-400' },
      { href: '/inteligencia', label: 'Inteligência & IA', icon: '◈', color: 'text-purple-400' },
      { href: '/organizacao', label: 'Organização (Tarefas)', icon: '◈', color: 'text-cyan-400' },
      { href: '/diario', label: 'Diário de Bordo', icon: '◈', color: 'text-fuchsia-400' },
    ],
  },
  {
    group: '👤 Vida & Gestão Pessoal',
    id: 'pes',
    items: [
      { href: '/gestao-pessoal', label: 'Hábitos & Ponto', icon: '◈', color: 'text-orange-400' },
      { href: '/pf-pessoal', label: 'Financeiro Pessoal', icon: '◈', color: 'text-rose-400' },
      { href: '/patrimonio', label: 'Patrimônio Imobiliário', icon: '◈', color: 'text-indigo-400' },
      { href: '/investimentos', label: 'Investimentos', icon: '◈', color: 'text-blue-400' },
      { href: '/trader', label: 'Day Trader', icon: '◈', color: 'text-teal-400' },
    ],
  },
  {
    group: '⚙️ Configurações',
    id: 'cfg',
    items: [
      { href: '/configuracoes', label: 'Empresa & Permissões', icon: '⬡', color: 'text-zinc-400' },
      { href: '/seguranca-geral', label: 'Segurança & Logs', icon: '◈', color: 'text-pink-400' },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(true) // Padrão admin até descobrir
  const [permissoes, setPermissoes] = useState<string[]>([])
  const [userData, setUserData] = useState<{nome: string, cargo: string} | null>(null)
  
  // Estado do Accordion
  const [expanded, setExpanded] = useState<string[]>(['fin', 'crm']) // Inicia com Financeiro e CRM abertos

  const toggleGroup = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // 1. Tenta buscar na tabela 'funcionarios' (usuários criados pelo admin)
        const { data: func } = await supabase
          .from('funcionarios')
          .select('nome, cargo, permissoes, ativo')
          .eq('email', user.email || '')
          .single()

        if (func) {
          // É um funcionário com permissões restritas
          setIsAdmin(false)
          setPermissoes((func as any).permissoes || [])
          setUserData({ nome: (func as any).nome, cargo: (func as any).cargo || 'Funcionário' })
        } else {
          // Não encontrou na tabela de funcionários = é o dono/admin (conta principal)
          setIsAdmin(true)
          const emailBase = user.email ? user.email.split('@')[0] : 'Admin'
          const nomeCap = emailBase.charAt(0).toUpperCase() + emailBase.slice(1)
          setUserData({ nome: nomeCap, cargo: 'Administrador' })
        }
      }
    }
    loadUser()
  }, [])

  const filteredNavItems = navItems.map(group => ({
    ...group,
    items: group.items.filter(item => {
      if (isAdmin) return true
      // Remove a barra inicial para comparar com o ID de permissão (ex: '/financeiro' -> 'financeiro')
      const modName = item.href.replace('/', '')
      return permissoes.includes(modName)
    })
  })).filter(group => group.items.length > 0)

  // Início é restrito apenas ao Admin
  const inicioSempreVisivel = isAdmin

  return (
    <aside className="hidden md:flex w-56 shrink-0 bg-[#0d1120] border-r border-white/5 flex-col h-screen sticky top-0 z-40">
      <div className="px-4 py-5 border-b border-white/5 relative z-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f5a623] to-transparent"></div>
        <div className="flex items-center gap-2 px-1">
          <img src="/logo.png" alt="Cajado Soluções" className="h-8 w-auto object-contain drop-shadow-sm" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2 custom-scrollbar">
        {/* Link de Início Fixo e Destacado APENAS ADMIN */}
        {isAdmin && (
          <Link
            href="/inicio"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all mb-4',
              pathname === '/inicio'
                ? 'bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-400 shadow-sm border border-amber-500/20'
                : 'text-zinc-300 hover:text-amber-400 hover:bg-white/5'
            )}
          >
            <span className="text-amber-500">⬡</span>
            Dashboard Inicial
          </Link>
        )}

        <div className="space-y-1">
          {filteredNavItems.map(group => {
            const isExpanded = expanded.includes(group.id)
            const hasActiveChild = group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))

            return (
            <div key={group.id} className="mb-2">
              <button 
                onClick={() => toggleGroup(group.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer text-left",
                  hasActiveChild && !isExpanded ? "bg-white/5" : "hover:bg-white/5"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={cn("text-[11px] font-bold uppercase tracking-wider", hasActiveChild ? "text-zinc-200" : "text-zinc-400")}>
                    {group.group}
                  </span>
                </div>
                <span className={cn("text-xs text-zinc-500 transition-transform duration-200", isExpanded ? "rotate-90" : "")}>
                  ▶
                </span>
              </button>
              
              {isExpanded && (
                <div className="mt-1 ml-1 pl-3 border-l border-white/5 space-y-1 py-1">
                  {group.items.map(item => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
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
              )}
            </div>
          )})}
        </div>
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
