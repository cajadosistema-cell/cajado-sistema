'use client'

import { PageHeader, MetricCard, EmptyState } from '@/components/shared/ui'
import React, { useState } from 'react'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { SecaoRanking } from './_components/SecaoRanking'

const tipoLabels: Record<string, string> = {
  venda: 'Venda',
  os: 'Ordem de Serviço',
  orcamento: 'Orçamento',
  pedido: 'Pedido',
}

const statusColor: Record<string, string> = {
  rascunho: 'badge-zinc',
  aberta: 'badge-blue',
  em_andamento: 'badge-amber',
  concluida: 'badge-green',
  cancelada: 'badge-red',
  orcamento_aprovado: 'badge-purple',
}

const pagamentoColor: Record<string, string> = {
  pendente: 'text-amber-400',
  parcial: 'text-blue-400',
  pago: 'text-emerald-400',
  cancelado: 'text-zinc-500',
}

// ── Mock Data Fallbacks ─────────────────────────────────────
const MOCK_PRODUTOS: any[] = [
  { id: 'p1', nome: 'Transferência de Propriedade', tipo: 'servico', preco_custo: 120, preco_venda: 450, unidade: 'UN', controla_estoque: false, estoque_atual: 0, estoque_minimo: 0, ativo: true, created_at: '', updated_at: '' },
  { id: 'p2', nome: 'Placa Mercosul', tipo: 'produto', preco_custo: 50, preco_venda: 150, unidade: 'PAR', controla_estoque: true, estoque_atual: 12, estoque_minimo: 5, ativo: true, created_at: '', updated_at: '' },
  { id: 'p3', nome: 'Licenciamento Anual', tipo: 'servico', preco_custo: 80, preco_venda: 250, unidade: 'UN', controla_estoque: false, estoque_atual: 0, estoque_minimo: 0, ativo: true, created_at: '', updated_at: '' },
  { id: 'p4', nome: 'Primeira Habilitação', tipo: 'servico', preco_custo: 800, preco_venda: 1800, unidade: 'UN', controla_estoque: false, estoque_atual: 0, estoque_minimo: 0, ativo: true, created_at: '', updated_at: '' },
]

const MOCK_VENDAS: any[] = [
  { id: 'v1', numero: '2026/0405', tipo: 'os', status: 'em_andamento', cliente: { nome: 'Carlos Eduardo' }, data_abertura: new Date().toISOString(), total: 450, total_a_receber: 450, status_pagamento: 'pendente', subtotal: 450, desconto_percentual: 0, desconto_valor: 0, acrescimo: 0, total_parcelas: 1, valor_entrada: 0, total_recebido: 0, created_at: '', updated_at: '' },
  { id: 'v2', numero: '2026/0404', tipo: 'venda', status: 'concluida', cliente: { nome: 'Juliana Rocha' }, data_abertura: new Date().toISOString(), total: 150, total_a_receber: 0, status_pagamento: 'pago', subtotal: 150, desconto_percentual: 0, desconto_valor: 0, acrescimo: 0, total_parcelas: 1, valor_entrada: 0, total_recebido: 150, created_at: '', updated_at: '' },
  { id: 'v3', numero: '2026/0403', tipo: 'os', status: 'aberta', cliente: { nome: 'Marcos Lima' }, data_abertura: new Date(Date.now() - 86400000).toISOString(), total: 1200, total_a_receber: 600, status_pagamento: 'parcial', subtotal: 1200, desconto_percentual: 0, desconto_valor: 0, acrescimo: 0, total_parcelas: 2, valor_entrada: 600, total_recebido: 600, created_at: '', updated_at: '' },
  { id: 'v4', numero: '2026/0402', tipo: 'orcamento', status: 'orcamento_aprovado', cliente: { nome: 'Ana Paula' }, data_abertura: new Date(Date.now() - 172800000).toISOString(), total: 850, total_a_receber: 850, status_pagamento: 'pendente', subtotal: 850, desconto_percentual: 0, desconto_valor: 0, acrescimo: 0, total_parcelas: 1, valor_entrada: 0, total_recebido: 0, created_at: '', updated_at: '' },
]

export default function VendasClient() {
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [modalOS, setModalOS] = useState(false)
  const [modalProduto, setModalProduto] = useState(false)

  const { data: vendasDB, loading: loadingVendas } = useSupabaseQuery<Venda>('vendas', {
    select: '*, cliente:cliente_id(*)' // Assumindo relação
  })
  
  const { data: produtosDB } = useSupabaseQuery<Produto>('produtos')

  const vendas = vendasDB.length > 0 ? vendasDB : MOCK_VENDAS
  const produtos = produtosDB.length > 0 ? produtosDB : MOCK_PRODUTOS

  const vendasFiltradas = vendas.filter(v => {
    if (tipoFiltro && v.tipo !== tipoFiltro) return false
    if (statusFiltro && v.status !== statusFiltro) return false
    return true
  })

  // Métricas Calc
  const faturamentoMes = vendas.filter(v => v.status === 'concluida' || v.status_pagamento === 'pago').reduce((acc, v) => acc + (v.total || 0), 0)
  const aReceber = vendas.reduce((acc, v) => acc + (v.total_a_receber || 0), 0)
  const osAbertas = vendas.filter(v => ['aberta', 'em_andamento'].includes(v.status)).length
  const concluidasCount = vendas.filter(v => v.status === 'concluida' || v.status_pagamento === 'pago').length
  const ticketMedio = concluidasCount > 0 ? faturamentoMes / concluidasCount : 0

  return (
    <div>
      <PageHeader
        title="Vendas / OS"
        subtitle="Ordens de serviço · Vendas · Orçamentos · Produtos · Clientes"
      >
        <button onClick={() => document.getElementById('catalogo-produtos')?.scrollIntoView({behavior:'smooth'})} className="btn-ghost text-xs">Produtos</button>
        <button onClick={() => alert('O gerenciador unificado de Clientes chegará em breve!')} className="btn-ghost text-xs">Clientes</button>
        <button onClick={() => setModalProduto(true)} className="btn-secondary text-xs">+ Produto</button>
        <button onClick={() => setModalOS(true)} className="btn-primary">+ Nova OS / Venda</button>
      </PageHeader>

      {/* ── MÉTRICAS ─────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Faturamento" value={`R$ ${faturamentoMes.toLocaleString('pt-BR', {minimumFractionDigits:2})}`} />
        <MetricCard label="A receber" value={`R$ ${aReceber.toLocaleString('pt-BR', {minimumFractionDigits:2})}`} />
        <MetricCard label="OS abertas" value={osAbertas.toString()} />
        <MetricCard label="Ticket médio" value={`R$ ${ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits:2})}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">

        {/* ── LISTA DE VENDAS / OS ─────────────── */}
        <div className="card lg:col-span-2 flex flex-col min-h-[400px]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Vendas e OS</h2>
            <div className="flex items-center gap-2">
              <select className="input w-auto text-xs py-1 px-2" value={tipoFiltro} onChange={e => setTipoFiltro(e.target.value)}>
                <option value="">Todos os tipos</option>
                <option value="os">Ordem de Serviço</option>
                <option value="venda">Venda</option>
                <option value="orcamento">Orçamento</option>
              </select>
              <select className="input w-auto text-xs py-1 px-2" value={statusFiltro} onChange={e => setStatusFiltro(e.target.value)}>
                <option value="">Todos os status</option>
                <option value="aberta">Aberta</option>
                <option value="em_andamento">Em andamento</option>
                <option value="concluida">Concluída</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">Número</th>
                <th className="table-header">Tipo</th>
                <th className="table-header">Cliente</th>
                <th className="table-header">Data</th>
                <th className="table-header">Total</th>
                <th className="table-header">Pagamento</th>
                <th className="table-header">Status</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {loadingVendas ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-zinc-500 text-sm">Carregando dados...</td>
                </tr>
              ) : vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <p className="text-sm text-zinc-500">Nenhuma venda / OS registrada</p>
                    <button onClick={() => setModalOS(true)} className="btn-primary mt-3 text-xs mx-auto block hover:scale-105 transition-transform shadow-[0_4px_14px_rgba(245,166,35,0.3)]">
                      + Criar primeira OS
                    </button>
                  </td>
                </tr>
              ) : vendasFiltradas.map((v) => (
                <tr key={v.id} className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors">
                  <td className="table-cell font-mono text-zinc-300">#{v.numero}</td>
                  <td className="table-cell">{tipoLabels[v.tipo] || v.tipo}</td>
                  <td className="table-cell">{(v as unknown as any).cliente?.nome || 'Não informado'}</td>
                  <td className="table-cell">{new Date(v.data_abertura).toLocaleDateString('pt-BR')}</td>
                  <td className="table-cell text-zinc-300 font-medium">R$ {(v.total || 0).toFixed(2)}</td>
                  <td className="table-cell text-xs uppercase font-semibold">
                    <span className={pagamentoColor[v.status_pagamento]}>{v.status_pagamento}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border border-current ${statusColor[v.status]}`}>
                      {v.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <button className="btn-ghost text-xs">Ver</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── PAINEL LATERAL ───────────────────── */}
        <div className="space-y-4">

          {/* Pendências de cobrança */}
          <div className="card">
            <h2 className="section-title text-red-500">Cobranças em atraso</h2>
            <div className="space-y-3 mt-2">
              {[
                { cliente: 'Carlos Eduardo', valor: 450, dias: 2, os: 'OS-2026/0405' },
                { cliente: 'Marcos Lima', valor: 600, dias: 5, os: 'OS-2026/0403' },
              ].map((c, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-red-500/10 hover:bg-red-500/5 last:border-0 rounded transition-colors px-1">
                  <div>
                    <p className="text-sm font-medium text-zinc-200">{c.cliente}</p>
                    <p className="text-[10px] text-red-400/80">{c.dias} dias de atraso • {c.os}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-red-400">R$ {c.valor.toFixed(2)}</p>
                    <button className="text-[10px] text-zinc-400 hover:text-zinc-200 uppercase tracking-widest mt-0.5">Cobrar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo de status */}
          <div className="card">
            <h2 className="section-title">Resumo do mês</h2>
            <div className="space-y-2">
              {[
                { label: 'Concluídas', value: (vendas.filter(v => v.status === 'concluida').length), color: 'text-emerald-400' },
                { label: 'Em andamento', value: (vendas.filter(v => v.status === 'em_andamento').length), color: 'text-amber-400' },
                { label: 'Abertas', value: (vendas.filter(v => v.status === 'aberta').length), color: 'text-blue-400' },
                { label: 'Canceladas', value: (vendas.filter(v => v.status === 'cancelada').length), color: 'text-zinc-500' },
                { label: 'Orçamentos', value: (vendas.filter(v => v.tipo === 'orcamento').length), color: 'text-purple-400' },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-sm border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className={`font-semibold ${item.color}`}>{item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Estoque crítico */}
          <div className="card">
            <h2 className="section-title">Estoque crítico</h2>
            <EmptyState message="Nenhum produto abaixo do mínimo" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── PRODUTOS MAIS VENDIDOS ───────────── */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Produtos / serviços mais vendidos</h2>
            <div className="flex gap-2">
              <select className="input w-auto text-xs py-1 px-2">
                <option>Este mês</option>
                <option>Este ano</option>
                <option>Tudo</option>
              </select>
              <button className="btn-ghost text-xs">Ver catálogo</button>
            </div>
          </div>

          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">#</th>
                <th className="table-header">Produto / Serviço</th>
                <th className="table-header">Tipo</th>
                <th className="table-header hidden md:table-cell">Qtd vendida</th>
                <th className="table-header hidden md:table-cell">Receita total</th>
                <th className="table-header">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {produtos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <p className="text-sm text-zinc-500">Nenhum produto cadastrado ainda</p>
                  </td>
                </tr>
              ) : produtos.slice(0, 5).map((p, i) => (
                <tr key={p.id} className="border-b border-zinc-800/50">
                  <td className="table-cell text-zinc-500">{i+1}</td>
                  <td className="table-cell">{p.nome}</td>
                  <td className="table-cell capitalize">{p.tipo}</td>
                  <td className="table-cell hidden md:table-cell">-</td>
                  <td className="table-cell hidden md:table-cell">-</td>
                  <td className="table-cell text-emerald-400">{(p.preco_venda - p.preco_custo) > 0 ? `+ R$ ${(p.preco_venda - p.preco_custo).toFixed(2)}` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── CLIENTES QUE MAIS COMPRAM ────────── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Top clientes</h2>
            <button className="btn-ghost text-xs">Ver todos</button>
          </div>

          <div className="space-y-3 mt-4">
            {[
              { nome: 'Carlos Eduardo', valor: 450, data: 'Hoje' },
              { nome: 'Marcos Lima', valor: 1200, data: 'Ontem' },
              { nome: 'Ana Paula', valor: 850, data: 'Há 2 dias' },
            ].map((c, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b border-zinc-800/30 last:border-0">
                <div>
                  <p className="text-sm text-zinc-200">{c.nome}</p>
                  <p className="text-[10px] text-zinc-500">Última compra: {c.data}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-400">R$ {c.valor.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── FATURAMENTO MENSAL ───────────────── */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Faturamento — últimos 6 meses</h2>
          </div>
          <EmptyState message="Sem dados de faturamento ainda" />
        </div>

        {/* ── FORMAS DE PAGAMENTO ──────────────── */}
        <div className="card">
          <h2 className="section-title">Formas de pagamento</h2>
          <div className="space-y-2">
            {[
              { label: 'PIX', value: 1200 },
              { label: 'Dinheiro', value: 150 },
              { label: 'Cartão crédito', value: 850 },
              { label: 'Cartão débito', value: 450 },
              { label: 'Fiado', value: 0 },
            ].map(item => (
              <div key={item.label} className="flex justify-between text-sm border-b border-zinc-800/50 pb-2 last:border-0 last:pb-0">
                <span className="text-zinc-400">{item.label}</span>
                <span className="text-zinc-300 font-medium">R$ {item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CATÁLOGO DE PRODUTOS ─────────────── */}
        <div id="catalogo-produtos" className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Catálogo de produtos e serviços</h2>
            <div className="flex gap-2 text-zinc-100 flex-wrap">
              <select className="input w-auto text-xs py-1 px-2">
                <option>Todos</option>
                <option>Produto</option>
                <option>Serviço</option>
                <option>Kit</option>
              </select>
              <input className="input text-xs py-1 md:w-48" placeholder="Buscar..." />
              <button onClick={() => setModalProduto(true)} className="btn-primary text-xs py-1 text-zinc-950">+ Produto</button>
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[800px]">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="table-header">Nome</th>
                  <th className="table-header">Tipo</th>
                  <th className="table-header">Código</th>
                  <th className="table-header">Categoria</th>
                  <th className="table-header">Custo</th>
                  <th className="table-header">Venda</th>
                  <th className="table-header">Margem</th>
                  <th className="table-header">Estoque</th>
                  <th className="table-header">Status</th>
                </tr>
              </thead>
              <tbody>
                {produtos.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center">
                      <p className="text-sm text-zinc-500">Nenhum produto / serviço cadastrado</p>
                      <button onClick={() => setModalProduto(true)} className="btn-primary mt-3 text-xs mx-auto block hover:scale-105 transition-transform shadow-[0_4px_14px_rgba(245,166,35,0.3)]">
                        + Cadastrar primeiro produto
                      </button>
                    </td>
                  </tr>
                ) : produtos.map(p => {
                  const margem = p.preco_venda ? ((p.preco_venda - p.preco_custo) / p.preco_venda) * 100 : 0
                  return (
                  <tr key={p.id} className="border-b border-zinc-800/50">
                    <td className="table-cell font-medium text-zinc-200">{p.nome}</td>
                    <td className="table-cell capitalize text-zinc-500">{p.tipo}</td>
                    <td className="table-cell font-mono text-zinc-500">{p.codigo || '-'}</td>
                    <td className="table-cell">{p.categoria || '-'}</td>
                    <td className="table-cell text-zinc-400">R$ {p.preco_custo.toFixed(2)}</td>
                    <td className="table-cell text-zinc-200">R$ {p.preco_venda.toFixed(2)}</td>
                    <td className="table-cell">
                       <span className={margem > 30 ? 'text-emerald-400' : margem > 0 ? 'text-amber-400' : 'text-red-400'}>{margem.toFixed(0)}%</span>
                    </td>
                    <td className="table-cell">
                       {p.controla_estoque ? (
                         <span className={p.estoque_atual <= p.estoque_minimo ? 'text-red-400 font-bold' : 'text-zinc-300'}>{p.estoque_atual} {p.unidade}</span>
                       ) : <span className="text-zinc-600">N/A</span>}
                    </td>
                    <td className="table-cell">
                      {p.ativo ? <span className="text-emerald-400 text-[10px] uppercase font-bold border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 rounded">Ativo</span> : <span className="text-red-400 text-[10px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/20 uppercase font-bold">Inativo</span>}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── RANKING DE VENDAS ─────────────────────────────────── */}
      <SecaoRanking />
      
      {modalOS && <ModalNovaOS onClose={() => setModalOS(false)} />}
      {modalProduto && <ModalNovoProduto onClose={() => setModalProduto(false)} />}
    </div>
  )
}

// ── Modais Locais ────────────────────────────────────────────────────────────

function ModalNovoProduto({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ 
    nome: '', 
    tipo: 'servico', 
    preco_venda: '', 
    preco_custo: '', 
    codigo: '', 
    estoque: '0' 
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Placeholder para uso via mutations na base de dados
    setTimeout(() => {
      setLoading(false)
      onClose()
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Novo Produto / Serviço</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nome</label>
              <input required autoFocus className="input mt-1" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Transferência" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                <option value="servico">Serviço</option>
                <option value="produto">Produto Físico</option>
              </select>
            </div>
            <div>
              <label className="label">Código (SKU)</label>
              <input className="input mt-1" value={form.codigo} onChange={e => setForm({...form, codigo: e.target.value})} placeholder="Ex: TRF-001" />
            </div>
            <div>
              <label className="label">Preço de Venda (R$)</label>
              <input required type="number" min="0" step="0.01" className="input mt-1 border-emerald-500/30" value={form.preco_venda} onChange={e => setForm({...form, preco_venda: e.target.value})} />
            </div>
            <div>
              <label className="label">Preço de Custo (R$)</label>
              <input type="number" min="0" step="0.01" className="input mt-1 border-amber-500/30" value={form.preco_custo} onChange={e => setForm({...form, preco_custo: e.target.value})} />
            </div>
            {form.tipo === 'produto' && (
              <div className="col-span-2">
                <label className="label">Estoque Inicial</label>
                <input required type="number" min="0" className="input mt-1" value={form.estoque} onChange={e => setForm({...form, estoque: e.target.value})} />
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ backgroundColor: '#22c55e', color: '#fff', borderColor: '#22c55e' }}>
              {loading ? 'Salvando...' : 'Cadastrar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalNovaOS({ onClose }: { onClose: () => void }) {
  const [form, setForm] = useState({ tipo: 'os', valor: '', cliente_nome: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    // Simula a criação de um documento (Na versão com actions/Supabase Mutation, isto salva direto no banco)
    setTimeout(() => {
      setLoading(false)
      onClose()
    }, 600)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Nova Venda / Ordem de Serviço</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Tipo de Documento</label>
            <select className="input mt-1" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
              <option value="venda">Venda Direta</option>
              <option value="os">Ordem de Serviço (OS)</option>
              <option value="orcamento">Orçamento</option>
            </select>
          </div>
          <div>
            <label className="label">Nome do Cliente</label>
            <input required autoFocus className="input mt-1" value={form.cliente_nome} onChange={e => setForm({...form, cliente_nome: e.target.value})} placeholder="Ex: João da Silva" />
          </div>
          <div>
            <label className="label">Valor Previsto / Total (R$)</label>
            <input required type="number" min="0" step="0.01" className="input mt-1" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} placeholder="Ex: 450.00" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ backgroundColor: '#f5a623', color: '#18181b', borderColor: '#f5a623' }}>
              {loading ? 'Processando...' : 'Criar Venda / OS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============================================================
// TIPOS - MÓDULO VENDAS / OS
// ============================================================

export type UUID = string
export type Timestamp = string
export type DateString = string

// ---- PRODUTOS ----

export type ProdutoTipo = 'produto' | 'servico' | 'kit'

export interface Produto {
  id: UUID
  nome: string
  descricao?: string
  tipo: ProdutoTipo
  codigo?: string
  preco_custo: number
  preco_venda: number
  unidade: string
  categoria?: string
  foto_url?: string
  controla_estoque: boolean
  estoque_atual: number
  estoque_minimo: number
  ativo: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

export interface MovimentacaoEstoque {
  id: UUID
  produto_id: UUID
  produto?: Produto
  tipo: 'entrada' | 'saida' | 'ajuste' | 'venda' | 'devolucao'
  quantidade: number
  quantidade_anterior?: number
  quantidade_posterior?: number
  custo_unitario?: number
  referencia_id?: UUID
  referencia_tipo?: string
  observacao?: string
  realizado_por?: UUID
  created_at: Timestamp
}

// ---- CLIENTES ----

export type ClienteTipo = 'pf' | 'pj'

export interface Cliente {
  id: UUID
  lead_id?: UUID
  nome: string
  tipo: ClienteTipo
  cpf_cnpj?: string
  telefone?: string
  email?: string
  endereco?: string
  cidade?: string
  estado?: string
  cep?: string
  observacoes?: string
  total_compras: number
  total_gasto: number
  ultima_compra?: Timestamp
  ativo: boolean
  created_at: Timestamp
  updated_at: Timestamp
}

// ---- VENDAS / OS ----

export type VendaTipo = 'venda' | 'os' | 'orcamento' | 'pedido'
export type VendaStatus = 'rascunho' | 'aberta' | 'em_andamento' | 'concluida' | 'cancelada' | 'orcamento_aprovado'
export type PagamentoStatus = 'pendente' | 'parcial' | 'pago' | 'cancelado'
export type FormaPagamento = 'dinheiro' | 'pix' | 'cartao_credito' | 'cartao_debito' | 'boleto' | 'fiado' | 'outro'

export interface Venda {
  id: UUID
  numero: string
  tipo: VendaTipo
  status: VendaStatus
  cliente_id?: UUID
  cliente?: Cliente
  lead_id?: UUID
  atendente_id?: UUID
  parceiro_id?: UUID
  data_abertura: DateString
  data_previsao?: DateString
  data_conclusao?: DateString
  subtotal: number
  desconto_valor: number
  desconto_percentual: number
  acrescimo: number
  total: number
  forma_pagamento?: FormaPagamento
  total_parcelas: number
  valor_entrada: number
  status_pagamento: PagamentoStatus
  total_recebido: number
  total_a_receber: number
  observacoes?: string
  observacoes_internas?: string
  origem?: string
  lancamento_id?: UUID
  created_by?: UUID
  created_at: Timestamp
  updated_at: Timestamp
  // joins
  itens?: ItemVenda[]
  parcelas?: ParcelaVenda[]
  atendente?: { nome: string }
}

export interface ItemVenda {
  id: UUID
  venda_id: UUID
  produto_id?: UUID
  produto?: Produto
  descricao: string
  quantidade: number
  unidade: string
  preco_unitario: number
  desconto_percentual: number
  desconto_valor: number
  total: number
  observacao?: string
  created_at: Timestamp
}

export interface ParcelaVenda {
  id: UUID
  venda_id: UUID
  numero_parcela: number
  valor: number
  data_vencimento: DateString
  data_recebimento?: DateString
  valor_recebido?: number
  forma_pagamento?: FormaPagamento
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado'
  observacao?: string
  lancamento_id?: UUID
  created_at: Timestamp
}
