'use client'

import { useState } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/ui'
import { AppPatraoTabs } from '@/components/shared/AppPatraoTabs'
import { TabImoveis } from './_components/TabImoveis'
import { TabFinanciamentos } from './_components/TabFinanciamentos'
import { SecretariaFlutuante } from '@/components/shared/SecretariaFlutuante'

type ProjetoPatrimonio = {
  id: string
  titulo: string
  tipo: 'imovel' | 'veiculo' | 'equipamento' | 'reforma' | 'outro'
  descricao: string | null
  valor_investido_total: number
  valor_mercado_atual: number | null
  roi_percentual: number | null
  data_aquisicao: string | null
  status: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
}

type CustoPatrimonio = {
  id: string
  projeto_id: string
  descricao: string
  valor: number
  data: string
  categoria: string
}

const TIPO_ICONS: Record<string, string> = {
  imovel: '🏠', veiculo: '🚗', equipamento: '⚙️', reforma: '🔨', outro: '📦',
}

const TIPO_COLORS: Record<string, string> = {
  imovel: 'text-blue-400', veiculo: 'text-emerald-400',
  equipamento: 'text-amber-400', reforma: 'text-orange-400', outro: 'text-zinc-400',
}

// ── Mock Data Fallbacks ─────────────────────────────────────
const MOCK_PROJETOS: ProjetoPatrimonio[] = [
  { id: '1', titulo: 'Apartamento Centro', tipo: 'imovel', descricao: 'Imóvel para locação', valor_investido_total: 350000, valor_mercado_atual: 420000, roi_percentual: 20, data_aquisicao: '2023-01-15', status: 'ativo' },
  { id: '2', titulo: 'Gol 2022', tipo: 'veiculo', descricao: 'Carro para uso do escritório', valor_investido_total: 65000, valor_mercado_atual: 58000, roi_percentual: -10.7, data_aquisicao: '2024-05-20', status: 'ativo' },
  { id: '3', titulo: 'Reforma Fachada', tipo: 'reforma', descricao: 'Reforma do prédio da empresa', valor_investido_total: 45000, valor_mercado_atual: 45000, roi_percentual: 0, data_aquisicao: '2025-10-10', status: 'concluido' },
]

const MOCK_CUSTOS: CustoPatrimonio[] = [
  { id: '1', projeto_id: '1', descricao: 'IPTU', valor: 1200, data: '2026-02-10', categoria: 'imposto' },
  { id: '2', projeto_id: '1', descricao: 'Pintura', valor: 4500, data: '2026-01-15', categoria: 'manutencao' },
  { id: '3', projeto_id: '2', descricao: 'IPVA', valor: 2500, data: '2026-01-05', categoria: 'imposto' },
  { id: '4', projeto_id: '2', descricao: 'Pneus Novos', valor: 2000, data: '2025-12-10', categoria: 'manutencao' },
]

function ModalProjeto({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('projetos_patrimonio')
  const [form, setForm] = useState({
    titulo: '', tipo: 'imovel' as ProjetoPatrimonio['tipo'],
    descricao: '', valor_investido_total: '',
    valor_mercado_atual: '', data_aquisicao: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const vi = parseFloat(form.valor_investido_total)
    const vm = form.valor_mercado_atual ? parseFloat(form.valor_mercado_atual) : null
    await insert({
      titulo: form.titulo, tipo: form.tipo,
      descricao: form.descricao || null,
      valor_investido_total: vi,
      valor_mercado_atual: vm,
      roi_percentual: vm && vi > 0 ? ((vm - vi) / vi) * 100 : null,
      data_aquisicao: form.data_aquisicao || null,
      status: 'ativo',
    })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Novo Patrimônio</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Título *</label>
              <input className="input mt-1" required value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Apartamento centro, Gol 2022..." />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as ProjetoPatrimonio['tipo'] }))}>
                <option value="imovel">🏠 Imóvel</option>
                <option value="veiculo">🚗 Veículo</option>
                <option value="equipamento">⚙️ Equipamento</option>
                <option value="reforma">🔨 Reforma</option>
                <option value="outro">📦 Outro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input mt-1 resize-none" rows={2} value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Valor investido (R$) *</label>
              <input className="input mt-1" type="number" step="0.01" required value={form.valor_investido_total}
                onChange={e => setForm(f => ({ ...f, valor_investido_total: e.target.value }))} />
            </div>
            <div>
              <label className="label">Valor de mercado (R$)</label>
              <input className="input mt-1" type="number" step="0.01" value={form.valor_mercado_atual}
                onChange={e => setForm(f => ({ ...f, valor_mercado_atual: e.target.value }))} />
            </div>
            <div>
              <label className="label">Data aquisição</label>
              <input className="input mt-1" type="date" value={form.data_aquisicao}
                onChange={e => setForm(f => ({ ...f, data_aquisicao: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Adicionar patrimônio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalCusto({ projetoId, onClose, onSave }: { projetoId: string; onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('custos_patrimonio')
  const [form, setForm] = useState({
    descricao: '', valor: '', data: new Date().toISOString().split('T')[0], categoria: 'manutencao',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await insert({ projeto_id: projetoId, descricao: form.descricao, valor: parseFloat(form.valor), data: form.data, categoria: form.categoria })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Registrar Custo</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Pintura, IPTU, Seguro..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input mt-1" type="number" step="0.01" required value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label className="label">Data</label>
              <input className="input mt-1" type="date" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input mt-1" value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              <option value="manutencao">Manutenção</option>
              <option value="imposto">Imposto/Taxa</option>
              <option value="seguro">Seguro</option>
              <option value="reforma">Reforma</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function PatrimonioClient() {
  const [tab, setTab] = useState<'geral' | 'imoveis' | 'financiamentos'>('geral')
  const [modal, setModal] = useState(false)
  const [modalCusto, setModalCusto] = useState<string | null>(null)
  const [projetoAberto, setProjetoAberto] = useState<string | null>(null)

  const { data: projetosDB, refetch } = useSupabaseQuery<ProjetoPatrimonio>('projetos_patrimonio', {
    orderBy: { column: 'valor_investido_total', ascending: false },
  })
  const { data: custosDB, refetch: refetchCustos } = useSupabaseQuery<CustoPatrimonio>('custos_patrimonio', {
    orderBy: { column: 'data', ascending: false },
  })

  // Fallback para exibir na tela caso banco esteja vazio
  const projetos = projetosDB.length > 0 ? projetosDB : MOCK_PROJETOS
  const custos = custosDB.length > 0 ? custosDB : MOCK_CUSTOS

  const totalInvestido = projetos.reduce((a, p) => a + p.valor_investido_total, 0)
  const totalMercado = projetos.reduce((a, p) => a + (p.valor_mercado_atual ?? p.valor_investido_total), 0)
  const valorização = totalMercado - totalInvestido
  const totalCustos = custos.reduce((a, c) => a + c.valor, 0)

  return (
    <>
      <PageHeader title="Patrimônio" subtitle="Imóveis · Veículos · Financiamentos · ROI">
        {tab === 'geral' && <button onClick={() => setModal(true)} className="btn-primary text-xs h-8 px-3 whitespace-nowrap shrink-0">+ Patrimônio Genérico</button>}
      </PageHeader>

      <AppPatraoTabs />

      <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 mb-4 w-fit">
        {[
          { key: 'geral', label: '📊 Visão Geral & Projetos' },
          { key: 'imoveis', label: '🏠 Imóveis Detalhado' },
          { key: 'financiamentos', label: '🏦 Financiamentos' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t.key ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
            )}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'geral' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Total investido</p>
          <p className="metric-value">{formatCurrency(totalInvestido)}</p>
          <p className="text-[11px] text-zinc-600 mt-1">{projetos.length} bem(ns)</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valor de mercado</p>
          <p className="metric-value text-blue-400">{formatCurrency(totalMercado)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valorização</p>
          <p className={cn('metric-value', valorização >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {valorização >= 0 ? '+' : ''}{formatCurrency(valorização)}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Custos totais</p>
          <p className="metric-value text-red-400">{formatCurrency(totalCustos)}</p>
        </div>
      </div>

      {projetos.length === 0 ? (
        <div className="card"><EmptyState message="Nenhum patrimônio cadastrado ainda" /></div>
      ) : (
        <div className="space-y-3">
          {projetos.map(p => {
            const vm = p.valor_mercado_atual ?? p.valor_investido_total
            const roi = p.valor_investido_total > 0 ? ((vm - p.valor_investido_total) / p.valor_investido_total) * 100 : 0
            const custosProjeto = custos.filter(c => c.projeto_id === p.id)
            const totalCustosProjeto = custosProjeto.reduce((a, c) => a + c.valor, 0)
            const isOpen = projetoAberto === p.id

            return (
              <div key={p.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{TIPO_ICONS[p.tipo]}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-100">{p.titulo}</h3>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className={cn('text-[10px] font-medium uppercase', TIPO_COLORS[p.tipo])}>{p.tipo}</p>
                      {p.data_aquisicao && (
                        <p className="text-[10px] text-zinc-600">Adquirido em {formatDate(p.data_aquisicao)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs text-zinc-600">ROI</p>
                      <p className={cn('text-lg font-bold', roi >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                      </p>
                    </div>
                    <button
                      onClick={() => setProjetoAberto(isOpen ? null : p.id)}
                      className="text-zinc-600 hover:text-zinc-300 transition-colors px-2 py-1"
                    >
                      {isOpen ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-zinc-800">
                  <div>
                    <p className="text-[10px] text-zinc-600">Investido</p>
                    <p className="text-sm font-semibold text-zinc-300">{formatCurrency(p.valor_investido_total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600">Mercado</p>
                    <p className="text-sm font-semibold text-blue-400">{formatCurrency(vm)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600">Custos acum.</p>
                    <p className="text-sm font-semibold text-red-400">{formatCurrency(totalCustosProjeto)}</p>
                  </div>
                </div>

                {/* Custos expandidos */}
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-zinc-500 uppercase tracking-wide">Custos</p>
                      <button onClick={() => setModalCusto(p.id)} className="btn-ghost text-xs">+ Custo</button>
                    </div>
                    {custosProjeto.length === 0 ? (
                      <p className="text-xs text-zinc-600 text-center py-4">Nenhum custo registrado</p>
                    ) : (
                      custosProjeto.slice(0, 5).map(c => (
                        <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-zinc-800 last:border-0">
                          <div>
                            <p className="text-xs text-zinc-300">{c.descricao}</p>
                            <p className="text-[10px] text-zinc-600">{c.categoria} · {formatDate(c.data)}</p>
                          </div>
                          <p className="text-xs text-red-400 font-semibold">{formatCurrency(c.valor)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
        </>
      )}

      {tab === 'imoveis' && <TabImoveis />}
      {tab === 'financiamentos' && <TabFinanciamentos />}

      {modal && <ModalProjeto onClose={() => setModal(false)} onSave={refetch} />}
      {modalCusto && (
        <ModalCusto
          projetoId={modalCusto}
          onClose={() => setModalCusto(null)}
          onSave={() => { refetch(); refetchCustos() }}
        />
      )}

      {/* Secretária Flutuante do Patrão */}
      <SecretariaFlutuante />
    </>
  )
}
