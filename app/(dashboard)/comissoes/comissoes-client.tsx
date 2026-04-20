'use client'

import { PageHeader, MetricCard } from '@/components/shared/ui'
import React, { useState } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'

// Tipo do banco Supabase
type Parceiro = {
  id: string
  nome: string
  telefone: string
  comissao_percentual: number
  total_indicacoes: number
  total_convertidas: number
  total_comissao: number
  meta_mensal: number | null
}

const motivoLabel: Record<string, string> = {
  servico_nao_oferecido: 'Serviço não oferecido',
  deixou_pra_depois:     'Deixou pra depois',
  preco:                 'Preço',
  concorrente:           'Concorrente',
  sem_resposta:          'Sem resposta',
  outro:                 'Outro',
}

export default function ComissoesClient() {
  const { data: parceiros, refetch: refetchParceiros } = useSupabaseQuery<Parceiro>('parceiros')
  
  const [modalPagamento, setModalPagamento] = useState(false)
  const [modalParceiro, setModalParceiro] = useState(false)

  // Cálculos Básicos
  const parceirosAtivos = parceiros.length
  // Exemplo de métrica mockada pendente e paga para o gráfico, 
  // caso a lógica no banco ainda não salve individualmente o pagamento 
  // podemos mostrar a soma das comissões atuais como Pendente:
  const comissoesPendentesValor = parceiros.reduce((acc, p) => acc + (p.total_comissao ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="Parceiros e Comissões"
        subtitle="Comissões automáticas · Motivos de perda · Análise de conversão"
      >
        <button onClick={() => setModalParceiro(true)} className="btn-secondary text-xs">+ Parceiro</button>
        <button onClick={() => setModalPagamento(true)} className="btn-primary">Registrar pagamento</button>
      </PageHeader>

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <MetricCard label="Comissões pendentes (Total em aberto)" value={`R$ ${comissoesPendentesValor.toFixed(2)}`} />
        <MetricCard label="Comissões em histórico (Demonstração)" value="R$ 1.850,00" />
        <MetricCard label="Parceiros na base" value={parceirosAtivos.toString()} />
        <MetricCard label="Taxa de conversão (Geral)" value="28%" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Comissões geradas */}
        <div className="card lg:col-span-2 overflow-x-auto">
          <div className="flex items-center justify-between mb-4 min-w-[500px]">
            <h2 className="section-title mb-0">Comissões (Parceiros e Acúmulos)</h2>
          </div>
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="table-header">Parceiro</th>
                <th className="table-header">Contato</th>
                <th className="table-header">% Recorrente</th>
                <th className="table-header w-24">Vendas</th>
                <th className="table-header">Acumulado (Pendente)</th>
              </tr>
            </thead>
            <tbody>
              {parceiros.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-zinc-500 text-sm">Nenhum parceiro cadastrado.</td></tr>
              ) : (
                parceiros.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                    <td className="py-3 text-sm text-zinc-200 font-medium">{p.nome}</td>
                    <td className="py-3 text-xs text-zinc-500">{p.telefone}</td>
                    <td className="py-3 text-sm">{p.comissao_percentual}%</td>
                    <td className="py-3 text-sm font-semibold">{p.total_convertidas || 0}</td>
                    <td className="py-3 text-sm font-semibold text-emerald-400">R$ {(p.total_comissao || 0).toFixed(2)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Ranking de parceiros */}
        <div className="card max-h-[350px] overflow-y-auto">
          <h2 className="section-title">Ranking de parceiros</h2>
          <div className="space-y-1 mt-4">
            {[...parceiros].sort((a,b) => (b.total_convertidas || 0) - (a.total_convertidas || 0)).map((p,i) => (
              <div key={p.id} className="flex justify-between items-center py-2 border-b border-zinc-800/30 last:border-0 hover:bg-zinc-800/20 rounded px-2 transition-colors">
                <div>
                  <span className="text-xs text-amber-500 font-bold w-5 inline-block">{i+1}º</span>
                  <span className="text-sm text-zinc-200">{p.nome}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-400">R$ {(p.total_comissao||0).toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-zinc-500">{p.total_convertidas || 0} conversões</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Análise de perdas */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Estatísticas Perdas de Leads</h2>
          </div>
          <div className="space-y-3">
            {Object.entries(motivoLabel).map(([key, label]) => {
              const mockValues: Record<string, number> = {
                preco: 32, concorrente: 18, deixou_pra_depois: 15, sem_resposta: 25, servico_nao_oferecido: 5, outro: 5
              }
              const val = mockValues[key] || 0
              return (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm text-zinc-400">{label}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${val}%` }} />
                    </div>
                    <span className="text-xs text-zinc-500 w-6 text-right">{val}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Taxa de conversão por origem */}
        <div className="card">
          <h2 className="section-title">Conversão por Origem Visual</h2>
          <div className="space-y-3">
            {[
              { label: 'Indicação direta', total: 45, fechados: 25 },
              { label: 'Parceiro', total: 30, fechados: 18 },
              { label: 'Instagram', total: 60, fechados: 12 },
              { label: 'WhatsApp orgânico', total: 120, fechados: 40 },
              { label: 'Tráfego pago', total: 200, fechados: 35 },
            ].map(item => {
              const pct = item.total > 0 ? Math.round((item.fechados / item.total) * 100) : 0
              return (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-400">{item.label}</span>
                    <span className="text-xs text-zinc-500">{item.fechados}/{item.total} · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {modalParceiro && <ModalParceiro onClose={() => setModalParceiro(false)} onRefresh={refetchParceiros} />}
      {modalPagamento && <ModalPagamento parceiros={parceiros} onClose={() => setModalPagamento(false)} onRefresh={refetchParceiros} />}
    </div>
  )
}

// ── Modais Locais ────────────────────────────────────────────────────────────

function ModalParceiro({ onClose, onRefresh }: { onClose: () => void, onRefresh: () => void }) {
  const { insert, loading } = useSupabaseMutation('parceiros')
  const [form, setForm] = useState({ nome: '', telefone: '', comissao_percentual: '10' })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await insert({
      nome: form.nome,
      telefone: form.telefone,
      comissao_percentual: Number(form.comissao_percentual),
    })
    onRefresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Adicionar Parceiro</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Nome da Autoescola / Parceiro</label>
            <input required autoFocus className="input mt-1" value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Ex: Autoescola Líder" />
          </div>
          <div>
            <label className="label">Telefone WhatsApp</label>
            <input required className="input mt-1" value={form.telefone} onChange={e => setForm({...form, telefone: e.target.value})} placeholder="11 90000-0000" />
          </div>
          <div>
            <label className="label">Comissão (% Percentual)</label>
            <input required type="number" min="1" max="100" className="input mt-1" value={form.comissao_percentual} onChange={e => setForm({...form, comissao_percentual: e.target.value})} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary">{loading ? 'Salvando...' : 'Adicionar'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalPagamento({ parceiros, onClose, onRefresh }: { parceiros: Parceiro[], onClose: () => void, onRefresh: () => void }) {
  const { update, loading } = useSupabaseMutation('parceiros')
  const [parceiroId, setParceiroId] = useState('')
  const [valor, setValor] = useState('')

  const parceiroInfo = parceiros.find(p => p.id === parceiroId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!parceiroId || !valor || !parceiroInfo) return
    const valorPago = parseFloat(valor.replace(',', '.'))
    if (isNaN(valorPago)) return

    // Como é um MVP para dar baixa na comissão, subtraímos do acumulado
    const novoAcumulado = Math.max(0, (parceiroInfo.total_comissao ?? 0) - valorPago)
    await update(parceiroId, { total_comissao: novoAcumulado })
    
    onRefresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Registrar Pagamento de Comissão</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Parceiro a receber</label>
            <select required className="input mt-1" value={parceiroId} onChange={e => setParceiroId(e.target.value)}>
              <option value="">Selecione um parceiro</option>
              {parceiros.map(p => (
                <option key={p.id} value={p.id}>{p.nome} (Acumulado: R$ {p.total_comissao?.toFixed(2) || '0.00'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Valor Pago (R$)</label>
            <input 
              required className="input mt-1" 
              placeholder="Ex: 150.00" 
              value={valor} 
              onChange={e => setValor(e.target.value)} 
            />
            <p className="text-[10px] text-zinc-500 mt-1">Este valor será deduzido do acumulado do parceiro.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={loading} className="btn-primary" style={{ backgroundColor: '#22c55e', color: '#fff', borderColor: '#22c55e'}}>
              {loading ? 'Liquidando...' : 'Liquidar Fatura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
