'use client'

import { useState } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, EmptyState } from '@/components/shared/ui'
import { AppPatraoTabs } from '@/components/shared/AppPatraoTabs'
import { SecretariaFlutuante } from '@/components/shared/SecretariaFlutuante'

type Ativo = {
  id: string
  ticker: string | null
  nome: string
  tipo: 'acao' | 'fii' | 'fundo' | 'cdb' | 'lci' | 'lca' | 'tesouro' | 'cripto' | 'outro'
  quantidade: number
  preco_medio: number
  preco_atual: number | null
  valor_investido: number
  valor_atual: number | null
  liquidez: 'diaria' | 'semanal' | 'mensal' | 'no_vencimento'
  data_vencimento: string | null
  risco_nivel: number
  corretora: string | null
}

const TIPO_COLORS: Record<string, string> = {
  acao:    '#3B82F6', fii: '#10B981', fundo: '#8B5CF6',
  cdb:     '#F59E0B', lci: '#06B6D4', lca: '#6EE7B7',
  tesouro: '#F97316', cripto: '#EC4899', outro: '#6B7280',
}

const RISCO_LABELS = ['', 'Muito Baixo', 'Baixo', 'Médio', 'Alto', 'Muito Alto']
const RISCO_COLORS = ['', 'text-emerald-400', 'text-green-400', 'text-amber-400', 'text-orange-400', 'text-red-400']

// ── Mock Data Fallbacks ─────────────────────────────────────
const MOCK_ATIVOS: Ativo[] = [
  { id: '1', ticker: 'PETR4', nome: 'Petrobras PN', tipo: 'acao', quantidade: 500, preco_medio: 32.50, preco_atual: 38.40, valor_investido: 16250, valor_atual: 19200, liquidez: 'diaria', data_vencimento: null, risco_nivel: 4, corretora: 'XP Investimentos' },
  { id: '2', ticker: 'KNRI11', nome: 'Kinea Renda', tipo: 'fii', quantidade: 100, preco_medio: 155.00, preco_atual: 162.20, valor_investido: 15500, valor_atual: 16220, liquidez: 'diaria', data_vencimento: null, risco_nivel: 3, corretora: 'XP Investimentos' },
  { id: '3', ticker: null, nome: 'CDB Banco Master 120% CDI', tipo: 'cdb', quantidade: 1, preco_medio: 10000, preco_atual: 10850, valor_investido: 10000, valor_atual: 10850, liquidez: 'no_vencimento', data_vencimento: '2027-05-10', risco_nivel: 2, corretora: 'BTG Pactual' },
  { id: '4', ticker: 'BTC', nome: 'Bitcoin', tipo: 'cripto', quantidade: 0.05, preco_medio: 250000, preco_atual: 340000, valor_investido: 12500, valor_atual: 17000, liquidez: 'diaria', data_vencimento: null, risco_nivel: 5, corretora: 'Binance' },
  { id: '5', ticker: 'BTLG11', nome: 'VBI Logístico', tipo: 'fii', quantidade: 50, preco_medio: 102.00, preco_atual: 98.50, valor_investido: 5100, valor_atual: 4925, liquidez: 'diaria', data_vencimento: null, risco_nivel: 3, corretora: 'XP Investimentos' },
]

function ModalAtivo({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('ativos')
  const [form, setForm] = useState({
    ticker: '', nome: '', tipo: 'acao' as Ativo['tipo'],
    quantidade: '', preco_medio: '', preco_atual: '',
    liquidez: 'diaria' as Ativo['liquidez'],
    data_vencimento: '', risco_nivel: '3', corretora: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qtd = parseFloat(form.quantidade)
    const pm  = parseFloat(form.preco_medio)
    const pa  = form.preco_atual ? parseFloat(form.preco_atual) : null
    await insert({
      ticker: form.ticker || null, nome: form.nome, tipo: form.tipo,
      quantidade: qtd, preco_medio: pm,
      preco_atual: pa,
      valor_investido: qtd * pm,
      valor_atual: pa ? qtd * pa : null,
      liquidez: form.liquidez,
      data_vencimento: form.data_vencimento || null,
      risco_nivel: parseInt(form.risco_nivel),
      corretora: form.corretora || null,
    })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Adicionar Ativo</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ticker</label>
              <input className="input mt-1 uppercase" value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                placeholder="PETR4, BTC, KNRI11..." />
            </div>
            <div>
              <label className="label">Nome *</label>
              <input className="input mt-1" required value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo do ativo" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Ativo['tipo'] }))}>
                {['acao','fii','fundo','cdb','lci','lca','tesouro','cripto','outro'].map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Liquidez</label>
              <select className="input mt-1" value={form.liquidez}
                onChange={e => setForm(f => ({ ...f, liquidez: e.target.value as Ativo['liquidez'] }))}>
                <option value="diaria">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="no_vencimento">No vencimento</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Quantidade *</label>
              <input className="input mt-1" type="number" step="0.000001" required value={form.quantidade}
                onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
            </div>
            <div>
              <label className="label">Preço médio *</label>
              <input className="input mt-1" type="number" step="0.01" required value={form.preco_medio}
                onChange={e => setForm(f => ({ ...f, preco_medio: e.target.value }))} />
            </div>
            <div>
              <label className="label">Preço atual</label>
              <input className="input mt-1" type="number" step="0.01" value={form.preco_atual}
                onChange={e => setForm(f => ({ ...f, preco_atual: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Corretora</label>
              <input className="input mt-1" value={form.corretora}
                onChange={e => setForm(f => ({ ...f, corretora: e.target.value }))}
                placeholder="XP, Clear, Binance..." />
            </div>
            <div>
              <label className="label">Vencimento</label>
              <input className="input mt-1" type="date" value={form.data_vencimento}
                onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Nível de risco: {RISCO_LABELS[parseInt(form.risco_nivel)]}</label>
            <input type="range" min="1" max="5" value={form.risco_nivel}
              onChange={e => setForm(f => ({ ...f, risco_nivel: e.target.value }))}
              className="w-full mt-1 accent-amber-500 cursor-pointer" />
            <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
              <span>Muito Baixo</span><span>Médio</span><span>Muito Alto</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function InvestimentosClient() {
  const [modal, setModal] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('todos')

  const { data: ativosDB, refetch } = useSupabaseQuery<Ativo>('ativos', {
    orderBy: { column: 'valor_investido', ascending: false },
  })

  const ativos = ativosDB.length > 0 ? ativosDB : MOCK_ATIVOS

  // Métricas
  const totalInvestido = ativos.reduce((a, v) => a + v.valor_investido, 0)
  const totalAtual = ativos.reduce((a, v) => a + (v.valor_atual ?? v.valor_investido), 0)
  const resultado = totalAtual - totalInvestido
  const rentabilidade = totalInvestido > 0 ? ((totalAtual / totalInvestido) - 1) * 100 : 0

  // Por tipo
  const porTipo = ativos.reduce((acc, a) => {
    if (!acc[a.tipo]) acc[a.tipo] = { investido: 0, atual: 0, count: 0 }
    acc[a.tipo].investido += a.valor_investido
    acc[a.tipo].atual += a.valor_atual ?? a.valor_investido
    acc[a.tipo].count++
    return acc
  }, {} as Record<string, { investido: number; atual: number; count: number }>)

  const ativosFiltrados = ativos.filter(a => filtroTipo === 'todos' || a.tipo === filtroTipo)

  return (
    <>
      <PageHeader title="Investimentos" subtitle="Carteira · Ativos · Liquidez · Rentabilidade">
        <button onClick={() => setModal(true)} className="btn-primary text-xs h-8 px-3 whitespace-nowrap shrink-0">+ Ativo</button>
      </PageHeader>

      <AppPatraoTabs />

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Total investido</p>
          <p className="metric-value">{formatCurrency(totalInvestido)}</p>
          <p className="text-[11px] text-zinc-600 mt-1">{ativos.length} ativo(s)</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valor atual</p>
          <p className="metric-value text-blue-400">{formatCurrency(totalAtual)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Resultado</p>
          <p className={cn('metric-value', resultado >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {resultado >= 0 ? '+' : ''}{formatCurrency(resultado)}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Rentabilidade</p>
          <p className={cn('metric-value', rentabilidade >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {rentabilidade >= 0 ? '+' : ''}{rentabilidade.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Distribuição por tipo */}
      {Object.keys(porTipo).length > 0 && (
        <div className="card mb-4">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-3">Distribuição da carteira</p>
          <div className="space-y-2">
            {Object.entries(porTipo)
              .sort((a, b) => b[1].investido - a[1].investido)
              .map(([tipo, val]) => {
                const pct = totalInvestido > 0 ? (val.investido / totalInvestido) * 100 : 0
                const rent = val.investido > 0 ? ((val.atual / val.investido) - 1) * 100 : 0
                return (
                  <div key={tipo}>
                    <div className="flex justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: TIPO_COLORS[tipo] }} />
                        <span className="text-zinc-400 uppercase font-medium">{tipo}</span>
                        <span className="text-zinc-600">({val.count})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn('font-medium text-xs', rent >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {rent >= 0 ? '+' : ''}{rent.toFixed(1)}%
                        </span>
                        <span className="text-zinc-500">{pct.toFixed(1)}%</span>
                        <span className="text-zinc-300 font-medium w-28 text-right">{formatCurrency(val.investido)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: TIPO_COLORS[tipo] }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap mb-4">
        {['todos', ...Object.keys(porTipo)].map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-all uppercase',
              filtroTipo === t ? 'bg-zinc-800 text-zinc-100 border-zinc-700' : 'text-zinc-500 border-zinc-800 hover:text-zinc-300'
            )}>
            {t}
          </button>
        ))}
      </div>

      {/* Tabela de ativos */}
      {ativosFiltrados.length === 0 ? (
        <div className="card"><EmptyState message="Nenhum ativo cadastrado. Clique em '+ Ativo' para começar." /></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">Ativo</th>
                <th className="table-header hidden md:table-cell">Tipo</th>
                <th className="table-header hidden lg:table-cell">Quantidade</th>
                <th className="table-header text-right">Investido</th>
                <th className="table-header text-right hidden md:table-cell">Atual</th>
                <th className="table-header text-right">Result.</th>
                <th className="table-header hidden lg:table-cell">Risco</th>
                <th className="table-header hidden lg:table-cell">Liquidez</th>
              </tr>
            </thead>
            <tbody>
              {ativosFiltrados.map(a => {
                const atual = a.valor_atual ?? a.valor_investido
                const res = atual - a.valor_investido
                const rentPct = a.valor_investido > 0 ? ((atual / a.valor_investido) - 1) * 100 : 0
                const vencendo = a.data_vencimento && new Date(a.data_vencimento) < new Date(Date.now() + 30 * 86400000)
                return (
                  <tr key={a.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPO_COLORS[a.tipo] }} />
                        <div>
                          <p className="text-zinc-200 font-semibold text-sm">{a.ticker ?? a.nome}</p>
                          <p className="text-[10px] text-zinc-600">{a.corretora ?? a.nome}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      <span className="text-[10px] text-zinc-500 uppercase">{a.tipo}</span>
                    </td>
                    <td className="table-cell hidden lg:table-cell text-zinc-400 text-xs">
                      {a.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="table-cell text-right text-zinc-300 text-sm">{formatCurrency(a.valor_investido)}</td>
                    <td className="table-cell text-right hidden md:table-cell text-zinc-300 text-sm">
                      {formatCurrency(atual)}
                    </td>
                    <td className="table-cell text-right">
                      <div>
                        <p className={cn('text-sm font-semibold', res >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {res >= 0 ? '+' : ''}{formatCurrency(res)}
                        </p>
                        <p className={cn('text-[10px]', rentPct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {rentPct >= 0 ? '+' : ''}{rentPct.toFixed(2)}%
                        </p>
                      </div>
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      <span className={cn('text-xs font-medium', RISCO_COLORS[a.risco_nivel])}>
                        {'▮'.repeat(a.risco_nivel)}{'▯'.repeat(5 - a.risco_nivel)}
                      </span>
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      <div>
                        <span className="text-xs text-zinc-500 capitalize">{a.liquidez.replace('_', ' ')}</span>
                        {vencendo && a.data_vencimento && (
                          <p className="text-[10px] text-amber-400">⚠ {formatDate(a.data_vencimento)}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && <ModalAtivo onClose={() => setModal(false)} onSave={refetch} />}

      {/* Secretária Flutuante do Patrão */}
      <SecretariaFlutuante />
    </>
  )
}
