'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { EmptyState } from '@/components/shared/ui'
import { formatCurrency, cn } from '@/lib/utils'

type Veiculo = {
  id: string
  titulo: string
  marca: string | null
  modelo: string | null
  ano_fabricacao: number | null
  ano_modelo: number | null
  placa: string | null
  cor: string | null
  combustivel: string | null
  km_atual: number | null
  valor_compra: number | null
  valor_mercado: number | null
  financiado: boolean
  banco_financiador: string | null
  valor_total_financiado: number | null
  valor_parcela: number | null
  parcelas_total: number | null
  parcelas_pagas: number | null
  vencimento_dia: number | null
  status: 'ativo' | 'vendido' | 'sinistro' | 'em_manutencao'
}

const STATUS_CONFIG = {
  ativo:          { label: 'Ativo',         color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  vendido:        { label: 'Vendido',       color: 'text-fg-secondary bg-muted border-border-subtle' },
  sinistro:       { label: 'Sinistro',      color: 'text-red-400 bg-red-500/10 border-red-500/20' },
  em_manutencao:  { label: 'Manutenção',    color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
}

const FORM_INICIAL = {
  titulo: '', marca: '', modelo: '', ano_fabricacao: '', ano_modelo: '',
  placa: '', cor: '', combustivel: 'flex', km_atual: '',
  valor_compra: '', valor_mercado: '', financiado: false,
  banco_financiador: '', valor_total_financiado: '', valor_parcela: '',
  parcelas_total: '', parcelas_pagas: '0', vencimento_dia: '',
  status: 'ativo' as Veiculo['status']
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
          prompt: `Analise este documento de veículo e extraia os dados em JSON. Retorne APENAS o JSON, sem texto extra:
{
  "titulo": "nome resumido ex: HB20 2023 Prata",
  "marca": "marca do carro ex: Hyundai",
  "modelo": "modelo ex: HB20",
  "ano_fabricacao": número do ano ou null,
  "ano_modelo": número do ano modelo ou null,
  "placa": "placa ex: ABC1D23 ou null",
  "cor": "cor do veículo ou null",
  "combustivel": "flex|gasolina|etanol|diesel|eletrico|hibrido",
  "km_atual": quilometragem atual como número ou null,
  "valor_compra": valor de compra como número ou null,
  "valor_mercado": valor de mercado atual como número ou null,
  "financiado": true ou false,
  "banco_financiador": "nome do banco ou null",
  "valor_total_financiado": valor total financiado como número ou null,
  "valor_parcela": valor da parcela mensal como número ou null,
  "parcelas_total": total de parcelas como número ou null,
  "parcelas_pagas": parcelas já pagas como número ou 0,
  "vencimento_dia": dia do vencimento 1-31 ou null,
  "status": "ativo|vendido|sinistro|em_manutencao"
}

Documento:
${texto.substring(0, 5000)}`,
          context: '',
          systemInstruction: 'Você é um extrator de dados de documentos de veículos e financiamentos automotivos. Retorne SOMENTE JSON válido, sem markdown, sem explicações.'
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro na IA')

      const raw = data.result ?? ''
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('IA não retornou um JSON válido')
      const parsed = JSON.parse(jsonMatch[0])

      setMsg('Salvando veículo...')
      const { error } = await (supabase.from('veiculos') as any).insert({
        titulo: parsed.titulo || 'Veículo importado',
        marca: parsed.marca || null,
        modelo: parsed.modelo || null,
        ano_fabricacao: parsed.ano_fabricacao || null,
        ano_modelo: parsed.ano_modelo || null,
        placa: parsed.placa || null,
        cor: parsed.cor || null,
        combustivel: parsed.combustivel || 'flex',
        km_atual: parsed.km_atual || null,
        valor_compra: parsed.valor_compra || null,
        valor_mercado: parsed.valor_mercado || null,
        financiado: parsed.financiado ?? false,
        banco_financiador: parsed.banco_financiador || null,
        valor_total_financiado: parsed.valor_total_financiado || null,
        valor_parcela: parsed.valor_parcela || null,
        parcelas_total: parsed.parcelas_total || null,
        parcelas_pagas: parsed.parcelas_pagas || 0,
        vencimento_dia: parsed.vencimento_dia || null,
        status: parsed.status || 'ativo',
      })
      if (error) throw new Error(error.message)

      setStatus('ok')
      setMsg(`✅ Veículo "${parsed.titulo}" importado com sucesso!`)
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
            <h2 className="text-base font-semibold text-fg">🤖 Importar Veículo via IA</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">Cole o texto do documento ou contrato de financiamento</p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 mb-4 text-xs text-amber-300 space-y-1">
          <p className="font-semibold">📄 Formatos aceitos:</p>
          <p>• Contrato de financiamento do banco (texto copiado)</p>
          <p>• CSV com dados do veículo e parcelas</p>
          <p>• Qualquer texto com: modelo, placa, valor financiado, parcelas</p>
        </div>

        <textarea
          className="input w-full h-36 text-xs font-mono resize-none mb-3"
          placeholder="Cole aqui o conteúdo do documento do veículo..."
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
export function TabVeiculos() {
  const supabase = createClient()
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [showImportIA, setShowImportIA] = useState(false)
  const [form, setForm] = useState(FORM_INICIAL)

  const { data: veiculos, refetch } = useSupabaseQuery<Veiculo>('veiculos', {
    orderBy: { column: 'criado_em', ascending: false }
  } as any)

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      titulo: form.titulo,
      marca: form.marca || null,
      modelo: form.modelo || null,
      ano_fabricacao: form.ano_fabricacao ? parseInt(form.ano_fabricacao) : null,
      ano_modelo: form.ano_modelo ? parseInt(form.ano_modelo) : null,
      placa: form.placa || null,
      cor: form.cor || null,
      combustivel: form.combustivel,
      km_atual: form.km_atual ? parseInt(form.km_atual) : null,
      valor_compra: form.valor_compra ? parseFloat(form.valor_compra) : null,
      valor_mercado: form.valor_mercado ? parseFloat(form.valor_mercado) : null,
      financiado: form.financiado,
      banco_financiador: form.banco_financiador || null,
      valor_total_financiado: form.valor_total_financiado ? parseFloat(form.valor_total_financiado) : null,
      valor_parcela: form.valor_parcela ? parseFloat(form.valor_parcela) : null,
      parcelas_total: form.parcelas_total ? parseInt(form.parcelas_total) : null,
      parcelas_pagas: form.parcelas_pagas ? parseInt(form.parcelas_pagas) : 0,
      vencimento_dia: form.vencimento_dia ? parseInt(form.vencimento_dia) : null,
      status: form.status,
    }
    if (editId) {
      await (supabase.from('veiculos') as any).update(payload).eq('id', editId)
    } else {
      await (supabase.from('veiculos') as any).insert(payload)
    }
    setShowForm(false); setEditId(null); refetch(); setForm(FORM_INICIAL)
  }

  const handleExcluir = async (id: string, titulo: string) => {
    if (!confirm(`Excluir o veículo "${titulo}"?`)) return
    await (supabase.from('veiculos') as any).delete().eq('id', id)
    refetch()
  }

  const handleEdit = (v: Veiculo) => {
    setForm({
      titulo: v.titulo, marca: v.marca || '', modelo: v.modelo || '',
      ano_fabricacao: v.ano_fabricacao ? String(v.ano_fabricacao) : '',
      ano_modelo: v.ano_modelo ? String(v.ano_modelo) : '',
      placa: v.placa || '', cor: v.cor || '', combustivel: v.combustivel || 'flex',
      km_atual: v.km_atual ? String(v.km_atual) : '',
      valor_compra: v.valor_compra ? String(v.valor_compra) : '',
      valor_mercado: v.valor_mercado ? String(v.valor_mercado) : '',
      financiado: v.financiado, banco_financiador: v.banco_financiador || '',
      valor_total_financiado: v.valor_total_financiado ? String(v.valor_total_financiado) : '',
      valor_parcela: v.valor_parcela ? String(v.valor_parcela) : '',
      parcelas_total: v.parcelas_total ? String(v.parcelas_total) : '',
      parcelas_pagas: v.parcelas_pagas ? String(v.parcelas_pagas) : '0',
      vencimento_dia: v.vencimento_dia ? String(v.vencimento_dia) : '',
      status: v.status
    })
    setEditId(v.id); setShowForm(true)
  }

  const mudarStatus = async (id: string, status: Veiculo['status']) => {
    await (supabase.from('veiculos') as any).update({ status }).eq('id', id)
    refetch()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h2 className="text-sm font-semibold text-fg">🚗 Carteira de Veículos</h2>
        <div className="flex gap-2">
          <button onClick={() => setShowImportIA(true)} className="btn-secondary text-xs">
            🤖 Importar Documento
          </button>
          <button onClick={() => {
            if (showForm) { setShowForm(false); setEditId(null); setForm(FORM_INICIAL) }
            else setShowForm(true)
          }} className="btn-primary text-xs">
            {showForm ? '✕ Cancelar' : '+ Cadastrar Veículo'}
          </button>
        </div>
      </div>

      {/* Formulário */}
      {showForm && (
        <form onSubmit={handleSalvar} className="bg-page border border-border-subtle rounded-xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Título / Apelido *</label>
              <input className="input mt-1" required value={form.titulo}
                onChange={e => setForm(f => ({...f, titulo: e.target.value}))}
                placeholder="Ex: HB20 2023 Prata" />
            </div>
            <div>
              <label className="label">Status</label>
              <select className="input mt-1" value={form.status} onChange={e => setForm(f => ({...f, status: e.target.value as any}))}>
                <option value="ativo">Ativo</option>
                <option value="vendido">Vendido</option>
                <option value="sinistro">Sinistro</option>
                <option value="em_manutencao">Manutenção</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">Marca</label><input className="input mt-1" value={form.marca} onChange={e => setForm(f => ({...f, marca: e.target.value}))} placeholder="Hyundai" /></div>
            <div><label className="label">Modelo</label><input className="input mt-1" value={form.modelo} onChange={e => setForm(f => ({...f, modelo: e.target.value}))} placeholder="HB20" /></div>
            <div><label className="label">Combustível</label>
              <select className="input mt-1" value={form.combustivel} onChange={e => setForm(f => ({...f, combustivel: e.target.value}))}>
                <option value="flex">Flex</option>
                <option value="gasolina">Gasolina</option>
                <option value="etanol">Etanol</option>
                <option value="diesel">Diesel</option>
                <option value="eletrico">Elétrico</option>
                <option value="hibrido">Híbrido</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className="label">Ano Fab.</label><input type="number" className="input mt-1" value={form.ano_fabricacao} onChange={e => setForm(f => ({...f, ano_fabricacao: e.target.value}))} /></div>
            <div><label className="label">Ano Mod.</label><input type="number" className="input mt-1" value={form.ano_modelo} onChange={e => setForm(f => ({...f, ano_modelo: e.target.value}))} /></div>
            <div><label className="label">Placa</label><input className="input mt-1" value={form.placa} onChange={e => setForm(f => ({...f, placa: e.target.value.toUpperCase()}))} placeholder="ABC1D23" /></div>
            <div><label className="label">Cor</label><input className="input mt-1" value={form.cor} onChange={e => setForm(f => ({...f, cor: e.target.value}))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="label">KM Atual</label><input type="number" className="input mt-1" value={form.km_atual} onChange={e => setForm(f => ({...f, km_atual: e.target.value}))} /></div>
            <div><label className="label">Valor de Compra</label><input type="number" step="0.01" className="input mt-1" value={form.valor_compra} onChange={e => setForm(f => ({...f, valor_compra: e.target.value}))} /></div>
            <div><label className="label">Valor de Mercado</label><input type="number" step="0.01" className="input mt-1" value={form.valor_mercado} onChange={e => setForm(f => ({...f, valor_mercado: e.target.value}))} /></div>
          </div>

          {/* Toggle financiado */}
          <div className="flex items-center gap-3 pt-1 border-t border-border-subtle">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.financiado} onChange={e => setForm(f => ({...f, financiado: e.target.checked}))} className="w-4 h-4 accent-blue-500" />
              <span className="text-sm text-fg">🏦 Veículo Financiado</span>
            </label>
          </div>

          {form.financiado && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="label">Banco Financiador</label><input className="input mt-1" value={form.banco_financiador} onChange={e => setForm(f => ({...f, banco_financiador: e.target.value}))} placeholder="Caixa, Bradesco..." /></div>
                <div><label className="label">Total Financiado</label><input type="number" step="0.01" className="input mt-1" value={form.valor_total_financiado} onChange={e => setForm(f => ({...f, valor_total_financiado: e.target.value}))} /></div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div><label className="label">Valor Parcela</label><input type="number" step="0.01" className="input mt-1" value={form.valor_parcela} onChange={e => setForm(f => ({...f, valor_parcela: e.target.value}))} /></div>
                <div><label className="label">Total Parcelas</label><input type="number" className="input mt-1" value={form.parcelas_total} onChange={e => setForm(f => ({...f, parcelas_total: e.target.value}))} /></div>
                <div><label className="label">Pagas</label><input type="number" className="input mt-1" value={form.parcelas_pagas} onChange={e => setForm(f => ({...f, parcelas_pagas: e.target.value}))} /></div>
                <div><label className="label">Vence dia</label><input type="number" min="1" max="31" className="input mt-1" value={form.vencimento_dia} onChange={e => setForm(f => ({...f, vencimento_dia: e.target.value}))} /></div>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs">
              {editId ? 'Salvar Alterações' : 'Salvar Veículo'}
            </button>
          </div>
        </form>
      )}

      {/* Cards */}
      {veiculos.length === 0 ? (
        <div className="bg-page border border-border-subtle rounded-xl p-8">
          <EmptyState message="Nenhum veículo cadastrado" />
          <p className="text-xs text-fg-tertiary text-center mt-2">Use "🤖 Importar Documento" para importar um contrato de financiamento automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {veiculos.map(v => {
            const pt = v.parcelas_total ?? 0
            const pp = v.parcelas_pagas ?? 0
            const prog = pt > 0 ? Math.min(100, Math.round((pp / pt) * 100)) : 0
            const saldoDevedor = pt > 0 && v.valor_parcela ? (pt - pp) * v.valor_parcela : null

            return (
              <div key={v.id} className="bg-page border border-border-subtle rounded-xl p-5 hover:border-border transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-fg flex items-center gap-2">🚗 {v.titulo}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      {v.placa && <span className="text-[10px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded">{v.placa}</span>}
                      {v.combustivel && <span className="text-[10px] text-fg-tertiary">{v.combustivel}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <select className={cn('text-[10px] px-2 py-1 rounded-full border bg-page outline-none', STATUS_CONFIG[v.status].color)}
                      value={v.status} onChange={e => mudarStatus(v.id, e.target.value as Veiculo['status'])}>
                      {Object.entries(STATUS_CONFIG).map(([k, val]) => <option key={k} value={k}>{val.label}</option>)}
                    </select>
                    <button onClick={() => handleEdit(v)} className="text-fg-disabled hover:text-blue-400 transition-colors">✏️</button>
                    <button onClick={() => handleExcluir(v.id, v.titulo)} className="text-fg-disabled hover:text-red-400 transition-colors">🗑️</button>
                  </div>
                </div>

                <div className="flex gap-4 mb-3 text-xs text-fg-tertiary">
                  {v.ano_fabricacao && <span>📅 {v.ano_fabricacao}/{v.ano_modelo ?? '—'}</span>}
                  {v.cor && <span>🎨 {v.cor}</span>}
                  {v.km_atual && <span>🛣️ {v.km_atual.toLocaleString('pt-BR')} km</span>}
                </div>

                {/* Financiamento */}
                {v.financiado && pt > 0 && (
                  <div className="mb-3 p-3 rounded-lg bg-surface border border-border-subtle">
                    <div className="flex justify-between text-[10px] text-fg-tertiary mb-1.5">
                      <span>🏦 {v.banco_financiador || 'Financiamento'}</span>
                      <span className="font-semibold text-fg">{pp}/{pt} parcelas · {prog}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${prog}%`, background: prog >= 90 ? '#10b981' : prog >= 50 ? '#3b82f6' : '#f59e0b' }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {v.valor_parcela && (
                        <div>
                          <p className="text-[9px] text-fg-disabled uppercase">Parcela mensal{v.vencimento_dia ? ` · dia ${v.vencimento_dia}` : ''}</p>
                          <p className="text-xs font-bold text-amber-400">{formatCurrency(v.valor_parcela)}</p>
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

                <div className="pt-3 border-t border-border-subtle/80 grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[9px] text-fg-disabled uppercase tracking-widest">Valor de Compra</p>
                    <p className="text-sm font-semibold text-fg-secondary">{v.valor_compra ? formatCurrency(v.valor_compra) : '—'}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-fg-disabled uppercase tracking-widest">Valor de Mercado</p>
                    <p className="text-sm font-semibold text-emerald-400">{v.valor_mercado ? formatCurrency(v.valor_mercado) : '—'}</p>
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
