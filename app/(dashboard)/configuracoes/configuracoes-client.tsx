'use client'

import React, { useState, useRef, useEffect } from 'react'
import { PageHeader, EmptyState } from '@/components/shared/ui'
import { useSupabaseQuery } from '@/lib/hooks/useSupabase'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { TabPermissoes } from './_components/TabPermissoes'
import { useToast } from '@/components/shared/toast'

// ── Tipagens ──────────────────────────────────────────────────
type Funcionario = {
  id: string
  nome: string
  email: string
  ativo: boolean
  cargo: string
  permissoes: string[]
}

// ── Módulos disponíveis para permissão de funcionários ────────
// Espelha exatamente os itens do sidebar.tsx (exceto "Vida & Gestão Pessoal" — exclusivo do admin/CEO)
const MODULOS_DISPONIVEIS = [
  // ── 💰 Financeiro Corporativo ──
  { id: 'financeiro',    nome: '📊 Painel Geral & Cartões',          grupo: '💰 Financeiro Corporativo' },
  { id: 'comissoes',     nome: '🤝 Comissões & Parceiros',           grupo: '💰 Financeiro Corporativo' },
  // ── 🤝 Comercial & WhatsApp ──
  { id: 'inbox',         nome: '💬 Central Inbox (WhatsApp)',        grupo: '🤝 Comercial & WhatsApp' },
  { id: 'cajado',        nome: '🔀 Funil de Negociações (CRM)',      grupo: '🤝 Comercial & WhatsApp' },
  { id: 'vendas',        nome: '📋 Fechamentos & OS',                grupo: '🤝 Comercial & WhatsApp' },
  { id: 'pos-venda',     nome: '🔁 Automação Pós-venda',             grupo: '🤝 Comercial & WhatsApp' },
  { id: 'seguranca-wa',  nome: '🛡️ Anti-Ban WhatsApp',              grupo: '🤝 Comercial & WhatsApp' },
  // ── 🚀 Estratégia Corporativa ──
  { id: 'comunicacao',   nome: '💬 Chat da Equipe & Voz',            grupo: '🚀 Estratégia Corporativa' },
  { id: 'inteligencia',  nome: '🧠 Inteligência & IA',               grupo: '🚀 Estratégia Corporativa' },
  { id: 'organizacao',   nome: '📁 Organização (Tarefas)',            grupo: '🚀 Estratégia Corporativa' },
  { id: 'diario',        nome: '📓 Diário de Bordo',                 grupo: '🚀 Estratégia Corporativa' },
  // ── ⚙️ Configurações ──
  { id: 'configuracoes',   nome: '🏢 Empresa & Permissões',          grupo: '⚙️ Configurações' },
  { id: 'seguranca-geral', nome: '🔒 Segurança & Logs',              grupo: '⚙️ Configurações' },
]

// ── Modal de Cadastro de Funcionário ──────────────────────────
function ModalFuncionario({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const { success, error: toastError } = useToast()
  const [form, setForm] = useState({
    nome: '',
    email: '',
    senha: '',
    cargo: '',
    permissoes: [] as string[]
  })

  const togglePermissao = (id: string) => {
    setForm(prev => ({
      ...prev,
      permissoes: prev.permissoes.includes(id)
        ? prev.permissoes.filter(p => p !== id)
        : [...prev.permissoes, id]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      // Chama a API Route que usa service_role para criar no Supabase Auth + tabela funcionarios
      const res = await fetch('/api/admin/criar-funcionario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: form.nome,
          email: form.email,
          senha: form.senha,
          cargo: form.cargo,
          permissoes: form.permissoes,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setErro(data.error || 'Erro ao criar funcionário.')
        setLoading(false)
        return
      }

      // Sincronizar acesso ao Inbox WhatsApp (Railway) se tiver permissão de inbox
      if (form.permissoes.includes('inbox')) {
        try {
          const inboxUrl = process.env.NEXT_PUBLIC_INBOX_API_URL || 'https://cajado-sistema-production.up.railway.app'
          await fetch(`${inboxUrl}/auth/integrations/sync-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              nome: form.nome,
              email: form.email,
              senha: form.senha,
              role: form.cargo === 'manager' ? 'admin' : 'atendente',
              integration_key: 'fe735c00cfb3613832c4e8b7e88a67af7892cdb6d5c94b901e028e3f25d06ebb'
            }),
          })
        } catch (e) {
          console.warn('Aviso: Falha ao sincronizar atendente com o Inbox', e)
        }
      }

      success(`Acesso criado para ${form.nome}! Ele já pode fazer login.`)
      onSave()
      onClose()
    } catch (err: any) {
      toastError(err?.message || 'Erro inesperado.')
      setErro(err?.message || 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-white/5 rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="flex items-center justify-between mb-5 relative z-10">
          <h2 className="text-xl font-['Syne'] font-bold text-fg">Novo Acesso (Funcionário)</h2>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-2xl leading-none">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Nome Completo *</label>
              <input className="input mt-1" required value={form.nome} placeholder="Ex: Roberto Silva"
                onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} />
            </div>
            <div>
              <label className="label">Cargo / Função</label>
              <input className="input mt-1" value={form.cargo} placeholder="Ex: Analista Financeiro"
                onChange={e => setForm(f => ({ ...f, cargo: e.target.value }))} />
            </div>
            <div>
              <label className="label">Email de Acesso (Login) *</label>
              <input className="input mt-1" type="email" required value={form.email} placeholder="roberto@empresa.com"
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="label">Senha Inicial *</label>
              <input className="input mt-1" type="password" required value={form.senha} placeholder="Mínimo 6 caracteres"
                onChange={e => setForm(f => ({ ...f, senha: e.target.value }))} />
            </div>
          </div>

          <div>
            <label className="label mb-3 block">Áreas Permitidas <span className="text-fg-tertiary">(marque o que o funcionário pode acessar)</span></label>
            {/* Agrupa por grupo */}
            {Array.from(new Set(MODULOS_DISPONIVEIS.map(m => m.grupo))).map(grupo => (
              <div key={grupo} className="mb-4">
                <p className="text-[9px] font-bold text-fg-disabled uppercase tracking-[0.12em] mb-2 px-1">{grupo}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {MODULOS_DISPONIVEIS.filter(m => m.grupo === grupo).map(mod => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => togglePermissao(mod.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 border rounded-lg transition-all text-left",
                        form.permissoes.includes(mod.id)
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : "bg-page/50 border-white/5 text-fg-secondary hover:border-white/10"
                      )}
                    >
                      <span className="text-base leading-none shrink-0">
                        {form.permissoes.includes(mod.id) ? '✅' : '⬜'}
                      </span>
                      <span className="text-xs font-semibold leading-tight">{mod.nome}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-fg-tertiary mt-1">
              O sistema ocultará automaticamente as áreas bloqueadas para este usuário.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
            {erro && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                ⚠️ {erro}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary flex gap-2 items-center" disabled={loading}>
                {loading ? '⏳ Criando acesso...' : '✓ Criar Acesso'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Modal de Edição de Limites ─────────────────────────────────
function ModalEditarLimites({
  funcionario,
  onClose,
  onSave
}: {
  funcionario: { id: string, nome: string, permissoes: string[] };
  onClose: () => void;
  onSave: () => void;
}) {
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')
  const { success, error: toastError } = useToast()
  const [permissoesAtuais, setPermissoesAtuais] = useState<string[]>(funcionario.permissoes || [])

  const togglePermissao = (id: string) => {
    setPermissoesAtuais(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/editar-limites', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: funcionario.id,
          permissoes: permissoesAtuais,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setErro(data.error || 'Erro ao editar limites.')
        setLoading(false)
        return
      }

      success(`Permissões de ${funcionario.nome} atualizadas!`)
      onSave()
      onClose()
    } catch (err: any) {
      toastError(err?.message || 'Erro inesperado.')
      setErro(err?.message || 'Erro inesperado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface border border-white/5 rounded-2xl w-full max-w-2xl shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto p-6">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="flex items-center justify-between mb-5 relative z-10">
          <div>
            <h2 className="text-xl font-['Syne'] font-bold text-fg">Editar Limites</h2>
            <p className="text-xs text-fg-tertiary mt-0.5">Controlando as áreas para: <span className="font-semibold text-emerald-400">{funcionario.nome}</span></p>
          </div>
          <button onClick={onClose} className="text-fg-tertiary hover:text-fg-secondary text-2xl leading-none">×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
          <div>
            <label className="label mb-3 block">Áreas Permitidas <span className="text-fg-tertiary">(marque o que {funcionario.nome} pode acessar)</span></label>
            {Array.from(new Set(MODULOS_DISPONIVEIS.map(m => m.grupo))).map(grupo => (
              <div key={grupo} className="mb-4">
                <p className="text-[9px] font-bold text-fg-disabled uppercase tracking-[0.12em] mb-2 px-1">{grupo}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {MODULOS_DISPONIVEIS.filter(m => m.grupo === grupo).map(mod => (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => togglePermissao(mod.id)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 border rounded-lg transition-all text-left",
                        permissoesAtuais.includes(mod.id)
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                          : "bg-page/50 border-white/5 text-fg-secondary hover:border-white/10"
                      )}
                    >
                      <span className="text-base leading-none shrink-0">
                        {permissoesAtuais.includes(mod.id) ? '✅' : '⬜'}
                      </span>
                      <span className="text-xs font-semibold leading-tight">{mod.nome}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <p className="text-[10px] text-fg-tertiary mt-1">
              Atualizações entram em vigor no próximo acesso ou ao recarregar a página.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
            {erro && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400">
                ⚠️ {erro}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
              <button type="submit" className="btn-primary flex gap-2 items-center !bg-emerald-600 hover:!bg-emerald-500" disabled={loading}>
                {loading ? '⏳ Salvando...' : '💾 Salvar Novos Limites'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Tab Backup Google Drive ───────────────────────────────────
function TabBackup() {
  const supabase = createClient()
  const { success, error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [googleToken, setGoogleToken] = useState<string | null>(null)
  const [googleEmail, setGoogleEmail] = useState('')
  const [frequencia, setFrequencia] = useState<'diario' | 'semanal' | 'mensal' | 'manual'>('semanal')
  const [ultimoBackup, setUltimoBackup] = useState<string | null>(null)
  const [proximoBackup, setProximoBackup] = useState<string | null>(null)
  const [userId, setUserId] = useState('')
  const [progress, setProgress] = useState<string | null>(null)

  // Carrega configuração do banco
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: cfg } = await (supabase.from('configuracoes_backup') as any)
        .select('*').eq('user_id', data.user.id).maybeSingle()
      if (cfg) {
        setGoogleEmail(cfg.google_email || '')
        setFrequencia(cfg.frequencia || 'semanal')
        setUltimoBackup(cfg.ultimo_backup)
        setProximoBackup(cfg.proximo_backup)
        if (cfg.google_email) setGoogleEmail(cfg.google_email)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Detecta retorno do OAuth (access_token no hash da URL)
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const token = params.get('access_token')
      if (token) {
        setGoogleToken(token)
        // Busca e-mail do usuário Google
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json()).then(info => {
          setGoogleEmail(info.email || '')
          // Salva no banco
          if (userId) salvarConfig({ google_email: info.email })
        })
        window.history.replaceState({}, '', window.location.pathname)
        success('Google Drive conectado com sucesso! ✅')
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const salvarConfig = async (extra: Record<string, any> = {}) => {
    if (!userId) return
    const uid = userId
    const proximo = calcularProximoBackup(frequencia)
    const payload = { user_id: uid, frequencia, proximo_backup: proximo, updated_at: new Date().toISOString(), ...extra }
    const { data: exists } = await (supabase.from('configuracoes_backup') as any)
      .select('id').eq('user_id', uid).maybeSingle()
    if (exists?.id) {
      await (supabase.from('configuracoes_backup') as any).update(payload).eq('id', exists.id)
    } else {
      await (supabase.from('configuracoes_backup') as any).insert(payload)
    }
    setProximoBackup(proximo)
  }

  const calcularProximoBackup = (freq: string) => {
    const d = new Date()
    if (freq === 'diario') d.setDate(d.getDate() + 1)
    else if (freq === 'semanal') d.setDate(d.getDate() + 7)
    else if (freq === 'mensal') d.setMonth(d.getMonth() + 1)
    else return null
    return d.toISOString()
  }

  const handleConnectGoogle = () => {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
    if (!clientId) {
      toastError('Configure NEXT_PUBLIC_GOOGLE_CLIENT_ID no arquivo .env.local')
      return
    }
    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file email profile')
    const redirectUri = encodeURIComponent(window.location.href.split('#')[0])
    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}`
    window.location.href = url
  }

  const handleDesconectar = async () => {
    setGoogleToken(null)
    setGoogleEmail('')
    await (supabase.from('configuracoes_backup') as any)
      .update({ google_email: null }).eq('user_id', userId)
    success('Conta Google desconectada.')
  }

  const uploadParaDrive = async (conteudo: string, filename: string, token: string) => {
    const blob = new Blob([conteudo], { type: 'application/json' })
    const metadata = { name: filename, mimeType: 'application/json' }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }))
    form.append('file', blob)
    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    })
    if (!res.ok) throw new Error('Falha no upload para o Drive: ' + (await res.text()))
    return res.json()
  }

  const handleFazerBackup = async (modoDownload = false) => {
    setLoading(true)
    setProgress('Exportando dados do sistema...')
    try {
      const res = await fetch('/api/backup/exportar')
      if (!res.ok) throw new Error('Falha ao exportar dados')
      const conteudo = await res.text()
      const data = new Date().toISOString().split('T')[0]
      const filename = `cajado-backup-${data}.json`

      if (modoDownload || !googleToken) {
        // Download local
        const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }))
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
        URL.revokeObjectURL(url)
        setProgress(null)
        success(`📥 Backup baixado: ${filename}`)
      } else {
        // Upload Google Drive
        setProgress('Enviando para o Google Drive...')
        await uploadParaDrive(conteudo, filename, googleToken)
        const agora = new Date().toISOString()
        setUltimoBackup(agora)
        await salvarConfig({ ultimo_backup: agora })
        setProgress(null)
        success(`☁️ Backup enviado ao Google Drive: ${filename}`)
      }
    } catch (err: any) {
      setProgress(null)
      toastError('Erro no backup: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  const frequencias = [
    { value: 'diario',   label: 'Diário',   desc: 'Todo dia' },
    { value: 'semanal',  label: 'Semanal',  desc: 'A cada 7 dias' },
    { value: 'mensal',   label: 'Mensal',   desc: 'A cada 30 dias' },
    { value: 'manual',   label: 'Manual',   desc: 'Somente quando clicar' },
  ]

  return (
    <div className="space-y-6">
      {/* Status do Google Drive */}
      <div className="card">
        <h2 className="section-title mb-4">☁️ Conexão com Google Drive</h2>
        {googleEmail ? (
          <div className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-red-500/20 flex items-center justify-center text-2xl shrink-0">G</div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-fg">Conta conectada</p>
              <p className="text-xs text-emerald-400 mt-0.5">{googleEmail}</p>
            </div>
            <button onClick={handleDesconectar} className="btn-secondary text-xs text-red-400 border-red-500/20 hover:bg-red-500/10">Desconectar</button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-page/60 border border-white/5">
              <p className="text-sm text-fg-secondary leading-relaxed">
                Conecte sua conta Google para enviar os backups automaticamente para o seu Google Drive.
                Os arquivos ficam salvos na pasta raiz do Drive com o nome <span className="font-mono text-amber-400 text-xs">cajado-backup-[data].json</span>.
              </p>
            </div>
            <button
              onClick={handleConnectGoogle}
              className="flex items-center gap-3 px-5 py-3 bg-white text-zinc-900 font-semibold rounded-xl border border-white/10 hover:bg-white/90 transition-all shadow-lg text-sm"
            >
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Conectar com Google
            </button>

            <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-[11px] text-fg-tertiary leading-relaxed">
              💡 <strong className="text-fg-secondary">Pré-requisito:</strong> Adicione{' '}
              <span className="font-mono text-amber-400">NEXT_PUBLIC_GOOGLE_CLIENT_ID</span> ao{' '}
              <span className="font-mono">.env.local</span> com o Client ID do seu projeto no Google Cloud Console
              (APIs &amp; Services → Credentials → OAuth 2.0 Client IDs).
            </div>
          </div>
        )}
      </div>

      {/* Frequência */}
      <div className="card">
        <h2 className="section-title mb-1">🔁 Frequência de Backup Automático</h2>
        <p className="text-xs text-fg-tertiary mb-4">O sistema irá lembrar e acionar o backup conforme o período configurado.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {frequencias.map(f => (
            <button
              key={f.value}
              onClick={() => { setFrequencia(f.value as any); salvarConfig({ frequencia: f.value }) }}
              className={cn(
                'p-4 rounded-xl border text-left transition-all',
                frequencia === f.value
                  ? 'bg-brand-gold-soft border-brand-gold text-brand-gold'
                  : 'bg-page/50 border-white/5 text-fg-secondary hover:border-white/10'
              )}
            >
              <p className="text-sm font-bold">{f.label}</p>
              <p className="text-[10px] mt-1 opacity-70">{f.desc}</p>
            </button>
          ))}
        </div>

        {proximoBackup && frequencia !== 'manual' && (
          <div className="mt-4 p-3 rounded-lg bg-page/50 border border-white/5 text-xs text-fg-tertiary">
            📅 Próximo backup automático:{' '}
            <span className="font-semibold text-fg">
              {new Date(proximoBackup).toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Fazer Backup */}
      <div className="card">
        <h2 className="section-title mb-4">💾 Fazer Backup Agora</h2>

        {ultimoBackup && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-400">
            ✅ Último backup: {new Date(ultimoBackup).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </div>
        )}

        {progress && (
          <div className="mb-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/10 text-xs text-blue-400 flex items-center gap-2">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            {progress}
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {googleEmail && googleToken && (
            <button
              onClick={() => handleFazerBackup(false)}
              disabled={loading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              ☁️ {loading ? 'Enviando...' : 'Enviar para o Google Drive'}
            </button>
          )}
          <button
            onClick={() => handleFazerBackup(true)}
            disabled={loading}
            className="btn-secondary flex items-center gap-2 disabled:opacity-50"
          >
            📥 {loading ? 'Gerando...' : 'Baixar Backup (JSON)'}
          </button>
        </div>

        <div className="mt-5 p-4 rounded-xl bg-page/50 border border-white/5">
          <p className="text-[11px] font-semibold text-fg-secondary mb-2">📦 O backup inclui:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
            {['Lançamentos', 'Leads/CRM', 'Clientes', 'Produtos', 'Funcionários', 'Gastos PF', 'Receitas PF', 'Agenda', 'Elena (IA)', 'Ocorrências', 'Contas', 'Categorias'].map(t => (
              <span key={t} className="text-[10px] text-fg-tertiary flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-amber-400" /> {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Tab Limpeza de Dados Demo ─────────────────────────────────
function TabLimpeza() {
  const supabase = createClient()
  const { success, error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [dataCorte, setDataCorte] = useState(() => new Date().toISOString().split('T')[0])
  const [confirmText, setConfirmText] = useState('')
  const [resultado, setResultado] = useState<any>(null)

  const handleLimpar = async () => {
    if (confirmText !== 'LIMPAR') return
    setLoading(true)
    setResultado(null)
    try {
      const dataCorteISO = new Date(dataCorte + 'T23:59:59').toISOString()
      const { data, error } = await supabase.rpc('limpar_dados_ficticios', { data_corte: dataCorteISO })
      if (error) throw new Error(error.message)
      setResultado(data)
      success(`✅ ${(data as any)?.total ?? 0} registros fictícios removidos!`)
      setConfirmText('')
    } catch (err: any) {
      toastError('Erro ao limpar: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setLoading(false)
    }
  }

  const tabelas = [
    { key: 'lancamentos',       label: 'Lançamentos financeiros (empresa)' },
    { key: 'leads',             label: 'Leads e negociações (CRM)' },
    { key: 'ocorrencias',       label: 'Ocorrências da equipe' },
    { key: 'chat_interno',      label: 'Mensagens do Chat Interno' },
    { key: 'gastos_pessoais',   label: 'Gastos pessoais (Finanças PF)' },
    { key: 'receitas_pessoais', label: 'Receitas pessoais (Finanças PF)' },
    { key: 'agenda_eventos',    label: 'Eventos da Agenda' },
    { key: 'elena',             label: 'Conversas e ideias da Elena (IA)' },
    { key: 'operacoes_trader',  label: 'Operações Day Trader' },
  ]

  const naoDeleta = [
    'Contas bancárias', 'Carteira de clientes', 'Catálogo de produtos',
    'Categorias financeiras', 'Equipe e acessos', 'Configurações da empresa',
  ]

  return (
    <div className="space-y-6">
      {/* Aviso */}
      <div className="card border-red-500/20 bg-red-500/5">
        <div className="flex items-start gap-3">
          <span className="text-2xl mt-0.5">⚠️</span>
          <div>
            <h2 className="section-title text-red-400 mb-1">Zona de Perigo — Limpeza de Dados Demo</h2>
            <p className="text-sm text-fg-secondary leading-relaxed">
              Remove <strong>permanentemente</strong> dados fictícios inseridos durante a demonstração,
              com base em uma <strong>data de corte</strong>. Tudo criado <em>antes</em> desta data
              é removido. Tudo criado <em>depois</em> permanece intacto.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* O que SERÁ deletado */}
        <div className="card">
          <h3 className="text-sm font-bold text-fg mb-3">🗑️ O que será removido:</h3>
          <ul className="space-y-2">
            {tabelas.map(t => (
              <li key={t.key} className="flex items-center gap-2 text-xs text-fg-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                {t.label}
              </li>
            ))}
          </ul>
        </div>

        {/* O que NÃO será deletado */}
        <div className="card border-emerald-500/20">
          <h3 className="text-sm font-bold text-fg mb-3">✅ O que será preservado:</h3>
          <ul className="space-y-2">
            {naoDeleta.map(item => (
              <li key={item} className="flex items-center gap-2 text-xs text-fg-secondary">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
          <div className="mt-4 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-[10px] text-emerald-400">
              Dados adicionados <strong>após a data de corte</strong> também são preservados.
            </p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="card border-amber-500/20">
        <h3 className="text-sm font-bold text-fg mb-4">🗓️ Configurar Limpeza</h3>
        <div className="max-w-sm space-y-4">
          <div>
            <label className="label">Data de Corte</label>
            <p className="text-[10px] text-fg-tertiary mb-1">Registros criados ATÉ esta data serão apagados.</p>
            <input
              type="date"
              className="input mt-1"
              value={dataCorte}
              onChange={e => setDataCorte(e.target.value)}
            />
          </div>

          <div className="p-3 rounded-xl bg-page/60 border border-white/5 text-xs text-fg-tertiary">
            Serão removidos registros criados antes de{' '}
            <span className="font-bold text-amber-400">
              {new Date(dataCorte + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
          </div>

          <div>
            <label className="label">Confirmação de Segurança</label>
            <p className="text-[10px] text-fg-tertiary mb-1">
              Digite <strong className="text-white">LIMPAR</strong> para habilitar o botão:
            </p>
            <input
              className="input mt-1"
              placeholder="LIMPAR"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value.toUpperCase())}
            />
          </div>

          <button
            onClick={handleLimpar}
            disabled={loading || confirmText !== 'LIMPAR'}
            className="w-full py-3 rounded-xl font-bold text-sm transition-all bg-red-600 hover:bg-red-500 text-white disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(239,68,68,0.3)]"
          >
            {loading ? '⏳ Limpando...' : '🧹 Executar Limpeza de Dados'}
          </button>
        </div>

        {/* Resultado */}
        {resultado && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-sm font-bold text-emerald-400 mb-3">
              ✅ Limpeza concluída — {resultado.total} registros removidos
            </p>
            <div className="grid grid-cols-2 gap-2">
              {tabelas.map(t => (
                <div key={t.key} className="flex justify-between items-center text-xs py-1 border-b border-white/5">
                  <span className="text-fg-tertiary truncate">{t.label.split(' ')[0]}</span>
                  <span className="font-mono font-bold text-fg ml-2">{resultado[t.key] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tab Minha Conta / Alterar Senha ───────────────────────────
function TabMinhaConta() {
  const supabase = createClient()
  const { success, error: toastError } = useToast()
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [form, setForm] = useState({ novaSenha: '', confirmar: '' })
  const [showNova, setShowNova] = useState(false)
  const [showConfirmar, setShowConfirmar] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAlterarSenha = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.novaSenha.length < 6) {
      toastError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (form.novaSenha !== form.confirmar) {
      toastError('As senhas não coincidem. Verifique e tente novamente.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: form.novaSenha })
    if (error) {
      toastError('Erro ao alterar senha: ' + error.message)
    } else {
      success('Senha alterada com sucesso! ✅')
      setForm({ novaSenha: '', confirmar: '' })
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      {/* Card de identificação */}
      <div className="card">
        <h2 className="section-title">Minha Conta</h2>
        <div className="mt-4 flex items-center gap-4 p-4 rounded-xl bg-page/60 border border-white/5">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-700/30 border border-amber-500/20 flex items-center justify-center text-2xl font-bold text-amber-400 font-['Syne'] shrink-0">
            {user?.email?.charAt(0).toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">{user?.user_metadata?.nome || 'Usuário'}</p>
            <p className="text-xs text-fg-tertiary mt-0.5">{user?.email}</p>
            <span className="inline-block mt-1.5 text-[9px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Sessão ativa
            </span>
          </div>
        </div>
      </div>

      {/* Card de alterar senha */}
      <div className="card">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-base">🔒</div>
          <div>
            <h2 className="section-title mb-0">Alterar Senha de Acesso</h2>
            <p className="text-xs text-fg-tertiary">Defina uma senha forte para proteger sua conta.</p>
          </div>
        </div>

        <form onSubmit={handleAlterarSenha} className="mt-6 space-y-4 max-w-md">
          {/* Nova senha */}
          <div>
            <label className="label">Nova Senha *</label>
            <div className="relative mt-1">
              <input
                type={showNova ? 'text' : 'password'}
                className="input w-full pr-10"
                placeholder="Mínimo 6 caracteres"
                value={form.novaSenha}
                onChange={e => setForm(f => ({ ...f, novaSenha: e.target.value }))}
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowNova(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-tertiary hover:text-fg text-xs"
              >
                {showNova ? '🙈' : '👁️'}
              </button>
            </div>
            {/* Indicador de força */}
            {form.novaSenha.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                {[1,2,3,4].map(n => (
                  <div key={n} className={cn('h-1 flex-1 rounded-full transition-colors', 
                    form.novaSenha.length >= n * 3
                      ? n <= 1 ? 'bg-red-500' : n <= 2 ? 'bg-amber-500' : n <= 3 ? 'bg-yellow-400' : 'bg-emerald-500'
                      : 'bg-white/5'
                  )} />
                ))}
                <span className="text-[10px] text-fg-tertiary w-12">
                  {form.novaSenha.length < 4 ? 'Fraca' : form.novaSenha.length < 8 ? 'Média' : form.novaSenha.length < 12 ? 'Boa' : 'Forte'}
                </span>
              </div>
            )}
          </div>

          {/* Confirmar senha */}
          <div>
            <label className="label">Confirmar Nova Senha *</label>
            <div className="relative mt-1">
              <input
                type={showConfirmar ? 'text' : 'password'}
                className={cn('input w-full pr-10 transition-colors', 
                  form.confirmar && form.novaSenha !== form.confirmar ? 'border-red-500/50' : 
                  form.confirmar && form.novaSenha === form.confirmar ? 'border-emerald-500/50' : ''
                )}
                placeholder="Repita a nova senha"
                value={form.confirmar}
                onChange={e => setForm(f => ({ ...f, confirmar: e.target.value }))}
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmar(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-tertiary hover:text-fg text-xs"
              >
                {showConfirmar ? '🙈' : '👁️'}
              </button>
            </div>
            {form.confirmar && (
              <p className={cn('text-[10px] mt-1', form.novaSenha === form.confirmar ? 'text-emerald-400' : 'text-red-400')}>
                {form.novaSenha === form.confirmar ? '✓ Senhas coincidem' : '✗ Senhas não coincidem'}
              </p>
            )}
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading || form.novaSenha !== form.confirmar || form.novaSenha.length < 6}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {loading ? '⏳ Salvando...' : '🔒 Alterar Senha'}
            </button>
          </div>
        </form>

        <div className="mt-6 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
          <p className="text-[11px] text-fg-tertiary leading-relaxed">
            💡 <strong className="text-fg-secondary">Dica de segurança:</strong> Use uma senha com letras maiúsculas, minúsculas, números e símbolos. 
            Não compartilhe sua senha com ninguém. Após a alteração, você permanece logado.
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Client Component ────────────────────────────────────────────
export default function ConfiguracoesClient() {
  const supabase = createClient()
  const { success, error: toastError, confirm: toastConfirm } = useToast()
  const [activeTab, setActiveTab] = useState<'empresa' | 'funcionarios' | 'permissoes' | 'minha-conta' | 'limpeza' | 'backup'>('empresa')
  const [modalOpen, setModalOpen] = useState(false)
  const [editarLimitesFunc, setEditarLimitesFunc] = useState<{ id: string, nome: string, permissoes: string[] } | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)

  // Estado controlado dos campos da empresa
  const [empresa, setEmpresa] = useState({
    nome_fantasia: 'Sistema Cajado',
    razao_social: '',
    cnpj: '',
    inscricao_estadual: '',
    email_suporte: '',
    whatsapp_principal: '',
    website: '',
    cep: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade_estado: '',
  })

  // Carregar dados existentes do Supabase
  useEffect(() => {
    (supabase.from('configuracoes_empresa') as any)
      .select('*')
      .limit(1)
      .single()
      .then(({ data }: any) => {
        if (data) setEmpresa(prev => ({ ...prev, ...(data as any) }))
      })
  }, [])

  // Salvar no Supabase
  const handleSaveEmpresa = async () => {
    if (!empresa.nome_fantasia.trim()) {
      toastError('O Nome Fantasia é obrigatório.')
      return
    }
    setSaving(true)
    try {
      const { data: existing } = await (supabase.from('configuracoes_empresa') as any)
        .select('id')
        .limit(1)
        .single()

      const payload = { ...empresa, updated_at: new Date().toISOString() }

      if (existing?.id) {
        const { error } = await (supabase.from('configuracoes_empresa') as any)
          .update(payload)
          .eq('id', existing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await (supabase.from('configuracoes_empresa') as any)
          .insert(payload)
        if (error) throw new Error(error.message)
      }
      success('Dados da empresa salvos com sucesso!')
    } catch (err: any) {
      toastError('Falha ao salvar: ' + (err.message || 'Erro desconhecido'))
    } finally {
      setSaving(false)
    }
  }

  // Busca CEP via ViaCEP
  const handleBuscarCEP = async (cep: string) => {
    const raw = cep.replace(/\D/g, '')
    if (raw.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${raw}/json/`)
      const data = await res.json()
      if (data.erro) { toastError('CEP não encontrado.'); return }
      setEmpresa(p => ({
        ...p,
        logradouro: data.logradouro || p.logradouro,
        bairro: data.bairro || p.bairro,
        cidade_estado: `${data.localidade} / ${data.uf}`,
      }))
    } catch {
      toastError('Não foi possível buscar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  const handleDeleteFuncionario = async (id: string, email: string, nome: string) => {
    toastConfirm(
      `Tem certeza que deseja excluir o funcionário ${nome} e remover seu acesso ao sistema?`,
      async () => {
        try {
          const res = await fetch('/api/admin/excluir-funcionario', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, email }),
          })
          const data = await res.json()
          if (!res.ok) {
            toastError(data.error || 'Erro ao excluir o funcionário.')
            return
          }
          refetch()
          success(`Funcionário ${nome} foi excluído com sucesso.`)
        } catch (err: any) {
          toastError('Erro inesperado: ' + err.message)
        }
      }
    )
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => {
        setLogoPreview(ev.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Fetch dados do Supabase
  const { data: funcionarios, refetch } = useSupabaseQuery<Funcionario>('funcionarios')

  const totalFuncionarios = funcionarios.filter(f => f.ativo).length

  return (
    <>
      <PageHeader 
        title="Configurações do Sistema" 
        subtitle="Gerencie empresa, acessos e restrições de equipe"
      >
        <button onClick={() => setModalOpen(true)} className="btn-primary shadow-[0_0_20px_rgba(245,166,35,0.3)]">+ Novo Funcionário</button>
      </PageHeader>

      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* Menu Lateral das Configurações */}
        <div className="w-full lg:w-64 shrink-0">
          <div className="card !p-3 flex flex-col gap-1">
            <button 
              onClick={() => setActiveTab('empresa')} 
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium text-left transition-all",
                activeTab === 'empresa' ? "bg-surface text-white" : "text-fg-secondary hover:bg-white/5 hover:text-fg"
              )}
            >
              🏢 Visão Geral (Empresa)
            </button>
            <button 
              onClick={() => setActiveTab('funcionarios')} 
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium text-left transition-all flex items-center justify-between",
                activeTab === 'funcionarios' ? "bg-surface text-white" : "text-fg-secondary hover:bg-white/5 hover:text-fg"
              )}
            >
              <span>👥 Equipe e Restrições</span>
              <span className="bg-white/10 text-xs px-2 py-0.5 rounded-full">{totalFuncionarios}</span>
            </button>
            <button 
              onClick={() => setActiveTab('permissoes')} 
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium text-left transition-all",
                activeTab === 'permissoes' ? "bg-surface text-white" : "text-fg-secondary hover:bg-white/5 hover:text-fg"
              )}
            >
              🔐 Permissões (RBAC)
            </button>
            <div className="my-1 border-t border-white/5" />
            <button 
              onClick={() => setActiveTab('minha-conta')} 
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium text-left transition-all",
                activeTab === 'minha-conta' ? "bg-surface text-white" : "text-fg-secondary hover:bg-white/5 hover:text-fg"
              )}
            >
              🔑 Minha Conta
            </button>
            <button 
              onClick={() => setActiveTab('backup')} 
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium text-left transition-all",
                activeTab === 'backup' ? "bg-surface text-white" : "text-fg-secondary hover:bg-white/5 hover:text-fg"
              )}
            >
              ☁️ Backup / Google Drive
            </button>
            <div className="my-1 border-t border-white/5" />
            <button 
              onClick={() => setActiveTab('limpeza')} 
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium text-left transition-all",
                activeTab === 'limpeza' ? "bg-red-900/60 text-red-300" : "text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
              )}
            >
              🧹 Limpeza de Dados
            </button>
            <div className="my-1 border-t border-white/5" />
            <a
              href="/manual"
              className="px-4 py-3 rounded-lg text-sm font-medium text-left transition-all text-fg-secondary hover:bg-white/5 hover:text-fg flex items-center gap-2"
            >
              📖 Manual do Sistema
            </a>
          </div>
        </div>

        {/* Área Principal */}
        <div className="flex-1">
          {activeTab === 'empresa' && (
            <div className="space-y-6">
              
              {/* Identidade e Documentação */}
              <div className="card">
                <h2 className="section-title">Identidade Policial & Documentação</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div className="md:col-span-2">
                    <label className="label">Símbolo / Marca Oficial</label>
                    <div className="mt-2 flex items-center gap-4 p-4 border border-white/5 rounded-lg bg-page/50">
                       <div className="w-16 h-16 shrink-0 bg-gradient-to-br from-[#f5a623] to-[#c07000] rounded-lg flex items-center justify-center text-zinc-950 font-bold text-2xl shadow-lg shadow-amber-500/20 overflow-hidden relative group">
                         {logoPreview ? (
                           <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                         ) : (
                           <span>C</span>
                         )}
                       </div>
                       <div>
                         <p className="text-sm font-medium text-fg">Logo principal</p>
                         <p className="text-[10px] text-fg-tertiary mb-2">Recomendado: 500x500px em formato PNG/SVG sem fundo.</p>
                         <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg, image/svg+xml" onChange={handleFileUpload} />
                         <button onClick={() => fileInputRef.current?.click()} className="btn-secondary text-xs bg-white/5 border-white/10 hover:bg-white/10">Atualizar imagem</button>
                       </div>
                    </div>
                  </div>
                  <div>
                    <label className="label">Nome Fantasia (Como aparece no sistema)</label>
                    <input className="input mt-1" value={empresa.nome_fantasia}
                      onChange={e => setEmpresa(p => ({...p, nome_fantasia: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Razão Social Jurídica</label>
                    <input className="input mt-1" value={empresa.razao_social}
                      placeholder="VisioPro Agência de Marketing LTDA"
                      onChange={e => setEmpresa(p => ({...p, razao_social: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">CNPJ</label>
                    <input className="input mt-1" value={empresa.cnpj}
                      placeholder="00.000.000/0001-00"
                      onChange={e => setEmpresa(p => ({...p, cnpj: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Inscrição Estadual (IE)</label>
                    <input className="input mt-1" value={empresa.inscricao_estadual}
                      placeholder="000.000.000.000"
                      onChange={e => setEmpresa(p => ({...p, inscricao_estadual: e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Contatos Corporativos */}
              <div className="card">
                <h2 className="section-title">Informações de Contato Oficiais</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="label">Email de Faturamento/Suporte</label>
                    <input className="input mt-1" type="email" value={empresa.email_suporte}
                      placeholder="contato@empresa.com.br"
                      onChange={e => setEmpresa(p => ({...p, email_suporte: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">WhatsApp (Nº Principal) *</label>
                    <input className="input mt-1" type="tel" value={empresa.whatsapp_principal}
                      placeholder="+55 (11) 99999-9999"
                      onChange={e => setEmpresa(p => ({...p, whatsapp_principal: e.target.value}))} />
                  </div>
                  <div>
                    <label className="label">Website ou Landing Page</label>
                    <input className="input mt-1" type="url" value={empresa.website}
                      placeholder="https://meusite.com.br"
                      onChange={e => setEmpresa(p => ({...p, website: e.target.value}))} />
                  </div>
                </div>
              </div>

              {/* Endereço e Faturamento */}
              <div className="card">
                <h2 className="section-title">Sede / Endereço Fiscal</h2>
                <div className="grid grid-cols-6 gap-4 mt-4">
                  <div className="col-span-6 md:col-span-2">
                    <label className="label">CEP *</label>
                    <div className="relative mt-1">
                      <input
                        className="input w-full pr-9"
                        value={empresa.cep}
                        placeholder="00000-000"
                        onChange={e => setEmpresa(p => ({...p, cep: e.target.value}))}
                        onBlur={e => handleBuscarCEP(e.target.value)}
                      />
                      {cepLoading && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-fg-tertiary animate-pulse">🔍</span>
                      )}
                    </div>
                  </div>
                  <div className="col-span-6 md:col-span-4">
                    <label className="label">Logradouro / Avenida</label>
                    <input className="input mt-1" value={empresa.logradouro}
                      placeholder="Ex: Av. Paulista, Jardim Botânico..."
                      onChange={e => setEmpresa(p => ({...p, logradouro: e.target.value}))} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="label">Número</label>
                    <input className="input mt-1" value={empresa.numero}
                      placeholder="Ex: 1000 - Sala 42"
                      onChange={e => setEmpresa(p => ({...p, numero: e.target.value}))} />
                  </div>
                  <div className="col-span-3 md:col-span-2">
                    <label className="label">Bairro</label>
                    <input className="input mt-1" value={empresa.bairro}
                      placeholder="Bairro"
                      onChange={e => setEmpresa(p => ({...p, bairro: e.target.value}))} />
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <label className="label">Cidade / Estado (UF)</label>
                    <input className="input mt-1" value={empresa.cidade_estado}
                      placeholder="São Paulo / SP"
                      onChange={e => setEmpresa(p => ({...p, cidade_estado: e.target.value}))} />
                  </div>
                </div>
              </div>
              <div className="sticky bottom-6 mt-8 flex justify-end z-50 w-full pr-2 pointer-events-none">
                <button
                  id="btn-salvar-emp"
                  onClick={handleSaveEmpresa}
                  disabled={saving}
                  className="btn-primary pointer-events-auto flex gap-2 items-center px-8 py-4 text-[15px] font-bold shadow-[0_10px_40px_rgba(245,166,35,0.7)] hover:shadow-[0_10px_50px_rgba(245,166,35,0.9)] hover:-translate-y-1 transition-all rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-950 border-4 border-zinc-950 disabled:opacity-60"
                >
                  {saving ? '⏳ Salvando...' : '✓ Salvar Todas Alterações da Empresa'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'funcionarios' && (
            <div className="card flex flex-col min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="section-title mb-0">Contas de Acesso Restrito</h2>
                  <p className="text-xs text-fg-tertiary">Gerencie e restrinja as áreas que os membros da sua equipe podem visualizar.</p>
                </div>
                <button onClick={() => setModalOpen(true)} className="btn-secondary text-xs">+ Adicionar Membro</button>
              </div>

              {funcionarios.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <EmptyState message="Nenhum outro funcionário cadastrado. Somente você (CEO) possui acesso irrestrito." />
                </div>
              ) : (
                <div className="space-y-3">
                  {funcionarios.map(func => (
                    <div key={func.id} className="p-4 rounded-xl border border-white/5 bg-page/50 flex items-start justify-between hover:border-white/10 transition-colors">
                      <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center border border-indigo-500/20">
                          <span className="text-indigo-400 font-bold text-sm font-['Syne']">{func.nome.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-fg">{func.nome} <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide bg-emerald-500/10 text-emerald-400">Ativo</span></p>
                          <p className="text-xs text-fg-secondary mt-0.5">{func.cargo} · {func.email}</p>
                          
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {func.permissoes && func.permissoes.map((pID: string) => {
                              const moduleMatch = MODULOS_DISPONIVEIS.find(m => m.id === pID)
                              return (
                                <span key={pID} className="px-2 py-0.5 bg-white/5 border border-white/5 rounded-md text-[10px] font-medium text-fg-secondary">
                                  {moduleMatch?.nome ?? pID}
                                </span>
                              )
                            })}
                            {(!func.permissoes || func.permissoes.length === 0) && (
                              <span className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 rounded-md text-[10px] font-medium text-red-400">
                                Sem acessos (Bloqueado)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button onClick={() => handleDeleteFuncionario(func.id, func.email, func.nome)} className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-colors">Excluir</button>
                        <button onClick={() => setEditarLimitesFunc({ id: func.id, nome: func.nome, permissoes: func.permissoes || [] })} className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium transition-colors">Editar Limites</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'permissoes' && (
            <div className="card">
              <TabPermissoes />
            </div>
          )}

          {activeTab === 'minha-conta' && <TabMinhaConta />}

          {activeTab === 'backup' && <TabBackup />}

          {activeTab === 'limpeza' && <TabLimpeza />}
        </div>
      </div>

      {modalOpen && (
        <ModalFuncionario 
          onClose={() => setModalOpen(false)} 
          onSave={() => {
            refetch()
            setModalOpen(false)
          }} 
        />
      )}
      {editarLimitesFunc && (
        <ModalEditarLimites 
          funcionario={editarLimitesFunc}
          onClose={() => setEditarLimitesFunc(null)} 
          onSave={() => {
            refetch()
            setEditarLimitesFunc(null)
          }} 
        />
      )}
    </>
  )
}
