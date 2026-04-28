'use client'

import { useState, useRef } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, EmptyState } from '@/components/shared/ui'
import { AppPatraoTabs } from '@/components/shared/AppPatraoTabs'
import { SecretariaFlutuante } from '@/components/shared/SecretariaFlutuante'
import { exportCSV, exportPDF, parseCSV } from '@/lib/export-utils'
import { Download, Upload, FileText, X, AlertCircle, CheckCircle2, Pencil, Trash2 } from 'lucide-react'

type Ativo = {
  id: string
  ticker: string | null
  nome: string
  tipo: 'acao' | 'fii' | 'fundo' | 'cdb' | 'lci' | 'lca' | 'tesouro' | 'cripto' | 'imovel' | 'veiculo' | 'terreno' | 'poupanca' | 'previdencia' | 'outro'
  quantidade: number
  preco_medio: number
  preco_atual: number | null
  valor_investido: number
  valor_atual: number | null
  liquidez: 'diaria' | 'semanal' | 'mensal' | 'no_vencimento'
  data_vencimento: string | null
  risco_nivel: number
  corretora: string | null
}

const TIPO_COLORS: Record<string, string> = {
  acao:       '#3B82F6', fii:        '#10B981', fundo:      '#8B5CF6',
  cdb:        '#F59E0B', lci:        '#06B6D4', lca:        '#6EE7B7',
  tesouro:    '#F97316', cripto:     '#EC4899', imovel:     '#84CC16',
  veiculo:    '#14B8A6', terreno:    '#A78BFA', poupanca:   '#FB923C',
  previdencia:'#F43F5E', outro:      '#6B7280',
}

const TIPO_LABELS: Record<string, string> = {
  acao: 'Ação', fii: 'FII', fundo: 'Fundo', cdb: 'CDB', lci: 'LCI', lca: 'LCA',
  tesouro: 'Tesouro', cripto: 'Cripto', imovel: 'Imóvel', veiculo: 'Veículo',
  terreno: 'Terreno', poupanca: 'Poupança', previdencia: 'Previdência', outro: 'Outro',
}

// Tipos que NÃO são de bolsa — não têm ticker/corretora obrigatórios
const TIPO_FISICO = new Set(['imovel','veiculo','terreno'])

const RISCO_LABELS = ['', 'Muito Baixo', 'Baixo', 'Médio', 'Alto', 'Muito Alto']
const RISCO_COLORS = ['', 'text-emerald-400', 'text-green-400', 'text-amber-400', 'text-orange-400', 'text-red-400']

// ── Mock Data Fallbacks ─────────────────────────────────────
const MOCK_ATIVOS: Ativo[] = [
  { id: '1', ticker: 'PETR4', nome: 'Petrobras PN', tipo: 'acao', quantidade: 500, preco_medio: 32.50, preco_atual: 38.40, valor_investido: 16250, valor_atual: 19200, liquidez: 'diaria', data_vencimento: null, risco_nivel: 4, corretora: 'XP Investimentos' },
  { id: '2', ticker: 'KNRI11', nome: 'Kinea Renda', tipo: 'fii', quantidade: 100, preco_medio: 155.00, preco_atual: 162.20, valor_investido: 15500, valor_atual: 16220, liquidez: 'diaria', data_vencimento: null, risco_nivel: 3, corretora: 'XP Investimentos' },
  { id: '3', ticker: null, nome: 'CDB Banco Master 120% CDI', tipo: 'cdb', quantidade: 1, preco_medio: 10000, preco_atual: 10850, valor_investido: 10000, valor_atual: 10850, liquidez: 'no_vencimento', data_vencimento: '2027-05-10', risco_nivel: 2, corretora: 'BTG Pactual' },
  { id: '4', ticker: 'BTC', nome: 'Bitcoin', tipo: 'cripto', quantidade: 0.05, preco_medio: 250000, preco_atual: 340000, valor_investido: 12500, valor_atual: 17000, liquidez: 'diaria', data_vencimento: null, risco_nivel: 5, corretora: 'Binance' },
  { id: '5', ticker: 'BTLG11', nome: 'VBI Logístico', tipo: 'fii', quantidade: 50, preco_medio: 102.00, preco_atual: 98.50, valor_investido: 5100, valor_atual: 4925, liquidez: 'diaria', data_vencimento: null, risco_nivel: 3, corretora: 'XP Investimentos' },
]

function ModalAtivo({
  onClose, onSave, editando,
}: {
  onClose: () => void
  onSave: () => void
  editando?: Ativo
}) {
  const { insert, update, loading } = useSupabaseMutation('ativos')
  const [form, setForm] = useState({
    ticker:      editando?.ticker      ?? '',
    nome:        editando?.nome        ?? '',
    tipo:       (editando?.tipo        ?? 'acao') as Ativo['tipo'],
    quantidade:  editando?.quantidade  != null ? String(editando.quantidade) : '',
    preco_medio: editando?.preco_medio != null ? String(editando.preco_medio) : '',
    preco_atual: editando?.preco_atual != null ? String(editando.preco_atual) : '',
    // Para ativos físicos, reutilizamos preco_medio como valor investido
    liquidez:        (editando?.liquidez        ?? 'diaria') as Ativo['liquidez'],
    data_vencimento:  editando?.data_vencimento  ?? '',
    risco_nivel:      editando?.risco_nivel      != null ? String(editando.risco_nivel) : '3',
    corretora:        editando?.corretora        ?? '',
  })

  const isFisico = TIPO_FISICO.has(form.tipo)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const qtd = isFisico ? 1 : parseFloat(form.quantidade)
    const pm  = parseFloat(form.preco_medio)
    const pa  = form.preco_atual ? parseFloat(form.preco_atual) : null
    const payload = {
      ticker: form.ticker || null, nome: form.nome, tipo: form.tipo,
      quantidade: qtd, preco_medio: pm, preco_atual: pa,
      valor_investido: isFisico ? pm : qtd * pm,
      valor_atual: pa ? (isFisico ? pa : qtd * pa) : null,
      liquidez: form.liquidez,
      data_vencimento: form.data_vencimento || null,
      risco_nivel: parseInt(form.risco_nivel),
      corretora: form.corretora || null,
    }
    if (editando) {
      await update(editando.id, payload)
    } else {
      await insert(payload)
    }
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">{editando ? 'Editar Ativo' : 'Adicionar Ativo'}</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Ticker</label>
              <input className="input mt-1 uppercase" value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                placeholder="PETR4, BTC, KNRI11..." />
            </div>
            <div>
              <label className="label">Nome *</label>
              <input className="input mt-1" required value={form.nome}
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Nome completo do ativo" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as Ativo['tipo'] }))}>
                <optgroup label="— Bolsa / Renda Fixa">
                  {['acao','fii','fundo','cdb','lci','lca','tesouro','poupanca','previdencia'].map(t => (
                    <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                  ))}
                </optgroup>
                <optgroup label="— Cripto">
                  <option value="cripto">Cripto</option>
                </optgroup>
                <optgroup label="— Ativos Físicos">
                  {['imovel','veiculo','terreno'].map(t => (
                    <option key={t} value={t}>{TIPO_LABELS[t]}</option>
                  ))}
                </optgroup>
                <optgroup label="— Outro">
                  <option value="outro">Outro</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label className="label">Liquidez</label>
              <select className="input mt-1" value={form.liquidez}
                onChange={e => setForm(f => ({ ...f, liquidez: e.target.value as Ativo['liquidez'] }))}>
                <option value="diaria">Diária</option>
                <option value="semanal">Semanal</option>
                <option value="mensal">Mensal</option>
                <option value="no_vencimento">No vencimento</option>
              </select>
            </div>
          </div>
          {isFisico && (
            <p className="text-[11px] text-amber-400 bg-amber-500/10 rounded-lg px-3 py-2">
              ⚠ Ativo físico — quantidade fixada em 1. Informe o valor de compra e o valor atual de mercado.
            </p>
          )}
          <div className={isFisico ? 'grid grid-cols-2 gap-3' : 'grid grid-cols-3 gap-3'}>
            {!isFisico && (
              <div>
                <label className="label">Quantidade *</label>
                <input className="input mt-1" type="number" step="0.000001" required value={form.quantidade}
                  onChange={e => setForm(f => ({ ...f, quantidade: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="label">{isFisico ? 'Valor de compra (R$) *' : 'Preço médio *'}</label>
              <input className="input mt-1" type="number" step="0.01" required value={form.preco_medio}
                onChange={e => setForm(f => ({ ...f, preco_medio: e.target.value }))} />
            </div>
            <div>
              <label className="label">{isFisico ? 'Valor atual (R$)' : 'Preço atual'}</label>
              <input className="input mt-1" type="number" step="0.01" value={form.preco_atual}
                onChange={e => setForm(f => ({ ...f, preco_atual: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">{isFisico ? 'Localização / Marca' : 'Corretora'}</label>
              <input className="input mt-1" value={form.corretora}
                onChange={e => setForm(f => ({ ...f, corretora: e.target.value }))}
                placeholder={isFisico ? 'Ex: Bairro, cidade / Ford, Toyota...' : 'XP, Clear, Binance...'} />
            </div>
            <div>
              <label className="label">Vencimento</label>
              <input className="input mt-1" type="date" value={form.data_vencimento}
                onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Nível de risco: {RISCO_LABELS[parseInt(form.risco_nivel)]}</label>
            <input type="range" min="1" max="5" value={form.risco_nivel}
              onChange={e => setForm(f => ({ ...f, risco_nivel: e.target.value }))}
              className="w-full mt-1 accent-amber-500 cursor-pointer" />
            <div className="flex justify-between text-[10px] text-fg-disabled mt-0.5">
              <span>Muito Baixo</span><span>Médio</span><span>Muito Alto</span>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal Importar CSV ────────────────────────────────────────────────────────
function ModalImportarAtivos({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { insert } = useSupabaseMutation('ativos')
  const fileRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<Record<string, string>[]>([])
  const [status, setStatus] = useState<'idle' | 'preview' | 'importing' | 'done' | 'error'>('idle')
  const [msg, setMsg] = useState('')

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target?.result as string)
      if (!rows.length) { setMsg('Arquivo vazio ou inválido'); setStatus('error'); return }
      setPreview(rows.slice(0, 5))
      setStatus('preview')
    }
    reader.readAsText(file, 'utf-8')
  }

  const handleImport = async () => {
    setStatus('importing')
    try {
      const file = fileRef.current?.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async ev => {
        const rows = parseCSV(ev.target?.result as string)
        let ok = 0
        for (const r of rows) {
          const qtd = parseFloat(r.quantidade || '0')
          const pm = parseFloat(r.preco_medio || '0')
          const pa = r.preco_atual ? parseFloat(r.preco_atual) : null
          if (!r.nome || isNaN(qtd) || isNaN(pm)) continue
          await insert({
            ticker: r.ticker || null, nome: r.nome,
            tipo: (r.tipo || 'outro') as Ativo['tipo'],
            quantidade: qtd, preco_medio: pm, preco_atual: pa,
            valor_investido: qtd * pm,
            valor_atual: pa ? qtd * pa : null,
            liquidez: (r.liquidez || 'diaria') as Ativo['liquidez'],
            data_vencimento: r.data_vencimento || null,
            risco_nivel: parseInt(r.risco_nivel || '3'),
            corretora: r.corretora || null,
          })
          ok++
        }
        setMsg(`${ok} ativo(s) importado(s) com sucesso`)
        setStatus('done')
        onImported()
      }
      reader.readAsText(file, 'utf-8')
    } catch { setMsg('Erro ao importar'); setStatus('error') }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">Importar Ativos (CSV)</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl"><X size={18} /></button>
        </div>

        <div className="bg-muted rounded-xl p-3 mb-4 text-xs text-fg-secondary space-y-1">
          <p className="font-semibold text-fg">Colunas esperadas no CSV:</p>
          <p className="font-mono text-[11px] text-fg-tertiary">ticker, nome*, tipo*, quantidade*, preco_medio*, preco_atual, liquidez, risco_nivel, corretora, data_vencimento</p>
          <button
            onClick={() => exportCSV('modelo_ativos.csv',
              ['ticker','nome','tipo','quantidade','preco_medio','preco_atual','liquidez','risco_nivel','corretora','data_vencimento'],
              [['PETR4','Petrobras PN','acao','100','35.50','38.40','diaria','4','XP Investimentos',''],
               ['KNRI11','Kinea Renda Imobiliária','fii','50','160.00','165.00','diaria','3','Clear','']])}
            className="text-amber-400 underline hover:text-amber-300 mt-1"
          >Baixar modelo .csv</button>
        </div>

        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="input mb-4" />

        {status === 'preview' && (
          <div className="mb-4">
            <p className="text-xs text-fg-tertiary mb-2">Prévia (primeiras {preview.length} linhas):</p>
            <div className="overflow-x-auto rounded-lg border border-border-subtle">
              <table className="w-full text-[11px]">
                <thead><tr>{Object.keys(preview[0]).map(k => <th key={k} className="table-header">{k}</th>)}</tr></thead>
                <tbody>{preview.map((r, i) => <tr key={i}>{Object.values(r).map((v, j) => <td key={j} className="table-cell">{v}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </div>
        )}

        {(status === 'done' || status === 'error') && (
          <div className={cn('flex items-center gap-2 rounded-xl p-3 mb-4 text-sm', status === 'done' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
            {status === 'done' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {msg}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Fechar</button>
          {status === 'preview' && (
            <button onClick={handleImport} className="btn-primary" disabled={status === 'importing' as any}>
              {status === 'importing' ? 'Importando...' : `Importar ${preview.length}+ ativos`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function InvestimentosClient() {
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Ativo | null>(null)
  const [modalImport, setModalImport] = useState(false)
  const [filtroTipo, setFiltroTipo] = useState('todos')
  const { remove } = useSupabaseMutation('ativos')

  const handleDelete = async (a: Ativo) => {
    if (!confirm(`Excluir "${a.nome}"? Esta ação não pode ser desfeita.`)) return
    await remove(a.id)
    refetch()
  }

  const { data: ativosDB, refetch } = useSupabaseQuery<Ativo>('ativos', {
    orderBy: { column: 'valor_investido', ascending: false },
  })

  const ativos = ativosDB.length > 0 ? ativosDB : MOCK_ATIVOS

  // Métricas
  const totalInvestido = ativos.reduce((a, v) => a + v.valor_investido, 0)
  const totalAtual = ativos.reduce((a, v) => a + (v.valor_atual ?? v.valor_investido), 0)
  const resultado = totalAtual - totalInvestido
  const rentabilidade = totalInvestido > 0 ? ((totalAtual / totalInvestido) - 1) * 100 : 0

  // Por tipo
  const porTipo = ativos.reduce((acc, a) => {
    if (!acc[a.tipo]) acc[a.tipo] = { investido: 0, atual: 0, count: 0 }
    acc[a.tipo].investido += a.valor_investido
    acc[a.tipo].atual += a.valor_atual ?? a.valor_investido
    acc[a.tipo].count++
    return acc
  }, {} as Record<string, { investido: number; atual: number; count: number }>)

  const ativosFiltrados = ativos.filter(a => filtroTipo === 'todos' || a.tipo === filtroTipo)

  const handleExportCSV = () => {
    exportCSV('investimentos.csv',
      ['Ticker','Nome','Tipo','Qtd','Preço Médio','Preço Atual','Investido','Atual','Resultado %','Liquidez','Risco','Corretora','Vencimento'],
      ativos.map(a => [
        a.ticker ?? '', a.nome, a.tipo, a.quantidade, a.preco_medio,
        a.preco_atual ?? '', a.valor_investido, a.valor_atual ?? '',
        a.valor_investido > 0 ? (((a.valor_atual ?? a.valor_investido) / a.valor_investido - 1) * 100).toFixed(2) + '%' : '0%',
        a.liquidez, a.risco_nivel, a.corretora ?? '', a.data_vencimento ?? '',
      ])
    )
  }

  const handleExportPDF = () => {
    exportPDF(
      'investimentos.pdf', 'Carteira de Investimentos',
      `Total: ${formatCurrency(totalInvestido)} · Resultado: ${resultado >= 0 ? '+' : ''}${formatCurrency(resultado)} (${rentabilidade.toFixed(2)}%)`,
      ['Ativo','Tipo','Qtd','Investido','Atual','Result.%','Risco','Liquidez','Corretora'],
      ativos.map(a => [
        (a.ticker ?? a.nome), a.tipo.toUpperCase(), a.quantidade,
        formatCurrency(a.valor_investido), formatCurrency(a.valor_atual ?? a.valor_investido),
        a.valor_investido > 0 ? (((a.valor_atual ?? a.valor_investido) / a.valor_investido - 1) * 100).toFixed(2) + '%' : '0%',
        a.risco_nivel + '/5', a.liquidez.replace('_',' '), a.corretora ?? '-',
      ] as any),
      [`Total investido: ${formatCurrency(totalInvestido)}`, `Valor atual: ${formatCurrency(totalAtual)}`, `Rentabilidade total: ${rentabilidade.toFixed(2)}%`]
    )
  }

  return (
    <>
      <PageHeader title="Investimentos" subtitle="Carteira · Ativos · Liquidez · Rentabilidade">
        <div className="flex items-center gap-2">
          <button onClick={() => setModalImport(true)} className="btn-secondary text-xs h-8 px-3 flex items-center gap-1.5 whitespace-nowrap shrink-0">
            <Upload size={13} /> Importar
          </button>
          <div className="flex items-center gap-1">
            <button onClick={handleExportCSV} className="btn-secondary text-xs h-8 px-3 flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <Download size={13} /> CSV
            </button>
            <button onClick={handleExportPDF} className="btn-secondary text-xs h-8 px-3 flex items-center gap-1.5 whitespace-nowrap shrink-0">
              <FileText size={13} /> PDF
            </button>
          </div>
          <button onClick={() => setModal(true)} className="btn-primary text-xs h-8 px-3 whitespace-nowrap shrink-0">+ Ativo</button>
        </div>
      </PageHeader>

      <AppPatraoTabs />

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Total investido</p>
          <p className="metric-value">{formatCurrency(totalInvestido)}</p>
          <p className="text-[11px] text-fg-disabled mt-1">{ativos.length} ativo(s)</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valor atual</p>
          <p className="metric-value text-blue-400">{formatCurrency(totalAtual)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Resultado</p>
          <p className={cn('metric-value', resultado >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {resultado >= 0 ? '+' : ''}{formatCurrency(resultado)}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Rentabilidade</p>
          <p className={cn('metric-value', rentabilidade >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {rentabilidade >= 0 ? '+' : ''}{rentabilidade.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Distribuição por tipo */}
      {Object.keys(porTipo).length > 0 && (
        <div className="card mb-4">
          <p className="text-xs text-fg-tertiary uppercase tracking-wide mb-3">Distribuição da carteira</p>
          <div className="space-y-2">
            {Object.entries(porTipo)
              .sort((a, b) => b[1].investido - a[1].investido)
              .map(([tipo, val]) => {
                const pct = totalInvestido > 0 ? (val.investido / totalInvestido) * 100 : 0
                const rent = val.investido > 0 ? ((val.atual / val.investido) - 1) * 100 : 0
                return (
                  <div key={tipo}>
                    <div className="flex justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: TIPO_COLORS[tipo] }} />
                        <span className="text-fg-secondary uppercase font-medium">{tipo}</span>
                        <span className="text-fg-disabled">({val.count})</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn('font-medium text-xs', rent >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {rent >= 0 ? '+' : ''}{rent.toFixed(1)}%
                        </span>
                        <span className="text-fg-tertiary">{pct.toFixed(1)}%</span>
                        <span className="text-fg-secondary font-medium w-28 text-right">{formatCurrency(val.investido)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: TIPO_COLORS[tipo] }} />
                    </div>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Filtros — scroll horizontal no mobile */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-0.5 px-0.5 mb-4 pb-0.5">
        {['todos', ...Object.keys(porTipo)].map(t => (
          <button key={t} onClick={() => setFiltroTipo(t)}
            className={cn('shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all uppercase',
              filtroTipo === t
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/40'
                : 'text-fg-tertiary border-border-subtle hover:text-fg-secondary bg-page'
            )}>
            {t}
          </button>
        ))}
      </div>

      {/* Tabela de ativos */}
      {ativosFiltrados.length === 0 ? (
        <div className="card"><EmptyState message="Nenhum ativo cadastrado. Clique em '+ Ativo' para começar." /></div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-subtle">
                <th className="table-header">Ativo</th>
                <th className="table-header hidden md:table-cell">Tipo</th>
                <th className="table-header hidden lg:table-cell">Quantidade</th>
                <th className="table-header text-right">Investido</th>
                <th className="table-header text-right hidden md:table-cell">Atual</th>
                <th className="table-header text-right">Result.</th>
                <th className="table-header hidden lg:table-cell">Risco</th>
                <th className="table-header hidden lg:table-cell">Liquidez</th>
                <th className="table-header w-16"></th>
              </tr>
            </thead>
            <tbody>
              {ativosFiltrados.map(a => {
                const atual = a.valor_atual ?? a.valor_investido
                const res = atual - a.valor_investido
                const rentPct = a.valor_investido > 0 ? ((atual / a.valor_investido) - 1) * 100 : 0
                const vencendo = a.data_vencimento && new Date(a.data_vencimento) < new Date(Date.now() + 30 * 86400000)
                return (
                  <tr key={a.id} className="table-row">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: TIPO_COLORS[a.tipo] }} />
                        <div>
                          <p className="text-fg font-semibold text-sm">{a.ticker ?? a.nome}</p>
                          <p className="text-[10px] text-fg-disabled">{a.corretora ?? a.nome}</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-cell hidden md:table-cell">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase" style={{ background: TIPO_COLORS[a.tipo] + '22', color: TIPO_COLORS[a.tipo] }}>{TIPO_LABELS[a.tipo] ?? a.tipo}</span>
                    </td>
                    <td className="table-cell hidden lg:table-cell text-fg-secondary text-xs">
                      {a.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="table-cell text-right text-fg-secondary text-sm">{formatCurrency(a.valor_investido)}</td>
                    <td className="table-cell text-right hidden md:table-cell text-fg-secondary text-sm">
                      {formatCurrency(atual)}
                    </td>
                    <td className="table-cell text-right">
                      <div>
                        <p className={cn('text-sm font-semibold', res >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {res >= 0 ? '+' : ''}{formatCurrency(res)}
                        </p>
                        <p className={cn('text-[10px]', rentPct >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {rentPct >= 0 ? '+' : ''}{rentPct.toFixed(2)}%
                        </p>
                      </div>
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      <span className={cn('text-xs font-medium', RISCO_COLORS[a.risco_nivel])}>
                        {'▮'.repeat(a.risco_nivel)}{'▯'.repeat(5 - a.risco_nivel)}
                      </span>
                    </td>
                    <td className="table-cell hidden lg:table-cell">
                      <div>
                        <span className="text-xs text-fg-tertiary capitalize">{a.liquidez.replace('_', ' ')}</span>
                        {vencendo && a.data_vencimento && (
                          <p className="text-[10px] text-amber-400">⚠ {formatDate(a.data_vencimento)}</p>
                        )}
                      </div>
                    </td>
                    <td className="table-cell">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => { setEditando(a); setModal(true) }}
                          className="p-1.5 rounded-lg hover:bg-blue-500/10 text-fg-disabled hover:text-blue-400 transition-colors">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(a)}
                          className="p-1.5 rounded-lg hover:bg-red-500/10 text-fg-disabled hover:text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalAtivo
          onClose={() => { setModal(false); setEditando(null) }}
          onSave={refetch}
          editando={editando ?? undefined}
        />
      )}
      {modalImport && <ModalImportarAtivos onClose={() => setModalImport(false)} onImported={refetch} />}

      {/* Secretária Flutuante do Patrão */}
      <SecretariaFlutuante />
    </>
  )
}
