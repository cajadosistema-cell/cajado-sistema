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

type ParceiroServico = {
  id: string
  parceiro_id: string
  descricao: string
  valor_bruto: number
  porcentagem: number
  comissao: number
  data_criacao: string
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
  const [parceiroSelecionado, setParceiroSelecionado] = useState<Parceiro | null>(null)


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
              <tr className="border-b border-border-subtle">
                <th className="table-header">Parceiro</th>
                <th className="table-header">Contato</th>
                <th className="table-header">% Recorrente</th>
                <th className="table-header w-24">Vendas</th>
                <th className="table-header">Acumulado (Pendente)</th>
              </tr>
            </thead>
            <tbody>
              {parceiros.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-fg-tertiary text-sm">Nenhum parceiro cadastrado.</td></tr>
              ) : (
                parceiros.map((p) => (
                  <tr key={p.id} className="border-b border-border-subtle/50 hover:bg-muted/20 transition-colors group">
                    <td className="py-3 text-sm text-fg font-medium">{p.nome}</td>
                    <td className="py-3 text-xs text-fg-tertiary">{p.telefone}</td>
                    <td className="py-3 text-sm">{p.comissao_percentual}%</td>
                    <td className="py-3 text-sm font-semibold">{p.total_convertidas || 0}</td>
                    <td className="py-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-emerald-400">R$ {(p.total_comissao || 0).toFixed(2)}</span>
                      <button 
                        onClick={() => setParceiroSelecionado(p)}
                        className="btn-ghost text-xs border border-white/10 hover:border-white/20 transition-all bg-white/5"
                      >
                        + Serviços
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          <p className="text-[10px] text-fg-tertiary mt-2">Dica: Clique em "+ Serviços" para gerenciar as vendas trazidas pelo parceiro e gerar as comissões.</p>
        </div>

        {/* Ranking de parceiros */}
        <div className="card max-h-[350px] overflow-y-auto">
          <h2 className="section-title">Ranking de parceiros</h2>
          <div className="space-y-1 mt-4">
            {[...parceiros].sort((a,b) => (b.total_convertidas || 0) - (a.total_convertidas || 0)).map((p,i) => (
              <div key={p.id} className="flex justify-between items-center py-2 border-b border-border-subtle/30 last:border-0 hover:bg-muted/20 rounded px-2 transition-colors">
                <div>
                  <span className="text-xs text-amber-500 font-bold w-5 inline-block">{i+1}º</span>
                  <span className="text-sm text-fg">{p.nome}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-400">R$ {(p.total_comissao||0).toLocaleString('pt-BR')}</p>
                  <p className="text-[10px] text-fg-tertiary">{p.total_convertidas || 0} conversões</p>
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
                  <span className="text-sm text-fg-secondary">{label}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${val}%` }} />
                    </div>
                    <span className="text-xs text-fg-tertiary w-6 text-right">{val}%</span>
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
                    <span className="text-sm text-fg-secondary">{item.label}</span>
                    <span className="text-xs text-fg-tertiary">{item.fechados}/{item.total} · {pct}%</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
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
      {parceiroSelecionado && (
        <ModalGerenciarServicos 
          parceiro={parceiroSelecionado} 
          onClose={() => setParceiroSelecionado(null)} 
          onRefresh={refetchParceiros} 
        />
      )}
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
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-fg mb-4">Adicionar Parceiro</h2>
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
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <h2 className="text-lg font-semibold text-fg mb-4">Registrar Pagamento de Comissão</h2>
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
            <p className="text-[10px] text-fg-tertiary mt-1">Este valor será deduzido do acumulado do parceiro.</p>
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

function ModalGerenciarServicos({ parceiro, onClose, onRefresh }: { parceiro: Parceiro, onClose: () => void, onRefresh: () => void }) {
  const { data: servicos, refetch } = useSupabaseQuery<ParceiroServico>('parceiro_servicos', {
    filter: { column: 'parceiro_id', value: parceiro.id }
  })
  const { insert: insertServico, loading: loadingServico } = useSupabaseMutation('parceiro_servicos')
  const { update: updateParceiro } = useSupabaseMutation('parceiros')

  const [form, setForm] = useState({
    descricao: '',
    valor_bruto: '',
    porcentagem: parceiro.comissao_percentual.toString()
  })
  const [erro, setErro] = useState('')

  const valorBrutoNum = parseFloat(form.valor_bruto.replace(',', '.')) || 0
  const porcentagemNum = parseFloat(form.porcentagem.replace(',', '.')) || 0
  const comissaoCalculada = valorBrutoNum * (porcentagemNum / 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    
    if (valorBrutoNum <= 0 || porcentagemNum <= 0) {
      setErro('Informe um valor bruto e porcentagem válidos.')
      return
    }

    const { error: err1 } = await insertServico({
      parceiro_id: parceiro.id,
      descricao: form.descricao,
      valor_bruto: valorBrutoNum,
      porcentagem: porcentagemNum,
      comissao: comissaoCalculada,
      data_criacao: new Date().toISOString()
    })

    if (err1) {
      if (err1.message.includes('does not exist')) {
        setErro('⚠️ A tabela de serviços não existe no banco. Por favor, execute o SQL de migração no Supabase.')
      } else {
        setErro(`Erro: ${err1.message}`)
      }
      return
    }

    // Atualiza o total do parceiro no banco
    const novoTotalConvertidas = (parceiro.total_convertidas || 0) + 1
    const novoTotalComissao = (parceiro.total_comissao || 0) + comissaoCalculada
    
    await updateParceiro(parceiro.id, {
      total_convertidas: novoTotalConvertidas,
      total_comissao: novoTotalComissao
    })

    setForm({ descricao: '', valor_bruto: '', porcentagem: parceiro.comissao_percentual.toString() })
    refetch()
    onRefresh()
  }

  const valorTotalAcumulado = servicos.reduce((acc, s) => acc + (s.comissao || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle bg-surface/50">
          <div>
            <h2 className="text-lg font-semibold text-fg">Serviços e Vendas do Parceiro</h2>
            <p className="text-sm text-fg-tertiary">Gerenciando: <span className="font-medium text-amber-400">{parceiro.nome}</span></p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-2xl leading-none">×</button>
        </div>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-[450px]">
          {/* Formulário Novo Serviço */}
          <div className="w-full md:w-[45%] p-5 border-r border-border-subtle bg-surface/30 overflow-y-auto">
            <h3 className="text-sm font-semibold mb-4 text-fg">Adicionar Novo Serviço</h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">Descrição do Serviço / Cliente</label>
                <input required className="input mt-1 text-sm" placeholder="Ex: Indicação do Cliente João"
                  value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Valor Bruto (R$)</label>
                  <input required type="number" step="0.01" className="input mt-1 text-sm" placeholder="Ex: 1500.00"
                    value={form.valor_bruto} onChange={e => setForm({ ...form, valor_bruto: e.target.value })} />
                </div>
                <div>
                  <label className="label">Porcentagem (%)</label>
                  <input required type="number" step="0.01" className="input mt-1 text-sm"
                    value={form.porcentagem} onChange={e => setForm({ ...form, porcentagem: e.target.value })} />
                </div>
              </div>

              <div className="p-4 bg-black/40 border border-border-subtle rounded-xl flex items-center justify-between mt-6">
                <div>
                  <span className="text-[10px] text-fg-tertiary font-bold uppercase tracking-wider block">Comissão a Gerar</span>
                  <span className="text-xs text-fg-disabled mt-0.5 block">{valorBrutoNum > 0 ? `${form.porcentagem}% de R$ ${valorBrutoNum.toFixed(2)}` : 'Calculado automaticamente'}</span>
                </div>
                <span className="text-xl font-bold text-emerald-400">R$ {comissaoCalculada.toFixed(2)}</span>
              </div>

              {erro && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-400 mt-4">
                  {erro}
                </div>
              )}

              <button type="submit" disabled={loadingServico} className="btn-primary w-full mt-4">
                {loadingServico ? 'Salvando...' : '+ Inserir Serviço'}
              </button>
            </form>
          </div>

          {/* Histórico de Serviços */}
          <div className="w-full md:w-[55%] flex flex-col overflow-hidden bg-page">
            <div className="p-5 border-b border-border-subtle flex justify-between items-center bg-surface/50">
              <h3 className="text-sm font-semibold text-fg flex items-center gap-2">
                Histórico de Serviços
                <span className="bg-white/10 text-fg-secondary text-[10px] py-0.5 px-2 rounded-full">{servicos.length}</span>
              </h3>
              <div className="text-right">
                <span className="text-[10px] text-fg-tertiary block mb-0.5">Total Acumulado (Histórico)</span>
                <span className="text-sm font-bold text-emerald-400">R$ {valorTotalAcumulado.toFixed(2)}</span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-black/20">
              {servicos.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3 opacity-30">📂</div>
                  <h4 className="text-sm font-medium text-fg mb-1">Nenhum serviço registrado</h4>
                  <p className="text-xs text-fg-tertiary max-w-[200px] mx-auto">Os serviços registrados para este parceiro aparecerão aqui.</p>
                </div>
              ) : (
                servicos.map(s => (
                  <div key={s.id} className="p-3 rounded-xl border border-white/5 bg-surface hover:bg-white/10 transition-colors">
                    <p className="text-sm font-medium text-fg mb-2">{s.descricao}</p>
                    <div className="flex items-end justify-between bg-black/40 p-2.5 rounded-lg border border-white/5">
                      <div className="text-xs text-fg-tertiary space-y-1.5 w-1/2">
                        <p className="flex justify-between gap-4"><span>Valor Bruto:</span> <span className="text-fg-secondary font-medium">R$ {(s.valor_bruto||0).toFixed(2)}</span></p>
                        <p className="flex justify-between gap-4"><span>Porcentagem:</span> <span className="text-amber-400 font-medium">{(s.porcentagem||0)}%</span></p>
                      </div>
                      <div className="text-right pl-4 border-l border-white/10">
                        <span className="text-[9px] uppercase text-fg-tertiary font-bold tracking-wider block mb-1">Comissão Gerada</span>
                        <span className="text-sm font-bold text-emerald-400">+ R$ {(s.comissao||0).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
