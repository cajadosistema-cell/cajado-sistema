'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { useEmpresaId } from '@/lib/hooks/useEmpresaId'
import { EmptyState } from '@/components/shared/ui'
import { formatCurrency } from '@/lib/utils'

type Financiamento = {
  id: string
  credor: string
  bem_id: string | null
  valor_financiado: number | null
  taxa_juros_anual: number | null
  parcelas_total: number | null
  parcelas_pagas: number
  valor_parcela: number | null
  dia_vencimento: number | null
}

type InvestimentoContrato = {
  id: string
  nome_contrato: string
  instituicao: string
  parcela_atual: number
  parcela_total: number
  valor_mensal: number
  valor_variavel: boolean
  mes_referencia: string
  proximo_vencimento: string | null
  status: string
  data_pagamento: string | null
}

export function TabFinanciamentos() {
  const supabase = createClient()
  const { empresaId } = useEmpresaId()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const FORM_VAZIO = {
    nome_contrato: '', credor: '', valor_financiado: '', taxa_juros_anual: '',
    parcelas_total: '', parcelas_pagas: '0', valor_parcela: '', dia_vencimento: '',
  }
  const [form, setForm] = useState(FORM_VAZIO)
  const [erro, setErro] = useState<string | null>(null)

  const { data: financiamentos, refetch } = useSupabaseQuery<Financiamento>('financiamentos', {
    filters: { empresa_id: empresaId || undefined },
    orderBy: { column: 'criado_em', ascending: false },
    enabled: !!empresaId,
  } as any)

  const { data: contratosInv, refetch: refetchInv } = useSupabaseQuery<InvestimentoContrato>('investimentos_contratos', {
    filters: { empresa_id: empresaId || undefined },
    orderBy: { column: 'proximo_vencimento', ascending: true },
    enabled: !!empresaId,
  } as any)

  // Monta 'AAAA-MM-DD' do PRÓXIMO vencimento a partir do dia informado, com
  // clamp no último dia do mês. Se o dia deste mês já passou, vai para o mês
  // seguinte. Aritmética inteira, sem toISOString (armadilha nº6).
  const proximoVencimentoDoDia = (dia: number): string => {
    const agora = new Date()
    let ano = agora.getFullYear()
    let mes = agora.getMonth() + 1
    if (dia < agora.getDate()) { mes += 1; if (mes > 12) { mes = 1; ano += 1 } }
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0
    const ultimo = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1]
    const d = Math.min(Math.max(dia, 1), ultimo)
    return `${ano}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    // Editar registro ANTIGO continua atualizando `financiamentos`, para não
    // quebrar o que já existe lá.
    if (editId) {
      const payload = {
        credor: form.credor,
        valor_financiado: form.valor_financiado ? parseFloat(form.valor_financiado) : null,
        taxa_juros_anual: form.taxa_juros_anual ? parseFloat(form.taxa_juros_anual) : null,
        parcelas_total: form.parcelas_total ? parseInt(form.parcelas_total) : null,
        parcelas_pagas: parseInt(form.parcelas_pagas) || 0,
        valor_parcela: form.valor_parcela ? parseFloat(form.valor_parcela) : null,
        dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      }
      const { error } = await (supabase.from('financiamentos') as any).update(payload).eq('id', editId)
      if (error) { setErro('Erro ao atualizar: ' + error.message); return }
      setShowForm(false); setEditId(null); refetch(); setForm(FORM_VAZIO)
      return
    }

    // 12/08/2026: cadastro NOVO passa a gravar em `investimentos_contratos`.
    // Motivo: `financiamentos` não tem status por mês, nem próximo vencimento,
    // nem registro de pagamento — o resumo da Elena nunca leu essa tabela e o
    // Sr. Max cadastrou a placa solar aqui e não a viu no resumo.
    // `investimentos_contratos` já tem cadastro → resumo → pagamento →
    // lançamento → saldo funcionando. Uma caixa a menos para o dado se perder.
    if (!empresaId) { setErro('Não identifiquei a empresa. Recarregue a página e tente de novo.'); return }
    const dia = form.dia_vencimento ? parseInt(form.dia_vencimento) : 0
    if (!(dia >= 1 && dia <= 31)) { setErro('Informe o dia do vencimento (1 a 31).'); return }

    const agora = new Date()
    const payloadInv = {
      empresa_id: empresaId,
      nome_contrato: form.nome_contrato.trim(),
      instituicao: form.credor.trim(),
      valor_mensal: form.valor_parcela ? parseFloat(form.valor_parcela) : 0,
      valor_variavel: false,
      parcela_atual: parseInt(form.parcelas_pagas) || 0,
      parcela_total: form.parcelas_total ? parseInt(form.parcelas_total) : null,
      proximo_vencimento: proximoVencimentoDoDia(dia),
      status: 'pendente',
      mes_referencia: `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`,
      valor_financiado: form.valor_financiado ? parseFloat(form.valor_financiado) : null,
      taxa_juros: form.taxa_juros_anual ? parseFloat(form.taxa_juros_anual) : null,
    }
    const { error } = await (supabase.from('investimentos_contratos') as any).insert(payloadInv)
    // Erro NUNCA fecha o formulário calado: o que o Sr. Max digitou fica na tela.
    if (error) { setErro('Erro ao cadastrar: ' + error.message); return }

    setShowForm(false)
    setEditId(null)
    refetchInv()
    setForm(FORM_VAZIO)
  }

  const handleExcluir = async (id: string, credor: string) => {
    if (!confirm(`Tem certeza que deseja excluir o financiamento de "${credor}"?`)) return
    const { error } = await (supabase.from('financiamentos') as any).delete().eq('id', id)
    if (error) { alert('Erro ao excluir financiamento: ' + error.message); return }
    refetch()
  }

  const handleEdit = (financiamento: Financiamento) => {
    setForm({
      nome_contrato: financiamento.credor,
      credor: financiamento.credor,
      valor_financiado: financiamento.valor_financiado ? String(financiamento.valor_financiado) : '',
      taxa_juros_anual: financiamento.taxa_juros_anual ? String(financiamento.taxa_juros_anual) : '',
      parcelas_total: financiamento.parcelas_total ? String(financiamento.parcelas_total) : '',
      parcelas_pagas: String(financiamento.parcelas_pagas),
      valor_parcela: financiamento.valor_parcela ? String(financiamento.valor_parcela) : '',
      dia_vencimento: financiamento.dia_vencimento ? String(financiamento.dia_vencimento) : '',
    })
    setEditId(financiamento.id)
    setShowForm(true)
  }

  // 12/08/2026: este botão dizia "Pagar Parcela ✅" e só somava 1 no contador.
  // Não debita conta, não cria lançamento, não pergunta de onde sai o dinheiro.
  // É a armadilha 12 do projeto — botão que parece mexer em dinheiro e não mexe.
  // Enquanto a seção antiga existir, o rótulo e o aviso dizem a verdade.
  const addParcelaPaga = async (f: Financiamento) => {
    const ok = confirm(
      `Isto só avança o contador de parcelas de "${f.credor}" (${f.parcelas_pagas} → ${f.parcelas_pagas + 1}).\n\n` +
      `NÃO debita conta nenhuma e NÃO lança a saída no financeiro.\n\n` +
      `Para o pagamento sair da conta, cadastre em Contratos de Investimento e diga à Elena que pagou.\n\nContinuar?`
    )
    if (!ok) return
    const { error } = await (supabase.from('financiamentos') as any).update({ parcelas_pagas: f.parcelas_pagas + 1 }).eq('id', f.id)
    if (error) { alert('Erro ao registrar parcela: ' + error.message); return }
    refetch()
  }

  // KPIs
  const saldoDevedorEstimado = financiamentos.reduce((acc, f) => {
    if (!f.valor_parcela || !f.parcelas_total) return acc
    const faltam = Math.max(0, f.parcelas_total - f.parcelas_pagas)
    return acc + (faltam * f.valor_parcela)
  }, 0)

  const saldoDevedorContratos = contratosInv.reduce((acc, c) => {
    if (!c.valor_mensal || !c.parcela_total) return acc
    const faltam = Math.max(0, c.parcela_total - (c.parcela_atual || 0))
    return acc + (faltam * c.valor_mensal)
  }, 0)

  const custoMensalBancos = financiamentos.reduce((acc, f) => acc + (f.valor_parcela || 0), 0)
  const custoMensalContratos = contratosInv.reduce((acc, c) => acc + (c.valor_mensal || 0), 0)

  const custoMensal = custoMensalBancos + custoMensalContratos
  const saldoTotal = saldoDevedorEstimado + saldoDevedorContratos

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-page border border-border-subtle rounded-xl p-4">
          <p className="text-[10px] text-fg-tertiary uppercase tracking-widest mb-1">Custo Mensal (Parcelas)</p>
          <p className="text-2xl font-bold text-red-400">{formatCurrency(custoMensal)}</p>
        </div>
        <div className="bg-page border border-border-subtle rounded-xl p-4">
          <p className="text-[10px] text-fg-tertiary uppercase tracking-widest mb-1">Saldo Devedor Estimado</p>
          <p className="text-2xl font-bold text-fg">{formatCurrency(saldoTotal)}</p>
        </div>
      </div>

      <div className="flex justify-between items-center mt-6">
        <div>
          <h2 className="text-sm font-semibold text-fg">🏦 Financiamentos Bancários</h2>
          {financiamentos.length > 0 && (
            <p className="text-[11px] text-fg-tertiary mt-0.5">
              Seção antiga — não recebe cadastro novo e não aparece no resumo da Elena.
            </p>
          )}
        </div>
        <button onClick={() => {
          if (showForm) {
            setShowForm(false)
            setEditId(null)
            setForm(FORM_VAZIO)
            setErro(null)
          } else {
            setShowForm(true)
          }
        }} className="btn-primary text-xs">
          {showForm ? '✕ Cancelar' : '+ Novo Financiamento'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSalvar} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              {/* 12/08/2026: campo de NOME separado do banco. Antes só existia
                  "Instituição / Banco" e o Sr. Max usava esse campo como nome —
                  foi assim que "PLACA SOLAR-COMPLEMENTO JUREMA" ficou gravado
                  como se fosse um banco. */}
              <label className="label">Nome do financiamento *</label>
              <input className="input mt-1" required value={form.nome_contrato} onChange={e => setForm(f => ({...f, nome_contrato: e.target.value}))} placeholder="Placa Solar, Caminhonete..." />
            </div>
            <div>
              <label className="label">Instituição Financeira / Banco *</label>
              <input className="input mt-1" required value={form.credor} onChange={e => setForm(f => ({...f, credor: e.target.value}))} placeholder="Caixa, Itaú..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Vencimento (Dia)</label><input type="number" max="31" min="1" className="input mt-1" value={form.dia_vencimento} onChange={e => setForm(f => ({...f, dia_vencimento: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Valor Financiado</label><input type="number" step="0.01" className="input mt-1" value={form.valor_financiado} onChange={e => setForm(f => ({...f, valor_financiado: e.target.value}))} /></div>
            <div><label className="label">Valor Parcela</label><input type="number" step="0.01" className="input mt-1" value={form.valor_parcela} onChange={e => setForm(f => ({...f, valor_parcela: e.target.value}))} /></div>
            <div><label className="label">Taxa Juros (% a.a.)</label><input type="number" step="0.01" className="input mt-1" value={form.taxa_juros_anual} onChange={e => setForm(f => ({...f, taxa_juros_anual: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Prazo (Meses)</label><input type="number" className="input mt-1" value={form.parcelas_total} onChange={e => setForm(f => ({...f, parcelas_total: e.target.value}))} /></div>
            <div><label className="label">Parcelas Pagas (Início)</label><input type="number" className="input mt-1" value={form.parcelas_pagas} onChange={e => setForm(f => ({...f, parcelas_pagas: e.target.value}))} /></div>
          </div>
          {erro && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              ⚠️ {erro}
            </div>
          )}
          {!editId && (
            <p className="text-[11px] text-fg-tertiary">
              Será cadastrado em <strong>Contratos de Investimento</strong>, abaixo — é de lá que a Elena
              lê o resumo do mês e recebe o pagamento.
            </p>
          )}
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">
              {editId ? 'Salvar Alterações' : 'Salvar Financiamento'}
            </button>
          </div>
        </form>
      )}

      {financiamentos.length === 0 ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8"><EmptyState message="Nenhum financiamento cadastrado" /></div>
      ) : (
        <div className="space-y-3">
          {financiamentos.map(f => {
             const progresso = f.parcelas_total ? Math.min(100, (f.parcelas_pagas / f.parcelas_total) * 100) : 0
             return (
              <div key={f.id} className="bg-page border border-border-subtle rounded-xl p-5 hover:border-border-subtle transition-colors">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-sm font-bold text-fg flex items-center gap-2">🏦 {f.credor}</h3>
                    {f.dia_vencimento && <p className="text-xs text-fg-tertiary mt-0.5">Vence dia {f.dia_vencimento}</p>}
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <div className="flex gap-2 mb-1">
                      <button onClick={() => handleEdit(f)} className="text-fg-tertiary hover:text-blue-400 transition-colors" title="Editar">✏️</button>
                      <button onClick={() => handleExcluir(f.id, f.credor)} className="text-fg-tertiary hover:text-red-400 transition-colors" title="Excluir">🗑️</button>
                    </div>
                    <p className="text-xs text-fg-tertiary uppercase tracking-widest">Valor Parcela</p>
                    <p className="text-lg font-bold text-red-400">{f.valor_parcela ? formatCurrency(f.valor_parcela) : '—'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div><p className="text-[10px] text-fg-disabled uppercase tracking-widest">Financiado</p><p className="text-sm font-medium">{f.valor_financiado ? formatCurrency(f.valor_financiado) : '—'}</p></div>
                  <div><p className="text-[10px] text-fg-disabled uppercase tracking-widest">Taxa (a.a.)</p><p className="text-sm text-fg-secondary font-medium">{f.taxa_juros_anual ? `${f.taxa_juros_anual}%` : '—'}</p></div>
                  <div>
                    <p className="text-[10px] text-fg-disabled uppercase tracking-widest">Progresso</p>
                    <p className="text-sm font-medium text-emerald-400">{f.parcelas_pagas} de {f.parcelas_total}</p>
                  </div>
                  <div className="flex items-end justify-end">
                    <button onClick={() => addParcelaPaga(f)} title="Só avança o contador — não movimenta dinheiro" className="btn-ghost text-xs border border-border-subtle">+1 parcela</button>
                  </div>
                </div>

                {f.parcelas_total && (
                  <div className="mt-2">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${progresso}%` }} />
                    </div>
                  </div>
                )}
              </div>
             )
          })}
        </div>
      )}

      {/* Seção: Contratos de Investimento (Consórcios, Lotes, etc.) */}
      {contratosInv.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-fg mb-4">📈 Contratos de Investimento (Consórcios, Terrenos, etc.)</h2>
          <div className="space-y-3">
            {contratosInv.map(c => {
               const progresso = c.parcela_total ? Math.min(100, ((c.parcela_atual || 0) / c.parcela_total) * 100) : 0
               return (
                <div key={c.id} className="bg-page border border-border-subtle rounded-xl p-5 hover:border-border-subtle transition-colors">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-fg flex items-center gap-2">📄 {c.nome_contrato}</h3>
                      <p className="text-xs text-fg-tertiary mt-0.5">{c.instituicao}</p>
                      {c.proximo_vencimento && <p className="text-xs text-fg-tertiary mt-0.5">Vence: {c.proximo_vencimento.substring(8, 10)}/{c.proximo_vencimento.substring(5, 7)}/{c.proximo_vencimento.substring(0, 4)}</p>}
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <p className="text-xs text-fg-tertiary uppercase tracking-widest">Valor Mensal</p>
                      <p className="text-lg font-bold text-red-400">{c.valor_mensal ? formatCurrency(c.valor_mensal) : '—'}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-[10px] text-fg-disabled uppercase tracking-widest">Progresso</p>
                      <p className="text-sm font-medium text-emerald-400">
                        {c.parcela_atual || 0} de {c.parcela_total || '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-fg-disabled uppercase tracking-widest">Status</p>
                      <p className="text-sm text-fg-secondary font-medium uppercase">{c.status}</p>
                    </div>
                  </div>

                  {c.parcela_total && (
                    <div className="mt-2">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${progresso}%` }} />
                      </div>
                    </div>
                  )}
                </div>
               )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
