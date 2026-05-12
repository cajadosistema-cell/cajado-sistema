'use client'

import { useState, useCallback, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Programas de Milhas/Pontos disponíveis ─────────────────────
export const PROGRAMAS_MILHAS = [
  { id: 'livelo',       label: 'Livelo',        emoji: '🔵', cor: '#0050b3', taxa_padrao: 2.0,  valor_milha: 0.017 },
  { id: 'smiles',       label: 'Smiles (Gol)',  emoji: '🟠', cor: '#ff6b00', taxa_padrao: 1.5,  valor_milha: 0.020 },
  { id: 'tudoazul',     label: 'TudoAzul',      emoji: '💙', cor: '#003b8e', taxa_padrao: 2.0,  valor_milha: 0.018 },
  { id: 'latampass',    label: 'Latam Pass',    emoji: '🔴', cor: '#cc0000', taxa_padrao: 1.0,  valor_milha: 0.022 },
  { id: 'esfera',       label: 'Esfera',        emoji: '🟣', cor: '#8b0000', taxa_padrao: 2.5,  valor_milha: 0.015 },
  { id: 'azul',         label: 'Azul Fid.',     emoji: '🔷', cor: '#0047ab', taxa_padrao: 2.0,  valor_milha: 0.016 },
  { id: 'iupp',         label: 'iUPP (Itaú)',   emoji: '🟡', cor: '#ec7000', taxa_padrao: 2.0,  valor_milha: 0.010 },
  { id: 'membership',   label: 'Membership Rw', emoji: '💚', cor: '#006f3c', taxa_padrao: 1.0,  valor_milha: 0.020 },
  { id: 'outros',       label: 'Outro Programa',emoji: '✈️', cor: '#6b7280', taxa_padrao: 1.0,  valor_milha: 0.015 },
]

function getProg(id?: string) {
  return PROGRAMAS_MILHAS.find(p => p.id === id) ?? null
}

function fmtMilhas(v: number) {
  return v >= 1000 ? (v / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + 'k' : v.toLocaleString('pt-BR')
}

// ── Modal de Configuração de Milhas ─────────────────────────────
export function ModalEditarMilhas({ conta, onClose, onSave }: { conta: any; onClose: () => void; onSave: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    programa_milhas: conta.programa_milhas || '',
    taxa_milhas:     conta.taxa_milhas     != null ? String(conta.taxa_milhas)   : '1',
    saldo_milhas:    conta.saldo_milhas    != null ? String(conta.saldo_milhas)  : '0',
    valor_milha:     conta.valor_milha     != null ? String(conta.valor_milha)   : '0.02',
  })

  const prog = getProg(form.programa_milhas)

  // Auto-preenche ao selecionar programa
  const selecionarProg = (id: string) => {
    const p = PROGRAMAS_MILHAS.find(x => x.id === id)
    if (p) setForm(f => ({ ...f, programa_milhas: id, taxa_milhas: String(p.taxa_padrao), valor_milha: String(p.valor_milha) }))
    else setForm(f => ({ ...f, programa_milhas: '' }))
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    await (supabase.from('contas') as any).update({
      programa_milhas: form.programa_milhas || null,
      taxa_milhas:     parseFloat(form.taxa_milhas)  || 1,
      saldo_milhas:    parseInt(form.saldo_milhas)   || 0,
      valor_milha:     parseFloat(form.valor_milha)  || 0.02,
    }).eq('id', conta.id)
    setLoading(false); onSave(); onClose()
  }

  const removerPrograma = async () => {
    if (!confirm('Remover o programa de milhas deste cartão?')) return
    setLoading(true)
    await (supabase.from('contas') as any).update({ programa_milhas: null, saldo_milhas: 0 }).eq('id', conta.id)
    setLoading(false); onSave(); onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0a0d16] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="h-20 flex items-center justify-between px-5 relative overflow-hidden"
          style={{ background: prog ? `linear-gradient(135deg, ${prog.cor}bb, ${prog.cor}44)` : 'linear-gradient(135deg, #1a1f3188, #0a0d1688)' }}>
          <div>
            <p className="text-white font-bold text-sm">{prog?.emoji} {prog?.label || 'Configurar Milhas'}</p>
            <p className="text-white/60 text-[10px]">{conta.nome_cartao || conta.nome}</p>
          </div>
          <span className="text-4xl">✈️</span>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
          <h2 className="text-sm font-bold text-white">✈️ Milhas & Pontos — {conta.nome_cartao || conta.nome}</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg text-xl">×</button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {/* Seletor de Programa */}
          <div>
            <label className="label mb-2 block">Programa de Fidelidade</label>
            <div className="grid grid-cols-3 gap-1.5">
              {PROGRAMAS_MILHAS.map(p => (
                <button key={p.id} type="button" onClick={() => selecionarProg(p.id)}
                  className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                    form.programa_milhas === p.id ? 'border-white/40 text-white' : 'border-white/8 text-fg-tertiary hover:text-fg'
                  }`}
                  style={form.programa_milhas === p.id ? { background: p.cor + '33', borderColor: p.cor + '66' } : {}}>
                  {p.emoji} {p.label}
                </button>
              ))}
              <button type="button" onClick={() => setForm(f => ({ ...f, programa_milhas: '' }))}
                className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                  !form.programa_milhas ? 'border-white/40 bg-white/5 text-white' : 'border-white/8 text-fg-tertiary hover:text-fg'
                }`}>
                ✕ Nenhum
              </button>
            </div>
          </div>

          {form.programa_milhas && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="label">Pts/R$1 Gasto</label>
                <input className="input mt-1 w-full" type="number" step="0.1" min="0.1" max="20"
                  value={form.taxa_milhas} onChange={e => setForm(f => ({ ...f, taxa_milhas: e.target.value }))} />
                <p className="text-[10px] text-fg-tertiary mt-0.5">Taxa de conversão</p>
              </div>
              <div>
                <label className="label">Saldo Atual (pts)</label>
                <input className="input mt-1 w-full" type="number" min="0" step="100"
                  value={form.saldo_milhas} onChange={e => setForm(f => ({ ...f, saldo_milhas: e.target.value }))} />
                <p className="text-[10px] text-fg-tertiary mt-0.5">Pontos acumulados</p>
              </div>
              <div>
                <label className="label">Valor/Milha (R$)</label>
                <input className="input mt-1 w-full" type="number" step="0.001" min="0.001" max="1"
                  value={form.valor_milha} onChange={e => setForm(f => ({ ...f, valor_milha: e.target.value }))} />
                <p className="text-[10px] text-fg-tertiary mt-0.5">Estimativa resgate</p>
              </div>
            </div>
          )}

          {form.programa_milhas && (
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-xs text-fg-tertiary">
              💡 <strong className="text-fg-secondary">Estimativa:</strong> A cada R$1.000 gastos → <strong className="text-amber-400">
                {Math.round(1000 * parseFloat(form.taxa_milhas || '1')).toLocaleString('pt-BR')} pts
              </strong> ≈ <strong className="text-emerald-400">
                R$ {(Math.round(1000 * parseFloat(form.taxa_milhas || '1')) * parseFloat(form.valor_milha || '0.02')).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong> em resgate
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            {conta.programa_milhas ? (
              <button type="button" onClick={removerPrograma} disabled={loading}
                className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">
                ✕ Remover Programa
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancelar</button>
              <button type="submit" disabled={loading} className="btn-primary text-xs">
                {loading ? 'Salvando...' : '✈️ Salvar Milhas'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Painel de Milhas (exibição no cartão) ───────────────────────
export function PainelMilhas({
  conta,
  gastoMes = 0,
  onEditar,
}: {
  conta: any
  gastoMes?: number
  onEditar: () => void
}) {
  const supabase = createClient()
  const prog = getProg(conta.programa_milhas)
  const [ajustando, setAjustando] = useState(false)
  const [novoSaldo, setNovoSaldo] = useState(String(conta.saldo_milhas || 0))
  const [salvando, setSalvando] = useState(false)

  if (!prog) {
    return (
      <div className="bg-white/3 border border-dashed border-white/10 rounded-xl p-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-fg-tertiary">✈️ Sem programa de milhas</p>
          <p className="text-[10px] text-fg-disabled mt-0.5">Vincule um programa para rastrear seus pontos</p>
        </div>
        <button onClick={onEditar}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 transition-colors">
          + Vincular
        </button>
      </div>
    )
  }

  const taxa         = Number(conta.taxa_milhas)  || 1
  const saldo        = Number(conta.saldo_milhas) || 0
  const valorMilha   = Number(conta.valor_milha)  || 0.02
  const pontosNoMes  = Math.round(gastoMes * taxa)
  const valorSaldo   = saldo * valorMilha

  const salvarSaldo = async () => {
    setSalvando(true)
    await (supabase.from('contas') as any).update({ saldo_milhas: parseInt(novoSaldo) || 0 }).eq('id', conta.id)
    setSalvando(false)
    setAjustando(false)
    // Atualiza localmente sem reload
    conta.saldo_milhas = parseInt(novoSaldo) || 0
  }

  return (
    <div className="rounded-xl border overflow-hidden"
      style={{ borderColor: prog.cor + '33', background: prog.cor + '08' }}>
      {/* Header do programa */}
      <div className="flex items-center justify-between px-4 py-2.5"
        style={{ background: prog.cor + '22' }}>
        <div className="flex items-center gap-2">
          <span className="text-lg">{prog.emoji}</span>
          <div>
            <p className="text-xs font-bold text-fg">{prog.label}</p>
            <p className="text-[10px] text-fg-tertiary">{taxa} pt/R$1 · R$ {valorMilha.toFixed(3)}/pt</p>
          </div>
        </div>
        <button onClick={onEditar} className="text-[10px] text-fg-tertiary hover:text-fg border border-white/10 px-2 py-1 rounded">
          ✏️ Editar
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 divide-x divide-white/5 px-1">
        {/* Saldo */}
        <div className="px-3 py-3">
          <p className="text-[9px] text-fg-disabled uppercase tracking-wider mb-1">Saldo Atual</p>
          {ajustando ? (
            <div className="flex gap-1 items-center">
              <input type="number" min="0" className="input py-0.5 text-xs w-20 h-6"
                value={novoSaldo} onChange={e => setNovoSaldo(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') salvarSaldo(); if (e.key === 'Escape') setAjustando(false) }} />
              <button onClick={salvarSaldo} disabled={salvando}
                className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded font-bold">{salvando ? '...' : '✓'}</button>
            </div>
          ) : (
            <button onClick={() => { setNovoSaldo(String(saldo)); setAjustando(true) }}
              className="text-left group">
              <p className="text-lg font-bold text-fg group-hover:text-amber-400 transition-colors">{fmtMilhas(saldo)}</p>
              <p className="text-[9px] text-fg-disabled">pts · toque p/ editar</p>
            </button>
          )}
        </div>

        {/* Estimativa R$ */}
        <div className="px-3 py-3">
          <p className="text-[9px] text-fg-disabled uppercase tracking-wider mb-1">Vale Aprox.</p>
          <p className="text-lg font-bold text-emerald-400">
            {valorSaldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
          <p className="text-[9px] text-fg-disabled">em resgate</p>
        </div>

        {/* Ganho no mês */}
        <div className="px-3 py-3">
          <p className="text-[9px] text-fg-disabled uppercase tracking-wider mb-1">Ganhos (Mês)</p>
          <p className="text-lg font-bold text-amber-400">+{fmtMilhas(pontosNoMes)}</p>
          <p className="text-[9px] text-fg-disabled">pts estimados</p>
        </div>
      </div>

      {/* Barra de progresso para meta (opcional) */}
      {saldo > 0 && (
        <div className="px-4 pb-3">
          <div className="flex justify-between text-[9px] text-fg-disabled mb-1">
            <span>Progresso rumo a 1 passagem (~{fmtMilhas(10000)} pts)</span>
            <span>{Math.min(Math.round((saldo / 10000) * 100), 100)}%</span>
          </div>
          <div className="w-full bg-white/5 rounded-full h-1.5">
            <div className="h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min((saldo / 10000) * 100, 100)}%`, backgroundColor: prog.cor }} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Hook para recarregar conta com milhas ─────────────────────
export function useMilhasCartao(contaId: string | null) {
  const supabase = createClient()
  const [conta, setConta] = useState<any>(null)
  const carregar = useCallback(async () => {
    if (!contaId) return
    const { data } = await (supabase.from('contas') as any)
      .select('id, nome, nome_cartao, programa_milhas, taxa_milhas, saldo_milhas, valor_milha')
      .eq('id', contaId).single()
    setConta(data)
  }, [contaId, supabase])
  useEffect(() => { carregar() }, [carregar])
  return { conta, recarregar: carregar }
}
