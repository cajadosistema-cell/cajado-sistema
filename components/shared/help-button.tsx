'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { usePathname } from 'next/navigation'

const GUIA = [
  {
    grupo: '💰 Financeiro',
    cor: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    itens: [
      { icon: '🏦', nome: 'Contas e Caixa', desc: 'Gerencie saldos, lançamentos e extratos de cada conta bancária.' },
      { icon: '💳', nome: 'Cartões de Crédito', desc: 'Controle de faturas, parcelas futuras e limite disponível.' },
      { icon: '📅', nome: 'Parcelas', desc: 'Aba dentro de Cartões — veja todas as parcelas futuras mês a mês.' },
      { icon: '📊', nome: 'Fatura Prevista', desc: 'Defina o valor esperado da fatura e veja se está acima ou abaixo.' },
    ],
  },
  {
    grupo: '🏛️ Patrimônio',
    cor: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    itens: [
      { icon: '🏠', nome: 'Imóveis', desc: 'Cadastre imóveis, acompanhe parcelas e analise se vale quitar antecipado.' },
      { icon: '🚗', nome: 'Veículos', desc: 'Gerencie veículos, manutenções e financiamentos ativos.' },
      { icon: '🤖', nome: 'Importar Documento', desc: 'Cole texto de contrato ou planilha — a IA extrai os dados automaticamente.' },
      { icon: '📥', nome: 'Exportar CSV/PDF', desc: 'Baixe sua carteira completa em planilha (Excel) ou PDF formatado.' },
    ],
  },
  {
    grupo: '👥 Equipe',
    cor: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    itens: [
      { icon: '💬', nome: 'Mensagens (Inbox)', desc: 'Chat interno com toda a equipe em tempo real.' },
      { icon: '📋', nome: 'Fechamento', desc: 'Registre e acompanhe vendas fechadas pela equipe.' },
      { icon: '🏆', nome: 'Ranking', desc: 'Veja o desempenho de cada membro da equipe.' },
    ],
  },
  {
    grupo: '🧠 Pessoal',
    cor: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    itens: [
      { icon: '📓', nome: 'Diário Pessoal', desc: 'Registre reflexões diárias. Tipos: Diário, Decisão, Espiritual, Marco.' },
      { icon: '🤖', nome: 'Análise IA', desc: 'A Elena analisa suas entradas e identifica padrões de comportamento e humor.' },
      { icon: '🧠', nome: 'Perfis DISC', desc: 'Questionário de 12 perguntas que revela seu perfil profissional dominante.' },
      { icon: '🌡️', nome: 'Temperamentos', desc: 'Descubra seu perfil pessoal: Colérico, Melancólico, Fleumático ou Sanguíneo.' },
      { icon: '🔐', nome: 'Cofre de Senhas', desc: 'Senhas criptografadas com AES-256. Só você tem acesso com sua chave-mestra.' },
    ],
  },
  {
    grupo: '🔔 Sistema',
    cor: 'text-rose-400',
    bg: 'bg-rose-500/10 border-rose-500/20',
    itens: [
      { icon: '🔔', nome: 'Alertas Mobile', desc: 'Ative notificações push no celular. Configure no ícone do perfil (topo da sidebar).' },
      { icon: '👤', nome: 'Meu Perfil', desc: 'Clique no avatar no topo para ver dados do usuário, permissões e alertas.' },
      { icon: '🌙', nome: 'Tema', desc: 'Alterne entre modo escuro e claro pelo ícone de lua/sol.' },
    ],
  },
]

export function HelpButton() {
  const [open, setOpen] = useState(false)
  const [busca, setBusca] = useState('')
  const pathname = usePathname()

  if (pathname?.includes('/inbox')) {
    return null
  }

  const filtrado = GUIA.map(g => ({
    ...g,
    itens: g.itens.filter(i =>
      !busca || i.nome.toLowerCase().includes(busca.toLowerCase()) ||
      i.desc.toLowerCase().includes(busca.toLowerCase())
    ),
  })).filter(g => g.itens.length > 0)

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'hidden md:flex fixed bottom-6 right-6 z-50',
          'w-11 h-11 rounded-full items-center justify-center',
          'bg-gradient-to-br from-amber-500 to-amber-600',
          'shadow-lg shadow-amber-500/30 border border-amber-400/30',
          'text-black font-black text-lg',
          'hover:scale-110 active:scale-95 transition-transform',
        )}
        title="Ajuda rápida — o que cada função faz?"
      >
        ?
      </button>

      {/* Painel de ajuda */}
      {open && (
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-fg">📖 Guia Rápido do Sistema</h2>
                <p className="text-xs text-fg-tertiary mt-0.5">Passe o mouse nos botões para ver dicas. Aqui está o resumo completo.</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-fg-tertiary hover:text-fg text-xl ml-4">×</button>
            </div>

            {/* Busca */}
            <div className="px-5 py-3 border-b border-border-subtle">
              <input
                className="input w-full text-sm"
                placeholder="🔍 Buscar função..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                autoFocus
              />
            </div>

            {/* Conteúdo */}
            <div className="overflow-y-auto px-5 py-4 space-y-5 custom-scrollbar">
              {filtrado.map(grupo => (
                <div key={grupo.grupo}>
                  <p className={cn('text-xs font-bold uppercase tracking-widest mb-2', grupo.cor)}>{grupo.grupo}</p>
                  <div className={cn('rounded-xl border divide-y divide-white/5 overflow-hidden', grupo.bg)}>
                    {grupo.itens.map(item => (
                      <div key={item.nome} className="flex items-start gap-3 px-4 py-3">
                        <span className="text-xl flex-shrink-0 mt-0.5">{item.icon}</span>
                        <div>
                          <p className="text-sm font-semibold text-fg">{item.nome}</p>
                          <p className="text-xs text-fg-secondary mt-0.5 leading-relaxed">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {filtrado.length === 0 && (
                <p className="text-sm text-fg-tertiary text-center py-8">Nenhuma função encontrada para "{busca}"</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-border-subtle flex items-center justify-between">
              <p className="text-[10px] text-fg-disabled">Cajado Sistema 2.0 — Dica: passe o mouse nos botões para ver tooltips</p>
              <button onClick={() => setOpen(false)} className="btn-secondary text-xs">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
