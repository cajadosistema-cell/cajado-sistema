'use client'

import { useState } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, MetricCard, EmptyState, StatusBadge } from '@/components/shared/ui'
import { createClient } from '@/lib/supabase/client'

// ── Tipagens ──────────────────────────────────────────────────
type Conta = {
  id: string
  nome: string
  tipo: 'corrente' | 'poupanca' | 'investimento' | 'cartao_credito' | 'cartao_debito' | 'dinheiro'
  categoria: 'pf' | 'pj'
  saldo_atual: number
  saldo_inicial: number
  ativo: boolean
  cor: string
}

type Lancamento = {
  id: string
  descricao: string
  valor: number
  tipo: 'receita' | 'despesa' | 'investimento' | 'transferencia'
  regime: 'competencia' | 'caixa'
  status: 'automatico' | 'pendente' | 'validado'
  data_competencia: string
  data_caixa: string | null
  parcela_atual: number | null
  total_parcelas: number | null
  conciliado: boolean
  conta_id: string
}

type CategoriaFinanceira = {
  id: string
  nome: string
  tipo: 'receita' | 'despesa' | 'investimento' | 'transferencia'
  cor: string
}

// ── Modais ─────────────────────────────────────────────────────

function ModalConta({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('contas')
  const [form, setForm] = useState({
    nome: '',
    tipo: 'corrente' as Conta['tipo'],
    categoria: 'pj' as Conta['categoria'],
    saldo_inicial: '',
    cor: '#7c5cfc'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const saldo = parseFloat(form.saldo_inicial) || 0
    await insert({
      nome: form.nome,
      tipo: form.tipo,
      categoria: form.categoria,
      saldo_inicial: saldo,
      saldo_atual: saldo,
      ativo: true,
      cor: form.cor
    })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Nova Conta</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome da Conta *</label>
            <input className="input mt-1" required value={form.nome} placeholder="Ex: Nubank PJ, Itaú PF..."
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Classificação</label>
              <select className="input mt-1" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value as Conta['categoria'] }))}>
                <option value="pj">PJ (Empresa)</option>
                <option value="pf">PF (Pessoal)</option>
              </select>
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Conta['tipo'] }))}>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
                <option value="cartao_credito">Cartão de Crédito</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Saldo Atual (R$)</label>
            <input className="input mt-1" type="number" step="0.01" value={form.saldo_inicial} placeholder="0.00"
              onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Criar Conta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalLancamento({
  onClose, onSave, contas, categorias,
}: {
  onClose: () => void
  onSave: () => void
  contas: Conta[]
  categorias: CategoriaFinanceira[]
}) {
  const { insert, loading } = useSupabaseMutation('lancamentos')
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    conta_id: contas[0]?.id ?? '',
    descricao: '',
    valor: '',
    tipo: 'despesa' as Lancamento['tipo'],
    regime: 'caixa' as Lancamento['regime'],
    data_competencia: today,
    categoria_id: '',
    total_parcelas: '1',
    observacoes: '',
  })

  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) return
    const parcelas = parseInt(form.total_parcelas) || 1
    if (parcelas > 1) {
      const supabase = createClient()
      for (let i = 1; i <= parcelas; i++) {
        const data = new Date(form.data_competencia)
        data.setMonth(data.getMonth() + (i - 1))
        await supabase.from('lancamentos').insert({
          conta_id: form.conta_id,
          descricao: `${form.descricao} (${i}/${parcelas})`,
          valor: valor / parcelas,
          tipo: form.tipo,
          regime: form.regime,
          status: 'pendente',
          data_competencia: data.toISOString().split('T')[0],
          categoria_id: form.categoria_id || null,
          parcela_atual: i,
          total_parcelas: parcelas,
        } as any)
      }
    } else {
      await insert({
        conta_id: form.conta_id,
        descricao: form.descricao,
        valor,
        tipo: form.tipo,
        regime: form.regime,
        status: 'pendente',
        data_competencia: form.data_competencia,
        categoria_id: form.categoria_id || null,
        total_parcelas: 1,
      } as any)
    }
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-zinc-100">Novo Lançamento</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-1 bg-zinc-800/50 p-1 rounded-lg">
            {(['despesa', 'receita', 'investimento', 'transferencia'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, tipo: t, categoria_id: '' }))}
                className={cn('py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                  form.tipo === t
                    ? t === 'receita' ? 'bg-emerald-500/20 text-emerald-400'
                      : t === 'despesa' ? 'bg-red-500/20 text-red-400'
                      : t === 'investimento' ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-zinc-700 text-zinc-300'
                    : 'text-zinc-500 hover:text-zinc-300'
                )}>
                {t === 'transferencia' ? 'Transf.' : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Aluguel, Salário..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input mt-1" required type="number" step="0.01" min="0.01"
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="0.00" />
            </div>
            <div>
              <label className="label">Parcelas</label>
              <input className="input mt-1" type="number" min="1" max="60"
                value={form.total_parcelas}
                onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Data Prevista/Realizada *</label>
              <input className="input mt-1" type="date" required value={form.data_competencia}
                onChange={e => setForm(f => ({ ...f, data_competencia: e.target.value }))} />
            </div>
            <div>
              <label className="label">Regime</label>
              <select className="input mt-1" value={form.regime}
                onChange={e => setForm(f => ({ ...f, regime: e.target.value as Lancamento['regime'] }))}>
                <option value="caixa">Caixa (recebido/pago)</option>
                <option value="competencia">Competência (venda/compra)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Conta *</label>
              <select className="input mt-1" required value={form.conta_id}
                onChange={e => setForm(f => ({ ...f, conta_id: e.target.value }))}>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome} ({c.categoria.toUpperCase()})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Categoria</label>
              <select className="input mt-1" value={form.categoria_id}
                onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                <option value="">Sem categoria</option>
                {categoriasFiltradas.map(c => (
                  <option key={c.id} value={c.id}>{c.nome}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
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

// ── Client Component ────────────────────────────────────────────

export default function FinanceiroClient() {
  const [modalLancamento, setModalLancamento] = useState(false)
  const [modalConta, setModalConta] = useState(false)

  const { data: contas, refetch: refetchContas } = useSupabaseQuery<Conta>('contas', { filters: { ativo: true } })
  const { data: categorias } = useSupabaseQuery<CategoriaFinanceira>('categorias_financeiras', { orderBy: { column: 'nome', ascending: true } })
  const { data: lancamentos, refetch: refetchLancamentos } = useSupabaseQuery<Lancamento>('lancamentos', {
    orderBy: { column: 'data_competencia', ascending: false },
    limit: 50 // Limitado para melhor exibição inicial
  })

  const refreshAll = () => {
    refetchContas();
    refetchLancamentos();
  }

  const saldoTotal = contas.reduce((a, c) => a + (c.saldo_atual ?? 0), 0)
  
  const todayStr = new Date().toISOString().substring(0, 10)
  const currentMonthDatePrefix = new Date().toISOString().substring(0, 7)
  
  const lancamentosMes = lancamentos.filter(l => l.data_competencia?.startsWith(currentMonthDatePrefix))
  const receitasMes = lancamentosMes.filter(l => l.tipo === 'receita').reduce((a, l) => a + l.valor, 0)
  const despesasMes = lancamentosMes.filter(l => l.tipo === 'despesa').reduce((a, l) => a + l.valor, 0)
  const resultado = receitasMes - despesasMes

  // Filtrando visão de Previsão de caixa (lançamentos futuros & pendentes)
  const previsoes = lancamentos.filter(l => l.data_competencia > todayStr && l.status !== 'validado').slice(0, 5)
  // Filtrando visão de Conciliação Pendente (lançamentos vencidos não validados ou pendentes)
  const conciliacoes = lancamentos.filter(l => l.data_competencia <= todayStr && l.status !== 'validado').slice(0, 5)

  return (
    <>
      <PageHeader
        title="Financeiro"
        subtitle="Contas PF/PJ · Caixa · Conciliação · Previsão"
      >
        <button className="btn-secondary">Importar extrato</button>
        <button onClick={() => setModalLancamento(true)} className="btn-primary" disabled={contas.length === 0}>+ Lançamento</button>
      </PageHeader>

      {/* Métricas principais idênticas ao Início */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {/* Saldo Total */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(16,185,129,0.15),transparent_70%)]"></div>
          <p className="text-[10px] font-medium text-[#8b98b8] tracking-[0.06em] uppercase mb-2">Saldo total</p>
          <p className="font-['Syne'] text-[22px] font-bold tracking-tight mb-1 text-[#10b981]">{formatCurrency(saldoTotal)}</p>
        </div>

        {/* Receitas */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(124,92,252,0.12),transparent_70%)]"></div>
          <p className="text-[10px] font-medium text-[#8b98b8] tracking-[0.06em] uppercase mb-2">Receitas do mês</p>
          <p className="font-['Syne'] text-[22px] font-bold tracking-tight mb-1 text-[#a78bfa]">{formatCurrency(receitasMes)}</p>
        </div>

        {/* Despesas */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(244,63,94,0.1),transparent_70%)]"></div>
          <p className="text-[10px] font-medium text-[#8b98b8] tracking-[0.06em] uppercase mb-2">Despesas do mês</p>
          <p className="font-['Syne'] text-[22px] font-bold tracking-tight mb-1 text-[#f43f5e]">{formatCurrency(despesasMes)}</p>
        </div>

        {/* Resultado */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5">
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(245,166,35,0.1),transparent_70%)]"></div>
          <p className="text-[10px] font-medium text-[#8b98b8] tracking-[0.06em] uppercase mb-2">Resultado</p>
          <p className={`font-['Syne'] text-[22px] font-bold tracking-tight mb-1 ${resultado >= 0 ? 'text-[#f5a623]' : 'text-[#f43f5e]'}`}>{formatCurrency(resultado)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contas */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Contas</h2>
            <button onClick={() => setModalConta(true)} className="btn-ghost text-xs">+ Conta</button>
          </div>
          {contas.length === 0 ? (
             <EmptyState message="Nenhuma conta cadastrada" />
          ) : (
            <div className="space-y-2">
              {contas.map(conta => (
                <div key={conta.id} className="flex justify-between items-center p-3 rounded-lg border border-white/5 bg-black/20">
                  <div>
                    <div className="flex gap-2 items-center">
                      <h3 className="text-sm font-medium text-zinc-200">{conta.nome}</h3>
                      <StatusBadge status={conta.categoria.toUpperCase()} />
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 capitalize">{conta.tipo.replace('_', ' ')}</p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(conta.saldo_atual)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimos lançamentos */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-5 flex flex-col min-h-[300px] lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Últimos lançamentos (Este Mês)</h2>
            <button className="btn-ghost text-xs">Ver todos</button>
          </div>
          {lancamentosMes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState message="Nenhum lançamento registrado neste mês" />
            </div>
          ) : (
             <div className="space-y-2 flex-1">
               {lancamentosMes.slice(0, 10).map((l: Lancamento) => (
                  <div key={l.id} className="flex justify-between items-center p-3 rounded-lg border border-white/5 bg-black/20">
                    <div className="flex gap-3 items-center">
                       <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${l.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-400' : l.tipo === 'despesa' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                         {l.tipo === 'receita' ? '↓' : l.tipo === 'despesa' ? '↑' : '⇄'}
                       </span>
                       <div>
                         <p className="text-sm font-medium text-zinc-200">{l.descricao}</p>
                         <p className="text-xs text-zinc-500 whitespace-nowrap">{formatDate(l.data_competencia)} • <span className="capitalize">{l.regime}</span></p>
                       </div>
                    </div>
                    <div className="text-right">
                       <p className={`text-sm font-semibold ${l.tipo === 'receita' ? 'text-emerald-400' : l.tipo === 'despesa' ? 'text-red-400' : 'text-zinc-200'}`}>
                         {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                       </p>
                       {l.status === 'pendente' ? (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-500 bg-amber-500/10">Pendente</span>
                       ) : (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-500 bg-emerald-500/10">Validado</span>
                       )}
                    </div>
                  </div>
               ))}
             </div>
          )}
        </div>

        {/* Previsão de caixa */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-5 lg:col-span-2">
          <h2 className="section-title">Previsão de caixa — próximos 30 dias</h2>
          {previsoes.length === 0 ? (
            <EmptyState message="Nenhuma despesa ou receita prevista para o futuro" />
          ) : (
            <div className="space-y-2 mt-4">
              {previsoes.map((l: Lancamento) => (
                <div key={l.id} className="flex justify-between items-center p-3 rounded-lg border border-white/5 bg-black/20">
                  <div className="flex gap-3 items-center">
                      <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${l.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-400' : l.tipo === 'despesa' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                        {l.tipo === 'receita' ? '↓' : l.tipo === 'despesa' ? '↑' : '⇄'}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-zinc-200">{l.descricao}</p>
                        <p className="text-xs text-zinc-500 whitespace-nowrap">Vence em: {formatDate(l.data_competencia)}</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className={`text-sm font-semibold ${l.tipo === 'receita' ? 'text-emerald-400' : l.tipo === 'despesa' ? 'text-red-400' : 'text-zinc-200'}`}>
                        {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                      </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conciliação pendente */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-5">
          <h2 className="section-title">Conciliação pendente</h2>
          {conciliacoes.length === 0 ? (
            <EmptyState message="Nada pendente" />
          ) : (
             <div className="space-y-2 mt-4">
              {conciliacoes.map((l: Lancamento) => (
                <div key={l.id} className="p-3 rounded-lg border border-white/5 bg-black/20">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-zinc-200">{l.descricao}</p>
                    <p className={`text-sm font-semibold ${l.tipo === 'receita' ? 'text-emerald-400' : l.tipo === 'despesa' ? 'text-red-400' : 'text-zinc-200'}`}>
                      {formatCurrency(l.valor)}
                    </p>
                  </div>
                  <p className="text-xs text-amber-500 mb-3">Venceu: {formatDate(l.data_competencia)}</p>
                  <button className="w-full text-xs font-semibold px-3 py-1.5 rounded-md border border-zinc-700 hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all">
                    ✓ Confirmar Pgto
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recorrências */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Recorrências ativas</h2>
            <button className="btn-ghost text-xs">+ Nova</button>
          </div>
          <EmptyState message="Nenhuma recorrência configurada" />
        </div>

        {/* Receitas vs Despesas (Placeholder visual) */}
        <div className="bg-[#111827] border border-white/5 rounded-xl p-5 lg:col-span-2">
          <h2 className="section-title">Receitas vs Despesas — últimos 6 meses</h2>
          <div className="h-32 flex items-end justify-between px-6 opacity-30 pointer-events-none mt-6 border-b border-zinc-800 pb-2">
            {[40, 60, 30, 80, 50, 90].map((h, i) => (
               <div key={i} className="w-8 flex gap-1 items-end h-full">
                  <div className="w-1/2 bg-emerald-500 rounded-t-sm" style={{ height: `${h}%` }}></div>
                  <div className="w-1/2 bg-red-500 rounded-t-sm" style={{ height: `${h * 0.7}%` }}></div>
               </div>
            ))}
          </div>
          <p className="text-center text-xs text-zinc-600 mt-3 font-medium tracking-wide">Módulo de IA conectando dados...</p>
        </div>
      </div>

      {modalLancamento && (
        <ModalLancamento
          contas={contas}
          categorias={categorias}
          onClose={() => setModalLancamento(false)}
          onSave={refreshAll}
        />
      )}

      {modalConta && (
        <ModalConta
          onClose={() => setModalConta(false)}
          onSave={refreshAll}
        />
      )}
    </>
  )
}
