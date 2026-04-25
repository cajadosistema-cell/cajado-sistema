'use client'

import { PageHeader, MetricCard, EmptyState } from '@/components/shared/ui'
import React, { useState } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { SecaoRanking } from './_components/SecaoRanking'
import { useToast } from '@/components/shared/toast'
import { cn } from '@/lib/utils'

// ── Tipos ────────────────────────────────────────────────────
type Cliente = {
  id: string
  nome: string
  tipo: string
  cpf_cnpj?: string | null
  telefone?: string | null
  email?: string | null
  cidade?: string | null
  total_compras?: number
  total_gasto?: number
  ativo?: boolean
  created_at?: string
}

type Produto = {
  id: string
  nome: string
  tipo: string
  codigo?: string | null
  preco_custo: number
  preco_venda: number
  unidade: string
  controla_estoque: boolean
  estoque_atual: number
  estoque_minimo: number
  ativo: boolean
  created_at?: string
  updated_at?: string
}

type Venda = {
  id: string
  numero: string
  tipo: string
  status: string
  cliente?: { nome: string } | null
  cliente_id?: string | null
  data_abertura: string
  total: number
  subtotal: number
  desconto_percentual: number
  desconto_valor: number
  acrescimo: number
  total_parcelas: number
  valor_entrada: number
  status_pagamento: string
  total_recebido: number
  total_a_receber: number
  created_at?: string
  updated_at?: string
  forma_pagamento?: string
  observacoes?: string | null
}

type ItemVenda = {
  id: string
  venda_id: string
  produto_id: string | null
  descricao: string
  quantidade: number
  preco_unitario: number
  desconto: number
  total: number
  produto?: { nome: string; unidade: string } | null
}

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
  cancelado: 'text-fg-tertiary',
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
// ── Modal Adicionar Item ─────────────────────────────────────
function ModalAddItem({
  vendaId, produtos, onClose, onSave,
}: {
  vendaId: string
  produtos: Produto[]
  onClose: () => void
  onSave: () => void
}) {
  const { insert } = useSupabaseMutation('itens_venda')
  const [form, setForm] = useState({
    produto_id: '',
    descricao: '',
    quantidade: '1',
    preco_unitario: '',
    desconto: '0',
  })
  const [erro, setErro] = useState('')
  const [saving, setSaving] = useState(false)

  const produtoSelecionado = produtos.find(p => p.id === form.produto_id)

  const handleProdutoChange = (id: string) => {
    const p = produtos.find(x => x.id === id)
    setForm(f => ({
      ...f,
      produto_id: id,
      descricao: p?.nome ?? f.descricao,
      preco_unitario: p ? p.preco_venda.toFixed(2) : f.preco_unitario,
    }))
  }

  const total = (parseFloat(form.quantidade) || 0) *
    (parseFloat(form.preco_unitario) || 0) *
    (1 - (parseFloat(form.desconto) || 0) / 100)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.descricao.trim()) { setErro('Informe a descrição do item'); return }
    if (!form.preco_unitario || parseFloat(form.preco_unitario) <= 0) { setErro('Informe o preço unitário'); return }
    setSaving(true)
    const result = await insert({
      venda_id: vendaId,
      produto_id: form.produto_id || null,
      descricao: form.descricao,
      quantidade: parseFloat(form.quantidade) || 1,
      unidade: produtoSelecionado?.unidade ?? 'UN',
      preco_unitario: parseFloat(form.preco_unitario),
      desconto_percentual: parseFloat(form.desconto) || 0,
      desconto_valor: 0,
      total,
    })
    setSaving(false)
    if (result.error) { setErro(`Erro: ${result.error}`); return }
    onSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-fg">Adicionar Item à OS</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Produto (opcional) */}
          <div>
            <label className="label">Produto / Serviço do catálogo</label>
            <select className="input mt-1" value={form.produto_id} onChange={e => handleProdutoChange(e.target.value)}>
              <option value="">— Descrição livre —</option>
              {produtos.filter(p => p.ativo).map(p => (
                <option key={p.id} value={p.id}>{p.nome} — R$ {p.preco_venda.toFixed(2)}</option>
              ))}
            </select>
          </div>

          {/* Descrição */}
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Troca de óleo..." />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Qtd</label>
              <input className="input mt-1" type="number" min="0.01" step="0.01"
                value={form.quantidade}
                onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
            </div>
            <div>
              <label className="label">Preço unit. (R$)</label>
              <input className="input mt-1" type="number" min="0" step="0.01"
                value={form.preco_unitario}
                onChange={e => setForm(f => ({ ...f, preco_unitario: e.target.value }))}
                placeholder="0,00" />
            </div>
            <div>
              <label className="label">Desconto (%)</label>
              <input className="input mt-1" type="number" min="0" max="100" step="1"
                value={form.desconto}
                onChange={e => setForm(f => ({ ...f, desconto: e.target.value }))} />
            </div>
          </div>

          {/* Total preview */}
          <div className="bg-muted/50 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-xs text-fg-tertiary">Total do item</span>
            <span className="text-lg font-bold text-amber-400">
              R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {erro && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{erro}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Salvando...' : 'Adicionar item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Drawer de OS/Venda ────────────────────────────────────────
function DrawerOS({
  venda, produtos, onClose, onRefresh,
}: {
  venda: Venda
  produtos: Produto[]
  onClose: () => void
  onRefresh: () => void
}) {
  const [modalItem, setModalItem] = useState(false)
  const [statusLocal, setStatusLocal] = useState(venda.status)
  const [salvandoStatus, setSalvandoStatus] = useState(false)
  const [pagamentoLocal, setPagamentoLocal] = useState(venda.status_pagamento)
  const { success, error: toastError } = useToast()
  const { update: updateVenda } = useSupabaseMutation('vendas')

  const handleMudarStatus = async (novoStatus: string) => {
    if (novoStatus === statusLocal || salvandoStatus) return
    setSalvandoStatus(true)
    const resultado = await updateVenda(venda.id, {
      status: novoStatus,
      ...(novoStatus === 'concluida' ? { data_conclusao: new Date().toISOString().split('T')[0] } : {}),
    })
    setSalvandoStatus(false)
    if (resultado.error) {
      toastError('Erro ao atualizar status: ' + resultado.error)
      return
    }
    setStatusLocal(novoStatus)
    onRefresh()
    success(`Status alterado para "${novoStatus.replace('_', ' ')}"`)
  }

  const handleMudarPagamento = async (novoPagamento: string) => {
    if (novoPagamento === pagamentoLocal) return
    await updateVenda(venda.id, { status_pagamento: novoPagamento })
    setPagamentoLocal(novoPagamento)
    onRefresh()
    success(`Pagamento marcado como "${novoPagamento}"`)
  }

  const { data: itens, refetch: refetchItens } = useSupabaseQuery<ItemVenda>('itens_venda', {
    filters: { venda_id: venda.id },
    select: '*, produto:produtos(nome, unidade)',
    orderBy: { column: 'created_at', ascending: true },
  })

  const recalcularTotal = async (itensAtuais: ItemVenda[]) => {
    const novoTotal = itensAtuais.reduce((acc, i) => acc + i.total, 0)
    await updateVenda(venda.id, {
      subtotal: novoTotal,
      total: novoTotal,
      total_a_receber: Math.max(0, novoTotal - venda.total_recebido),
    })
    onRefresh()
  }

  const handleItemSalvo = async () => {
    await refetchItens()
    // Recalcular após refetch — pegar itens atualizados
    setTimeout(async () => {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('itens_venda')
        .select('total')
        .eq('venda_id', venda.id)
      if (data) {
        const novoTotal = data.reduce((acc: number, i: any) => acc + i.total, 0)
        await updateVenda(venda.id, {
          subtotal: novoTotal,
          total: novoTotal,
          total_a_receber: Math.max(0, novoTotal - venda.total_recebido),
        })
        onRefresh()
        success('Item adicionado e total atualizado!')
      }
    }, 300)
  }

  const handleRemoverItem = async (itemId: string) => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { error } = await supabase.from('itens_venda').delete().eq('id', itemId)
    if (error) { toastError('Erro ao remover item: ' + error.message); return }

    // Recalcular total
    const { data: itensRestantes } = await supabase
      .from('itens_venda')
      .select('total')
      .eq('venda_id', venda.id)
    if (itensRestantes) {
      const novoTotal = itensRestantes.reduce((acc: number, i: any) => acc + i.total, 0)
      await updateVenda(venda.id, {
        subtotal: novoTotal,
        total: novoTotal,
        total_a_receber: Math.max(0, novoTotal - venda.total_recebido),
      })
    }
    refetchItens()
    onRefresh()
    success('Item removido!')
  }

  const totalItens = itens.reduce((acc, i) => acc + i.total, 0)

  return (
    <div className="fixed inset-0 z-40 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-page border-l border-border-subtle flex flex-col h-screen overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-border-subtle">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-bold border',
                  statusColor[statusLocal]
                )}>
                  {statusLocal.replace('_', ' ').toUpperCase()}
                </span>
                <span className="text-xs text-fg-tertiary">{tipoLabels[venda.tipo] || venda.tipo}</span>
                {salvandoStatus && <span className="text-[10px] text-fg-disabled animate-pulse">salvando...</span>}
              </div>
              <h2 className="text-base font-bold text-fg">#{venda.numero}</h2>
              <p className="text-xs text-fg-tertiary mt-0.5">
                {venda.cliente?.nome || 'Sem cliente'} · {new Date(venda.data_abertura).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
          </div>

          {/* ── Fluxo de Status ─────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[10px] text-fg-disabled uppercase tracking-widest font-semibold">Progresso da OS</p>
            <div className="flex gap-1.5 flex-wrap">
              {[
                { key: 'rascunho',      label: '📝 Rascunho',      next: true },
                { key: 'aberta',        label: '📂 Aberta',         next: true },
                { key: 'em_andamento',  label: '⚙️ Em andamento',   next: true },
                { key: 'concluida',     label: '✅ Concluída',       next: false },
              ].map((s, idx, arr) => {
                const isCurrent = statusLocal === s.key
                const isPast = arr.findIndex(x => x.key === statusLocal) > idx
                const isCancelled = statusLocal === 'cancelada'
                return (
                  <button
                    key={s.key}
                    onClick={() => handleMudarStatus(s.key)}
                    disabled={salvandoStatus || isCancelled}
                    className={cn(
                      'px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all border',
                      isCurrent
                        ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 ring-1 ring-amber-500/30'
                        : isPast
                        ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'
                        : 'bg-muted/60 border-border-subtle text-fg-tertiary hover:border-zinc-500 hover:text-fg-secondary'
                    )}
                  >
                    {s.label}
                  </button>
                )
              })}
              {/* Cancelar */}
              {statusLocal !== 'concluida' && statusLocal !== 'cancelada' && (
                <button
                  onClick={() => handleMudarStatus('cancelada')}
                  disabled={salvandoStatus}
                  className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium border border-border-subtle text-zinc-700 hover:border-red-500/30 hover:text-red-400 hover:bg-red-500/5 transition-all"
                >
                  🚫 Cancelar
                </button>
              )}
            </div>

            {/* ── Pagamento rápido ─────────────────────── */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-[10px] text-fg-disabled uppercase tracking-widest font-semibold shrink-0">Pgto:</span>
              {(['pendente', 'parcial', 'pago'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => handleMudarPagamento(p)}
                  className={cn(
                    'px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide border transition-all',
                    pagamentoLocal === p
                      ? p === 'pago'
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : p === 'parcial'
                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-400'
                        : 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-muted/50 border-border-subtle text-fg-disabled hover:border-zinc-600'
                  )}
                >
                  {p === 'pendente' ? '⏳ Pendente' : p === 'parcial' ? '🔵 Parcial' : '✅ Pago'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Itens */}
        <div className="flex-1 p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-fg-tertiary uppercase tracking-wide font-semibold">
              Itens ({itens.length})
            </p>
            <button
              onClick={() => setModalItem(true)}
              className="btn-primary text-xs py-1 px-3"
            >
              + Adicionar item
            </button>
          </div>

          {itens.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-border-subtle rounded-xl">
              <span className="text-3xl mb-2">📦</span>
              <p className="text-sm text-fg-tertiary">Nenhum item nesta OS ainda</p>
              <button
                onClick={() => setModalItem(true)}
                className="btn-primary text-xs mt-3 py-1 px-3"
              >
                + Adicionar primeiro item
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {itens.map(item => (
                <div key={item.id} className="bg-muted/40 border border-border-subtle rounded-xl px-4 py-3 flex items-start justify-between group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{item.descricao}</p>
                    <p className="text-xs text-fg-tertiary mt-0.5">
                      {item.quantidade} × R$ {item.preco_unitario.toFixed(2)}
                      {item.desconto > 0 && <span className="text-amber-500 ml-1">(-{item.desconto}%)</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 ml-3 shrink-0">
                    <span className="text-sm font-bold text-fg">
                      R$ {item.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                    <button
                      onClick={() => handleRemoverItem(item.id)}
                      className="text-zinc-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 text-base leading-none"
                      title="Remover item"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Totais */}
        <div className="p-5 border-t border-border-subtle space-y-2 bg-page/80 backdrop-blur-sm">
          <div className="flex justify-between text-sm">
            <span className="text-fg-tertiary">Subtotal ({itens.length} itens)</span>
            <span className="text-fg-secondary">R$ {totalItens.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
          </div>
          {venda.desconto_valor > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-fg-tertiary">Desconto</span>
              <span className="text-red-400">- R$ {venda.desconto_valor.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold border-t border-border-subtle pt-2 mt-1">
            <span className="text-fg">Total</span>
            <span className="text-amber-400">
              R$ {(itens.length > 0 ? totalItens : venda.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className={cn('font-medium', pagamentoColor[venda.status_pagamento])}>
              {venda.status_pagamento.toUpperCase()}
            </span>
            <span className="text-fg-tertiary">
              Recebido: R$ {venda.total_recebido.toFixed(2)} · A receber: R$ {venda.total_a_receber.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {modalItem && (
        <ModalAddItem
          vendaId={venda.id}
          produtos={produtos}
          onClose={() => setModalItem(false)}
          onSave={handleItemSalvo}
        />
      )}
    </div>
  )
}

export default function VendasClient() {

  const [tipoFiltro, setTipoFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [modalOS, setModalOS] = useState(false)
  const [modalProduto, setModalProduto] = useState(false)
  const [modalClientes, setModalClientes] = useState(false)
  const [vendaSelecionada, setVendaSelecionada] = useState<Venda | null>(null)


  const { data: vendasDB, loading: loadingVendas, refetch: refetchVendas } = useSupabaseQuery<Venda>('vendas', {
    select: '*, cliente:clientes(nome)',
    orderBy: { column: 'created_at', ascending: false },
  })
  
  const { data: produtosDB, refetch: refetchProdutos } = useSupabaseQuery<Produto>('produtos', {
    orderBy: { column: 'nome', ascending: true },
  })
  const { data: clientesDB, refetch: refetchClientes } = useSupabaseQuery<Cliente>('clientes', {
    orderBy: { column: 'nome', ascending: true },
  })

  const vendas = vendasDB
  const produtos = produtosDB

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
        <button onClick={() => setModalClientes(true)} className="btn-ghost text-xs">Clientes</button>
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

          <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[560px]">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="table-header">Número</th>
                <th className="table-header hidden sm:table-cell">Tipo</th>
                <th className="table-header">Cliente</th>
                <th className="table-header hidden sm:table-cell">Data</th>
                <th className="table-header">Total</th>
                <th className="table-header hidden md:table-cell">Pagamento</th>
                <th className="table-header">Status</th>
                <th className="table-header"></th>
              </tr>
            </thead>
            <tbody>
              {loadingVendas ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-fg-tertiary text-sm">Carregando dados...</td>
                </tr>
              ) : vendasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <p className="text-sm text-fg-tertiary">Nenhuma venda / OS registrada</p>
                    <button onClick={() => setModalOS(true)} className="btn-primary mt-3 text-xs mx-auto block hover:scale-105 transition-transform shadow-[0_4px_14px_rgba(245,166,35,0.3)]">
                      + Criar primeira OS
                    </button>
                  </td>
                </tr>
              ) : vendasFiltradas.map((v) => (
                <tr key={v.id} className="border-b border-border-subtle/50 hover:bg-white/5 transition-colors">
                  <td className="table-cell font-mono text-fg-secondary text-xs">#{v.numero}</td>
                  <td className="table-cell hidden sm:table-cell">{tipoLabels[v.tipo] || v.tipo}</td>
                  <td className="table-cell truncate max-w-[120px]">{(v as unknown as any).cliente?.nome || 'N/A'}</td>
                  <td className="table-cell hidden sm:table-cell text-xs">{new Date(v.data_abertura).toLocaleDateString('pt-BR')}</td>
                  <td className="table-cell text-fg-secondary font-medium whitespace-nowrap">R$ {(v.total || 0).toFixed(2)}</td>
                  <td className="table-cell text-xs uppercase font-semibold hidden md:table-cell">
                    <span className={pagamentoColor[v.status_pagamento]}>{v.status_pagamento}</span>
                  </td>
                  <td className="table-cell">
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border border-current ${statusColor[v.status]}`}>
                      {v.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td className="table-cell text-right">
                    <button
                      className="btn-ghost text-xs hover:text-amber-400 transition-colors"
                      onClick={() => setVendaSelecionada(v)}
                    >
                      Ver ›
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        {/* ── PAINEL LATERAL ───────────────────── */}
        <div className="space-y-4">

          {/* Pendências de cobrança */}
          <div className="card">
            <h2 className="section-title text-red-500">Pendências de Cobrança</h2>
            <div className="space-y-3 mt-2">
              {vendas.filter(v => v.total_a_receber > 0 && v.status_pagamento !== 'pago').slice(0, 5).map((v) => {
                const dias = Math.floor((new Date().getTime() - new Date(v.data_abertura).getTime()) / (1000 * 3600 * 24));
                return (
                  <div key={v.id} className="flex justify-between items-center py-2 border-b border-red-500/10 hover:bg-red-500/5 last:border-0 rounded transition-colors px-1">
                    <div>
                      <p className="text-sm font-medium text-fg">{(v as any).cliente?.nome || 'Cliente não informado'}</p>
                      <p className="text-[10px] text-red-400/80">{dias} dias em aberto • #{v.numero}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-red-400">R$ {(v.total_a_receber || 0).toFixed(2)}</p>
                      <button className="text-[10px] text-fg-secondary hover:text-fg uppercase tracking-widest mt-0.5">Cobrar</button>
                    </div>
                  </div>
                )
              })}
              {vendas.filter(v => v.total_a_receber > 0).length === 0 && (
                <p className="text-xs text-fg-tertiary">Nenhuma cobrança pendente.</p>
              )}
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
                { label: 'Canceladas', value: (vendas.filter(v => v.status === 'cancelada').length), color: 'text-fg-tertiary' },
                { label: 'Orçamentos', value: (vendas.filter(v => v.tipo === 'orcamento').length), color: 'text-purple-400' },
              ].map(item => (
                <div key={item.label} className="flex justify-between text-sm border-b border-border-subtle/50 pb-2 last:border-0 last:pb-0">
                  <span className="text-fg-secondary">{item.label}</span>
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
              <tr className="border-b border-border-subtle">
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
                    <p className="text-sm text-fg-tertiary">Nenhum produto cadastrado ainda</p>
                  </td>
                </tr>
              ) : produtos.slice(0, 5).map((p, i) => (
                <tr key={p.id} className="border-b border-border-subtle/50">
                  <td className="table-cell text-fg-tertiary">{i+1}</td>
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
            {clientesDB.length === 0 ? (
              <p className="text-xs text-fg-tertiary">Nenhum cliente cadastrado.</p>
            ) : (
              [...clientesDB].sort((a, b) => (b.total_gasto || 0) - (a.total_gasto || 0)).slice(0, 5).map((c) => (
                <div key={c.id} className="flex justify-between items-center py-2 border-b border-border-subtle/30 last:border-0">
                  <div>
                    <p className="text-sm text-fg">{c.nome}</p>
                    <p className="text-[10px] text-fg-tertiary">{c.total_compras || 0} compras realizadas</p>
                  </div>
                  <p className="text-sm font-semibold text-emerald-400">R$ {(c.total_gasto || 0).toFixed(2)}</p>
                </div>
              ))
            )}
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
              { label: 'PIX', value: vendas.filter(v => v.forma_pagamento === 'pix').reduce((a, v) => a + (v.total || 0), 0) },
              { label: 'Cartão de Crédito', value: vendas.filter(v => v.forma_pagamento === 'cartao_credito').reduce((a, v) => a + (v.total || 0), 0) },
              { label: 'Cartão de Débito', value: vendas.filter(v => v.forma_pagamento === 'cartao_debito').reduce((a, v) => a + (v.total || 0), 0) },
              { label: 'Dinheiro', value: vendas.filter(v => v.forma_pagamento === 'dinheiro').reduce((a, v) => a + (v.total || 0), 0) },
              { label: 'Fiado', value: vendas.filter(v => v.forma_pagamento === 'fiado').reduce((a, v) => a + (v.total || 0), 0) },
            ].sort((a,b) => b.value - a.value).map(item => (
              <div key={item.label} className="flex justify-between text-sm border-b border-border-subtle/50 pb-2 last:border-0 last:pb-0">
                <span className="text-fg-secondary">{item.label}</span>
                <span className="text-fg-secondary font-medium">R$ {item.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CATÁLOGO DE PRODUTOS ─────────────── */}
        <div id="catalogo-produtos" className="card lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Catálogo de produtos e serviços</h2>
            <div className="flex gap-2 text-fg flex-wrap">
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
                <tr className="border-b border-border-subtle">
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
                      <p className="text-sm text-fg-tertiary">Nenhum produto / serviço cadastrado</p>
                      <button onClick={() => setModalProduto(true)} className="btn-primary mt-3 text-xs mx-auto block hover:scale-105 transition-transform shadow-[0_4px_14px_rgba(245,166,35,0.3)]">
                        + Cadastrar primeiro produto
                      </button>
                    </td>
                  </tr>
                ) : produtos.map(p => {
                  const margem = p.preco_venda ? ((p.preco_venda - p.preco_custo) / p.preco_venda) * 100 : 0
                  return (
                  <tr key={p.id} className="border-b border-border-subtle/50">
                    <td className="table-cell font-medium text-fg">{p.nome}</td>
                    <td className="table-cell capitalize text-fg-tertiary">{p.tipo}</td>
                    <td className="table-cell font-mono text-fg-tertiary">{p.codigo || '-'}</td>
                    <td className="table-cell">{p.categoria || '-'}</td>
                    <td className="table-cell text-fg-secondary">R$ {p.preco_custo.toFixed(2)}</td>
                    <td className="table-cell text-fg">R$ {p.preco_venda.toFixed(2)}</td>
                    <td className="table-cell">
                       <span className={margem > 30 ? 'text-emerald-400' : margem > 0 ? 'text-amber-400' : 'text-red-400'}>{margem.toFixed(0)}%</span>
                    </td>
                    <td className="table-cell">
                       {p.controla_estoque ? (
                         <span className={p.estoque_atual <= p.estoque_minimo ? 'text-red-400 font-bold' : 'text-fg-secondary'}>{p.estoque_atual} {p.unidade}</span>
                       ) : <span className="text-fg-disabled">N/A</span>}
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
      
      {modalOS && <ModalNovaOS clientes={clientesDB} onClose={() => setModalOS(false)} onSave={refetchVendas} />}
      {modalProduto && <ModalNovoProduto onClose={() => setModalProduto(false)} onSave={refetchProdutos} />}
      {modalClientes && <ModalClientes clientes={clientesDB} onClose={() => setModalClientes(false)} onSave={refetchClientes} />}
      {vendaSelecionada && (
        <DrawerOS
          venda={vendaSelecionada}
          produtos={produtos}
          onClose={() => setVendaSelecionada(null)}
          onRefresh={refetchVendas}
        />
      )}
    </div>
  )
}

// ── Modais Locais ────────────────────────────────────────────────────────────

function ModalNovoProduto({ onClose, onSave }: { onClose: () => void; onSave?: () => void }) {
  const { insert, loading } = useSupabaseMutation('produtos')
  const [erro, setErro] = useState('')
  const [form, setForm] = useState({ 
    nome: '', 
    tipo: 'servico', 
    preco_venda: '', 
    preco_custo: '', 
    imposto: '',
    taxa_cartao: '',
    comissao: '',
    codigo: '', 
    estoque: '0',
    unidade: 'UN',
    ativo: true,
    controla_estoque: false,
  })

  const vendaVal = parseFloat(form.preco_venda.replace(',', '.')) || 0
  const custoVal = parseFloat(form.preco_custo.replace(',', '.')) || 0
  const impostoVal = parseFloat(form.imposto.replace(',', '.')) || 0
  const taxaVal = parseFloat(form.taxa_cartao.replace(',', '.')) || 0
  const comissaoVal = parseFloat(form.comissao.replace(',', '.')) || 0

  const lucroLiquido = vendaVal - custoVal - impostoVal - taxaVal - comissaoVal
  const margem = vendaVal > 0 ? (lucroLiquido / vendaVal) * 100 : 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    
    // Tenta salvar com todos os campos detalhados
    const { error } = await insert({
      nome: form.nome,
      tipo: form.tipo,
      codigo: form.codigo || null,
      preco_venda: vendaVal,
      preco_custo: custoVal,
      imposto: impostoVal,
      taxa_cartao: taxaVal,
      comissao: comissaoVal,
      unidade: form.unidade,
      controla_estoque: form.tipo === 'produto',
      estoque_atual: form.tipo === 'produto' ? parseInt(form.estoque) || 0 : 0,
      estoque_minimo: 0,
      ativo: true,
    })

    if (error) {
      // Fallback: se as colunas novas não existirem, salva agrupando tudo no custo
      const custoTotalAgrupado = custoVal + impostoVal + taxaVal + comissaoVal
      const { error: fallbackError } = await insert({
        nome: form.nome,
        tipo: form.tipo,
        codigo: form.codigo || null,
        preco_venda: vendaVal,
        preco_custo: custoTotalAgrupado, // agrupa todos os custos
        unidade: form.unidade,
        controla_estoque: form.tipo === 'produto',
        estoque_atual: form.tipo === 'produto' ? parseInt(form.estoque) || 0 : 0,
        estoque_minimo: 0,
        ativo: true,
      })
      if (fallbackError) {
        setErro(`Erro: ${fallbackError.message || fallbackError}`)
        return
      }
    }
    
    onSave?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-fg">Novo Produto / Serviço</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        {erro && <div className="mb-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠️ {erro}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="label">Nome do Produto / Serviço *</label>
              <input required autoFocus className="input mt-1" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Transferência de Veículo" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                <option value="servico">Serviço</option>
                <option value="produto">Produto Físico</option>
                <option value="kit">Kit / Combo</option>
              </select>
            </div>
            <div>
              <label className="label">Unidade</label>
              <select className="input mt-1" value={form.unidade} onChange={e => setForm({...form, unidade: e.target.value})}>
                <option value="UN">Unidade (UN)</option>
                <option value="PAR">Par (PAR)</option>
                <option value="KG">Quilograma (KG)</option>
                <option value="M">Metro (M)</option>
                <option value="HR">Hora (HR)</option>
              </select>
            </div>

            {/* Nova seção de precificação */}
            <div className="col-span-2 mt-2 pt-4 border-t border-border-subtle">
              <h3 className="text-sm font-semibold text-fg mb-3">Estrutura de Preço</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                
                <div className="col-span-2 md:col-span-1">
                  <label className="label">Valor Geral (Venda) *</label>
                  <input required type="number" min="0" step="0.01" className="input mt-1 border-emerald-500/30 text-emerald-400 font-medium" value={form.preco_venda} onChange={e => setForm({...form, preco_venda: e.target.value})} placeholder="0.00" />
                </div>
                
                <div>
                  <label className="label">Custo Base (R$)</label>
                  <input type="number" min="0" step="0.01" className="input mt-1" value={form.preco_custo} onChange={e => setForm({...form, preco_custo: e.target.value})} placeholder="0.00" />
                </div>

                <div>
                  <label className="label">Imposto (R$)</label>
                  <input type="number" min="0" step="0.01" className="input mt-1" value={form.imposto} onChange={e => setForm({...form, imposto: e.target.value})} placeholder="0.00" />
                </div>

                <div>
                  <label className="label">Taxa Maquininha (R$)</label>
                  <input type="number" min="0" step="0.01" className="input mt-1" value={form.taxa_cartao} onChange={e => setForm({...form, taxa_cartao: e.target.value})} placeholder="0.00" />
                </div>

                <div>
                  <label className="label">Comissão (R$)</label>
                  <input type="number" min="0" step="0.01" className="input mt-1" value={form.comissao} onChange={e => setForm({...form, comissao: e.target.value})} placeholder="0.00" />
                </div>

                {form.tipo === 'produto' && (
                  <div>
                    <label className="label">Estoque Inicial</label>
                    <input required type="number" min="0" className="input mt-1" value={form.estoque} onChange={e => setForm({...form, estoque: e.target.value})} />
                  </div>
                )}
              </div>

              {/* Resultado do Lucro Líquido */}
              <div className="mt-4 p-4 bg-black/40 border border-border-subtle rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-wider block">Lucro Líquido Esperado</span>
                  <span className="text-xs text-fg-disabled mt-0.5 block">Margem de Lucro: {margem.toFixed(1)}%</span>
                </div>
                <span className={`text-2xl font-bold ${lucroLiquido > 0 ? 'text-emerald-400' : lucroLiquido < 0 ? 'text-red-400' : 'text-fg-secondary'}`}>
                  R$ {lucroLiquido.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary bg-emerald-600 hover:bg-emerald-500 border-emerald-600">
              {loading ? '⏳ Salvando...' : '✓ Cadastrar Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalNovaOS({ clientes, onClose, onSave }: { clientes: Cliente[]; onClose: () => void; onSave?: () => void }) {
  const { insert, loading } = useSupabaseMutation('vendas')
  const { data: funcionarios } = useSupabaseQuery<any>('funcionarios')
  const supabase = createClient()

  const [erro, setErro] = useState('')
  const [form, setForm] = useState({
    tipo: 'os',
    total: '',
    cliente_id: '',
    responsavel_id: '',
    forma_pagamento: 'pix',
    observacoes: '',
    data_abertura: new Date().toISOString().split('T')[0],
  })

  // Preenche o usuário logado automaticamente
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && funcionarios.length > 0) {
        // Tenta achar o funcionário logado pelo email ou pega o primeiro se não achar
        const logado = funcionarios.find((f: any) => f.email === user.email)
        setForm(prev => ({ ...prev, responsavel_id: logado ? logado.id : funcionarios[0]?.id || '' }))
      }
    })
  }, [funcionarios])

  const gerarNumero = () => {
    const ano = new Date().getFullYear()
    const seq = String(Math.floor(Math.random() * 9000) + 1000)
    return `${ano}/${seq}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    const totalVal = parseFloat(form.total) || 0
    const result = await insert({
      numero: gerarNumero(),
      tipo: form.tipo,
      status: 'aberta',
      cliente_id: form.cliente_id || null,
      data_abertura: form.data_abertura,
      subtotal: totalVal,
      desconto_valor: 0,
      desconto_percentual: 0,
      acrescimo: 0,
      total: totalVal,
      forma_pagamento: form.forma_pagamento,
      total_parcelas: 1,
      valor_entrada: 0,
      status_pagamento: 'pendente',
      total_recebido: 0,
      total_a_receber: totalVal,
      observacoes: form.observacoes || null,
      funcionario_id: form.responsavel_id || null, // salva quem está criando
    })
    if (result.error) { setErro(`Erro: ${result.error}`); return }
    onSave?.()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-fg">Nova Venda / Ordem de Serviço</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        {erro && <div className="mb-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠️ {erro}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Tipo de Documento</label>
              <select className="input mt-1" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                <option value="os">Ordem de Serviço (OS)</option>
                <option value="venda">Venda Direta</option>
                <option value="orcamento">Orçamento</option>
              </select>
            </div>
            <div>
              <label className="label">Data de Abertura</label>
              <input type="date" className="input mt-1" value={form.data_abertura} onChange={e => setForm({...form, data_abertura: e.target.value})} />
            </div>
            <div className="col-span-2">
              <label className="label">Cliente</label>
              <select className="input mt-1" value={form.cliente_id} onChange={e => setForm({...form, cliente_id: e.target.value})}>
                <option value="">-- Selecionar cliente cadastrado --</option>
                {clientes.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
              <p className="text-[10px] text-fg-disabled mt-1">Se o cliente não estiver cadastrado, cadastre primeiro em Clientes.</p>
            </div>
            <div className="col-span-2">
              <label className="label">Responsável / Usuário</label>
              <select className="input mt-1" value={form.responsavel_id} onChange={e => setForm({...form, responsavel_id: e.target.value})}>
                {funcionarios.map((f: any) => (
                  <option key={f.id} value={f.id}>{f.nome} {f.cargo ? `(${f.cargo})` : ''}</option>
                ))}
              </select>
              <p className="text-[10px] text-fg-disabled mt-1">Já vem preenchido com o seu usuário logado.</p>
            </div>
            <div>
              <label className="label">Valor Total (R$) *</label>
              <input required type="number" min="0" step="0.01" className="input mt-1" value={form.total} onChange={e => setForm({...form, total: e.target.value})} placeholder="0,00" />
            </div>
            <div>
              <label className="label">Forma de Pagamento</label>
              <select className="input mt-1" value={form.forma_pagamento} onChange={e => setForm({...form, forma_pagamento: e.target.value})}>
                <option value="pix">PIX</option>
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao_credito">Cartão de Crédito</option>
                <option value="cartao_debito">Cartão de Débito</option>
                <option value="boleto">Boleto</option>
                <option value="fiado">Fiado</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">Observações</label>
              <textarea className="input mt-1 resize-none" rows={2} value={form.observacoes} onChange={e => setForm({...form, observacoes: e.target.value})} placeholder="Detalhes do serviço, itens incluídos, prazo de entrega..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? '⏳ Criando...' : '✓ Criar Venda / OS'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalClientes({ clientes, onClose, onSave }: { clientes: Cliente[]; onClose: () => void; onSave?: () => void }) {
  const { insert, loading } = useSupabaseMutation('clientes')
  const [erro, setErro] = useState('')
  const [modo, setModo] = useState<'lista' | 'novo'>('lista')
  const [form, setForm] = useState({ nome: '', tipo: 'pf', telefone: '', email: '', cpf_cnpj: '', cidade: '', observacoes: '' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    const result = await insert({
      nome: form.nome,
      tipo: form.tipo,
      telefone: form.telefone || null,
      email: form.email || null,
      cpf_cnpj: form.cpf_cnpj || null,
      cidade: form.cidade || null,
      observacoes: form.observacoes || null,
      total_compras: 0,
      total_gasto: 0,
      ativo: true,
    })

    if (result.error) {
      setErro(`Erro: ${result.error}`)
      return
    }
    setForm({ nome: '', tipo: 'pf', telefone: '', email: '', cpf_cnpj: '', cidade: '', observacoes: '' })
    onSave?.()
    setModo('lista')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between mb-5 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-fg">👥 Clientes</h2>
            {modo === 'lista' && (
              <button onClick={() => setModo('novo')} className="btn-primary text-xs h-7 px-3">+ Novo Cliente</button>
            )}
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>

        {modo === 'lista' ? (
          <div className="overflow-y-auto flex-1">
            {clientes.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-fg-tertiary text-sm mb-3">Nenhum cliente cadastrado</p>
                <button onClick={() => setModo('novo')} className="btn-primary text-xs">Cadastrar primeiro cliente</button>
              </div>
            ) : (
              <div className="space-y-2">
                {clientes.map(c => (
                  <div key={c.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-border-subtle hover:border-border-subtle transition-colors">
                    <div>
                      <p className="text-sm font-medium text-fg">{c.nome}</p>
                      <p className="text-xs text-fg-tertiary mt-0.5">
                        {c.tipo === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                        {c.telefone && ` · ${c.telefone}`}
                        {c.cidade && ` · ${c.cidade}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-emerald-400 font-semibold">R$ {(c.total_gasto || 0).toFixed(2)}</p>
                      <p className="text-[10px] text-fg-disabled">{c.total_compras || 0} compra(s)</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setModo('lista')} className="text-fg-tertiary hover:text-fg-secondary text-sm">← Voltar</button>
              <h3 className="text-sm font-semibold text-fg-secondary">Novo Cliente</h3>
            </div>
            {erro && <div className="mb-3 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">⚠️ {erro}</div>}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Nome Completo *</label>
                  <input required autoFocus className="input mt-1" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: João da Silva" />
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select className="input mt-1" value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                    <option value="pf">Pessoa Física</option>
                    <option value="pj">Pessoa Jurídica</option>
                  </select>
                </div>
                <div>
                  <label className="label">{form.tipo === 'pf' ? 'CPF' : 'CNPJ'}</label>
                  <input className="input mt-1" value={form.cpf_cnpj} onChange={e => setForm({...form, cpf_cnpj: e.target.value})} placeholder={form.tipo === 'pf' ? '000.000.000-00' : '00.000.000/0001-00'} />
                </div>
                <div>
                  <label className="label">Telefone / WhatsApp</label>
                  <input className="input mt-1" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="(00) 00000-0000" />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input mt-1" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="cliente@email.com" />
                </div>
                <div className="col-span-2">
                  <label className="label">Cidade</label>
                  <input className="input mt-1" value={form.cidade} onChange={e => setForm({...form, cidade: e.target.value})} placeholder="Ex: São Paulo" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-subtle">
                <button type="button" onClick={() => setModo('lista')} className="btn-secondary">Cancelar</button>
                <button type="submit" disabled={loading} className="btn-primary">
                  {loading ? '⏳ Salvando...' : '✓ Salvar Cliente'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
