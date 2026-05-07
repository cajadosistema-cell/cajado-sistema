'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { EmptyState } from '@/components/shared/ui'
import { formatCurrency, cn } from '@/lib/utils'

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
  parcelas_pagas: '0', indexador: '', data_aquisicao: ''
}

// ── Modal de Importação via IA ──────────────────────────────────
function ModalImportarIA({ onClose, onImportado }: { onClose: () => void; onImportado: () => void }) {
  const supabase = createClient()
  const [texto, setTexto] = useState('')
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'erro'>('idle')
  const [msg, setMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => setTexto(ev.target?.result as string ?? '')
    reader.readAsText(file, 'utf-8')
  }

  const handleImportar = async () => {
    if (!texto.trim()) return
    setStatus('loading')
    setMsg('Analisando documento com IA...')
    try {
      const res = await fetch('/api/openrouter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Analise este documento de imóvel e extraia os dados em JSON. Retorne APENAS o JSON, sem texto extra:
{
  "titulo": "nome ou apelido do imóvel",
  "construtora": "nome da construtora/incorporadora ou null",
  "unidade": "unidade/apartamento ex: BL29-APT06 ou null",
  "endereco": "endereço completo ou null",
  "tipo_imovel": "residencial|comercial|terreno|galpao",
  "area_m2": número ou null,
  "quartos": número ou null,
  "valor_compra": valor total do contrato como número ou null,
  "valor_total_contrato": valor total do contrato como número ou null,
  "valor_parcela": valor da parcela mensal como número ou null,
  "parcelas_total": total de parcelas como número ou null,
  "parcelas_pagas": parcelas já pagas como número ou 0,
  "indexador": "INCC-M|IPCA|IGP-M|REAL|null",
  "data_aquisicao": "YYYY-MM-DD ou null",
  "status": "disponivel|alugado|em_reforma|vendido"
}

Documento:
${texto.substring(0, 5000)}`,
          context: '',
          systemInstruction: 'Você é um extrator de dados de documentos imobiliários. Retorne SOMENTE JSON válido, sem markdown, sem explicações.'
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro na IA')

      // Extrai JSON da resposta
      const raw = data.result ?? ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('IA não retornou um JSON válido')
      const parsed = JSON.parse(jsonMatch[0])

      setMsg('Salvando imóvel...')
      const { error } = await (supabase.from('imoveis') as any).insert({
        titulo: parsed.titulo || 'Imóvel importado',
        endereco: parsed.endereco || null,
        tipo_imovel: parsed.tipo_imovel || 'residencial',
        area_m2: parsed.area_m2 || null,
        quartos: parsed.quartos || null,
        vagas: null,
        valor_compra: parsed.valor_compra || parsed.valor_total_contrato || null,
        valor_mercado: null,
        status: parsed.status || 'disponivel',
        construtora: parsed.construtora || null,
        unidade: parsed.unidade || null,
        valor_total_contrato: parsed.valor_total_contrato || null,
        valor_parcela: parsed.valor_parcela || null,
        parcelas_total: parsed.parcelas_total || null,
        parcelas_pagas: parsed.parcelas_pagas || 0,
        indexador: parsed.indexador || null,
        data_aquisicao: parsed.data_aquisicao || null,
      })
      if (error) throw new Error(error.message)

      setStatus('ok')
      setMsg(`✅ Imóvel "${parsed.titulo}" importado com sucesso!`)
      setTimeout(() => { onImportado(); onClose() }, 1500)
    } catch (err: any) {
      setStatus('erro')
      setMsg(`❌ Erro: ${err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-page border border-border-subtle rounded-2xl w-full max-w-xl p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <div>
            <h2 className="text-base font-semibold text-fg">🤖 Importar Imóvel via IA</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">Cole o texto do documento ou selecione um arquivo CSV/TXT</p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

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
          <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} className="btn-secondary text-xs">
            📂 Selecionar arquivo
          </button>
          {texto && <span className="text-xs text-emerald-400">✓ {texto.length} caracteres</span>}
        </div>

        {msg && (
          <div className={cn('rounded-xl p-3 mb-4 text-sm', status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : status === 'erro' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400')}>
            {status === 'loading' && <span className="animate-pulse">⏳ </span>}{msg}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleImportar} disabled={!texto.trim() || status === 'loading'} className="btn-primary">
            {status === 'loading' ? '⏳ Processando...' : '🤖 Importar com IA'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Componente principal ────────────────────────────────────────
export function TabImoveis() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [showImportIA, setShowImportIA] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const { data: imoveis, refetch } = useSupabaseQuery<Imovel>('imoveis', {
    orderBy: { column: 'criado_em', ascending: false }
  } as any)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      titulo: form.titulo,
      endereco: form.endereco || null,
      tipo_imovel: form.tipo_imovel,
      area_m2: form.area_m2 ? parseFloat(form.area_m2) : null,
      quartos: form.quartos ? parseInt(form.quartos) : null,
      vagas: form.vagas ? parseInt(form.vagas) : null,
      valor_compra: form.valor_compra ? parseFloat(form.valor_compra) : null,
      valor_mercado: form.valor_mercado ? parseFloat(form.valor_mercado) : null,
      status: form.status,
      construtora: form.construtora || null,
      unidade: form.unidade || null,
      valor_total_contrato: form.valor_total_contrato ? parseFloat(form.valor_total_contrato) : null,
      valor_parcela: form.valor_parcela ? parseFloat(form.valor_parcela) : null,
      parcelas_total: form.parcelas_total ? parseInt(form.parcelas_total) : null,
      parcelas_pagas: form.parcelas_pagas ? parseInt(form.parcelas_pagas) : 0,
      indexador: form.indexador || null,
      data_aquisicao: form.data_aquisicao || null,
    }
    if (editId) {
      await (supabase.from('imoveis') as any).update(payload).eq('id', editId)
    } else {
      await (supabase.from('imoveis') as any).insert(payload)
    }
    setShowForm(false); setEditId(null); refetch(); setForm(FORM_INICIAL)
  }

  const handleExcluir = async (id: string, titulo: string) => {
    if (!confirm(`Excluir o imóvel "${titulo}"?`)) return
    await (supabase.from('imoveis') as any).delete().eq('id', id)
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
      indexador: im.indexador || '', data_aquisicao: im.data_aquisicao || ''
    })
    setEditId(im.id); setShowForm(true)
  }

  const mudarStatus = async (id: string, status: Imovel['status']) => {
    await (supabase.from('imoveis') as any).update({ status }).eq('id', id)
    refetch()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-fg">🏠 Carteira de Imóveis</h2>
        <div className="flex gap-2">
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
            <div><label className="label">Parcelas Pagas</label><input type="number" className="input mt-1" value={form.parcelas_pagas} onChange={e => setForm(f => ({...f, parcelas_pagas: e.target.value}))} /></div>
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
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Data de Aquisição</label><input type="date" className="input mt-1" value={form.data_aquisicao} onChange={e => setForm(f => ({...f, data_aquisicao: e.target.value}))} /></div>
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
                </div>

                {/* Parcelamento */}
                {pt > 0 && (
                  <div className="mb-3 p-3 rounded-lg bg-surface border border-border-subtle">
                    <div className="flex justify-between text-[10px] text-fg-tertiary mb-1.5">
                      <span>📦 Parcelamento {im.indexador ? `· ${im.indexador}` : ''}</span>
                      <span className="font-semibold text-fg">{pp}/{pt} parcelas · {prog}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${prog}%`, background: prog >= 90 ? '#10b981' : prog >= 50 ? '#3b82f6' : '#f59e0b' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {im.valor_parcela && (
                        <div>
                          <p className="text-[9px] text-fg-disabled uppercase">Parcela mensal</p>
                          <p className="text-xs font-bold text-amber-400">{formatCurrency(im.valor_parcela)}</p>
                        </div>
                      )}
                      {saldoDevedor !== null && (
                        <div>
                          <p className="text-[9px] text-fg-disabled uppercase">Saldo devedor est.</p>
                          <p className="text-xs font-bold text-red-400">{formatCurrency(saldoDevedor)}</p>
                        </div>
                      )}
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
              </div>
            )
          })}
        </div>
      )}

      {showImportIA && (
        <ModalImportarIA onClose={() => setShowImportIA(false)} onImportado={refetch} />
      )}
    </div>
  )
}
