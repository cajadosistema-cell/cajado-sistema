'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { useEmpresaId } from '@/lib/hooks/useEmpresaId'
import { EmptyState } from '@/components/shared/ui'
import { formatCurrency, cn, hojeLocal, mesLocal } from '@/lib/utils'
import { exportCSV } from '@/lib/export-utils'
import { resolverMesRefPendente, calcularParcelasEmAberto, proximasParcelas, vencimentoNominal, MesRefResultado, ParcelaEmAberto, CalculoParcelas } from '@/lib/utils/patrimonio-pagamentos'

type Imovel = {
  id: string
  titulo: string
  endereco: string | null
  tipo_imovel: 'residencial' | 'comercial' | 'terreno' | 'galpao'
  area_m2: number | null
  quartos: number | null
  vagas: number | null
  valor_compra: number | null
  valor_mercado: number | null
  status: 'alugado' | 'disponivel' | 'em_reforma' | 'vendido'
  construtora: string | null
  unidade: string | null
  valor_total_contrato: number | null
  valor_parcela: number | null
  parcelas_total: number | null
  parcelas_pagas: number | null
  indexador: string | null
  data_aquisicao: string | null
  dia_vencimento: number | null
  periodicidade?: 'mensal' | 'bimestral' | 'trimestral' | 'quadrimestral' | 'semestral' | 'anual' | null
  proximo_vencimento?: string | null
  categoria_financeira: string | null
  taxa_juros_anual: number | null
  is_investimento?: boolean
  observacoes?: string | null
}

const STATUS_CONFIG = {
  alugado:    { label: 'Alugado',     color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  disponivel: { label: 'Disponível',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  em_reforma: { label: 'Em Reforma',  color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  vendido:    { label: 'Vendido',     color: 'text-fg-secondary bg-muted border-border-subtle' },
}

const FORM_INICIAL = {
  titulo: '', endereco: '', tipo_imovel: 'residencial' as Imovel['tipo_imovel'],
  area_m2: '', quartos: '', vagas: '', valor_compra: '', valor_mercado: '',
  status: 'disponivel' as Imovel['status'], construtora: '', unidade: '',
  valor_total_contrato: '', valor_parcela: '', parcelas_total: '',
  parcelas_pagas: '0', indexador: '', data_aquisicao: '', proximo_vencimento: '',
  dia_vencimento: '', periodicidade: 'mensal', categoria_financeira: 'Financiamento Imobiliário',
  taxa_juros_anual: '', is_investimento: false, observacoes: '',
}

// ── Modal Análise de Quitação ────────────────────────────────
function ModalAnalisarQuitacao({ item, onClose }: {
  item: { titulo: string; valor_parcela: number | null; parcelas_total: number | null; parcelas_pagas: number | null; taxa_juros_anual: number | null; indexador?: string | null }
  onClose: () => void
}) {
  const [cdi, setCdi] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Busca CDI atual via API pública do Banco Central
  useState(() => {
    fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json')
      .then(r => r.json())
      .then(d => { setCdi(parseFloat(d[0]?.valor ?? '10.5')); setLoading(false) })
      .catch(() => { setCdi(10.5); setLoading(false) }) // fallback CDI 10.5%
  })

  const pt = item.parcelas_total ?? 0
  const pp = item.parcelas_pagas ?? 0
  const faltam = pt - pp
  const valParc = item.valor_parcela ?? 0
  const saldoApprox = faltam * valParc
  const taxa = item.taxa_juros_anual
  const jurosEstimados = taxa ? saldoApprox - (saldoApprox / (1 + taxa / 100)) : null

  const recomendacao = () => {
    if (!taxa || !cdi) return null
    if (taxa > cdi) return {
      icone: '🟢', cor: 'text-emerald-400',
      texto: `Sua taxa (${taxa}% a.a.) está acima do CDI atual (${cdi.toFixed(2)}% a.a.). Vale a pena quitar antecipado!`,
      acao: 'Quitar o quanto antes — você paga mais de juros do que ganharia investindo.'
    }
    return {
      icone: '🟡', cor: 'text-amber-400',
      texto: `Sua taxa (${taxa}% a.a.) está abaixo do CDI atual (${cdi.toFixed(2)}% a.a.).`,
      acao: 'Pode valer mais investir o dinheiro da quitação do que pagar antecipado.'
    }
  }

  const rec = recomendacao()

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-semibold text-fg">📈 Análise de Quitação</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">{item.titulo}</p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border-subtle rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">📦 Parcelas restantes</p>
              <p className="text-lg font-bold text-fg">{faltam}</p>
            </div>
            <div className="bg-surface border border-border-subtle rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">💰 Saldo estimado</p>
              <p className="text-lg font-bold text-red-400">
                {faltam > 0 && valParc > 0 ? `R$ ${saldoApprox.toLocaleString('pt-BR', {minimumFractionDigits:2})}` : '—'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface border border-border-subtle rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">🏦 CDI Atual (BACEN)</p>
              <p className="text-lg font-bold text-blue-400">
                {loading ? '⏳...' : `${cdi?.toFixed(2)}% a.a.`}
              </p>
            </div>
            <div className="bg-surface border border-border-subtle rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">📊 Taxa Financiamento</p>
              <p className="text-lg font-bold text-amber-400">
                {taxa ? `${taxa}% a.a.` : 'Não informado'}
              </p>
            </div>
          </div>

          {jurosEstimados && jurosEstimados > 0 && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3">
              <p className="text-[10px] text-fg-disabled uppercase">🔥 Juros estimados ainda a pagar</p>
              <p className="text-sm font-bold text-red-400">
                R$ {jurosEstimados.toLocaleString('pt-BR', {minimumFractionDigits:2})}
              </p>
              <p className="text-[10px] text-fg-disabled mt-1">Cálculo aproximado baseado na taxa anual e saldo devedor estimado</p>
            </div>
          )}

          {item.indexador && (
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300">
              <p>📌 Indexador: <strong>{item.indexador}</strong> — o valor das parcelas pode variar mensalmente.</p>
            </div>
          )}

          {rec ? (
            <div className={`rounded-xl p-4 border ${ rec.icone === '🟢' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
              <p className={`text-sm font-bold mb-1 ${rec.cor}`}>{rec.icone} {rec.texto}</p>
              <p className="text-xs text-fg-secondary">{rec.acao}</p>
            </div>
          ) : !taxa ? (
            <div className="bg-muted rounded-xl p-3 text-xs text-fg-tertiary">
              ⚠️ Taxa de juros não informada. Edite o item e preencha a taxa para obter a análise completa.
            </div>
          ) : null}
        </div>

        <button onClick={onClose} className="btn-secondary w-full mt-5">Fechar</button>
      </div>
    </div>
  )
}

// ── Modal Provisionar Parcela no Financeiro ───────────────────────
// ATENÇÃO: este modal NÃO paga nada. Ele só cria um lançamento PENDENTE
// em regime de competência, para a parcela aparecer no fluxo do mês.
// Quem paga de verdade (debita conta + marca boleto) é o ModalPagarBoleto.
function ModalLancarParcela({ imovel, onClose, onLancado }: {
  imovel: Imovel
  onClose: () => void
  onLancado: () => void
}) {
  const supabase = createClient()
  const [contas, setContas] = useState<{id:string;nome:string;tipo:string}[]>([])
  const hoje = new Date()
  const diaVenc = imovel.dia_vencimento || 10
  const dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc)
  const dataVencStr = hojeLocal(dataVenc)
  const proxParcela = (imovel.parcelas_pagas ?? 0) + 1

  const [form, setForm] = useState({
    conta_id: '',
    valor: String(imovel.valor_parcela || ''),
    descricao: `Parcela ${proxParcela}/${imovel.parcelas_total ?? '?'} – ${imovel.titulo}`,
    data_competencia: dataVencStr,
    categoria_financeira: imovel.categoria_financeira || 'Financiamento Imobiliário',
  })
  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'erro'>('idle')
  const [msg, setMsg] = useState('')

  useState(() => {
    supabase.from('contas').select('id,nome,tipo').eq('ativo', true).then(({ data }) => {
      if (data) setContas(data as any)
    })
  })

  const handleLancar = async () => {
    if (!form.conta_id) { setMsg('❗ Selecione uma conta'); return }
    setStatus('loading')
    try {
      // 1. Busca ou cria categoria
      let catId: string | null = null
      const { data: cats } = await (supabase
        .from('categorias_financeiras') as any)
        .select('id').eq('nome', form.categoria_financeira).maybeSingle()
      if (cats?.id) {
        catId = cats.id
      } else {
        const { data: novaCat } = await (supabase.from('categorias_financeiras') as any)
          .insert({ nome: form.categoria_financeira, tipo: 'despesa', cor: '#F59E0B' })
          .select('id').single()
        catId = novaCat?.id ?? null
      }

      // 2. Cria o lançamento
      const { error } = await (supabase.from('lancamentos') as any).insert({
        conta_id: form.conta_id,
        descricao: form.descricao,
        valor: parseFloat(form.valor),
        tipo: 'despesa',
        regime: 'competencia',
        status: 'pendente',
        data_competencia: form.data_competencia,
        categoria_id: catId,
        parcela_atual: proxParcela,
        total_parcelas: imovel.parcelas_total,
        observacoes: `Imóvel: ${imovel.titulo} | Indexador: ${imovel.indexador || '-'}`,
      })
      if (error) throw new Error(error.message)

      // 3. NÃO incrementa parcelas_pagas.
      //    Provisionar é previsão de saída, não pagamento. O incremento aqui
      //    era o que fazia a parcela "andar sozinha" a cada clique repetido
      //    (caso Sítio Vida: 3 cliques = 3 parcelas avançadas sem pagamento).
      //    Quem avança a parcela é o pagamento efetivo (ModalPagarBoleto).

      setStatus('ok')
      setMsg(`✅ Parcela ${proxParcela} provisionada no Financeiro (previsão). Nenhum valor foi debitado — para pagar de verdade use "Pagar Boleto".`)
      setTimeout(() => { onLancado(); onClose() }, 1500)
    } catch (err: any) {
      setStatus('erro')
      setMsg(`❌ ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-semibold text-fg">🗓️ Provisionar Parcela no Financeiro</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">{imovel.titulo}</p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        <div className="space-y-3">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-3 text-xs text-blue-300">
            <p>📊 Parcela nº <strong>{proxParcela}</strong> de {imovel.parcelas_total ?? '?'} &nbsp;·&nbsp; Vencimento: <strong>dia {diaVenc}</strong></p>
            {imovel.indexador && <p className="mt-1">📌 Indexador: {imovel.indexador}</p>}
          </div>

          {/* Explicação do que este botão faz — o Sr. Max confundia este fluxo
              com o pagamento real, clicava várias vezes e a parcela avançava. */}
          <div className="bg-surface border border-border-subtle rounded-xl p-3 text-xs space-y-2">
            <div>
              <p className="text-fg font-semibold mb-1">🗓️ O que este botão faz</p>
              <ul className="text-fg-secondary space-y-0.5 list-disc list-inside">
                <li>Cria uma <strong>previsão de saída</strong> desta parcela no Financeiro</li>
                <li>Ela passa a aparecer no fluxo do mês como pendente</li>
                <li>Serve para enxergar o compromisso antes de pagar</li>
              </ul>
            </div>
            <div>
              <p className="text-amber-300 font-semibold mb-1">⚠️ O que ele NÃO faz</p>
              <ul className="text-fg-secondary space-y-0.5 list-disc list-inside">
                <li>Não tira dinheiro de nenhuma conta</li>
                <li>Não marca a parcela como paga</li>
                <li>Não avança o contador de parcelas</li>
              </ul>
            </div>
            <p className="text-emerald-400 pt-1 border-t border-border-subtle">
              💰 <strong>Já pagou?</strong> Feche aqui e use <strong>Pagar Boleto</strong> — esse debita a conta, registra o pagamento e avança a parcela.
            </p>
          </div>

          <div>
            <label className="label">Valor da parcela (R$)</label>
            <input type="number" step="0.01" className="input mt-1" value={form.valor}
              onChange={e => setForm(f => ({...f, valor: e.target.value}))} />
          </div>

          <div>
            <label className="label">Data de vencimento</label>
            <input type="date" className="input mt-1" value={form.data_competencia}
              onChange={e => setForm(f => ({...f, data_competencia: e.target.value}))} />
          </div>

          <div>
            <label className="label">Conta para débito *</label>
            <select className="input mt-1" value={form.conta_id}
              onChange={e => setForm(f => ({...f, conta_id: e.target.value}))}>
              <option value="">Selecione a conta...</option>
              {contas.map(c => <option key={c.id} value={c.id}>{c.nome} ({c.tipo})</option>)}
            </select>
          </div>

          <div>
            <label className="label">Categoria financeira</label>
            <input className="input mt-1" value={form.categoria_financeira}
              onChange={e => setForm(f => ({...f, categoria_financeira: e.target.value}))} />
          </div>

          <div>
            <label className="label">Descrição do lançamento</label>
            <input className="input mt-1" value={form.descricao}
              onChange={e => setForm(f => ({...f, descricao: e.target.value}))} />
          </div>
        </div>

        {msg && (
          <div className={cn('rounded-xl p-3 mt-4 text-sm',
            status==='ok' ? 'bg-emerald-500/10 text-emerald-400' :
            status==='erro' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400')}>
            {status==='loading' && <span className="animate-pulse">⏳ </span>}{msg}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleLancar} disabled={status==='loading'} className="btn-primary">
            {status==='loading' ? '⏳ Provisionando...' : '🗓️ Confirmar Provisionamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal Pagar Boleto (debita saldo da conta) ─────────────────────
function ModalPagarBoleto({ imovel, onClose, onPago }: {
  imovel: Imovel
  onClose: () => void
  onPago: () => void
}) {
  const supabase = createClient()
  const { empresaId } = useEmpresaId()
  const [contas, setContas] = useState<{id:string;nome:string;tipo:string;saldo_atual:number;cor?:string}[]>([])
  const hoje = new Date()
  const diaVenc = imovel.dia_vencimento || 10
  const dataVenc = new Date(hoje.getFullYear(), hoje.getMonth(), diaVenc)
  const proxParcela = (imovel.parcelas_pagas ?? 0) + 1

  const [mesReferencia, setMesReferencia] = useState(mesLocal(hoje))
  const [statusMesRef, setStatusMesRef] = useState<MesRefResultado | null>(null)

  const [form, setForm] = useState({
    conta_id: '',
    valor: String(imovel.valor_parcela || ''),
    descricao: `Pgto Parcela ${proxParcela}/${imovel.parcelas_total ?? '?'} – ${imovel.titulo}`,
    data_pagamento: hojeLocal(hoje),
    categoria_financeira: imovel.categoria_financeira || 'Financiamento Imobiliário',
    observacoes: '',
  })

  useEffect(() => {
    resolverMesRefPendente(
      supabase,
      'pagamentos_imoveis',
      'imovel_id',
      imovel.id,
      imovel.dia_vencimento,
      form.data_pagamento,
      imovel.data_aquisicao,
      imovel.parcelas_pagas,
      imovel.parcelas_total,
      imovel.periodicidade,
      imovel.proximo_vencimento
    ).then(res => {
      setMesReferencia(res.mesRef)
      setStatusMesRef(res)
    })
  }, [imovel.id, form.data_pagamento])

  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'erro'>('idle')
  const [msg, setMsg] = useState('')

  // Carrega contas bancárias com saldo
  useEffect(() => {
    supabase.from('contas').select('id,nome,tipo,saldo_atual,cor')
      .eq('ativo', true)
      .in('tipo', ['corrente', 'poupanca', 'dinheiro', 'investimento'])
      .then(({ data }) => {
        if (data) setContas(data as any)
      })
  }, [])

  const contaSelecionada = contas.find(c => c.id === form.conta_id)

  const handlePagar = async () => {
    const valor = parseFloat(form.valor)
    if (!form.conta_id) { setMsg('❗ Selecione uma conta para débito'); return }
    if (!valor || valor <= 0) { setMsg('❗ Valor inválido'); return }
    if (contaSelecionada && valor > contaSelecionada.saldo_atual) {
      if (!confirm(`⚠️ O valor (R$ ${valor.toFixed(2)}) é maior que o saldo da conta (R$ ${contaSelecionada.saldo_atual.toFixed(2)}). Deseja continuar?`)) return
    }

    setStatus('loading')
    setMsg('Processando pagamento...')
    try {
      // 1. Busca ou cria categoria financeira
      let catId: string | null = null
      const { data: cats } = await (supabase
        .from('categorias_financeiras') as any)
        .select('id').eq('nome', form.categoria_financeira).maybeSingle()
      if (cats?.id) {
        catId = cats.id
      } else {
        const { data: novaCat } = await (supabase.from('categorias_financeiras') as any)
          .insert({ nome: form.categoria_financeira, tipo: 'despesa', cor: '#F59E0B' })
          .select('id').single()
        catId = novaCat?.id ?? null
      }

      // 2. Executa o pagamento inteiro numa ÚNICA transação no banco.
      //    A RPC pagar_parcela_imovel() (migration 077) faz, atomicamente:
      //      - debita contas.saldo_atual lendo o saldo FRESCO do banco
      //      - insere o lançamento de saída (caixa/validado)
      //      - avança imoveis.parcelas_pagas
      //      - grava pagamentos_imoveis como 'pago'
      //    Se qualquer etapa falhar, o Postgres desfaz TODAS — nunca mais
      //    sobra débito órfão nem parcela avançada sem boleto pago.
      const mesRefFinal = mesReferencia || form.data_pagamento.substring(0, 7)
      const { data: resultado, error: errRpc } = await (supabase.rpc as any)('pagar_parcela_imovel', {
        p_imovel_id: imovel.id,
        p_conta_id: form.conta_id,
        p_valor: valor,
        p_data_pagamento: form.data_pagamento,
        p_mes_referencia: mesRefFinal,
        p_parcela_atual: proxParcela,
        p_descricao: form.descricao,
        p_categoria_id: catId,
        p_observacoes: [
          `Imóvel: ${imovel.titulo}`,
          imovel.indexador ? `Indexador: ${imovel.indexador}` : null,
          `Mês Ref: ${mesRefFinal}`,
          form.observacoes || null,
        ].filter(Boolean).join(' | '),
        p_notas: form.observacoes || null,
      })

      if (errRpc) throw new Error(errRpc.message)
      if (!resultado) throw new Error('O banco não retornou resultado do pagamento.')

      // Boleto do mês já estava pago — não debita de novo nem avança parcela.
      if (resultado.ok === false) {
        setStatus('erro')
        setMsg(`⚠️ ${resultado.mensagem ?? 'Esta parcela já estava paga.'}`)
        return
      }

      // Dispara evento global para recarregar relatórios/botões
      window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))
      window.dispatchEvent(new CustomEvent('elena:patrimonio-updated'))

      setStatus('ok')
      setMsg(
        `✅ Parcela ${proxParcela} (${mesRefFinal}) paga! Debitado ${formatCurrency(valor)} da conta ` +
        `${resultado.conta_nome ?? contaSelecionada?.nome ?? ''}. ` +
        `Novo saldo: ${formatCurrency(Number(resultado.novo_saldo ?? 0))}`
      )
      setTimeout(() => { onPago(); onClose() }, 2000)
    } catch (err: any) {
      setStatus('erro')
      setMsg(`❌ ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-semibold text-fg">💰 Pagar Boleto</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">{imovel.titulo}</p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        {/* Info da parcela */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4 text-xs text-amber-300">
          <p>📊 Parcela nº <strong>{proxParcela}</strong> de {imovel.parcelas_total ?? '?'} &nbsp;·&nbsp; Vence dia <strong>{diaVenc}</strong></p>
          <div className="mt-2 flex items-center justify-between gap-2 bg-surface p-2 rounded-lg border border-border-subtle">
            <span className="text-fg-secondary text-xs">Mês de Referência:</span>
            <div className="flex items-center gap-2">
              <input
                type="month"
                className="input py-0.5 px-2 text-xs w-36"
                value={mesReferencia}
                onChange={e => setMesReferencia(e.target.value)}
              />
              {statusMesRef?.isAtrasado && (
                <span className="px-2 py-0.5 text-[10px] rounded bg-red-500/20 text-red-400 font-bold border border-red-500/30">
                  🚨 Em Atraso
                </span>
              )}
            </div>
          </div>
          {imovel.indexador && <p className="mt-1 font-mono text-[11px]">📌 Indexador: {imovel.indexador}</p>}
        </div>

        <div className="space-y-3">
          {/* Valor */}
          <div>
            <label className="label">Valor do pagamento (R$) *</label>
            <input type="number" step="0.01" className="input mt-1" value={form.valor}
              onChange={e => setForm(f => ({...f, valor: e.target.value}))} />
          </div>

          {/* Data */}
          <div>
            <label className="label">Data do pagamento</label>
            <input type="date" className="input mt-1" value={form.data_pagamento}
              onChange={e => setForm(f => ({...f, data_pagamento: e.target.value}))} />
          </div>

          {/* Conta */}
          <div>
            <label className="label">Conta para débito *</label>
            <select className="input mt-1" value={form.conta_id}
              onChange={e => setForm(f => ({...f, conta_id: e.target.value}))}>
              <option value="">Selecione a conta...</option>
              {contas.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome} ({c.tipo}) — Saldo: R$ {c.saldo_atual.toLocaleString('pt-BR', {minimumFractionDigits:2})}
                </option>
              ))}
            </select>
            {contaSelecionada && (
              <div className="mt-2 p-2.5 rounded-lg bg-surface border border-border-subtle flex items-center justify-between">
                <span className="text-xs text-fg-secondary">Saldo atual:</span>
                <span className={`text-sm font-bold ${contaSelecionada.saldo_atual >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(contaSelecionada.saldo_atual)}
                </span>
              </div>
            )}
          </div>

          {/* Categoria */}
          <div>
            <label className="label">Categoria financeira</label>
            <input className="input mt-1" value={form.categoria_financeira}
              onChange={e => setForm(f => ({...f, categoria_financeira: e.target.value}))} />
          </div>

          {/* Observações */}
          <div>
            <label className="label">Observações (opcional)</label>
            <input className="input mt-1" value={form.observacoes}
              placeholder="Multa, desconto, etc."
              onChange={e => setForm(f => ({...f, observacoes: e.target.value}))} />
          </div>
        </div>

        {msg && (
          <div className={cn('rounded-xl p-3 mt-4 text-sm',
            status==='ok' ? 'bg-emerald-500/10 text-emerald-400' :
            status==='erro' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400')}>
            {status==='loading' && <span className="animate-pulse">⏳ </span>}{msg}
          </div>
        )}

        {/* Resumo do pagamento */}
        {form.conta_id && form.valor && status === 'idle' && (
          <div className="mt-4 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 text-xs text-blue-300 space-y-1">
            <p className="font-semibold">📋 Resumo do pagamento:</p>
            <p>• Parcela {proxParcela} de {imovel.parcelas_total ?? '?'}</p>
            <p>• Valor: <strong>R$ {parseFloat(form.valor).toLocaleString('pt-BR', {minimumFractionDigits:2})}</strong></p>
            <p>• Débito em: <strong>{contaSelecionada?.nome}</strong></p>
            <p>• Novo saldo estimado: <strong>{formatCurrency((contaSelecionada?.saldo_atual ?? 0) - parseFloat(form.valor || '0'))}</strong></p>
          </div>
        )}

        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handlePagar} disabled={status==='loading' || status==='ok'} className="btn-primary">
            {status==='loading' ? '⏳ Pagando...' : status==='ok' ? '✅ Pago!' : '💰 Confirmar Pagamento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Modal de Importação via IA ──────────────────────────────────
// ── Modal de Parcelas em Lote — dois modos ────────────────────────
// Uma tela só para as duas operações que tratam VÁRIAS parcelas de uma vez.
// Compartilham a lista (calcularParcelasEmAberto: a mesma regra do card e do
// resumo da Elena) e diferem no que acontece com o dinheiro:
//
//   modo='retroativo' → RPC registrar_pagamento_retroativo (078/078b)
//     O dinheiro JÁ saiu na vida real; o que falta é o registro. NÃO debita
//     saldo e NÃO cria lançamento — debitar de novo recriaria o problema dos
//     débitos órfãos ao contrário.
//
//   modo='pagar' → RPC pagar_parcela_imovel (077), uma chamada por parcela
//     O dinheiro sai AGORA. Cada chamada é atômica no banco: debita a conta,
//     cria o lançamento, avança parcelas_pagas e grava o boleto.
//
// LISTAS DIFERENTES:
//   'pagar' lista as PRÓXIMAS parcelas não pagas, tenham vencido ou não
//   (proximasParcelas) — o uso principal é ADIANTAR pagamento. Atrasada, se
//   houver, aparece no topo e não pode ser pulada.
//   'retroativo' lista só o que já venceu (calcularParcelasEmAberto): não faz
//   sentido registrar como "já paga" uma parcela que ainda nem venceu.
//
// SELEÇÃO DIFERENTE EM CADA MODO, de propósito:
//   'pagar' é CUMULATIVO a partir da mais antiga. `parcelas_pagas` é um
//   contador e a regra vigente diz que as pagas são as PRIMEIRAS N parcelas —
//   pular maio e pagar junho faria o contador andar 1 apontando para o mês
//   errado. 'retroativo' é livre, porque lá o contador não se move: quem marca
//   a parcela é a linha em pagamentos_imoveis, e buraco no meio é representável.
function ModalParcelasEmLote({ imovel, modo, onClose, onConcluido }: {
  imovel: Imovel
  modo: 'retroativo' | 'pagar'
  onClose: () => void
  onConcluido: () => void
}) {
  const supabase = createClient()
  const pagando = modo === 'pagar'

  const [contas, setContas] = useState<{id:string;nome:string;tipo:string;saldo_atual:number}[]>([])
  const [contaId, setContaId] = useState('')
  const [emAberto, setEmAberto] = useState<ParcelaEmAberto[]>([])
  const [calculo, setCalculo] = useState<CalculoParcelas | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [sel, setSel] = useState<Record<string, { marcado: boolean; data: string; valor: string }>>({})
  const [dataLote, setDataLote] = useState(hojeLocal())
  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'erro'>('idle')
  const [msg, setMsg] = useState('')

  const pagas = imovel.parcelas_pagas ?? 0
  const total = imovel.parcelas_total ?? null
  const faltam = total != null ? Math.max(0, total - pagas) : null

  useEffect(() => {
    supabase.from('contas').select('id,nome,tipo,saldo_atual')
      .eq('ativo', true)
      .in('tipo', ['corrente', 'poupanca', 'dinheiro', 'investimento'])
      .then(({ data }) => { if (data) setContas(data as any) })
  }, [])

  // Mesma função do card e do resumo da Elena — uma regra só.
  useEffect(() => {
    let cancelado = false
    async function carregar() {
      const { data: pagos } = await (supabase.from('pagamentos_imoveis') as any)
        .select('mes_referencia, status')
        .eq('imovel_id', imovel.id)
        .eq('status', 'pago')
      const mesesPagos = new Set<string>((pagos || []).map((p: any) => p.mes_referencia))
      const contrato = {
        dataAquisicao: imovel.data_aquisicao,
        parcelasPagas: imovel.parcelas_pagas,
        parcelasTotal: imovel.parcelas_total,
        periodicidade: imovel.periodicidade,
        diaVencimento: imovel.dia_vencimento,
        proximoVencimento: imovel.proximo_vencimento,
      }
      const calc = calcularParcelasEmAberto(contrato, mesesPagos)
      // Pagando: as próximas 24, vencidas ou não — adiantar é o uso principal.
      // Registrando retroativo: só o que já venceu.
      const lista = pagando ? proximasParcelas(contrato, mesesPagos, 24) : calc.emAberto
      if (cancelado) return
      setEmAberto(lista)
      setCalculo(calc)
      // Retroativo: data pré-preenchida com o vencimento daquele mês, que quase
      // sempre é a data real do pagamento. Pagando agora, a data é uma só (hoje).
      const dia = String(imovel.dia_vencimento || 10).padStart(2, '0')
      const inicial: Record<string, { marcado: boolean; data: string; valor: string }> = {}
      lista.forEach(pa => {
        inicial[pa.mesRef] = {
          marcado: false,
          data: `${pa.mesRef}-${dia}`,
          valor: String(imovel.valor_parcela ?? ''),
        }
      })
      setSel(inicial)
      setCarregando(false)
    }
    carregar()
    return () => { cancelado = true }
  }, [imovel.id, pagando])

  const marcados = emAberto.filter(pa => sel[pa.mesRef]?.marcado)
  const totalMarcado = marcados.reduce((acc, pa) => acc + (parseFloat(sel[pa.mesRef]?.valor) || 0), 0)
  const contaSelecionada = contas.find(c => c.id === contaId)
  const saldoDepois = contaSelecionada ? contaSelecionada.saldo_atual - totalMarcado : null

  const toggle = (mes: string) => {
    if (!pagando) {
      setSel(s => ({ ...s, [mes]: { ...s[mes], marcado: !s[mes]?.marcado } }))
      return
    }
    // Cumulativo: clicar na parcela N seleciona da 1ª até a N; clicar numa já
    // marcada desmarca dela para a frente.
    const idx = emAberto.findIndex(pa => pa.mesRef === mes)
    if (idx < 0) return
    const ate = sel[mes]?.marcado ? idx - 1 : idx
    setSel(s => {
      const novo = { ...s }
      emAberto.forEach((pa, i) => { novo[pa.mesRef] = { ...novo[pa.mesRef], marcado: i <= ate } })
      return novo
    })
  }
  const setCampo = (mes: string, campo: 'data' | 'valor', v: string) =>
    setSel(s => ({ ...s, [mes]: { ...s[mes], [campo]: v } }))

  // ── Registrar sem debitar (retroativo) ──────────────────────────
  const registrarRetroativo = async () => {
    const ok: string[] = []
    const falhas: string[] = []
    // Uma chamada por parcela: cada uma é atômica no banco e falha isolada não
    // derruba as outras. O relatório no fim diz exatamente o que entrou.
    for (const pa of marcados) {
      const linha = sel[pa.mesRef]
      const { data, error } = await (supabase.rpc as any)('registrar_pagamento_retroativo', {
        p_imovel_id: imovel.id,
        p_mes_ref:   pa.mesRef,
        p_data_pgto: linha.data,
        p_valor:     parseFloat(linha.valor),
        p_conta_id:  contaId,
        p_notas:     `Parcela ${pa.numero}${total ? '/' + total : ''}`,
      })
      if (error) { falhas.push(`${pa.mesRef}: ${error.message}`); continue }
      if (data?.ok) ok.push(pa.mesRef)
      else falhas.push(`${pa.mesRef}: ${data?.motivo || 'recusado'}`)
    }

    if (falhas.length === 0) {
      setStatus('ok')
      setMsg(`✅ ${ok.length} parcela(s) registrada(s). Nenhum valor foi debitado — só o histórico foi gravado.`)
      setTimeout(() => { onConcluido(); onClose() }, 2000)
    } else {
      setStatus('erro')
      setMsg(`${ok.length > 0 ? `✅ ${ok.length} registrada(s). ` : ''}⚠️ Não entraram: ${falhas.join(' · ')}`)
      if (ok.length > 0) onConcluido()
    }
  }

  // ── Quitar agora (debita) ───────────────────────────────────────
  const quitarAgora = async () => {
    // Categoria resolvida UMA vez, fora do laço.
    let catId: string | null = null
    const nomeCat = imovel.categoria_financeira || 'Financiamento Imobiliário'
    const { data: cats } = await (supabase.from('categorias_financeiras') as any)
      .select('id').eq('nome', nomeCat).limit(1)
    if (cats && cats.length) {
      catId = cats[0].id
    } else {
      const { data: novaCat } = await (supabase.from('categorias_financeiras') as any)
        .insert({ nome: nomeCat, tipo: 'despesa', cor: '#F59E0B' })
        .select('id').single()
      catId = novaCat?.id ?? null
    }

    const ok: string[] = []
    const pulados: string[] = []
    const falhas: string[] = []
    let novoSaldo: number | null = null

    // Sequencial e em ordem: cada chamada avança parcelas_pagas, então a ordem
    // importa. Falha de verdade ABORTA o lote — seguir em frente deixaria o
    // contador andando por cima de um mês que não foi pago.
    for (const pa of marcados) {
      const linha = sel[pa.mesRef]
      const valor = parseFloat(linha.valor)
      const { data, error } = await (supabase.rpc as any)('pagar_parcela_imovel', {
        p_imovel_id:      imovel.id,
        p_conta_id:       contaId,
        p_valor:          valor,
        p_data_pagamento: dataLote,
        p_mes_referencia: pa.mesRef,
        p_parcela_atual:  pa.numero,
        p_descricao:      `Pgto Parcela ${pa.numero}${total ? '/' + total : ''} – ${imovel.titulo}`,
        p_categoria_id:   catId,
        p_observacoes: [
          `Imóvel: ${imovel.titulo}`,
          imovel.indexador ? `Indexador: ${imovel.indexador}` : null,
          `Mês Ref: ${pa.mesRef}`,
          'Quitação em lote',
        ].filter(Boolean).join(' | '),
        p_notas: 'Quitação em lote',
      })

      if (error) { falhas.push(`${pa.mesRef}: ${error.message}`); break }
      if (!data) { falhas.push(`${pa.mesRef}: o banco não retornou resultado`); break }

      if (data.ok === false) {
        const motivo = String(data.motivo ?? data.mensagem ?? '')
        // Mês já pago não é erro: não debitou nada, é só pular.
        if (/ja_pago|já\s*estava|já\s*pag/i.test(motivo)) { pulados.push(pa.mesRef); continue }
        falhas.push(`${pa.mesRef}: ${motivo || 'recusado'}`)
        break
      }

      ok.push(pa.mesRef)
      if (data.novo_saldo != null) novoSaldo = Number(data.novo_saldo)
    }

    if (ok.length > 0) {
      window.dispatchEvent(new CustomEvent('elena:lancamento-salvo'))
      window.dispatchEvent(new CustomEvent('elena:patrimonio-updated'))
      onConcluido()
    }

    const partes: string[] = []
    if (ok.length) partes.push(`✅ ${ok.length} parcela(s) paga(s) (${ok.join(', ')})`)
    if (pulados.length) partes.push(`↩️ ${pulados.length} já estava(m) paga(s): ${pulados.join(', ')}`)
    if (falhas.length) partes.push(`❌ parou em ${falhas.join(' · ')}`)
    if (novoSaldo != null) partes.push(`Saldo da conta: ${formatCurrency(novoSaldo)}`)

    if (falhas.length === 0) {
      setStatus('ok')
      setMsg(partes.join(' · '))
      setTimeout(() => { onClose() }, 2500)
    } else {
      setStatus('erro')
      setMsg(partes.join(' · '))
    }
  }

  const handleConfirmar = async () => {
    if (!contaId) { setStatus('erro'); setMsg(pagando ? '❗ Selecione a conta para débito' : '❗ Selecione a conta de origem'); return }
    if (marcados.length === 0) { setStatus('erro'); setMsg('❗ Marque ao menos uma parcela'); return }
    for (const pa of marcados) {
      const linha = sel[pa.mesRef]
      if (!pagando && !linha.data) { setStatus('erro'); setMsg(`❗ Informe a data de pagamento de ${pa.mesRef}`); return }
      if (!(parseFloat(linha.valor) > 0)) { setStatus('erro'); setMsg(`❗ Informe um valor válido para ${pa.mesRef}`); return }
    }
    if (pagando) {
      if (!dataLote) { setStatus('erro'); setMsg('❗ Informe a data do pagamento'); return }
      if (contaSelecionada && totalMarcado > contaSelecionada.saldo_atual) {
        if (!confirm(
          `⚠️ O total (${formatCurrency(totalMarcado)}) é maior que o saldo da conta ` +
          `(${formatCurrency(contaSelecionada.saldo_atual)}). Continuar mesmo assim?`
        )) return
      }
      if (!confirm(
        `Pagar ${marcados.length} parcela(s) de ${imovel.titulo} agora?\n\n` +
        `Total: ${formatCurrency(totalMarcado)}\n` +
        `Conta: ${contaSelecionada?.nome ?? ''}\n\n` +
        `Isso DEBITA o saldo e cria um lançamento por parcela.`
      )) return
    }

    setStatus('loading'); setMsg('')
    if (pagando) await quitarAgora()
    else await registrarRetroativo()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-fg">
                {pagando ? '⚡ Quitar Várias Parcelas' : '🧾 Registrar Parcelas Já Pagas'}
              </h2>
              <p className="text-xs text-fg-tertiary mt-0.5">{imovel.titulo}</p>
            </div>
            <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-lg leading-none">✕</button>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
            <span className="text-fg-secondary">
              <strong className="text-fg tabular-nums">{pagas}</strong> pagas
              {total != null && <> de <strong className="text-fg tabular-nums">{total}</strong></>}
            </span>
            {faltam != null && (
              <span className="text-fg-tertiary">faltam <strong className="text-fg tabular-nums">{faltam}</strong></span>
            )}
          </div>

          {pagando ? (
            <div className="bg-violet-500/10 border border-violet-500/25 rounded-xl px-4 py-3 text-[11px] text-violet-200/90 leading-relaxed">
              Serve para <strong>adiantar parcelas</strong>: marque até onde quer quitar e o
              dinheiro sai agora, um lançamento por parcela. A seleção é sempre
              <strong> da mais antiga para a mais nova</strong> — não dá para pular uma no meio,
              porque o contador de parcelas pagas anda em sequência. Havendo atrasada, ela entra
              junto. Para parcela que <strong>já foi paga</strong> e só faltou registrar, feche e
              use <strong>Registrar já pagas</strong>.
            </div>
          ) : (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-[11px] text-amber-200/90 leading-relaxed">
              Use isto para parcelas que <strong>já foram pagas</strong> e nunca foram registradas.
              Nenhum valor é debitado e nenhum lançamento é criado — o dinheiro já saiu na época.
              A conta serve para dizer <strong>de onde veio o recurso</strong>.
              Para pagar parcelas <strong>agora</strong>, feche e use <strong>Quitar várias</strong>.
            </div>
          )}

          <div className={cn('grid gap-3', pagando ? 'grid-cols-2' : 'grid-cols-1')}>
            <div>
              <label className="label">
                {pagando ? 'Conta para débito' : 'Conta de origem'} <span className="text-red-400">*</span>
              </label>
              <select className="input mt-1" value={contaId} onChange={e => setContaId(e.target.value)}>
                <option value="">Selecione…</option>
                {contas.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({c.tipo}){pagando ? ` — ${formatCurrency(c.saldo_atual ?? 0)}` : ''}
                  </option>
                ))}
              </select>
            </div>
            {pagando && (
              <div>
                <label className="label">Data do pagamento</label>
                <input type="date" className="input mt-1" value={dataLote}
                  onChange={e => setDataLote(e.target.value)} />
              </div>
            )}
          </div>

          {carregando ? (
            <p className="text-xs text-fg-tertiary py-6 text-center">Carregando parcelas…</p>
          ) : emAberto.length === 0 ? (
            <div className="py-6 text-center space-y-1.5">
              {calculo?.quitado ? (
                <p className="text-xs text-fg-tertiary">
                  Contrato quitado — todas as {total} parcelas já foram pagas.
                </p>
              ) : !pagando && calculo?.proximaParcela ? (
                <>
                  <p className="text-xs text-fg-secondary">
                    Nada vencido. A próxima é a <strong>nº {calculo.proximaNumero}</strong>, que
                    vence em{' '}
                    <strong>
                      {(() => {
                        const d = imovel.proximo_vencimento && calculo.proximaNumero === pagas + 1
                          ? String(imovel.proximo_vencimento).substring(0, 10)
                          : vencimentoNominal(calculo.proximaParcela, imovel.dia_vencimento || 10)
                        return `${d.substring(8, 10)}/${d.substring(5, 7)}/${d.substring(0, 4)}`
                      })()}
                    </strong>.
                  </p>
                  <p className="text-[11px] text-fg-tertiary">
                    Esta tela só lista parcelas que já venceram. As {faltam} que faltam entram aqui
                    conforme forem vencendo.
                  </p>
                </>
              ) : calculo?.semDataAquisicao ? (
                <p className="text-xs text-amber-400/90">
                  Sem data de aquisição e sem próximo vencimento, não dá para calcular o
                  calendário deste contrato. Preencha um dos dois na edição do imóvel.
                </p>
              ) : (
                <p className="text-xs text-fg-tertiary">
                  {pagando ? 'Não há parcela a pagar neste contrato.' : 'Nenhuma parcela em aberto.'}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px] text-fg-tertiary uppercase tracking-wide">
                {pagando ? 'Próximas parcelas · clique para quitar até ela' : 'Parcelas em aberto'}
              </p>
              {emAberto.map(pa => {
                const linha = sel[pa.mesRef] || { marcado: false, data: '', valor: '' }
                return (
                  <div key={pa.mesRef} className={cn(
                    'rounded-xl border px-3 py-2.5 transition-colors',
                    linha.marcado
                      ? (pagando ? 'bg-violet-500/10 border-violet-500/30' : 'bg-white/5 border-white/20')
                      : 'border-white/8'
                  )}>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={!!linha.marcado} onChange={() => toggle(pa.mesRef)} />
                      <span className="text-xs font-semibold text-fg">
                        Parcela nº {pa.numero}{total ? ` de ${total}` : ''} — {pa.mesRef}
                      </span>
                      {pa.isAtrasado ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 font-bold">
                          ATRASADA
                        </span>
                      ) : pagando ? (
                        <span className="text-[10px] text-fg-tertiary">
                          vence {(() => {
                            const d = vencimentoNominal(pa.mesRef, imovel.dia_vencimento || 10)
                            return `${d.substring(8, 10)}/${d.substring(5, 7)}/${d.substring(0, 4)}`
                          })()}
                        </span>
                      ) : null}
                    </label>
                    {linha.marcado && (
                      <div className={cn('grid gap-2 mt-2 pl-6', pagando ? 'grid-cols-1' : 'grid-cols-2')}>
                        {!pagando && (
                          <div>
                            <label className="text-[10px] text-fg-tertiary uppercase">Data do pagamento</label>
                            <input type="date" className="input mt-0.5 text-xs" value={linha.data}
                              onChange={e => setCampo(pa.mesRef, 'data', e.target.value)} />
                          </div>
                        )}
                        <div>
                          <label className="text-[10px] text-fg-tertiary uppercase">Valor pago</label>
                          <input type="number" step="0.01" className="input mt-0.5 text-xs" value={linha.valor}
                            onChange={e => setCampo(pa.mesRef, 'valor', e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {marcados.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs bg-white/5 rounded-xl px-4 py-2.5">
                <span className="text-fg-secondary">{marcados.length} selecionada(s)</span>
                <span className="font-semibold text-fg tabular-nums">{formatCurrency(totalMarcado)}</span>
              </div>
              {pagando && contaSelecionada && (
                <div className="flex items-center justify-between text-[11px] px-4">
                  <span className="text-fg-tertiary">
                    Saldo de {contaSelecionada.nome}: {formatCurrency(contaSelecionada.saldo_atual ?? 0)}
                  </span>
                  <span className={cn('font-semibold tabular-nums',
                    (saldoDepois ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                    depois: {formatCurrency(saldoDepois ?? 0)}
                  </span>
                </div>
              )}
            </div>
          )}

          {msg && (
            <p className={cn('text-xs leading-relaxed', status === 'erro' ? 'text-red-400' : 'text-emerald-400')}>
              {msg}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-semibold border border-white/10 text-fg-tertiary hover:text-fg">
              {status === 'ok' ? 'Fechar' : 'Cancelar'}
            </button>
            <button
              onClick={handleConfirmar}
              disabled={status === 'loading' || status === 'ok' || marcados.length === 0}
              className={cn(
                'flex-1 py-2 rounded-xl text-xs font-semibold border disabled:opacity-40 disabled:cursor-not-allowed',
                pagando
                  ? 'bg-violet-500/15 border-violet-500/30 text-violet-300 hover:bg-violet-500/25'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-300 hover:bg-amber-500/25'
              )}
            >
              {status === 'loading'
                ? (pagando ? 'Pagando…' : 'Registrando…')
                : pagando
                  ? `Pagar ${marcados.length || ''} agora${totalMarcado ? ' · ' + formatCurrency(totalMarcado) : ''}`
                  : `Registrar ${marcados.length || ''} sem debitar`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ModalImportarIA({ onClose, onImportado }: { onClose: () => void; onImportado: () => void }) {
  const supabase = createClient()
  const [texto, setTexto] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'preview' | 'saving' | 'ok' | 'erro'>('idle')
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState<any>(null)
  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const isPDF = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf'

    if (isPDF) {
      // PDF é binário — precisa extrair texto no servidor
      setStatus('loading')
      setMsg('Extraindo texto do PDF...')
      try {
        const fd = new FormData()
        fd.append('file', file)
        const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok || data.error) throw new Error(data.error || 'Erro ao ler PDF')
        const textoExtraido = (data.text ?? data.texto ?? '').trim()
        if (!textoExtraido) throw new Error('PDF sem texto extraível. Tente copiar e colar o conteúdo.')
        setTexto(textoExtraido)
        setStatus('idle')
        setMsg(`✅ PDF lido: ${textoExtraido.length} caracteres extraídos. Clique em "Importar com IA".`)
      } catch (err: any) {
        setStatus('erro')
        setMsg(`❌ ${err.message}`)
      }
      return
    }

    // CSV / TXT — lê normalmente como texto
    const reader = new FileReader()
    reader.onload = ev => setTexto(ev.target?.result as string ?? '')
    reader.readAsText(file, 'utf-8')
  }

  const handleImportar = async () => {
    if (!texto.trim()) return
    setStatus('loading')
    setMsg('Analisando documento com IA...')
    try {
      // Detecta CSV por ponto-e-vírgula
      const linhas = texto.split('\n').filter(l => l.trim())
      const isCSV = texto.includes(';') && linhas.length > 1
      const header = linhas[0] || ''
      const dadosSample = linhas.slice(1, 4).join('\n')

      const promptCSV = `Este é um relatório CSV de financiamento imobiliário separado por ponto-e-vírgula (;).
Colunas: ${header}
Dados (primeiras 3 linhas):
${dadosSample}

Extraia os dados do PRIMEIRO imóvel e retorne APENAS o JSON abaixo sem texto adicional, sem markdown:
{"titulo":"construtora + unidade","construtora":"empresa","unidade":"cod","endereco":null,"tipo_imovel":"residencial","area_m2":null,"quartos":null,"valor_compra":0,"valor_total_contrato":0,"valor_parcela":0,"parcelas_total":0,"parcelas_pagas":0,"indexador":"REAL","taxa_juros_anual":null,"data_aquisicao":"YYYY-MM-DD","status":"disponivel"}`

      // Para PDFs longos: envia o início (cabeçalho + primeiras parcelas) E o final (resumo/totais)
      const textoInicio = texto.substring(0, 12000)
      const textoFinal = texto.length > 14000 ? texto.substring(texto.length - 3000) : ''
      const textoParaIA = textoFinal
        ? `=== INÍCIO DO DOCUMENTO ===\n${textoInicio}\n\n=== FINAL DO DOCUMENTO (resumo/totais) ===\n${textoFinal}`
        : textoInicio

      const promptDoc = `Você está analisando um documento "Saldo Devedor Presente" de financiamento imobiliário brasileiro.
O documento pode conter MÚLTIPLOS contratos/imóveis. Se houver mais de um, escolha o imóvel com MAIS parcelas futuras a vencer (o contrato ativo principal).

REGRAS CRÍTICAS para extração:
1. "parcelas_total" = PRIORIDADE: use o campo "Ano próximo" ou "Total parcelas" ou conte o número de parcela mais alto visível na tabela. NÃO conte apenas as linhas visíveis.
2. "parcelas_pagas" = procure na seção "VALORES PAGOS" — conte quantas linhas existem, ou use "Total parcelas pagas" se existir no resumo
3. Se o documento tiver seção "=== FINAL DO DOCUMENTO ===" com totalizadores, USE esses valores para parcelas_total e parcelas_pagas
4. "valor_parcela" = valor da parcela mensal (campo "Valor Original" ou "Valor Atualizado" de uma linha típica)
5. "valor_total_contrato" = campo "Valor total do contrato"
6. "titulo" = nome da empresa construtora + unidade (ex: "GMS SPE LTDA — S01-Q05-LT14")
7. "indexador" = campo Indexador (ex: REAL, INCC-M, IGP-M, TR, IPCA)
8. "status" = use APENAS uma destas palavras exatas: disponivel, alugado, vendido, em_reforma
9. "tipo_imovel" = use APENAS: residencial, comercial, terreno, galpao

Documento (${texto.length} chars totais):
${textoParaIA}

Retorne APENAS JSON válido sem markdown:
{"titulo":"empresa + unidade","construtora":"nome empresa","unidade":"cod","endereco":null,"tipo_imovel":"residencial","area_m2":null,"quartos":null,"valor_compra":null,"valor_total_contrato":null,"valor_parcela":null,"parcelas_total":null,"parcelas_pagas":0,"indexador":null,"taxa_juros_anual":null,"data_aquisicao":null,"status":"disponivel"}`

      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: isCSV ? promptCSV : promptDoc,
          context: '',
          systemInstruction: 'Retorne APENAS o objeto JSON puro. Sem texto antes, sem texto depois, sem markdown, sem explicação.'
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro na IA')

      // Extrai JSON da resposta — 3 tentativas
      let raw = (data.result ?? '').trim()
      raw = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
      console.log('[TabImoveis] IA raw (500):', raw.substring(0, 500))

      let parsed: any = null
      // T1: parse direto
      try { parsed = JSON.parse(raw) } catch (_) {}
      // T2: extrai { ... } usando indexOf
      if (!parsed) {
        const s = raw.indexOf('{')
        const e = raw.lastIndexOf('}')
        if (s !== -1 && e > s) try { parsed = JSON.parse(raw.substring(s, e + 1)) } catch (_) {}
      }
      // T3: extrai [ ... ]
      if (!parsed) {
        const s = raw.indexOf('[')
        const e = raw.lastIndexOf(']')
        if (s !== -1 && e > s) {
          try {
            const arr = JSON.parse(raw.substring(s, e + 1))
            if (Array.isArray(arr) && arr.length > 0) parsed = arr[0]
          } catch (_) {}
        }
      }
      if (!parsed) throw new Error('IA retornou formato inválido. Tente colar apenas as primeiras linhas do documento.')
      if (Array.isArray(parsed)) parsed = parsed[0]

      // empresa_id deve ser o UUID da empresa (perfis.empresa_id), exigido pela RLS
      const { data: userData } = await supabase.auth.getUser()
      let empId: string | null = null
      if (userData.user) {
        const { data: perf } = await supabase
          .from('perfis').select('empresa_id').eq('id', userData.user.id).single()
        empId = perf?.empresa_id ?? null
      }
      setEmpresaId(empId)

      // Mostra preview para o usuário confirmar/corrigir antes de salvar
      setPreview({
        titulo: parsed.titulo || 'Imóvel importado',
        construtora: parsed.construtora || '',
        unidade: parsed.unidade || '',
        tipo_imovel: parsed.tipo_imovel || 'residencial',
        valor_total_contrato: parsed.valor_total_contrato || parsed.valor_compra || '',
        valor_parcela: parsed.valor_parcela || '',
        parcelas_total: parsed.parcelas_total || '',
        parcelas_pagas: parsed.parcelas_pagas ?? 0,
        indexador: parsed.indexador || '',
        data_aquisicao: parsed.data_aquisicao || '',
        status: parsed.status || 'disponivel',
      })
      setStatus('preview')
      setMsg('')
    } catch (err: any) {
      setStatus('erro')
      setMsg(`❌ Erro: ${err.message}`)
    }
  }

  const handleSalvarPreview = async () => {
    if (!preview) return
    setStatus('saving')
    setMsg('Salvando imóvel...')
    try {
      const STATUS_VALIDOS = ['disponivel', 'alugado', 'vendido', 'em_reforma', 'em_obra', 'quitado', 'financiado']
      const TIPO_VALIDOS   = ['residencial', 'comercial', 'terreno', 'galpao']
      // Converte data brasileira dd/mm/yyyy para ISO yyyy-mm-dd (exigido pelo PostgreSQL)
      const parseDateBR = (v: string | null | undefined): string | null => {
        if (!v) return null
        const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
        if (m) return `${m[3]}-${m[2]}-${m[1]}`
        // Já está em ISO ou outro formato — retorna como está se parecer uma data válida
        return v.match(/^\d{4}-\d{2}-\d{2}$/) ? v : null
      }
      const sanitizeStatus = (v: string) => {
        const norm = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        if (norm.includes('quitad') || norm.includes('liquidado')) return 'disponivel'
        if (norm.includes('alugad')) return 'alugado'
        if (norm.includes('vendid')) return 'vendido'
        if (norm.includes('reforma') || norm.includes('obra') || norm.includes('financiad') || norm.includes('incorpora')) return 'em_reforma'
        return STATUS_VALIDOS.find(s => norm === s) ?? 'disponivel'
      }
      const sanitizeTipo = (v: string) => {
        const norm = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
        return TIPO_VALIDOS.find(t => norm.includes(t)) ?? 'residencial'
      }

      const { error } = await (supabase.from('imoveis') as any).insert({
        empresa_id: empresaId,
        titulo: preview.titulo || 'Imóvel importado',
        construtora: preview.construtora || null,
        unidade: preview.unidade || null,
        tipo_imovel: sanitizeTipo(preview.tipo_imovel || 'residencial'),
        valor_compra: parseFloat(String(preview.valor_total_contrato)) || null,
        valor_total_contrato: parseFloat(String(preview.valor_total_contrato)) || null,
        valor_parcela: parseFloat(String(preview.valor_parcela)) || null,
        parcelas_total: parseInt(String(preview.parcelas_total)) || null,
        parcelas_pagas: parseInt(String(preview.parcelas_pagas)) || 0,
        indexador: preview.indexador || null,
        data_aquisicao: parseDateBR(preview.data_aquisicao),
        status: sanitizeStatus(preview.status || 'disponivel'),
        area_m2: null, quartos: null, vagas: null, valor_mercado: null,
        taxa_juros_anual: null, dia_vencimento: null, categoria_financeira: null,
      })
      if (error) throw new Error(error.message)
      setStatus('ok')
      setMsg(`✅ Imóvel "${preview.titulo}" importado com sucesso!`)
      setTimeout(() => { onImportado(); onClose() }, 1500)
    } catch (err: any) {
      setStatus('erro')
      setMsg(`❌ Erro: ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-semibold text-fg">🤖 Importar Imóvel via IA</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">
              {status === 'preview' ? '✅ IA extraiu os dados — revise e confirme' : 'Cole o texto do documento ou selecione um arquivo'}
            </p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        {/* PASSO 1: Input do documento */}
        {status !== 'preview' && (
          <>
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4 text-xs text-amber-300 space-y-1">
              <p className="font-semibold">📄 Formatos aceitos:</p>
              <p>• Copie e cole o texto do PDF "Saldo Devedor Presente"</p>
              <p>• Arquivo CSV com dados do imóvel</p>
              <p>• Qualquer texto com: nome, valor do contrato, parcelas, construtora</p>
            </div>
            <textarea
              className="input w-full h-36 text-xs font-mono resize-none mb-3"
              placeholder="Cole aqui o conteúdo do documento do imóvel..."
              value={texto}
              onChange={e => setTexto(e.target.value)}
            />
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs text-fg-tertiary">ou</span>
              <input ref={fileRef} type="file" accept=".csv,.txt,.pdf" onChange={handleFile} className="hidden" />
              <button onClick={() => fileRef.current?.click()} className="btn-secondary text-xs">
                📂 Selecionar arquivo (PDF, CSV, TXT)
              </button>
              {texto && <span className="text-xs text-emerald-400">✓ {texto.length} caracteres</span>}
            </div>
          </>
        )}

        {/* PASSO 2: Preview/edição dos dados extraídos */}
        {status === 'preview' && preview && (
          <div className="space-y-3">
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 text-xs text-emerald-300 mb-2">
              🎯 Verifique os dados abaixo. Corrija se necessário antes de salvar.
            </div>
            <div>
              <label className="label text-[10px]">Título</label>
              <input className="input mt-1 text-xs" value={preview.titulo}
                onChange={e => setPreview((p: any) => ({ ...p, titulo: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-[10px]">Construtora</label>
                <input className="input mt-1 text-xs" value={preview.construtora}
                  onChange={e => setPreview((p: any) => ({ ...p, construtora: e.target.value }))} />
              </div>
              <div>
                <label className="label text-[10px]">Unidade</label>
                <input className="input mt-1 text-xs" value={preview.unidade}
                  onChange={e => setPreview((p: any) => ({ ...p, unidade: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="label text-[10px]">Valor Total Contrato</label>
                <input className="input mt-1 text-xs" type="number" value={preview.valor_total_contrato}
                  onChange={e => setPreview((p: any) => ({ ...p, valor_total_contrato: e.target.value }))} />
              </div>
              <div>
                <label className="label text-[10px]">Parcela Mensal</label>
                <input className="input mt-1 text-xs" type="number" value={preview.valor_parcela}
                  onChange={e => setPreview((p: any) => ({ ...p, valor_parcela: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="label text-[10px]">✅ Pagas</label>
                <input className="input mt-1 text-xs" type="number" value={preview.parcelas_pagas}
                  onChange={e => setPreview((p: any) => ({ ...p, parcelas_pagas: e.target.value }))} />
              </div>
              <div>
                <label className="label text-[10px]">📦 Total</label>
                <input className="input mt-1 text-xs" type="number" value={preview.parcelas_total}
                  onChange={e => setPreview((p: any) => ({ ...p, parcelas_total: e.target.value }))} />
              </div>
              <div>
                <label className="label text-[10px]">Indexador</label>
                <input className="input mt-1 text-xs" value={preview.indexador}
                  onChange={e => setPreview((p: any) => ({ ...p, indexador: e.target.value }))} />
              </div>
            </div>
          </div>
        )}

        {msg && (
          <div className={cn('rounded-xl p-3 mt-3 text-sm', status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : status === 'erro' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400')}>
            {(status === 'loading' || status === 'saving') && <span className="animate-pulse">⏳ </span>}{msg}
          </div>
        )}

        <div className="flex justify-end gap-2 mt-4">
          {status === 'preview' ? (
            <>
              <button onClick={() => { setStatus('idle'); setPreview(null) }} className="btn-secondary">← Voltar</button>
              <button onClick={handleSalvarPreview} disabled={status === 'saving' as any} className="btn-primary">
                💾 Confirmar e Salvar
              </button>
            </>
          ) : (
            <>
              <button onClick={onClose} className="btn-secondary">Cancelar</button>
              <button onClick={handleImportar} disabled={!texto.trim() || status === 'loading'} className="btn-primary">
                {status === 'loading' ? '⏳ Processando...' : '🤖 Analisar com IA'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ──────────────────────────────────
export function TabImoveis() {
  const supabase = createClient()
  const { empresaId } = useEmpresaId()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [showImportIA, setShowImportIA] = useState(false)
  const [imovelLancar, setImovelLancar] = useState<Imovel | null>(null)
  const [imovelAnalisar, setImovelAnalisar] = useState<Imovel | null>(null)
  const [imovelPagar, setImovelPagar] = useState<Imovel | null>(null)
  const [imovelRetroativo, setImovelRetroativo] = useState<Imovel | null>(null)
  const [imovelQuitarLote, setImovelQuitarLote] = useState<Imovel | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)

  const mesAtual = mesLocal()
  const [pagamentosMes, setPagamentosMes] = useState<Record<string, boolean>>({})
  const [statusPendentesMap, setStatusPendentesMap] = useState<Record<string, MesRefResultado>>({})

  const carregarPagamentosMes = async () => {
    if (!empresaId) return
    const { data } = await (supabase.from('pagamentos_imoveis') as any)
      .select('imovel_id, status, mes_referencia')
      .eq('empresa_id', empresaId)
      .eq('status', 'pago')
    if (data) {
      const mapa: Record<string, boolean> = {}
      data.filter((p: any) => p.mes_referencia === mesAtual).forEach((p: any) => { mapa[p.imovel_id] = true })
      setPagamentosMes(mapa)
    }
  }

  useEffect(() => {
    carregarPagamentosMes()
    const handler = () => { refetch(); carregarPagamentosMes() }
    window.addEventListener('elena:lancamento-salvo', handler)
    window.addEventListener('elena:patrimonio-updated', handler)
    return () => {
      window.removeEventListener('elena:lancamento-salvo', handler)
      window.removeEventListener('elena:patrimonio-updated', handler)
    }
  }, [empresaId])

  const { data: imoveis, refetch } = useSupabaseQuery<Imovel>('imoveis', {
    filters: { empresa_id: empresaId || undefined },
    orderBy: { column: 'criado_em', ascending: false },
    enabled: !!empresaId,
  } as any)

  useEffect(() => {
    if (!imoveis?.length) return
    let cancelado = false
    async function carregarPendentes() {
      const mapa: Record<string, MesRefResultado> = {}
      for (const im of imoveis) {
        mapa[im.id] = await resolverMesRefPendente(
          supabase,
          'pagamentos_imoveis',
          'imovel_id',
          im.id,
          im.dia_vencimento,
          undefined,
          im.data_aquisicao,
          im.parcelas_pagas,
          im.parcelas_total,
          im.periodicidade,
          im.proximo_vencimento
        )
      }
      if (!cancelado) setStatusPendentesMap(mapa)
    }
    carregarPendentes()
    return () => { cancelado = true }
  }, [imoveis])


  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    // trim() em todo texto livre: um espaço invisível no fim do título fez o
    // "Terreno Baron Conect " escapar de UPDATE por nome e some de busca exata.
    const limpo = (v: string) => { const t = (v || '').trim(); return t || null }

    const payload: any = {
      titulo: (form.titulo || '').trim(),
      endereco: limpo(form.endereco),
      tipo_imovel: form.tipo_imovel,
      area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
      quartos: form.quartos ? parseInt(form.quartos) : null,
      vagas: form.vagas ? parseInt(form.vagas) : null,
      valor_compra: form.valor_compra ? parseFloat(form.valor_compra) : null,
      valor_mercado: form.valor_mercado ? parseFloat(form.valor_mercado) : null,
      status: form.status,
      construtora: limpo(form.construtora),
      unidade: limpo(form.unidade),
      valor_total_contrato: form.valor_total_contrato ? parseFloat(form.valor_total_contrato) : null,
      valor_parcela: form.valor_parcela ? parseFloat(form.valor_parcela) : null,
      parcelas_total: form.parcelas_total ? parseInt(form.parcelas_total) : null,
      parcelas_pagas: form.parcelas_pagas ? parseInt(form.parcelas_pagas) : 0,
      indexador: limpo(form.indexador),
      data_aquisicao: form.data_aquisicao || null,
      // Âncora opcional (migration 079): quando preenchida, manda na regra de
      // vencimento e a fórmula data_aquisicao + N × passo é ignorada.
      proximo_vencimento: form.proximo_vencimento || null,
      dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento) : null,
      periodicidade: form.periodicidade || 'mensal',
      categoria_financeira: form.categoria_financeira || null,
      taxa_juros_anual: form.taxa_juros_anual ? parseFloat(form.taxa_juros_anual) : null,
      is_investimento: form.is_investimento,
      observacoes: limpo(form.observacoes),
    }
    
    if (editId) {
      // 01/08/2026: em EDIÇÃO o contador de parcelas pagas não vai no payload.
      // Ele só avança por operação com procedência (pagamento efetivo ou
      // registro retroativo, que exigem data e conta). Enquanto era digitável,
      // ele e pagamentos_imoveis viviam divergindo e ninguém sabia qual valia.
      // No CADASTRO ele continua editável: ali é o saldo de abertura do imóvel.
      delete payload.parcelas_pagas
      const { error } = await (supabase.from('imoveis') as any).update(payload).eq('id', editId)
      if (error) { alert('Erro ao atualizar imóvel: ' + error.message); return }
    } else {
      // empresa_id = UUID da empresa (exigido pela RLS policy)
      const { data: userData } = await supabase.auth.getUser()
      if (userData.user) {
        const { data: perf } = await supabase
          .from('perfis').select('empresa_id').eq('id', userData.user.id).single()
        if (perf?.empresa_id) payload.empresa_id = perf.empresa_id
      }
      const { error } = await (supabase.from('imoveis') as any).insert(payload)
      if (error) { alert('Erro ao cadastrar imóvel: ' + error.message); return }
    }
    setShowForm(false); setEditId(null); refetch(); setForm(FORM_INICIAL)
  }

  const handleExcluir = async (id: string, titulo: string) => {
    if (!confirm(`Excluir o imóvel "${titulo}"?`)) return
    console.log('[TabImoveis] Tentando deletar imóvel id=', id)
    const { error, data } = await (supabase.from('imoveis') as any).delete().eq('id', id).select()
    console.log('[TabImoveis] Resultado delete:', { error, data })
    if (error) {
      alert(`❌ Erro ao excluir: ${error.message}\n\nCódigo: ${error.code}`)
      return
    }
    if (!data || data.length === 0) {
      alert(`⚠️ Nenhum registro deletado. Possível restrição de permissão (RLS) no banco.\n\nID: ${id}`)
      return
    }
    refetch()
  }

  const handleEdit = (im: Imovel) => {
    setForm({
      titulo: im.titulo, endereco: im.endereco || '', tipo_imovel: im.tipo_imovel,
      area_m2: im.area_m2 ? String(im.area_m2) : '', quartos: im.quartos ? String(im.quartos) : '',
      vagas: im.vagas ? String(im.vagas) : '',
      valor_compra: im.valor_compra ? String(im.valor_compra) : '',
      valor_mercado: im.valor_mercado ? String(im.valor_mercado) : '',
      status: im.status, construtora: im.construtora || '', unidade: im.unidade || '',
      valor_total_contrato: im.valor_total_contrato ? String(im.valor_total_contrato) : '',
      valor_parcela: im.valor_parcela ? String(im.valor_parcela) : '',
      parcelas_total: im.parcelas_total ? String(im.parcelas_total) : '',
      parcelas_pagas: im.parcelas_pagas ? String(im.parcelas_pagas) : '0',
      indexador: im.indexador || '', data_aquisicao: im.data_aquisicao || '',
      proximo_vencimento: im.proximo_vencimento || '',
      dia_vencimento: im.dia_vencimento ? String(im.dia_vencimento) : '',
      periodicidade: im.periodicidade || 'mensal',
      categoria_financeira: im.categoria_financeira || 'Financiamento Imobiliário',
      taxa_juros_anual: im.taxa_juros_anual ? String(im.taxa_juros_anual) : '',
      is_investimento: im.is_investimento || false,
      observacoes: im.observacoes || '',
    })
    setEditId(im.id); setShowForm(true)
  }

  const mudarStatus = async (id: string, status: Imovel['status']) => {
    const { error } = await (supabase.from('imoveis') as any).update({ status }).eq('id', id)
    if (error) { alert('Erro ao mudar status: ' + error.message); return }
    refetch()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-fg">🏠 Carteira de Imóveis</h2>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => {
            exportCSV(`imoveis_${new Date().toISOString().slice(0,10)}.csv`,
              ['Título','Tipo','Status','Construtora','Unidade','Valor Compra','Valor Mercado','Contrato Total','Parcela','Pagas','Total','Taxa% a.a.','Indexador','Data Aquisição'],
              imoveis.map(im => [
                im.titulo, im.tipo_imovel, im.status,
                im.construtora||'', im.unidade||'',
                im.valor_compra??'', im.valor_mercado??'',
                im.valor_total_contrato??'', im.valor_parcela??'',
                im.parcelas_pagas??'', im.parcelas_total??'',
                im.taxa_juros_anual??'', im.indexador||'',
                im.data_aquisicao||'',
              ])
            )
          }} className="btn-secondary text-xs">📥 Exportar CSV</button>
          <button onClick={async () => {
            const { exportPDF } = await import('@/lib/export-utils')
            await exportPDF(
              `imoveis_${new Date().toISOString().slice(0,10)}.pdf`,
              '🏠 Carteira de Imóveis', `Total: ${imoveis.length} imóveis`,
              ['Título','Tipo','Status','Valor Compra','Valor Mercado','Parcelas','Taxa'],
              imoveis.map(im => [[im.titulo],[im.tipo_imovel],[im.status],
                [im.valor_compra ? `R$ ${im.valor_compra.toLocaleString('pt-BR')}` : '—'],
                [im.valor_mercado ? `R$ ${im.valor_mercado.toLocaleString('pt-BR')}` : '—'],
                [`${im.parcelas_pagas||0}/${im.parcelas_total||0}`],
                [im.taxa_juros_anual ? `${im.taxa_juros_anual}% a.a.` : '—']
              ])
            )
          }} className="btn-secondary text-xs">📄 Exportar PDF</button>
          <button onClick={() => setShowImportIA(true)} className="btn-secondary text-xs">
            🤖 Importar Documento
          </button>
          <button onClick={() => {
            if (showForm) { setShowForm(false); setEditId(null); setForm(FORM_INICIAL) }
            else setShowForm(true)
          }} className="btn-primary text-xs">
            {showForm ? '✕ Cancelar' : '+ Cadastrar Imóvel'}
          </button>
        </div>
      </div>

      {/* Formulário manual */}
      {showForm && (
        <form onSubmit={handleSalvar} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Título / Apelido *</label>
              <input className="input mt-1" required value={form.titulo}
                onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
                placeholder="Ex: Apto 302 Centro" />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo_imovel} onChange={e => setForm(f => ({...f, tipo_imovel: e.target.value as any}))}>
                <option value="residencial">Residencial</option>
                <option value="comercial">Comercial</option>
                <option value="galpao">Galpão</option>
                <option value="terreno">Terreno</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Construtora / Incorporadora</label>
              <input className="input mt-1" value={form.construtora}
                onChange={e => setForm(f => ({...f, construtora: e.target.value}))}
                placeholder="Ex: VCA Empreendimentos" />
            </div>
            <div>
              <label className="label">Unidade / Bloco</label>
              <input className="input mt-1" value={form.unidade}
                onChange={e => setForm(f => ({...f, unidade: e.target.value}))}
                placeholder="Ex: BL29-APT06" />
            </div>
          </div>
          <div>
            <label className="label">Endereço Completo</label>
            <input className="input mt-1" value={form.endereco}
              onChange={e => setForm(f => ({...f, endereco: e.target.value}))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Área (m²)</label><input type="number" className="input mt-1" value={form.area_m2} onChange={e => setForm(f => ({...f, area_m2: e.target.value}))} /></div>
            <div><label className="label">Quartos</label><input type="number" className="input mt-1" value={form.quartos} onChange={e => setForm(f => ({...f, quartos: e.target.value}))} /></div>
            <div><label className="label">Vagas</label><input type="number" className="input mt-1" value={form.vagas} onChange={e => setForm(f => ({...f, vagas: e.target.value}))} /></div>
          </div>

          {/* Separador financiamento */}
          <p className="text-[10px] text-fg-tertiary uppercase tracking-widest pt-1 border-t border-border-subtle">💰 Valores e Parcelamento</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Valor Total do Contrato (R$)</label><input type="number" step="0.01" className="input mt-1" value={form.valor_total_contrato} onChange={e => setForm(f => ({...f, valor_total_contrato: e.target.value, valor_compra: e.target.value}))} /></div>
            <div><label className="label">Valor de Mercado (R$)</label><input type="number" step="0.01" className="input mt-1" value={form.valor_mercado} onChange={e => setForm(f => ({...f, valor_mercado: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="label">Valor Parcela</label><input type="number" step="0.01" className="input mt-1" value={form.valor_parcela} onChange={e => setForm(f => ({...f, valor_parcela: e.target.value}))} /></div>
            <div><label className="label">Parcelas Total</label><input type="number" className="input mt-1" value={form.parcelas_total} onChange={e => setForm(f => ({...f, parcelas_total: e.target.value}))} /></div>
            <div>
              <label className="label">Parcelas Pagas</label>
              {editId ? (
                <>
                  <div className="input mt-1 flex items-center justify-between bg-white/5 text-fg-tertiary cursor-not-allowed">
                    <span className="tabular-nums text-fg">
                      {form.parcelas_pagas || 0}{form.parcelas_total ? ` de ${form.parcelas_total}` : ''}
                    </span>
                    {form.parcelas_total && (
                      <span className="text-[10px] uppercase tracking-wide">
                        faltam {Math.max(0, (parseInt(form.parcelas_total) || 0) - (parseInt(form.parcelas_pagas) || 0))}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-fg-tertiary mt-1 leading-relaxed">
                    🔒 Este número não é editável. Para marcar parcelas como pagas use
                    <strong> Pagar Boleto</strong> (paga agora, debita a conta) ou
                    <strong> Registrar parcelas já pagas</strong> (só registra o histórico,
                    sem debitar) — os dois pedem a data e a conta de origem.
                  </p>
                </>
              ) : (
                <>
                  <input type="number" className="input mt-1" value={form.parcelas_pagas}
                    onChange={e => setForm(f => ({...f, parcelas_pagas: e.target.value}))} />
                  <p className="text-[10px] text-fg-tertiary mt-1">
                    Saldo de abertura: quantas parcelas já foram pagas antes de cadastrar aqui.
                    Depois de salvo, só muda por pagamento registrado.
                  </p>
                </>
              )}
            </div>
            <div>
              <label className="label">Indexador</label>
              <select className="input mt-1" value={form.indexador} onChange={e => setForm(f => ({...f, indexador: e.target.value}))}>
                <option value="">—</option>
                <option value="INCC-M">INCC-M</option>
                <option value="IPCA">IPCA</option>
                <option value="IGP-M">IGP-M</option>
                <option value="REAL">REAL (sem correção)</option>
              </select>
            </div>
          </div>
          {/* Vencimento, Periodicidade e Categoria (campos automatizados) */}
          <p className="text-[10px] text-fg-tertiary uppercase tracking-widest pt-1 border-t border-border-subtle">📅 Lançamento Automático de Parcela</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Dia do vencimento (1–31)</label>
              <input type="number" min="1" max="31" className="input mt-1" value={form.dia_vencimento}
                placeholder="Ex: 10" onChange={e => setForm(f => ({...f, dia_vencimento: e.target.value}))} />
            </div>
            <div>
              <label className="label">Periodicidade</label>
              <select className="input mt-1" value={form.periodicidade} onChange={e => setForm(f => ({...f, periodicidade: e.target.value}))}>
                <option value="mensal">Mensal</option>
                <option value="bimestral">Bimestral (a cada 2 meses)</option>
                <option value="trimestral">Trimestral (a cada 3 meses)</option>
                <option value="quadrimestral">Quadrimestral (a cada 4 meses)</option>
                <option value="semestral">Semestral (a cada 6 meses)</option>
                <option value="anual">Anual (uma vez por ano)</option>
              </select>
            </div>
            <div>
              <label className="label">Categoria financeira</label>
              <input className="input mt-1" value={form.categoria_financeira}
                placeholder="Ex: Financiamento Imobiliário"
                onChange={e => setForm(f => ({...f, categoria_financeira: e.target.value}))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Data de Aquisição</label><input type="date" className="input mt-1" value={form.data_aquisicao} onChange={e => setForm(f => ({...f, data_aquisicao: e.target.value}))} /></div>
            <div>
              <label className="label">Próximo vencimento (opcional)</label>
              <input type="date" className="input mt-1" value={form.proximo_vencimento}
                onChange={e => setForm(f => ({...f, proximo_vencimento: e.target.value}))} />
              <p className="text-[10px] text-fg-tertiary mt-1 leading-relaxed">
                Só para contrato que não cabe na conta automática (intermediárias, balão, reajuste).
                Preenchido, ele manda: a próxima parcela vence nesta data e as seguintes seguem a
                periodicidade a partir dela. Em branco, o sistema calcula pela data de aquisição.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as any}))}>
                <option value="disponivel">Disponível</option>
                <option value="alugado">Alugado</option>
                <option value="em_reforma">Em Reforma</option>
                <option value="vendido">Vendido</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 p-3 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <input 
              type="checkbox" 
              id="is_investimento"
              checked={form.is_investimento} 
              onChange={e => setForm(f => ({ ...f, is_investimento: e.target.checked }))} 
              className="w-4 h-4 rounded bg-black/20 border-white/20 accent-blue-500" 
            />
            <label htmlFor="is_investimento" className="text-sm text-blue-100 cursor-pointer select-none">
              Este imóvel também é um investimento (exibir na aba Investimentos)
            </label>
          </div>
          <div>
            <label className="label">📝 Detalhes / Bloco de Anotações</label>
            <textarea
              rows={3}
              className="input mt-1 w-full resize-y min-h-[75px]"
              value={form.observacoes}
              placeholder="Digite aqui anotações, detalhes do imóvel, informações do contrato, reformas, etc..."
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">
              {editId ? 'Salvar Alterações' : 'Salvar Imóvel'}
            </button>
          </div>
        </form>
      )}

      {/* Lista de imóveis */}
      {imoveis.length === 0 ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8">
          <EmptyState message="Nenhum imóvel cadastrado" />
          <p className="text-xs text-fg-tertiary text-center mt-2">Use o botão "🤖 Importar Documento" para importar um contrato ou saldo devedor automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {imoveis.map(im => {
            const pt = im.parcelas_total ?? 0
            const pp = im.parcelas_pagas ?? 0
            const prog = pt > 0 ? Math.min(100, Math.round((pp / pt) * 100)) : 0
            const saldoDevedor = pt > 0 && im.valor_parcela ? (pt - pp) * im.valor_parcela : null

            return (
              <div key={im.id} className="bg-page border border-border-subtle rounded-xl p-5 hover:border-border transition-colors">
                {/* Header do card */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-fg">{im.titulo}</h3>
                    <p className="text-xs text-fg-tertiary capitalize">{im.tipo_imovel}</p>
                    {im.construtora && <p className="text-[10px] text-fg-disabled mt-0.5">🏗️ {im.construtora}{im.unidade ? ` · ${im.unidade}` : ''}</p>}
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <select className={cn('text-[10px] px-2 py-1 rounded-full border bg-page outline-none', STATUS_CONFIG[im.status].color)}
                      value={im.status} onChange={e => mudarStatus(im.id, e.target.value as Imovel['status'])}>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <button onClick={() => handleEdit(im)} className="text-fg-disabled hover:text-blue-400 transition-colors" title="Editar">✏️</button>
                    <button onClick={() => handleExcluir(im.id, im.titulo)} className="text-fg-disabled hover:text-red-400 transition-colors" title="Excluir">🗑️</button>
                  </div>
                </div>

                {im.endereco && <p className="text-[10px] text-fg-secondary mb-3 line-clamp-1">📍 {im.endereco}</p>}

                <div className="flex gap-4 mb-3">
                  {im.area_m2 && <div className="text-xs text-fg-tertiary">📏 <span className="text-fg-secondary font-medium">{im.area_m2}m²</span></div>}
                  {im.quartos && <div className="text-xs text-fg-tertiary">🛏️ <span className="text-fg-secondary font-medium">{im.quartos}</span></div>}
                  {im.data_aquisicao && <div className="text-xs text-fg-tertiary">📅 <span className="text-fg-secondary font-medium">{new Date(im.data_aquisicao + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}</span></div>}
                  {im.proximo_vencimento && <div className="text-xs text-fg-tertiary">🔗 próx. venc. <span className="text-fg-secondary font-medium">{new Date(im.proximo_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</span></div>}
                </div>

                {/* Parcelamento */}
                {pt > 0 && (
                  <div className="mb-3 p-3 rounded-xl bg-surface border border-border-subtle space-y-3">
                    {/* Título do bloco */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-fg-tertiary uppercase tracking-wider">
                        📦 Parcelamento {im.indexador ? `· ${im.indexador}` : ''} {im.periodicidade && im.periodicidade !== 'mensal' ? `· (${im.periodicidade.toUpperCase()})` : ''}
                      </span>
                      {im.taxa_juros_anual && (
                        <span className="text-[10px] text-fg-disabled">📊 {im.taxa_juros_anual}% a.a.</span>
                      )}
                    </div>

                    {/* KPIs de parcelas — 4 caixas */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-emerald-400 uppercase font-semibold">✅ Pagas</p>
                        <p className="text-base font-bold text-emerald-400">{pp}</p>
                      </div>
                      <div className="bg-surface border border-border-subtle rounded-lg p-2 text-center">
                        <p className="text-[9px] text-fg-tertiary uppercase font-semibold">Total</p>
                        <p className="text-base font-bold text-fg">{pt}</p>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-amber-400 uppercase font-semibold">⏳ Faltam</p>
                        <p className="text-base font-bold text-amber-400">{pt - pp}</p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-center">
                        <p className="text-[9px] text-blue-400 uppercase font-semibold">% Pago</p>
                        <p className="text-base font-bold text-blue-400">{prog}%</p>
                      </div>
                    </div>

                    <p className="text-[9px] text-fg-disabled leading-snug">
                      "Pagas" é quanto já foi quitado. O botão abaixo mostra o número da
                      <strong> próxima</strong> parcela, que é sempre a seguinte a essa.
                    </p>

                    {/* Barra de progresso */}
                    <div>
                      <div className="flex justify-between text-[10px] text-fg-tertiary mb-1">
                        <span>{pp} parcela{pp !== 1 ? 's' : ''} paga{pp !== 1 ? 's' : ''}</span>
                        <span className="font-semibold" style={{ color: prog >= 90 ? '#10b981' : prog >= 50 ? '#3b82f6' : '#f59e0b' }}>
                          {prog}% concluído
                        </span>
                      </div>
                      <div className="h-3 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${prog}%`,
                            background: prog >= 90
                              ? 'linear-gradient(90deg, #10b981, #34d399)'
                              : prog >= 50
                              ? 'linear-gradient(90deg, #3b82f6, #60a5fa)'
                              : 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-fg-disabled mt-0.5">
                        <span>Próxima: parcela nº {pp + 1 <= pt ? pp + 1 : pt} de {pt}</span>
                        {im.dia_vencimento && <span>Vence dia {im.dia_vencimento}</span>}
                      </div>
                    </div>

                    {/* Valores: parcela + saldo restante */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border-subtle/60">
                      {im.valor_parcela && (
                        <div>
                          <p className="text-[9px] text-fg-disabled uppercase">Parcela ({im.periodicidade || 'mensal'})</p>
                          <p className="text-xs font-bold text-amber-400">{formatCurrency(im.valor_parcela)}</p>
                        </div>
                      )}
                      {saldoDevedor !== null && (
                        <div>
                          <p className="text-[9px] text-fg-disabled uppercase">Saldo restante est.</p>
                          <p className="text-xs font-bold text-red-400">{formatCurrency(saldoDevedor)}</p>
                        </div>
                      )}
                    </div>

                    {/* Botões de ação */}
                    <div className="flex gap-2 flex-wrap">
                      {prog < 100 && (() => {
                        const statusPend = statusPendentesMap[im.id]
                        const isAtrasado = statusPend?.isAtrasado
                        const pagoEsteMes = pagamentosMes[im.id] && !isAtrasado
                        const diaHoje = new Date().getDate()
                        const diaVenc = im.dia_vencimento

                        let btnClass = ""
                        let btnContent = null

                        if (pagoEsteMes) {
                          btnClass = "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                          btnContent = <>✅ {pp} de {pt} pagas · em dia este mês</>
                        } else if (isAtrasado) {
                          btnClass = "bg-red-500/10 border border-red-500/30 text-red-400 hover:bg-red-500/20 font-bold"
                          btnContent = <>🚨 {statusPend?.descricaoStatus || 'Atrasado'} · Pagar a nº {pp + 1}</>
                        } else if (diaVenc && diaHoje === diaVenc) {
                          // NA DATA DO VENCIMENTO: AMARELO ALERTA DESTAQUE
                          btnClass = "bg-amber-500/25 border-2 border-amber-400 text-amber-300 hover:bg-amber-500/40 animate-pulse font-bold shadow-lg shadow-amber-500/10"
                          btnContent = <>⏰ Vence hoje! Pagar a nº {pp + 1}</>
                        } else {
                          // A VENCER (AMARELO PADRÃO)
                          btnClass = "bg-amber-500/10 border border-border-subtle text-amber-400 hover:bg-amber-500/20"
                          btnContent = <>💰 Pagar a nº {pp + 1}{diaVenc ? ` (vence dia ${diaVenc})` : ''}</>
                        }

                        return (
                          <button
                            onClick={() => setImovelPagar(im)}
                            className={cn(
                              "flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center justify-center gap-1",
                              btnClass
                            )}
                          >
                            {btnContent}
                          </button>
                        )
                      })()}
                      {prog < 100 && (
                        <button
                          onClick={() => setImovelLancar(im)}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 transition-colors"
                        >
                          🗓️ Provisionar no Financeiro
                        </button>
                      )}
                      {prog < 100 && (
                        <button
                          onClick={() => setImovelRetroativo(im)}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
                        >
                          🧾 Registrar já pagas
                        </button>
                      )}
                      {prog < 100 && (
                        <button
                          onClick={() => setImovelQuitarLote(im)}
                          className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-violet-500/10 border border-violet-500/20 text-violet-400 hover:bg-violet-500/20 transition-colors"
                        >
                          ⚡ Quitar várias (debita)
                        </button>
                      )}
                      <button
                        onClick={() => setImovelAnalisar(im)}
                        className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        📈 Analisar Quitação
                      </button>
                    </div>
                  </div>
                )}

                {/* Valores */}
                <div className="pt-3 border-t border-border-subtle/80 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] text-fg-disabled uppercase tracking-widest">Valor de Compra</p>
                    <p className="text-sm font-semibold text-fg-secondary">{im.valor_compra ? formatCurrency(im.valor_compra) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-fg-disabled uppercase tracking-widest">Valor de Mercado</p>
                    <p className="text-sm font-semibold text-emerald-400">{im.valor_mercado ? formatCurrency(im.valor_mercado) : '—'}</p>
                  </div>
                </div>

                {im.observacoes && (
                  <div className="mt-3 p-2.5 bg-muted/60 border border-border-subtle rounded-xl text-xs text-fg-secondary">
                    <p className="text-[9px] text-fg-disabled uppercase tracking-widest font-semibold mb-0.5">📝 Detalhes / Anotações</p>
                    <p className="whitespace-pre-wrap leading-relaxed">{im.observacoes}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {showImportIA && (
        <ModalImportarIA onClose={() => setShowImportIA(false)} onImportado={refetch} />
      )}
      {imovelLancar && (
        <ModalLancarParcela
          imovel={imovelLancar}
          onClose={() => setImovelLancar(null)}
          onLancado={refetch}
        />
      )}
      {imovelRetroativo && (
        <ModalParcelasEmLote
          imovel={imovelRetroativo}
          modo="retroativo"
          onClose={() => setImovelRetroativo(null)}
          onConcluido={refetch}
        />
      )}
      {imovelQuitarLote && (
        <ModalParcelasEmLote
          imovel={imovelQuitarLote}
          modo="pagar"
          onClose={() => setImovelQuitarLote(null)}
          onConcluido={() => { refetch(); carregarPagamentosMes() }}
        />
      )}
      {imovelAnalisar && (
        <ModalAnalisarQuitacao item={imovelAnalisar} onClose={() => setImovelAnalisar(null)} />
      )}
      {imovelPagar && (
        <ModalPagarBoleto
          imovel={imovelPagar}
          onClose={() => setImovelPagar(null)}
          onPago={refetch}
        />
      )}
    </div>
  )
}
