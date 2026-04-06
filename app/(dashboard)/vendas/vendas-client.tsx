'use client'

import { PageHeader, MetricCard, EmptyState } from '@/components/shared/ui'
import React, { useState } from 'react'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'

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

export default function VendasClient() {
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')

  const { data: vendas, loading: loadingVendas } = useSupabaseQuery<Venda>('vendas', {
    select: '*, cliente:cliente_id(*)' // Assumindo relação
  })
  
  const { data: produtos } = useSupabaseQuery<Produto>('produtos')

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
        <button className="btn-ghost text-xs">Produtos</button>
        <button className="btn-ghost text-xs">Clientes</button>
        <button className="btn-secondary text-xs">+ Produto</button>
        <button className="btn-primary">+ Nova OS / Venda</button>
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
                    <button className="btn-primary mt-3 text-xs mx-auto block hover:scale-105 transition-transform shadow-[0_4px_14px_rgba(245,166,35,0.3)]">
                      + Criar primeira OS
                    </button>
                  </td>
                </tr>
              ) : vendasFiltradas.map((v) => (
                <tr key={v.id} className="border-b border-zinc-800/50 hover:bg-white/5 transition-colors">
                  <td className="table-cell font-mono text-zinc-300">#{v.numero}</td>
                  <td className="table-cell">{tipoLabels[v.tipo] || v.tipo}</td>
                  <td className="table-cell">{(v as any).cliente?.nome || 'Não informado'}</td>
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
            <h2 className="section-title">Cobranças em atraso</h2>
            <EmptyState message="Nenhuma parcela em atraso" />
          </div>

          {/* Resumo de status */}
          <div className="card">
            <h2 className="section-title">Resumo do mês</h2>
            <div className="space-y-2">
              {[
                { label: 'Concluídas', value: 0, color: 'text-emerald-400' },
                { label: 'Em andamento', value: 0, color: 'text-amber-400' },
                { label: 'Abertas', value: 0, color: 'text-blue-400' },
                { label: 'Canceladas', value: 0, color: 'text-zinc-500' },
                { label: 'Orçamentos', value: 0, color: 'text-purple-400' },
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

          <EmptyState message="Nenhuma venda concluída ainda" />
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
              { label: 'PIX', value: 0 },
              { label: 'Dinheiro', value: 0 },
              { label: 'Cartão crédito', value: 0 },
              { label: 'Cartão débito', value: 0 },
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
        <div className="card lg:col-span-3">
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
              <button className="btn-primary text-xs py-1 text-zinc-950">+ Produto</button>
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
                      <button className="btn-primary mt-3 text-xs mx-auto block">
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
