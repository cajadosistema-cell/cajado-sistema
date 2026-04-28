'use client'

import { useState, useRef } from 'react'
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/useSupabase'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { PageHeader, StatusBadge, EmptyState } from '@/components/shared/ui'
import { AppPatraoTabs } from '@/components/shared/AppPatraoTabs'
import { TabImoveis } from './_components/TabImoveis'
import { TabFinanciamentos } from './_components/TabFinanciamentos'
import { SecretariaFlutuante } from '@/components/shared/SecretariaFlutuante'
import { exportCSV, exportPDF, parseCSV } from '@/lib/export-utils'
import { Download, Upload, FileText, X, AlertCircle, CheckCircle2, Pencil, Trash2 } from 'lucide-react'

type ProjetoPatrimonio = {
  id: string
  titulo: string
  tipo: 'imovel' | 'veiculo' | 'equipamento' | 'reforma' | 'outro'
  descricao: string | null
  valor_investido_total: number
  valor_mercado_atual: number | null
  roi_percentual: number | null
  data_aquisicao: string | null
  status: 'ativo' | 'pausado' | 'concluido' | 'cancelado'
}

type CustoPatrimonio = {
  id: string
  projeto_id: string
  descricao: string
  valor: number
  data: string
  categoria: string
}

const TIPO_ICONS: Record<string, string> = {
  imovel: '🏠', veiculo: '🚗', equipamento: '⚙️', reforma: '🔨', outro: '📦',
}

const TIPO_COLORS: Record<string, string> = {
  imovel: 'text-blue-400', veiculo: 'text-emerald-400',
  equipamento: 'text-amber-400', reforma: 'text-orange-400', outro: 'text-fg-secondary',
}

// ── Mock Data Fallbacks ─────────────────────────────────────
const MOCK_PROJETOS: ProjetoPatrimonio[] = [
  { id: '1', titulo: 'Apartamento Centro', tipo: 'imovel', descricao: 'Imóvel para locação', valor_investido_total: 350000, valor_mercado_atual: 420000, roi_percentual: 20, data_aquisicao: '2023-01-15', status: 'ativo' },
  { id: '2', titulo: 'Gol 2022', tipo: 'veiculo', descricao: 'Carro para uso do escritório', valor_investido_total: 65000, valor_mercado_atual: 58000, roi_percentual: -10.7, data_aquisicao: '2024-05-20', status: 'ativo' },
  { id: '3', titulo: 'Reforma Fachada', tipo: 'reforma', descricao: 'Reforma do prédio da empresa', valor_investido_total: 45000, valor_mercado_atual: 45000, roi_percentual: 0, data_aquisicao: '2025-10-10', status: 'concluido' },
]

const MOCK_CUSTOS: CustoPatrimonio[] = [
  { id: '1', projeto_id: '1', descricao: 'IPTU', valor: 1200, data: '2026-02-10', categoria: 'imposto' },
  { id: '2', projeto_id: '1', descricao: 'Pintura', valor: 4500, data: '2026-01-15', categoria: 'manutencao' },
  { id: '3', projeto_id: '2', descricao: 'IPVA', valor: 2500, data: '2026-01-05', categoria: 'imposto' },
  { id: '4', projeto_id: '2', descricao: 'Pneus Novos', valor: 2000, data: '2025-12-10', categoria: 'manutencao' },
]

// ── Modal Importar CSV ────────────────────────────────────────────────────────
function ModalImportarPatrimonio({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const { insert } = useSupabaseMutation('projetos_patrimonio')
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
          const vi = parseFloat(r.valor_investido_total || '0')
          const vm = r.valor_mercado_atual ? parseFloat(r.valor_mercado_atual) : null
          if (!r.titulo || isNaN(vi)) continue
          await insert({
            titulo: r.titulo,
            tipo: (r.tipo || 'outro') as ProjetoPatrimonio['tipo'],
            descricao: r.descricao || null,
            valor_investido_total: vi,
            valor_mercado_atual: vm,
            roi_percentual: vm && vi > 0 ? ((vm - vi) / vi) * 100 : null,
            data_aquisicao: r.data_aquisicao || null,
            status: (r.status || 'ativo') as ProjetoPatrimonio['status'],
          })
          ok++
        }
        setMsg(`${ok} bem(ns) importado(s) com sucesso`)
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
          <h2 className="text-base font-semibold text-fg">Importar Patrimônio (CSV)</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg"><X size={18} /></button>
        </div>
        <div className="bg-muted rounded-xl p-3 mb-4 text-xs text-fg-secondary space-y-1">
          <p className="font-semibold text-fg">Colunas esperadas no CSV:</p>
          <p className="font-mono text-[11px] text-fg-tertiary">titulo*, tipo, descricao, valor_investido_total*, valor_mercado_atual, data_aquisicao, status</p>
          <button
            onClick={() => exportCSV('modelo_patrimonio.csv',
              ['titulo','tipo','descricao','valor_investido_total','valor_mercado_atual','data_aquisicao','status'],
              [['Apartamento Centro','imovel','Imóvel para locação','350000','420000','2023-01-15','ativo'],
               ['Gol 2022','veiculo','Carro empresa','65000','58000','2024-05-20','ativo']])}
            className="text-amber-400 underline hover:text-amber-300 mt-1"
          >Baixar modelo .csv</button>
        </div>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="input mb-4" />
        {status === 'preview' && (
          <div className="mb-4">
            <p className="text-xs text-fg-tertiary mb-2">Prévia ({preview.length} linhas):</p>
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
            {status === 'done' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />} {msg}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Fechar</button>
          {status === 'preview' && (
            <button onClick={handleImport} className="btn-primary">
              Importar {preview.length}+ bens
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalProjeto({
  onClose, onSave, editando,
}: {
  onClose: () => void
  onSave: () => void
  editando?: ProjetoPatrimonio
}) {
  const { insert, update, loading } = useSupabaseMutation('projetos_patrimonio')
  const [form, setForm] = useState({
    titulo:              editando?.titulo              ?? '',
    tipo:               (editando?.tipo               ?? 'imovel') as ProjetoPatrimonio['tipo'],
    descricao:          editando?.descricao           ?? '',
    valor_investido_total: editando?.valor_investido_total != null ? String(editando.valor_investido_total) : '',
    valor_mercado_atual:   editando?.valor_mercado_atual  != null ? String(editando.valor_mercado_atual)  : '',
    data_aquisicao:     editando?.data_aquisicao     ?? '',
    status:            (editando?.status             ?? 'ativo') as ProjetoPatrimonio['status'],
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const vi = parseFloat(form.valor_investido_total)
    const vm = form.valor_mercado_atual ? parseFloat(form.valor_mercado_atual) : null
    const payload = {
      titulo: form.titulo, tipo: form.tipo,
      descricao: form.descricao || null,
      valor_investido_total: vi,
      valor_mercado_atual: vm,
      roi_percentual: vm && vi > 0 ? ((vm - vi) / vi) * 100 : null,
      data_aquisicao: form.data_aquisicao || null,
      status: form.status,
    }
    if (editando) {
      await update(editando.id, payload)
    } else {
      await insert({ ...payload, status: 'ativo' })
    }
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-lg p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">{editando ? 'Editar Patrimônio' : 'Novo Patrimônio'}</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Título *</label>
              <input className="input mt-1" required value={form.titulo}
                onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                placeholder="Ex: Apartamento centro, Gol 2022..." />
            </div>
            <div>
              <label className="label">Tipo</label>
              <select className="input mt-1" value={form.tipo}
                onChange={e => setForm(f => ({ ...f, tipo: e.target.value as ProjetoPatrimonio['tipo'] }))}>
                <option value="imovel">🏠 Imóvel</option>
                <option value="veiculo">🚗 Veículo</option>
                <option value="equipamento">⚙️ Equipamento</option>
                <option value="reforma">🔨 Reforma</option>
                <option value="outro">📦 Outro</option>
              </select>
            </div>
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input mt-1 resize-none" rows={2} value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Valor investido (R$) *</label>
              <input className="input mt-1" type="number" step="0.01" required value={form.valor_investido_total}
                onChange={e => setForm(f => ({ ...f, valor_investido_total: e.target.value }))} />
            </div>
            <div>
              <label className="label">Valor de mercado (R$)</label>
              <input className="input mt-1" type="number" step="0.01" value={form.valor_mercado_atual}
                onChange={e => setForm(f => ({ ...f, valor_mercado_atual: e.target.value }))} />
            </div>
            <div>
              <label className="label">Data aquisição</label>
              <input className="input mt-1" type="date" value={form.data_aquisicao}
                onChange={e => setForm(f => ({ ...f, data_aquisicao: e.target.value }))} />
            </div>
          </div>
          {editando && (
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjetoPatrimonio['status'] }))}>
                <option value="ativo">Ativo</option>
                <option value="pausado">Pausado</option>
                <option value="concluido">Concluidô</option>
                <option value="cancelado">Cancelado</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar patrimônio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ModalCusto({ projetoId, onClose, onSave }: { projetoId: string; onClose: () => void; onSave: () => void }) {
  const { insert, loading } = useSupabaseMutation('custos_patrimonio')
  const [form, setForm] = useState({
    descricao: '', valor: '', data: new Date().toISOString().split('T')[0], categoria: 'manutencao',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await insert({ projeto_id: projetoId, descricao: form.descricao, valor: parseFloat(form.valor), data: form.data, categoria: form.categoria })
    onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-sm p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-fg">Registrar Custo</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-xl">×</button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">Descrição *</label>
            <input className="input mt-1" required value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Ex: Pintura, IPTU, Seguro..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Valor (R$) *</label>
              <input className="input mt-1" type="number" step="0.01" required value={form.valor}
                onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} />
            </div>
            <div>
              <label className="label">Data</label>
              <input className="input mt-1" type="date" value={form.data}
                onChange={e => setForm(f => ({ ...f, data: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">Categoria</label>
            <select className="input mt-1" value={form.categoria}
              onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
              <option value="manutencao">Manutenção</option>
              <option value="imposto">Imposto/Taxa</option>
              <option value="seguro">Seguro</option>
              <option value="reforma">Reforma</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-1">
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

export default function PatrimonioClient() {
  const [tab, setTab] = useState<'geral' | 'imoveis' | 'financiamentos'>('geral')
  const [modal, setModal] = useState(false)
  const [editandoProjeto, setEditandoProjeto] = useState<ProjetoPatrimonio | null>(null)
  const [modalImport, setModalImport] = useState(false)
  const [modalCusto, setModalCusto] = useState<string | null>(null)
  const [projetoAberto, setProjetoAberto] = useState<string | null>(null)
  const { remove } = useSupabaseMutation('projetos_patrimonio')

  const handleDeleteProjeto = async (p: ProjetoPatrimonio) => {
    if (!confirm(`Excluir "${p.titulo}"? Esta ação removerá o bem e todos os custos associados.`)) return
    await remove(p.id)
    refetch(); refetchCustos()
  }

  const { data: projetosDB, refetch } = useSupabaseQuery<ProjetoPatrimonio>('projetos_patrimonio', {
    orderBy: { column: 'valor_investido_total', ascending: false },
  })
  const { data: custosDB, refetch: refetchCustos } = useSupabaseQuery<CustoPatrimonio>('custos_patrimonio', {
    orderBy: { column: 'data', ascending: false },
  })

  // Fallback para exibir na tela caso banco esteja vazio
  const projetos = projetosDB.length > 0 ? projetosDB : MOCK_PROJETOS
  const custos = custosDB.length > 0 ? custosDB : MOCK_CUSTOS

  const totalInvestido = projetos.reduce((a, p) => a + p.valor_investido_total, 0)
  const totalMercado = projetos.reduce((a, p) => a + (p.valor_mercado_atual ?? p.valor_investido_total), 0)
  const valorizacao = totalMercado - totalInvestido
  const totalCustos = custos.reduce((a, c) => a + c.valor, 0)

  const handleExportCSV = () => {
    exportCSV('patrimonio.csv',
      ['Titulo','Tipo','Descricao','Valor Investido','Valor Mercado','ROI%','Data Aquisicao','Status'],
      projetos.map(p => [
        p.titulo, p.tipo, p.descricao ?? '',
        p.valor_investido_total, p.valor_mercado_atual ?? '',
        p.roi_percentual != null ? p.roi_percentual.toFixed(2) + '%' : '',
        p.data_aquisicao ?? '', p.status,
      ])
    )
  }

  const handleExportPDF = () => {
    exportPDF(
      'patrimonio.pdf', 'Relatório de Patrimônio',
      `Total investido: ${formatCurrency(totalInvestido)} · Mercado: ${formatCurrency(totalMercado)} · Valorização: ${formatCurrency(valorizacao)}`,
      ['Bem', 'Tipo', 'Investido', 'Mercado', 'ROI', 'Aquisição', 'Status'],
      projetos.map(p => [
        p.titulo, p.tipo.toUpperCase(),
        formatCurrency(p.valor_investido_total),
        formatCurrency(p.valor_mercado_atual ?? p.valor_investido_total),
        p.roi_percentual != null ? p.roi_percentual.toFixed(1) + '%' : '-',
        p.data_aquisicao ? formatDate(p.data_aquisicao) : '-',
        p.status,
      ] as any),
      [`Total custos acumulados: ${formatCurrency(totalCustos)}`]
    )
  }

  return (
    <>
      <PageHeader title="Patrimônio" subtitle="Imóveis · Veículos · Financiamentos · ROI">
        <div className="flex items-center gap-2">
          {tab === 'geral' && (
            <>
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
              <button onClick={() => setModal(true)} className="btn-primary text-xs h-8 px-3 whitespace-nowrap shrink-0">+ Patrimônio Genérico</button>
            </>
          )}
        </div>
      </PageHeader>

      <AppPatraoTabs />

      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-0.5 px-0.5 mb-4 pb-0.5">
        {[
          { key: 'geral', label: '📊 Visão Geral', labelMobile: '📊 Geral' },
          { key: 'imoveis', label: '🏠 Imóveis', labelMobile: '🏠 Imóveis' },
          { key: 'financiamentos', label: '🏦 Financiamentos', labelMobile: '🏦 Financiam.' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={cn(
              'shrink-0 px-4 py-2 rounded-xl text-sm font-semibold transition-all border',
              tab === t.key
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30 shadow-sm'
                : 'text-fg-tertiary border-border-subtle hover:text-fg-secondary hover:border-border-subtle bg-page'
            )}>
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.labelMobile}</span>
          </button>
        ))}
      </div>

      {tab === 'geral' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="metric-card">
          <p className="metric-label">Total investido</p>
          <p className="metric-value">{formatCurrency(totalInvestido)}</p>
          <p className="text-[11px] text-fg-disabled mt-1">{projetos.length} bem(ns)</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valor de mercado</p>
          <p className="metric-value text-blue-400">{formatCurrency(totalMercado)}</p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Valorização</p>
          <p className={cn('metric-value', valorizacao >= 0 ? 'text-emerald-400' : 'text-red-400')}>
            {valorizacao >= 0 ? '+' : ''}{formatCurrency(valorizacao)}
          </p>
        </div>
        <div className="metric-card">
          <p className="metric-label">Custos totais</p>
          <p className="metric-value text-red-400">{formatCurrency(totalCustos)}</p>
        </div>
      </div>

      {projetos.length === 0 ? (
        <div className="card"><EmptyState message="Nenhum patrimônio cadastrado ainda" /></div>
      ) : (
        <div className="space-y-3">
          {projetos.map(p => {
            const vm = p.valor_mercado_atual ?? p.valor_investido_total
            const roi = p.valor_investido_total > 0 ? ((vm - p.valor_investido_total) / p.valor_investido_total) * 100 : 0
            const custosProjeto = custos.filter(c => c.projeto_id === p.id)
            const totalCustosProjeto = custosProjeto.reduce((a, c) => a + c.valor, 0)
            const isOpen = projetoAberto === p.id

            return (
              <div key={p.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{TIPO_ICONS[p.tipo]}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-fg">{p.titulo}</h3>
                        <StatusBadge status={p.status} />
                      </div>
                      <p className={cn('text-[10px] font-medium uppercase', TIPO_COLORS[p.tipo])}>{p.tipo}</p>
                      {p.data_aquisicao && (
                        <p className="text-[10px] text-fg-disabled">Adquirido em {formatDate(p.data_aquisicao)}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs text-fg-disabled">ROI</p>
                      <p className={cn('text-lg font-bold', roi >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                      </p>
                    </div>
                    <button
                      onClick={() => { setEditandoProjeto(p); setModal(true) }}
                      className="p-1.5 rounded-lg hover:bg-blue-500/10 text-fg-disabled hover:text-blue-400 transition-colors"
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteProjeto(p)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-fg-disabled hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                    <button
                      onClick={() => setProjetoAberto(isOpen ? null : p.id)}
                      className="text-fg-disabled hover:text-fg-secondary transition-colors px-2 py-1"
                    >
                      {isOpen ? '▲' : '▼'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-border-subtle">
                  <div>
                    <p className="text-[10px] text-fg-disabled">Investido</p>
                    <p className="text-sm font-semibold text-fg-secondary">{formatCurrency(p.valor_investido_total)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-fg-disabled">Mercado</p>
                    <p className="text-sm font-semibold text-blue-400">{formatCurrency(vm)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-fg-disabled">Custos acum.</p>
                    <p className="text-sm font-semibold text-red-400">{formatCurrency(totalCustosProjeto)}</p>
                  </div>
                </div>

                {/* Custos expandidos */}
                {isOpen && (
                  <div className="mt-3 pt-3 border-t border-border-subtle space-y-2">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-fg-tertiary uppercase tracking-wide">Custos</p>
                      <button onClick={() => setModalCusto(p.id)} className="btn-ghost text-xs">+ Custo</button>
                    </div>
                    {custosProjeto.length === 0 ? (
                      <p className="text-xs text-fg-disabled text-center py-4">Nenhum custo registrado</p>
                    ) : (
                      custosProjeto.slice(0, 5).map(c => (
                        <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border-subtle last:border-0">
                          <div>
                            <p className="text-xs text-fg-secondary">{c.descricao}</p>
                            <p className="text-[10px] text-fg-disabled">{c.categoria} · {formatDate(c.data)}</p>
                          </div>
                          <p className="text-xs text-red-400 font-semibold">{formatCurrency(c.valor)}</p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
        </>
      )}

      {tab === 'imoveis' && <TabImoveis />}
      {tab === 'financiamentos' && <TabFinanciamentos />}

      {modal && (
        <ModalProjeto
          onClose={() => { setModal(false); setEditandoProjeto(null) }}
          onSave={refetch}
          editando={editandoProjeto ?? undefined}
        />
      )}
      {modalImport && <ModalImportarPatrimonio onClose={() => setModalImport(false)} onImported={refetch} />}
      {modalCusto && (
        <ModalCusto
          projetoId={modalCusto}
          onClose={() => setModalCusto(null)}
          onSave={() => { refetch(); refetchCustos() }}
        />
      )}

      {/* Secretária Flutuante do Patrão */}
      <SecretariaFlutuante />
    </>
  )
}
