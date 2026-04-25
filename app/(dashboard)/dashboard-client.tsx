'use client'

import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { formatCurrency, formatRelative } from '@/lib/utils'
import { StatusBadge } from '@/components/shared/ui'
import Link from 'next/link'

type Conta = { id: string; saldo_atual: number; ativo: boolean }
type Lancamento = { id: string; descricao: string; valor: number; tipo: string; data_competencia: string; status: string }
type Lead = { id: string; nome: string; status: string; valor_estimado: number | null; created_at: string }
type Operacao = { id: string; ativo: string; resultado: string; lucro_prejuizo: number | null }
type Ativo = { id: string; valor_investido: number; valor_atual: number | null }
type Projeto = { id: string; titulo: string; status: string; progresso_percentual: number }
type ProjetoPatrimonio = { id: string; valor_investido_total: number; valor_mercado_atual: number | null }
type NumeroWA = { id: string; status: string; enviados_hoje: number; limite_diario: number }
type Tendencia = { id: string; titulo: string; impacto_estimado: string | null; status: string }

function StatCard({ label, value, sub, href, color = 'text-fg' }: {
  label: string; value: string | number; sub?: string; href: string; color?: string
}) {
  return (
    <Link href={href} className="card-sm hover:bg-muted/80 transition-colors cursor-pointer group block">
      <p className="text-xs text-fg-tertiary mb-1">{label}</p>
      <p className={`text-2xl font-bold tracking-tight group-hover:text-amber-400 transition-colors ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-fg-disabled mt-1">{sub}</p>}
    </Link>
  )
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-semibold text-fg-secondary">{title}</h2>
      <Link href={href} className="text-xs text-fg-tertiary hover:text-amber-400 transition-colors">Ver tudo →</Link>
    </div>
  )
}

export default function DashboardHome() {
  const { data: contas } = useSupabaseQuery<Conta>('contas', { filters: { ativo: true } })
  const { data: lancamentos } = useSupabaseQuery<Lancamento>('lancamentos', { orderBy: { column: 'created_at', ascending: false }, limit: 5 })
  const { data: leads } = useSupabaseQuery<Lead>('leads', { orderBy: { column: 'created_at', ascending: false } })
  const { data: operacoes } = useSupabaseQuery<Operacao>('operacoes')
  const { data: ativos } = useSupabaseQuery<Ativo>('ativos')
  const { data: projetos } = useSupabaseQuery<Projeto>('projetos', { filters: { status: 'ativo' } })
  const { data: patrimonio } = useSupabaseQuery<ProjetoPatrimonio>('projetos_patrimonio')
  const { data: numerosWA } = useSupabaseQuery<NumeroWA>('numeros_whatsapp')
  const { data: tendencias } = useSupabaseQuery<Tendencia>('tendencias', { filters: { status: 'monitorando' }, limit: 3 })

  // Financeiro
  const saldoTotal = contas.reduce((a, c) => a + (c.saldo_atual ?? 0), 0)
  const mesAtual = new Date().toISOString().slice(0, 7)
  const receitas = lancamentos.filter(l => l.tipo === 'receita' && l.data_competencia?.startsWith(mesAtual)).reduce((a, l) => a + l.valor, 0)
  const despesas = lancamentos.filter(l => l.tipo === 'despesa' && l.data_competencia?.startsWith(mesAtual)).reduce((a, l) => a + l.valor, 0)

  // CRM
  const leadsAtivos = leads.filter(l => l.status !== 'perdido').length
  const clientesAtivos = leads.filter(l => l.status === 'cliente_ativo').length
  const pipelineValor = leads.filter(l => l.valor_estimado).reduce((a, l) => a + (l.valor_estimado ?? 0), 0)

  // Trader
  const operacoesFechadas = operacoes.filter(o => o.resultado !== 'aberta')
  const gains = operacoesFechadas.filter(o => o.resultado === 'gain').length
  const winRate = operacoesFechadas.length > 0 ? Math.round((gains / operacoesFechadas.length) * 100) : 0
  const plTotal = operacoes.reduce((a, o) => a + (o.lucro_prejuizo ?? 0), 0)

  // Investimentos
  const totalInvestido = ativos.reduce((a, v) => a + v.valor_investido, 0)
  const totalAtual = ativos.reduce((a, v) => a + (v.valor_atual ?? v.valor_investido), 0)
  const rentInv = totalInvestido > 0 ? ((totalAtual - totalInvestido) / totalInvestido) * 100 : 0

  // Patrimônio
  const patriInvestido = patrimonio.reduce((a, p) => a + p.valor_investido_total, 0)
  const patriMercado = patrimonio.reduce((a, p) => a + (p.valor_mercado_atual ?? p.valor_investido_total), 0)

  // WhatsApp
  const waAtivos = numerosWA.filter(n => n.status === 'ativo').length
  const waTotalEnv = numerosWA.reduce((a, n) => a + (n.enviados_hoje ?? 0), 0)

  // Saudação por horário
  const hora = new Date().getHours()
  const saudacao = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite'

  const tipoColor: Record<string, string> = {
    receita: 'text-emerald-400',
    despesa: 'text-red-400',
    investimento: 'text-blue-400',
    transferencia: 'text-fg-secondary',
  }

  return (
    <div className="space-y-8">

      {/* Header de boas-vindas */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">{saudacao} 👋</h1>
          <p className="text-sm text-fg-tertiary mt-1">Aqui está o resumo geral do Sistema Cajado</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="text-xs text-fg-disabled hidden md:block">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
          </p>
          <Link
            href="/dashboard-pessoal"
            className="flex items-center gap-2 bg-gradient-to-r from-amber-500/15 to-emerald-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold px-3 py-2 rounded-xl hover:from-amber-500/25 hover:to-emerald-500/20 transition-all whitespace-nowrap"
          >
            👤 Dashboard Pessoal →
          </Link>
        </div>
      </div>

      {/* ── FINANCEIRO ─────────────────────────────── */}
      <section>
        <SectionHeader title="💰 Financeiro" href="/financeiro" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Saldo total"
            value={formatCurrency(saldoTotal)}
            sub={`${contas.length} conta(s)`}
            href="/financeiro"
            color={saldoTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
          <StatCard label="Receitas do mês" value={formatCurrency(receitas)} href="/financeiro" color="text-emerald-400" />
          <StatCard label="Despesas do mês" value={formatCurrency(despesas)} href="/financeiro" color="text-red-400" />
          <StatCard
            label="Resultado mês"
            value={formatCurrency(receitas - despesas)}
            href="/financeiro"
            color={receitas - despesas >= 0 ? 'text-emerald-400' : 'text-red-400'}
          />
        </div>

        {lancamentos.length > 0 && (
          <div className="card mt-3">
            <p className="text-xs text-fg-tertiary mb-3">Últimos lançamentos</p>
            <div className="space-y-2">
              {lancamentos.slice(0, 5).map(l => (
                <div key={l.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                      l.tipo === 'receita' ? 'bg-emerald-400' :
                      l.tipo === 'despesa' ? 'bg-red-400' : 'bg-blue-400'
                    }`} />
                    <p className="text-sm text-fg-secondary">{l.descricao}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={l.status} />
                    <p className={`text-sm font-semibold truncate max-w-[80px] md:max-w-none text-right ${tipoColor[l.tipo] ?? 'text-fg-secondary'}`}>
                      {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── CRM + TRADER ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <section>
          <SectionHeader title="🏢 Cajado Empresa" href="/cajado" />
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mb-3">
            <StatCard label="Leads ativos" value={leadsAtivos} href="/cajado" />
            <StatCard label="Clientes" value={clientesAtivos} href="/cajado" color="text-emerald-400" />
            <div className="col-span-2 xl:col-span-1">
              <StatCard label="Pipeline" value={formatCurrency(pipelineValor)} href="/cajado" color="text-amber-400" />
            </div>
          </div>
          {leads.length > 0 && (
            <div className="card">
              <p className="text-xs text-fg-tertiary mb-3">Últimos leads</p>
              <div className="space-y-2">
                {leads.slice(0, 4).map(l => (
                  <div key={l.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-fg-secondary">{l.nome}</p>
                      <p className="text-xs text-fg-disabled">{formatRelative(l.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {l.valor_estimado && (
                        <p className="text-xs text-emerald-400">{formatCurrency(l.valor_estimado)}</p>
                      )}
                      <StatusBadge status={l.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="📈 Trader" href="/trader" />
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mb-3">
            <StatCard
              label="P&L Total"
              value={formatCurrency(plTotal)}
              href="/trader"
              color={plTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            <StatCard
              label="Win Rate"
              value={`${winRate}%`}
              href="/trader"
              color={winRate >= 50 ? 'text-emerald-400' : 'text-red-400'}
            />
            <div className="col-span-2 xl:col-span-1">
              <StatCard
                label="Operações"
                value={operacoes.length}
                sub={`${operacoesFechadas.length} fechadas`}
                href="/trader"
              />
            </div>
          </div>
          <div className="card">
            {operacoes.length > 0 ? (
              operacoes.slice(0, 4).map(o => (
                <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                  <p className="text-sm font-mono font-semibold text-fg">{o.ativo}</p>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={o.resultado} />
                    {o.lucro_prejuizo !== null && (
                      <p className={`text-sm font-semibold ${o.lucro_prejuizo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(o.lucro_prejuizo)}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-fg-disabled py-2">Nenhuma operação registrada</p>
            )}
          </div>
        </section>
      </div>

      {/* ── INVESTIMENTOS + PATRIMÔNIO ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <section>
          <SectionHeader title="📊 Investimentos" href="/investimentos" />
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            <StatCard label="Investido" value={formatCurrency(totalInvestido)} href="/investimentos" />
            <StatCard label="Valor atual" value={formatCurrency(totalAtual)} href="/investimentos" />
            <div className="col-span-2 xl:col-span-1">
              <StatCard
                label="Rentabilidade"
              value={`${rentInv >= 0 ? '+' : ''}${rentInv.toFixed(2)}%`}
              href="/investimentos"
              color={rentInv >= 0 ? 'text-emerald-400' : 'text-red-400'}
            />
            </div>
          </div>
          <div className="card mt-3">
            <p className="text-xs text-fg-tertiary mb-1">Resultado líquido</p>
            <p className={`text-3xl font-bold ${totalAtual - totalInvestido >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(totalAtual - totalInvestido)}
            </p>
          </div>
        </section>

        <section>
          <SectionHeader title="🏠 Patrimônio" href="/patrimonio" />
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            <StatCard label="Bens cadastrados" value={patrimonio.length} href="/patrimonio" />
            <StatCard label="Total investido" value={formatCurrency(patriInvestido)} href="/patrimonio" />
            <div className="col-span-2 xl:col-span-1">
              <StatCard
                label="Valor de mercado"
              value={formatCurrency(patriMercado)}
              href="/patrimonio"
              color="text-amber-400"
            />
            </div>
          </div>
          <div className="card mt-3">
            <p className="text-xs text-fg-tertiary mb-1">Valorização patrimonial</p>
            <p className={`text-3xl font-bold ${patriMercado - patriInvestido >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(patriMercado - patriInvestido)}
            </p>
          </div>
        </section>
      </div>

      {/* ── WHATSAPP + INTELIGÊNCIA ─────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <section>
          <SectionHeader title="📱 Segurança WhatsApp" href="/seguranca-wa" />
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 mb-3">
            <StatCard label="Números ativos" value={waAtivos} href="/seguranca-wa" color="text-emerald-400" />
            <StatCard label="Enviados hoje" value={waTotalEnv} href="/seguranca-wa" />
            <div className="col-span-2 xl:col-span-1">
              <StatCard label="Total números" value={numerosWA.length} href="/seguranca-wa" />
            </div>
          </div>
          {numerosWA.length > 0 && (
            <div className="card">
              {numerosWA.map(n => {
                const pct = n.limite_diario > 0 ? Math.min((n.enviados_hoje / n.limite_diario) * 100, 100) : 0
                return (
                  <div key={n.id} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-fg-secondary">
                        {n.status === 'ativo' ? '🟢' : '🔴'} {n.enviados_hoje}/{n.limite_diario}
                      </span>
                      <span className={pct > 80 ? 'text-red-400' : 'text-fg-tertiary'}>{pct.toFixed(0)}%</span>
                    </div>
                    <div className="h-1 bg-surface-hover rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section>
          <SectionHeader title="🧠 Inteligência" href="/inteligencia" />
          <div className="grid grid-cols-2 gap-3 mb-3">
            <StatCard label="Projetos ativos" value={projetos.length} href="/organizacao" />
            <StatCard label="Tendências monitor." value={tendencias.length} href="/inteligencia" color="text-purple-400" />
          </div>
          {tendencias.length > 0 && (
            <div className="card">
              <p className="text-xs text-fg-tertiary mb-3">Tendências em monitoramento</p>
              <div className="space-y-2">
                {tendencias.map(t => (
                  <div key={t.id} className="flex items-center justify-between">
                    <p className="text-sm text-fg-secondary">{t.titulo}</p>
                    <span className={`text-xs font-semibold capitalize ${
                      t.impacto_estimado === 'alto' ? 'text-red-400' :
                      t.impacto_estimado === 'medio' ? 'text-amber-400' : 'text-fg-tertiary'
                    }`}>
                      {t.impacto_estimado ?? '—'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
