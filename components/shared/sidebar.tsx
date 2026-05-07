'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { ThemeToggle } from '@/components/cajado/ThemeToggle'
import { PWAInstallButton } from '@/components/shared/PWAInstallBanner'

// ── 🏢 EMPRESA — visível para todos com permissão ─────────────
const NAV_EMPRESA: Array<{
  group: string; id: string; desktopOnly?: boolean
  items: Array<{ href: string; label: string; desktopOnly?: boolean }>
}> = [
  {
    group: '💰 Financeiro', id: 'fin',
    items: [
      { href: '/financeiro', label: '🏦 Contas & Caixa' },
      { href: '/comissoes',  label: '🤝 Comissões & Parceiros', desktopOnly: true },
    ],
  },
  {
    group: '📦 Vendas & CRM', id: 'crm',
    items: [
      { href: '/inbox',        label: '💬 Inbox WhatsApp' },
      { href: '/cajado',       label: '🔀 Funil CRM',              desktopOnly: true },
      { href: '/vendas',       label: '📋 Fechamentos & OS' },
      { href: '/pos-venda',    label: '🔁 Pós-venda',              desktopOnly: true },
      { href: '/seguranca-wa', label: '🛡️ Anti-Ban WA',           desktopOnly: true },
    ],
  },
  {
    group: '🏢 Equipe & Operações', id: 'eqp',
    items: [
      { href: '/comunicacao',  label: '🗨️ Chat da Equipe' },
      { href: '/inteligencia', label: '🧠 IA & Automações' },
      { href: '/organizacao',  label: '✅ Tarefas & Projetos' },
    ],
  },
  {
    group: '⚙️ Configurações', id: 'cfg', desktopOnly: true,
    items: [
      { href: '/configuracoes',   label: '🏢 Empresa & Equipe',  desktopOnly: true },
      { href: '/seguranca-geral', label: '🔒 Segurança & Logs',  desktopOnly: true },
      { href: '/manual',          label: '📖 Manual do Sistema', desktopOnly: true },
    ],
  },
]

// ── 👤 PESSOAL — visível apenas para admin ─────────────────────
const NAV_PESSOAL: Array<{
  group: string; id: string
  items: Array<{ href: string; label: string }>
}> = [
  {
    group: '🎯 Minha Rotina', id: 'rotina',
    items: [
      { href: '/dashboard-pessoal', label: '🏠 Painel Pessoal'  },
      { href: '/expansao',          label: '🚀 Objetivos & OKRs' },
      { href: '/diario',            label: '📓 Diário de Bordo'  },
    ],
  },
  {
    group: '💎 Finanças Pessoais', id: 'pfin',
    items: [
      { href: '/pf-pessoal',    label: '💵 Lançamentos PF'  },
      { href: '/patrimonio',    label: '🏠 Patrimônio'       },
      { href: '/investimentos', label: '📈 Investimentos'    },
      { href: '/trader',        label: '📊 Day Trader'       },
      { href: '/gestao-pessoal',label: '👥 Equipe Pessoal'  },
    ],
  },
]

// ── 📱 BOTTOM NAV MOBILE — apenas itens essenciais ─────────────
const BOTTOM_NAV = [
  { href: '/inicio',     label: 'Início',     icon: '🏠' },
  { href: '/inbox',      label: 'Inbox',      icon: '💬' },
  { href: '/financeiro', label: 'Financeiro', icon: '💰' },
  { href: '/vendas',     label: 'Vendas',     icon: '📋' },
  { href: '/pf-pessoal', label: 'Pessoal',    icon: '👤' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isAdmin, setIsAdmin] = useState(true)
  const [permissoes, setPermissoes] = useState<string[]>([])
  const [userData, setUserData] = useState<{nome: string, cargo: string, email: string} | null>(null)
  const [expanded, setExpanded] = useState<string[]>(['fin', 'crm'])

  const toggleGroup = (id: string) => {
    setExpanded(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: func } = await supabase
          .from('funcionarios')
          .select('nome, cargo, permissoes, ativo')
          .eq('email', user.email || '')
          .single()

        if (func) {
          setIsAdmin(false)
          setPermissoes((func as any).permissoes || [])
          setUserData({ nome: (func as any).nome, cargo: (func as any).cargo || 'Funcionário', email: user.email || '' })
        } else {
          setIsAdmin(true)
          const emailBase = user.email ? user.email.split('@')[0] : 'Admin'
          const nomeCap = emailBase.charAt(0).toUpperCase() + emailBase.slice(1)
          setUserData({ nome: nomeCap, cargo: 'Administrador', email: user.email || '' })
        }
      }
    }
    loadUser()
  }, [])

  // Filtra por permissões — mantém a lógica existente
  const filterGroup = (items: { href: string; label: string }[]) =>
    items.filter(item => {
      if (isAdmin) return true
      const modName = item.href.replace('/', '')
      return permissoes.includes(modName)
    })

  const filteredEmpresa = NAV_EMPRESA
    .map(g => ({ ...g, items: filterGroup(g.items) }))
    .filter(g => g.items.length > 0)

  const filteredPessoal = isAdmin
    ? NAV_PESSOAL.map(g => ({ ...g, items: filterGroup(g.items) })).filter(g => g.items.length > 0)
    : []

  // Componente auxiliar para renderizar um grupo de navegação
  const NavGroup = ({ group }: { group: typeof NAV_EMPRESA[0] }) => {
    const isExpanded = expanded.includes(group.id)
    const hasActiveChild = group.items.some(i => pathname === i.href || pathname.startsWith(i.href + '/'))
    return (
      <div className="mb-1">
        <button
          onClick={() => toggleGroup(group.id)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors cursor-pointer text-left hover:bg-surface"
        >
          <span className={cn(
            'text-[11px] font-bold uppercase tracking-wider',
            hasActiveChild ? 'text-fg' : 'text-fg-tertiary'
          )}>
            {group.group}
          </span>
          <span className={cn('text-xs text-fg-tertiary transition-transform duration-200', isExpanded ? 'rotate-90' : '')}>
            ▶
          </span>
        </button>

        {isExpanded && (
          <div className="mt-0.5 ml-1 pl-3 space-y-0.5 py-0.5"
            style={{ borderLeft: '0.5px solid var(--border-subtle)' }}
          >
            {group.items.map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium transition-all',
                    isActive
                      ? 'text-fg'
                      : 'text-fg-secondary hover:text-fg hover:bg-surface'
                  )}
                  style={isActive ? { backgroundColor: 'var(--bg-surface)' } : {}}
                >
                  <span style={{ color: isActive ? 'var(--brand-gold)' : 'var(--text-tertiary)', fontSize: 12 }}>◈</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <aside className="hidden md:flex w-56 shrink-0 flex-col h-screen sticky top-0 z-40 border-r border-[0.5px]"
      style={{ backgroundColor: 'var(--bg-sidebar)', borderColor: 'var(--border-subtle)' }}
    >
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/5 relative z-10">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f5a623] to-transparent" />
        <div className="flex items-center justify-center px-1">
          <img src="/logo.png" alt="Cajado Soluções" className="h-8 w-auto object-contain drop-shadow-sm" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2" style={{ scrollbarWidth: 'thin' }}>

        {/* Dashboard Inicial — só admin */}
        {isAdmin && (
          <Link
            href="/inicio"
            className={cn(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all mb-3',
              pathname === '/inicio' ? 'text-fg' : 'text-fg-secondary hover:text-fg hover:bg-surface'
            )}
            style={pathname === '/inicio' ? {
              backgroundColor: 'var(--bg-surface)',
              borderLeft: '2px solid var(--brand-gold)',
              paddingLeft: '10px'
            } : {}}
          >
            <span style={{ color: 'var(--brand-gold)', fontSize: 14 }}>◈</span>
            Dashboard Inicial
          </Link>
        )}

        {/* ── 🏢 EMPRESA ─────────────────────────────────── */}
        <div className="mb-1 px-3 pb-1">
          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-fg-disabled">
            🏢 Empresa
          </p>
        </div>
        <div className="space-y-0.5 mb-3">
          {filteredEmpresa.map(group => <NavGroup key={group.id} group={group} />)}
        </div>

        {/* ── 👤 PESSOAL — só para admin ─────────────────── */}
        {filteredPessoal.length > 0 && (
          <>
            {/* Separador */}
            <div className="mx-3 mb-3">
              <div className="border-t border-white/8" />
            </div>

            <div className="mb-1 px-3 pb-1">
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-fg-disabled">
                👤 Pessoal
              </p>
            </div>
            <div className="space-y-0.5">
              {filteredPessoal.map(group => <NavGroup key={group.id} group={group} />)}
            </div>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 space-y-2" style={{ borderTop: '0.5px solid var(--border-subtle)' }}>
        <PWAInstallButton />
        <ThemeToggle />
        <SidebarUser userData={userData} />
      </div>
    </aside>
  )
}

function SidebarUser({ userData }: { userData: {nome: string, cargo: string, email: string} | null }) {
  const router = useRouter()
  const [modalOpen, setModalOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const nome = userData?.nome || 'Carregando...'
  const cargo = userData?.cargo || ''
  const inicial = userData?.nome ? userData.nome.charAt(0).toUpperCase() : '?'

  return (
    <div className="relative">
      <button 
        onClick={() => setModalOpen(true)}
        className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface transition-colors border border-transparent hover:border-border-subtle group text-left"
      >
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#f5a623] to-[#c07000] flex items-center justify-center shadow-lg shrink-0">
          <span className="font-['Syne'] text-black text-sm font-bold">{inicial}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-fg truncate">{nome}</p>
          <p className="text-[10px] text-fg-tertiary truncate uppercase tracking-wider">{cargo}</p>
        </div>
        <div className="text-fg-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
          ⚙️
        </div>
      </button>

      {/* Modal de Perfil */}
      {modalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-sm shadow-2xl relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#f5a623] to-transparent" />
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-fg-tertiary hover:text-fg text-xl z-10">×</button>
            
            <div className="p-6 pb-2">
              <div className="flex flex-col items-center mt-2 mb-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#f5a623] to-[#c07000] flex items-center justify-center shadow-xl mb-4 border-4 border-page">
                  <span className="font-['Syne'] text-black text-3xl font-bold">{inicial}</span>
                </div>
                <h2 className="text-xl font-bold text-fg text-center">{nome}</h2>
                <p className="text-xs text-amber-400 uppercase tracking-widest font-bold mt-1.5">{cargo}</p>
              </div>

              <div className="space-y-4">
                <div className="p-3 bg-surface border border-border-subtle rounded-xl">
                  <span className="text-[10px] text-fg-tertiary uppercase tracking-wider font-bold block mb-1">Email de Acesso</span>
                  <span className="text-sm text-fg-secondary truncate block">{userData?.email || 'Nenhum e-mail encontrado'}</span>
                </div>
                <div className="p-3 bg-surface border border-border-subtle rounded-xl">
                  <span className="text-[10px] text-fg-tertiary uppercase tracking-wider font-bold block mb-1">Nível de Permissão</span>
                  <span className="text-sm text-fg-secondary truncate block">{cargo === 'Administrador' ? 'Acesso Total (Admin)' : 'Acesso Restrito'}</span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-surface/30 border-t border-border-subtle mt-4 flex gap-3">
              <button onClick={() => setModalOpen(false)} className="btn-secondary flex-1 py-2">Voltar</button>
              <button onClick={handleLogout} className="btn-primary bg-red-600/90 hover:bg-red-500 border-red-600/50 flex-1 py-2 shadow-lg shadow-red-500/20 text-white">Sair do Sistema</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 📱 Bottom Navigation Bar — só aparece no mobile ────────────
export function MobileBottomNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 safe-area-bottom"
      style={{
        background: 'rgba(5, 7, 15, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderTop: '0.5px solid rgba(255,255,255,0.08)',
      }}
    >
      <div className="flex items-center justify-around px-1 py-1 pb-safe">
        {BOTTOM_NAV.map(item => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 px-3 py-2 rounded-xl transition-all min-w-[56px]"
              style={isActive ? {
                backgroundColor: 'rgba(245,166,35,0.12)',
              } : {}}
            >
              <span className="text-[20px] leading-none">{item.icon}</span>
              <span className={cn(
                'text-[9px] font-bold uppercase tracking-wider transition-colors',
                isActive ? 'text-[#f5a623]' : 'text-fg-disabled'
              )}>
                {item.label}
              </span>
              {isActive && (
                <span className="w-1 h-1 rounded-full bg-[#f5a623] absolute bottom-1.5" />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
