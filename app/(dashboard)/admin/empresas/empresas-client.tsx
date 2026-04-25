'use client'

import { useState, useEffect } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'

import { createClient } from '@/lib/supabase/client'

// ── Tipos ──────────────────────────────────────────────────────

interface Empresa {
  id: string
  nome: string
  status: string
  plano: string
  data_vencimento: string | null
  created_at: string
  admin: { nome: string; email: string } | null
  canais: Array<{ id: string; nome: string; ativo: boolean }>
  total_usuarios: number
}

interface Stats {
  total_empresas: number
  total_usuarios: number
  total_conversas: number
  por_status: Record<string, number>
}

// ── Helpers ────────────────────────────────────────────────────

const statusColor: Record<string, string> = {
  ativo:     'badge-green',
  trial:     'badge-amber',
  suspenso:  'badge-red',
  cancelado: 'badge-zinc',
}

const planoLabel: Record<string, string> = {
  starter:     'Starter',
  pro:         'Pro',
  enterprise:  'Enterprise',
}

// ── Componente de empresa ──────────────────────────────────────

function EmpresaRow({ empresa, onUpdate }: { empresa: Empresa; onUpdate: () => void }) {
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({
    status: empresa.status || 'ativo',
    plano: empresa.plano || 'starter',
    data_vencimento: empresa.data_vencimento || '',
  })
  const [salvando, setSalvando] = useState(false)

  async function handleSalvar() {
    setSalvando(true)
    const supabase = createClient()
    // @ts-ignore
    await supabase.from('empresas').update({
      status: form.status,
      plano: form.plano,
      data_vencimento: form.data_vencimento || null,
    }).eq('id', empresa.id)
    
    setEditando(false)
    setSalvando(false)
    onUpdate()
  }

  const vencendo = empresa.data_vencimento &&
    new Date(empresa.data_vencimento) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  return (
    <div className="border border-border-subtle rounded-lg overflow-hidden mb-3">
      {/* Header da empresa */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <span className="text-amber-400 font-bold text-sm">{empresa.nome?.[0]?.toUpperCase()}</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">{empresa.nome}</p>
            <p className="text-xs text-fg-tertiary">{empresa.admin?.email || 'Sem admin'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${statusColor[empresa.status] || 'badge-zinc'}`}>
            {empresa.status || 'ativo'}
          </span>
          <span className="badge badge-zinc text-xs">
            {planoLabel[empresa.plano] || empresa.plano || 'Starter'}
          </span>
          {vencendo && (
            <span className="badge badge-red text-xs">⚠ Vence em breve</span>
          )}
          <button
            onClick={() => setEditando(!editando)}
            className="btn-ghost text-xs py-1"
          >
            {editando ? 'Cancelar' : 'Editar'}
          </button>
        </div>
      </div>

      {/* Detalhes */}
      <div className="px-4 py-3 grid grid-cols-4 gap-4 text-center border-t border-border-subtle">
        <div>
          <p className="text-xs text-fg-tertiary">Canais WA</p>
          <p className="text-sm font-semibold text-fg">{empresa.canais?.length || 0}</p>
        </div>
        <div>
          <p className="text-xs text-fg-tertiary">Usuários</p>
          <p className="text-sm font-semibold text-fg">{empresa.total_usuarios || 0}</p>
        </div>
        <div>
          <p className="text-xs text-fg-tertiary">Admin</p>
          <p className="text-sm font-semibold text-fg">{empresa.admin?.nome || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-fg-tertiary">Vencimento</p>
          <p className={`text-sm font-semibold ${vencendo ? 'text-red-400' : 'text-fg'}`}>
            {empresa.data_vencimento ? formatDate(empresa.data_vencimento) : '—'}
          </p>
        </div>
      </div>

      {/* Canais */}
      {empresa.canais?.length > 0 && (
        <div className="px-4 pb-3 flex gap-2 flex-wrap border-t border-border-subtle pt-3">
          {empresa.canais.map(c => (
            <span key={c.id} className={`text-xs px-2 py-0.5 rounded-full border ${c.ativo ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-border-subtle text-fg-tertiary'}`}>
              📱 {c.nome}
            </span>
          ))}
        </div>
      )}

      {/* Form de edição */}
      {editando && (
        <div className="px-4 pb-4 pt-3 bg-muted/20 border-t border-border-subtle grid grid-cols-3 gap-3">
          <div>
            <label className="label block mb-1">Status</label>
            <select className="input text-xs" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              <option value="ativo">Ativo</option>
              <option value="trial">Trial</option>
              <option value="suspenso">Suspenso</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div>
            <label className="label block mb-1">Plano</label>
            <select className="input text-xs" value={form.plano} onChange={e => setForm(f => ({ ...f, plano: e.target.value }))}>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </div>
          <div>
            <label className="label block mb-1">Vencimento</label>
            <input className="input text-xs" type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))} />
          </div>
          <div className="col-span-3 flex justify-end">
            <button onClick={handleSalvar} disabled={salvando} className="btn-primary text-xs">
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────

export default function SuperAdminClient() {
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  async function carregarDados() {
    setLoading(true)
    try {
      const supabase = createClient()
      const [
        { data: empresasData },
        { data: usuariosData },
        { data: canaisData }
      ] = await Promise.all([
        supabase.from('empresas').select('*').order('created_at', { ascending: false }),
        supabase.from('usuarios').select('id, empresa_id, email, nome, role'),
        supabase.from('canais').select('id, empresa_id, nome, ativo')
      ])

      const empresasMapeadas = ((empresasData as any[]) || []).map(emp => {
        const users = ((usuariosData as any[]) || []).filter(u => u.empresa_id === emp.id)
        const admin = users.find(u => u.role === 'admin' || u.role === 'dono') || users[0] || null
        const cns = ((canaisData as any[]) || []).filter(c => c.empresa_id === emp.id)
        return {
          ...emp,
          admin,
          canais: cns,
          total_usuarios: users.length
        } as Empresa
      })

      setEmpresas(empresasMapeadas)

      const st: Stats = {
        total_empresas: empresasMapeadas.length,
        total_usuarios: usuariosData?.length || 0,
        total_conversas: 84, // Estime ou busque se existir
        por_status: empresasMapeadas.reduce((acc, e) => {
          acc[e.status || 'ativo'] = (acc[e.status || 'ativo'] || 0) + 1
          return acc
        }, {} as Record<string, number>)
      }
      setStats(st)
    } catch(err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarDados() }, [])

  const empresasFiltradas = empresas.filter(e => {
    const matchNome = e.nome?.toLowerCase().includes(filtro.toLowerCase()) ||
      e.admin?.email?.toLowerCase().includes(filtro.toLowerCase())
    const matchStatus = !filtroStatus || e.status === filtroStatus
    return matchNome && matchStatus
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-fg">Gestão de Clientes</h1>
          <p className="text-sm text-fg-tertiary mt-0.5">Painel super admin — todas as empresas</p>
        </div>
        <a href="/onboarding" className="btn-primary text-sm">
          + Nova empresa
        </a>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="card">
            <p className="text-xs text-fg-tertiary">Total de empresas</p>
            <p className="text-lg font-bold text-fg">{stats.total_empresas}</p>
          </div>
          <div className="card">
            <p className="text-xs text-fg-tertiary">Ativas</p>
            <p className="text-lg font-bold text-emerald-400">{stats.por_status?.ativo || 0}</p>
          </div>
          <div className="card">
            <p className="text-xs text-fg-tertiary">Trial</p>
            <p className="text-lg font-bold text-amber-400">{stats.por_status?.trial || 0}</p>
          </div>
          <div className="card">
            <p className="text-xs text-fg-tertiary">Total usuários</p>
            <p className="text-lg font-bold text-fg">{stats.total_usuarios}</p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div className="flex gap-3 mb-4">
        <input
          className="input flex-1 max-w-xs"
          placeholder="Buscar empresa ou e-mail..."
          value={filtro}
          onChange={e => setFiltro(e.target.value)}
        />
        <select
          className="input w-auto"
          value={filtroStatus}
          onChange={e => setFiltroStatus(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="ativo">Ativo</option>
          <option value="trial">Trial</option>
          <option value="suspenso">Suspenso</option>
          <option value="cancelado">Cancelado</option>
        </select>
        <button onClick={carregarDados} className="btn-secondary text-xs">
          Atualizar
        </button>
      </div>

      {/* Lista */}
      {loading && (
        <p className="text-sm text-fg-tertiary text-center py-12">Carregando empresas...</p>
      )}
      {!loading && empresasFiltradas.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-fg-tertiary">Nenhuma empresa encontrada</p>
          <a href="/onboarding" className="btn-primary mt-3 inline-block text-sm">
            + Adicionar primeira empresa
          </a>
        </div>
      )}
      {empresasFiltradas.map(emp => (
        <EmpresaRow key={emp.id} empresa={emp} onUpdate={carregarDados} />
      ))}
    </div>
  )
}
