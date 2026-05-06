'use client'

import { useState, useEffect } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, MetricCard, EmptyState, StatusBadge } from '@/components/shared/ui'
import { createClient } from '@/lib/supabase/client'
import { SecaoPagamentosParciais } from './_components/SecaoPagamentosParciais'
import { SecaoAuditoria } from './_components/SecaoAuditoria'
import { TabCartoes } from './_components/TabCartoes'
import { TabCartoesSeparado } from './_components/TabCartoesSeparado'
import { TabContas } from './_components/TabContas'
import { useToast } from '@/components/shared/toast'
import { TabRegistros } from '../pf-pessoal/_components/tabs/TabRegistros'
import { ModalImportarExtratoIA } from '@/components/shared/ModalImportarExtratoIA'
import { PainelComparativoMes } from '@/components/shared/PainelComparativoMes'
import { VencimentosMes } from './_components/VencimentosMes'

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
  bandeira?: 'visa' | 'mastercard' | 'elo' | 'amex' | 'hipercard' | 'outras'
  limite?: number
  dia_fechamento?: number
  dia_vencimento?: number
  conta_principal_id?: string | null
  nome_cartao?: string
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
  categoria_id?: string | null
  observacoes?: string | null
}

type CategoriaFinanceira = {
  id: string
  nome: string
  tipo: 'receita' | 'despesa' | 'investimento' | 'transferencia'
  cor: string
}

// ── Parser OFX/CSV ────────────────────────────────────────────

// Modal removido (substituído por ModalImportarExtratoIA)

// ── Bandeiras de cartão ──────────────────────────────────────
const BANDEIRAS = [
  { id: 'visa',       label: 'Visa',             emoji: '💳', cor: '#1a1f71' },
  { id: 'mastercard', label: 'Mastercard',        emoji: '🔴', cor: '#eb001b' },
  { id: 'elo',        label: 'Elo',               emoji: '🟡', cor: '#ffcb05' },
  { id: 'amex',       label: 'American Express',  emoji: '💎', cor: '#2e77bc' },
  { id: 'hipercard',  label: 'Hipercard',         emoji: '🔶', cor: '#e22c1b' },
  { id: 'outras',     label: 'Outras',            emoji: '💳', cor: '#6b7280' },
]

function BandeiraBadge({ bandeira }: { bandeira?: string }) {
  const b = BANDEIRAS.find(x => x.id === bandeira)
  if (!b) return null
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider"
      style={{ background: b.cor + '22', color: b.cor, border: `1px solid ${b.cor}44` }}>
      {b.emoji} {b.label}
    </span>
  )
}

// ── Modal Conta ───────────────────────────────────────────────
function ModalConta({ onClose, onSave, isAdmin = false }: {
  onClose: () => void
  onSave: () => void
  isAdmin?: boolean
}) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [abaModal, setAbaModal] = useState<'principal' | 'secundarias'>('principal')
  const [form, setForm] = useState({
    nome: '',
    tipo: 'corrente' as Conta['tipo'],
    categoria: 'pj' as Conta['categoria'],
    saldo_inicial: '',
    cor: '#7c5cfc',
    bandeira: 'visa' as string,
    nome_cartao: '',
    limite: '',
    dia_fechamento: '10',
    dia_vencimento: '17',
  })
  // Contas secundárias
  const [subContas, setSubContas] = useState<{nome: string; banco: string; tipo: string; saldo: string}[]>([])
  const [novaSubConta, setNovaSubConta] = useState({ nome: '', banco: '', tipo: 'corrente', saldo: '' })
  const isCartao = form.tipo === 'cartao_credito' || form.tipo === 'cartao_debito'
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const saldo = parseFloat(form.saldo_inicial) || 0
    const payload: any = {
      nome: form.nome,
      tipo: form.tipo,
      categoria: form.categoria,
      saldo_inicial: saldo,
      saldo_atual: saldo,
      ativo: true,
      cor: form.cor,
    }
    if (isCartao) {
      payload.bandeira       = form.bandeira
      payload.nome_cartao    = form.nome_cartao || form.nome
      payload.limite         = parseFloat(form.limite) || null
      payload.dia_fechamento = parseInt(form.dia_fechamento) || null
      payload.dia_vencimento = parseInt(form.dia_vencimento) || null
    }
    const { data: contaCriada, error } = await (supabase.from('contas') as any).insert(payload).select().single()
    if (!error && contaCriada && subContas.length > 0) {
      // Salva contas secundárias (outros bancos) vinculadas
      await Promise.all(subContas.map(sc =>
        (supabase.from('contas') as any).insert({
          nome: sc.banco ? `${sc.banco} — ${sc.nome}` : sc.nome,
          tipo: sc.tipo,
          categoria: form.categoria,
          saldo_inicial: parseFloat(sc.saldo) || 0,
          saldo_atual: parseFloat(sc.saldo) || 0,
          ativo: true,
          cor: form.cor,
          conta_principal_id: contaCriada.id,
        })
      ))
    }
    setLoading(false)
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <h2 className="text-sm font-semibold text-fg">Nova Conta</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl leading-none">×</button>
        </div>

      {/* Abas — Contas Secundárias só para admin */}
      <div className="flex border-b border-border-subtle">
        <button onClick={() => setAbaModal('principal')}
          className={cn('flex-1 py-2.5 text-xs font-semibold transition-colors',
            abaModal === 'principal' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-fg-tertiary hover:text-fg-secondary'
          )}>
          🏦 Dados Principais
        </button>
        {isAdmin && (
          <button onClick={() => setAbaModal('secundarias')}
            className={cn('flex-1 py-2.5 text-xs font-semibold transition-colors',
              abaModal === 'secundarias' ? 'text-amber-400 border-b-2 border-amber-400' : 'text-fg-tertiary hover:text-fg-secondary'
            )}>
            🔒 Contas Secundárias {subContas.length > 0 ? `(${subContas.length})` : ''}
          </button>
        )}
      </div>

        <form onSubmit={handleSubmit}>
          {/* ── ABA PRINCIPAL ─────────────────────────── */}
          {abaModal === 'principal' && (
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Nome da Conta *</label>
                <input className="input mt-1" required value={form.nome}
                  placeholder="Ex: Nubank PJ, Itaú PF..."
                  onChange={e => set('nome', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Classificação</label>
                  <select className="input mt-1" value={form.categoria} onChange={e => set('categoria', e.target.value)}>
                    <option value="pj">PJ (Empresa)</option>
                    <option value="pf">PF (Pessoal)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Tipo</label>
                  <select className="input mt-1" value={form.tipo} onChange={e => set('tipo', e.target.value)}>
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                    <option value="cartao_debito">Cartão de Débito</option>
                    <option value="investimento">Investimento</option>
                    <option value="dinheiro">Dinheiro (espécie)</option>
                  </select>
                </div>
              </div>

              {/* Campos para cartão: só nome e bandeira */}
              {isCartao && (
                <div className="p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl space-y-3">
                  <p className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">💳 Dados do Cartão</p>
                  <div>
                    <label className="label">Nome do Cartão</label>
                    <input className="input mt-1" value={form.nome_cartao}
                      placeholder="Ex: Cartão da Esposa, Cartão PJ, Nubank Roxinho..."
                      onChange={e => set('nome_cartao', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Bandeira</label>
                    <div className="grid grid-cols-3 gap-2 mt-1">
                      {BANDEIRAS.map(b => (
                        <button type="button" key={b.id}
                          onClick={() => set('bandeira', b.id)}
                          className={cn(
                            'flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border transition-all',
                            form.bandeira === b.id
                              ? 'border-amber-500/60 bg-amber-500/15 text-amber-300'
                              : 'border-border-subtle text-fg-tertiary hover:border-border hover:text-fg'
                          )}>
                          <span>{b.emoji}</span> {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Saldo Atual (R$)</label>
                <input className="input mt-1" type="number" step="0.01" value={form.saldo_inicial}
                  placeholder="0.00" onChange={e => set('saldo_inicial', e.target.value)} />
              </div>
              <div>
                <label className="label">Cor de identificação</label>
                <div className="flex items-center gap-2 mt-1">
                  <input type="color" value={form.cor} onChange={e => set('cor', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border-subtle cursor-pointer bg-transparent" />
                  <span className="text-xs text-fg-tertiary">Usada para identificar a conta nos gráficos</span>
                </div>
              </div>
            </div>
          )}

          {/* ── ABA CONTAS SECUNDÁRIAS ────────────────── */}
          {abaModal === 'secundarias' && (
            <div className="p-5 space-y-4">
              <div className="p-3 bg-blue-500/8 border border-blue-500/20 rounded-xl">
                <p className="text-xs text-blue-400 font-medium mb-1">🏦 Contas de Outros Bancos</p>
                <p className="text-[11px] text-fg-tertiary">
                  Cadastre contas vinculadas em outros bancos (ex: conta no Itaú, Bradesco, Caixa...).
                  Serão criadas automaticamente ao salvar.
                </p>
              </div>

              {subContas.length > 0 && (
                <div className="space-y-2">
                  {subContas.map((sc, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 border border-border-subtle rounded-xl px-3 py-2">
                      <span className="text-lg">🏦</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-fg truncate">
                          {sc.banco ? `${sc.banco} — ` : ''}{sc.nome}
                        </p>
                        <p className="text-[10px] text-fg-tertiary capitalize">
                          {sc.tipo} {sc.saldo ? `· Saldo: R$ ${sc.saldo}` : ''}
                        </p>
                      </div>
                      <button type="button"
                        onClick={() => setSubContas(prev => prev.filter((_, j) => j !== i))}
                        className="text-fg-disabled hover:text-red-400 text-xs">✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="border border-dashed border-border-subtle rounded-xl p-4 space-y-3">
                <p className="text-[10px] text-fg-tertiary uppercase tracking-wider font-semibold">+ Nova conta em outro banco</p>
                <div>
                  <label className="label">Nome do Banco</label>
                  <select className="input mt-1" value={novaSubConta.banco}
                    onChange={e => setNovaSubConta(f => ({ ...f, banco: e.target.value }))}>
                    <option value="">Selecione o banco...</option>
                    <option value="Itaú">🟠 Itaú</option>
                    <option value="Bradesco">🔴 Bradesco</option>
                    <option value="Santander">🔴 Santander</option>
                    <option value="Caixa">🔵 Caixa Econômica</option>
                    <option value="Banco do Brasil">🟡 Banco do Brasil</option>
                    <option value="Nubank">🟣 Nubank</option>
                    <option value="Inter">🟠 Banco Inter</option>
                    <option value="C6 Bank">⚫ C6 Bank</option>
                    <option value="XP">🟡 XP Investimentos</option>
                    <option value="BTG">🔵 BTG Pactual</option>
                    <option value="Sicoob">🟢 Sicoob</option>
                    <option value="Sicredi">🟢 Sicredi</option>
                    <option value="Outro">🏦 Outro</option>
                  </select>
                </div>
                <div>
                  <label className="label">Nome / Apelido da Conta</label>
                  <input className="input mt-1" value={novaSubConta.nome}
                    placeholder="Ex: Conta PJ Itaú, Poupança Bradesco..."
                    onChange={e => setNovaSubConta(f => ({ ...f, nome: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Tipo</label>
                    <select className="input mt-1" value={novaSubConta.tipo}
                      onChange={e => setNovaSubConta(f => ({ ...f, tipo: e.target.value }))}>
                      <option value="corrente">Conta Corrente</option>
                      <option value="poupanca">Poupança</option>
                      <option value="investimento">Investimento</option>
                      <option value="dinheiro">Dinheiro (espécie)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Saldo Inicial (R$)</label>
                    <input className="input mt-1" type="number" step="0.01" value={novaSubConta.saldo}
                      placeholder="0.00"
                      onChange={e => setNovaSubConta(f => ({ ...f, saldo: e.target.value }))} />
                  </div>
                </div>
                <button type="button"
                  onClick={() => {
                    if (!novaSubConta.nome.trim() && !novaSubConta.banco) return
                    setSubContas(prev => [...prev, novaSubConta])
                    setNovaSubConta({ nome: '', banco: '', tipo: 'corrente', saldo: '' })
                  }}
                  className="btn-secondary w-full text-xs">
                  + Adicionar à lista
                </button>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 px-5 pb-5">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : `Criar Conta${subContas.length > 0 ? ` + ${subContas.length} Secundária(s)` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalLancamento({
  onClose, onSave, contas, categorias, lancamentoEdit
}: {
  onClose: () => void
  onSave: () => void
  contas: Conta[]
  categorias: CategoriaFinanceira[]
  lancamentoEdit?: Lancamento | null
}) {
  const { insert, update, loading } = useSupabaseMutation('lancamentos')
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    conta_id: lancamentoEdit?.conta_id ?? contas[0]?.id ?? '',
    descricao: lancamentoEdit?.descricao ?? '',
    valor: lancamentoEdit?.valor?.toString() ?? '',
    tipo: lancamentoEdit?.tipo ?? 'despesa',
    regime: lancamentoEdit?.regime ?? 'caixa',
    data_competencia: lancamentoEdit?.data_competencia ?? today,
    categoria_id: lancamentoEdit?.categoria_id ?? '',
    total_parcelas: lancamentoEdit?.total_parcelas?.toString() ?? '1',
    observacoes: '',
    taxa_cartao: '0',
  })

  const categoriasFiltradas = categorias.filter(c => c.tipo === form.tipo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const valor = parseFloat(form.valor.replace(',', '.'))
    if (!valor || valor <= 0) return
    const parcelas = parseInt(form.total_parcelas) || 1

    if (parcelas > 1) {
      // Lançamento parcelado — insere cada parcela individualmente
      const supabase = createClient()
      for (let i = 1; i <= parcelas; i++) {
        const data = new Date(form.data_competencia)
        data.setMonth(data.getMonth() + (i - 1))
        await (supabase.from('lancamentos') as any).insert({
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
      // Taxa de cartão (se houver)
      const taxa = parseFloat(form.taxa_cartao)
      if (taxa > 0) {
        let valorTaxa = 0
        if (form.taxa_cartao === 'boleto') valorTaxa = 2.50
        else valorTaxa = valor * (taxa / 100)
        await insert({
           conta_id: form.conta_id,
           descricao: `Taxa Auto: ${form.descricao}`,
           valor: valorTaxa,
           tipo: 'despesa',
           regime: form.regime,
           status: 'pendente',
           data_competencia: form.data_competencia,
           categoria_id: null,
           total_parcelas: 1,
        } as any)
      }
    } else {
      // ── Lançamento simples (1 parcela) ou Edição ──────────────────────
      const payload = {
        conta_id: form.conta_id,
        descricao: form.descricao,
        valor,
        tipo: form.tipo,
        regime: form.regime,
        data_competencia: form.data_competencia,
        categoria_id: form.categoria_id || null,
        total_parcelas: parcelas,
      } as any

      if (lancamentoEdit) {
        await update(lancamentoEdit.id, payload)
      } else {
        await insert({ ...payload, status: 'pendente' })
      }
    }
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg p-6 shadow-2xl overflow-y-auto max-h-screen">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">{lancamentoEdit ? '✏️ Editar Lançamento' : 'Novo Lançamento'}</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl leading-none">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-4 gap-1 bg-muted/50 p-1 rounded-lg">
            {(['despesa', 'receita', 'investimento', 'transferencia'] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setForm(f => ({ ...f, tipo: t, categoria_id: '' }))}
                className={cn('py-1.5 rounded-md text-xs font-medium transition-colors capitalize',
                  form.tipo === t
                    ? t === 'receita' ? 'bg-emerald-500/20 text-emerald-400'
                      : t === 'despesa' ? 'bg-red-500/20 text-red-400'
                      : t === 'investimento' ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-surface-hover text-fg-secondary'
                    : 'text-fg-tertiary hover:text-fg-secondary'
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
              <label className="label">Valor Bruto (R$) *</label>
              <input className="input mt-1" required type="number" step="0.01" min="0.01"
                value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))}
                placeholder="0.00" />
            </div>
            <div>
              <label className="label">Parcelas</label>
              <input className="input mt-1" type="number" min="1" max="60"
                value={form.total_parcelas}
                disabled={!!lancamentoEdit}
                onChange={e => setForm(f => ({ ...f, total_parcelas: e.target.value }))} />
            </div>
          </div>
          
          {form.tipo === 'receita' && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
              <label className="label text-amber-500 mb-1 flex items-center gap-1">⚡ Taxa Automática (Gateway/Cartão)</label>
              <select className="input text-xs" value={form.taxa_cartao} onChange={e => setForm(f => ({ ...f, taxa_cartao: e.target.value }))}>
                 <option value="0">Não gerar taxa automática</option>
                 <option value="1.5">Cartão de Débito (1.5%)</option>
                 <option value="3.5">Cartão de Crédito (3.5%)</option>
                 <option value="4.99">Parcelado 2-12x (4.99%)</option>
                 <option value="boleto">Boleto (R$ 2,50 fixo)</option>
              </select>
              <p className="text-[10px] text-amber-500/80 mt-1">Gera uma debito paralelo automaticamente para bater com o recebimento líquido na conta.</p>
            </div>
          )}

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
              {loading ? 'Salvando...' : lancamentoEdit ? 'Salvar Alterações' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Client Component ────────────────────────────────────────────

export default function FinanceiroClient() {
  const [view, setView] = useState<'contas' | 'cartoes' | 'resumo' | 'registros'>('contas')
  const [modalLancamento, setModalLancamento] = useState(false)
  const [lancamentoEdit, setLancamentoEdit] = useState<Lancamento | null>(null)
  const [modalConta, setModalConta] = useState(false)
  const [modalImport, setModalImport] = useState(false)
  const [modalVencimentos, setModalVencimentos] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [busca, setBusca] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [authUserId, setAuthUserId] = useState('')
  const { success, error: toastError } = useToast()
  const { update: updateLancamento, remove: removeLancamento } = useSupabaseMutation('lancamentos')
  const { remove: removeConta } = useSupabaseMutation('contas')

  // Detecta se é admin (admin = email NÃO está em funcionarios)
  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: func } = await (supabase.from('funcionarios') as any)
        .select('id')
        .eq('email', user.email || '')
        .maybeSingle()
      setIsAdmin(!func) // admin = não está na tabela funcionarios
    }
    checkAdmin()
  }, [])

  // Carrega userId para a aba de registros
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setAuthUserId(data.user.id)
    })
  }, [])

  const { data: contas, refetch: refetchContas } = useSupabaseQuery<Conta>('contas', { filters: { ativo: true, categoria: 'pj' } })
  const { data: categorias } = useSupabaseQuery<CategoriaFinanceira>('categorias_financeiras', { orderBy: { column: 'nome', ascending: true } })
  const { data: lancamentos, refetch: refetchLancamentos } = useSupabaseQuery<Lancamento>('lancamentos', {
    orderBy: { column: 'data_competencia', ascending: false },
    limit: 100
  })

  const validarLancamento = async (id: string, descricao: string) => {
    const resultado = await updateLancamento(id, {
      status: 'validado',
      conciliado: true,
      data_caixa: new Date().toISOString().split('T')[0],
    })
    if (resultado.error) {
      toastError('Erro ao confirmar: ' + resultado.error)
    } else {
      refetchLancamentos()
      success(`"${descricao}" confirmado como pago/recebido!`)
    }
  }

  const handleEditLancamento = (lancamento: Lancamento) => {
    setLancamentoEdit(lancamento)
    setModalLancamento(true)
  }

  const handleDeleteLancamento = async (id: string) => {
    if (!confirm('Deseja realmente excluir este lançamento?')) return
    const res = await removeLancamento(id)
    if (!res.error) {
      refetchLancamentos()
      success('Lançamento excluído com sucesso!')
    } else {
      toastError('Erro ao excluir: ' + res.error)
    }
  }

  const handleDeleteConta = async (id: string) => {
    if (!confirm('Atenção: Deseja excluir esta conta/cartão? Todos os lançamentos vinculados a ela também serão perdidos.')) return
    const res = await removeConta(id)
    if (!res.error) {
      refetchContas()
      refetchLancamentos()
      success('Conta/Cartão excluído com sucesso!')
    } else {
      toastError('Erro ao excluir conta: ' + res.error)
    }
  }

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
        {/* Botões contextuais que mudam por aba */}
        {(view === 'contas' || view === 'cartoes') && (
          <>
            <button
              onClick={() => setModalVencimentos(true)}
              className="btn-secondary text-xs h-8 px-3 flex items-center gap-1.5 print:hidden"
            >
              📋 Vencimentos
            </button>
            <button
              onClick={() => setModalImport(true)}
              className="btn-secondary text-xs h-8 px-3 flex items-center gap-1.5 print:hidden"
            >
              📥 {view === 'cartoes' ? 'Importar Extrato Cartão' : 'Importar Extrato'}
            </button>
          </>
        )}
        {view === 'contas' && (
          <button
            onClick={() => setModalConta(true)}
            className="btn-secondary text-xs h-8 px-3 print:hidden"
          >
            + Conta
          </button>
        )}
        <button onClick={() => window.print()} className="btn-secondary flex items-center gap-2 print:hidden" title="Exportar para PDF ou Imprimir">🖨️ PDF / Imprimir</button>
        <button
          onClick={() => { setLancamentoEdit(null); setModalLancamento(true) }}
          className="btn-primary print:hidden"
          disabled={contas.length === 0}
        >
          + {view === 'cartoes' ? 'Lançamento Cartão' : 'Lançamento'}
        </button>
      </PageHeader>


      {/* ── VENCIMENTOS DO MÊS (MODAL) ─────────────────────────────────── */}
      <VencimentosMes
        isOpen={modalVencimentos}
        onClose={() => setModalVencimentos(false)}
        onVerDetalhes={() => {
          setModalVencimentos(false)
          setView('registros')
        }}
      />

      {/* ── COMPARATIVO MENSAL PJ ─────────────────────────────── */}
      <div className="mb-6">
        <PainelComparativoMes
          lancamentos={lancamentos.map(l => ({
            data: l.data_competencia ?? '',
            valor: l.valor,
            tipo: l.tipo,
          }))}
          campoData="data"
          campoTipo="tipo"
          valorDespesa="despesa"
          valorReceita="receita"
          titulo="Comparativo Mensal PJ"
        />
      </div>



      {/* Tabs Menu Superior */}
      <div className="flex items-center gap-1 bg-page border border-border-subtle rounded-xl p-1 w-fit mb-6">
        {([
          { id: 'contas',     label: '🏦 Contas'     },
          { id: 'cartoes',    label: '💳 Cartões'  },
          { id: 'resumo',     label: '📊 Resumo'     },
          { id: 'registros',  label: '🗂️ Registros' },
        ] as const).map(tab => (
          <button key={tab.id} onClick={() => setView(tab.id)}
            className={cn('px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              view === tab.id ? 'bg-muted text-fg' : 'text-fg-tertiary hover:text-fg-secondary'
            )}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ABA CONTAS ──────────────────────────────────────── */}
      {view === 'contas' && (
        <TabContas
          contas={contas}
          lancamentos={lancamentos}
          categorias={categorias}
          onNovaConta={() => setModalConta(true)}
          onImportar={() => setModalImport(true)}
          onValidar={validarLancamento}
          onEditLancamento={handleEditLancamento}
          onDeleteLancamento={handleDeleteLancamento}
          onDeleteConta={handleDeleteConta}
        />
      )}

      {/* ── ABA CARTÕES ─────────────────────────────────────── */}
      {view === 'cartoes' && (
        <TabCartoesSeparado
          contas={contas}
          lancamentos={lancamentos}
          categorias={categorias}
          onImportar={() => setModalImport(true)}
          onRefresh={refreshAll}
          onEditLancamento={handleEditLancamento}
          onDeleteLancamento={handleDeleteLancamento}
          onDeleteConta={handleDeleteConta}
        />
      )}

      {/* ── ABA REGISTROS ────────────────────────────────── */}
      {view === 'registros' && (
        <TabRegistros userId={authUserId} />
      )}

      {/* ── ABA RESUMO (Painel Geral original) ──────────────── */}
      {view === 'resumo' && (
      <>
        {/* Métricas principais idênticas ao Início */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {/* Saldo Total */}
          <div className="bg-surface border border-white/5 rounded-xl p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(16,185,129,0.15),transparent_70%)]"></div>
            <p className="text-[10px] font-medium text-fg-secondary tracking-[0.06em] uppercase mb-2">Saldo total</p>
            <p className="font-['Syne'] text-[22px] font-bold tracking-tight mb-1 text-[#10b981]">{formatCurrency(saldoTotal)}</p>
          </div>

          {/* Receitas */}
          <div className="bg-surface border border-white/5 rounded-xl p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(124,92,252,0.12),transparent_70%)]"></div>
            <p className="text-[10px] font-medium text-fg-secondary tracking-[0.06em] uppercase mb-2">Receitas do mês</p>
            <p className="font-['Syne'] text-[22px] font-bold tracking-tight mb-1 text-[#a78bfa]">{formatCurrency(receitasMes)}</p>
          </div>

          {/* Despesas */}
          <div className="bg-surface border border-white/5 rounded-xl p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(244,63,94,0.1),transparent_70%)]"></div>
            <p className="text-[10px] font-medium text-fg-secondary tracking-[0.06em] uppercase mb-2">Despesas do mês</p>
            <p className="font-['Syne'] text-[22px] font-bold tracking-tight mb-1 text-[#f43f5e]">{formatCurrency(despesasMes)}</p>
          </div>

          {/* Resultado */}
          <div className="bg-surface border border-white/5 rounded-xl p-4 relative overflow-hidden transition-transform hover:-translate-y-0.5">
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_80%_20%,rgba(245,166,35,0.1),transparent_70%)]"></div>
            <p className="text-[10px] font-medium text-fg-secondary tracking-[0.06em] uppercase mb-2">Resultado</p>
            <p className={`font-['Syne'] text-[22px] font-bold tracking-tight mb-1 ${resultado >= 0 ? 'text-[#f5a623]' : 'text-[#f43f5e]'}`}>{formatCurrency(resultado)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Contas */}
        <div className="bg-surface border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Contas</h2>
            <button onClick={() => setModalConta(true)} className="btn-ghost text-xs">+ Conta</button>
          </div>
          {contas.length === 0 ? (
             <EmptyState message="Nenhuma conta cadastrada" />
          ) : (
            <div className="space-y-2">
              {contas.map(conta => (
                <div key={conta.id} className="flex justify-between items-center p-3 rounded-lg border border-white/5 bg-black/20 group">
                  <div>
                    <div className="flex gap-2 items-center">
                      <h3 className="text-sm font-medium text-fg">{conta.nome}</h3>
                      <StatusBadge status={conta.categoria.toUpperCase()} />
                    </div>
                    <p className="text-xs text-fg-tertiary mt-0.5 capitalize">{conta.tipo.replace('_', ' ')}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold">{formatCurrency(conta.saldo_atual)}</span>
                    <button onClick={() => handleDeleteConta(conta.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity" title="Excluir">
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Últimos lançamentos */}
        <div className="bg-surface border border-white/5 rounded-xl p-5 flex flex-col min-h-[300px] lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="section-title mb-0">Lançamentos do mês</h2>
            <div className="flex gap-2 flex-wrap">
              <input
                className="input text-xs py-1 w-36"
                placeholder="Buscar..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
              />
              <select
                className="input text-xs py-1 w-auto"
                value={filtroTipo}
                onChange={e => setFiltroTipo(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="receita">⬇ Receitas</option>
                <option value="despesa">⬆ Despesas</option>
                <option value="investimento">💰 Investimentos</option>
              </select>
            </div>
          </div>
          {lancamentosMes.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState message="Nenhum lançamento registrado neste mês" />
            </div>
          ) : (() => {
            const filtrados = lancamentosMes
              .filter(l => !filtroTipo || l.tipo === filtroTipo)
              .filter(l => !busca || l.descricao?.toLowerCase().includes(busca.toLowerCase()))
            return filtrados.length === 0 ? (
              <EmptyState message="Nenhum resultado para o filtro selecionado" />
            ) : (
             <div className="space-y-2 flex-1">
               {filtrados.slice(0, 15).map((l: Lancamento) => (
                  <div key={l.id} className="flex justify-between items-center p-3 rounded-lg border border-white/5 bg-black/20 group">
                    <div className="flex gap-3 items-center">
                       <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs ${l.tipo === 'receita' ? 'bg-emerald-500/10 text-emerald-400' : l.tipo === 'despesa' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'}`}>
                         {l.tipo === 'receita' ? '↓' : l.tipo === 'despesa' ? '↑' : '⇄'}
                       </span>
                       <div>
                         <p className="text-sm font-medium text-fg">{l.descricao}</p>
                         <p className="text-xs text-fg-tertiary whitespace-nowrap">{formatDate(l.data_competencia)} • <span className="capitalize">{l.regime}</span></p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                       <div className="text-right">
                         <p className={`text-sm font-semibold ${l.tipo === 'receita' ? 'text-emerald-400' : l.tipo === 'despesa' ? 'text-red-400' : 'text-fg'}`}>
                           {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                         </p>
                         {l.status !== 'validado' ? (
                            <button
                              onClick={() => validarLancamento(l.id, l.descricao)}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 transition-colors cursor-pointer"
                            >
                              ⏳ Pendente ✔
                            </button>
                         ) : (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-emerald-500/30 text-emerald-500 bg-emerald-500/10">Validado</span>
                         )}
                       </div>
                       <div className="flex items-center gap-1">
                         <button onClick={() => handleEditLancamento(l)} className="opacity-0 group-hover:opacity-100 text-blue-400 hover:text-blue-300 transition-opacity ml-2" title="Editar">
                           ✏️
                         </button>
                         <button onClick={() => handleDeleteLancamento(l.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-opacity ml-1" title="Excluir">
                           🗑️
                         </button>
                       </div>
                    </div>
                  </div>
               ))}
             </div>
            )
          })()}
        </div>

        {/* Previsão de caixa */}
        <div className="bg-surface border border-white/5 rounded-xl p-5 lg:col-span-2">
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
                        <p className="text-sm font-medium text-fg">{l.descricao}</p>
                        <p className="text-xs text-fg-tertiary whitespace-nowrap">Vence em: {formatDate(l.data_competencia)}</p>
                      </div>
                  </div>
                  <div className="text-right">
                      <p className={`text-sm font-semibold ${l.tipo === 'receita' ? 'text-emerald-400' : l.tipo === 'despesa' ? 'text-red-400' : 'text-fg'}`}>
                        {l.tipo === 'despesa' ? '-' : '+'}{formatCurrency(l.valor)}
                      </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Conciliação pendente */}
        <div className="bg-surface border border-white/5 rounded-xl p-5">
          <h2 className="section-title">Conciliação pendente</h2>
          {conciliacoes.length === 0 ? (
            <EmptyState message="Nada pendente" />
          ) : (
             <div className="space-y-2 mt-4">
              {conciliacoes.map((l: Lancamento) => (
                <div key={l.id} className="p-3 rounded-lg border border-white/5 bg-black/20">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm font-medium text-fg">{l.descricao}</p>
                    <p className={`text-sm font-semibold ${l.tipo === 'receita' ? 'text-emerald-400' : l.tipo === 'despesa' ? 'text-red-400' : 'text-fg'}`}>
                      {formatCurrency(l.valor)}
                    </p>
                  </div>
                  <p className="text-xs text-amber-500 mb-3">Venceu: {formatDate(l.data_competencia)}</p>
                  <button
                    onClick={() => validarLancamento(l.id, l.descricao)}
                    className="w-full text-xs font-semibold px-3 py-1.5 rounded-md border border-border-subtle hover:border-emerald-500/50 hover:bg-emerald-500/10 hover:text-emerald-400 transition-all"
                  >
                    ✓ Confirmar Pgto. / Recebimento
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recorrências */}
        <div className="bg-surface border border-white/5 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Recorrências ativas</h2>
            <button className="btn-ghost text-xs">+ Nova</button>
          </div>
          <EmptyState message="Nenhuma recorrência configurada" />
        </div>

        {/* Receitas vs Despesas — dados reais */}
        <div className="bg-surface border border-white/5 rounded-xl p-5 lg:col-span-2">
          <h2 className="section-title mb-4">Receitas vs Despesas — últimos 6 meses</h2>
          {(() => {
            // Gera os últimos 6 meses
            const meses = Array.from({ length: 6 }, (_, i) => {
              const d = new Date()
              d.setMonth(d.getMonth() - (5 - i))
              return {
                prefix: d.toISOString().substring(0, 7),
                label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
              }
            })
            const data = meses.map(m => ({
              label: m.label,
              receita: lancamentos.filter(l => l.tipo === 'receita' && l.data_competencia?.startsWith(m.prefix)).reduce((a, l) => a + l.valor, 0),
              despesa: lancamentos.filter(l => l.tipo === 'despesa' && l.data_competencia?.startsWith(m.prefix)).reduce((a, l) => a + l.valor, 0),
            }))
            const maxVal = Math.max(...data.flatMap(d => [d.receita, d.despesa]), 1)
            const hasData = data.some(d => d.receita > 0 || d.despesa > 0)
            return hasData ? (
              <div className="flex items-end justify-between gap-2 h-36 px-2 border-b border-border-subtle pb-2">
                {data.map((d, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex items-end justify-center gap-1 h-28">
                      <div
                        title={`Receita: R$ ${d.receita.toFixed(2)}`}
                        className="w-1/2 bg-emerald-500/70 hover:bg-emerald-500 rounded-t transition-all"
                        style={{ height: `${(d.receita / maxVal) * 100}%`, minHeight: d.receita > 0 ? '4px' : '0' }}
                      />
                      <div
                        title={`Despesa: R$ ${d.despesa.toFixed(2)}`}
                        className="w-1/2 bg-red-500/70 hover:bg-red-500 rounded-t transition-all"
                        style={{ height: `${(d.despesa / maxVal) * 100}%`, minHeight: d.despesa > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <span className="text-[10px] text-fg-disabled capitalize">{d.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-36 flex flex-col items-center justify-center gap-2">
                <p className="text-xs text-fg-disabled">Nenhum lançamento ainda. Registre receitas e despesas para ver o gráfico.</p>
                <div className="flex gap-4 text-[10px] text-zinc-700">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500/70 inline-block"/> Receitas</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/70 inline-block"/> Despesas</span>
                </div>
              </div>
            )
          })()}
          <div className="flex gap-4 text-[10px] text-fg-disabled mt-3 justify-center">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-emerald-500/70 inline-block"/> Receitas</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500/70 inline-block"/> Despesas</span>
          </div>
        </div>
      </div>

      {/* ── ENTRADAS PARCIAIS ──────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 mt-4">
        <SecaoPagamentosParciais
          lancamentos={lancamentos as any}
          refetch={refreshAll}
        />
      </div>

      {/* ── AUDITORIA DE ALTERAÇÕES ───────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 mt-4">
        <SecaoAuditoria />
      </div>
      </>
      )}


      {modalImport && (
        <ModalImportarExtratoIA
          userId={authUserId}
          modo="pj"
          contasPJ={contas}
          onClose={() => setModalImport(false)}
          onSave={refreshAll}
        />
      )}

      {modalLancamento && (
        <ModalLancamento
          contas={contas}
          categorias={categorias}
          lancamentoEdit={lancamentoEdit}
          onClose={() => { setModalLancamento(false); setLancamentoEdit(null); }}
          onSave={() => {
            setModalLancamento(false)
            setLancamentoEdit(null)
            refreshAll()
          }}
        />
      )}

      {modalConta && (
        <ModalConta
          onClose={() => setModalConta(false)}
          onSave={refreshAll}
          isAdmin={isAdmin}
        />
      )}
    </>
  )
}
